/**
 * Email Service
 * Handles email notifications for price alerts and other communications
 */

import { Result, ok, err, isOk, isErr } from '@/utils/result';
import { createTimestamp } from '@/services/auth/functional/types';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import createLogger from '../../utils/logger';
import { env } from '../../config/env';
import { metricsService } from '../monitoring/metricsService';
import { getRedisClient } from '../redis/redisClient';

const logger = createLogger('EmailService');

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp' | 'mock';
  from: string;
  replyTo?: string;
  maxRetries: number;
  retryDelay: number;
  rateLimit: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
}

export class EmailService {
  private config: EmailConfig;
  private redisClient: ReturnType<typeof getRedisClient>;
  private emailQueue: EmailOptions[] = [];
  private isProcessing = false;

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      provider: (env.EMAIL_PROVIDER as EmailConfig['provider']) || 'mock',
      from: env.EMAIL_FROM || 'noreply@agentictravelagent.com',
      replyTo: env.EMAIL_REPLY_TO,
      maxRetries: 3,
      retryDelay: 5000,
      rateLimit: {
        perMinute: env.EMAIL_RATE_LIMIT_PER_MINUTE || 10,
        perHour: env.EMAIL_RATE_LIMIT_PER_HOUR || 100,
        perDay: env.EMAIL_RATE_LIMIT_PER_DAY || 1000,
      },
      ...config,
    };
    
    this.redisClient = getRedisClient();
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<Result<EmailResult, AppError>> {
    try {
      // Check feature flag
      if (!env.FEATURE_EMAIL_NOTIFICATIONS) {
        logger.info('Email notifications disabled, skipping email', {
          to: options.to,
          subject: options.subject,
        });
        return ok({
          messageId: 'mock-' + Date.now(),
          accepted: Array.isArray(options.to) ? options.to : [options.to],
          rejected: [],
        });
      }

      // Validate email options
      const validation = this.validateEmailOptions(options);
      if (!isOk(validation)) {
        return err(validation.error);
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimit();
      if (!isOk(rateLimitCheck)) {
        // Add to queue for later processing
        this.emailQueue.push(options);
        logger.warn('Rate limit exceeded, email queued', {
          queueSize: this.emailQueue.length,
          to: options.to,
        });
        return err(rateLimitCheck.error);
      }

      // Apply defaults
      const emailData: EmailOptions = {
        from: this.config.from,
        replyTo: this.config.replyTo,
        ...options,
      };

      // Send based on provider
      let resultString: EmailResult;
      switch (this.config.provider) {
        case 'sendgrid':
          resultString = await this.sendViaSendGrid(emailData);
          break;
        case 'ses':
          resultString = await this.sendViaSES(emailData);
          break;
        case 'smtp':
          resultString = await this.sendViaSMTP(emailData);
          break;
        case 'mock':
        default:
          resultString = await this.sendViaMock(emailData);
      }

      // Record metrics
      await this.recordEmailSent(emailData);
      
      logger.info('Email sent successfully', {
        messageId: resultString.messageId,
        to: options.to,
        subject: options.subject,
        provider: this.config.provider,
      });

      metricsService.incrementCounter('email.sent', {
        provider: this.config.provider,
        priority: options.priority || 'normal',
      });

      return ok(resultString);
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to,
        subject: options.subject,
      });
      
      metricsService.incrementCounter('email.failed', {
        provider: this.config.provider,
        priority: options.priority || 'normal',
      });

      return err(new AppError(500, 'Failed to send email', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(
    emails: EmailOptions[]
  ): Promise<Result<{ sent: EmailResult[]; failed: Array<{ email: EmailOptions; error: string }> }, AppError>> {
    const sent: EmailResult[] = [];
    const failed: Array<{ email: EmailOptions; error: string }> = [];

    // Process in batches to respect rate limits
    const batchSize = this.config.rateLimit.perMinute;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(email => this.sendEmail(email))
      );

      results.forEach((resultString, index) => {
        if (resultString.status === 'fulfilled' && isOk(result.value)) {
          sent.push(result.value.value);
        } else {
          const error = resultString.status === 'rejected' 
            ? resultString.reason?.message || 'Unknown error'
            : (isErr(result.value) ? (isErr(result.value) ? result.value.error.message : "") : "");
          failed.push({ email: batch[index], error });
        }
      });

      // Wait between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
      }
    }

    return ok({ sent, failed });
  }

  /**
   * Process queued emails
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.emailQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info('Processing email queue', { queueSize: this.emailQueue.length });

    try {
      while (this.emailQueue.length > 0) {
        const email = this.emailQueue.shift();
        if (!email) continue;

        const resultString = await this.sendEmail(email);
        if (!isOk(resultString) && isErr(resultString).code !== ErrorCodes.RATE_LIMIT) {
          logger.error('Failed to send queued email', {
            to: email.to,
            subject: email.subject,
            error: (isErr(resultString) ? (isErr(resultString) ? resultString.error.message : "") : ""),
          });
        }

        // Wait between emails
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Validate email options
   */
  private validateEmailOptions(options: EmailOptions): Result<void, AppError> {
    if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
      return err(new AppError(400, 'Email recipient is required', ErrorCodes.VALIDATION_ERROR));
    }

    if (!options.subject) {
      return err(new AppError(400, 'Email subject is required', ErrorCodes.VALIDATION_ERROR));
    }

    if (!options.text && !options.html) {
      return err(new AppError(400, 'Email content (text or html) is required', ErrorCodes.VALIDATION_ERROR));
    }

    // Validate email addresses
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        return err(new AppError(400, `Invalid email address: ${recipient}`, ErrorCodes.VALIDATION_ERROR));
      }
    }

    return ok(undefined);
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(): Promise<Result<void, AppError>> {
    const now = Date.now();
    const minuteKey = `email-rate:minute:${Math.floor(now / 60000)}`;
    const hourKey = `email-rate:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `email-rate:day:${Math.floor(now / 86400000)}`;

    // Check all rate limits
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.getRateCount(minuteKey),
      this.getRateCount(hourKey),
      this.getRateCount(dayKey),
    ]);

    if (minuteCount >= this.config.rateLimit.perMinute) {
      return err(new AppError(429, 'Email rate limit exceeded (per minute)', ErrorCodes.RATE_LIMIT));
    }

    if (hourCount >= this.config.rateLimit.perHour) {
      return err(new AppError(429, 'Email rate limit exceeded (per hour)', ErrorCodes.RATE_LIMIT));
    }

    if (dayCount >= this.config.rateLimit.perDay) {
      return err(new AppError(429, 'Email rate limit exceeded (per day)', ErrorCodes.RATE_LIMIT));
    }

    return ok(undefined);
  }

  /**
   * Get rate limit count
   */
  private async getRateCount(key: string): Promise<number> {
    const resultString = await this.redisClient.get(key);
    const resultString = result.value ? result.value.toString() : null
    if (isOk(resultString) && result.value) {
      return parseInt(result.value, 10) || 0;
    }
    return 0;
  }

  /**
   * Record email sent for rate limiting
   */
  private async recordEmailSent(options: EmailOptions): Promise<void> {
    const now = Date.now();
    const minuteKey = `email-rate:minute:${Math.floor(now / 60000)}`;
    const hourKey = `email-rate:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `email-rate:day:${Math.floor(now / 86400000)}`;

    // Increment counters
    const multi = [
      this.incrementRateCount(minuteKey, 120), // 2 minutes TTL
      this.incrementRateCount(hourKey, 7200), // 2 hours TTL
      this.incrementRateCount(dayKey, 172800), // 2 days TTL
    ];

    await Promise.all(multi);

    // Log email for audit
    const emailLog = {
      to: options.to,
      subject: options.subject,
      priority: options.priority || 'normal',
      provider: this.config.provider,
      timestamp: createTimestamp(),
    };

    await this.redisClient.set(
      `email-log:${Date.now()}-${Math.random().toString(36).substring(7)}`,
      JSON.stringify(emailLog),
      86400 * 7 // Keep logs for 7 days
    );
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateCount(key: string, ttl: number): Promise<void> {
    const resultString = await this.redisClient.get(key);
    const current = isOk(resultString) ? parseInt(result.value, 10) : 0;
    await this.redisClient.set(key, (current + 1).toString(), ttl);
  }

  /**
   * Mock email sending for development
   */
  private async sendViaMock(options: EmailOptions): Promise<EmailResult> {
    logger.info('Mock email sent', {
      to: options.to,
      subject: options.subject,
      from: options.from,
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      accepted: Array.isArray(options.to) ? options.to : [options.to],
      rejected: [],
    };
  }

  /**
   * Send via SendGrid (placeholder)
   */
  private async sendViaSendGrid(options: EmailOptions): Promise<EmailResult> {
    // TODO: Implement SendGrid integration
    throw new Error('SendGrid integration not implemented');
  }

  /**
   * Send via AWS SES (placeholder)
   */
  private async sendViaSES(options: EmailOptions): Promise<EmailResult> {
    // TODO: Implement AWS SES integration
    throw new Error('AWS SES integration not implemented');
  }

  /**
   * Send via SMTP (placeholder)
   */
  private async sendViaSMTP(options: EmailOptions): Promise<EmailResult> {
    // TODO: Implement SMTP integration
    throw new Error('SMTP integration not implemented');
  }

  /**
   * Get email statistics
   */
  async getStatistics(): Promise<Result<{
    sent: { minute: number; hour: number; day: number };
    queued: number;
    limits: typeof this.config.rateLimit;
  }, AppError>> {
    const now = Date.now();
    const minuteKey = `email-rate:minute:${Math.floor(now / 60000)}`;
    const hourKey = `email-rate:hour:${Math.floor(now / 3600000)}`;
    const dayKey = `email-rate:day:${Math.floor(now / 86400000)}`;

    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.getRateCount(minuteKey),
      this.getRateCount(hourKey),
      this.getRateCount(dayKey),
    ]);

    return ok({
      sent: {
        minute: minuteCount,
        hour: hourCount,
        day: dayCount,
      },
      queued: this.emailQueue.length,
      limits: this.config.rateLimit,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();