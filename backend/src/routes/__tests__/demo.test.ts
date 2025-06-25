import request from 'supertest';
import app from '../../server';
import { v4 as uuidv4 } from 'uuid';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');

// Mock UUID for consistent testing
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

describe('Demo API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/demo/chat', () => {
    it('should handle basic chat messages successfully', async () => {
      const chatData = {
        message: 'Tell me about flight deals',
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        sessionId: 'test-uuid-123',
        message: expect.stringContaining('travel agent'),
        context: {
          type: 'general',
        },
        suggestions: expect.arrayContaining([
          expect.stringContaining('Tokyo'),
          expect.stringContaining('London'),
        ]),
      });
    });

    it('should recognize Tokyo-related queries', async () => {
      const chatData = {
        message: 'I want to visit Tokyo in April',
        sessionId: 'a1b2c3d4-e5f6-4789-0123-456789abcdef', // Valid UUID
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        sessionId: 'a1b2c3d4-e5f6-4789-0123-456789abcdef',
        message: expect.stringContaining('cherry blossoms'),
        context: {
          type: 'flight_search',
          extracted: {
            destination: 'Tokyo',
            timeframe: 'April',
            flexibility: 'week',
          },
        },
      });
    });

    it('should handle messages with sessionId', async () => {
      const validUuid = 'a1b2c3d4-e5f6-4789-0123-456789abcdef';
      const chatData = {
        message: 'Find flights to Paris',
        sessionId: validUuid,
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(200);

      expect(response.body.data.sessionId).toBe(validUuid);
    });

    it('should reject empty messages', async () => {
      const chatData = {
        message: '',
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject messages exceeding max length', async () => {
      const longMessage = 'a'.repeat(501);
      const chatData = {
        message: longMessage,
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid sessionId format', async () => {
      const chatData = {
        message: 'Find flights',
        sessionId: 'not-a-valid-uuid',
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/demo/analyze-price', () => {
    const validFlightData = {
      origin: 'YYZ',
      destination: 'NRT',
      departureDate: '2024-06-15',
      currentPrice: 1350,
      currency: 'CAD',
    };

    it('should analyze flight prices successfully', async () => {
      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(validFlightData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        analysis: {
          currentPrice: 1350,
          insight: expect.any(String),
          recommendation: expect.stringMatching(/^(BUY|WAIT|AVOID)$/),
          confidenceScore: 0.85,
        },
        statistics: {
          average: expect.any(Number),
          minimum: expect.any(Number),
          maximum: expect.any(Number),
          currentPercentile: expect.any(Number),
          priceTrend: expect.stringMatching(/^(rising|falling|stable)$/),
        },
        priceHistory: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            price: expect.any(Number),
          }),
        ]),
        alternatives: expect.arrayContaining([
          expect.objectContaining({
            description: expect.any(String),
            savings: expect.any(String),
            effort: expect.stringMatching(/^(low|medium|high)$/),
          }),
        ]),
      });
    });

    it('should handle optional returnDate', async () => {
      const dataWithReturn = {
        ...validFlightData,
        returnDate: '2024-06-30',
      };

      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(dataWithReturn)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid airport codes', async () => {
      const invalidData = {
        ...validFlightData,
        origin: 'Y1', // Too short
      };

      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid date format', async () => {
      const invalidData = {
        ...validFlightData,
        departureDate: '15-06-2024', // Wrong format
      };

      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative prices', async () => {
      const invalidData = {
        ...validFlightData,
        currentPrice: -100,
      };

      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle different currencies', async () => {
      const usdData = {
        ...validFlightData,
        currency: 'USD' as const,
      };

      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(usdData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should generate price history with events', async () => {
      const response = await request(app)
        .post('/api/v1/demo/analyze-price')
        .send(validFlightData)
        .expect(200);

      const eventsInHistory = response.body.data.priceHistory.filter((p: any) => p.event);
      expect(eventsInHistory.length).toBeGreaterThan(0);
      expect(eventsInHistory.some((e: any) => e.event.includes('Sweet spot'))).toBe(true);
    });
  });

  describe('GET /api/v1/demo/routes', () => {
    it('should return available routes with insights', async () => {
      const response = await request(app)
        .get('/api/v1/demo/routes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        routes: expect.arrayContaining([
          expect.objectContaining({
            origin: expect.any(String),
            destination: expect.any(String),
            currentMonth: {
              average: expect.any(Number),
              range: {
                low: expect.any(Number),
                high: expect.any(Number),
              },
            },
            insights: expect.objectContaining({
              bestBookingWindow: expect.any(String),
              cheapestDays: expect.arrayContaining([expect.any(String)]),
            }),
            popularityScore: expect.any(Number),
          }),
        ]),
        trending: expect.arrayContaining([
          expect.objectContaining({
            destination: expect.any(String),
            reason: expect.any(String),
            discount: expect.stringMatching(/\d+%/),
          }),
        ]),
      });
    });

    it('should include YYZ-NRT and YYZ-LHR routes', async () => {
      const response = await request(app)
        .get('/api/v1/demo/routes')
        .expect(200);

      const routes = response.body.data.routes;
      const hasTokyoRoute = routes.some((r: any) => r.origin === 'YYZ' && r.destination === 'NRT');
      const hasLondonRoute = routes.some((r: any) => r.origin === 'YYZ' && r.destination === 'LHR');

      expect(hasTokyoRoute).toBe(true);
      expect(hasLondonRoute).toBe(true);
    });

    it('should generate popularity scores between 70-100', async () => {
      const response = await request(app)
        .get('/api/v1/demo/routes')
        .expect(200);

      const routes = response.body.data.routes;
      routes.forEach((route: any) => {
        expect(route.popularityScore).toBeGreaterThanOrEqual(70);
        expect(route.popularityScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('POST /api/v1/demo/quick-search', () => {
    const validSearchData = {
      origin: 'YYZ',
      destination: 'JFK',
      departureDate: '2024-07-20',
    };

    it('should return flight search results', async () => {
      const response = await request(app)
        .post('/api/v1/demo/quick-search')
        .send(validSearchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        searchId: 'test-uuid-123',
        summary: {
          route: 'YYZ → JFK',
          date: '2024-07-20',
          lowestPrice: expect.any(Number),
          priceInsight: expect.any(String),
          bookingRecommendation: expect.any(String),
        },
        flights: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            airline: expect.any(String),
            departure: expect.stringContaining('2024-07-20'),
            arrival: expect.stringContaining('2024-07-20'),
            duration: expect.any(String),
            stops: expect.any(Number),
            price: expect.any(Number),
            cabin: 'economy',
            insight: expect.any(String),
          }),
        ]),
        monitoringOffer: expect.objectContaining({
          message: expect.any(String),
          targetPrice: expect.any(Number),
          confidence: expect.any(String),
        }),
      });
    });

    it('should have at least 3 flight options', async () => {
      const response = await request(app)
        .post('/api/v1/demo/quick-search')
        .send(validSearchData)
        .expect(200);

      expect(response.body.data.flights.length).toBeGreaterThanOrEqual(3);
    });

    it('should mark one flight as recommended', async () => {
      const response = await request(app)
        .post('/api/v1/demo/quick-search')
        .send(validSearchData)
        .expect(200);

      const recommendedFlights = response.body.data.flights.filter((f: any) => f.recommended);
      expect(recommendedFlights.length).toBe(1);
    });

    it('should handle optional returnDate', async () => {
      const searchWithReturn = {
        ...validSearchData,
        returnDate: '2024-07-30',
      };

      const response = await request(app)
        .post('/api/v1/demo/quick-search')
        .send(searchWithReturn)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should adjust prices based on departure proximity', async () => {
      // Search for flight tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nearSearch = {
        ...validSearchData,
        departureDate: tomorrow.toISOString().split('T')[0],
      };

      // Search for flight in 90 days
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 90);
      const farSearch = {
        ...validSearchData,
        departureDate: farFuture.toISOString().split('T')[0],
      };

      const [nearResponse, farResponse] = await Promise.all([
        request(app).post('/api/v1/demo/quick-search').send(nearSearch),
        request(app).post('/api/v1/demo/quick-search').send(farSearch),
      ]);

      const nearLowest = nearResponse.body.data.summary.lowestPrice;
      const farLowest = farResponse.body.data.summary.lowestPrice;

      // Near-term flights should be more expensive
      expect(nearLowest).toBeGreaterThan(farLowest);
    });

    it('should reject missing required fields', async () => {
      const invalidData = {
        origin: 'YYZ',
        // missing destination and departureDate
      };

      const response = await request(app)
        .post('/api/v1/demo/quick-search')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should generate appropriate booking recommendations', async () => {
      // Test imminent departure
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 5);
      const nearSearch = {
        ...validSearchData,
        departureDate: nearDate.toISOString().split('T')[0],
      };

      const response = await request(app)
        .post('/api/v1/demo/quick-search')
        .send(nearSearch)
        .expect(200);

      expect(response.body.data.summary.bookingRecommendation).toContain('Book now');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .put('/api/v1/demo/routes')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should include request ID in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send({ message: '' })
        .expect(400);

      expect(response.body.meta?.requestId).toBeDefined();
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML in chat messages', async () => {
      const chatData = {
        message: '<script>alert("xss")</script>Hello',
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(200);

      expect(response.body.data.message).not.toContain('<script>');
      expect(response.body.data.message).toContain('Hello');
    });

    it('should reject SQL injection attempts', async () => {
      const chatData = {
        message: "'; DROP TABLE users; --",
      };

      const response = await request(app)
        .post('/api/v1/demo/chat')
        .send(chatData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Performance', () => {
    it('should respond to chat within reasonable time', async () => {
      const start = Date.now();
      
      await request(app)
        .post('/api/v1/demo/chat')
        .send({ message: 'Hello' })
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
    });

    it('should respond to quick-search within reasonable time', async () => {
      const start = Date.now();
      
      await request(app)
        .post('/api/v1/demo/quick-search')
        .send({
          origin: 'YYZ',
          destination: 'LAX',
          departureDate: '2024-08-15',
        })
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(3000); // Should respond within 3 seconds
    });
  });
});