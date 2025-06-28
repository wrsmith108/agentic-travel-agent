/**
 * Enhanced Amadeus Flight Search Service
 * Advanced integration with Amadeus API for comprehensive flight operations
 */

import Amadeus from 'amadeus';
import { Result, ok, err, isOk, isErr } from '../../utils/result';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import {
  FlightOffer,
  FlightSearchQuery,
  AdvancedSearchOptions,
  FlightOfferSchema,
  FlightSegment,
  Price,
} from '../../schemas/flight';
import { getRedisClient } from '../redis/redisClient';

// Cache configuration
const CACHE_TTL = {
  SEARCH_RESULTS: 5 * 60, // 5 minutes
  PRICE_CONFIRMATION: 2 * 60, // 2 minutes
  AIRPORT_DATA: 24 * 60 * 60, // 24 hours
  AIRLINE_DATA: 7 * 24 * 60 * 60, // 7 days
};

// Rate limiting configuration
const RATE_LIMITS = {
  SEARCH_PER_MINUTE: 30,
  PRICE_CONFIRM_PER_MINUTE: 20,
  BOOKING_PER_MINUTE: 10,
};

interface AmadeusError {
  response?: {
    statusCode: number;
    result?: {
      errors?: Array<{
        code: string;
        title: string;
        detail: string;
        source?: any;
      }>;
    };
  };
  message?: string;
  code?: string;
}

export class EnhancedAmadeusService {
  private amadeus: any;
  private redisClient: ReturnType<typeof getRedisClient>;
  private rateLimitCounters: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.amadeus = new Amadeus({
      clientId: env.AMADEUS_CLIENT_ID || '',
      clientSecret: env.AMADEUS_CLIENT_SECRET || '',
      hostname: env.AMADEUS_ENVIRONMENT === 'production' 
        ? 'api.amadeus.com' 
        : 'test.api.amadeus.com',
    });

