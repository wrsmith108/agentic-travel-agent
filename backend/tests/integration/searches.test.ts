/**
 * Integration tests for saved searches endpoints
 */

import request from 'supertest';
import app from '../../src/server';
import { isOk } from '../../src/utils/result';
import type { SuperAgentTest } from 'supertest';

describe('Searches API Integration Tests', () => {
  let agent: SuperAgentTest;
  let savedSearchId: string;

  beforeAll(async () => {
    // @ts-expect-error - SuperTest type issue
    agent = request.agent(app);
    
    // Authenticate user
    const mockAuthResponse = await agent
      .post('/api/v1/dev/mock-token')
      .send({
        sub: 'test-user-123',
        email: 'test@example.com',
        email_verified: true,
        isAdmin: false,
      });
    
    expect(mockAuthResponse.status).toBe(200);
  });

  afterAll(async () => {
    // Clean up by deleting any test data
    if (savedSearchId) {
      await agent.delete(`/api/v1/searches/${savedSearchId}`);
    }
  });

  describe('POST /api/v1/searches', () => {
    it('should create a saved search with valid data', async () => {
      const savedSearchData = {
        name: 'NYC to LAX Weekend Trip',
        searchQuery: {
          from: {
            city: 'New York',
            airport: 'JFK',
          },
          to: {
            city: 'Los Angeles',
            airport: 'LAX',
          },
          departDate: '2025-03-15',
          returnDate: '2025-03-18',
          passengers: {
            adults: 2,
            children: 0,
            infants: 0,
          },
          class: 'ECONOMY',
          tripType: 'ROUND_TRIP',
        },
        priceAlerts: {
          enabled: true,
          threshold: 500,
          thresholdType: 'PERCENTAGE',
        },
        frequency: 'DAILY',
        expiresAt: '2025-04-01T00:00:00Z',
      };

      const response = await agent
        .post('/api/v1/searches')
        .send(savedSearchData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(savedSearchData.name);
      expect(response.body.data.userId).toBe('test-user-123');
      
      // Save ID for cleanup
      savedSearchId = response.body.data.id;
    });

    it('should reject invalid search query data', async () => {
      const invalidData = {
        name: 'Invalid Search',
        searchQuery: {
          // Missing required fields
          from: { city: 'New York' },
          // Missing to, departDate, etc.
        },
      };

      const response = await agent
        .post('/api/v1/searches')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle missing authentication', async () => {
      const response = await request(app)
        .post('/api/v1/searches')
        .send({ name: 'Test' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/searches', () => {
    it('should retrieve user saved searches', async () => {
      const response = await agent
        .get('/api/v1/searches')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Should include the search we created
      const createdSearch = response.body.data.find((s: any) => s.id === savedSearchId);
      expect(createdSearch).toBeDefined();
      expect(createdSearch.name).toBe('NYC to LAX Weekend Trip');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/searches')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PUT /api/v1/searches/:id', () => {
    it('should update a saved search', async () => {
      const updateData = {
        name: 'Updated NYC to LAX Trip',
        priceAlerts: {
          enabled: false,
        },
        isActive: false,
      };

      const response = await agent
        .put(`/api/v1/searches/${savedSearchId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent search', async () => {
      const response = await agent
        .put('/api/v1/searches/non-existent-id')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject invalid update data', async () => {
      const invalidUpdate = {
        searchQuery: {
          // Invalid partial query
          from: { invalidField: 'test' },
        },
      };

      const response = await agent
        .put(`/api/v1/searches/${savedSearchId}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/searches/check-prices', () => {
    it('should check prices for all saved searches', async () => {
      const response = await agent
        .post('/api/v1/searches/check-prices')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Each result should have search info and price check results
      response.body.data.forEach((result: any) => {
        expect(result).toHaveProperty('searchId');
        expect(result).toHaveProperty('searchName');
        expect(result).toHaveProperty('currentPrice');
        expect(result).toHaveProperty('previousPrice');
        expect(result).toHaveProperty('priceChange');
        expect(result).toHaveProperty('alert');
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/searches/check-prices')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Search History Endpoints', () => {
    describe('GET /api/v1/searches/history', () => {
      it('should retrieve user search history', async () => {
        const response = await agent
          .get('/api/v1/searches/history')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        
        // Each history entry should have expected fields
        response.body.data.forEach((entry: any) => {
          expect(entry).toHaveProperty('id');
          expect(entry).toHaveProperty('searchQuery');
          expect(entry).toHaveProperty('timestamp');
          expect(entry).toHaveProperty('resultCount');
        });
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/v1/searches/history')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
    });

    describe('DELETE /api/v1/searches/history', () => {
      it('should clear user search history', async () => {
        const response = await agent
          .delete('/api/v1/searches/history')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Search history cleared successfully');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .delete('/api/v1/searches/history')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });

      it('should verify history is cleared', async () => {
        // First clear history
        await agent.delete('/api/v1/searches/history');
        
        // Then verify it's empty
        const response = await agent
          .get('/api/v1/searches/history')
          .expect(200);

        expect(response.body.data).toHaveLength(0);
      });
    });
  });

  describe('DELETE /api/v1/searches/:id', () => {
    it('should delete a saved search', async () => {
      // Create a search to delete
      const createResponse = await agent
        .post('/api/v1/searches')
        .send({
          name: 'Search to Delete',
          searchQuery: {
            from: { city: 'Boston', airport: 'BOS' },
            to: { city: 'Miami', airport: 'MIA' },
            departDate: '2025-04-01',
            passengers: { adults: 1, children: 0, infants: 0 },
            class: 'ECONOMY',
            tripType: 'ONE_WAY',
          },
        });

      const searchToDelete = createResponse.body.data.id;

      // Delete the search
      await agent
        .delete(`/api/v1/searches/${searchToDelete}`)
        .expect(204);

      // Verify it's deleted
      const getResponse = await agent
        .get('/api/v1/searches')
        .expect(200);

      const deletedSearch = getResponse.body.data.find((s: any) => s.id === searchToDelete);
      expect(deletedSearch).toBeUndefined();
    });

    it('should return error for non-existent search', async () => {
      const response = await agent
        .delete('/api/v1/searches/non-existent-id')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/v1/searches/some-id')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});