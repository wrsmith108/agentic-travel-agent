import { z } from 'zod';

export const CurrencyCodeSchema = z.enum(['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'AUD']);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export const TravelClassSchema = z.enum(['economy', 'premium-economy', 'business', 'first']);
export type TravelClass = z.infer<typeof TravelClassSchema>;

export const PassengerInfoSchema = z
  .object({
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(8),
    infants: z.number().int().min(0).max(2),
  })
  .refine((data) => data.infants <= data.adults, {
    message: 'Number of infants cannot exceed number of adults',
    path: ['infants'],
  });

export type PassengerInfo = z.infer<typeof PassengerInfoSchema>;

export const ValidationUtils = {
  isValidIATACode: (code: string): boolean => {
    return /^[A-Z]{3}$/.test(code);
  },

  isValidAirlineCode: (code: string): boolean => {
    return /^[A-Z0-9]{2,3}$/.test(code);
  },

  isValidCurrencyCode: (code: string): boolean => {
    return CurrencyCodeSchema.safeParse(code).success;
  },

  isFutureDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date > new Date();
  },

  isValidDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return false;
    }

    // Check if the date string represents the same date after parsing
    // This catches invalid dates like Feb 30
    const parsed = date.toISOString().split('T')[0];
    const input = dateString.split('T')[0];

    return input === parsed || dateString.includes('T');
  },

  isValidDateRange: (departureDate: string, returnDate?: string): boolean => {
    if (!ValidationUtils.isValidDate(departureDate)) {
      return false;
    }

    if (returnDate) {
      if (!ValidationUtils.isValidDate(returnDate)) {
        return false;
      }

      const departure = new Date(departureDate);
      const returnDt = new Date(returnDate);
      return returnDt >= departure;
    }

    return true;
  },

  isValidPassengerCombination: (passengers: PassengerInfo): boolean => {
    return PassengerInfoSchema.safeParse(passengers).success;
  },

  sanitizeString: (input: string): string => {
    return input.trim().replace(/</g, '').replace(/>/g, '');
  },

  isValidEmail: (email: string): boolean => {
    return z.string().email().safeParse(email).success;
  },

  isValidTimezone: (timezone: string): boolean => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  },

  isValidFlightNumber: (flightNumber: string): boolean => {
    const match = flightNumber.match(/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/);
    if (!match) return false;

    const digits = flightNumber.match(/\d+/);
    return digits ? digits[0].length <= 4 : false;
  },

  isValidPrice: (price: number): boolean => {
    return price > 0 && price <= 50000;
  },

  isValidDuration: (duration: string): boolean => {
    return /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.test(duration);
  },
};

export const validateFlightSearchRequest = (data: any) => {
  const schema = z
    .object({
      origin: z.string().min(3).max(3).refine(ValidationUtils.isValidIATACode, {
        message: 'Invalid IATA airport code',
      }),
      destination: z.string().min(3).max(3).refine(ValidationUtils.isValidIATACode, {
        message: 'Invalid IATA airport code',
      }),
      departureDate: z.string().refine(ValidationUtils.isFutureDate, {
        message: 'Departure date must be in the future',
      }),
      returnDate: z
        .string()
        .optional()
        .refine((val) => !val || ValidationUtils.isFutureDate(val), {
          message: 'Return date must be in the future',
        }),
      passengers: PassengerInfoSchema,
      travelClass: TravelClassSchema.optional(),
      maxPrice: z.number().positive().max(50000).optional(),
      currency: CurrencyCodeSchema.optional(),
      nonStop: z.boolean().optional(),
      includedAirlines: z
        .array(
          z.string().refine(ValidationUtils.isValidAirlineCode, {
            message: 'Invalid airline code',
          })
        )
        .optional(),
      excludedAirlines: z
        .array(
          z.string().refine(ValidationUtils.isValidAirlineCode, {
            message: 'Invalid airline code',
          })
        )
        .optional(),
    })
    .refine(
      (data) => {
        if (data.returnDate) {
          return ValidationUtils.isValidDateRange(data.departureDate, data.returnDate);
        }
        return true;
      },
      {
        message: 'Return date must be after departure date',
        path: ['returnDate'],
      }
    );

  return schema.parse(data);
};

export const validateUserPreferences = (data: any) => {
  const schema = z.object({
    currency: CurrencyCodeSchema.optional(),
    timezone: z
      .string()
      .refine(ValidationUtils.isValidTimezone, {
        message: 'Invalid timezone',
      })
      .optional(),
    preferredDepartureAirport: z
      .string()
      .min(3)
      .max(3)
      .refine(ValidationUtils.isValidIATACode, {
        message: 'Invalid IATA airport code',
      })
      .optional(),
    communicationFrequency: z.enum(['immediate', 'daily', 'weekly']).optional(),
  });

  return schema.parse(data);
};

export const ErrorMessages = {
  INVALID_IATA_CODE: 'Airport code must be a 3-letter IATA code (e.g., YYZ, JFK)',
  INVALID_AIRLINE_CODE: 'Airline code must be 2-3 alphanumeric characters (e.g., AC, UA, DL)',
  INVALID_CURRENCY_CODE: 'Currency must be one of: CAD, USD, EUR, GBP, JPY, AUD',
  INVALID_DATE: 'Invalid date format',
  PAST_DATE: 'Date must be in the future',
  INVALID_DATE_RANGE: 'Return date must be after departure date',
  INVALID_PASSENGER_COMBINATION: 'Invalid passenger combination. Infants cannot exceed adults',
  INVALID_PRICE: 'Price must be between 0 and 50,000',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_TIMEZONE: 'Invalid timezone identifier',
};

export const ValidationPatterns = {
  IATA_CODE: /^[A-Z]{3}$/,
  AIRLINE_CODE: /^[A-Z0-9]{2,3}$/,
  FLIGHT_NUMBER: /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/,
  ISO_DURATION: /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/,
  SAFE_STRING: /^[^<>]*$/,
};
