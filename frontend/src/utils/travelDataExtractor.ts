import type { FlightSearchRequest } from '../types/flight';
import type { PriceAlertRequest } from '../types/priceAlert';
import { parseDateToISO } from './dateParser';

interface ExtractedTravelData {
  searchRequest?: Partial<FlightSearchRequest>;
  priceAlert?: Partial<PriceAlertRequest>;
  confidence: number;
  extractedFields: string[];
  ambiguousFields: string[];
}

interface ExtractionConfig {
  airportCodes: RegExp;
  cityNames: RegExp;
  datePatterns: RegExp[];
  pricePatterns: RegExp[];
  passengerPatterns: RegExp[];
  classKeywords: string[];
  tripTypeIndicators: string[];
}

const EXTRACTION_PATTERNS: ExtractionConfig = {
  airportCodes: /\b[A-Z]{3}\b/g,
  cityNames: /(?:from|to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  datePatterns: [
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    /\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(?:tomorrow|today|yesterday)\b/gi
  ],
  pricePatterns: [
    /(?:under|below|less than|<)\s*[$£€¥]\s*(\d+)/gi,
    /[$£€¥]\s*(\d+)\s*(?:or less|max|maximum)/gi,
    /(?:budget|price|cost)\s*(?:of|around|about)?\s*[$£€¥]\s*(\d+)/gi
  ],
  passengerPatterns: [
    /(?:for|with)?\s*(\d+)\s*(?:passengers?|people|adults?|travelers?)/gi,
    /(\d+)\s*(?:passenger|person|adult|traveler)/gi,
    /group\s+of\s+(\d+)/gi,
    /party\s+of\s+(\d+)/gi
  ],
  classKeywords: ['economy', 'business', 'first', 'premium', 'coach'],
  tripTypeIndicators: ['round trip', 'return', 'returning', 'one way', 'single', 'roundtrip']
};


export const extractTravelData = (text: string): ExtractedTravelData => {
  console.log('🔍 Extracting travel data from:', text);
  const result: ExtractedTravelData = {
    confidence: 0,
    extractedFields: [],
    ambiguousFields: []
  };

  // Extract airports and cities
  const airports = text.match(EXTRACTION_PATTERNS.airportCodes) || [];
  console.log('🛫 Airport codes found:', airports);
  
  // Extract cities using proper regex with capture groups
  const cityMatches = [...text.matchAll(EXTRACTION_PATTERNS.cityNames)];
  const cities = cityMatches.map(match => match[1]).filter(Boolean);
  console.log('🏙️ City matches found:', cityMatches);
  console.log('🏙️ Cities extracted:', cities);
  
  // Try simpler extraction for "from X to Y" pattern
  const simpleFromToPattern = /(?:from|FROM)\s+([A-Za-z\s]+?)\s+(?:to|TO)\s+([A-Za-z\s]+?)(?:\s+on|\s+in|\s*$|\s+for)/i;
  const simpleMatch = text.match(simpleFromToPattern);
  console.log('🎯 Simple from-to match:', simpleMatch);
  
  if (airports.length >= 2 && airports[0] && airports[1]) {
    result.searchRequest = {
      origin: airports[0],
      destination: airports[1]
    };
    result.extractedFields.push('origin', 'destination');
  } else if (cities.length >= 2 && cities[0] && cities[1]) {
    result.searchRequest = {
      origin: cities[0].trim(),
      destination: cities[1].trim()
    };
    result.extractedFields.push('origin', 'destination');
  } else if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
    // Fallback to simple pattern match
    result.searchRequest = {
      origin: simpleMatch[1].trim(),
      destination: simpleMatch[2].trim()
    };
    result.extractedFields.push('origin', 'destination');
    console.log('✅ Using simple pattern fallback:', { origin: simpleMatch[1].trim(), destination: simpleMatch[2].trim() });
  }

  // Extract dates
  const dates: string[] = [];
  EXTRACTION_PATTERNS.datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) dates.push(...matches);
  });

  if (dates.length > 0 && dates[0]) {
    if (!result.searchRequest) result.searchRequest = {};
    // Parse date to ISO format
    const parsedDepartureDate = parseDateToISO(dates[0]);
    result.searchRequest.departureDate = parsedDepartureDate;
    result.extractedFields.push('departureDate');
    console.log(`📅 Parsed departure date: ${dates[0]} -> ${parsedDepartureDate}`);
    
    // Only set return date if we have MORE than one date and they're different
    if (dates.length > 1 && dates[1] && dates[1] !== dates[0]) {
      const parsedReturnDate = parseDateToISO(dates[1]);
      result.searchRequest.returnDate = parsedReturnDate;
      result.extractedFields.push('returnDate');
      console.log(`📅 Parsed return date: ${dates[1]} -> ${parsedReturnDate}`);
    }
  }

  // Extract passenger count
  let passengerCount = 1; // Default to 1 passenger
  EXTRACTION_PATTERNS.passengerPatterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        const count = parseInt(match[1]);
        if (!isNaN(count) && count > 0) {
          passengerCount = Math.max(passengerCount, count);
        }
      }
    });
  });

  // Always include passengers field for FlightSearchRequest compatibility
  if (!result.searchRequest) result.searchRequest = {};
  result.searchRequest.passengers = passengerCount;
  result.extractedFields.push('passengers');

  // Extract price information
  for (const pricePattern of EXTRACTION_PATTERNS.pricePatterns) {
    const priceMatches = [...text.matchAll(pricePattern)];
    if (priceMatches.length > 0) {
      const firstMatch = priceMatches[0];
      if (firstMatch && firstMatch[1]) {
        const price = parseInt(firstMatch[1]);
        if (!isNaN(price)) {
          result.priceAlert = {
            targetPrice: price,
            name: `Price Alert for ${result.searchRequest?.origin || 'Flight'}`
          };
          result.extractedFields.push('targetPrice');
          break; // Stop after first successful extraction
        }
      }
    }
  }

  // Extract travel class
  const classMatch = EXTRACTION_PATTERNS.classKeywords.find(keyword => 
    text.toLowerCase().includes(keyword)
  );
  if (classMatch) {
    if (!result.searchRequest) result.searchRequest = {};
    result.searchRequest.class = classMatch === 'coach' ? 'economy' : classMatch as any;
    result.extractedFields.push('class');
  }

  // Extract trip type with intelligent inference
  let tripTypeValue: 'round_trip' | 'one_way' | undefined;
  const tripTypeIndicator = EXTRACTION_PATTERNS.tripTypeIndicators.find(indicator =>
    text.toLowerCase().includes(indicator)
  );
  
  if (tripTypeIndicator) {
    tripTypeValue = tripTypeIndicator.includes('round') || tripTypeIndicator.includes('return')
      ? 'round_trip' : 'one_way';
  } else {
    // Intelligent fallback: if we have a return date, assume round trip
    if (result.searchRequest?.returnDate) {
      tripTypeValue = 'round_trip';
    } else {
      // Default to round trip as it's most common for travel planning
      tripTypeValue = 'round_trip';
    }
  }
  
  if (!result.searchRequest) result.searchRequest = {};
  result.searchRequest.tripType = tripTypeValue;
  result.extractedFields.push('tripType');

  // Calculate confidence score (0-1 range) with smarter weighting
  // Essential fields: origin, destination, departureDate = 70% of confidence
  // Optional fields: returnDate, class, tripType, targetPrice, passengers = 30% of confidence
  const essentialFields = ['origin', 'destination', 'departureDate'];
  const optionalFields = ['returnDate', 'class', 'tripType', 'targetPrice', 'passengers'];
  
  const essentialScore = essentialFields.filter(field => result.extractedFields.includes(field)).length / essentialFields.length;
  const optionalScore = optionalFields.filter(field => result.extractedFields.includes(field)).length / optionalFields.length;
  
  // Weight: 70% essential + 30% optional
  result.confidence = (essentialScore * 0.7) + (optionalScore * 0.3);
  
  console.log('📊 Extraction results:', {
    extractedFields: result.extractedFields,
    essentialScore,
    optionalScore,
    finalConfidence: result.confidence,
    searchRequest: result.searchRequest
  });

  return result;
};

export type { ExtractedTravelData };