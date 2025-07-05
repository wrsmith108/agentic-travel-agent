import { apiService } from './api';
import { API_ENDPOINTS } from '../constants/api';
import type { SavedSearch, SavedSearchRequest, SavedSearchResponse } from '../types/search';

export const savedSearchService = {
  // Get all saved searches for the current user
  async getSavedSearches(): Promise<SavedSearchResponse> {
    const response = await apiService.get<SavedSearchResponse>(API_ENDPOINTS.SAVED_SEARCHES);
    return response.data!;
  },

  // Create a new saved search
  async createSavedSearch(request: SavedSearchRequest): Promise<SavedSearch> {
    // Transform frontend format to backend format
    const backendRequest = {
      name: request.name,
      searchQuery: {
        originLocationCode: request.searchCriteria.origin,
        destinationLocationCode: request.searchCriteria.destination,
        departureDate: request.searchCriteria.departureDate,
        returnDate: request.searchCriteria.returnDate,
        adults: request.searchCriteria.passengers || 1,
        children: 0,
        infants: 0,
        travelClass: request.searchCriteria.class?.toUpperCase().replace('_', '_') || 'ECONOMY',
        max: 20
      },
      priceAlerts: request.isPriceAlertEnabled ? {
        enabled: true,
        targetPrice: request.targetPrice
      } : undefined
    };
    
    const response = await apiService.post<SavedSearch>(API_ENDPOINTS.SAVED_SEARCHES, backendRequest);
    return response.data!;
  },

  // Update an existing saved search
  async updateSavedSearch(id: string, request: Partial<SavedSearchRequest>): Promise<SavedSearch> {
    const response = await apiService.put<SavedSearch>(
      API_ENDPOINTS.SAVED_SEARCH_BY_ID.replace(':id', id),
      request
    );
    return response.data!;
  },

  // Delete a saved search
  async deleteSavedSearch(id: string): Promise<void> {
    await apiService.delete(API_ENDPOINTS.SAVED_SEARCH_BY_ID.replace(':id', id));
  },

  // Toggle price alert for a saved search
  async togglePriceAlert(id: string, enabled: boolean, targetPrice?: number): Promise<SavedSearch> {
    const response = await apiService.put<SavedSearch>(
      API_ENDPOINTS.SAVED_SEARCH_BY_ID.replace(':id', id),
      { isPriceAlertEnabled: enabled, targetPrice }
    );
    return response.data!;
  }
};