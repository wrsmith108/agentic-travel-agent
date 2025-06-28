import {
  IATACodeSchema,
  FlightDateSchema,
  FlightTimeSchema,
  CurrencyCodeSchema,
  FlightSegmentSchema,
  FlightItinerarySchema,
  PriceSchema,
  FlightOfferSchema,
  FlightSearchQuerySchema,
  AdvancedSearchOptionsSchema,
  NaturalLanguageSearchSchema,
  SavedSearchSchema,
  PriceAlertSchema,
  FlightBookingSchema,
  validateFlightSearchQuery,
  validateNaturalLanguageSearch,
} from '../flight';

describe('Flight Schemas', () => {
  describe('Basic Validators', () => {
    it('should validate IATA codes', () => {
      expect(IATACodeSchema.parse('YYZ')).toBe('YYZ');
      expect(IATACodeSchema.parse('LAX')).toBe('LAX');
      expect(IATACodeSchema.parse('JFK')).toBe('JFK');
      
      expect(() => IATACodeSchema.parse('YY')).toThrow();
      expect(() => IATACodeSchema.parse('YYYY')).toThrow();
      expect(() => IATACodeSchema.parse('yyz')).toThrow();
      expect(() => IATACodeSchema.parse('123')).toThrow();
    });

    it('should validate flight dates', () => {
      expect(FlightDateSchema.parse('2024-12-25')).toBe('2024-12-25');
      expect(FlightDateSchema.parse('2024-01-01')).toBe('2024-01-01');
      
      expect(() => FlightDateSchema.parse('12/25/2024')).toThrow();
      expect(() => FlightDateSchema.parse('2024-13-01')).toThrow();
      expect(() => FlightDateSchema.parse('2024-12-32')).toThrow();
      expect(() => FlightDateSchema.parse('24-12-25')).toThrow();
    });

    it('should validate flight times', () => {
      expect(FlightTimeSchema.parse('14:30')).toBe('14:30');
      expect(FlightTimeSchema.parse('00:00')).toBe('00:00');
      expect(FlightTimeSchema.parse('23:59')).toBe('23:59');
      
      expect(() => FlightTimeSchema.parse('2:30')).toThrow();
      expect(() => FlightTimeSchema.parse('14:30:00')).toThrow();
      expect(() => FlightTimeSchema.parse('25:00')).toThrow();
      expect(() => FlightTimeSchema.parse('14:60')).toThrow();
    });

    it('should validate currency codes', () => {
      expect(CurrencyCodeSchema.parse('USD')).toBe('USD');
      expect(CurrencyCodeSchema.parse('EUR')).toBe('EUR');
      expect(CurrencyCodeSchema.parse('CAD')).toBe('CAD');
      
      expect(() => CurrencyCodeSchema.parse('US')).toThrow();
      expect(() => CurrencyCodeSchema.parse('usd')).toThrow();
      expect(() => CurrencyCodeSchema.parse('USDD')).toThrow();
    });
  });

  describe('Flight Segment Schema', () => {
    it('should validate a complete flight segment', () => {
      const segment = {
        departure: {
          iataCode: 'YYZ',
          terminal: '1',
          at: '2024-12-25T14:30:00',
        },
        arrival: {
          iataCode: 'LAX',
          terminal: '4',
          at: '2024-12-25T17:45:00',
        },
        carrierCode: 'AC',
        number: '792',
        aircraft: {
          code: '789',
        },
        duration: 'PT5H15M',
        id: '1',
        numberOfStops: 0,
      };

      const result = FlightSegmentSchema.parse(segment);
      expect(result.departure.iataCode).toBe('YYZ');
      expect(result.arrival.iataCode).toBe('LAX');
      expect(result.numberOfStops).toBe(0);
    });

    it('should validate segment with minimal required fields', () => {
      const segment = {
        departure: {
          iataCode: 'JFK',
          at: '2024-12-25T10:00:00',
        },
        arrival: {
          iataCode: 'LHR',
          at: '2024-12-25T22:00:00',
        },
        carrierCode: 'BA',
        number: '112',
        duration: 'PT7H',
        id: '2',
        numberOfStops: 0,
      };

      const result = FlightSegmentSchema.parse(segment);
      expect(result.departure.terminal).toBeUndefined();
      expect(result.aircraft).toBeUndefined();
    });
  });

  describe('Price Schema', () => {
    it('should validate price with all fields', () => {
      const price = {
        currency: 'USD',
        total: '1234.56',
        base: '1000.00',
        fees: [
          { amount: '234.56', type: 'SUPPLIER' },
        ],
        grandTotal: '1234.56',
      };

      const result = PriceSchema.parse(price);
      expect(result.total).toBe('1234.56');
      expect(result.fees).toHaveLength(1);
    });

    it('should validate price with required fields only', () => {
      const price = {
        currency: 'EUR',
        total: '500.00',
        grandTotal: '500.00',
      };

      const result = PriceSchema.parse(price);
      expect(result.base).toBeUndefined();
      expect(result.fees).toBeUndefined();
    });
  });

  describe('Flight Search Query Schema', () => {
    it('should validate basic search query', () => {
      const query = {
        originLocationCode: 'YYZ',
        destinationLocationCode: 'CDG',
        departureDate: '2024-12-25',
      };

      const result = validateFlightSearchQuery(query);
      expect(result.adults).toBe(1);
      expect(result.children).toBe(0);
      expect(result.max).toBe(20);
    });

    it('should validate round trip search query', () => {
      const query = {
        originLocationCode: 'NYC',
        destinationLocationCode: 'LON',
        departureDate: '2024-12-25',
        returnDate: '2025-01-02',
        adults: 2,
        children: 1,
        travelClass: 'BUSINESS' as const,
        nonStop: true,
        currencyCode: 'USD',
        maxPrice: 5000,
      };

      const result = validateFlightSearchQuery(query);
      expect(result.returnDate).toBe('2025-01-02');
      expect(result.adults).toBe(2);
      expect(result.travelClass).toBe('BUSINESS');
      expect(result.nonStop).toBe(true);
    });

    it('should reject invalid passenger counts', () => {
      expect(() => validateFlightSearchQuery({
        originLocationCode: 'YYZ',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-25',
        adults: 10,
      })).toThrow();

      expect(() => validateFlightSearchQuery({
        originLocationCode: 'YYZ',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-25',
        adults: 0,
      })).toThrow();
    });
  });

  describe('Advanced Search Options Schema', () => {
    it('should validate flexible dates option', () => {
      const options = {
        flexibleDates: {
          enabled: true,
          daysBefore: 2,
          daysAfter: 3,
        },
      };

      const result = AdvancedSearchOptionsSchema.parse(options);
      expect(result.flexibleDates?.daysBefore).toBe(2);
      expect(result.flexibleDates?.daysAfter).toBe(3);
    });

    it('should validate multi-city search', () => {
      const options = {
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
          {
            originLocationCode: 'CDG',
            destinationLocationCode: 'YYZ',
            departureDate: '2025-01-02',
          },
        ],
      };

      const result = AdvancedSearchOptionsSchema.parse(options);
      expect(result.multiCity).toHaveLength(3);
    });

    it('should validate time ranges', () => {
      const options = {
        departureTimeRange: {
          earliest: '06:00',
          latest: '10:00',
        },
        arrivalTimeRange: {
          earliest: '14:00',
          latest: '22:00',
        },
        connectionTimeRange: {
          min: 60,
          max: 240,
        },
      };

      const result = AdvancedSearchOptionsSchema.parse(options);
      expect(result.departureTimeRange?.earliest).toBe('06:00');
      expect(result.connectionTimeRange?.min).toBe(60);
    });
  });

  describe('Natural Language Search Schema', () => {
    it('should validate simple natural language query', () => {
      const query = {
        query: 'I want to fly from Toronto to Paris next Christmas',
      };

      const result = validateNaturalLanguageSearch(query);
      expect(result.query).toContain('Toronto to Paris');
      expect(result.sessionId).toBeUndefined();
    });

    it('should validate query with context', () => {
      const query = {
        query: 'Show me cheaper options',
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        context: {
          previousSearches: [
            {
              originLocationCode: 'YYZ',
              destinationLocationCode: 'CDG',
              departureDate: '2024-12-25',
            },
          ],
          userPreferences: {
            preferredAirlines: ['AC', 'AF'],
            preferredCabin: 'BUSINESS' as const,
            maxStops: 1,
          },
        },
      };

      const result = validateNaturalLanguageSearch(query);
      expect(result.context?.previousSearches).toHaveLength(1);
      expect(result.context?.userPreferences?.preferredAirlines).toContain('AC');
    });
  });

  describe('Saved Search Schema', () => {
    it('should validate saved search with price alerts', () => {
      const savedSearch = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Christmas Paris Trip',
        searchQuery: {
          originLocationCode: 'YYZ',
          destinationLocationCode: 'CDG',
          departureDate: '2024-12-23',
          returnDate: '2024-12-30',
          adults: 2,
        },
        priceAlerts: {
          enabled: true,
          targetPrice: 1500,
          percentDrop: 10,
        },
        frequency: 'DAILY' as const,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      const result = SavedSearchSchema.parse(savedSearch);
      expect(result.priceAlerts?.enabled).toBe(true);
      expect(result.priceAlerts?.targetPrice).toBe(1500);
      expect(result.isActive).toBe(true);
    });
  });

  describe('Price Alert Schema', () => {
    it('should validate price drop alert', () => {
      const alert = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        savedSearchId: '123e4567-e89b-12d3-a456-426614174002',
        triggerType: 'PRICE_DROP' as const,
        flightOffer: {
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
              id: '1',
              numberOfStops: 0,
            }],
          }],
          price: {
            currency: 'CAD',
            total: '1200.00',
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
              grandTotal: '1200.00',
            },
            fareDetailsBySegment: [{
              segmentId: '1',
              cabin: 'ECONOMY',
              includedCheckedBags: {
                quantity: 1,
              },
            }],
          }],
        },
        previousPrice: 1500,
        currentPrice: 1200,
        priceDifference: -300,
        percentChange: -20,
        alertedAt: '2024-11-15T15:30:00Z',
        expiresAt: '2024-11-16T15:30:00Z',
      };

      const result = PriceAlertSchema.parse(alert);
      expect(result.percentChange).toBe(-20);
      expect(result.isRead).toBe(false);
    });
  });

  describe('Flight Booking Schema', () => {
    it('should validate complete booking', () => {
      const booking = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        flightOfferId: 'offer_123',
        bookingReference: 'ABC123',
        status: 'CONFIRMED' as const,
        travelers: [
          {
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
            documents: [{
              documentType: 'PASSPORT' as const,
              number: 'AB123456',
              expiryDate: '2030-05-20',
              issuanceCountry: 'CA',
              nationality: 'CA',
              holder: true,
            }],
          },
        ],
        price: {
          currency: 'CAD',
          total: '1200.00',
          grandTotal: '1200.00',
        },
        payment: {
          method: 'CREDIT_CARD' as const,
          status: 'COMPLETED' as const,
          transactionId: 'txn_123456',
        },
        createdAt: '2024-11-15T10:00:00Z',
        updatedAt: '2024-11-15T10:05:00Z',
      };

      const result = FlightBookingSchema.parse(booking);
      expect(result.travelers).toHaveLength(1);
      expect(result.payment?.status).toBe('COMPLETED');
    });

    it('should validate booking without optional fields', () => {
      const booking = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        flightOfferId: 'offer_123',
        status: 'PENDING' as const,
        travelers: [
          {
            id: '1',
            dateOfBirth: '1990-01-15',
            name: {
              firstName: 'Jane',
              lastName: 'Smith',
            },
            gender: 'FEMALE' as const,
            contact: {
              emailAddress: 'jane.smith@example.com',
              phones: [{
                deviceType: 'MOBILE' as const,
                countryCallingCode: '44',
                number: '7700900000',
              }],
            },
          },
        ],
        price: {
          currency: 'GBP',
          total: '800.00',
          grandTotal: '800.00',
        },
        createdAt: '2024-11-15T10:00:00Z',
        updatedAt: '2024-11-15T10:00:00Z',
      };

      const result = FlightBookingSchema.parse(booking);
      expect(result.bookingReference).toBeUndefined();
      expect(result.payment).toBeUndefined();
      expect(result.travelers[0].documents).toBeUndefined();
    });
  });
});