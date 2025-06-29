/**
 * Flight Search Service
 * Core business logic for flight searching, price tracking, and search management
 */

import { v4 as uuidv4 } from 'uuid';
import { createTimestamp } from '@/services/auth/functional/types';
import { Result, ok, err, isOk, isErr } from '@/utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import { enhancedAmadeusService } from './enhancedAmadeusService';
import { getRedisClient } from '../redis/redisClient';
import {
  FlightOffer,
  FlightSearchQuery,
  AdvancedSearchOptions,
  SavedSearch,
  PriceAlert,
  validateFlightSearchQuery,
} from '../../schemas/flight';
import {
  CreateSavedSearchData,
  UpdateSavedSearchData,
  FlightSearchHistory,
  UserFlightPreferences,
  FlightPriceHistory,
  createSavedSearch,
  updateSavedSearch,
  createPriceAlert,
  shouldTriggerPriceAlert,
  calculatePriceStatistics,
  matchesUserPreferences,
  groupFlightsByCharacteristics,
} from '../../models/flight';

interface SearchResultWithAnalytics {
  flights: FlightOffer[];
  analytics: {
    totalResults: number;
    priceRange: { min: number; max: number; average: number };
    airlines: Array<{ code: string; name: string; count: number }>;
    cheapestOption: FlightOffer | null;
    fastestOption: FlightOffer | null;
    bestValueOption: FlightOffer | null;
    priceHistory?: FlightPriceHistory[];
    recommendations: string[];
  };
}

interface PriceTrackingResult {
  savedSearch: SavedSearch;
  currentBestPrice: number;
  previousBestPrice?: number;
  priceChange?: number;
  percentChange?: number;
  alert?: PriceAlert;
}

export class FlightSearchService {
  private redisClient: ReturnType<typeof getRedisClient>;

  constructor() {
    this.redisClient = getRedisClient();
  }

