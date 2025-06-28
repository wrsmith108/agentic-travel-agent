/**
 * Flight-related schemas and types for the travel agent application
 * Includes validation schemas, interfaces, and type definitions
 */

import { z } from 'zod';

// IATA code validation (3 uppercase letters)
export const IATACodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Must be a valid 3-letter IATA code');

// Date validation in YYYY-MM-DD format with valid date check
export const FlightDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((date) => {
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.getFullYear() === year && 
           dateObj.getMonth() === month - 1 && 
           dateObj.getDate() === day;
  }, 'Invalid date');

// Time validation in HH:MM format with valid time check
export const FlightTimeSchema = z.string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
  .refine((time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }, 'Invalid time');

// Currency code validation (3 uppercase letters)
export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Must be a valid 3-letter currency code');

/**
 * Flight segment schema - represents one leg of a journey
 */
export const FlightSegmentSchema = z.object({
  departure: z.object({
    iataCode: IATACodeSchema,
    terminal: z.string().optional(),
    at: z.string(), // ISO 8601 datetime
  }),
  arrival: z.object({
    iataCode: IATACodeSchema,
    terminal: z.string().optional(),
    at: z.string(), // ISO 8601 datetime
  }),
  carrierCode: z.string().min(2).max(3),
  number: z.string(),
  aircraft: z.object({
    code: z.string(),
  }).optional(),
  operating: z.object({
    carrierCode: z.string(),
  }).optional(),
  duration: z.string(), // ISO 8601 duration
  id: z.string(),
  numberOfStops: z.number().int().min(0),
  blacklistedInEU: z.boolean().optional(),
});

/**
 * Flight itinerary schema - collection of segments
 */
export const FlightItinerarySchema = z.object({
  duration: z.string(), // ISO 8601 duration
  segments: z.array(FlightSegmentSchema).min(1),
});

/**
 * Price schema with detailed breakdown
 */
export const PriceSchema = z.object({
  currency: CurrencyCodeSchema,
  total: z.string(), // String to preserve decimal precision
  base: z.string().optional(),
  fees: z.array(z.object({
    amount: z.string(),
    type: z.string(),
  })).optional(),
  grandTotal: z.string(),
});

/**
 * Traveler pricing schema
 */
export const TravelerPricingSchema = z.object({
  travelerId: z.string(),
  fareOption: z.enum(['STANDARD', 'FLEX']),
  travelerType: z.enum(['ADULT', 'CHILD', 'INFANT']),
  price: PriceSchema,
  fareDetailsBySegment: z.array(z.object({
    segmentId: z.string(),
    cabin: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']),
    fareBasis: z.string().optional(),
    class: z.string().optional(),
    includedCheckedBags: z.object({
      quantity: z.number().int().min(0),
    }).optional(),
  })),
});

/**
 * Flight offer schema - complete flight option with pricing
 */
export const FlightOfferSchema = z.object({
  id: z.string(),
  source: z.string(),
  instantTicketingRequired: z.boolean(),
  nonHomogeneous: z.boolean(),
  oneWay: z.boolean(),
  lastTicketingDate: FlightDateSchema,
  numberOfBookableSeats: z.number().int().min(1),
  itineraries: z.array(FlightItinerarySchema).min(1).max(2), // Max 2 for round trip
  price: PriceSchema,
  pricingOptions: z.object({
    fareType: z.array(z.string()),
    includedCheckedBagsOnly: z.boolean(),
  }),
  validatingAirlineCodes: z.array(z.string()),
  travelerPricings: z.array(TravelerPricingSchema),
});

/**
 * Search query schema for flight searches
 */
export const FlightSearchQuerySchema = z.object({
  originLocationCode: IATACodeSchema,
  destinationLocationCode: IATACodeSchema,
  departureDate: FlightDateSchema,
  returnDate: FlightDateSchema.optional(),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  infants: z.number().int().min(0).max(8).default(0),
  travelClass: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).optional(),
  includedAirlineCodes: z.array(z.string()).optional(),
  excludedAirlineCodes: z.array(z.string()).optional(),
  nonStop: z.boolean().optional(),
  currencyCode: CurrencyCodeSchema.optional(),
  maxPrice: z.number().positive().optional(),
  max: z.number().int().min(1).max(250).default(20),
});

/**
 * Advanced search options schema
 */
