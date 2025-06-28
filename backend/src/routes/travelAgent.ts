/**
 * Travel Agent routes
 * AI-powered travel planning and assistance endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { attachSessionInfo, getSessionData } from '@/middleware/session';
import { sanitizeInputs } from '@/middleware/inputSanitization';
import { travelAgentService, TripPlanRequest } from '@/services/ai/travelAgentService';
import { createRequestLogger } from '@/utils/logger';
import { isOk, isErr } from '@/utils/result';

const router = Router();

// Apply middleware
router.use(attachSessionInfo);

// Helper to ensure duration has required days property
const ensureDuration = (duration?: { days?: number; flexible?: boolean }) => {
  if (!duration) return undefined;
  if (!duration.days) return { days: 7, flexible: duration.flexible };
  return { days: duration.days, flexible: duration.flexible };
};

// Helper to ensure traveler profile has required fields
const ensureTravelerProfile = (profile?: {
  interests?: string[];
  travelStyle?: string;
  experience?: "first-time" | "occasional" | "frequent";
  concerns?: string[];
}) => {
  if (!profile) return { interests: [], travelStyle: 'moderate' };
  return {
    interests: profile.interests || [],
    travelStyle: profile.travelStyle || 'moderate',
    experience: profile.experience,
    concerns: profile.concerns,
  };
};

// Request schemas
const TripPlanRequestSchema = z.object({
  destination: z.string().optional(),
  origin: z.string().optional(),
  duration: z.object({
    days: z.number().min(1).max(365),
    flexible: z.boolean().optional(),
  }).optional(),
  budget: z.object({
    total: z.number().positive().optional(),
    perDay: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
  }).optional(),
  interests: z.array(z.string()).optional(),
  travelStyle: z.enum(['budget', 'moderate', 'luxury', 'adventure', 'relaxation', 'cultural']).optional(),
  dates: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    flexible: z.boolean().optional(),
    avoidDates: z.array(z.string()).optional(),
  }).optional(),
  travelers: z.object({
    adults: z.number().min(1).max(10),
    children: z.number().min(0).max(10).optional(),
    infants: z.number().min(0).max(5).optional(),
    seniors: z.boolean().optional(),
  }).optional(),
  preferences: z.object({
    accommodation: z.enum(['hotel', 'hostel', 'airbnb', 'resort', 'any']).optional(),
    transportation: z.enum(['flight', 'train', 'car', 'bus', 'any']).optional(),
    activities: z.array(z.string()).optional(),
    dietary: z.array(z.string()).optional(),
    accessibility: z.array(z.string()).optional(),
  }).optional(),
  constraints: z.object({
    mustVisit: z.array(z.string()).optional(),
    avoid: z.array(z.string()).optional(),
    visaFree: z.boolean().optional(),
    directFlightsOnly: z.boolean().optional(),
  }).optional(),
});

const DestinationRequestSchema = z.object({
  request: TripPlanRequestSchema,
});

const ItineraryRequestSchema = z.object({
  request: TripPlanRequestSchema,
  destination: z.string().min(1),
});

const MultiCityRequestSchema = z.object({
  cities: z.array(z.string()).min(2).max(10),
  request: TripPlanRequestSchema,
});

const TravelAdviceRequestSchema = z.object({
  destination: z.string().min(1),
  categories: z.array(z.enum(['safety', 'health', 'culture', 'money', 'transportation', 'general'])).optional(),
});

const PersonalizedTipsRequestSchema = z.object({
  destination: z.string().min(1),
  profile: z.object({
    interests: z.array(z.string()).min(1),
    travelStyle: z.string().min(1),
    experience: z.enum(['first-time', 'occasional', 'frequent']).optional(),
    concerns: z.array(z.string()).optional(),
  }),
});

/**
 * POST /api/v1/travel-agent/destinations
 * Get destination recommendations
 */