  /**
   * Search flights with analytics and recommendations
   */
  async searchFlights(
    query: FlightSearchQuery,
    userId?: string,
    preferences?: UserFlightPreferences,
    advancedOptions?: AdvancedSearchOptions
  ): Promise<Result<SearchResultWithAnalytics, AppError>> {
    try {
      // Validate query
      const validatedQuery = validateFlightSearchQuery(query);

      // Search flights using Amadeus service
      const searchResult = await enhancedAmadeusService.searchFlights(validatedQuery, advancedOptions);
      
      if (!isOk(searchResult)) {
        return err((isErr(searchResult) ? searchResult.error : undefined));
      }

      const flights = isOk(searchResult) ? searchResult.value : null;

      // Apply user preferences if provided
      let filteredFlights = flights;
      if (preferences) {
        filteredFlights = flights.filter(flight => {
          const match = matchesUserPreferences(flight, preferences);
          return match.matches;
        });
      }

      // Calculate analytics
      const analytics = await this.calculateSearchAnalytics(filteredFlights, validatedQuery);

      // Save search history if user is provided
      if (userId) {
        await this.saveSearchHistory(userId, validatedQuery, filteredFlights.length, analytics.priceRange.min);
      }

      // Get price history for the route
      if (validatedQuery.originLocationCode && validatedQuery.destinationLocationCode) {
        const priceHistory = await this.getPriceHistory(
          validatedQuery.originLocationCode,
          validatedQuery.destinationLocationCode,
          validatedQuery.departureDate
        );
        analytics.priceHistory = priceHistory;
      }

      // Generate recommendations
      analytics.recommendations = this.generateRecommendations(
        filteredFlights,
        analytics,
        preferences
      );

      return ok({
        flights: filteredFlights,
        analytics,
      });
    } catch (error) {
      console.error('Flight search failed:', error);
      return err(new AppError(500, 'Flight search failed', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Create a saved search for price monitoring
   */
  async createSavedSearch(data: CreateSavedSearchData): Promise<Result<SavedSearch, AppError>> {
    try {
      const savedSearch = createSavedSearch(data);
      
      // Store in database/cache
      const key = `saved-search:${data.userId}:${savedSearch.id}`;
      await this.redisClient.set(key, JSON.stringify(savedSearch));

      // Add to user's saved searches list
      const listKey = `saved-searches:${data.userId}`;
      const listResult = await this.redisClient.get(listKey);
      
      let searchIds: string[] = [];
      if (listResult.success && listResult.data) {
        searchIds = JSON.parse(listResult.data);
      }
      searchIds.push(savedSearch.id);
      
      await this.redisClient.set(listKey, JSON.stringify(searchIds));

      return ok(savedSearch);
    } catch (error) {
      console.error('Failed to create saved search:', error);
      return err(new AppError(500, 'Failed to create saved search', ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Update a saved search
   */
  async updateSavedSearch(
    userId: string,
    searchId: string,
    updates: UpdateSavedSearchData
  ): Promise<Result<SavedSearch, AppError>> {
    try {
      const key = `saved-search:${userId}:${searchId}`;
      const existingResult = await this.redisClient.get(key);
      
      if (!existingResult.success || !existingResult.data) {
        return err(new AppError(404, 'Saved search not found', ErrorCodes.NOT_FOUND));
      }

      const existing: SavedSearch = JSON.parse(existingResult.data);
      const updated = updateSavedSearch(existing, updates);
      
      await this.redisClient.set(key, JSON.stringify(updated));
      
      return ok(updated);
    } catch (error) {
      console.error('Failed to update saved search:', error);
      return err(new AppError(500, 'Failed to update saved search', ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Get user's saved searches
   */
  async getSavedSearches(userId: string): Promise<Result<SavedSearch[], AppError>> {
    try {
      const listKey = `saved-searches:${userId}`;
      const listResult = await this.redisClient.get(listKey);
      
      if (!listResult.success || !listResult.data) {
        return ok([]);
      }

      const searchIds: string[] = JSON.parse(listResult.data);
      const searches: SavedSearch[] = [];

      for (const searchId of searchIds) {
        const key = `saved-search:${userId}:${searchId}`;
        const searchResult = await this.redisClient.get(key);
            
        if (isOk(searchResult) && searchResult.value) {
          const search: SavedSearch = JSON.parse(searchResult.value);
          if (search.isActive && (!search.expiresAt || new Date(search.expiresAt) > new Date())) {
            searches.push(search);
          }
        }
      }

      return ok(searches);
    } catch (error) {
      console.error('Failed to get saved searches:', error);
      return err(new AppError(500, 'Failed to get saved searches', ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(userId: string, searchId: string): Promise<Result<void, AppError>> {
    try {
      const key = `saved-search:${userId}:${searchId}`;
      await this.redisClient.del(key);

      // Remove from user's list
      const listKey = `saved-searches:${userId}`;
      const listResult = await this.redisClient.get(listKey);
      
      if (listResult.success && listResult.data) {
        const searchIds: string[] = JSON.parse(listResult.data);
        const filtered = searchIds.filter(id => id !== searchId);
        await this.redisClient.set(listKey, JSON.stringify(filtered));
      }

      return ok(undefined);
    } catch (error) {
      console.error('Failed to delete saved search:', error);
      return err(new AppError(500, 'Failed to delete saved search', ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Check saved searches for price changes
   */
  async checkSavedSearchPrices(userId: string): Promise<Result<PriceTrackingResult[], AppError>> {
    try {
      const savedSearchesResult = await this.getSavedSearches(userId);
      
      if (!savedSearchesResult.success) {
        return err((isErr(savedSearchesResult) ? savedSearchesResult.error : undefined));
      }

      const results: PriceTrackingResult[] = [];

      for (const savedSearch of savedSearchesResult.data) {
        if (!savedSearch.priceAlerts?.enabled) continue;

        // Search for current prices
        const searchResult = await enhancedAmadeusService.searchFlights(
          savedSearch.searchQuery,
          savedSearch.advancedOptions
        );

        if (isOk(searchResult) && searchResult.value.length > 0) {
          // Find the best price
          const prices = isOk(searchResult) ? searchResult.value : [].map(f => parseFloat(f.price.grandTotal));
          const currentBestPrice = Math.min(...prices);
          const bestFlight = isOk(searchResult) ? searchResult.value : null.find(f => parseFloat(f.price.grandTotal) === currentBestPrice);

          // Get previous best price
          const priceHistoryKey = `price-history:${savedSearch.id}`;
          const historyResult = await this.redisClient.get(priceHistoryKey);
          
          let previousBestPrice: number | undefined;
          if (historyResult.success && historyResult.data) {
            const history: number[] = JSON.parse(historyResult.data);
            previousBestPrice = history[history.length - 1];
          }

          // Check if we should trigger an alert
          const shouldAlert = shouldTriggerPriceAlert(savedSearch, currentBestPrice, previousBestPrice);

          let alert: PriceAlert | undefined;
          if (shouldAlert.trigger && bestFlight) {
            alert = createPriceAlert({
              userId,
              savedSearchId: savedSearch.id,
              triggerType: shouldAlert.type!,
              flightOffer: bestFlight,
              previousPrice: previousBestPrice || currentBestPrice,
              currentPrice: currentBestPrice,
            });

            // Store alert
            await this.storePriceAlert(alert);
          }

          // Update price history
          await this.updatePriceHistory(savedSearch.id, currentBestPrice);

          // Update last checked time
          savedSearch.lastCheckedAt = createTimestamp();
          await this.updateSavedSearch(userId, savedSearch.id, { lastCheckedAt: savedSearch.lastCheckedAt });

          results.push({
            savedSearch,
            currentBestPrice,
            previousBestPrice,
            priceChange: previousBestPrice ? currentBestPrice - previousBestPrice : undefined,
            percentChange: previousBestPrice ? ((currentBestPrice - previousBestPrice) / previousBestPrice) * 100 : undefined,
            alert,
          });
        }
      }

      return ok(results);
    } catch (error) {
      console.error('Failed to check saved search prices:', error);
      return err(new AppError(500, 'Failed to check saved search prices', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Get price alerts for a user
   */
  async getPriceAlerts(userId: string, unreadOnly: boolean = false): Promise<Result<PriceAlert[], AppError>> {
    try {
      const key = `price-alerts:${userId}`;
      const result = await this.redisClient.get(key);
      
      if (!isOk(result) || isErr(result)) {
        return ok([]);
      }

      let alerts: PriceAlert[] = JSON.parse(result.value);
      
      // Filter expired alerts
      const now = new Date();
      alerts = alerts.filter(alert => new Date(alert.expiresAt) > now);

      // Filter unread only if requested
      if (unreadOnly) {
        alerts = alerts.filter(alert => !alert.isRead);
      }

      // Sort by date (newest first)
      alerts.sort((a, b) => new Date(b.alertedAt).getTime() - new Date(a.alertedAt).getTime());

      return ok(alerts);
    } catch (error) {
      console.error('Failed to get price alerts:', error);
      return err(new AppError(500, 'Failed to get price alerts', ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Mark price alert as read
   */
  async markAlertAsRead(userId: string, alertId: string): Promise<Result<void, AppError>> {
    try {
      const key = `price-alerts:${userId}`;
      const result = await this.redisClient.get(key);
      
      if (!isOk(result) || isErr(result)) {
        return err(new AppError(404, 'Alert not found', ErrorCodes.NOT_FOUND));
      }

      const alerts: PriceAlert[] = JSON.parse(result.value);
      const alert = alerts.find(a => a.id === alertId);
      
      if (!alert) {
        return err(new AppError(404, 'Alert not found', ErrorCodes.NOT_FOUND));
      }

      alert.isRead = true;
      await this.redisClient.set(key, JSON.stringify(alerts));

      return ok(undefined);
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
      return err(new AppError(500, 'Failed to mark alert as read', ErrorCodes.DATABASE_ERROR));
    }
  }

  /**
   * Calculate search analytics
   */
  private async calculateSearchAnalytics(
    flights: FlightOffer[],
    query: FlightSearchQuery
  ): Promise<SearchResultWithAnalytics['analytics']> {
    const prices = flights.map(f => parseFloat(f.price.grandTotal));
    const priceStats = calculatePriceStatistics(prices);

    // Group by airline
    const airlineGroups = new Map<string, number>();
    flights.forEach(flight => {
      const airline = flight.itineraries[0].segments[0].carrierCode;
      airlineGroups.set(airline, (airlineGroups.get(airline) || 0) + 1);
    });

    // Get airline names
    const airlines: Array<{ code: string; name: string; count: number }> = [];
    for (const [code, count] of airlineGroups.entries()) {
      const airlineInfo = await enhancedAmadeusService.getAirlineInfo(code);
      airlines.push({
        code,
        name: airlineInfo.success ? airlineInfo.data.name : code,
        count,
      });
    }

    // Find best options
    const cheapestOption = flights.length > 0 ? 
      flights.reduce((min, f) => parseFloat(f.price.grandTotal) < parseFloat(min.price.grandTotal) ? f : min) : null;

    const fastestOption = flights.length > 0 ?
      flights.reduce((min, f) => {
        const getDuration = (offer: FlightOffer) => {
          return offer.itineraries.reduce((sum, itin) => {
            const match = itin.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
            const hours = match?.[1] ? parseInt(match[1]) : 0;
            const minutes = match?.[2] ? parseInt(match[2]) : 0;
            return sum + hours * 60 + minutes;
          }, 0);
        };
        return getDuration(f) < getDuration(min) ? f : min;
      }) : null;

    // Best value considers price and duration
    const bestValueOption = flights.length > 0 ?
      flights.reduce((best, f) => {
        const getValue = (offer: FlightOffer) => {
          const price = parseFloat(offer.price.grandTotal);
          const duration = offer.itineraries.reduce((sum, itin) => {
            const match = itin.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
            const hours = match?.[1] ? parseInt(match[1]) : 0;
            const minutes = match?.[2] ? parseInt(match[2]) : 0;
            return sum + hours * 60 + minutes;
          }, 0);
          // Lower score is better (price per minute of flight time)
          return price / duration;
        };
        return getValue(f) < getValue(best) ? f : best;
      }) : null;

    return {
      totalResults: flights.length,
      priceRange: {
        min: priceStats.min,
        max: priceStats.max,
        average: priceStats.average,
      },
      airlines: airlines.sort((a, b) => b.count - a.count),
      cheapestOption,
      fastestOption,
      bestValueOption,
      recommendations: [],
    };
  }

  /**
   * Generate recommendations based on search results
   */
  private generateRecommendations(
    flights: FlightOffer[],
    analytics: SearchResultWithAnalytics['analytics'],
    preferences?: UserFlightPreferences
  ): string[] {
    const recommendations: string[] = [];

    // Price-based recommendations
    if (analytics.priceRange.min && analytics.priceRange.max) {
      const priceSpread = analytics.priceRange.max - analytics.priceRange.min;
      if (priceSpread > analytics.priceRange.average * 0.5) {
        recommendations.push('Prices vary significantly. Consider flexible dates for better deals.');
      }
    }

    // Time-based recommendations
    if (analytics.cheapestOption && analytics.fastestOption && 
        analytics.cheapestOption.id !== analytics.fastestOption.id) {
      const priceDiff = parseFloat(analytics.fastestOption.price.grandTotal) - 
                       parseFloat(analytics.cheapestOption.price.grandTotal);
      if (priceDiff < analytics.priceRange.average * 0.2) {
        recommendations.push(`The fastest option is only $${priceDiff.toFixed(0)} more than the cheapest.`);
      }
    }

    // Airline recommendations
    if (analytics.airlines.length > 3) {
      recommendations.push(`${analytics.airlines.length} airlines serve this route. Compare carefully for the best deal.`);
    }

    // Preference-based recommendations
    if (preferences?.preferredAirlines && preferences.preferredAirlines.length > 0) {
      const preferredAvailable = analytics.airlines.some(a => 
        preferences.preferredAirlines.includes(a.code)
      );
      if (!preferredAvailable) {
        recommendations.push('Your preferred airlines don\'t serve this route directly.');
      }
    }

    // Historical price recommendations
    if (analytics.priceHistory && analytics.priceHistory.length > 0) {
      const historicalPrices = analytics.priceHistory.map(h => h.price);
      const historicalAverage = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
      
      if (analytics.priceRange.min < historicalAverage * 0.9) {
        recommendations.push('Current prices are below historical average - good time to book!');
      } else if (analytics.priceRange.min > historicalAverage * 1.1) {
        recommendations.push('Prices are above average. Consider setting up price alerts.');
      }
    }

    return recommendations;
  }

  /**
   * Save search history
   */
  private async saveSearchHistory(
    userId: string,
    query: FlightSearchQuery,
    resultsCount: number,
    lowestPrice?: number
  ): Promise<void> {
    try {
      const history: FlightSearchHistory = {
        id: uuidv4(),
        userId,
        searchQuery: query,
        resultsCount,
        lowestPrice,
        currency: query.currencyCode,
        searchedAt: new Date().toISOString(),
      };

      const key = `search-history:${userId}`;
      const result = await this.redisClient.get(key);
      
      let histories: FlightSearchHistory[] = [];
      if (isOk(result) && result.value) {
        histories = JSON.parse(result.value);
      }

      // Keep only last 100 searches
      histories.unshift(history);
      if (histories.length > 100) {
        histories = histories.slice(0, 100);
      }

      await this.redisClient.set(key, JSON.stringify(histories));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  /**
   * Get price history for a route
   */
  private async getPriceHistory(
    origin: string,
    destination: string,
    date: string
  ): Promise<FlightPriceHistory[]> {
    try {
      const key = `route-price-history:${origin}-${destination}`;
      const result = await this.redisClient.get(key);
      
      if (!isOk(result) || isErr(result)) {
        return [];
      }

      const allHistory: FlightPriceHistory[] = JSON.parse(result.value);
      
      // Filter by date range (within 30 days)
      const targetDate = new Date(date);
      const thirtyDaysAgo = new Date(targetDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return allHistory.filter(h => {
        const historyDate = new Date(h.flightDate);
        return historyDate >= thirtyDaysAgo && historyDate <= targetDate;
      });
    } catch (error) {
      console.error('Failed to get price history:', error);
      return [];
    }
  }

  /**
   * Store price alert
   */
  private async storePriceAlert(alert: PriceAlert): Promise<void> {
    try {
      const key = `price-alerts:${alert.userId}`;
      const result = await this.redisClient.get(key);
      
      let alerts: PriceAlert[] = [];
      if (isOk(result) && result.value) {
        alerts = JSON.parse(result.value);
      }

      alerts.push(alert);
      
      // Keep only last 50 alerts
      if (alerts.length > 50) {
        alerts = alerts.slice(-50);
      }

      await this.redisClient.set(key, JSON.stringify(alerts));
    } catch (error) {
      console.error('Failed to store price alert:', error);
    }
  }

  /**
   * Update price history for a saved search
   */
  private async updatePriceHistory(savedSearchId: string, price: number): Promise<void> {
    try {
      const key = `price-history:${savedSearchId}`;
      const result = await this.redisClient.get(key);
      
      let history: number[] = [];
      if (isOk(result) && result.value) {
        history = JSON.parse(result.value);
      }

      history.push(price);
      
      // Keep only last 30 prices
      if (history.length > 30) {
        history = history.slice(-30);
      }

      await this.redisClient.set(key, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to update price history:', error);
    }
  }
}

// Export singleton instance
export const flightSearchService = new FlightSearchService();