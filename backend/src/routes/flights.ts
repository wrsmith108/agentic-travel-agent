/**
 * Flight search routes
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '@/middleware/authNew';
import { validateRequest } from '@/middleware/validation';
import {
  searchFlights,
  getFlightOffer,
  searchAirports,
  getLocationInfo,
  formatDuration,
  formatPrice,
} from '@/services/flights/amadeusService';
import {
  FlightSearchRequestSchema,
  createFlightError,
} from '@/types/flight';
import { z } from 'zod';

const router = Router();

// All flight routes require authentication
router.use(authenticate);

/**
 * Search for flights
 * POST /api/v1/flights/search
 */
router.post(
  '/search',
  validateRequest(FlightSearchRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await searchFlights(req.body);

      if (!result.ok) {
        const { type, message, details } = result.error;
        const statusCode = 
          type === 'VALIDATION_ERROR' ? 400 :
          type === 'RATE_LIMIT' ? 429 :
          type === 'NOT_FOUND' ? 404 :
          type === 'AUTHENTICATION_ERROR' ? 401 :
          500;
          
        return res.status(statusCode).json({
          success: false,
          error: { type, message, details },
        });
      }

      // Format the response
      const formattedFlights = result.value.map(flight => ({
        ...flight,
        duration: formatDuration(flight.duration),
        price: {
          ...flight.price,
          formatted: formatPrice(flight.price.total, flight.price.currency),
        },
      }));

      res.json({
        success: true,
        data: {
          flights: formattedFlights,
          count: formattedFlights.length,
        },
      });
    } catch (error) {
      console.error('Flight search error:', error);
      res.status(500).json({
        success: false,
        error: createFlightError('SYSTEM_ERROR', 'Failed to search flights'),
      });
    }
  }
);

/**
 * Get flight offer details
 * GET /api/v1/flights/offers/:id
 */
router.get('/offers/:id', async (req: Request, res: Response) => {
  try {
    const result = await getFlightOffer(req.params.id);

    if (!result.ok) {
      const { type, message } = result.error;
      const statusCode = type === 'NOT_FOUND' ? 404 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: { type, message },
      });
    }

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    console.error('Get flight offer error:', error);
    res.status(500).json({
      success: false,
      error: createFlightError('SYSTEM_ERROR', 'Failed to get flight details'),
    });
  }
});

/**
 * Search airports by keyword
 * GET /api/v1/flights/airports
 */
router.get(
  '/airports',
  validateRequest(
    z.object({
      keyword: z.string().min(2),
    }),
    'query'
  ),
  async (req: Request, res: Response) => {
    try {
      const { keyword } = req.query as { keyword: string };
      const result = await searchAirports(keyword);

      if (!result.ok) {
        return res.status(500).json({
          success: false,
          error: result.error,
        });
      }

      res.json({
        success: true,
        data: result.value,
      });
    } catch (error) {
      console.error('Airport search error:', error);
      res.status(500).json({
        success: false,
        error: createFlightError('SYSTEM_ERROR', 'Failed to search airports'),
      });
    }
  }
);

/**
 * Get airport/location information
 * GET /api/v1/flights/locations/:code
 */
router.get('/locations/:code', async (req: Request, res: Response) => {
  try {
    const result = await getLocationInfo(req.params.code);

    if (!result.ok) {
      const { type, message } = result.error;
      const statusCode = type === 'NOT_FOUND' ? 404 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: { type, message },
      });
    }

    res.json({
      success: true,
      data: result.value,
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({
      success: false,
      error: createFlightError('SYSTEM_ERROR', 'Failed to get location info'),
    });
  }
});

/**
 * Quick flight search (simplified parameters)
 * POST /api/v1/flights/quick-search
 */
router.post(
  '/quick-search',
  validateRequest(
    z.object({
      from: z.string().min(3),
      to: z.string().min(3),
      when: z.string(),
      returnWhen: z.string().optional(),
      travelers: z.number().min(1).default(1),
    })
  ),
  async (req: Request, res: Response) => {
    try {
      const { from, to, when, returnWhen, travelers } = req.body;
      
      // Parse the date strings
      const departureDate = new Date(when).toISOString().split('T')[0];
      const returnDate = returnWhen ? new Date(returnWhen).toISOString().split('T')[0] : undefined;
      
      // Convert to full search request
      const searchRequest = {
        origin: from.toUpperCase(),
        destination: to.toUpperCase(),
        departureDate,
        returnDate,
        adults: travelers,
        children: 0,
        infants: 0,
        travelClass: 'ECONOMY' as const,
        nonStop: false,
        currencyCode: 'USD',
        maxResults: 10,
      };
      
      const result = await searchFlights(searchRequest);

      if (!result.ok) {
        const { type, message, details } = result.error;
        const statusCode = 
          type === 'VALIDATION_ERROR' ? 400 :
          type === 'RATE_LIMIT' ? 429 :
          500;
          
        return res.status(statusCode).json({
          success: false,
          error: { type, message, details },
        });
      }

      // Format the response
      const formattedFlights = result.value.map(flight => ({
        ...flight,
        duration: formatDuration(flight.duration),
        price: {
          ...flight.price,
          formatted: formatPrice(flight.price.total, flight.price.currency),
        },
      }));

      res.json({
        success: true,
        data: {
          flights: formattedFlights,
          count: formattedFlights.length,
          search: {
            from,
            to,
            departureDate,
            returnDate,
            travelers,
          },
        },
      });
    } catch (error) {
      console.error('Quick flight search error:', error);
      res.status(500).json({
        success: false,
        error: createFlightError('SYSTEM_ERROR', 'Failed to search flights'),
      });
    }
  }
);

export default router;