// Saved Search Service
import { apiService } from './api';
import { API_ENDPOINTS } from '../constants/api';
import type {
  SavedSearch,
  SavedSearchRequest
} from '../types/search';

export class SearchService {
  async getSavedSearches(): Promise<SavedSearch[]> {
    const response = await apiService.get<SavedSearch[]>(API_ENDPOINTS.SAVED_SEARCHES);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get saved searches');
    }

    return response.data || [];
  }

  async createSavedSearch(search: SavedSearchRequest): Promise<SavedSearch> {
    console.log('Creating saved search with data:', search);
    
    // Transform frontend structure to match backend expectations
    const backendRequest = {
      name: search.name,
      description: search.description,
      searchQuery: {
        originLocationCode: search.searchCriteria.origin,
        destinationLocationCode: search.searchCriteria.destination,
        departureDate: search.searchCriteria.departureDate,
        returnDate: search.searchCriteria.returnDate,
        adults: search.searchCriteria.passengers || 1,
        children: 0,
        infants: 0,
        travelClass: search.searchCriteria.class?.toUpperCase() === 'ECONOMY' ? 'ECONOMY' :
                     search.searchCriteria.class?.toUpperCase() === 'PREMIUM_ECONOMY' ? 'PREMIUM_ECONOMY' :
                     search.searchCriteria.class?.toUpperCase() === 'BUSINESS' ? 'BUSINESS' :
                     search.searchCriteria.class?.toUpperCase() === 'FIRST' ? 'FIRST' :
                     undefined
      },
      priceAlerts: search.isPriceAlertEnabled ? {
        enabled: true,
        threshold: search.targetPrice
      } : undefined
    };
    
    console.log('Sending to backend:', backendRequest);
    
    const response = await apiService.post<SavedSearch>(
      API_ENDPOINTS.SAVED_SEARCHES,
      backendRequest
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to create saved search');
    }

    return response.data!;
  }

  async getSavedSearchById(searchId: string): Promise<SavedSearch> {
    const endpoint = API_ENDPOINTS.SAVED_SEARCH_BY_ID.replace(':id', searchId);
    const response = await apiService.get<SavedSearch>(endpoint);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get saved search');
    }

    return response.data!;
  }

  async updateSavedSearch(searchId: string, updates: Partial<SavedSearchRequest>): Promise<SavedSearch> {
    const endpoint = API_ENDPOINTS.SAVED_SEARCH_BY_ID.replace(':id', searchId);
    const response = await apiService.put<SavedSearch>(endpoint, updates);

    if (!response.success) {
      throw new Error(response.error || 'Failed to update saved search');
    }

    return response.data!;
  }

  async deleteSavedSearch(searchId: string): Promise<void> {
    const endpoint = API_ENDPOINTS.SAVED_SEARCH_BY_ID.replace(':id', searchId);
    const response = await apiService.delete(endpoint);

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete saved search');
    }
  }
}

export const searchService = new SearchService();