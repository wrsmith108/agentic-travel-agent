/**
 * User Preferences Schemas
 * Handles validation for user notification, search, and display preferences
 */

import { z } from 'zod';

/**
 * Notification frequency options
 */
export const NotificationFrequencySchema = z.enum([
  'INSTANT',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'NEVER'
]);

/**
 * Price alert threshold types
 */
export const PriceAlertTypeSchema = z.enum([
  'PERCENTAGE',
  'FIXED_AMOUNT'
]);

/**
 * Notification preferences
 */
export const NotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().default(true),
  frequency: NotificationFrequencySchema.default('INSTANT'),
  priceAlerts: z.object({
    enabled: z.boolean().default(true),
    thresholdType: PriceAlertTypeSchema.default('PERCENTAGE'),
    thresholdValue: z.number().min(0).max(100).default(10), // 10% or $10
    onlyPriceDrops: z.boolean().default(true),
  }),
  searchExpiration: z.object({
    enabled: z.boolean().default(true),
    daysBeforeExpiry: z.number().min(1).max(30).default(7),
  }),
  marketing: z.object({
    enabled: z.boolean().default(false),
    deals: z.boolean().default(false),
    newsletter: z.boolean().default(false),
  }),
});

/**
 * Cabin class preferences
 */
export const CabinClassSchema = z.enum([
  'ECONOMY',
  'PREMIUM_ECONOMY',
  'BUSINESS',
  'FIRST'
]);

/**
 * Search preferences
 */
export const SearchPreferencesSchema = z.object({
  defaultCabinClass: CabinClassSchema.default('ECONOMY'),
  preferredAirlines: z.array(z.string().length(2)).max(10).default([]),
  excludedAirlines: z.array(z.string().length(2)).max(10).default([]),
  maxStops: z.number().min(0).max(3).default(1),
  includeBudgetAirlines: z.boolean().default(true),
  flexibleDates: z.object({
    enabled: z.boolean().default(false),
    daysBefore: z.number().min(0).max(7).default(3),
    daysAfter: z.number().min(0).max(7).default(3),
  }),
  preferredDepartureTime: z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  }).optional(),
  baggageIncluded: z.boolean().default(false),
});

/**
 * Display preferences
 */
export const DisplayPreferencesSchema = z.object({
  currency: z.string().length(3).toUpperCase().default('USD'),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).default('MM/DD/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  temperatureUnit: z.enum(['celsius', 'fahrenheit']).default('fahrenheit'),
  distanceUnit: z.enum(['miles', 'kilometers']).default('miles'),
  language: z.string().length(2).toLowerCase().default('en'),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
});

/**
 * Complete user preferences schema
 */
export const UserPreferencesSchema = z.object({
  userId: z.string().uuid(),
  notifications: NotificationPreferencesSchema,
  search: SearchPreferencesSchema,
  display: DisplayPreferencesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Partial update schema (for PATCH requests)
 */
export const UserPreferencesUpdateSchema = z.object({
  notifications: NotificationPreferencesSchema.partial().optional(),
  search: SearchPreferencesSchema.partial().optional(),
  display: DisplayPreferencesSchema.partial().optional(),
});

// TypeScript types
export type NotificationFrequency = z.infer<typeof NotificationFrequencySchema>;
export type PriceAlertType = z.infer<typeof PriceAlertTypeSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type CabinClass = z.infer<typeof CabinClassSchema>;
export type SearchPreferences = z.infer<typeof SearchPreferencesSchema>;
export type DisplayPreferences = z.infer<typeof DisplayPreferencesSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>;

// Default preferences factory
export const createDefaultPreferences = (userId: string): UserPreferences => {
  const now = new Date().toISOString();
  return {
    userId,
    notifications: NotificationPreferencesSchema.parse({}),
    search: SearchPreferencesSchema.parse({}),
    display: DisplayPreferencesSchema.parse({}),
    createdAt: now,
    updatedAt: now,
  };
};

// Validation helpers
export const validateUserPreferences = (data: unknown): UserPreferences => {
  return UserPreferencesSchema.parse(data);
};

export const validateUserPreferencesUpdate = (data: unknown): UserPreferencesUpdate => {
  return UserPreferencesUpdateSchema.parse(data);
};