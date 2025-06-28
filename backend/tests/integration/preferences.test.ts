/**
 * User Preferences Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';

describe('User Preferences Endpoints', () => {
  let agent: request.SuperAgentTest;
  const testUser = {
    email: 'preftest@example.com',
    password: 'PrefTest123!',
    firstName: 'Pref',
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

  describe('GET /api/v1/preferences', () => {
    it('should return default preferences for new user', async () => {
      const response = await agent
        .get('/api/v1/preferences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      
      const prefs = response.body.data;
      expect(prefs.userId).toBeDefined();
      
      // Check default notification preferences
      expect(prefs.notifications.emailEnabled).toBe(true);
      expect(prefs.notifications.frequency).toBe('INSTANT');
      expect(prefs.notifications.priceAlerts.enabled).toBe(true);
      expect(prefs.notifications.priceAlerts.thresholdType).toBe('PERCENTAGE');
      expect(prefs.notifications.priceAlerts.thresholdValue).toBe(10);
      
      // Check default search preferences
      expect(prefs.search.defaultCabinClass).toBe('ECONOMY');
      expect(prefs.search.maxStops).toBe(1);
      expect(prefs.search.includeBudgetAirlines).toBe(true);
      
      // Check default display preferences
      expect(prefs.display.currency).toBe('USD');
      expect(prefs.display.dateFormat).toBe('MM/DD/YYYY');
      expect(prefs.display.timeFormat).toBe('12h');
      expect(prefs.display.theme).toBe('auto');
    });
  });

  describe('PATCH /api/v1/preferences', () => {
    it('should update notification preferences', async () => {
      const updates = {
        notifications: {
          frequency: 'DAILY',
          priceAlerts: {
            thresholdValue: 15
          }
        }
      };

      const response = await agent
        .patch('/api/v1/preferences')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications.frequency).toBe('DAILY');
      expect(response.body.data.notifications.priceAlerts.thresholdValue).toBe(15);
      // Other values should remain unchanged
      expect(response.body.data.notifications.emailEnabled).toBe(true);
    });

    it('should update search preferences', async () => {
      const updates = {
        search: {
          defaultCabinClass: 'BUSINESS',
          preferredAirlines: ['AA', 'DL'],
          maxStops: 0
        }
      };

      const response = await agent
        .patch('/api/v1/preferences')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.search.defaultCabinClass).toBe('BUSINESS');
      expect(response.body.data.search.preferredAirlines).toEqual(['AA', 'DL']);
      expect(response.body.data.search.maxStops).toBe(0);
    });

    it('should update display preferences', async () => {
      const updates = {
        display: {
          currency: 'EUR',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          theme: 'dark'
        }
      };

      const response = await agent
        .patch('/api/v1/preferences')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.display.currency).toBe('EUR');
      expect(response.body.data.display.dateFormat).toBe('DD/MM/YYYY');
      expect(response.body.data.display.timeFormat).toBe('24h');
      expect(response.body.data.display.theme).toBe('dark');
    });

    it('should update multiple sections at once', async () => {
      const updates = {
        notifications: {
          frequency: 'WEEKLY'
        },
        search: {
          includeBudgetAirlines: false
        },
        display: {
          language: 'es'
        }
      };

      const response = await agent
        .patch('/api/v1/preferences')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications.frequency).toBe('WEEKLY');
      expect(response.body.data.search.includeBudgetAirlines).toBe(false);
      expect(response.body.data.display.language).toBe('es');
    });

    it('should fail with invalid preference values', async () => {
      const updates = {
        notifications: {
          frequency: 'INVALID_FREQUENCY'
        }
      };

      const response = await agent
        .patch('/api/v1/preferences')
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/preferences/:section', () => {
    it('should get only notification preferences', async () => {
      const response = await agent
        .get('/api/v1/preferences/notifications')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emailEnabled).toBeDefined();
      expect(response.body.data.frequency).toBeDefined();
      expect(response.body.data.priceAlerts).toBeDefined();
      // Should not include search or display
      expect(response.body.data.search).toBeUndefined();
      expect(response.body.data.display).toBeUndefined();
    });

    it('should get only search preferences', async () => {
      const response = await agent
        .get('/api/v1/preferences/search')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.defaultCabinClass).toBeDefined();
      expect(response.body.data.preferredAirlines).toBeDefined();
      expect(response.body.data.maxStops).toBeDefined();
    });

    it('should get only display preferences', async () => {
      const response = await agent
        .get('/api/v1/preferences/display')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currency).toBeDefined();
      expect(response.body.data.dateFormat).toBeDefined();
      expect(response.body.data.theme).toBeDefined();
    });

    it('should fail with invalid section', async () => {
      const response = await agent
        .get('/api/v1/preferences/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SECTION');
    });
  });

  describe('POST /api/v1/preferences/reset', () => {
    it('should reset preferences to defaults', async () => {
      // First change some preferences
      await agent.patch('/api/v1/preferences').send({
        notifications: { frequency: 'NEVER' },
        search: { defaultCabinClass: 'FIRST' },
        display: { theme: 'dark' }
      });

      // Then reset
      const response = await agent
        .post('/api/v1/preferences/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Preferences have been reset to defaults');
      
      // Verify defaults are restored
      const prefs = response.body.data;
      expect(prefs.notifications.frequency).toBe('INSTANT');
      expect(prefs.search.defaultCabinClass).toBe('ECONOMY');
      expect(prefs.display.theme).toBe('auto');
    });
  });
});