router.post('/destinations', sanitizeInputs(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Destination recommendations request', {
      userId: getSessionData(req)?.userId,
      request: req.body,
    });

    // Validate request
    const { request } = DestinationRequestSchema.parse(req.body);

    // Get recommendations
    const result = await travelAgentService.getDestinationRecommendations({
      ...request,
      duration: ensureDuration(request.duration),
    } as TripPlanRequest);

    if (!isOk(result)) {
      requestLogger.warn('Failed to get destinations', {
        error: result.error,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : ""),
        },
      });
      return;
    }

    requestLogger.info('Destination recommendations generated', {
      count: result.value.length,
      destinations: result.value.map(d => d.name),
    });

    res.status(200).json({
      success: true,
      data: {
        destinations: result.value,
        request,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /api/v1/travel-agent/itinerary
 * Create a detailed itinerary
 */
router.post('/itinerary', sanitizeInputs(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Itinerary creation request', {
      userId: getSessionData(req)?.userId,
      destination: req.body.destination,
    });

    // Validate request
    const { request, destination } = ItineraryRequestSchema.parse(req.body);

    // Create itinerary
    const result = await travelAgentService.createItinerary({
      ...request,
      duration: ensureDuration(request.duration),
    } as TripPlanRequest, destination);

    if (!isOk(result)) {
      requestLogger.warn('Failed to create itinerary', {
        error: result.error,
        destination,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : ""),
        },
      });
      return;
    }

    requestLogger.info('Itinerary created', {
      id: result.value.id,
      destination,
      days: result.value.duration.days,
      totalCost: result.value.totalCost.estimated,
    });

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /api/v1/travel-agent/multi-city
 * Plan a multi-city trip
 */
router.post('/multi-city', sanitizeInputs(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Multi-city trip planning request', {
      userId: getSessionData(req)?.userId,
      cities: req.body.cities,
    });

    // Validate request
    const { cities, request } = MultiCityRequestSchema.parse(req.body);

    // Plan trip
    const result = await travelAgentService.planMultiCityTrip(cities, {
      ...request,
      duration: ensureDuration(request.duration),
    } as TripPlanRequest);

    if (!isOk(result)) {
      requestLogger.warn('Failed to plan multi-city trip', {
        error: result.error,
        cities,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : ""),
        },
      });
      return;
    }

    requestLogger.info('Multi-city trip planned', {
      route: result.value.route,
      totalCost: result.value.totalCost,
      itineraryCount: result.value.itineraries.length,
    });

    res.status(200).json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /api/v1/travel-agent/advice
 * Get travel advice for a destination
 */
router.post('/advice', sanitizeInputs(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Travel advice request', {
      userId: getSessionData(req)?.userId,
      destination: req.body.destination,
      categories: req.body.categories,
    });

    // Validate request
    const { destination, categories } = TravelAdviceRequestSchema.parse(req.body);

    // Get advice
    const result = await travelAgentService.getTravelAdvice(destination, categories);

    if (!isOk(result)) {
      requestLogger.warn('Failed to get travel advice', {
        error: result.error,
        destination,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : ""),
        },
      });
      return;
    }

    requestLogger.info('Travel advice generated', {
      destination,
      adviceCount: result.value.length,
    });

    res.status(200).json({
      success: true,
      data: {
        destination,
        advice: result.value,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * POST /api/v1/travel-agent/tips
 * Get personalized travel tips
 */
router.post('/tips', sanitizeInputs(), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const requestLogger = createRequestLogger(req.id || uuidv4());

  try {
    requestLogger.info('Personalized tips request', {
      userId: getSessionData(req)?.userId,
      destination: req.body.destination,
      profile: req.body.profile,
    });

    // Validate request
    const { destination, profile } = PersonalizedTipsRequestSchema.parse(req.body);

    // Get tips
    const result = await travelAgentService.getPersonalizedTips(destination, ensureTravelerProfile(profile));

    if (!isOk(result)) {
      requestLogger.warn('Failed to get personalized tips', {
        error: result.error,
        destination,
      });

      res.status(400).json({
        success: false,
        error: {
          code: (isErr(result) ? result.error.code : ""),
          message: (isErr(result) ? result.error.message : ""),
        },
      });
      return;
    }

    requestLogger.info('Personalized tips generated', {
      destination,
      tipCount: result.value.length,
    });

    res.status(200).json({
      success: true,
      data: {
        destination,
        tips: result.value,
        profile,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors,
        },
      });
      return;
    }

    next(error);
  }
});

/**
 * GET /api/v1/travel-agent/health
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      service: 'travel-agent',
      status: 'healthy',
      features: [
        'destination-recommendations',
        'itinerary-creation',
        'multi-city-planning',
        'travel-advice',
        'personalized-tips',
      ],
    },
  });
});

export default router;