// Flight-related TypeScript definitions

export interface FlightSearchRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  class: 'economy' | 'premium_economy' | 'business' | 'first';
  tripType: 'one_way' | 'round_trip';
}

export interface FlightOption {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: {
    amount: number;
    currency: string;
  };
  availability: number;
  aircraft: string;
  class: string;
}

export interface FlightSearchResponse {
  searchId: string;
  request: FlightSearchRequest;
  results: FlightOption[];
  totalResults: number;
  searchTime: string;
  currency: string;
}

export interface FlightDetails {
  id: string;
  searchId: string;
  option: FlightOption;
  detailedItinerary: FlightSegment[];
  baggage: BaggageInfo;
  policies: FlightPolicies;
  lastUpdated: string;
}

export interface FlightSegment {
  segmentId: string;
  airline: string;
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  aircraft: string;
  terminal?: string;
  gate?: string;
}

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  terminal?: string;
}

export interface BaggageInfo {
  carry_on: {
    included: boolean;
    weight?: string;
    dimensions?: string;
  };
  checked: {
    included: boolean;
    weight?: string;
    fee?: number;
  };
}

export interface FlightPolicies {
  cancellation: {
    allowed: boolean;
    fee?: number;
    timeLimit?: string;
  };
  changes: {
    allowed: boolean;
    fee?: number;
    timeLimit?: string;
  };
  refund: {
    allowed: boolean;
    conditions?: string;
  };
}