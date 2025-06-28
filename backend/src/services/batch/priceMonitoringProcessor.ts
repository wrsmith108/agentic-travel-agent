/**
 * Price Monitoring Batch Processor
 * Periodically checks saved searches for price changes and generates alerts
 */

import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err } from '../../utils/result';
import { isOk, isErr } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import createLogger from '../../utils/logger';
import { getRedisClient } from '../redis/redisClient';
import { flightSearchService } from '../flights/flightSearchService';
import { emailService } from '../notifications/emailService';
import { metricsService } from '../monitoring/metricsService';
import { errorTracker } from '../monitoring/errorTracker';
import { userPreferencesService } from '../preferences/userPreferencesService';
import { SavedSearch, PriceAlert } from '../../schemas/flight';
import { env } from '../../config/env';
import { UserId } from '../../types/brandedTypes';

const logger = createLogger('PriceMonitoringProcessor');

interface ProcessingResult {
  processedCount: number;
  alertsGenerated: number;
  errors: string[];
  duration: number;
}

interface BatchConfig {
  batchSize: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelay: number;
  alertCooldown: number; // Hours before sending another alert for the same search
}

export class PriceMonitoringProcessor {
  private isRunning = false;
  private cronJob?: CronJob;
  private redisClient: ReturnType<typeof getRedisClient>;
  private config: BatchConfig;

  constructor(config?: Partial<BatchConfig>) {
    this.redisClient = getRedisClient();
    this.config = {
      batchSize: config?.batchSize || 50,
      maxConcurrent: config?.maxConcurrent || 5,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 5000,
      alertCooldown: config?.alertCooldown || 24, // 24 hours default
    };
  }

  /**
   * Start the batch processor with a cron schedule
   */
  start(cronPattern: string = '0 */6 * * *'): void { // Every 6 hours by default
    if (this.cronJob) {
      logger.warn('Price monitoring processor already running');
      return;
    }

    logger.info('Starting price monitoring processor', {
      cronPattern,
      config: this.config,
    });

    this.cronJob = new CronJob(
      cronPattern,
      async () => {
        await this.runBatch();
      },
      null,
      true,
      'America/New_York'
    );

    // Run immediately on start
    this.runBatch().catch(error => {
      logger.error('Initial batch run failed', { error });
    });
  }

