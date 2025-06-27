import { z } from 'zod';

/**
 * User preferences schema for travel agent settings
 */
export const UserPreferencesSchema = z.object({
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
  timezone: z.string().default('America/Toronto'),
  preferredDepartureAirport: z.string().regex(/^[A-Z]{3}$/, 'Must be valid IATA airport code'),
  communicationFrequency: z.enum(['immediate', 'daily', 'weekly']).default('daily'),
  subscriptionTier: z.enum(['free', 'basic', 'premium', 'enterprise']).default('free'),
});

/**
 * Flight search criteria schema
 */
export const FlightSearchCriteriaSchema = z.object({
  id: z.string().uuid(),
  origin: z.string().regex(/^[A-Z]{3}$/, 'Must be valid IATA airport code'),
  destination: z.string().regex(/^[A-Z]{3}$/, 'Must be valid IATA airport code'),
  departureDate: z.string().datetime(),
  returnDate: z.string().datetime().optional(),
  passengers: z.object({
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(8),
    infants: z.number().int().min(0).max(2),
  }),
  travelClass: z.enum(['economy', 'premium-economy', 'business', 'first']),
  maxPrice: z.number().positive(),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']),
  nonStop: z.boolean().default(false),
});

/**
 * Price data point for historical tracking
 */
export const PriceDataPointSchema = z.object({
  price: z.number().positive(),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']),
  timestamp: z.string().datetime(),
  source: z.string(),
  flightDetails: z.record(z.unknown()).optional(),
});

/**
 * Flight search with monitoring status
 */
export const FlightSearchSchema = z.object({
  id: z.string().uuid(),
  criteria: FlightSearchCriteriaSchema.omit({ id: true }),
  status: z.enum(['active', 'paused', 'completed']).default('active'),
  lastChecked: z.string().datetime().optional(),
  bestPriceFound: z
    .object({
      price: z.number().positive(),
      currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']),
      foundAt: z.string().datetime(),
      flightDetails: z.record(z.unknown()),
    })
    .optional(),
  priceHistory: z.array(PriceDataPointSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Complete user profile schema
 */
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Must be valid email address'),
  passwordHash: z.string().optional(), // Added for persistent authentication
  preferences: UserPreferencesSchema,
  activeSearches: z.array(z.string().uuid()).default([]),
  searchHistory: z.array(FlightSearchSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * User data file schema (what gets stored in JSON)
 */
export const UserDataFileSchema = z.object({
  profile: UserProfileSchema,
  searches: z.record(z.string().uuid(), FlightSearchSchema).default({}),
  version: z.string().default('1.0.0'),
  lastBackup: z.string().datetime().optional(),
  costTracking: z
    .object({
      quota: z.any().optional(), // Complex UserQuota type from costControl schema
      apiCalls: z.array(z.any()).optional(), // Array of APICallRecord
      lastUpdated: z.string().datetime().optional(),
    })
    .optional(),
});

// Export types
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type FlightSearchCriteria = z.infer<typeof FlightSearchCriteriaSchema>;
export type PriceDataPoint = z.infer<typeof PriceDataPointSchema>;
export type FlightSearch = z.infer<typeof FlightSearchSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserDataFile = z.infer<typeof UserDataFileSchema>;

/**
 * Helper type for creating new users (without generated fields)
 */
export type CreateUserProfile = Omit<
  UserProfile,
  'id' | 'createdAt' | 'updatedAt' | 'activeSearches' | 'searchHistory'
> & {
  passwordHash?: string; // Allow passwordHash to be included during creation
};

/**
 * Helper type for updating user profiles
 */
export type UpdateUserProfile = Partial<Omit<UserProfile, 'id' | 'createdAt'>>;

/**
 * Validation helpers
 */
export const validateUserProfile = (data: unknown): UserProfile => {
  return UserProfileSchema.parse(data);
};

export const validateUserDataFile = (data: unknown): UserDataFile => {
  return UserDataFileSchema.parse(data);
};

export const validateFlightSearch = (data: unknown): FlightSearch => {
  return FlightSearchSchema.parse(data);
};
