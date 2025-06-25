import { CostTrackingService } from '../costTrackingService';
import { UserDataManager } from '@/services/storage/userDataManager';
import { DEFAULT_TIER_LIMITS } from '@/schemas/costControl';

// Mock dependencies
jest.mock('@/services/storage/userDataManager');
const mockUserDataManager = jest.mocked(UserDataManager);

describe('CostTrackingService', () => {
  let costTrackingService: CostTrackingService;
  let mockInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementation
    mockInstance = {
      readUserData: jest.fn(),
      updateUserData: jest.fn(),
    };

    mockUserDataManager.mockImplementation(() => mockInstance as any);

    // Create service instance
    costTrackingService = new CostTrackingService();
  });

  describe('trackTokenUsage', () => {
    it('should track token usage and calculate cost correctly', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const modelId = 'claude-3-opus-20240229';
      const inputTokens = 1000;
      const outputTokens = 2000;
      const endpoint = '/api/v1/chat';

      // Mock user data
      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'free' },
        costTracking: {
          quota: {
            userId,
            tier: 'free',
            limits: DEFAULT_TIER_LIMITS.free,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 0,
              monthlyTokensUsed: 0,
              dailyCostUsed: 0,
              monthlyCostUsed: 0,
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      const result = await costTrackingService.trackTokenUsage(
        userId,
        modelId,
        inputTokens,
        outputTokens,
        endpoint
      );

      expect(result).toMatchObject({
        userId,
        service: 'anthropic',
        endpoint,
        method: 'POST',
        tokenUsage: {
          inputTokens,
          outputTokens,
          totalTokens: 3000,
          modelId,
          estimatedCost: expect.any(Number),
        },
      });

      // Verify cost calculation:
      // Input: 1000 tokens = 0.001M * $15 = $0.015
      // Output: 2000 tokens = 0.002M * $75 = $0.150
      // Total: $0.165
      expect(result.tokenUsage?.estimatedCost).toBeCloseTo(0.165, 4);
    });

    it('should update user quota after tracking', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const inputTokens = 500;
      const outputTokens = 1000;

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'free' },
        costTracking: {
          quota: {
            userId,
            tier: 'free',
            limits: DEFAULT_TIER_LIMITS.free,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 1000,
              monthlyTokensUsed: 50000,
              dailyCostUsed: 0.1,
              monthlyCostUsed: 2.5,
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      await costTrackingService.trackTokenUsage(
        userId,
        'claude-3-opus-20240229',
        inputTokens,
        outputTokens,
        '/api/v1/chat'
      );

      // Verify quota was updated (called twice - once for quota, once for api call)
      expect(mockInstance.updateUserData).toHaveBeenCalledTimes(2);

      // Check the quota update call
      const quotaUpdateCall = mockInstance.updateUserData.mock.calls.find(
        (call) => call[1]?.costTracking?.quota
      );

      expect(quotaUpdateCall).toBeDefined();
      expect(quotaUpdateCall[1].costTracking.quota.usage.dailyTokensUsed).toBe(2500);
      expect(quotaUpdateCall[1].costTracking.quota.usage.monthlyTokensUsed).toBe(51500);
    });
  });

  describe('checkQuota', () => {
    it('should allow request when under quota', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'basic' },
        costTracking: {
          quota: {
            userId,
            tier: 'basic',
            limits: DEFAULT_TIER_LIMITS.basic,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 10000,
              monthlyTokensUsed: 100000,
              dailyCostUsed: 1.0,
              monthlyCostUsed: 10.0,
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      const result = await costTrackingService.checkQuota(userId, 1000);

      expect(result).toEqual({
        allowed: true,
      });
    });

    it('should deny request when daily token limit exceeded', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'free' },
        costTracking: {
          quota: {
            userId,
            tier: 'free',
            limits: DEFAULT_TIER_LIMITS.free,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 9500, // Close to 10K limit
              monthlyTokensUsed: 50000,
              dailyCostUsed: 0.4,
              monthlyCostUsed: 2.0,
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      const result = await costTrackingService.checkQuota(userId, 1000);

      expect(result).toEqual({
        allowed: false,
        reason: 'Daily token limit exceeded',
        fallbackModel: 'claude-3-haiku-20240307',
      });
    });

    it('should suggest fallback model when approaching cost limit', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'free' },
        costTracking: {
          quota: {
            userId,
            tier: 'free',
            limits: DEFAULT_TIER_LIMITS.free,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 5000,
              monthlyTokensUsed: 80000,
              dailyCostUsed: 0.45, // 90% of daily $0.50 limit
              monthlyCostUsed: 4.0,
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      const result = await costTrackingService.checkQuota(userId, 100);

      expect(result).toEqual({
        allowed: false,
        reason: 'Daily cost limit exceeded',
        fallbackModel: 'claude-3-haiku-20240307',
      });
    });
  });

  describe('getRecommendedModel', () => {
    it('should recommend cheapest model when budget is low', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'free' },
        costTracking: {
          quota: {
            userId,
            tier: 'free',
            limits: DEFAULT_TIER_LIMITS.free,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 8000,
              monthlyTokensUsed: 90000,
              dailyCostUsed: 0.42, // 84% of daily limit
              monthlyCostUsed: 4.5,
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      const model = await costTrackingService.getRecommendedModel(userId);
      expect(model).toBe('claude-3-haiku-20240307');
    });

    it('should recommend best model when budget is sufficient', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        preferences: { subscriptionTier: 'premium' },
        costTracking: {
          quota: {
            userId,
            tier: 'premium',
            limits: DEFAULT_TIER_LIMITS.premium,
            usage: {
              currentDay: new Date().toISOString().split('T')[0],
              currentMonth: new Date().toISOString().slice(0, 7),
              dailyTokensUsed: 10000,
              monthlyTokensUsed: 100000,
              dailyCostUsed: 2.0, // 10% of $20 daily limit
              monthlyCostUsed: 20.0, // 10% of $200 monthly limit
            },
            alerts: {
              notifyAt80Percent: true,
              notifyAt100Percent: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      const model = await costTrackingService.getRecommendedModel(userId);
      expect(model).toBe('claude-3-opus-20240229');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on text length', () => {
      const text = 'Hello, this is a test message.';
      const estimated = costTrackingService.estimateTokens(text);

      // 30 characters / 4 = 7.5, rounded up to 8
      expect(estimated).toBe(8);
    });

    it('should handle empty text', () => {
      const estimated = costTrackingService.estimateTokens('');
      expect(estimated).toBe(0);
    });
  });

  describe('getUserCostBreakdown', () => {
    it('should calculate cost breakdown correctly', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockInstance.readUserData.mockResolvedValue({
        id: userId,
        costTracking: {
          apiCalls: [
            {
              id: '1',
              userId,
              service: 'anthropic',
              endpoint: '/chat',
              method: 'POST',
              tokenUsage: {
                inputTokens: 100,
                outputTokens: 200,
                totalTokens: 300,
                modelId: 'claude-3-opus-20240229',
                estimatedCost: 0.02,
                timestamp: '2025-01-01T10:00:00Z',
              },
              cost: 0.02,
              timestamp: '2025-01-01T10:00:00Z',
              duration: 1000,
              statusCode: 200,
            },
            {
              id: '2',
              userId,
              service: 'anthropic',
              endpoint: '/chat',
              method: 'POST',
              tokenUsage: {
                inputTokens: 200,
                outputTokens: 300,
                totalTokens: 500,
                modelId: 'claude-3-haiku-20240307',
                estimatedCost: 0.001,
                timestamp: '2025-01-01T11:00:00Z',
              },
              cost: 0.001,
              timestamp: '2025-01-01T11:00:00Z',
              duration: 500,
              statusCode: 200,
            },
          ],
        },
      });

      const breakdown = await costTrackingService.getUserCostBreakdown(userId);

      expect(breakdown).toEqual({
        totalCost: 0.021,
        tokenUsage: {
          input: 300,
          output: 500,
          total: 800,
        },
        byModel: {
          'claude-3-opus-20240229': { cost: 0.02, tokens: 300 },
          'claude-3-haiku-20240307': { cost: 0.001, tokens: 500 },
        },
        byDay: {
          '2025-01-01': 0.021,
        },
      });
    });
  });
});
