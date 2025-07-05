/**
 * Demo Endpoints Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

describe('Demo Endpoints', () => {
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    agent = request.agent(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/v1/demo/chat', () => {
    it('should respond to demo conversation triggers', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({
          message: 'I want to visit Tokyo in April'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.message).toBeDefined();
      expect(response.body.data.context).toBeDefined();
      expect(response.body.data.context.type).toBe('flight_search');
      expect(response.body.data.suggestions).toBeDefined();
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should provide general response for non-demo messages', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({
          message: 'Random message about weather'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.context.type).toBe('general');
      expect(response.body.data.message).toContain('AI travel agent');
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle provided sessionId', async () => {
      const sessionId = uuidv4();
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({
          message: 'Find cheap flights',
          sessionId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
    });

    it('should validate message length', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({
          message: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate sessionId format', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({
          message: 'Valid message',
          sessionId: 'invalid-uuid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce max message length', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({
          message: 'a'.repeat(501)
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/demo/analyze-price', () => {
    const validFlightData = {
      origin: 'YYZ',
      destination: 'NRT',
      departureDate: '2024-04-15',
      currentPrice: 1200,
      currency: 'CAD'
    };

    it('should analyze flight price with insights', async () => {
      const response = await agent
        .post('/api/v1/demo/analyze-price')
        .send(validFlightData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Check analysis structure
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.analysis.currentPrice).toBe(validFlightData.currentPrice);
      expect(response.body.data.analysis.insight).toBeDefined();
      expect(response.body.data.analysis.recommendation).toMatch(/^(BUY|WAIT|AVOID)$/);
      expect(response.body.data.analysis.confidenceScore).toBeDefined();

      // Check statistics
      expect(response.body.data.statistics).toBeDefined();
      expect(response.body.data.statistics.average).toBeDefined();
      expect(response.body.data.statistics.minimum).toBeDefined();
      expect(response.body.data.statistics.maximum).toBeDefined();
      expect(response.body.data.statistics.currentPercentile).toBeDefined();
      expect(response.body.data.statistics.priceTrend).toMatch(/^(rising|falling|stable)$/);

      // Check price history
      expect(response.body.data.priceHistory).toBeDefined();
      expect(Array.isArray(response.body.data.priceHistory)).toBe(true);
      
      // Check alternatives
      expect(response.body.data.alternatives).toBeDefined();
      expect(Array.isArray(response.body.data.alternatives)).toBe(true);
      expect(response.body.data.alternatives.length).toBeGreaterThan(0);
    });

    it('should validate airport codes', async () => {
      const response = await agent
        .post('/api/v1/demo/analyze-price')
        .send({
          ...validFlightData,
          origin: 'INVALID'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate date format', async () => {
      const response = await agent
        .post('/api/v1/demo/analyze-price')
        .send({
          ...validFlightData,
          departureDate: '15-04-2024' // Wrong format
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate positive price', async () => {
      const response = await agent
        .post('/api/v1/demo/analyze-price')
        .send({
          ...validFlightData,
          currentPrice: -100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle optional returnDate', async () => {
      const response = await agent
        .post('/api/v1/demo/analyze-price')
        .send({
          ...validFlightData,
          returnDate: '2024-04-25'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should default to CAD currency', async () => {
      const { currency, ...dataWithoutCurrency } = validFlightData;
      
      const response = await agent
        .post('/api/v1/demo/analyze-price')
        .send(dataWithoutCurrency)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/demo/routes', () => {
    it('should return available demo routes with insights', async () => {
      const response = await agent
        .get('/api/v1/demo/routes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.routes).toBeDefined();
      expect(Array.isArray(response.body.data.routes)).toBe(true);
      expect(response.body.data.routes.length).toBeGreaterThan(0);

      // Check route structure
      const route = response.body.data.routes[0];
      expect(route.origin).toBeDefined();
      expect(route.destination).toBeDefined();
      expect(route.currentMonth).toBeDefined();
      expect(route.currentMonth.average).toBeDefined();
      expect(route.currentMonth.range).toBeDefined();
      expect(route.currentMonth.range.low).toBeDefined();
      expect(route.currentMonth.range.high).toBeDefined();
      expect(route.insights).toBeDefined();
      expect(route.popularityScore).toBeDefined();
      expect(route.popularityScore).toBeGreaterThanOrEqual(70);
      expect(route.popularityScore).toBeLessThanOrEqual(100);
    });

    it('should include trending destinations', async () => {
      const response = await agent
        .get('/api/v1/demo/routes')
        .expect(200);

      expect(response.body.data.trending).toBeDefined();
      expect(Array.isArray(response.body.data.trending)).toBe(true);
      expect(response.body.data.trending.length).toBeGreaterThan(0);

      const trending = response.body.data.trending[0];
      expect(trending.destination).toBeDefined();
      expect(trending.reason).toBeDefined();
      expect(trending.discount).toBeDefined();
    });
  });

  describe('POST /api/v1/demo/quick-search', () => {
    const validSearchData = {
      origin: 'Toronto',
      destination: 'Tokyo',
      departureDate: '2024-05-15'
    };

    it('should return flight search results with insights', async () => {
      const response = await agent
        .post('/api/v1/demo/quick-search')
        .send(validSearchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      // Check search summary
      expect(response.body.data.searchId).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.route).toBe('Toronto → Tokyo');
      expect(response.body.data.summary.date).toBe(validSearchData.departureDate);
      expect(response.body.data.summary.lowestPrice).toBeDefined();
      expect(response.body.data.summary.priceInsight).toBeDefined();
      expect(response.body.data.summary.bookingRecommendation).toBeDefined();

      // Check flights
      expect(response.body.data.flights).toBeDefined();
      expect(Array.isArray(response.body.data.flights)).toBe(true);
      expect(response.body.data.flights.length).toBeGreaterThan(0);

      const flight = response.body.data.flights[0];
      expect(flight.id).toBeDefined();
      expect(flight.airline).toBeDefined();
      expect(flight.departure).toBeDefined();
      expect(flight.arrival).toBeDefined();
      expect(flight.duration).toBeDefined();
      expect(flight.stops).toBeDefined();
      expect(flight.price).toBeDefined();
      expect(flight.cabin).toBeDefined();
      expect(flight.insight).toBeDefined();

      // Check monitoring offer
      expect(response.body.data.monitoringOffer).toBeDefined();
      expect(response.body.data.monitoringOffer.message).toBeDefined();
      expect(response.body.data.monitoringOffer.targetPrice).toBeDefined();
      expect(response.body.data.monitoringOffer.confidence).toBeDefined();
    });

    it('should handle optional returnDate', async () => {
      const response = await agent
        .post('/api/v1/demo/quick-search')
        .send({
          ...validSearchData,
          returnDate: '2024-05-25'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await agent
        .post('/api/v1/demo/quick-search')
        .send({
          destination: 'Tokyo'
          // Missing origin and departureDate
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should find recommended flight', async () => {
      const response = await agent
        .post('/api/v1/demo/quick-search')
        .send(validSearchData)
        .expect(200);

      const recommendedFlight = response.body.data.flights.find((f: any) => f.recommended);
      expect(recommendedFlight).toBeDefined();
      expect(recommendedFlight.recommended).toBe(true);
    });

    it('should adjust prices based on departure date proximity', async () => {
      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 5);
      
      const nearResponse = await agent
        .post('/api/v1/demo/quick-search')
        .send({
          ...validSearchData,
          departureDate: nearFutureDate.toISOString().split('T')[0]
        })
        .expect(200);

      const farFutureDate = new Date();
      farFutureDate.setDate(farFutureDate.getDate() + 90);
      
      const farResponse = await agent
        .post('/api/v1/demo/quick-search')
        .send({
          ...validSearchData,
          departureDate: farFutureDate.toISOString().split('T')[0]
        })
        .expect(200);

      // Prices should be higher for near-future flights
      const nearLowestPrice = nearResponse.body.data.summary.lowestPrice;
      const farLowestPrice = farResponse.body.data.summary.lowestPrice;
      
      expect(nearLowestPrice).toBeGreaterThan(farLowestPrice);
    });
  });

  describe('Error Response Formats', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .send({}) // Missing required field
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should handle malformed JSON', async () => {
      const response = await agent
        .post('/api/v1/demo/chat')
        .set('Content-Type', 'application/json')
        .send('{"invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});