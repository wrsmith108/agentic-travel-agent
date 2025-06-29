/**
 * Flight-related data models for storage operations
 * Extends the schemas with storage-specific functionality
 */

import { v4 as uuidv4 } from 'uuid';
import { createTimestamp } from '@/services/auth/functional/types';
import { 
  SavedSearch, 
  PriceAlert, 
  FlightBooking, 
  FlightSearchQuery,
  AdvancedSearchOptions,
  FlightOffer,
  Price
} from '../schemas/flight';

/**
 * Saved search creation data
 */
export interface CreateSavedSearchData {
  userId: string;
  name: string;
  searchQuery: FlightSearchQuery;
  advancedOptions?: AdvancedSearchOptions;
  priceAlerts?: {
    enabled: boolean;
    targetPrice?: number;
    percentDrop?: number;
  };
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  expiresAt?: string;
}

/**
 * Saved search update data
 */
export interface UpdateSavedSearchData {
  name?: string;
  searchQuery?: FlightSearchQuery;
  advancedOptions?: AdvancedSearchOptions;
  priceAlerts?: {
    enabled: boolean;
    targetPrice?: number;
    percentDrop?: number;
  };
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  expiresAt?: string;
  isActive?: boolean;
}

/**
 * Price alert creation data
 */
export interface CreatePriceAlertData {
  userId: string;
  savedSearchId: string;
  triggerType: 'PRICE_DROP' | 'TARGET_PRICE' | 'AVAILABILITY';
  triggerValue?: number;
  flightOffer: FlightOffer;
  previousPrice: number;
  currentPrice: number;
}

/**
 * Flight booking creation data
 */
export interface CreateFlightBookingData {
  userId: string;
  flightOfferId: string;
  travelers: FlightBooking['travelers'];
  price: Price;
}

/**
 * Flight search history entry
 */
export interface FlightSearchHistory {
  id: string;
  userId: string;
  searchQuery: FlightSearchQuery;
  advancedOptions?: AdvancedSearchOptions;
  resultsCount: number;
  lowestPrice?: number;
  currency?: string;
  searchedAt: string;
  sessionId?: string;
}

/**
 * User flight preferences
 */
export interface UserFlightPreferences {
  userId: string;
  preferredAirlines: string[];
  avoidAirlines: string[];
  preferredCabin: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  maxStops: number;
  preferredDepartureTime: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'ANY';
  preferredArrivalTime: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'ANY';
  budgetRange?: {
    min: number;
    max: number;
    currency: string;
  };
  mealPreferences?: string[];
  seatPreferences?: {
    position: 'WINDOW' | 'AISLE' | 'MIDDLE' | 'ANY';
    location: 'FRONT' | 'MIDDLE' | 'BACK' | 'ANY';
  };
  baggagePreferences?: {
    carryOnOnly: boolean;
    minimumCheckedBags: number;
  };
  updatedAt: string;
}

/**
 * Flight price history for tracking
 */
export interface FlightPriceHistory {
  id: string;
  route: {
    origin: string;
    destination: string;
  };
  flightDate: string;
  price: number;
  currency: string;
  airline: string;
  cabin: string;
  recordedAt: string;
}

/**
 * Helper function to create a saved search
 */
