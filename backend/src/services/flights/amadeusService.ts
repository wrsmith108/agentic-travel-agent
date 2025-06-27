/**
 * Amadeus Flight Search Service
 * Integrates with Amadeus API for flight searches
 */

import Amadeus from 'amadeus';
import { Result, ok, err } from '@/utils/result';
import { env } from '@/config/env';
import {
  FlightSearchRequest,
  FlightSearchResponse,
  SimplifiedFlight,
  FlightSearchError,
  createFlightError,
  FlightOffer,
  DictionaryData,
} from '@/types/flight';

// Initialize Amadeus client
const amadeus = new Amadeus({
  clientId: env.AMADEUS_CLIENT_ID || '',
  clientSecret: env.AMADEUS_CLIENT_SECRET || '',
});

// Log initialization for debugging
console.log('Amadeus client initialized with environment:', env.AMADEUS_ENVIRONMENT);

/**
 * Search for flights using Amadeus API
 */
export const searchFlights = async (
  searchParams: FlightSearchRequest
): Promise<Result<SimplifiedFlight[], FlightSearchError>> => {
  try {
    // Build search parameters
    const params: any = {
      originLocationCode: searchParams.origin,
      destinationLocationCode: searchParams.destination,
      departureDate: searchParams.departureDate,
      adults: searchParams.adults,
      currencyCode: searchParams.currencyCode,
      max: searchParams.maxResults,
    };

    // Add optional parameters
    if (searchParams.returnDate) {
      params.returnDate = searchParams.returnDate;
    }
    
    if (searchParams.children > 0) {
      params.children = searchParams.children;
    }
    
    if (searchParams.infants > 0) {
      params.infants = searchParams.infants;
    }
    
    if (searchParams.travelClass !== 'ECONOMY') {
      params.travelClass = searchParams.travelClass;
    }
    
    if (searchParams.nonStop) {
      params.nonStop = true;
    }
    
    if (searchParams.maxPrice) {
      params.maxPrice = searchParams.maxPrice;
    }

    // Call Amadeus API
    const response = await amadeus.shopping.flightOffersSearch.get(params);

    if (!response.data || response.data.length === 0) {
      return ok([]);
    }

    // Parse and simplify the flight data
    const simplifiedFlights = parseFlightOffers(
      response.data,
      response.result.dictionaries
    );

    return ok(simplifiedFlights);
  } catch (error: any) {
    console.error('Amadeus API error:', error);
    
    // Handle specific Amadeus errors
    if (error.response?.statusCode === 429) {
      return err(createFlightError(
        'RATE_LIMIT',
        'Too many requests. Please try again later.'
      ));
    }
    
    if (error.response?.statusCode === 401) {
      return err(createFlightError(
        'AUTHENTICATION_ERROR',
        'Authentication with flight search service failed.'
      ));
    }
    
    if (error.response?.statusCode === 400) {
      const errorDetail = error.response?.result?.errors?.[0];
      return err(createFlightError(
        'VALIDATION_ERROR',
        errorDetail?.detail || 'Invalid search parameters',
        errorDetail
      ));
    }
    
    return err(createFlightError(
      'API_ERROR',
      error.message || 'Failed to search flights',
      error.code
    ));
  }
};

/**
 * Get flight details by offer ID
 */
export const getFlightOffer = async (
  offerId: string
): Promise<Result<FlightOffer, FlightSearchError>> => {
  try {
    const response = await amadeus.shopping.flightOffer(offerId).get();
    
    if (!response.data) {
      return err(createFlightError('NOT_FOUND', 'Flight offer not found'));
    }

    return ok(response.data);
  } catch (error: any) {
    console.error('Amadeus API error:', error);
    
    if (error.response?.statusCode === 404) {
      return err(createFlightError('NOT_FOUND', 'Flight offer not found'));
    }
    
    return err(createFlightError(
      'API_ERROR',
      error.message || 'Failed to get flight details'
    ));
  }
};

/**
 * Confirm flight price (required before booking)
 */
