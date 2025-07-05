/**
 * Frontend types for User Preferences System
 * Matches backend schemas from backend/src/schemas/preferences.ts
 */

export interface NotificationPreferences {
  emailFrequency: 'immediate' | 'daily' | 'weekly' | 'disabled';
  priceAlerts: boolean;
  dealNotifications: boolean;
  marketingEmails: boolean;
  systemUpdates: boolean;
}

export interface SearchPreferences {
  defaultDepartureAirport?: string;
  defaultArrivalAirport?: string;
  preferredCabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  preferredAirlines: string[];
  maxStops: number;
  flexibleDates: boolean;
  budgetRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface DisplayPreferences {
  currency: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  language: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  compactView: boolean;
}

export interface UserPreferences {
  userId: string;
  notifications: NotificationPreferences;
  search: SearchPreferences;
  display: DisplayPreferences;
  lastUpdated: string;
}

export interface UserPreferencesUpdate {
  notifications?: Partial<NotificationPreferences>;
  search?: Partial<SearchPreferences>;
  display?: Partial<DisplayPreferences>;
}

export interface PreferencesApiResponse {
  success: boolean;
  data?: UserPreferences;
  error?: string;
}

export interface PreferencesResetResponse {
  success: boolean;
  data?: UserPreferences;
  message: string;
}

// Default preferences factory (matches backend createDefaultPreferences)
export const createDefaultPreferences = (userId: string): UserPreferences => ({
  userId,
  notifications: {
    emailFrequency: 'daily',
    priceAlerts: true,
    dealNotifications: true,
    marketingEmails: false,
    systemUpdates: true,
  },
  search: {
    preferredCabinClass: 'economy',
    preferredAirlines: [],
    maxStops: 2,
    flexibleDates: false,
  },
  display: {
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: 'system',
    compactView: false,
  },
  lastUpdated: new Date().toISOString(),
});