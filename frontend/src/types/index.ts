// Main types export file

// Flight types
export type {
  FlightSearchRequest,
  FlightOption,
  FlightSearchResponse,
  FlightDetails,
  FlightSegment,
  Airport,
  BaggageInfo,
  FlightPolicies
} from './flight';

// Search types
export type {
  SavedSearch,
  SavedSearchRequest,
  SavedSearchResponse,
  SearchHistory
} from './search';

// Price Alert types
export type {
  PriceAlert,
  PriceAlertRequest,
  PriceAlertResponse,
  PriceUpdate
} from './priceAlert';

// Common UI types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterOptions {
  dateRange?: {
    start: string;
    end: string;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  airlines?: string[];
  stops?: number[];
}

// Chat types (existing functionality)
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
  sessionId?: string;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}