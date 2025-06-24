import { v4 as uuidv4 } from 'uuid';
import { 
  UserQuota, 
  APICallRecord, 
  TokenUsage, 
  CostAlert,
  DEFAULT_TIER_LIMITS,
  DEFAULT_MODEL_PRICING,
  validateUserQuota,
  validateAPICallRecord,
} from '@/schemas/costControl';
import { UserDataManager } from '@/services/storage/userDataManager';
import { logInfo, logWarn, logError } from '@/utils/logger';

/**
 * Cost tracking service for monitoring and controlling API usage
 * Implements 2025 best practices for LLM cost management
 */
export class CostTrackingService {
  private userDataManager: UserDataManager;
  private quotaCache: Map<string, UserQuota> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private lastCacheClean = Date.now();

  constructor(userDataManager?: UserDataManager) {
    this.userDataManager = userDataManager || new UserDataManager();
    this.startPeriodicCleanup();
  }

  /**
   * Track token usage for a request
   */
  async trackTokenUsage(
    userId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    endpoint: string
  ): Promise<APICallRecord> {
    const timestamp = new Date().toISOString();
    const totalTokens = inputTokens + outputTokens;
    
    // Calculate cost
    const pricing = DEFAULT_MODEL_PRICING[modelId] ?? DEFAULT_MODEL_PRICING['claude-3-opus-20240229'];
    const inputCost = (inputTokens / 1_000_000) * pricing.inputTokenCost;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputTokenCost;
    const estimatedCost = inputCost + outputCost;

    // Create token usage record
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      modelId,
      estimatedCost,
      timestamp,
    };

    // Create API call record
    const apiCall: APICallRecord = {
      id: uuidv4(),
      userId,
      service: 'anthropic',
      endpoint,
      method: 'POST',
      tokenUsage,
      cost: estimatedCost,
      timestamp,
      duration: 0, // Will be updated by middleware
      statusCode: 200,
    };

    // Update user quota
    await this.updateUserQuota(userId, totalTokens, estimatedCost);

    // Store API call record
    await this.storeAPICallRecord(apiCall);

    logInfo('Token usage tracked', {
      userId,
      modelId,
      totalTokens,
      estimatedCost: estimatedCost.toFixed(4),
    });

