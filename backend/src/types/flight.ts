/**
 * Flight search type definitions
 */

import { z } from 'zod';

// Flight search request schema
export const FlightSearchRequestSchema = z.object({
  origin: z.string().length(3, 'Must be a 3-letter IATA airport code').toUpperCase(),
  destination: z.string().length(3, 'Must be a 3-letter IATA airport code').toUpperCase(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format').optional(),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  infants: z.number().int().min(0).max(8).default(0),
  travelClass: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).default('ECONOMY'),
  nonStop: z.boolean().default(false),
  currencyCode: z.string().length(3).default('USD'),
  maxPrice: z.number().positive().optional(),
  maxResults: z.number().int().min(1).max(50).default(10),
});

// Flight segment schema
export const FlightSegmentSchema = z.object({
  departure: z.object({
    iataCode: z.string(),
    terminal: z.string().optional(),
    at: z.string(),
  }),
  arrival: z.object({
    iataCode: z.string(),
    terminal: z.string().optional(),
    at: z.string(),
  }),
  carrierCode: z.string(),
  number: z.string(),
  aircraft: z.object({
    code: z.string(),
  }).optional(),
  operating: z.object({
    carrierCode: z.string(),
  }).optional(),
  duration: z.string(),
  id: z.string(),
  numberOfStops: z.number(),
  blacklistedInEU: z.boolean().optional(),
});

// Itinerary schema
export const ItinerarySchema = z.object({
  duration: z.string(),
  segments: z.array(FlightSegmentSchema),
});

// Price schema
export const PriceSchema = z.object({
  currency: z.string(),
  total: z.string(),
  base: z.string(),
  fees: z.array(z.object({
    amount: z.string(),
    type: z.string(),
  })).optional(),
  grandTotal: z.string(),
  additionalServices: z.array(z.object({
    amount: z.string(),
    type: z.string(),
  })).optional(),
});

// Flight offer schema
export const FlightOfferSchema = z.object({
  type: z.string(),
  id: z.string(),
  source: z.string(),
  instantTicketingRequired: z.boolean(),
  nonHomogeneous: z.boolean(),
  oneWay: z.boolean(),
  lastTicketingDate: z.string().optional(),
  numberOfBookableSeats: z.number(),
  itineraries: z.array(ItinerarySchema),
  price: PriceSchema,
  pricingOptions: z.object({
    fareType: z.array(z.string()),
    includedCheckedBagsOnly: z.boolean(),
  }),
  validatingAirlineCodes: z.array(z.string()),
  travelerPricings: z.array(z.object({
    travelerId: z.string(),
    fareOption: z.string(),
    travelerType: z.string(),
    price: PriceSchema,
    fareDetailsBySegment: z.array(z.object({
      segmentId: z.string(),
      cabin: z.string(),
      fareBasis: z.string(),
      brandedFare: z.string().optional(),
      class: z.string(),
      includedCheckedBags: z.object({
        weight: z.number().optional(),
        weightUnit: z.string().optional(),
        quantity: z.number().optional(),
      }).optional(),
    })),
  })),
});

// Dictionary data schema
export const DictionaryDataSchema = z.object({
  locations: z.record(z.object({
    cityCode: z.string(),
    countryCode: z.string(),
  })).optional(),
  aircraft: z.record(z.string()).optional(),
  currencies: z.record(z.string()).optional(),
  carriers: z.record(z.string()).optional(),
});

// Flight search response schema
export const FlightSearchResponseSchema = z.object({
  meta: z.object({
    count: z.number(),
    links: z.object({
      self: z.string(),
    }).optional(),
  }),
  data: z.array(FlightOfferSchema),
  dictionaries: DictionaryDataSchema.optional(),
});

// Simplified flight data for UI
export const SimplifiedFlightSchema = z.object({
  id: z.string(),
  origin: z.string(),
  destination: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  duration: z.string(),
  stops: z.number(),
  carrier: z.string(),
  carrierName: z.string(),
  price: z.object({
    total: z.number(),
    currency: z.string(),
  }),
  cabin: z.string(),
  bookableSeats: z.number(),
  isReturn: z.boolean().optional(),
  segments: z.array(z.object({
    origin: z.string(),
    destination: z.string(),
    departure: z.string(),
    arrival: z.string(),
    carrier: z.string(),
    flightNumber: z.string(),
    duration: z.string(),
  })),
});

// Error types
export type FlightSearchError = 
  | { type: 'VALIDATION_ERROR'; message: string; details?: any }
  | { type: 'API_ERROR'; message: string; code?: string }
  | { type: 'RATE_LIMIT'; message: string }
  | { type: 'NOT_FOUND'; message: string }
  | { type: 'AUTHENTICATION_ERROR'; message: string }
  | { type: 'SYSTEM_ERROR'; message: string };

// TypeScript types
export type FlightSearchRequest = z.infer<typeof FlightSearchRequestSchema>;
export type FlightSegment = z.infer<typeof FlightSegmentSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type Price = z.infer<typeof PriceSchema>;
export type FlightOffer = z.infer<typeof FlightOfferSchema>;
export type DictionaryData = z.infer<typeof DictionaryDataSchema>;
export type FlightSearchResponse = z.infer<typeof FlightSearchResponseSchema>;
export type SimplifiedFlight = z.infer<typeof SimplifiedFlightSchema>;

// Helper to create flight error
export const createFlightError = (
  type: FlightSearchError['type'],
  message: string,
  details?: any
): FlightSearchError => ({
  type,
  message,
  ...(details && { details }),
});