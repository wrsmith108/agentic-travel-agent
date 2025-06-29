import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('localhost'),

  // Session Configuration
  SESSION_SECRET: z.string().min(32).default('test-session-secret-at-least-32-chars-long'),

  // JWT Configuration
  JWT_SECRET: z.string().min(32).default('test-jwt-secret-at-least-32-chars-long-for-development'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('test-jwt-refresh-secret-at-least-32-chars-long-for-development'),
  REQUIRE_EMAIL_VERIFICATION: z.coerce.boolean().default(false),

  // Anthropic API
  ANTHROPIC_API_KEY: z.string().min(1).default('test-anthropic-key'),

  // Amadeus API
  AMADEUS_CLIENT_ID: z.string().min(1).default('test-amadeus-client-id'),
  AMADEUS_CLIENT_SECRET: z.string().min(1).default('test-amadeus-secret'),
  AMADEUS_ENVIRONMENT: z.enum(['test', 'production']).default('test'),

  // SendGrid
  SENDGRID_API_KEY: z.string().min(1).default('test-sendgrid-key'),
  SENDGRID_FROM_EMAIL: z.string().email().default('noreply@agentic-travel.com'),
  SENDGRID_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // Notification Configuration
  NOTIFICATION_SERVICE: z.enum(['sendgrid']).default('sendgrid'),

  // Feature Flags
  FEATURE_DEMO_MODE: z.coerce.boolean().default(true),
  FEATURE_EMAIL_NOTIFICATIONS: z.coerce.boolean().default(true),

  // API Configuration
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  API_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),

  // Data Storage
  DATA_DIRECTORY: z.string().default('./data'),

  // Database Configuration
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_MAX_CONNECTIONS: z.string().optional(),
  DB_IDLE_TIMEOUT: z.string().optional(),
  DB_CONNECTION_TIMEOUT: z.string().optional(),

  // Redis Configuration
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().optional(),
  REDIS_MAX_RETRIES: z.string().optional(),
  REDIS_RETRY_DELAY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIRECTORY: z.string().default('./logs'),

  // Monitoring Configuration
  PRICE_CHECK_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  MAX_ACTIVE_SEARCHES_PER_USER: z.coerce.number().int().positive().default(5),
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  // Price monitoring configuration
  PRICE_MONITOR_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  PRICE_MONITOR_MAX_CONCURRENT: z.coerce.number().int().positive().default(5),
  PRICE_MONITOR_COOLDOWN_HOURS: z.coerce.number().int().positive().default(24),
  PRICE_MONITOR_CRON_PATTERN: z.string().default('0 */6 * * *'), // Every 6 hours
  
  // Email configuration
  EMAIL_PROVIDER: z.enum(['sendgrid', 'ses', 'smtp', 'mock']).default('mock'),
  EMAIL_FROM: z.string().default('noreply@agentictravelagent.com'),
  EMAIL_REPLY_TO: z.string().optional(),
  EMAIL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  EMAIL_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(100),
  EMAIL_RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(1000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Cost Control Configuration
  DAILY_COST_ALERT_THRESHOLD: z.coerce.number().positive().default(10.0),
  MONTHLY_COST_ALERT_THRESHOLD: z.coerce.number().positive().default(100.0),
  DEFAULT_USER_TIER: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
  ENABLE_COST_TRACKING: z.coerce.boolean().default(true),
  COST_ALERT_EMAIL: z.string().email().optional(),
});

// Parse and validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:');
  console.error((isErr(parseResult) ? parseResult.error : undefined).format());
  process.exit(1);
}

export const env = parseResult.data;

// Type-safe environment configuration
export type Env = z.infer<typeof envSchema>;
