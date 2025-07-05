import { FlightSearchService } from '../flightSearchService';
import { enhancedAmadeusService } from '../enhancedAmadeusService';
import { getRedisClient } from '../../redis/redisClient';
import { 
  FlightSearchQuery, 
  FlightOffer,
  SavedSearch,
  PriceAlert 
} from '../../../schemas/flight';
import { 
  CreateSavedSearchData,
  UserFlightPreferences 
} from '../../../models/flight';
import { isOk, isErr } from '../../../utils/result';

// Mock dependencies
jest.mock('../enhancedAmadeusService');
jest.mock('../../redis/redisClient');

describe('FlightSearchService', () => {
  let service: FlightSearchService;
  let mockRedisClient: any;

  const mockFlightOffer: FlightOffer = {
    id: '1',
    source: 'GDS',
    instantTicketingRequired: false,
    nonHomogeneous: false,
    oneWay: false,
    lastTicketingDate: '2024-12-20',
    numberOfBookableSeats: 4,
    itineraries: [{
      duration: 'PT8H30M',
      segments: [{
        id: '1',
        departure: {
          iataCode: 'YYZ',
          at: '2024-12-25T10:00:00',
        },
        arrival: {
          iataCode: 'CDG',
          at: '2024-12-25T23:30:00',
        },
        carrierCode: 'AC',
        number: '880',
        duration: 'PT8H30M',
        numberOfStops: 0,
      }],
    }],
    price: {
      currency: 'CAD',
      total: '1200.00',
      base: '1000.00',
      grandTotal: '1200.00',
    },
    pricingOptions: {
      fareType: ['PUBLISHED'],
      includedCheckedBagsOnly: true,
    },
    validatingAirlineCodes: ['AC'],
    travelerPricings: [{
      travelerId: '1',
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: {
        currency: 'CAD',
        total: '1200.00',
        base: '1000.00',
        grandTotal: '1200.00',
      },
      fareDetailsBySegment: [{
        segmentId: '1',
        cabin: 'ECONOMY',
        fareBasis: 'YRTOW',
        class: 'Y',
        includedCheckedBags: {
          quantity: 1,
        },
      }],
    }],
  };

  const mockFlightOffer2: FlightOffer = {
    ...mockFlightOffer,
    id: '2',
    price: {
      ...mockFlightOffer.price,
      total: '1500.00',
      grandTotal: '1500.00',
    },
    itineraries: [{
      duration: 'PT6H30M',
      segments: [{
        ...mockFlightOffer.itineraries[0].segments[0],
        id: '2',
        duration: 'PT6H30M',
        carrierCode: 'AF',
        number: '356',
      }],
    }],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedisClient = {
      get: jest.fn().mockResolvedValue({ success: true, data: null }),
      set: jest.fn().mockResolvedValue({ success: true }),
      del: jest.fn().mockResolvedValue({ success: true }),
    };

    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
    
    service = new FlightSearchService();
  });

  describe('Flight Search', () => {
    const searchQuery: FlightSearchQuery = {
      originLocationCode: 'YYZ',
      destinationLocationCode: 'CDG',
      departureDate: '2024-12-25',
      adults: 1,
      children: 0,
      infants: 0,
      max: 20,
    };

    it('should search flights with analytics', async () => {
      (enhancedAmadeusService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockFlightOffer, mockFlightOffer2],
      });

      (enhancedAmadeusService.getAirlineInfo as jest.Mock).mockImplementation((code: string) => ({
        success: true,
        data: { code, name: code === 'AC' ? 'Air Canada' : 'Air France', logoUrl: '' },
      }));

      const result = await service.searchFlights(searchQuery);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.flights).toHaveLength(2);
        expect(result.data.analytics.totalResults).toBe(2);
        expect(result.data.analytics.priceRange.min).toBe(1200);
        expect(result.data.analytics.priceRange.max).toBe(1500);
        expect(result.data.analytics.cheapestOption?.id).toBe('1');
        expect(result.data.analytics.fastestOption?.id).toBe('2');
        expect(result.data.analytics.airlines).toHaveLength(2);
      }
    });

    it('should apply user preferences', async () => {
      const preferences: UserFlightPreferences = {
        userId: 'user123',
        preferredAirlines: ['AC'],
        avoidAirlines: ['AF'],
        preferredCabin: 'ECONOMY',
        maxStops: 0,
        preferredDepartureTime: 'MORNING',
        preferredArrivalTime: 'ANY',
        updatedAt: new Date().toISOString(),
      };

      (enhancedAmadeusService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockFlightOffer, mockFlightOffer2],
      });

      (enhancedAmadeusService.getAirlineInfo as jest.Mock).mockResolvedValue({
        success: true,
        data: { code: 'AC', name: 'Air Canada', logoUrl: '' },
      });

      const result = await service.searchFlights(searchQuery, 'user123', preferences);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should filter out Air France flight
        expect(result.data.flights).toHaveLength(1);
        expect(result.data.flights[0].id).toBe('1');
      }
    });

    it('should save search history for authenticated users', async () => {
      (enhancedAmadeusService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockFlightOffer],
      });

      (enhancedAmadeusService.getAirlineInfo as jest.Mock).mockResolvedValue({
        success: true,
        data: { code: 'AC', name: 'Air Canada', logoUrl: '' },
      });

      await service.searchFlights(searchQuery, 'user123');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'search-history:user123',
        expect.any(String)
      );
    });

    it('should generate recommendations', async () => {
      const expensiveFlight = {
        ...mockFlightOffer,
        id: '3',
        price: { ...mockFlightOffer.price, grandTotal: '3000.00' },
      };

      (enhancedAmadeusService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockFlightOffer, mockFlightOffer2, expensiveFlight],
      });

      (enhancedAmadeusService.getAirlineInfo as jest.Mock).mockResolvedValue({
        success: true,
        data: { code: 'AC', name: 'Air Canada', logoUrl: '' },
      });

      const result = await service.searchFlights(searchQuery);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.analytics.recommendations.length).toBeGreaterThan(0);
        expect(result.data.analytics.recommendations[0]).toContain('Prices vary significantly');
      }
    });
  });

  describe('Saved Searches', () => {
    const createData: CreateSavedSearchData = {
      userId: 'user123',
      name: 'Christmas Trip to Paris',
      searchQuery: {
        originLocationCode: 'YYZ',
        destinationLocationCode: 'CDG',
        departureDate: '2024-12-25',
        adults: 1,
        children: 0,
        infants: 0,
        max: 20,
      },
      priceAlerts: {
        enabled: true,
        targetPrice: 1000,
      },
    };

    it('should create saved search', async () => {
      const result = await service.createSavedSearch(createData);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.name).toBe('Christmas Trip to Paris');
        expect(result.data.userId).toBe('user123');
        expect(result.data.priceAlerts?.enabled).toBe(true);
      }

      expect(mockRedisClient.set).toHaveBeenCalledTimes(2); // Search and list
    });

    it('should get user saved searches', async () => {
      const savedSearch: SavedSearch = {
        id: 'search123',
        userId: 'user123',
        name: 'Test Search',
        searchQuery: createData.searchQuery,
        priceAlerts: createData.priceAlerts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      mockRedisClient.get.mockImplementation((key: string) => {
        if (key === 'saved-searches:user123') {
          return { success: true, data: JSON.stringify(['search123']) };
        }
        if (key === 'saved-search:user123:search123') {
          return { success: true, data: JSON.stringify(savedSearch) };
        }
        return { success: true, data: null };
      });

      const result = await service.getSavedSearches('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('Test Search');
      }
    });

    it('should update saved search', async () => {
      const savedSearch: SavedSearch = {
        id: 'search123',
        userId: 'user123',
        name: 'Test Search',
        searchQuery: createData.searchQuery,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      mockRedisClient.get.mockResolvedValue({
        success: true,
        data: JSON.stringify(savedSearch),
      });

      const result = await service.updateSavedSearch('user123', 'search123', {
        name: 'Updated Search',
        isActive: false,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.name).toBe('Updated Search');
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should delete saved search', async () => {
      mockRedisClient.get.mockResolvedValue({
        success: true,
        data: JSON.stringify(['search123', 'search456']),
      });

      const result = await service.deleteSavedSearch('user123', 'search123');

      expect(isOk(result)).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('saved-search:user123:search123');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'saved-searches:user123',
        JSON.stringify(['search456'])
      );
    });
  });

  describe('Price Tracking', () => {
    const savedSearch: SavedSearch = {
      id: 'search123',
      userId: 'user123',
      name: 'Price Alert Search',
      searchQuery: {
        originLocationCode: 'YYZ',
        destinationLocationCode: 'CDG',
        departureDate: '2024-12-25',
        adults: 1,
        children: 0,
        infants: 0,
        max: 20,
      },
      priceAlerts: {
        enabled: true,
        targetPrice: 1000,
        percentDrop: 10,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    it('should check saved search prices and trigger alert', async () => {
      // Mock getting saved searches
      jest.spyOn(service, 'getSavedSearches').mockResolvedValue({
        success: true,
        data: [savedSearch],
      });

      // Mock flight search with lower price
      (enhancedAmadeusService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: [{
          ...mockFlightOffer,
          price: { ...mockFlightOffer.price, grandTotal: '900.00' },
        }],
      });

      // Mock previous price history
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key === `price-history:${savedSearch.id}`) {
          return { success: true, data: JSON.stringify([1200, 1100, 1000]) };
        }
        return { success: true, data: null };
      });

      const result = await service.checkSavedSearchPrices('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].currentBestPrice).toBe(900);
        expect(result.data[0].alert).toBeDefined();
        expect(result.data[0].alert?.triggerType).toBe('TARGET_PRICE');
      }
    });

    it('should track price history', async () => {
      jest.spyOn(service, 'getSavedSearches').mockResolvedValue({
        success: true,
        data: [savedSearch],
      });

      (enhancedAmadeusService.searchFlights as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockFlightOffer],
      });

      await service.checkSavedSearchPrices('user123');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `price-history:${savedSearch.id}`,
        expect.stringContaining('1200')
      );
    });
  });

  describe('Price Alerts', () => {
    const mockAlert: PriceAlert = {
      id: 'alert123',
      userId: 'user123',
      savedSearchId: 'search123',
      triggerType: 'PRICE_DROP',
      flightOffer: mockFlightOffer,
      previousPrice: 1500,
      currentPrice: 1200,
      priceDifference: -300,
      percentChange: -20,
      alertedAt: new Date().toISOString(),
      isRead: false,
      expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
    };

    it('should get price alerts', async () => {
      mockRedisClient.get.mockResolvedValue({
        success: true,
        data: JSON.stringify([mockAlert]),
      });

      const result = await service.getPriceAlerts('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].triggerType).toBe('PRICE_DROP');
        expect(result.data[0].percentChange).toBe(-20);
      }
    });

    it('should filter unread alerts only', async () => {
      const readAlert = { ...mockAlert, id: 'alert456', isRead: true };
      
      mockRedisClient.get.mockResolvedValue({
        success: true,
        data: JSON.stringify([mockAlert, readAlert]),
      });

      const result = await service.getPriceAlerts('user123', true);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('alert123');
      }
    });

    it('should mark alert as read', async () => {
      mockRedisClient.get.mockResolvedValue({
        success: true,
        data: JSON.stringify([mockAlert]),
      });

      const result = await service.markAlertAsRead('user123', 'alert123');

      expect(isOk(result)).toBe(true);
      
      const savedData = JSON.parse(mockRedisClient.set.mock.calls[0][1]);
      expect(savedData[0].isRead).toBe(true);
    });

    it('should filter expired alerts', async () => {
      const expiredAlert = {
        ...mockAlert,
        id: 'expired',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };

      mockRedisClient.get.mockResolvedValue({
        success: true,
        data: JSON.stringify([mockAlert, expiredAlert]),
      });

      const result = await service.getPriceAlerts('user123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('alert123');
      }
    });
  });
});