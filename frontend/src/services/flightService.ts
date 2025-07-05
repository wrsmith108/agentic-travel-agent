// Flight Search Service
import { apiService } from './api';
import { API_ENDPOINTS } from '../constants/api';
import type { 
  FlightSearchRequest, 
  FlightSearchResponse, 
  FlightDetails 
} from '../types/flight';

export class FlightService {
  async searchFlights(searchParams: FlightSearchRequest): Promise<FlightSearchResponse> {
    // Transform frontend format to backend format
    const transformedQuery = {
      originLocationCode: searchParams.origin,
      destinationLocationCode: searchParams.destination,
      departureDate: searchParams.departureDate,
      returnDate: searchParams.returnDate,
      adults: searchParams.passengers || 1,  // passengers is just a number
      children: 0,  // Default to 0 for now
      infants: 0,   // Default to 0 for now
      travelClass: searchParams.class.toUpperCase().replace('_', '_'), // Convert to uppercase
      currencyCode: 'USD',  // Default currency
      nonStop: false,       // Default value
      maxPrice: undefined   // No max price by default
    };

    // Backend expects the query to be wrapped in a 'query' property
    const requestBody = {
      query: transformedQuery
    };

    const response = await apiService.post<FlightSearchResponse>(
      API_ENDPOINTS.FLIGHT_SEARCH,
      requestBody
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to search flights');
    }

    return response.data!;
  }

  async getFlightDetails(flightId: string): Promise<FlightDetails> {
    const endpoint = API_ENDPOINTS.FLIGHT_DETAILS.replace(':id', flightId);
    const response = await apiService.get<FlightDetails>(endpoint);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get flight details');
    }

    return response.data!;
  }

  async searchNaturalLanguage(query: string, conversationId?: string, previousMessages?: Array<{role: string, content: string}>): Promise<any> {
    const response = await apiService.post(
      API_ENDPOINTS.FLIGHT_SEARCH_NATURAL,
      {
        query,
        conversationId,
        context: {
          previousMessages: previousMessages || []
        }
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to process natural language search');
    }

    return response.data!;
  }
}

export const flightService = new FlightService();