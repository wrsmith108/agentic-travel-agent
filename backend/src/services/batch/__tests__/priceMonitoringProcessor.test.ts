import { PriceMonitoringProcessor } from '../priceMonitoringProcessor';
import { flightSearchService } from '../../flights/flightSearchService';
import { emailService } from '../../notifications/emailService';
import { getRedisClient } from '../../redis/redisClient';
import { metricsService } from '../../monitoring/metricsService';
import { errorTracker } from '../../monitoring/errorTracker';
import { SavedSearch, PriceAlert } from '../../../schemas/flight';
import { isOk, isErr } from '../../../utils/result';

// Mock dependencies
jest.mock('../../flights/flightSearchService');
jest.mock('../../notifications/emailService');
jest.mock('../../redis/redisClient');
jest.mock('../../monitoring/metricsService');
jest.mock('../../monitoring/errorTracker');
jest.mock('../../../config/env', () => ({
  env: {
    FEATURE_EMAIL_NOTIFICATIONS: true,
    PRICE_MONITOR_BATCH_SIZE: 2,
    PRICE_MONITOR_MAX_CONCURRENT: 2,
    PRICE_MONITOR_COOLDOWN_HOURS: 24,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  }
}));

// Setup fake timers
jest.useFakeTimers();

describe('PriceMonitoringProcessor', () => {
  let processor: PriceMonitoringProcessor;
  let mockRedisClient: any;

  const mockSavedSearch: SavedSearch = {
    id: 'search123',
    userId: 'user123',
    name: 'NYC to LAX Christmas',
    searchQuery: {
      originLocationCode: 'NYC',
      destinationLocationCode: 'LAX',
      departureDate: '2024-12-25',
      adults: 1,
      children: 0,
      infants: 0,
      max: 20,
    },
    priceAlerts: {
      enabled: true,
      targetPrice: 500,
      percentDrop: 10,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };

  const mockPriceAlert: PriceAlert = {
    id: 'alert123',
    userId: 'user123',
    savedSearchId: 'search123',
    triggerType: 'PRICE_DROP',
    flightOffer: {
      id: 'offer123',
      source: 'GDS',
      instantTicketingRequired: false,
      nonHomogeneous: false,
      oneWay: false,
      lastTicketingDate: '2024-12-20',
      numberOfBookableSeats: 4,
      itineraries: [{
        duration: 'PT5H30M',
        segments: [{
          id: 'seg1',
          departure: { iataCode: 'JFK', at: '2024-12-25T10:00:00' },
          arrival: { iataCode: 'LAX', at: '2024-12-25T13:30:00' },
          carrierCode: 'AA',
          number: '100',
          duration: 'PT5H30M',
          numberOfStops: 0,
        }],
      }],
      price: {
        currency: 'USD',
        total: '450.00',
        base: '400.00',
        grandTotal: '450.00',
      },
      pricingOptions: {
        fareType: ['PUBLISHED'],
        includedCheckedBagsOnly: true,
      },
      validatingAirlineCodes: ['AA'],
      travelerPricings: [{
        travelerId: '1',
        fareOption: 'STANDARD',
        travelerType: 'ADULT',
        price: {
          currency: 'USD',
          total: '450.00',
          base: '400.00',
          grandTotal: '450.00',
        },
        fareDetailsBySegment: [{
          segmentId: 'seg1',
          cabin: 'ECONOMY',
          fareBasis: 'YRTOW',
          class: 'Y',
          includedCheckedBags: { quantity: 1 },
        }],
      }],
    },
    previousPrice: 500,
    currentPrice: 450,
    priceDifference: -50,
    percentChange: -10,
    alertedAt: new Date().toISOString(),
    isRead: false,
    expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn().mockResolvedValue({ success: true, data: null }),
      set: jest.fn().mockResolvedValue({ success: true }),
      del: jest.fn().mockResolvedValue({ success: true }),
      keys: jest.fn().mockResolvedValue({ success: true, data: [] }),
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    // Mock metrics service
    (metricsService.incrementCounter as jest.Mock).mockReturnValue(undefined);
    (metricsService.recordHistogram as jest.Mock).mockReturnValue(undefined);

    // Mock error tracker
    (errorTracker.captureError as jest.Mock).mockReturnValue(undefined);

    processor = new PriceMonitoringProcessor({
      batchSize: 2,
      maxConcurrent: 2,
      alertCooldown: 24,
    });
  });

  afterEach(() => {
    processor.stop();
  });

  describe('Batch Processing', () => {
    it('should process users with active saved searches', async () => {
      // Mock getting active users
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123', 'saved-searches:user456'],
      });

      // Mock getting saved searches
      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      // Mock price check results
      (flightSearchService.checkSavedSearchPrices as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          savedSearchId: 'search123',
          currentBestPrice: 450,
          previousBestPrice: 500,
          alert: mockPriceAlert,
        }],
      });

      // Mock email service
      (emailService.sendEmail as jest.Mock).mockResolvedValue({
        success: true,
        data: { messageId: 'msg123', accepted: ['user@example.com'], rejected: [] },
      });

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(2);
        expect(result.data.alertsGenerated).toBe(2);
        expect(result.data.errors).toHaveLength(0);
      }

      expect(flightSearchService.getSavedSearches).toHaveBeenCalledTimes(2);
      expect(flightSearchService.checkSavedSearchPrices).toHaveBeenCalledTimes(2);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during processing', async () => {
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockRejectedValue(
        new Error('Service error')
      );

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(0);
        expect(result.data.alertsGenerated).toBe(0);
        expect(result.data.errors).toHaveLength(1);
        expect(result.data.errors[0]).toContain('Service error');
      }
    });

    it('should respect batch size configuration', async () => {
      // Create 5 users
      const userIds = Array.from({ length: 5 }, (_, i) => `saved-searches:user${i}`);
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: userIds,
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      await processor.runBatch();

      // With batch size 2, should process in 3 batches
      // But we process all users, so getSavedSearches should be called 5 times
      expect(flightSearchService.getSavedSearches).toHaveBeenCalledTimes(5);
    });

    it('should skip processing if already running', async () => {
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      // Start first batch
      const promise1 = processor.runBatch();
      
      // Try to start second batch immediately
      const result2 = await processor.runBatch();

      expect(isErr(result2)).toBe(true);
      if (isErr(result2)) {
        expect(result2.error.code).toBe(409);
        expect(result2.error.message).toContain('already in progress');
      }

      await promise1; // Clean up
    });
  });

  describe('Search Processing', () => {
    it('should respect cooldown period', async () => {
      // Set last check time to 1 hour ago
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key === `last-price-check:${mockSavedSearch.id}`) {
          return { success: true, data: oneHourAgo };
        }
        return { success: true, data: null };
      });

      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      const result = await processor.runBatch();

      // Should not process because cooldown is 24 hours
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(0);
      }
      expect(flightSearchService.checkSavedSearchPrices).not.toHaveBeenCalled();
    });

    it('should process searches after cooldown expires', async () => {
      // Set last check time to 25 hours ago
      const oldCheckTime = new Date(Date.now() - 25 * 3600000).toISOString();
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key === `last-price-check:${mockSavedSearch.id}`) {
          return { success: true, data: oldCheckTime };
        }
        return { success: true, data: null };
      });

      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      (flightSearchService.checkSavedSearchPrices as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(1);
      }
      expect(flightSearchService.checkSavedSearchPrices).toHaveBeenCalled();
    });

    it('should skip inactive searches', async () => {
      const inactiveSearch = { ...mockSavedSearch, isActive: false };

      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [inactiveSearch],
      });

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(0);
      }
      expect(flightSearchService.checkSavedSearchPrices).not.toHaveBeenCalled();
    });

    it('should skip searches with disabled alerts', async () => {
      const noAlertsSearch = {
        ...mockSavedSearch,
        priceAlerts: { enabled: false },
      };

      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [noAlertsSearch],
      });

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(0);
      }
      expect(flightSearchService.checkSavedSearchPrices).not.toHaveBeenCalled();
    });

    it('should skip expired searches', async () => {
      const expiredSearch = {
        ...mockSavedSearch,
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [expiredSearch],
      });

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(0);
      }
      expect(flightSearchService.checkSavedSearchPrices).not.toHaveBeenCalled();
    });
  });

  describe('Alert Notifications', () => {
    it('should send email for price alerts', async () => {
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      (flightSearchService.checkSavedSearchPrices as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          savedSearchId: 'search123',
          currentBestPrice: 450,
          previousBestPrice: 500,
          alert: mockPriceAlert,
        }],
      });

      (emailService.sendEmail as jest.Mock).mockResolvedValue({
        success: true,
        data: { messageId: 'msg123', accepted: ['user@example.com'], rejected: [] },
      });

      const result = await processor.runBatch();

      expect(isOk(result)).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining('user+user123@example.com'),
          subject: expect.stringContaining('Price Alert'),
          html: expect.stringContaining('dropped by 10.0%'),
          priority: 'high',
        })
      );
    });

    it('should handle email sending failures gracefully', async () => {
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      (flightSearchService.checkSavedSearchPrices as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          savedSearchId: 'search123',
          currentBestPrice: 450,
          previousBestPrice: 500,
          alert: mockPriceAlert,
        }],
      });

      (emailService.sendEmail as jest.Mock).mockRejectedValue(
        new Error('Email service error')
      );

      const result = await processor.runBatch();

      // Should still complete successfully
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(1);
        expect(result.data.alertsGenerated).toBe(1);
      }
    });

    it('should not send emails when feature flag is disabled', async () => {
      // Mock env to disable email notifications
      jest.resetModules();
      jest.doMock('../../../config/env', () => ({
        env: {
          FEATURE_EMAIL_NOTIFICATIONS: false,
          PRICE_MONITOR_BATCH_SIZE: 2,
          PRICE_MONITOR_MAX_CONCURRENT: 2,
          PRICE_MONITOR_COOLDOWN_HOURS: 24,
        }
      }));

      // Re-import to get fresh instance with new env
      const { PriceMonitoringProcessor: FreshProcessor } = await import('../priceMonitoringProcessor');
      const freshProcessor = new FreshProcessor();

      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      (flightSearchService.checkSavedSearchPrices as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          savedSearchId: 'search123',
          currentBestPrice: 450,
          previousBestPrice: 500,
          alert: mockPriceAlert,
        }],
      });

      await freshProcessor.runBatch();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Cron Scheduling', () => {
    it('should start and stop cron job', () => {
      processor.start('* * * * *'); // Every minute
      
      expect(processor.getStatus().isRunning).toBe(true);
      expect(processor.getStatus().nextRun).toBeDefined();

      processor.stop();
      
      expect(processor.getStatus().isRunning).toBe(false);
      expect(processor.getStatus().nextRun).toBeUndefined();
    });

    it('should run batch on schedule', async () => {
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: [],
      });

      const runBatchSpy = jest.spyOn(processor, 'runBatch');
      
      processor.start('* * * * *');
      
      // Fast forward time to trigger cron
      jest.advanceTimersByTime(60000); // 1 minute
      
      // Wait for async operations
      await Promise.resolve();
      
      expect(runBatchSpy).toHaveBeenCalled();
      
      processor.stop();
    });

    it('should not start multiple cron jobs', () => {
      processor.start();
      const firstStatus = processor.getStatus();
      
      processor.start(); // Try to start again
      const secondStatus = processor.getStatus();
      
      expect(firstStatus.nextRun).toEqual(secondStatus.nextRun);
      
      processor.stop();
    });
  });

  describe('Manual Processing', () => {
    it('should allow manual batch processing', async () => {
      mockRedisClient.keys.mockResolvedValue({
        success: true,
        data: ['saved-searches:user123'],
      });

      (flightSearchService.getSavedSearches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockSavedSearch],
      });

      (flightSearchService.checkSavedSearchPrices as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await processor.processNow();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.processedCount).toBe(1);
      }
    });
  });

  describe('Status Reporting', () => {
    it('should report processor status', () => {
      const status = processor.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isProcessing: false,
        nextRun: undefined,
        config: {
          batchSize: 2,
          maxConcurrent: 2,
          retryAttempts: 3,
          retryDelay: 5000,
          alertCooldown: 24,
        },
      });
    });

    it('should report running status', () => {
      processor.start();
      const status = processor.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.nextRun).toBeDefined();

      processor.stop();
    });
  });
});