    this.redisClient = getRedisClient();
    this.rateLimitCounters = new Map();
  }

  /**
   * Advanced flight search with caching and flexible options
   */
  async searchFlights(
    query: FlightSearchQuery,
    advancedOptions?: AdvancedSearchOptions
  ): Promise<Result<FlightOffer[], AppError>> {
    try {
      // Check rate limit
      const rateLimitCheck = await this.checkRateLimit('search');
      if (!isOk(rateLimitCheck)) {
        return err(rateLimitCheck.error);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey('search', query, advancedOptions);
      const cachedResult = await this.getFromCache(cacheKey);
      if (cachedResult) {
        return ok(cachedResult);
      }

      // Handle flexible dates if requested
      if (advancedOptions?.flexibleDates?.enabled) {
        return await this.searchFlexibleDates(query, advancedOptions.flexibleDates);
      }

      // Handle multi-city if requested
      if (advancedOptions?.multiCity && advancedOptions.multiCity.length > 0) {
        return await this.searchMultiCity(advancedOptions.multiCity);
      }

      // Build standard search parameters
      const params = this.buildSearchParams(query, advancedOptions);

      // Call Amadeus API
      const response = await this.amadeus.shopping.flightOffersSearch.get(params);

      if (!response.data || response.data.length === 0) {
        return ok([]);
      }

      // Validate and parse response
      const validatedOffers = this.validateFlightOffers(response.data);
      
      // Apply additional filters
      const filteredOffers = this.applyAdvancedFilters(validatedOffers, advancedOptions);

      // Cache results
      await this.setCache(cacheKey, filteredOffers, CACHE_TTL.SEARCH_RESULTS);

      return ok(filteredOffers);
    } catch (error) {
      return this.handleAmadeusError(error as AmadeusError, 'Flight search failed');
    }
  }

  /**
   * Search with flexible dates
   */
  private async searchFlexibleDates(
    baseQuery: FlightSearchQuery,
    flexOptions: { daysBefore: number; daysAfter: number }
  ): Promise<Result<FlightOffer[], AppError>> {
    try {
      const allSearches: Promise<Result<FlightOffer[], AppError>>[] = [];
      const baseDate = new Date(baseQuery.departureDate);

      // Generate date range
      for (let i = -flexOptions.daysBefore; i <= flexOptions.daysAfter; i++) {
        const searchDate = new Date(baseDate);
        searchDate.setDate(searchDate.getDate() + i);
        
        const modifiedQuery = {
          ...baseQuery,
          departureDate: searchDate.toISOString().split('T')[0],
        };

        allSearches.push(this.searchFlights(modifiedQuery));
      }

      // Execute all searches in parallel
      const results = await Promise.all(allSearches);
      
      // Combine and deduplicate results
      const allOffers: FlightOffer[] = [];
      for (const result of results) {
        if (result.ok && result.value) {
          allOffers.push(...result.value);
        }
      }

      // Sort by price and return unique offers
      const uniqueOffers = this.deduplicateOffers(allOffers);
      return ok(uniqueOffers.sort((a, b) => 
        parseFloat(a.price.grandTotal) - parseFloat(b.price.grandTotal)
      ));
    } catch (error) {
      return err(new AppError(500, 'Flexible date search failed', ErrorCodes.EXTERNAL_SERVICE_ERROR));
    }
  }

  /**
   * Multi-city flight search
   */
  private async searchMultiCity(
    segments: Array<{ originLocationCode: string; destinationLocationCode: string; departureDate: string }>
  ): Promise<Result<FlightOffer[], AppError>> {
    try {
      // Build multi-city search parameters
      const params = {
        originDestinations: segments.map((seg, index) => ({
          id: String(index + 1),
          originLocationCode: seg.originLocationCode,
          destinationLocationCode: seg.destinationLocationCode,
          departureDateTimeRange: {
            date: seg.departureDate,
          },
        })),
        travelers: [{
          id: '1',
          travelerType: 'ADULT',
        }],
        sources: ['GDS'],
        searchCriteria: {
          maxFlightOffers: 50,
        },
      };

      const response = await this.amadeus.shopping.flightOffersSearch.post(JSON.stringify(params));

      if (!response.data || response.data.length === 0) {
        return ok([]);
      }

      const validatedOffers = this.validateFlightOffers(response.data);
      return ok(validatedOffers);
    } catch (error) {
      return this.handleAmadeusError(error as AmadeusError, 'Multi-city search failed');
    }
  }

  /**
   * Confirm flight price before booking
   */
  async confirmPrice(flightOffer: FlightOffer): Promise<Result<FlightOffer, AppError>> {
    try {
      // Check rate limit
      const rateLimitCheck = await this.checkRateLimit('price');
      if (!isOk(rateLimitCheck)) {
        return err(rateLimitCheck.error);
      }

      // Check cache
      const cacheKey = `price:${flightOffer.id}`;
      const cachedPrice = await this.getFromCache(cacheKey);
      if (cachedPrice) {
        return ok(cachedPrice);
      }

      const response = await this.amadeus.shopping.flightOffers.pricing.post(
        JSON.stringify({
          data: {
            type: 'flight-offers-pricing',
            flightOffers: [flightOffer],
          },
        })
      );

      if (!response.data?.flightOffers?.[0]) {
        return err(new AppError(404, 'Price confirmation failed', ErrorCodes.NOT_FOUND));
      }

      const confirmedOffer = this.validateFlightOffers([response.data.flightOffers[0]])[0];
      
      // Cache confirmed price
      await this.setCache(cacheKey, confirmedOffer, CACHE_TTL.PRICE_CONFIRMATION);

      return ok(confirmedOffer);
    } catch (error) {
      return this.handleAmadeusError(error as AmadeusError, 'Price confirmation failed');
    }
  }

  /**
   * Create flight booking
   */
  async createBooking(
    flightOffer: FlightOffer,
    travelers: Array<{
      id: string;
      dateOfBirth: string;
      name: { firstName: string; lastName: string };
      gender: 'MALE' | 'FEMALE';
      contact: {
        emailAddress: string;
        phones: Array<{
          deviceType: 'MOBILE' | 'LANDLINE';
          countryCallingCode: string;
          number: string;
        }>;
      };
      documents?: Array<{
        documentType: 'PASSPORT' | 'ID_CARD';
        number: string;
        expiryDate: string;
        issuanceCountry: string;
        nationality: string;
      }>;
    }>
  ): Promise<Result<{ bookingReference: string; booking: any }, AppError>> {
    try {
      // Check rate limit
      const rateLimitCheck = await this.checkRateLimit('booking');
      if (!isOk(rateLimitCheck)) {
        return err(rateLimitCheck.error);
      }

      const bookingData = {
        data: {
          type: 'flight-order',
          flightOffers: [flightOffer],
          travelers,
          remarks: {
            general: [{
              subType: 'GENERAL_MISCELLANEOUS',
              text: 'BOOKING VIA TRAVEL AGENT APP',
            }],
          },
          ticketingAgreement: {
            option: 'DELAY_TO_CANCEL',
            delay: '6D',
          },
          contacts: [{
            addresseeName: {
              firstName: travelers[0].name.firstName,
              lastName: travelers[0].name.lastName,
            },
            companyName: 'TRAVEL AGENT APP',
            purpose: 'STANDARD',
            phones: travelers[0].contact.phones,
            emailAddress: travelers[0].contact.emailAddress,
            address: {
              lines: ['123 Main Street'],
              postalCode: '12345',
              cityName: 'Any City',
              countryCode: 'US',
            },
          }],
        },
      };

      const response = await this.amadeus.booking.flightOrders.post(
        JSON.stringify(bookingData)
      );

      if (!response.data) {
        return err(new AppError(500, 'Booking creation failed', ErrorCodes.EXTERNAL_SERVICE_ERROR));
      }

      return ok({
        bookingReference: response.data.id,
        booking: response.data,
      });
    } catch (error) {
      return this.handleAmadeusError(error as AmadeusError, 'Booking creation failed');
    }
  }

  /**
   * Search airports by keyword
   */
  async searchAirports(keyword: string): Promise<Result<Array<{
    iataCode: string;
    name: string;
    cityName: string;
    countryCode: string;
  }>, AppError>> {
    try {
      // Check cache
      const cacheKey = `airports:${keyword.toLowerCase()}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return ok(cached);
      }

      const response = await this.amadeus.referenceData.locations.get({
        keyword,
        subType: 'AIRPORT,CITY',
        view: 'LIGHT',
      });

      if (!response.data) {
        return ok([]);
      }

      const airports = response.data.map((location: any) => ({
        iataCode: location.iataCode,
        name: location.name,
        cityName: location.address?.cityName || '',
        countryCode: location.address?.countryCode || '',
      }));

      // Cache results
      await this.setCache(cacheKey, airports, CACHE_TTL.AIRPORT_DATA);

      return ok(airports);
    } catch (error) {
      return this.handleAmadeusError(error as AmadeusError, 'Airport search failed');
    }
  }

  /**
   * Get airline information
   */
  async getAirlineInfo(airlineCode: string): Promise<Result<{
    code: string;
    name: string;
    logoUrl?: string;
  }, AppError>> {
    try {
      // Check cache
      const cacheKey = `airline:${airlineCode}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return ok(cached);
      }

      const response = await this.amadeus.referenceData.airlines.get({
        airlineCodes: airlineCode,
      });

      if (!response.data || response.data.length === 0) {
        return err(new AppError(404, 'Airline not found', ErrorCodes.NOT_FOUND));
      }

      const airline = {
        code: response.data[0].iataCode,
        name: response.data[0].businessName,
        logoUrl: `https://pics.avs.io/100/100/${airlineCode}.png`,
      };

      // Cache results
      await this.setCache(cacheKey, airline, CACHE_TTL.AIRLINE_DATA);

      return ok(airline);
    } catch (error) {
      return this.handleAmadeusError(error as AmadeusError, 'Airline info fetch failed');
    }
  }

  /**
   * Build search parameters from query and advanced options
   */
  private buildSearchParams(query: FlightSearchQuery, advancedOptions?: AdvancedSearchOptions): any {
    const params: any = {
      originLocationCode: query.originLocationCode,
      destinationLocationCode: query.destinationLocationCode,
      departureDate: query.departureDate,
      adults: query.adults,
      currencyCode: query.currencyCode,
      max: query.max,
    };

    // Add optional parameters
    if (query.returnDate) params.returnDate = query.returnDate;
    if (query.children > 0) params.children = query.children;
    if (query.infants > 0) params.infants = query.infants;
    if (query.travelClass) params.travelClass = query.travelClass;
    if (query.nonStop) params.nonStop = true;
    if (query.maxPrice) params.maxPrice = query.maxPrice;
    if (query.includedAirlineCodes) params.includedAirlineCodes = query.includedAirlineCodes.join(',');
    if (query.excludedAirlineCodes) params.excludedAirlineCodes = query.excludedAirlineCodes.join(',');

    // Add time preferences
    if (advancedOptions?.departureTimeRange) {
      params.departureTime = `${advancedOptions.departureTimeRange.earliest}-${advancedOptions.departureTimeRange.latest}`;
    }
    if (advancedOptions?.arrivalTimeRange) {
      params.arrivalTime = `${advancedOptions.arrivalTimeRange.earliest}-${advancedOptions.arrivalTimeRange.latest}`;
    }

    return params;
  }

  /**
   * Apply advanced filters to flight offers
   */
  private applyAdvancedFilters(
    offers: FlightOffer[], 
    advancedOptions?: AdvancedSearchOptions
  ): FlightOffer[] {
    if (!advancedOptions) return offers;

    return offers.filter(offer => {
      // Filter by price range
      if (advancedOptions.priceRange) {
        const price = parseFloat(offer.price.grandTotal);
        if (price < advancedOptions.priceRange.min || price > advancedOptions.priceRange.max) {
          return false;
        }
      }

      // Filter by connection time
      if (advancedOptions.connectionTimeRange) {
        for (const itinerary of offer.itineraries) {
          for (let i = 0; i < itinerary.segments.length - 1; i++) {
            const arrivalTime = new Date(itinerary.segments[i].arrival.at);
            const departureTime = new Date(itinerary.segments[i + 1].departure.at);
            const connectionMinutes = (departureTime.getTime() - arrivalTime.getTime()) / 60000;
            
            if (connectionMinutes < advancedOptions.connectionTimeRange.min ||
                connectionMinutes > advancedOptions.connectionTimeRange.max) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }

  /**
   * Validate flight offers against schema
   */
  private validateFlightOffers(data: any[]): FlightOffer[] {
    const validated: FlightOffer[] = [];
    
    for (const offer of data) {
      try {
        const validatedOffer = FlightOfferSchema.parse(offer);
        validated.push(validatedOffer);
      } catch (error) {
        console.warn('Invalid flight offer skipped:', error);
      }
    }

    return validated;
  }

  /**
   * Deduplicate flight offers
   */
  private deduplicateOffers(offers: FlightOffer[]): FlightOffer[] {
    const seen = new Set<string>();
    return offers.filter(offer => {
      const key = `${offer.itineraries.map(i => 
        i.segments.map(s => 
          `${s.carrierCode}${s.number}-${s.departure.iataCode}-${s.arrival.iataCode}`
        ).join('-')
      ).join('|')}`;
      
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(prefix: string, ...params: any[]): string {
    const paramString = JSON.stringify(params);
    return `amadeus:${prefix}:${Buffer.from(paramString).toString('base64')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<any | null> {
    try {
      const result = await this.redisClient.get(key);
      if (result.ok && result.value) {
        return JSON.parse(result.value);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: any, ttl: number): Promise<void> {
    try {
      await this.redisClient.set(key, JSON.stringify(data), ttl);
    } catch (error) {
      console.warn('Cache set failed:', error);
    }
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(operation: 'search' | 'price' | 'booking'): Promise<Result<void, AppError>> {
    const limits = {
      search: RATE_LIMITS.SEARCH_PER_MINUTE,
      price: RATE_LIMITS.PRICE_CONFIRM_PER_MINUTE,
      booking: RATE_LIMITS.BOOKING_PER_MINUTE,
    };

    const now = Date.now();
    const counter = this.rateLimitCounters.get(operation) || { count: 0, resetTime: now + 60000 };

    if (now > counter.resetTime) {
      counter.count = 0;
      counter.resetTime = now + 60000;
    }

    if (counter.count >= limits[operation]) {
      return err(new AppError(429, 'Rate limit exceeded. Please try again later.', ErrorCodes.RATE_LIMIT_EXCEEDED));
    }

    counter.count++;
    this.rateLimitCounters.set(operation, counter);

    return ok(undefined);
  }

  /**
   * Handle Amadeus API errors
   */
  private handleAmadeusError(error: AmadeusError, defaultMessage: string): Result<any, AppError> {
    console.error('Amadeus API error:', error);

    if (error.response?.statusCode === 401) {
      return err(new AppError(401, 'Authentication with flight service failed', ErrorCodes.UNAUTHORIZED));
    }

    if (error.response?.statusCode === 429) {
      return err(new AppError(429, 'Too many requests to flight service', ErrorCodes.RATE_LIMIT_EXCEEDED));
    }

    if (error.response?.statusCode === 400) {
      const errorDetail = error.response.result?.errors?.[0];
      return err(new AppError(
        400, 
        errorDetail?.detail || 'Invalid flight search parameters',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    if (error.response?.statusCode === 404) {
      return err(new AppError(404, 'Flight not found', ErrorCodes.NOT_FOUND));
    }

    return err(new AppError(
      500,
      error.message || defaultMessage,
      ErrorCodes.EXTERNAL_SERVICE_ERROR
    ));
  }
}

// Export singleton instance
export const enhancedAmadeusService = new EnhancedAmadeusService();