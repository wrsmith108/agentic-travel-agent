import { z } from 'zod';

/**
 * Cost control schemas for API usage tracking and limits
 * Following 2025 best practices for LLM cost management
 */

// Model pricing configuration (as of 2025)
export const ModelPricingSchema = z.object({
  modelId: z.string(),
  inputTokenCost: z.number().positive(), // Cost per 1M tokens
  outputTokenCost: z.number().positive(), // Cost per 1M tokens
  contextWindow: z.number().int().positive(),
  isDefault: z.boolean().default(false),
});

export const ModelPricingConfig = z.record(z.string(), ModelPricingSchema);

// Default pricing for Anthropic models (2025 rates)
export const DEFAULT_MODEL_PRICING: z.infer<typeof ModelPricingConfig> = {
  'claude-3-opus-20240229': {
    modelId: 'claude-3-opus-20240229',
    inputTokenCost: 15.0, // $15 per 1M input tokens
    outputTokenCost: 75.0, // $75 per 1M output tokens
    contextWindow: 200000,
    isDefault: true,
  },
  'claude-3-sonnet-20240229': {
    modelId: 'claude-3-sonnet-20240229',
    inputTokenCost: 3.0, // $3 per 1M input tokens
    outputTokenCost: 15.0, // $15 per 1M output tokens
    contextWindow: 200000,
    isDefault: false,
  },
  'claude-3-haiku-20240307': {
    modelId: 'claude-3-haiku-20240307',
    inputTokenCost: 0.25, // $0.25 per 1M input tokens
    outputTokenCost: 1.25, // $1.25 per 1M output tokens
    contextWindow: 200000,
    isDefault: false,
  },
};

// Token usage tracking
export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  modelId: z.string(),
  estimatedCost: z.number().nonnegative(), // In USD
  timestamp: z.string().datetime(),
});

// API call tracking
export const APICallRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  service: z.enum(['anthropic', 'amadeus', 'sendgrid']),
  endpoint: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  tokenUsage: TokenUsageSchema.optional(), // Only for LLM calls
  cost: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  duration: z.number().int().positive(), // milliseconds
  statusCode: z.number().int(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// User quota configuration
export const UserQuotaSchema = z.object({
  userId: z.string().uuid(),
  tier: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
  limits: z.object({
    dailyTokens: z.number().int().positive(),
    monthlyTokens: z.number().int().positive(),
    dailyCost: z.number().positive(), // USD
    monthlyCost: z.number().positive(), // USD
    concurrentRequests: z.number().int().positive().default(1),
    requestsPerMinute: z.number().int().positive().default(10),
  }),
  usage: z.object({
    currentDay: z.string().date(),
    currentMonth: z.string().regex(/^\d{4}-\d{2}$/),
    dailyTokensUsed: z.number().int().nonnegative().default(0),
    monthlyTokensUsed: z.number().int().nonnegative().default(0),
    dailyCostUsed: z.number().nonnegative().default(0),
    monthlyCostUsed: z.number().nonnegative().default(0),
  }),
  alerts: z.object({
    notifyAt80Percent: z.boolean().default(true),
    notifyAt100Percent: z.boolean().default(true),
    lastAlertSent: z.string().datetime().optional(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Default tier limits
export const DEFAULT_TIER_LIMITS = {
  free: {
    dailyTokens: 10000, // ~10 conversations
    monthlyTokens: 100000,
    dailyCost: 0.5,
    monthlyCost: 5.0,
    concurrentRequests: 1,
    requestsPerMinute: 5,
  },
  basic: {
    dailyTokens: 50000,
    monthlyTokens: 1000000,
    dailyCost: 5.0,
    monthlyCost: 50.0,
    concurrentRequests: 2,
    requestsPerMinute: 20,
  },
  premium: {
    dailyTokens: 200000,
    monthlyTokens: 5000000,
    dailyCost: 20.0,
    monthlyCost: 200.0,
    concurrentRequests: 5,
    requestsPerMinute: 50,
  },
  enterprise: {
    dailyTokens: 1000000,
    monthlyTokens: 30000000,
    dailyCost: 100.0,
    monthlyCost: 1000.0,
    concurrentRequests: 20,
    requestsPerMinute: 200,
  },
};

// Cost alert configuration
export const CostAlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum([
    'daily_limit_80',
    'daily_limit_100',
    'monthly_limit_80',
    'monthly_limit_100',
    'unusual_spike',
  ]),
  threshold: z.number().positive(),
  currentUsage: z.number().nonnegative(),
  message: z.string(),
  sentAt: z.string().datetime(),
  acknowledged: z.boolean().default(false),
});

// System-wide cost monitoring
export const SystemCostMetricsSchema = z.object({
  date: z.string().date(),
  totalCost: z.number().nonnegative(),
  serviceBreakdown: z.object({
    anthropic: z.number().nonnegative(),
    amadeus: z.number().nonnegative(),
    sendgrid: z.number().nonnegative(),
  }),
  userCount: z.number().int().nonnegative(),
  averageCostPerUser: z.number().nonnegative(),
  topUsers: z
    .array(
      z.object({
        userId: z.string().uuid(),
        cost: z.number().nonnegative(),
      })
    )
    .max(10),
});

// Request context for cost tracking
export const CostContextSchema = z.object({
  userId: z.string().uuid(),
  requestId: z.string().uuid(),
  service: z.enum(['anthropic', 'amadeus', 'sendgrid']),
  startTime: z.number(), // Date.now()
  tokensBefore: z.number().int().nonnegative().optional(),
});

// Model fallback configuration
export const ModelFallbackSchema = z.object({
  primary: z.string(),
  fallbacks: z.array(
    z.object({
      modelId: z.string(),
      triggerCondition: z.enum(['quota_exceeded', 'rate_limit', 'error', 'cost_threshold']),
      maxRetries: z.number().int().positive().default(2),
    })
  ),
});

// Export types
export type ModelPricing = z.infer<typeof ModelPricingSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type APICallRecord = z.infer<typeof APICallRecordSchema>;
export type UserQuota = z.infer<typeof UserQuotaSchema>;
export type CostAlert = z.infer<typeof CostAlertSchema>;
export type SystemCostMetrics = z.infer<typeof SystemCostMetricsSchema>;
export type CostContext = z.infer<typeof CostContextSchema>;
export type ModelFallback = z.infer<typeof ModelFallbackSchema>;

// Validation functions
export const validateTokenUsage = (data: unknown): TokenUsage => {
  return TokenUsageSchema.parse(data);
};

export const validateUserQuota = (data: unknown): UserQuota => {
  return UserQuotaSchema.parse(data);
};

export const validateAPICallRecord = (data: unknown): APICallRecord => {
  return APICallRecordSchema.parse(data);
};