export const confirmFlightPrice = async (
  flightOffer: FlightOffer
): Promise<Result<FlightOffer, FlightSearchError>> => {
  try {
    const response = await amadeus.shopping.flightOffers.pricing.post({
      data: {
        type: 'flight-offers-pricing',
        flightOffers: [flightOffer],
      },
    });
    
    if (!response.data?.flightOffers?.[0]) {
      return err(createFlightError('API_ERROR', 'Failed to confirm price'));
    }

    return ok(response.data.flightOffers[0]);
  } catch (error: any) {
    console.error('Amadeus API error:', error);
    
    return err(createFlightError(
      'API_ERROR',
      error.message || 'Failed to confirm flight price'
    ));
  }
};

/**
 * Get airport and city information
 */
export const getLocationInfo = async (
  iataCode: string
): Promise<Result<any, FlightSearchError>> => {
  try {
    const response = await amadeus.referenceData.locations.get({
      keyword: iataCode,
      subType: 'AIRPORT',
    });
    
    if (!response.data || response.data.length === 0) {
      return err(createFlightError('NOT_FOUND', 'Location not found'));
    }

    return ok(response.data[0]);
  } catch (error: any) {
    console.error('Amadeus API error:', error);
    
    return err(createFlightError(
      'API_ERROR',
      error.message || 'Failed to get location info'
    ));
  }
};

/**
 * Search for airports by keyword
 */
export const searchAirports = async (
  keyword: string
): Promise<Result<any[], FlightSearchError>> => {
  try {
    const response = await amadeus.referenceData.locations.get({
      keyword,
      subType: 'AIRPORT',
    });
    
    return ok(response.data || []);
  } catch (error: any) {
    console.error('Amadeus API error:', error);
    
    return err(createFlightError(
      'API_ERROR',
      error.message || 'Failed to search airports'
    ));
  }
};

/**
 * Parse and simplify flight offers
 */
function parseFlightOffers(
  flightOffers: FlightOffer[],
  dictionaries?: DictionaryData
): SimplifiedFlight[] {
  return flightOffers.map(offer => {
    const firstItinerary = offer.itineraries[0];
    const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
    
    const firstSegment = firstItinerary.segments[0];
    const lastSegment = lastItinerary.segments[lastItinerary.segments.length - 1];
    
    // Calculate total stops
    const totalStops = offer.itineraries.reduce(
      (sum, itinerary) => sum + (itinerary.segments.length - 1),
      0
    );
    
    // Get carrier name from dictionary or use code
    const carrierCode = firstSegment.carrierCode;
    const carrierName = dictionaries?.carriers?.[carrierCode] || carrierCode;
    
    // Get cabin class from first traveler pricing
    const cabin = offer.travelerPricings[0]?.fareDetailsBySegment[0]?.cabin || 'ECONOMY';
    
    // Simplify all segments
    const segments = offer.itineraries.flatMap(itinerary =>
      itinerary.segments.map(segment => ({
        origin: segment.departure.iataCode,
        destination: segment.arrival.iataCode,
        departure: segment.departure.at,
        arrival: segment.arrival.at,
        carrier: segment.carrierCode,
        flightNumber: `${segment.carrierCode}${segment.number}`,
        duration: segment.duration,
      }))
    );

    return {
      id: offer.id,
      origin: firstSegment.departure.iataCode,
      destination: lastSegment.arrival.iataCode,
      departureTime: firstSegment.departure.at,
      arrivalTime: lastSegment.arrival.at,
      duration: offer.itineraries.map(it => it.duration).join(' + '),
      stops: totalStops,
      carrier: carrierCode,
      carrierName,
      price: {
        total: parseFloat(offer.price.grandTotal),
        currency: offer.price.currency,
      },
      cabin,
      bookableSeats: offer.numberOfBookableSeats,
      isReturn: offer.itineraries.length > 1,
      segments,
    };
  });
}

/**
 * Format duration from ISO 8601 to human readable
 */
export function formatDuration(isoDuration: string): string {
  // Parse ISO 8601 duration (e.g., PT2H30M)
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return isoDuration;
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  } else if (hours) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format price with currency
 */
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}