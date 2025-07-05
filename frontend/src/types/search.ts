// Saved Search TypeScript definitions

import type { FlightSearchRequest } from './flight';

export interface SavedSearch {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  searchCriteria: FlightSearchRequest;
  isPriceAlertEnabled: boolean;
  targetPrice?: number;
  createdAt: string;
  updatedAt: string;
  lastSearched?: string;
  isActive: boolean;
}

export interface SavedSearchRequest {
  name: string;
  description?: string;
  searchCriteria: FlightSearchRequest;
  isPriceAlertEnabled: boolean;
  targetPrice?: number;
}

export interface SavedSearchResponse {
  searches: SavedSearch[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchHistory {
  id: string;
  searchId: string;
  executedAt: string;
  resultsCount: number;
  lowestPrice?: number;
  averagePrice?: number;
  status: 'success' | 'failed' | 'no_results';
}