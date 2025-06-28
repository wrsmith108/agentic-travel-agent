/**
 * Flight Search Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';

describe('Flight Search Endpoints', () => {
  let agent: request.SuperAgentTest;
  const testUser = {
    email: 'flighttest@example.com',
    password: 'FlightTest123!',
    firstName: 'Flight',
    lastName: 'Tester'
  };

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    agent = request.agent(app);

    // Register and login test user
    await agent.post('/api/v1/auth/register').send(testUser);
    await agent.post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/v1/flights/search', () => {
    it('should search flights with valid parameters', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const returnDate = new Date(futureDate);
      returnDate.setDate(returnDate.getDate() + 7);

      const searchParams = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: futureDate.toISOString().split('T')[0],
        returnDate: returnDate.toISOString().split('T')[0],
        adults: 1,
        cabinClass: 'ECONOMY',
        currency: 'USD'
      };

      const response = await agent
        .post('/api/v1/flights/search')
        .send(searchParams)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.offers).toBeDefined();
      expect(Array.isArray(response.body.data.offers)).toBe(true);
      expect(response.body.data.offers.length).toBeGreaterThan(0);
      
      // Check offer structure
      const offer = response.body.data.offers[0];
      expect(offer.id).toBeDefined();
      expect(offer.price).toBeDefined();
      expect(offer.price.currency).toBe('USD');
      expect(offer.price.total).toBeDefined();
      expect(offer.itineraries).toBeDefined();
      expect(offer.itineraries.length).toBe(2); // Round trip
    });

    it('should search one-way flights', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 45);

      const searchParams = {
        origin: 'ORD',
        destination: 'MIA',
        departureDate: futureDate.toISOString().split('T')[0],
        adults: 2,
        cabinClass: 'BUSINESS'
      };

      const response = await agent
        .post('/api/v1/flights/search')
        .send(searchParams)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.offers).toBeDefined();
      expect(response.body.data.offers[0].itineraries.length).toBe(1); // One way
    });

    it('should fail with invalid airport code', async () => {
      const searchParams = {
        origin: 'XXX', // Invalid
        destination: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      };

      const response = await agent
        .post('/api/v1/flights/search')
        .send(searchParams)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail with past departure date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const searchParams = {
        origin: 'JFK',
        destination: 'LAX',
        departureDate: pastDate.toISOString().split('T')[0],
        adults: 1
      };

      const response = await agent
        .post('/api/v1/flights/search')
        .send(searchParams)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle different cabin classes', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);

      const cabinClasses = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
      
      for (const cabinClass of cabinClasses) {
        const searchParams = {
          origin: 'SFO',
          destination: 'JFK',
          departureDate: futureDate.toISOString().split('T')[0],
          adults: 1,
          cabinClass
        };

        const response = await agent
          .post('/api/v1/flights/search')
          .send(searchParams)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.offers).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/flights/saved-searches', () => {
    it('should return empty array initially', async () => {
      const response = await agent
        .get('/api/v1/flights/saved-searches')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/flights/saved-searches', () => {
    it('should save a search successfully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const savedSearch = {
        name: 'NYC to LA Summer Trip',
        searchParams: {
          origin: 'JFK',
          destination: 'LAX',
          departureDate: futureDate.toISOString().split('T')[0],
          adults: 1,
          cabinClass: 'ECONOMY'
        },
        priceAlerts: {
          enabled: true,
          targetPrice: 500
        }
      };

      const response = await agent
        .post('/api/v1/flights/saved-searches')
        .send(savedSearch)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.message).toBeDefined();
    });

    it('should list saved searches after saving', async () => {
      const response = await agent
        .get('/api/v1/flights/saved-searches')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const saved = response.body.data[0];
      expect(saved.name).toBeDefined();
      expect(saved.searchParams).toBeDefined();
      expect(saved.priceAlerts).toBeDefined();
      expect(saved.isActive).toBe(true);
    });
  });

  describe('DELETE /api/v1/flights/saved-searches/:id', () => {
    it('should delete a saved search', async () => {
      // First get the list to find an ID
      const listResponse = await agent
        .get('/api/v1/flights/saved-searches')
        .expect(200);

      const searchId = listResponse.body.data[0].id;

      // Delete it
      const deleteResponse = await agent
        .delete(`/api/v1/flights/saved-searches/${searchId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify it's gone
      const verifyResponse = await agent
        .get('/api/v1/flights/saved-searches')
        .expect(200);

      const found = verifyResponse.body.data.find((s: any) => s.id === searchId);
      expect(found).toBeUndefined();
    });
  });

  describe('POST /api/v1/flights/check-prices', () => {
    beforeAll(async () => {
      // Save a search with price alerts
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await agent.post('/api/v1/flights/saved-searches').send({
        name: 'Price Check Test',
        searchParams: {
          origin: 'BOS',
          destination: 'SFO',
          departureDate: futureDate.toISOString().split('T')[0],
          adults: 1,
          cabinClass: 'ECONOMY'
        },
        priceAlerts: {
          enabled: true,
          targetPrice: 400
        }
      });
    });

    it('should check prices for saved searches', async () => {
      const response = await agent
        .post('/api/v1/flights/check-prices')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        const priceCheck = response.body.data[0];
        expect(priceCheck.savedSearchId).toBeDefined();
        expect(priceCheck.currentLowestPrice).toBeDefined();
        // Alert may or may not be generated depending on mock prices
      }
    });
  });
});