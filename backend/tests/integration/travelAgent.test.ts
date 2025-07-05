/**
 * Integration tests for Travel Agent endpoints
 */

import request from 'supertest';
import app from '../../src/server';
import { travelAgentService } from '../../src/services/ai/travelAgentService';
import { ok, err } from '../../src/utils/result';

const agent = request.agent(app);
const agent2 = request.agent(app);

// Mock the travel agent service
jest.mock('../../src/services/ai/travelAgentService', () => ({
  travelAgentService: {
    getDestinationRecommendations: jest.fn(),
    createItinerary: jest.fn(),
    planMultiCityTrip: jest.fn(),
    getTravelAdvice: jest.fn(),
    getPersonalizedTips: jest.fn(),
  },
}));

const mockTravelAgentService = travelAgentService as jest.Mocked<typeof travelAgentService>;

describe('Travel Agent API Endpoints', () => {
  let authToken: string;
  let authToken2: string;

  beforeAll(async () => {
    // Get auth tokens for testing
    const authResponse1 = await agent.post('/api/v1/dev/mock-token').send({
      email: 'test@example.com',
      role: 'user',
    });
    authToken = authResponse1.body.data.token;

    const authResponse2 = await agent2.post('/api/v1/dev/mock-token').send({
      email: 'other@example.com',
      role: 'user',
    });
    authToken2 = authResponse2.body.data.token;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/travel-agent/destinations', () => {
    const validRequest = {
      request: {
        origin: 'New York',
        duration: { days: 7, flexible: true },
        budget: { total: 2000, currency: 'USD' },
        interests: ['culture', 'food', 'history'],
        travelStyle: 'moderate',
        travelers: { adults: 2 },
        preferences: {
          accommodation: 'hotel',
          transportation: 'flight',
        },
      },
    };

    it('should get destination recommendations with valid request', async () => {
      const mockDestinations = [
        {
          name: 'Paris, France',
          description: 'City of lights with rich culture and cuisine',
          matchScore: 0.95,
          estimatedCost: { min: 1500, max: 2000, currency: 'USD' },
          highlights: ['Eiffel Tower', 'Louvre Museum', 'French cuisine'],
          bestTimeToVisit: 'April to October',
        },
        {
          name: 'Rome, Italy',
          description: 'Ancient history meets modern Italian culture',
          matchScore: 0.90,
          estimatedCost: { min: 1400, max: 1900, currency: 'USD' },
          highlights: ['Colosseum', 'Vatican City', 'Italian food'],
          bestTimeToVisit: 'April to June, September to October',
        },
      ];

      mockTravelAgentService.getDestinationRecommendations.mockResolvedValue(ok(mockDestinations));

      const response = await agent
        .post('/api/v1/travel-agent/destinations')
        .send(validRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          destinations: mockDestinations,
          request: validRequest.request,
        },
      });

      expect(mockTravelAgentService.getDestinationRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'New York',
          duration: { days: 7, flexible: true },
        })
      );
    });

    it('should handle validation errors', async () => {
      const invalidRequest = {
        request: {
          duration: { days: 400 }, // exceeds max of 365
          travelers: { adults: 0 }, // min is 1
        },
      };

      const response = await agent
        .post('/api/v1/travel-agent/destinations')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: expect.any(Array),
        },
      });
    });

    it('should handle service errors', async () => {
      mockTravelAgentService.getDestinationRecommendations.mockResolvedValue(
        err({
          code: 'AI_SERVICE_ERROR',
          message: 'Failed to generate recommendations',
        })
      );

      const response = await agent
        .post('/api/v1/travel-agent/destinations')
        .send(validRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'Failed to generate recommendations',
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/travel-agent/destinations')
        .send(validRequest)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: expect.any(String),
        },
      });
    });
  });

  describe('POST /api/v1/travel-agent/itinerary', () => {
    const validRequest = {
      destination: 'Paris, France',
      request: {
        duration: { days: 5 },
        budget: { total: 2000, currency: 'USD' },
        interests: ['art', 'food', 'history'],
        travelStyle: 'moderate',
        dates: {
          start: '2025-06-15',
          end: '2025-06-20',
        },
        travelers: { adults: 2 },
      },
    };

    it('should create itinerary with valid request', async () => {
      const mockItinerary = {
        id: 'itinerary-123',
        destination: 'Paris, France',
        duration: { days: 5 },
        startDate: '2025-06-15',
        endDate: '2025-06-20',
        days: [
          {
            day: 1,
            date: '2025-06-15',
            activities: [
              {
                time: '09:00',
                activity: 'Arrive at Charles de Gaulle Airport',
                duration: '1h',
                cost: { amount: 0, currency: 'USD' },
                type: 'transportation',
              },
              {
                time: '14:00',
                activity: 'Visit Eiffel Tower',
                duration: '2h',
                cost: { amount: 30, currency: 'USD' },
                type: 'sightseeing',
              },
            ],
          },
        ],
        totalCost: {
          estimated: 1800,
          breakdown: {
            accommodation: 600,
            transportation: 400,
            food: 500,
            activities: 300,
          },
          currency: 'USD',
        },
        recommendations: {
          accommodation: ['Hotel Le Marais', 'Hotel Saint-Germain'],
          restaurants: ['Le Comptoir du Relais', 'L\'Ami Jean'],
          tips: ['Book Louvre tickets in advance', 'Learn basic French phrases'],
        },
      };

      mockTravelAgentService.createItinerary.mockResolvedValue(ok(mockItinerary));

      const response = await agent
        .post('/api/v1/travel-agent/itinerary')
        .send(validRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: mockItinerary,
      });

      expect(mockTravelAgentService.createItinerary).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: { days: 5 },
          budget: { total: 2000, currency: 'USD' },
        }),
        'Paris, France'
      );
    });

    it('should require destination field', async () => {
      const invalidRequest = {
        request: validRequest.request,
        // missing destination
      };

      const response = await agent
        .post('/api/v1/travel-agent/itinerary')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
    });
  });

  describe('POST /api/v1/travel-agent/multi-city', () => {
    const validRequest = {
      cities: ['London', 'Paris', 'Rome'],
      request: {
        duration: { days: 10 },
        budget: { total: 3500, currency: 'USD' },
        travelStyle: 'moderate',
        travelers: { adults: 2 },
      },
    };

    it('should plan multi-city trip with valid request', async () => {
      const mockMultiCityPlan = {
        route: ['London', 'Paris', 'Rome'],
        totalDuration: { days: 10 },
        totalCost: 3200,
        currency: 'USD',
        itineraries: [
          {
            city: 'London',
            days: 3,
            startDate: '2025-06-15',
            endDate: '2025-06-17',
            highlights: ['Big Ben', 'British Museum'],
            estimatedCost: 1000,
          },
          {
            city: 'Paris',
            days: 4,
            startDate: '2025-06-18',
            endDate: '2025-06-21',
            highlights: ['Eiffel Tower', 'Louvre'],
            estimatedCost: 1200,
          },
          {
            city: 'Rome',
            days: 3,
            startDate: '2025-06-22',
            endDate: '2025-06-24',
            highlights: ['Colosseum', 'Vatican'],
            estimatedCost: 1000,
          },
        ],
        transportation: [
          {
            from: 'London',
            to: 'Paris',
            method: 'Eurostar train',
            duration: '2h 15m',
            cost: 150,
          },
          {
            from: 'Paris',
            to: 'Rome',
            method: 'Flight',
            duration: '2h',
            cost: 200,
          },
        ],
      };

      mockTravelAgentService.planMultiCityTrip.mockResolvedValue(ok(mockMultiCityPlan));

      const response = await agent
        .post('/api/v1/travel-agent/multi-city')
        .send(validRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: mockMultiCityPlan,
      });
    });

    it('should require at least 2 cities', async () => {
      const invalidRequest = {
        cities: ['London'], // only 1 city
        request: validRequest.request,
      };

      const response = await agent
        .post('/api/v1/travel-agent/multi-city')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
    });

    it('should limit to maximum 10 cities', async () => {
      const invalidRequest = {
        cities: Array(11).fill('City'), // 11 cities
        request: validRequest.request,
      };

      const response = await agent
        .post('/api/v1/travel-agent/multi-city')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
    });
  });

  describe('POST /api/v1/travel-agent/advice', () => {
    const validRequest = {
      destination: 'Tokyo, Japan',
      categories: ['safety', 'culture', 'money'],
    };

    it('should get travel advice with valid request', async () => {
      const mockAdvice = [
        {
          category: 'safety',
          title: 'General Safety',
          content: 'Tokyo is one of the safest cities in the world...',
          priority: 'high',
        },
        {
          category: 'culture',
          title: 'Cultural Etiquette',
          content: 'Remove shoes when entering homes and some restaurants...',
          priority: 'high',
        },
        {
          category: 'money',
          title: 'Currency and Payments',
          content: 'Japan is still largely a cash-based society...',
          priority: 'medium',
        },
      ];

      mockTravelAgentService.getTravelAdvice.mockResolvedValue(ok(mockAdvice));

      const response = await agent
        .post('/api/v1/travel-agent/advice')
        .send(validRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          destination: 'Tokyo, Japan',
          advice: mockAdvice,
        },
      });
    });

    it('should get advice for all categories when not specified', async () => {
      const request = {
        destination: 'Tokyo, Japan',
        // categories not specified
      };

      mockTravelAgentService.getTravelAdvice.mockResolvedValue(ok([]));

      const response = await agent
        .post('/api/v1/travel-agent/advice')
        .send(request)
        .expect(200);

      expect(mockTravelAgentService.getTravelAdvice).toHaveBeenCalledWith(
        'Tokyo, Japan',
        undefined
      );
    });

    it('should validate destination is required', async () => {
      const invalidRequest = {
        categories: ['safety'],
        // missing destination
      };

      const response = await agent
        .post('/api/v1/travel-agent/advice')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
    });
  });

  describe('POST /api/v1/travel-agent/tips', () => {
    const validRequest = {
      destination: 'Barcelona, Spain',
      profile: {
        interests: ['architecture', 'food', 'beach'],
        travelStyle: 'moderate',
        experience: 'occasional',
        concerns: ['pickpocketing', 'language barrier'],
      },
    };

    it('should get personalized tips with valid request', async () => {
      const mockTips = [
        {
          category: 'sightseeing',
          tip: 'Book Sagrada Familia tickets online in advance',
          relevance: 'Based on your interest in architecture',
          priority: 'high',
        },
        {
          category: 'safety',
          tip: 'Keep valuables in front pockets and be aware in crowded areas',
          relevance: 'Addressing your concern about pickpocketing',
          priority: 'high',
        },
        {
          category: 'food',
          tip: 'Try tapas hopping in the Gothic Quarter',
          relevance: 'Based on your interest in food',
          priority: 'medium',
        },
      ];

      mockTravelAgentService.getPersonalizedTips.mockResolvedValue(ok(mockTips));

      const response = await agent
        .post('/api/v1/travel-agent/tips')
        .send(validRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          destination: 'Barcelona, Spain',
          tips: mockTips,
          profile: validRequest.profile,
        },
      });
    });

    it('should require interests in profile', async () => {
      const invalidRequest = {
        destination: 'Barcelona, Spain',
        profile: {
          // missing interests
          travelStyle: 'moderate',
        },
      };

      const response = await agent
        .post('/api/v1/travel-agent/tips')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
    });

    it('should validate experience enum values', async () => {
      const invalidRequest = {
        destination: 'Barcelona, Spain',
        profile: {
          interests: ['food'],
          travelStyle: 'moderate',
          experience: 'expert', // invalid enum value
        },
      };

      const response = await agent
        .post('/api/v1/travel-agent/tips')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
      });
    });
  });

  describe('GET /api/v1/travel-agent/health', () => {
    it('should return health status', async () => {
      const response = await agent
        .get('/api/v1/travel-agent/health')
        .expect(200);

      expect(response.body).toMatchObject({
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

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/travel-agent/health')
        .expect(200);

      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle missing optional fields gracefully', async () => {
      const minimalRequest = {
        request: {
          // Only required fields
          travelers: { adults: 1 },
        },
      };

      mockTravelAgentService.getDestinationRecommendations.mockResolvedValue(ok([]));

      const response = await agent
        .post('/api/v1/travel-agent/destinations')
        .send(minimalRequest)
        .expect(200);

      expect(mockTravelAgentService.getDestinationRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          travelers: { adults: 1 },
        })
      );
    });

    it('should handle concurrent requests from different users', async () => {
      mockTravelAgentService.getDestinationRecommendations.mockResolvedValue(ok([]));

      const promises = [
        agent.post('/api/v1/travel-agent/destinations').send({
          request: { travelers: { adults: 1 } },
        }),
        agent2.post('/api/v1/travel-agent/destinations').send({
          request: { travelers: { adults: 2 } },
        }),
      ];

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockTravelAgentService.getDestinationRecommendations).toHaveBeenCalledTimes(2);
    });
  });
});