    return apiCall;
  }

  /**
   * Check if user has quota available before making request
   */
  async checkQuota(
    userId: string,
    estimatedTokens: number = 1000
  ): Promise<{ allowed: boolean; reason?: string; fallbackModel?: string }> {
    const quota = await this.getUserQuota(userId);
    
    // Estimate cost for quota check (using default model)
    const pricing = DEFAULT_MODEL_PRICING['claude-3-opus-20240229']!;
    const estimatedCost = (estimatedTokens / 1_000_000) * pricing.outputTokenCost;

    // Check daily limits
    if (quota.usage.dailyTokensUsed + estimatedTokens > quota.limits.dailyTokens) {
      logWarn('Daily token limit exceeded', { userId, limit: quota.limits.dailyTokens });
      return {
        allowed: false,
        reason: 'Daily token limit exceeded',
        fallbackModel: 'claude-3-haiku-20240307', // Suggest cheaper model
      };
    }

    if (quota.usage.dailyCostUsed + estimatedCost > quota.limits.dailyCost) {
      logWarn('Daily cost limit exceeded', { userId, limit: quota.limits.dailyCost });
      return {
        allowed: false,
        reason: 'Daily cost limit exceeded',
        fallbackModel: 'claude-3-haiku-20240307',
      };
    }

    // Check monthly limits
    if (quota.usage.monthlyTokensUsed + estimatedTokens > quota.limits.monthlyTokens) {
      logWarn('Monthly token limit exceeded', { userId, limit: quota.limits.monthlyTokens });
      return {
        allowed: false,
        reason: 'Monthly token limit exceeded',
      };
    }

    if (quota.usage.monthlyCostUsed + estimatedCost > quota.limits.monthlyCost) {
      logWarn('Monthly cost limit exceeded', { userId, limit: quota.limits.monthlyCost });
      return {
        allowed: false,
        reason: 'Monthly cost limit exceeded',
      };
    }

    // Check if approaching limits (80% threshold)
    const dailyTokenPercent = (quota.usage.dailyTokensUsed / quota.limits.dailyTokens) * 100;
    const monthlyCostPercent = (quota.usage.monthlyCostUsed / quota.limits.monthlyCost) * 100;

    if (dailyTokenPercent > 80 && quota.alerts.notifyAt80Percent) {
      await this.sendCostAlert(userId, 'daily_limit_80', quota.limits.dailyTokens, quota.usage.dailyTokensUsed);
    }

    if (monthlyCostPercent > 80 && quota.alerts.notifyAt80Percent) {
      await this.sendCostAlert(userId, 'monthly_limit_80', quota.limits.monthlyCost, quota.usage.monthlyCostUsed);
    }

    return { allowed: true };
  }

  /**
   * Get or create user quota
   */
  async getUserQuota(userId: string): Promise<UserQuota> {
    // Check cache first
    const cached = this.quotaCache.get(userId);
    if (cached && Date.now() - this.lastCacheClean < this.CACHE_TTL) {
      return cached;
    }

    // Load from storage
    const userData = await this.userDataManager.readUserData(userId);
    if (!userData) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get stored quota or create default
    const storedQuota = await this.loadUserQuota(userId);
    if (storedQuota) {
      // Reset daily usage if new day
      const today = new Date().toISOString().split('T')[0];
      if (storedQuota.usage.currentDay !== today) {
        storedQuota.usage.currentDay = today;
        storedQuota.usage.dailyTokensUsed = 0;
        storedQuota.usage.dailyCostUsed = 0;
      }

      // Reset monthly usage if new month
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (storedQuota.usage.currentMonth !== currentMonth) {
        storedQuota.usage.currentMonth = currentMonth;
        storedQuota.usage.monthlyTokensUsed = 0;
        storedQuota.usage.monthlyCostUsed = 0;
      }

      this.quotaCache.set(userId, storedQuota);
      return storedQuota;
    }

    // Create default quota for new user
    const tier = userData.preferences?.subscriptionTier ?? 'free';
    const limits = DEFAULT_TIER_LIMITS[tier] ?? DEFAULT_TIER_LIMITS.free;
    
    const newQuota: UserQuota = {
      userId,
      tier,
      limits,
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
    };

    await this.saveUserQuota(newQuota);
    this.quotaCache.set(userId, newQuota);
    return newQuota;
  }

  /**
   * Update user quota after API usage
   */
  private async updateUserQuota(
    userId: string,
    tokensUsed: number,
    costIncurred: number
  ): Promise<void> {
    const quota = await this.getUserQuota(userId);
    
    // Update usage
    quota.usage.dailyTokensUsed += tokensUsed;
    quota.usage.monthlyTokensUsed += tokensUsed;
    quota.usage.dailyCostUsed += costIncurred;
    quota.usage.monthlyCostUsed += costIncurred;
    quota.updatedAt = new Date().toISOString();

    // Check if limits exceeded
    if (quota.usage.dailyTokensUsed >= quota.limits.dailyTokens && quota.alerts.notifyAt100Percent) {
      await this.sendCostAlert(userId, 'daily_limit_100', quota.limits.dailyTokens, quota.usage.dailyTokensUsed);
    }

    if (quota.usage.monthlyCostUsed >= quota.limits.monthlyCost && quota.alerts.notifyAt100Percent) {
      await this.sendCostAlert(userId, 'monthly_limit_100', quota.limits.monthlyCost, quota.usage.monthlyCostUsed);
    }

    // Save updated quota
    await this.saveUserQuota(quota);
    this.quotaCache.set(userId, quota);
  }

  /**
   * Get cost breakdown for user
   */
  async getUserCostBreakdown(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalCost: number;
    tokenUsage: { input: number; output: number; total: number };
    byModel: Record<string, { cost: number; tokens: number }>;
    byDay: Record<string, number>;
  }> {
    const records = await this.getUserAPICallRecords(userId, startDate, endDate);
    
    const breakdown = {
      totalCost: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      byModel: {} as Record<string, { cost: number; tokens: number }>,
      byDay: {} as Record<string, number>,
    };

    for (const record of records) {
      if (record.tokenUsage) {
        breakdown.totalCost += record.cost;
        breakdown.tokenUsage.input += record.tokenUsage.inputTokens;
        breakdown.tokenUsage.output += record.tokenUsage.outputTokens;
        breakdown.tokenUsage.total += record.tokenUsage.totalTokens;

        // By model breakdown
        const modelId = record.tokenUsage.modelId;
        if (!breakdown.byModel[modelId]) {
          breakdown.byModel[modelId] = { cost: 0, tokens: 0 };
        }
        breakdown.byModel[modelId].cost += record.cost;
        breakdown.byModel[modelId].tokens += record.tokenUsage.totalTokens;

        // By day breakdown
        const day = record.timestamp.split('T')[0];
        breakdown.byDay[day] = (breakdown.byDay[day] || 0) + record.cost;
      }
    }

    return breakdown;
  }

  /**
   * Estimate tokens for text (rough approximation)
   * More accurate counting requires tiktoken or similar
   */
  estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    // This is a simplified version - in production, use proper tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * Get recommended model based on user's remaining quota
   */
  async getRecommendedModel(userId: string): Promise<string> {
    const quota = await this.getUserQuota(userId);
    const remainingDailyCost = quota.limits.dailyCost - quota.usage.dailyCostUsed;
    const remainingMonthlyCost = quota.limits.monthlyCost - quota.usage.monthlyCostUsed;

    // If less than 20% of daily budget remains, use cheapest model
    if (remainingDailyCost < quota.limits.dailyCost * 0.2) {
      return 'claude-3-haiku-20240307';
    }

    // If less than 50% of monthly budget remains, use mid-tier model
    if (remainingMonthlyCost < quota.limits.monthlyCost * 0.5) {
      return 'claude-3-sonnet-20240229';
    }

    // Otherwise use the best model
    return 'claude-3-opus-20240229';
  }

  // Private helper methods

  private async loadUserQuota(userId: string): Promise<UserQuota | null> {
    try {
      // In production, this would load from database
      // For MVP, we store in user data file
      const userData = await this.userDataManager.readUserData(userId);
      const userDataWithCost = userData as any;
      if (userDataWithCost?.costTracking?.quota) {
        return validateUserQuota(userDataWithCost.costTracking.quota);
      }
      return null;
    } catch (error) {
      logError('Failed to load user quota', error, { userId });
      return null;
    }
  }

  private async saveUserQuota(quota: UserQuota): Promise<void> {
    try {
      // In production, this would save to database
      // For MVP, we update user data file
      await this.userDataManager.updateUserData(quota.userId, {
        costTracking: {
          quota: quota as any,
          lastUpdated: quota.updatedAt,
        },
      } as any);
    } catch (error) {
      logError('Failed to save user quota', error, { userId: quota.userId });
    }
  }

  private async storeAPICallRecord(record: APICallRecord): Promise<void> {
    try {
      // In production, this would go to time-series database
      // For MVP, we append to a log file
      const validated = validateAPICallRecord(record);
      
      // Store in user's API call history
      const userData = await this.userDataManager.readUserData(record.userId);
      if (userData) {
        const userDataWithCost = userData as any;
        const apiCalls = userDataWithCost.costTracking?.apiCalls || [];
        apiCalls.push(validated as any);
        
        // Keep only last 1000 calls per user
        if (apiCalls.length > 1000) {
          apiCalls.splice(0, apiCalls.length - 1000);
        }

        await this.userDataManager.updateUserData(record.userId, {
          costTracking: {
            ...userDataWithCost.costTracking,
            apiCalls,
          },
        } as any);
      }
    } catch (error) {
      logError('Failed to store API call record', error, { recordId: record.id });
    }
  }

  private async getUserAPICallRecords(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<APICallRecord[]> {
    try {
      const userData = await this.userDataManager.readUserData(userId);
      const userDataWithCost = userData as any;
      if (!userDataWithCost?.costTracking?.apiCalls) {
        return [];
      }

      let records = userDataWithCost.costTracking.apiCalls as APICallRecord[];
      
      if (startDate) {
        records = records.filter(r => r.timestamp >= startDate);
      }
      
      if (endDate) {
        records = records.filter(r => r.timestamp <= endDate);
      }

      return records;
    } catch (error) {
      logError('Failed to get user API call records', error, { userId });
      return [];
    }
  }

  private async sendCostAlert(
    userId: string,
    type: CostAlert['type'],
    threshold: number,
    currentUsage: number
  ): Promise<void> {
    try {
      const alert: CostAlert = {
        id: uuidv4(),
        userId,
        type,
        threshold,
        currentUsage,
        message: this.generateAlertMessage(type, threshold, currentUsage),
        sentAt: new Date().toISOString(),
        acknowledged: false,
      };

      // Update last alert sent timestamp
      const quota = await this.getUserQuota(userId);
      quota.alerts.lastAlertSent = alert.sentAt;
      await this.saveUserQuota(quota);

      // In production, send email notification
      logWarn('Cost alert triggered', {
        userId,
        type,
        threshold,
        currentUsage,
        percentage: ((currentUsage / threshold) * 100).toFixed(1),
      });

      // Store alert for user dashboard
      // TODO: Implement alert storage and email notification
    } catch (error) {
      logError('Failed to send cost alert', error, { userId, type });
    }
  }

  private generateAlertMessage(
    type: CostAlert['type'],
    threshold: number,
    currentUsage: number
  ): string {
    const percentage = ((currentUsage / threshold) * 100).toFixed(1);
    
    switch (type) {
      case 'daily_limit_80':
        return `You've used ${percentage}% of your daily token limit (${currentUsage.toLocaleString()} of ${threshold.toLocaleString()} tokens).`;
      case 'daily_limit_100':
        return `You've reached your daily token limit (${threshold.toLocaleString()} tokens). Further requests will be denied until tomorrow.`;
      case 'monthly_limit_80':
        return `You've used ${percentage}% of your monthly cost limit ($${currentUsage.toFixed(2)} of $${threshold.toFixed(2)}).`;
      case 'monthly_limit_100':
        return `You've reached your monthly cost limit ($${threshold.toFixed(2)}). Please upgrade your plan to continue.`;
      case 'unusual_spike':
        return `Unusual activity detected: Your usage has spiked by ${percentage}% compared to your average.`;
      default:
        return `Cost alert: ${type}`;
    }
  }

  private startPeriodicCleanup(): void {
    // Clean cache every 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, this.CACHE_TTL);
  }

  private cleanupCache(): void {
    const now = Date.now();
    if (now - this.lastCacheClean > this.CACHE_TTL) {
      this.quotaCache.clear();
      this.lastCacheClean = now;
      logInfo('Cost tracking cache cleaned');
    }
  }
}

// Export singleton instance
export const costTrackingService = new CostTrackingService();