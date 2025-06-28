import { EnhancedAmadeusService } from '../enhancedAmadeusService';
import { FlightSearchQuery, AdvancedSearchOptions } from '../../../schemas/flight';
import { isOk, isErr } from '../../../utils/result';
import { getRedisClient } from '../../redis/redisClient';

// Mock dependencies
jest.mock('amadeus');
jest.mock('../../redis/redisClient');
jest.mock('../../../config/env', () => ({
  env: {
    AMADEUS_CLIENT_ID: 'test-client-id',
    AMADEUS_CLIENT_SECRET: 'test-client-secret',
    AMADEUS_ENVIRONMENT: 'test',
  }
}));

describe('EnhancedAmadeusService', () => {
  let service: EnhancedAmadeusService;
  let mockAmadeus: any;
  let mockRedisClient: any;

  const mockFlightOffer = {
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

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Amadeus client
    mockAmadeus = {
      shopping: {
        flightOffersSearch: {
          get: jest.fn(),
          post: jest.fn(),
        },
        flightOffers: {
          pricing: {
            post: jest.fn(),
          },
        },
      },
      booking: {
        flightOrders: {
          post: jest.fn(),
        },
      },
      referenceData: {
        locations: {
          get: jest.fn(),
        },
        airlines: {
          get: jest.fn(),
        },
      },
    };

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn().mockResolvedValue({ success: true, data: null }),
      set: jest.fn().mockResolvedValue({ success: true }),
    };

    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    // Mock Amadeus constructor
    const Amadeus = require('amadeus');
    Amadeus.mockImplementation(() => mockAmadeus);

    service = new EnhancedAmadeusService();
  });

  describe('Flight Search', () => {
    const basicQuery: FlightSearchQuery = {
      originLocationCode: 'YYZ',
      destinationLocationCode: 'CDG',
      departureDate: '2024-12-25',
      adults: 1,
      children: 0,
      infants: 0,
      max: 20,
    };

    it('should search flights successfully', async () => {
      mockAmadeus.shopping.flightOffersSearch.get.mockResolvedValue({
        data: [mockFlightOffer],
      });

      const result = await service.searchFlights(basicQuery);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('1');
      }

      expect(mockAmadeus.shopping.flightOffersSearch.get).toHaveBeenCalledWith(
        expect.objectContaining({
          originLocationCode: 'YYZ',
          destinationLocationCode: 'CDG',
          departureDate: '2024-12-25',
          adults: 1,
        })
      );
    });

    it('should handle empty search results', async () => {
      mockAmadeus.shopping.flightOffersSearch.get.mockResolvedValue({
        data: [],
      });

      const result = await service.searchFlights(basicQuery);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should use cached results when available', async () => {
      const cachedData = [mockFlightOffer];
      mockRedisClient.get.mockResolvedValueOnce({ 
        success: true, 
        data: JSON.stringify(cachedData) 
      });

      const result = await service.searchFlights(basicQuery);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toEqual(cachedData);
      }
      expect(mockAmadeus.shopping.flightOffersSearch.get).not.toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      mockAmadeus.shopping.flightOffersSearch.get.mockRejectedValue({
        response: { statusCode: 429 },
      });

      const result = await service.searchFlights(basicQuery);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(429);
        expect(result.error.message).toContain('Too many requests');
      }
    });

    it('should handle authentication errors', async () => {
      mockAmadeus.shopping.flightOffersSearch.get.mockRejectedValue({
        response: { statusCode: 401 },
      });

      const result = await service.searchFlights(basicQuery);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(401);
        expect(result.error.message).toContain('Authentication');
      }
    });
  });

  describe('Advanced Search Options', () => {
    it('should apply price range filter', async () => {
      const expensiveOffer = { 
        ...mockFlightOffer, 
        id: '2',
        price: { ...mockFlightOffer.price, grandTotal: '2500.00' }
      };

      mockAmadeus.shopping.flightOffersSearch.get.mockResolvedValue({
        data: [mockFlightOffer, expensiveOffer],
      });

      const advancedOptions: AdvancedSearchOptions = {
        priceRange: { min: 500, max: 1500 },
      };

      const result = await service.searchFlights(
        {
          originLocationCode: 'YYZ',
          destinationLocationCode: 'CDG',
          departureDate: '2024-12-25',
          adults: 1,
          children: 0,
          infants: 0,
          max: 20,
        },
        advancedOptions
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('1');
      }
    });

    it('should handle flexible date search', async () => {
      mockAmadeus.shopping.flightOffersSearch.get.mockResolvedValue({
        data: [mockFlightOffer],
      });

      const advancedOptions: AdvancedSearchOptions = {
        flexibleDates: {
          enabled: true,
          daysBefore: 1,
          daysAfter: 1,
        },
      };

      const result = await service.searchFlights(
        {
          originLocationCode: 'YYZ',
          destinationLocationCode: 'CDG',
          departureDate: '2024-12-25',
          adults: 1,
          children: 0,
          infants: 0,
          max: 20,
        },
        advancedOptions
      );

      expect(isOk(result)).toBe(true);
      // Should call search 3 times (original date + 1 before + 1 after)
      expect(mockAmadeus.shopping.flightOffersSearch.get).toHaveBeenCalledTimes(3);
    });

    it('should handle multi-city search', async () => {
      mockAmadeus.shopping.flightOffersSearch.post.mockResolvedValue({
        data: [mockFlightOffer],
      });

      const advancedOptions: AdvancedSearchOptions = {
        multiCity: [
          {
            originLocationCode: 'YYZ',
            destinationLocationCode: 'LHR',
            departureDate: '2024-12-25',
          },
          {
            originLocationCode: 'LHR',
            destinationLocationCode: 'CDG',
            departureDate: '2024-12-28',
          },
        ],
      };

      const result = await service.searchFlights(
        {
          originLocationCode: 'YYZ',
          destinationLocationCode: 'CDG',
          departureDate: '2024-12-25',
          adults: 1,
          children: 0,
          infants: 0,
          max: 20,
        },
        advancedOptions
      );

      expect(isOk(result)).toBe(true);
      expect(mockAmadeus.shopping.flightOffersSearch.post).toHaveBeenCalled();
    });
  });

  describe('Price Confirmation', () => {
    it('should confirm flight price', async () => {
      const confirmedOffer = {
        ...mockFlightOffer,
        price: { ...mockFlightOffer.price, grandTotal: '1250.00' },
      };

      mockAmadeus.shopping.flightOffers.pricing.post.mockResolvedValue({
        data: { flightOffers: [confirmedOffer] },
      });

      const result = await service.confirmPrice(mockFlightOffer);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.price.grandTotal).toBe('1250.00');
      }
    });

    it('should cache confirmed prices', async () => {
      const confirmedOffer = {
        ...mockFlightOffer,
        price: { ...mockFlightOffer.price, grandTotal: '1250.00' },
      };

      mockAmadeus.shopping.flightOffers.pricing.post.mockResolvedValue({
        data: { flightOffers: [confirmedOffer] },
      });

      await service.confirmPrice(mockFlightOffer);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('price:'),
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Flight Booking', () => {
    const travelers = [{
      id: '1',
      dateOfBirth: '1990-01-15',
      name: {
        firstName: 'John',
        lastName: 'Doe',
      },
      gender: 'MALE' as const,
      contact: {
        emailAddress: 'john.doe@example.com',
        phones: [{
          deviceType: 'MOBILE' as const,
          countryCallingCode: '1',
          number: '4165551234',
        }],
      },
    }];

    it('should create booking successfully', async () => {
      const bookingResponse = {
        id: 'ABC123',
        type: 'flight-order',
        queuingOfficeId: 'YYZMQ2195',
      };

      mockAmadeus.booking.flightOrders.post.mockResolvedValue({
        data: bookingResponse,
      });

      const result = await service.createBooking(mockFlightOffer, travelers);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.bookingReference).toBe('ABC123');
        expect(result.data.booking).toEqual(bookingResponse);
      }
    });

    it('should handle booking errors', async () => {
      mockAmadeus.booking.flightOrders.post.mockRejectedValue({
        response: { 
          statusCode: 400,
          result: {
            errors: [{
              detail: 'Invalid traveler information',
            }],
          },
        },
      });

      const result = await service.createBooking(mockFlightOffer, travelers);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(400);
        expect(result.error.message).toContain('Invalid traveler information');
      }
    });
  });

  describe('Airport Search', () => {
    it('should search airports by keyword', async () => {
      const airports = [
        {
          iataCode: 'YYZ',
          name: 'Toronto Pearson International Airport',
          address: {
            cityName: 'Toronto',
            countryCode: 'CA',
          },
        },
        {
          iataCode: 'YTZ',
          name: 'Billy Bishop Toronto City Airport',
          address: {
            cityName: 'Toronto',
            countryCode: 'CA',
          },
        },
      ];

      mockAmadeus.referenceData.locations.get.mockResolvedValue({
        data: airports,
      });

      const result = await service.searchAirports('Toronto');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].iataCode).toBe('YYZ');
        expect(result.data[0].cityName).toBe('Toronto');
      }
    });

    it('should cache airport search results', async () => {
      const airports = [{
        iataCode: 'YYZ',
        name: 'Toronto Pearson International Airport',
        address: {
          cityName: 'Toronto',
          countryCode: 'CA',
        },
      }];

      mockAmadeus.referenceData.locations.get.mockResolvedValue({
        data: airports,
      });

      await service.searchAirports('Toronto');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('airports:toronto'),
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Airline Information', () => {
    it('should get airline information', async () => {
      const airline = {
        iataCode: 'AC',
        businessName: 'Air Canada',
      };

      mockAmadeus.referenceData.airlines.get.mockResolvedValue({
        data: [airline],
      });

      const result = await service.getAirlineInfo('AC');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.data.code).toBe('AC');
        expect(result.data.name).toBe('Air Canada');
        expect(result.data.logoUrl).toContain('AC');
      }
    });

    it('should handle airline not found', async () => {
      mockAmadeus.referenceData.airlines.get.mockResolvedValue({
        data: [],
      });

      const result = await service.getAirlineInfo('XX');

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(404);
        expect(result.error.message).toContain('Airline not found');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce search rate limit', async () => {
      mockAmadeus.shopping.flightOffersSearch.get.mockResolvedValue({
        data: [mockFlightOffer],
      });

      const query: FlightSearchQuery = {
        originLocationCode: 'YYZ',
        destinationLocationCode: 'CDG',
        departureDate: '2024-12-25',
        adults: 1,
        children: 0,
        infants: 0,
        max: 20,
      };

      // Simulate reaching rate limit
      for (let i = 0; i < 30; i++) {
        await service.searchFlights(query);
      }

      // Next request should be rate limited
      const result = await service.searchFlights(query);
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(429);
        expect(result.error.message).toContain('Rate limit exceeded');
      }
    });
  });
});