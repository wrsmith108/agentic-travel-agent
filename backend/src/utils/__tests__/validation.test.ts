import { describe, it, expect } from '@jest/globals';
import {
  ValidationUtils,
  validateFlightSearchRequest,
  validateUserPreferences,
  CurrencyCode,
  TravelClass,
  PassengerInfo,
  ErrorMessages,
  ValidationPatterns,
} from '../validation';

describe('ValidationUtils', () => {
  describe('isValidIATACode', () => {
    it('should validate correct IATA codes', () => {
      expect(ValidationUtils.isValidIATACode('YYZ')).toBe(true);
      expect(ValidationUtils.isValidIATACode('JFK')).toBe(true);
      expect(ValidationUtils.isValidIATACode('LAX')).toBe(true);
      expect(ValidationUtils.isValidIATACode('NRT')).toBe(true);
    });

    it('should reject invalid IATA codes', () => {
      expect(ValidationUtils.isValidIATACode('YY')).toBe(false);
      expect(ValidationUtils.isValidIATACode('YYYY')).toBe(false);
      expect(ValidationUtils.isValidIATACode('123')).toBe(false);
      expect(ValidationUtils.isValidIATACode('yyz')).toBe(false);
      expect(ValidationUtils.isValidIATACode('Y Z')).toBe(false);
      expect(ValidationUtils.isValidIATACode('')).toBe(false);
    });
  });

  describe('isValidAirlineCode', () => {
    it('should validate correct 2-character airline codes', () => {
      expect(ValidationUtils.isValidAirlineCode('AC')).toBe(true);
      expect(ValidationUtils.isValidAirlineCode('UA')).toBe(true);
      expect(ValidationUtils.isValidAirlineCode('DL')).toBe(true);
      expect(ValidationUtils.isValidAirlineCode('B6')).toBe(true);
    });

    it('should validate correct 3-character airline codes', () => {
      expect(ValidationUtils.isValidAirlineCode('ACA')).toBe(true);
      expect(ValidationUtils.isValidAirlineCode('UAL')).toBe(true);
      expect(ValidationUtils.isValidAirlineCode('DAL')).toBe(true);
    });

    it('should reject invalid airline codes', () => {
      expect(ValidationUtils.isValidAirlineCode('A')).toBe(false);
      expect(ValidationUtils.isValidAirlineCode('ABCD')).toBe(false);
      expect(ValidationUtils.isValidAirlineCode('ab')).toBe(false);
      expect(ValidationUtils.isValidAirlineCode('A ')).toBe(false);
      expect(ValidationUtils.isValidAirlineCode('')).toBe(false);
    });
  });

  describe('isValidCurrencyCode', () => {
    it('should validate supported currency codes', () => {
      expect(ValidationUtils.isValidCurrencyCode('CAD')).toBe(true);
      expect(ValidationUtils.isValidCurrencyCode('USD')).toBe(true);
      expect(ValidationUtils.isValidCurrencyCode('EUR')).toBe(true);
      expect(ValidationUtils.isValidCurrencyCode('GBP')).toBe(true);
      expect(ValidationUtils.isValidCurrencyCode('JPY')).toBe(true);
      expect(ValidationUtils.isValidCurrencyCode('AUD')).toBe(true);
    });

    it('should reject unsupported currency codes', () => {
      expect(ValidationUtils.isValidCurrencyCode('CHF')).toBe(false);
      expect(ValidationUtils.isValidCurrencyCode('CNY')).toBe(false);
      expect(ValidationUtils.isValidCurrencyCode('ABC')).toBe(false);
      expect(ValidationUtils.isValidCurrencyCode('usd')).toBe(false);
      expect(ValidationUtils.isValidCurrencyCode('')).toBe(false);
    });
  });

  describe('isFutureDate', () => {
    it('should validate future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(ValidationUtils.isFutureDate(tomorrow.toISOString())).toBe(true);

      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      expect(ValidationUtils.isFutureDate(nextYear.toISOString())).toBe(true);
    });

    it('should reject past and current dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(ValidationUtils.isFutureDate(yesterday.toISOString())).toBe(false);

      const now = new Date();
      expect(ValidationUtils.isFutureDate(now.toISOString())).toBe(false);
    });

    it('should reject invalid dates', () => {
      expect(ValidationUtils.isFutureDate('invalid-date')).toBe(false);
      expect(ValidationUtils.isFutureDate('')).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should validate correct date strings', () => {
      expect(ValidationUtils.isValidDate('2025-06-25T10:00:00Z')).toBe(true);
      expect(ValidationUtils.isValidDate('2025-12-31')).toBe(true);
      expect(ValidationUtils.isValidDate(new Date().toISOString())).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(ValidationUtils.isValidDate('invalid-date')).toBe(false);
      expect(ValidationUtils.isValidDate('2025-13-01')).toBe(false);
      expect(ValidationUtils.isValidDate('2025-02-30')).toBe(false);
      expect(ValidationUtils.isValidDate('')).toBe(false);
    });
  });

  describe('isValidDateRange', () => {
    it('should validate correct date ranges', () => {
      const departure = '2025-07-01T10:00:00Z';
      const returnDate = '2025-07-08T10:00:00Z';
      expect(ValidationUtils.isValidDateRange(departure, returnDate)).toBe(true);

      expect(ValidationUtils.isValidDateRange(departure, departure)).toBe(true);
    });

    it('should validate one-way trips', () => {
      const departure = '2025-07-01T10:00:00Z';
      expect(ValidationUtils.isValidDateRange(departure)).toBe(true);
    });

    it('should reject invalid date ranges', () => {
      const departure = '2025-07-08T10:00:00Z';
      const returnDate = '2025-07-01T10:00:00Z';
      expect(ValidationUtils.isValidDateRange(departure, returnDate)).toBe(false);

      expect(ValidationUtils.isValidDateRange('invalid-date', '2025-07-01')).toBe(false);
      expect(ValidationUtils.isValidDateRange('2025-07-01', 'invalid-date')).toBe(false);
    });
  });

  describe('isValidPassengerCombination', () => {
    it('should validate correct passenger combinations', () => {
      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 1,
          children: 0,
          infants: 0,
        })
      ).toBe(true);

      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 2,
          children: 2,
          infants: 1,
        })
      ).toBe(true);

      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 9,
          children: 0,
          infants: 0,
        })
      ).toBe(true);
    });

    it('should reject invalid passenger combinations', () => {
      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 1,
          children: 0,
          infants: 2,
        })
      ).toBe(false);

      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 0,
          children: 1,
          infants: 0,
        })
      ).toBe(false);

      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 10,
          children: 0,
          infants: 0,
        })
      ).toBe(false);

      expect(
        ValidationUtils.isValidPassengerCombination({
          adults: 1,
          children: 9,
          infants: 0,
        })
      ).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(ValidationUtils.sanitizeString('<script>alert()</script>')).toBe(
        'script>alert()/script>'
      );
      expect(ValidationUtils.sanitizeString('Hello <b>World</b>')).toBe('Hello b>World/b>');
    });

    it('should trim whitespace', () => {
      expect(ValidationUtils.sanitizeString('  hello  ')).toBe('hello');
      expect(ValidationUtils.sanitizeString('\n\ttest\n\t')).toBe('test');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(ValidationUtils.isValidEmail('user@example.com')).toBe(true);
      expect(ValidationUtils.isValidEmail('test.user+tag@company.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(ValidationUtils.isValidEmail('invalid-email')).toBe(false);
      expect(ValidationUtils.isValidEmail('@example.com')).toBe(false);
      expect(ValidationUtils.isValidEmail('user@')).toBe(false);
      expect(ValidationUtils.isValidEmail('')).toBe(false);
    });
  });

  describe('isValidTimezone', () => {
    it('should validate correct timezones', () => {
      expect(ValidationUtils.isValidTimezone('America/Toronto')).toBe(true);
      expect(ValidationUtils.isValidTimezone('Europe/London')).toBe(true);
      expect(ValidationUtils.isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(ValidationUtils.isValidTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(ValidationUtils.isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(ValidationUtils.isValidTimezone('America/InvalidCity')).toBe(false);
      expect(ValidationUtils.isValidTimezone('')).toBe(false);
    });
  });

  describe('isValidFlightNumber', () => {
    it('should validate correct flight numbers', () => {
      expect(ValidationUtils.isValidFlightNumber('AC123')).toBe(true);
      expect(ValidationUtils.isValidFlightNumber('UA1234')).toBe(true);
      expect(ValidationUtils.isValidFlightNumber('DL999A')).toBe(true);
      expect(ValidationUtils.isValidFlightNumber('B61')).toBe(true);
      expect(ValidationUtils.isValidFlightNumber('ACA123')).toBe(true);
    });

    it('should reject invalid flight numbers', () => {
      expect(ValidationUtils.isValidFlightNumber('A')).toBe(false);
      expect(ValidationUtils.isValidFlightNumber('AC')).toBe(false);
      expect(ValidationUtils.isValidFlightNumber('AC12345')).toBe(false);
      expect(ValidationUtils.isValidFlightNumber('1234')).toBe(false);
      expect(ValidationUtils.isValidFlightNumber('')).toBe(false);
    });
  });

  describe('isValidPrice', () => {
    it('should validate correct prices', () => {
      expect(ValidationUtils.isValidPrice(100)).toBe(true);
      expect(ValidationUtils.isValidPrice(1)).toBe(true);
      expect(ValidationUtils.isValidPrice(49999.99)).toBe(true);
      expect(ValidationUtils.isValidPrice(50000)).toBe(true);
    });

    it('should reject invalid prices', () => {
      expect(ValidationUtils.isValidPrice(0)).toBe(false);
      expect(ValidationUtils.isValidPrice(-100)).toBe(false);
      expect(ValidationUtils.isValidPrice(50001)).toBe(false);
      expect(ValidationUtils.isValidPrice(Infinity)).toBe(false);
      expect(ValidationUtils.isValidPrice(NaN)).toBe(false);
    });
  });

  describe('isValidDuration', () => {
    it('should validate correct ISO 8601 durations', () => {
      expect(ValidationUtils.isValidDuration('PT3H30M')).toBe(true);
      expect(ValidationUtils.isValidDuration('P1D')).toBe(true);
      expect(ValidationUtils.isValidDuration('PT1H')).toBe(true);
      expect(ValidationUtils.isValidDuration('P2DT3H30M')).toBe(true);
      expect(ValidationUtils.isValidDuration('PT45M')).toBe(true);
    });

    it('should reject invalid durations', () => {
      expect(ValidationUtils.isValidDuration('3h30m')).toBe(false);
      expect(ValidationUtils.isValidDuration('invalid')).toBe(false);
      expect(ValidationUtils.isValidDuration('')).toBe(false);
    });
  });
});

describe('validateFlightSearchRequest', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  it('should validate correct flight search request', () => {
    const validRequest = {
      origin: 'YYZ',
      destination: 'LAX',
      departureDate: tomorrow.toISOString(),
      returnDate: nextWeek.toISOString(),
      passengers: {
        adults: 1,
        children: 0,
        infants: 0,
      },
      travelClass: 'economy' as TravelClass,
      maxPrice: 1000,
      currency: 'CAD' as CurrencyCode,
    };

    expect(() => validateFlightSearchRequest(validRequest)).not.toThrow();
  });

  it('should validate one-way flight request', () => {
    const validRequest = {
      origin: 'JFK',
      destination: 'LHR',
      departureDate: tomorrow.toISOString(),
      passengers: {
        adults: 2,
        children: 1,
        infants: 0,
      },
    };

    expect(() => validateFlightSearchRequest(validRequest)).not.toThrow();
  });

  it('should reject invalid IATA codes', () => {
    const invalidRequest = {
      origin: 'YY',
      destination: 'LAX',
      departureDate: tomorrow.toISOString(),
      passengers: { adults: 1, children: 0, infants: 0 },
    };

    expect(() => validateFlightSearchRequest(invalidRequest)).toThrow();
  });

  it('should reject past departure dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const invalidRequest = {
      origin: 'YYZ',
      destination: 'LAX',
      departureDate: yesterday.toISOString(),
      passengers: { adults: 1, children: 0, infants: 0 },
    };

    expect(() => validateFlightSearchRequest(invalidRequest)).toThrow();
  });

  it('should reject return date before departure', () => {
    const invalidRequest = {
      origin: 'YYZ',
      destination: 'LAX',
      departureDate: nextWeek.toISOString(),
      returnDate: tomorrow.toISOString(),
      passengers: { adults: 1, children: 0, infants: 0 },
    };

    expect(() => validateFlightSearchRequest(invalidRequest)).toThrow();
  });

  it('should validate airline filters', () => {
    const validRequest = {
      origin: 'YYZ',
      destination: 'LAX',
      departureDate: tomorrow.toISOString(),
      passengers: { adults: 1, children: 0, infants: 0 },
      includedAirlines: ['AC', 'UA', 'DL'],
      excludedAirlines: ['B6', 'F9'],
    };

    expect(() => validateFlightSearchRequest(validRequest)).not.toThrow();
  });
});