export function createSavedSearch(data: CreateSavedSearchData): SavedSearch {
  const now = createTimestamp();
  return {
    id: uuidv4(),
    userId: data.userId,
    name: data.name,
    searchQuery: data.searchQuery,
    advancedOptions: data.advancedOptions,
    priceAlerts: data.priceAlerts,
    frequency: data.frequency,
    expiresAt: data.expiresAt,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
}

/**
 * Helper function to update a saved search
 */
export function updateSavedSearch(existing: SavedSearch, updates: UpdateSavedSearchData): SavedSearch {
  return {
    ...existing,
    ...updates,
    searchQuery: updates.searchQuery || existing.searchQuery,
    updatedAt: createTimestamp(),
  };
}

/**
 * Helper function to create a price alert
 */
export function createPriceAlert(data: CreatePriceAlertData): PriceAlert {
  const priceDifference = data.currentPrice - data.previousPrice;
  const percentChange = (priceDifference / data.previousPrice) * 100;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours

  return {
    id: uuidv4(),
    userId: data.userId,
    savedSearchId: data.savedSearchId,
    triggerType: data.triggerType,
    triggerValue: data.triggerValue,
    flightOffer: data.flightOffer,
    previousPrice: data.previousPrice,
    currentPrice: data.currentPrice,
    priceDifference,
    percentChange,
    alertedAt: now as string,
    isRead: false,
    expiresAt: expiresAt,
  };
}

/**
 * Helper function to create a flight booking
 */
export function createFlightBooking(data: CreateFlightBookingData): FlightBooking {
  const now = createTimestamp();
  return {
    id: uuidv4(),
    userId: data.userId,
    flightOfferId: data.flightOfferId,
    status: 'PENDING',
    travelers: data.travelers,
    price: data.price,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Helper function to check if a saved search should trigger a price alert
 */
export function shouldTriggerPriceAlert(
  savedSearch: SavedSearch,
  currentPrice: number,
  previousPrice?: number
): { trigger: boolean; type?: 'PRICE_DROP' | 'TARGET_PRICE' } {
  if (!savedSearch.priceAlerts?.enabled) {
    return { trigger: false };
  }

  // Check target price
  if (savedSearch.priceAlerts.targetPrice && currentPrice <= savedSearch.priceAlerts.targetPrice) {
    return { trigger: true, type: 'TARGET_PRICE' };
  }

  // Check percentage drop
  if (previousPrice && savedSearch.priceAlerts.percentDrop) {
    const percentChange = ((previousPrice - currentPrice) / previousPrice) * 100;
    if (percentChange >= savedSearch.priceAlerts.percentDrop) {
      return { trigger: true, type: 'PRICE_DROP' };
    }
  }

  return { trigger: false };
}

/**
 * Helper function to group flights by similar characteristics for price comparison
 */
export function groupFlightsByCharacteristics(flights: FlightOffer[]): Map<string, FlightOffer[]> {
  const groups = new Map<string, FlightOffer[]>();

  flights.forEach(flight => {
    const firstItinerary = flight.itineraries[0];
    const firstSegment = firstItinerary.segments[0];
    const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];

    // Create a key based on route, airline, and number of stops
    const key = `${firstSegment.departure.iataCode}-${lastSegment.arrival.iataCode}-${firstSegment.carrierCode}-${firstItinerary.segments.length - 1}stops`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(flight);
  });

  return groups;
}

/**
 * Helper function to calculate price statistics for a route
 */
export function calculatePriceStatistics(prices: number[]): {
  min: number;
  max: number;
  average: number;
  median: number;
  percentile25: number;
  percentile75: number;
} {
  if (prices.length === 0) {
    return { min: 0, max: 0, average: 0, median: 0, percentile25: 0, percentile75: 0 };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, price) => acc + price, 0);

  const getPercentile = (p: number) => {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  };

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: sum / sorted.length,
    median: getPercentile(0.5),
    percentile25: getPercentile(0.25),
    percentile75: getPercentile(0.75),
  };
}

/**
 * Time period helpers for departure/arrival preferences
 */
export function getTimePeriod(time: string): 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' {
  const hour = parseInt(time.split(':')[0]);
  
  if (hour >= 6 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 18) return 'AFTERNOON';
  if (hour >= 18 && hour < 22) return 'EVENING';
  return 'NIGHT';
}

/**
 * Helper to check if a flight matches user preferences
 */
export function matchesUserPreferences(
  flight: FlightOffer,
  preferences: UserFlightPreferences
): { matches: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;

  const firstSegment = flight.itineraries[0].segments[0];
  const cabin = flight.travelerPricings[0].fareDetailsBySegment[0].cabin;

  // Check airline preferences
  if (preferences.avoidAirlines.includes(firstSegment.carrierCode)) {
    return { matches: false, score: 0, reasons: ['Airline is in avoid list'] };
  }

  if (preferences.preferredAirlines.length > 0 && 
      !preferences.preferredAirlines.includes(firstSegment.carrierCode)) {
    score -= 20;
    reasons.push('Not a preferred airline');
  }

  // Check cabin class
  if (cabin !== preferences.preferredCabin) {
    score -= 15;
    reasons.push('Different cabin class');
  }

  // Check number of stops
  const totalStops = flight.itineraries.reduce((sum, itin) => 
    sum + itin.segments.reduce((segSum, seg) => segSum + seg.numberOfStops, 0), 0
  );
  
  if (totalStops > preferences.maxStops) {
    return { matches: false, score: 0, reasons: ['Too many stops'] };
  }

  // Check budget
  if (preferences.budgetRange) {
    const price = parseFloat(flight.price.grandTotal);
    if (price < preferences.budgetRange.min || price > preferences.budgetRange.max) {
      score -= 30;
      reasons.push('Outside budget range');
    }
  }

  return { matches: score >= 50, score, reasons };
}