export const AdvancedSearchOptionsSchema = z.object({
  flexibleDates: z.object({
    enabled: z.boolean(),
    daysBefore: z.number().int().min(0).max(3),
    daysAfter: z.number().int().min(0).max(3),
  }).optional(),
  multiCity: z.array(z.object({
    originLocationCode: IATACodeSchema,
    destinationLocationCode: IATACodeSchema,
    departureDate: FlightDateSchema,
  })).min(2).max(6).optional(),
  priceRange: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
  }).optional(),
  departureTimeRange: z.object({
    earliest: FlightTimeSchema,
    latest: FlightTimeSchema,
  }).optional(),
  arrivalTimeRange: z.object({
    earliest: FlightTimeSchema,
    latest: FlightTimeSchema,
  }).optional(),
  connectionTimeRange: z.object({
    min: z.number().int().min(30), // minutes
    max: z.number().int().max(1440), // 24 hours
  }).optional(),
});

/**
 * Natural language search query schema
 */
export const NaturalLanguageSearchSchema = z.object({
  query: z.string().min(1).max(500),
  sessionId: z.string().uuid().optional(),
  context: z.object({
    previousSearches: z.array(FlightSearchQuerySchema).optional(),
    userPreferences: z.object({
      preferredAirlines: z.array(z.string()).optional(),
      preferredCabin: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).optional(),
      maxStops: z.number().int().min(0).max(3).optional(),
    }).optional(),
  }).optional(),
});

/**
 * Saved search schema
 */
export const SavedSearchSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  searchQuery: FlightSearchQuerySchema,
  advancedOptions: AdvancedSearchOptionsSchema.optional(),
  priceAlerts: z.object({
    enabled: z.boolean(),
    targetPrice: z.number().positive().optional(),
    percentDrop: z.number().min(1).max(100).optional(),
  }).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastCheckedAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Price alert schema
 */
export const PriceAlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  savedSearchId: z.string().uuid(),
  triggerType: z.enum(['PRICE_DROP', 'TARGET_PRICE', 'AVAILABILITY']),
  triggerValue: z.number().positive().optional(),
  flightOffer: FlightOfferSchema,
  previousPrice: z.number().positive(),
  currentPrice: z.number().positive(),
  priceDifference: z.number(),
  percentChange: z.number(),
  alertedAt: z.string().datetime(),
  isRead: z.boolean().default(false),
  expiresAt: z.string().datetime(),
});

/**
 * Flight booking schema
 */
export const FlightBookingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  flightOfferId: z.string(),
  bookingReference: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED']),
  travelers: z.array(z.object({
    id: z.string(),
    dateOfBirth: FlightDateSchema,
    name: z.object({
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
    }),
    gender: z.enum(['MALE', 'FEMALE']),
    contact: z.object({
      emailAddress: z.string().email(),
      phones: z.array(z.object({
        deviceType: z.enum(['MOBILE', 'LANDLINE']),
        countryCallingCode: z.string(),
        number: z.string(),
      })).min(1),
    }),
    documents: z.array(z.object({
      documentType: z.enum(['PASSPORT', 'ID_CARD']),
      number: z.string(),
      expiryDate: FlightDateSchema,
      issuanceCountry: z.string().length(2),
      nationality: z.string().length(2),
      holder: z.boolean(),
    })).optional(),
  })).min(1),
  price: PriceSchema,
  payment: z.object({
    method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL']),
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']),
    transactionId: z.string().optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Type exports
export type FlightSegment = z.infer<typeof FlightSegmentSchema>;
export type FlightItinerary = z.infer<typeof FlightItinerarySchema>;
export type Price = z.infer<typeof PriceSchema>;
export type TravelerPricing = z.infer<typeof TravelerPricingSchema>;
export type FlightOffer = z.infer<typeof FlightOfferSchema>;
export type FlightSearchQuery = z.infer<typeof FlightSearchQuerySchema>;
export type AdvancedSearchOptions = z.infer<typeof AdvancedSearchOptionsSchema>;
export type NaturalLanguageSearch = z.infer<typeof NaturalLanguageSearchSchema>;
export type SavedSearch = z.infer<typeof SavedSearchSchema>;
export type PriceAlert = z.infer<typeof PriceAlertSchema>;
export type FlightBooking = z.infer<typeof FlightBookingSchema>;

// Validation functions
export const validateFlightSearchQuery = (data: unknown): FlightSearchQuery => {
  return FlightSearchQuerySchema.parse(data);
};

export const validateNaturalLanguageSearch = (data: unknown): NaturalLanguageSearch => {
  return NaturalLanguageSearchSchema.parse(data);
};

export const validateSavedSearch = (data: unknown): SavedSearch => {
  return SavedSearchSchema.parse(data);
};

export const validateFlightBooking = (data: unknown): FlightBooking => {
  return FlightBookingSchema.parse(data);
};