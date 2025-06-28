import { ConversationalSearchService } from '../conversationalSearchService';
import { flightSearchService } from '../../flights/flightSearchService';
import { enhancedAmadeusService } from '../../flights/enhancedAmadeusService';
import { getRedisClient } from '../../redis/redisClient';
import { NaturalLanguageSearch } from '../../../schemas/flight';
import { isOk, isErr } from '../../../utils/result';
import Anthropic from '@anthropic-ai/sdk';

// Mock dependencies
jest.mock('@anthropic-ai/sdk');
jest.mock('../../flights/flightSearchService');
jest.mock('../../flights/enhancedAmadeusService');
jest.mock('../../redis/redisClient');
jest.mock('../../../config/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-api-key',
  }
}));

describe('ConversationalSearchService', () => {
  let service: ConversationalSearchService;
  let mockAnthropic: any;
  let mockRedisClient: any;

  const mockFlightSearchResults = {
    flights: [
      {
        id: '1',
        price: { currency: 'USD', grandTotal: '500.00' },
        itineraries: [{
          duration: 'PT5H30M',
          segments: [{
            departure: { iataCode: 'JFK', at: '2024-12-25T10:00:00' },
            arrival: { iataCode: 'LAX', at: '2024-12-25T13:30:00' },
            carrierCode: 'AA',
            number: '100',
          }],
        }],
      },
    ],
    analytics: {
      totalResults: 1,
      priceRange: { min: 500, max: 500, average: 500 },
      airlines: [{ code: 'AA', name: 'American Airlines', count: 1 }],
      cheapestOption: { 
        id: '1', 
        price: { currency: 'USD', grandTotal: '500.00' },
        itineraries: [{
          duration: 'PT5H30M',
          segments: [{
            departure: { iataCode: 'JFK', at: '2024-12-25T10:00:00' },
            arrival: { iataCode: 'LAX', at: '2024-12-25T13:30:00' },
            carrierCode: 'AA',
          }],
        }],
      },
      fastestOption: null,
      bestValueOption: null,
      recommendations: ['Book soon for best prices'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Anthropic
    mockAnthropic = {
      messages: {
        create: jest.fn(),
      },
    };
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropic);

    // Mock Redis
    mockRedisClient = {
      get: jest.fn().mockResolvedValue({ success: true, data: null }),
      set: jest.fn().mockResolvedValue({ success: true }),
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    service = new ConversationalSearchService();
  });

  describe('Natural Language Processing', () => {
    it('should process simple flight search query', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Find flights from New York to Los Angeles on December 25th',
      };

      // Mock Claude response for intent parsing
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'search',
            searchQuery: {
              originLocationCode: 'NYC',
              destinationLocationCode: 'LAX',
              departureDate: '2024-12-25',
              adults: 1,
            },
          }),
        }],
      });

      // Mock airport code conversion
      (enhancedAmadeusService.searchAirports as jest.Mock)
        .mockImplementation((keyword: string) => {
          if (keyword === 'NYC') {
            return { success: true, data: [{ iataCode: 'JFK', name: 'John F Kennedy' }] };
          }
          if (keyword === 'LAX') {
            return { success: true, data: [{ iataCode: 'LAX', name: 'Los Angeles International' }] };
          }
          return { success: true, data: [] };
        });

      // Mock flight search
      (flightSearchService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFlightSearchResults,
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('found 1 flights');
        expect(result.data.response).toContain('JFK to LAX');
        expect(result.data.searchResults).toBeDefined();
        expect(result.data.sessionId).toBeDefined();
      }
    });

    it('should handle queries with missing information', async () => {
      const query: NaturalLanguageSearch = {
        query: 'I want to go to Paris',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'search',
            searchQuery: {
              destinationLocationCode: 'CDG',
            },
            clarificationNeeded: {
              field: 'origin',
              reason: 'Please specify your departure city',
              suggestions: ['Where are you departing from?'],
            },
          }),
        }],
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('need more information');
        expect(result.data.suggestions).toContain('Where are you departing from?');
      }
    });

    it('should handle modify search intent', async () => {
      // First create a context with existing search
      const existingContext = {
        sessionId: 'test-session',
        messages: [],
        currentSearch: {
          originLocationCode: 'JFK',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-25',
          adults: 1,
          children: 0,
          infants: 0,
          max: 20,
        },
        searchHistory: [],
        lastUpdated: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify(existingContext),
      });

      const query: NaturalLanguageSearch = {
        query: 'Change to business class',
        sessionId: 'test-session',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'modify',
            searchQuery: {
              travelClass: 'BUSINESS',
            },
          }),
        }],
      });

      (flightSearchService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFlightSearchResults,
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('updated your search');
        expect(result.data.response).toContain('class: BUSINESS');
      }
    });

    it('should handle save search intent', async () => {
      const existingContext = {
        sessionId: 'test-session',
        userId: 'user123',
        messages: [],
        currentSearch: {
          originLocationCode: 'JFK',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-25',
          adults: 1,
          children: 0,
          infants: 0,
          max: 20,
        },
        searchHistory: [],
        lastUpdated: new Date().toISOString(),
      };

      mockRedisClient.get.mockResolvedValueOnce({
        success: true,
        data: JSON.stringify(existingContext),
      });

      const query: NaturalLanguageSearch = {
        query: 'Save this search and alert me on price drops',
        sessionId: 'test-session',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'save',
          }),
        }],
      });

      (flightSearchService.createSavedSearch as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'saved-search-123' },
      });

      const result = await service.processQuery(query, 'user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('saved your search');
        expect(result.data.response).toContain('monitor prices');
      }
    });

    it('should handle help intent', async () => {
      const query: NaturalLanguageSearch = {
        query: 'What can you help me with?',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'help',
          }),
        }],
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('AI travel assistant');
        expect(result.data.response).toContain('Search Flights');
        expect(result.data.suggestions?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Context Management', () => {
    it('should create new session if none provided', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Find flights to Paris',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({ action: 'help' }),
        }],
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.sessionId).toBeDefined();
        expect(result.data.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      }
    });

    it('should maintain conversation context across queries', async () => {
      const sessionId = 'test-session-123';
      
      // First query
      const query1: NaturalLanguageSearch = {
        query: 'Find flights from NYC to Paris',
        sessionId,
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'search',
            searchQuery: {
              originLocationCode: 'JFK',
              destinationLocationCode: 'CDG',
              departureDate: '2024-12-25',
              adults: 1,
            },
          }),
        }],
      });

      (flightSearchService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFlightSearchResults,
      });

      await service.processQuery(query1);

      // Verify context was saved
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `conversation:${sessionId}`,
        expect.stringContaining('Find flights from NYC to Paris'),
        expect.any(Number)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Claude API errors gracefully', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Find flights to London',
      };

      mockAnthropic.messages.create.mockRejectedValue(new Error('API Error'));

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true); // Should still return OK with help response
      if (isOk(result)) {
        expect(result.data.response).toContain('AI travel assistant');
      }
    });

    it('should handle flight search errors', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Find flights from JFK to LAX tomorrow',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'search',
            searchQuery: {
              originLocationCode: 'JFK',
              destinationLocationCode: 'LAX',
              departureDate: '2024-12-26',
              adults: 1,
            },
          }),
        }],
      });

      (flightSearchService.searchFlights as jest.Mock).mockResolvedValue({
        success: false,
        error: { message: 'Service unavailable' },
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('encountered an error');
        expect(result.data.suggestions).toBeDefined();
      }
    });

    it('should handle invalid JSON from Claude', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Book a flight',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: 'This is not valid JSON',
        }],
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('AI travel assistant'); // Falls back to help
      }
    });
  });

  describe('Response Generation', () => {
    it('should generate detailed search response', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Find the cheapest flights from NYC to LA next week',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'search',
            searchQuery: {
              originLocationCode: 'JFK',
              destinationLocationCode: 'LAX',
              departureDate: '2024-12-25',
              adults: 1,
            },
            modifiers: {
              priceLimit: 600,
            },
          }),
        }],
      });

      const detailedResults = {
        ...mockFlightSearchResults,
        analytics: {
          ...mockFlightSearchResults.analytics,
          cheapestOption: mockFlightSearchResults.flights[0],
          fastestOption: mockFlightSearchResults.flights[0],
          bestValueOption: mockFlightSearchResults.flights[0],
          recommendations: [
            'Prices vary significantly. Consider flexible dates for better deals.',
            'Book soon - prices tend to increase closer to departure.',
          ],
        },
      };

      (flightSearchService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: detailedResults,
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain('Cheapest Option');
        expect(result.data.response).toContain('USD 500.00');
        expect(result.data.response).toContain('Tips');
        expect(result.data.response).toContain('flexible dates');
      }
    });

    it('should handle no results gracefully', async () => {
      const query: NaturalLanguageSearch = {
        query: 'Non-stop flights from Antarctica to Mars',
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            action: 'search',
            searchQuery: {
              originLocationCode: 'ANT',
              destinationLocationCode: 'MRS',
              departureDate: '2024-12-25',
              adults: 1,
              nonStop: true,
            },
          }),
        }],
      });

      (flightSearchService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          flights: [],
          analytics: {
            totalResults: 0,
            priceRange: { min: 0, max: 0, average: 0 },
            airlines: [],
            cheapestOption: null,
            fastestOption: null,
            bestValueOption: null,
            recommendations: [],
          },
        },
      });

      const result = await service.processQuery(query);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.response).toContain("couldn't find any flights");
        expect(result.data.response).toContain('Consider');
        expect(result.data.response).toContain('nearby airports');
      }
    });
  });
});