  /**
   * Stop the batch processor
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
      logger.info('Price monitoring processor stopped');
    }
  }

  /**
   * Run a single batch processing cycle
   */
  async runBatch(): Promise<Result<ProcessingResult, AppError>> {
    if (this.isRunning) {
      logger.warn('Batch already running, skipping');
      return err(new AppError(409, 'Batch already in progress', ErrorCodes.CONFLICT));
    }

    const batchId = uuidv4();
    const startTime = Date.now();
    this.isRunning = true;

    logger.info('Starting batch processing', { batchId });
    metricsService.incrementCounter('price_monitoring.batch.started');

    try {
      // Get all users with active saved searches
      const usersResult = await this.getActiveUsers();
      if (!isOk(usersResult)) {
        return err(usersResult.error);
      }

      const users = isOk(usersResult) ? usersResult.value : null;
      logger.info('Found users with active searches', { 
        count: users.length,
        batchId,
      });

      // Process users in batches
      const results: ProcessingResult = {
        processedCount: 0,
        alertsGenerated: 0,
        errors: [],
        duration: 0,
      };

      for (let i = 0; i < users.length; i += this.config.batchSize) {
        const batch = users.slice(i, i + this.config.batchSize);
        const batchResults = await this.processBatch(batch, batchId);
        
        results.processedCount += batchResults.processedCount;
        results.alertsGenerated += batchResults.alertsGenerated;
        results.errors.push(...batchResults.errors);
      }

      results.duration = Date.now() - startTime;

      logger.info('Batch processing completed', {
        batchId,
        results,
      });

      metricsService.incrementCounter('price_monitoring.batch.completed');
      metricsService.recordHistogram('price_monitoring.batch.duration', results.duration);
      metricsService.recordHistogram('price_monitoring.batch.processed', results.processedCount);
      metricsService.recordHistogram('price_monitoring.batch.alerts', results.alertsGenerated);

      return ok(results);
    } catch (error) {
      logger.error('Batch processing failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        batchId,
      });
      
      errorTracker.captureError(error instanceof Error ? error : new Error('Batch processing failed'));
      metricsService.incrementCounter('price_monitoring.batch.failed');
      
      return err(new AppError(500, 'Batch processing failed', ErrorCodes.SERVICE_ERROR));
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get all users with active saved searches
   */
  private async getActiveUsers(): Promise<Result<string[], AppError>> {
    try {
      const pattern = 'saved-searches:*';
      const keysResult = await this.redisClient.keys(pattern);
      
      if (!isOk(keysResult)) {
        return err(new AppError(500, 'Failed to fetch user keys', ErrorCodes.SERVICE_ERROR));
      }

      // Extract user IDs from keys
      const userIds = isOk(keysResult) ? keysResult.value : null
        .map(key => key.replace('saved-searches:', ''))
        .filter(id => id.length > 0);

      return ok([...new Set(userIds)]); // Remove duplicates
    } catch (error) {
      logger.error('Failed to get active users', { error });
      return err(new AppError(500, 'Failed to get active users', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Process a batch of users
   */
  private async processBatch(userIds: string[], batchId: string): Promise<ProcessingResult> {
    const results: ProcessingResult = {
      processedCount: 0,
      alertsGenerated: 0,
      errors: [],
      duration: 0,
    };

    // Process users concurrently with limit
    const chunks = [];
    for (let i = 0; i < userIds.length; i += this.config.maxConcurrent) {
      chunks.push(userIds.slice(i, i + this.config.maxConcurrent));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(userId => this.processUser(userId, batchId));
      const chunkResults = await Promise.allSettled(promises);

      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && isOk(result.value)) {
          results.processedCount += result.value.value.processedCount;
          results.alertsGenerated += result.value.value.alertsGenerated;
        } else {
          const error = result.status === 'rejected' 
            ? result.reason?.message || 'Unknown error'
            : (isErr(result.value) ? (isErr(result.value) ? result.value.error.message : "") : "");
          results.errors.push(`User ${chunk[index]}: ${error}`);
        }
      });
    }

    return results;
  }

  /**
   * Process saved searches for a single user
   */
  private async processUser(
    userId: string, 
    batchId: string
  ): Promise<Result<{ processedCount: number; alertsGenerated: number }, AppError>> {
    logger.debug('Processing user', { userId, batchId });

    try {
      // Check if user has price alerts enabled in preferences
      const hasAlertsEnabled = await userPreferencesService.isNotificationEnabled(
        userId as UserId,
        'priceAlerts'
      );
      
      if (!hasAlertsEnabled) {
        logger.debug('User has price alerts disabled', { userId });
        return ok({ processedCount: 0, alertsGenerated: 0 });
      }

      // Get user's saved searches
      const searchesResult = await flightSearchService.getSavedSearches(userId);
      if (!isOk(searchesResult)) {
        return err(searchesResult.error);
      }

      const activeSearches = isOk(searchesResult) ? searchesResult.value : null.filter(search => 
        search.isActive && 
        search.priceAlerts?.enabled &&
        (!search.expiresAt || new Date(search.expiresAt) > new Date())
      );

      if (activeSearches.length === 0) {
        return ok({ processedCount: 0, alertsGenerated: 0 });
      }

      let processedCount = 0;
      let alertsGenerated = 0;

      // Process each saved search
      for (const savedSearch of activeSearches) {
        const shouldProcess = await this.shouldProcessSearch(savedSearch, userId);
        if (!shouldProcess) {
          continue;
        }

        const result = await this.processSearch(savedSearch, userId);
        if (isOk(result)) {
          processedCount++;
          if (result.value.alertGenerated) {
            alertsGenerated++;
          }
        } else {
          logger.warn('Failed to process search', {
            userId,
            searchId: savedSearch.id,
            error: (isErr(result) ? (isErr(result) ? result.error.message : "") : ""),
          });
        }
      }

      return ok({ processedCount, alertsGenerated });
    } catch (error) {
      logger.error('Failed to process user', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return err(new AppError(500, 'Failed to process user', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Check if a search should be processed based on cooldown and user preferences
   */
  private async shouldProcessSearch(savedSearch: SavedSearch, userId: string): Promise<boolean> {
    const lastCheckKey = `last-price-check:${savedSearch.id}`;
    const lastCheckResult = await this.redisClient.get(lastCheckKey);

    if (isOk(lastCheckResult) && lastCheckResult.value) {
      const lastCheck = new Date(lastCheckResult.value);
      
      // Get user's notification frequency preference
      const frequency = await userPreferencesService.getNotificationFrequency(userId as UserId);
      
      // Determine cooldown based on frequency preference
      let cooldownHours: number;
      switch (frequency) {
        case 'INSTANT':
          cooldownHours = 1; // Check every hour for instant alerts
          break;
        case 'HOURLY':
          cooldownHours = 1;
          break;
        case 'DAILY':
          cooldownHours = 24;
          break;
        case 'WEEKLY':
          cooldownHours = 168; // 7 days
          break;
        case 'NEVER':
          return false; // Should not reach here, but safety check
        default:
          cooldownHours = savedSearch.priceAlerts?.checkFrequency || this.config.alertCooldown;
      }
      
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      
      if (Date.now() - lastCheck.getTime() < cooldownMs) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process a single saved search
   */
  private async processSearch(
    savedSearch: SavedSearch, 
    userId: string
  ): Promise<Result<{ alertGenerated: boolean }, AppError>> {
    try {
      // Record last check time
      const lastCheckKey = `last-price-check:${savedSearch.id}`;
      await this.redisClient.set(lastCheckKey, new Date().toISOString(), 7 * 24 * 60 * 60);

      // Check current prices
      const priceCheckResult = await flightSearchService.checkSavedSearchPrices(userId);
      if (!isOk(priceCheckResult)) {
        return err(priceCheckResult.error);
      }

      // Find results for this specific search
      const searchResult = isOk(priceCheckResult) ? priceCheckResult.value : null.find(r => r.savedSearchId === savedSearch.id);
      if (!searchResult || !searchResult.alert) {
        return ok({ alertGenerated: false });
      }

      // Send notification if alert was generated
      if (env.FEATURE_EMAIL_NOTIFICATIONS) {
        await this.sendAlertNotification(searchResult.alert, savedSearch, userId);
      }

      metricsService.incrementCounter('price_monitoring.alerts.generated', {
        triggerType: searchResult.alert.triggerType,
      });

      return ok({ alertGenerated: true });
    } catch (error) {
      logger.error('Failed to process search', {
        searchId: savedSearch.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return err(new AppError(500, 'Failed to process search', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Send price alert notification
   */
  private async sendAlertNotification(
    alert: PriceAlert,
    savedSearch: SavedSearch,
    userId: string
  ): Promise<void> {
    try {
      // Get user email (would normally fetch from user service)
      const userEmail = await this.getUserEmail(userId);
      if (!userEmail) {
        logger.warn('No email found for user', { userId });
        return;
      }

      const subject = `✈️ Price Alert: ${savedSearch.name}`;
      const percentChange = Math.abs(alert.percentChange);
      const direction = alert.percentChange < 0 ? 'dropped' : 'increased';
      
      const body = `
        <h2>Good news! We found a price change for your saved search.</h2>
        
        <h3>${savedSearch.name}</h3>
        
        <p>The price has ${direction} by ${percentChange.toFixed(1)}%!</p>
        
        <table>
          <tr>
            <td><strong>Previous Price:</strong></td>
            <td>$${alert.previousPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Current Price:</strong></td>
            <td>$${alert.currentPrice.toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Savings:</strong></td>
            <td>$${Math.abs(alert.priceDifference).toFixed(2)}</td>
          </tr>
        </table>
        
        <p><strong>Flight Details:</strong></p>
        <ul>
          <li>Route: ${alert.flightOffer.itineraries[0].segments[0].departure.iataCode} → 
              ${alert.flightOffer.itineraries[0].segments[alert.flightOffer.itineraries[0].segments.length - 1].arrival.iataCode}</li>
          <li>Departure: ${new Date(alert.flightOffer.itineraries[0].segments[0].departure.at).toLocaleString()}</li>
          <li>Airline: ${alert.flightOffer.validatingAirlineCodes[0]}</li>
        </ul>
        
        <p><a href="${env.FRONTEND_URL}/flights/${alert.id}">View Flight Details</a></p>
        
        <p><small>This alert expires on ${new Date(alert.expiresAt).toLocaleDateString()}</small></p>
      `;

      await emailService.sendEmail({
        to: userEmail,
        subject,
        html: body,
        priority: 'high',
      });

      logger.info('Alert notification sent', {
        userId,
        alertId: alert.id,
        email: userEmail,
      });
    } catch (error) {
      logger.error('Failed to send alert notification', {
        userId,
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - we don't want to fail the whole process
    }
  }

  /**
   * Get user email address
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    // TODO: Implement actual user email lookup
    // For now, return a mock email for testing
    if (env.NODE_ENV === 'development') {
      return `user+${userId}@example.com`;
    }
    
    const userKey = `user:${userId}`;
    const userResult = await this.redisClient.get(userKey);
    
    if (isOk(userResult) && userResult.value) {
      const userData = JSON.parse(userResult.value);
      return userData.email || null;
    }
    
    return null;
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean;
    isProcessing: boolean;
    nextRun?: Date;
    config: BatchConfig;
  } {
    return {
      isRunning: !!this.cronJob,
      isProcessing: this.isRunning,
      nextRun: this.cronJob?.nextDate()?.toJSDate(),
      config: this.config,
    };
  }

  /**
   * Process searches on demand (manual trigger)
   */
  async processNow(): Promise<Result<ProcessingResult, AppError>> {
    logger.info('Manual batch processing triggered');
    return this.runBatch();
  }
}

// Export singleton instance
export const priceMonitoringProcessor = new PriceMonitoringProcessor({
  batchSize: env.PRICE_MONITOR_BATCH_SIZE || 50,
  maxConcurrent: env.PRICE_MONITOR_MAX_CONCURRENT || 5,
  alertCooldown: env.PRICE_MONITOR_COOLDOWN_HOURS || 24,
});