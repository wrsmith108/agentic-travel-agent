/**
 * Integration tests for price alerts endpoints
 */

import request from 'supertest';
import app from '../../src/server';
import { isOk } from '../../src/utils/result';
import type { SuperAgentTest } from 'supertest';

describe('Price Alerts API Integration Tests', () => {
  let agent: SuperAgentTest;
  let mockAlertId: string;

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

    // Create a saved search with price alerts to generate test data
    const savedSearchResponse = await agent
      .post('/api/v1/searches')
      .send({
        name: 'Test Flight with Price Alert',
        searchQuery: {
          from: { city: 'San Francisco', airport: 'SFO' },
          to: { city: 'Tokyo', airport: 'NRT' },
          departDate: '2025-06-01',
          returnDate: '2025-06-15',
          passengers: { adults: 1, children: 0, infants: 0 },
          class: 'ECONOMY',
          tripType: 'ROUND_TRIP',
        },
        priceAlerts: {
          enabled: true,
          threshold: 10,
          thresholdType: 'PERCENTAGE',
        },
      });

    expect(savedSearchResponse.status).toBe(201);
  });

  describe('GET /api/v1/price-alerts', () => {
    it('should retrieve all price alerts for authenticated user', async () => {
      const response = await agent
        .get('/api/v1/price-alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Each alert should have expected structure
      response.body.data.forEach((alert: any) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('savedSearchId');
        expect(alert).toHaveProperty('searchName');
        expect(alert).toHaveProperty('previousPrice');
        expect(alert).toHaveProperty('currentPrice');
        expect(alert).toHaveProperty('priceChange');
        expect(alert).toHaveProperty('changePercentage');
        expect(alert).toHaveProperty('triggeredAt');
        expect(alert).toHaveProperty('isRead');
        expect(alert).toHaveProperty('flightDetails');
      });

      // Save an alert ID for testing mark as read
      if (response.body.data.length > 0) {
        mockAlertId = response.body.data[0].id;
      }
    });

    it('should filter unread alerts when unread=true', async () => {
      const response = await agent
        .get('/api/v1/price-alerts?unread=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // All returned alerts should be unread
      response.body.data.forEach((alert: any) => {
        expect(alert.isRead).toBe(false);
      });
    });

    it('should return all alerts when unread=false', async () => {
      const response = await agent
        .get('/api/v1/price-alerts?unread=false')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle invalid query parameters gracefully', async () => {
      const response = await agent
        .get('/api/v1/price-alerts?unread=invalid')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/price-alerts')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle empty alerts list', async () => {
      // Create new agent with different user
      const newAgent = request.agent(app);
      await newAgent
        .post('/api/v1/dev/mock-token')
        .send({
          sub: 'empty-user-456',
          email: 'empty@example.com',
          email_verified: true,
          isAdmin: false,
        });

      const response = await newAgent
        .get('/api/v1/price-alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PUT /api/v1/price-alerts/:id/read', () => {
    it('should mark a price alert as read', async () => {
      // Skip if no mock alert ID available
      if (!mockAlertId) {
        console.log('No mock alert ID available, skipping test');
        return;
      }

      const response = await agent
        .put(`/api/v1/price-alerts/${mockAlertId}/read`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert marked as read');

      // Verify the alert is now marked as read
      const alertsResponse = await agent
        .get('/api/v1/price-alerts')
        .expect(200);

      const markedAlert = alertsResponse.body.data.find((a: any) => a.id === mockAlertId);
      if (markedAlert) {
        expect(markedAlert.isRead).toBe(true);
      }
    });

    it('should return 404 for non-existent alert', async () => {
      const response = await agent
        .put('/api/v1/price-alerts/non-existent-id/read')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/v1/price-alerts/some-id/read')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should not allow marking another user\'s alert as read', async () => {
      // Create new agent with different user
      const otherAgent = request.agent(app);
      await otherAgent
        .post('/api/v1/dev/mock-token')
        .send({
          sub: 'other-user-789',
          email: 'other@example.com',
          email_verified: true,
          isAdmin: false,
        });

      // Try to mark the first user's alert as read
      if (mockAlertId) {
        const response = await otherAgent
          .put(`/api/v1/price-alerts/${mockAlertId}/read`)
          .expect(404); // Should return NOT_FOUND since user doesn't own this alert

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
      }
    });

    it('should be idempotent - marking already read alert should succeed', async () => {
      if (!mockAlertId) {
        console.log('No mock alert ID available, skipping test');
        return;
      }

      // Mark as read first time
      await agent
        .put(`/api/v1/price-alerts/${mockAlertId}/read`)
        .expect(200);

      // Mark as read second time - should still succeed
      const response = await agent
        .put(`/api/v1/price-alerts/${mockAlertId}/read`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert marked as read');
    });
  });

  describe('Price Alert Integration Scenarios', () => {
    it('should handle concurrent read requests gracefully', async () => {
      // Get unread alerts
      const unreadResponse = await agent
        .get('/api/v1/price-alerts?unread=true')
        .expect(200);

      if (unreadResponse.body.data.length > 0) {
        const alertId = unreadResponse.body.data[0].id;

        // Send multiple concurrent requests to mark as read
        const promises = Array(3).fill(null).map(() => 
          agent.put(`/api/v1/price-alerts/${alertId}/read`)
        );

        const results = await Promise.all(promises);
        
        // All requests should succeed
        results.forEach(result => {
          expect(result.status).toBe(200);
          expect(result.body.success).toBe(true);
        });
      }
    });

    it('should reflect price alert changes immediately', async () => {
      // Get initial unread count
      const initialResponse = await agent
        .get('/api/v1/price-alerts?unread=true')
        .expect(200);

      const initialUnreadCount = initialResponse.body.data.length;

      if (initialUnreadCount > 0) {
        // Mark first alert as read
        const alertToMark = initialResponse.body.data[0];
        await agent
          .put(`/api/v1/price-alerts/${alertToMark.id}/read`)
          .expect(200);

        // Check unread count decreased
        const updatedResponse = await agent
          .get('/api/v1/price-alerts?unread=true')
          .expect(200);

        expect(updatedResponse.body.data.length).toBe(initialUnreadCount - 1);
        
        // Verify the marked alert is not in unread list
        const markedAlertInUnread = updatedResponse.body.data.find(
          (a: any) => a.id === alertToMark.id
        );
        expect(markedAlertInUnread).toBeUndefined();
      }
    });
  });
});