describe('validateUserPreferences', () => {
  it('should validate correct user preferences', () => {
    const validPreferences = {
      currency: 'CAD' as CurrencyCode,
      timezone: 'America/Toronto',
      preferredDepartureAirport: 'YYZ',
      communicationFrequency: 'daily' as const,
    };

    expect(() => validateUserPreferences(validPreferences)).not.toThrow();
  });

  it('should validate partial preferences', () => {
    const partialPreferences = {
      currency: 'USD' as CurrencyCode,
    };

    expect(() => validateUserPreferences(partialPreferences)).not.toThrow();
  });

  it('should reject invalid timezone', () => {
    const invalidPreferences = {
      timezone: 'Invalid/Timezone',
    };

    expect(() => validateUserPreferences(invalidPreferences)).toThrow();
  });

  it('should reject invalid IATA code', () => {
    const invalidPreferences = {
      preferredDepartureAirport: 'INVALID',
    };

    expect(() => validateUserPreferences(invalidPreferences)).toThrow();
  });
});

describe('ErrorMessages', () => {
  it('should have all required error messages', () => {
    expect(ErrorMessages.INVALID_IATA_CODE).toBeDefined();
    expect(ErrorMessages.INVALID_AIRLINE_CODE).toBeDefined();
    expect(ErrorMessages.INVALID_CURRENCY_CODE).toBeDefined();
    expect(ErrorMessages.INVALID_DATE).toBeDefined();
    expect(ErrorMessages.PAST_DATE).toBeDefined();
    expect(ErrorMessages.INVALID_DATE_RANGE).toBeDefined();
    expect(ErrorMessages.INVALID_PASSENGER_COMBINATION).toBeDefined();
    expect(ErrorMessages.INVALID_PRICE).toBeDefined();
    expect(ErrorMessages.INVALID_EMAIL).toBeDefined();
    expect(ErrorMessages.INVALID_TIMEZONE).toBeDefined();
  });
});

describe('ValidationPatterns', () => {
  it('should have all required regex patterns', () => {
    expect(ValidationPatterns.IATA_CODE).toBeDefined();
    expect(ValidationPatterns.AIRLINE_CODE).toBeDefined();
    expect(ValidationPatterns.FLIGHT_NUMBER).toBeDefined();
    expect(ValidationPatterns.ISO_DURATION).toBeDefined();
    expect(ValidationPatterns.SAFE_STRING).toBeDefined();
  });

  it('should correctly match patterns', () => {
    expect('YYZ').toMatch(ValidationPatterns.IATA_CODE);
    expect('AC').toMatch(ValidationPatterns.AIRLINE_CODE);
    expect('AC123').toMatch(ValidationPatterns.FLIGHT_NUMBER);
    expect('PT3H30M').toMatch(ValidationPatterns.ISO_DURATION);
    expect('Hello World').toMatch(ValidationPatterns.SAFE_STRING);
  });
});
