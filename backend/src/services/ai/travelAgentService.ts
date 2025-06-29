/**
 * AI Travel Agent Service
 * Comprehensive travel planning and assistance powered by Claude AI
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err } from '../../utils/result';
import { isOk, isErr } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { getRedisClient } from '../redis/redisClient';
import { flightSearchService } from '../flights/flightSearchService';
import { enhancedAmadeusService } from '../flights/enhancedAmadeusService';
import { conversationalSearchService } from './conversationalSearchService';
import createLogger from '../../utils/logger';
import {
  FlightSearchQuery, 
  FlightOffer,
  validateFlightSearchQuery
} from '../../schemas/flight';

const logger = (createLogger as any)('TravelAgentService');

// Travel planning types
export interface TripPlanRequest {
  destination?: string;
  origin?: string;
  duration?: {
    days: number;
    flexible?: boolean;
  };
  budget?: {
    total?: number;
    perDay?: number;
    currency?: string;
  };
  interests?: string[];
  travelStyle?: 'budget' | 'moderate' | 'luxury' | 'adventure' | 'relaxation' | 'cultural';
  dates?: {
    start?: string;
    end?: string;
    flexible?: boolean;
    avoidDates?: string[];
  };
  travelers?: {
    adults: number;
    children?: number;
    infants?: number;
    seniors?: boolean;
  };
  preferences?: {
    accommodation?: 'hotel' | 'hostel' | 'airbnb' | 'resort' | 'any';
    transportation?: 'flight' | 'train' | 'car' | 'bus' | 'any';
    activities?: string[];
    dietary?: string[];
    accessibility?: string[];
  };
  constraints?: {
    mustVisit?: string[];
    avoid?: string[];
    visaFree?: boolean;
    directFlightsOnly?: boolean;
  };
}

export interface Destination {
  name: string;
  country: string;
  code?: string;
  description: string;
  highlights: string[];
  bestTimeToVisit: string;
  averageCost: {
    perDay: number;
    currency: string;
    level: 'budget' | 'moderate' | 'expensive';
  };
  activities: string[];
  cuisine: string[];
  climate: string;
  safetyRating?: number;
  visaRequirement?: string;
  recommendedDuration?: string;
  nearbyAttractions?: string[];
}

export interface Itinerary {
  id: string;
  title: string;
  duration: {
    days: number;
    nights: number;
  };
  totalCost: {
    estimated: number;
    currency: string;
    breakdown: {
      flights?: number;
      accommodation?: number;
      activities?: number;
      food?: number;
      transportation?: number;
      other?: number;
    };
  };
  days: DayPlan[];
  transportation: TransportationPlan[];
  accommodation: AccommodationPlan[];
  tips: string[];
  packingList?: string[];
  weatherForecast?: string;
  emergencyContacts?: {
    localPolice?: string;
    embassy?: string;
    hospital?: string;
  };
}

export interface DayPlan {
  day: number;
  date?: string;
  title: string;
  description: string;
  activities: Activity[];
  meals: Meal[];
  transportation: LocalTransport[];
  accommodation?: string;
  notes?: string[];
  estimatedCost?: number;
}

export interface Activity {
  time: string;
  name: string;
  description: string;
  location: string;
  duration: string;
  cost?: number;
  bookingRequired?: boolean;
  bookingUrl?: string;
  tips?: string[];
}

export interface Meal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  restaurant?: string;
  cuisine?: string;
  estimatedCost?: number;
  recommendation?: string;
  dietaryOptions?: string[];
}

export interface LocalTransport {
  from: string;
  to: string;
  method: string;
  duration: string;
  cost?: number;
  notes?: string;
}

export interface TransportationPlan {
  type: 'flight' | 'train' | 'bus' | 'car' | 'ferry';
  from: string;
  to: string;
  date: string;
  details: any; // FlightOffer or other transport details
  cost: number;
  booked: boolean;
}

export interface AccommodationPlan {
  name: string;
  type: string;
  location: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  costPerNight: number;
  totalCost: number;
  amenities?: string[];
  bookingUrl?: string;
  confirmed: boolean;
}

export interface TravelAdvice {
  category: 'safety' | 'health' | 'culture' | 'money' | 'transportation' | 'general';
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  sources?: string[];
}

// AI prompts
const TRAVEL_AGENT_SYSTEM_PROMPT = `You are an expert travel agent AI assistant with deep knowledge of destinations, travel planning, and cultural insights. Your role is to help users plan amazing trips by providing personalized recommendations, detailed itineraries, and practical travel advice.

Key capabilities:
1. Destination recommendations based on interests, budget, and travel style
2. Detailed day-by-day itinerary creation
3. Budget estimation and cost optimization
4. Local insights and cultural tips
5. Transportation and accommodation suggestions
6. Activity and dining recommendations
7. Safety and health advice
8. Visa and documentation guidance

When creating travel plans:
- Consider the traveler's interests, budget, and constraints
- Provide realistic time estimates for activities
- Include a mix of popular attractions and hidden gems
- Account for transportation time between locations
- Suggest alternatives for different weather conditions
- Include practical tips for each destination
- Consider accessibility needs if mentioned
- Provide emergency contact information

Always maintain an enthusiastic, helpful tone while being practical and honest about potential challenges or considerations.`;

export class TravelAgentService {
  private anthropic: Anthropic;
  private redisClient: ReturnType<typeof getRedisClient>;
  private sessionTTL: number = 7 * 24 * 60 * 60; // 7 days

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY || '',
    });
    this.redisClient = getRedisClient();
  }

  /**
   * Get destination recommendations
   */
  async getDestinationRecommendations(
    request: TripPlanRequest
  ): Promise<Result<Destination[], AppError>> {
    try {
      logger.info('Getting destination recommendations', { request });

      const prompt = this.buildDestinationPrompt(request);
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        temperature: 0.7,
        system: TRAVEL_AGENT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const destinations = this.parseDestinationResponse(content.text);
      
      // Cache recommendations
      if (destinations.length > 0) {
        const cacheKey = `destinations:${this.generateCacheKey(request)}`;
        await this.redisClient.set(cacheKey, JSON.stringify(destinations), 3600); // 1 hour cache
      }

      logger.info('Generated destination recommendations', { 
        count: destinations.length,
        destinations: destinations.map(d => d.name),
      });

      return ok(destinations);
    } catch (error) {
      logger.error('Failed to get destination recommendations', { error });
      return err(new AppError(500, 'Failed to get recommendations', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Create a detailed itinerary
   */
  async createItinerary(
    request: TripPlanRequest,
    destination: string
  ): Promise<Result<Itinerary, AppError>> {
    try {
      logger.info('Creating itinerary', { request, destination });

      // Get flight options if origin is specified
      let flightOptions: FlightOffer[] = [];
      if (request.origin && request.dates?.start) {
        const flightSearch = await this.searchFlights(
          request.origin,
          destination,
          request.dates.start,
          request.dates.end,
          request.travelers
        );
        if (isOk(flightSearch)) {
          flightOptions = flightSearch.value;
        }
      }

      const prompt = this.buildItineraryPrompt(request, destination, flightOptions);
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0.6,
        system: TRAVEL_AGENT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const itinerary = this.parseItineraryResponse(content.text, destination);
      
      // Add flight information if available
      if (flightOptions.length > 0 && itinerary.transportation.length === 0) {
        const bestFlight = flightOptions[0]; // Assuming sorted by best value
        itinerary.transportation.push({
          type: 'flight',
          from: request.origin || 'Origin',
          to: destination,
          date: request.dates?.start || '',
          details: bestFlight,
          cost: parseFloat(bestFlight.price.grandTotal),
          booked: false,
        });
      }

      // Cache itinerary
      const cacheKey = `itinerary:${itinerary.id}`;
      await this.redisClient.set(cacheKey, JSON.stringify(itinerary), this.sessionTTL);

      logger.info('Created itinerary', { 
        id: itinerary.id,
        destination,
        days: itinerary.duration.days,
      });

      return ok(itinerary);
    } catch (error) {
      logger.error('Failed to create itinerary', { error });
      return err(new AppError(500, 'Failed to create itinerary', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Get travel advice for a destination
   */
  async getTravelAdvice(
    destination: string,
    categories?: string[]
  ): Promise<Result<TravelAdvice[], AppError>> {
    try {
      logger.info('Getting travel advice', { destination, categories });

      const prompt = `Provide comprehensive travel advice for ${destination}.
      ${categories ? `Focus on these categories: ${categories.join(', ')}` : 'Cover all important categories.'}
      
      Include:
      - Safety tips and areas to avoid
      - Health precautions and vaccinations
      - Cultural etiquette and customs
      - Money matters (currency, tipping, costs)
      - Transportation tips
      - Best time to visit
      - What to pack
      - Emergency contacts
      
      Format as JSON array of advice objects with category, title, content, and priority.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        temperature: 0.3,
        system: TRAVEL_AGENT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const advice = this.parseTravelAdvice(content.text);

      logger.info('Generated travel advice', { 
        destination,
        adviceCount: advice.length,
      });

      return ok(advice);
    } catch (error) {
      logger.error('Failed to get travel advice', { error });
      return err(new AppError(500, 'Failed to get travel advice', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Plan a multi-city trip
   */
  async planMultiCityTrip(
    cities: string[],
    request: TripPlanRequest
  ): Promise<Result<{
    route: string[];
    itineraries: Itinerary[];
    totalCost: number;
    transportation: TransportationPlan[];
  }, AppError>> {
    try {
      logger.info('Planning multi-city trip', { cities, request });

      // Optimize route
      const optimizedRoute = await this.optimizeRoute(cities, request.origin);
      
      // Create itineraries for each city
      const itineraries: Itinerary[] = [];
      const transportation: TransportationPlan[] = [];
      let totalCost = 0;

      for (let i = 0; i < optimizedRoute.length; i++) {
        const city = optimizedRoute[i];
        const daysPerCity = Math.floor((request.duration?.days || 7) / optimizedRoute.length);
        
        const cityRequest = {
          ...request,
          duration: { days: daysPerCity, flexible: true },
        };

        const itineraryResult = await this.createItinerary(cityRequest, city);
        if (isOk(itineraryResult)) {
          itineraries.push(itineraryResult.value);
          totalCost += itineraryResult.value.totalCost.estimated;
        }

        // Plan transportation to next city
        if (i < optimizedRoute.length - 1) {
          const nextCity = optimizedRoute[i + 1];
          const transportResult = await this.planTransportation(city, nextCity, {
            date: '', // Calculate based on itinerary
            budget: request.budget,
            preferences: request.preferences,
          });
          
          if (isOk(transportResult)) {
            transportation.push(...transportResult.value);
          }
        }
      }

      // Add return transportation if needed
      if (request.origin && optimizedRoute.length > 0) {
        const lastCity = optimizedRoute[optimizedRoute.length - 1];
        const returnTransport = await this.planTransportation(lastCity, request.origin, {
          date: request.dates?.end || '',
          budget: request.budget,
          preferences: request.preferences,
        });
        
        if (isOk(returnTransport)) {
          transportation.push(...returnTransport.value);
        }
      }

      logger.info('Planned multi-city trip', { 
        cities: optimizedRoute,
        totalCost,
        itineraryCount: itineraries.length,
      });

      return ok({
        route: optimizedRoute,
        itineraries,
        totalCost,
        transportation,
      });
    } catch (error) {
      logger.error('Failed to plan multi-city trip', { error });
      return err(new AppError(500, 'Failed to plan trip', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Get personalized travel tips
   */
  async getPersonalizedTips(
    destination: string,
    travelerProfile: {
      interests: string[];
      travelStyle: string;
      experience?: 'first-time' | 'occasional' | 'frequent';
      concerns?: string[];
    }
  ): Promise<Result<string[], AppError>> {
    try {
      logger.info('Getting personalized tips', { destination, travelerProfile });

      const prompt = `Provide personalized travel tips for ${destination} based on this traveler profile:
      - Interests: ${travelerProfile.interests.join(', ')}
      - Travel style: ${travelerProfile.travelStyle}
      - Experience: ${travelerProfile.experience || 'occasional'}
      ${travelerProfile.concerns ? `- Concerns: ${travelerProfile.concerns.join(', ')}` : ''}
      
      Provide 10-15 specific, actionable tips that would be most valuable for this traveler.
      Include insider tips, money-saving advice, and experiences that match their interests.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        temperature: 0.7,
        system: TRAVEL_AGENT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const tips = this.parseTips(content.text);

      logger.info('Generated personalized tips', { 
        destination,
        tipCount: tips.length,
      });

      return ok(tips);
    } catch (error) {
      logger.error('Failed to get personalized tips', { error });
      return err(new AppError(500, 'Failed to get tips', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Search for flights
   */
  private async searchFlights(
    origin: string,
    destination: string,
    departureDate: string,
    returnDate?: string,
    travelers?: any
  ): Promise<Result<FlightOffer[], AppError>> {
    try {
      // Convert city names to airport codes if needed
      const originCode = await this.getAirportCode(origin);
      const destCode = await this.getAirportCode(destination);

      const searchQuery: FlightSearchQuery = {
        originLocationCode: originCode,
        destinationLocationCode: destCode,
        departureDate,
        returnDate,
        adults: travelers?.adults || 1,
        children: travelers?.children || 0,
        infants: travelers?.infants || 0,
        max: 5, // Limit results for itinerary planning
      };

      const result = await flightSearchService.searchFlights(searchQuery);
      if (isOk(result)) {
        return ok(result.value.flights);
      }

      return ok([]); // Return empty array on error
    } catch (error) {
      logger.warn('Failed to search flights', { error });
      return ok([]);
    }
  }

  /**
   * Get airport code for a city
   */
  private async getAirportCode(location: string): Promise<string> {
    // Return as-is if already an airport code
    if (location.length === 3 && /^[A-Z]{3}$/.test(location)) {
      return location;
    }

    const result = await enhancedAmadeusService.searchAirports(location);
    if (isOk(result) && result.value.length > 0) {
      return isOk(result) ? result.value : null[0].iataCode;
    }

    // Fallback to common mappings
    const commonMappings: Record<string, string> = {
      'New York': 'JFK',
      'Los Angeles': 'LAX',
      'London': 'LHR',
      'Paris': 'CDG',
      'Tokyo': 'NRT',
      'Sydney': 'SYD',
      'Dubai': 'DXB',
      'Singapore': 'SIN',
      // Add more as needed
    };

    return commonMappings[location] || location.substring(0, 3).toUpperCase();
  }

  /**
   * Plan transportation between cities
   */
  private async planTransportation(
    from: string,
    to: string,
    options: any
  ): Promise<Result<TransportationPlan[], AppError>> {
    // For now, just search for flights
    const flightResult = await this.searchFlights(from, to, options.date);
    
    if (isOk(flightResult) && flightResult.value.length > 0) {
      const flight = isOk(flightResult) ? flightResult.value : null[0];
      return ok([{
        type: 'flight',
        from,
        to,
        date: options.date,
        details: flight,
        cost: parseFloat(flight.price.grandTotal),
        booked: false,
      }]);
    }

    // Fallback to estimated transport
    return ok([{
      type: 'flight',
      from,
      to,
      date: options.date,
      details: { estimated: true },
      cost: 500, // Placeholder estimate
      booked: false,
    }]);
  }

  /**
   * Optimize route for multi-city trip
   */
  private async optimizeRoute(cities: string[], origin?: string): Promise<string[]> {
    // Simple optimization - could be enhanced with actual distance calculations
    if (!origin) {
      return cities;
    }

    // For now, return cities in the order provided
    // TODO: Implement proper route optimization using geographic coordinates
    return cities;
  }

  /**
   * Build destination recommendation prompt
   */
  private buildDestinationPrompt(request: TripPlanRequest): string {
    const parts = ['I need destination recommendations for a trip with these preferences:'];
    
    if (request.duration) {
      parts.push(`- Duration: ${request.duration.days} days`);
    }
    if (request.budget) {
      parts.push(`- Budget: ${request.budget.currency || 'USD'} ${request.budget.total || request.budget.perDay + '/day'}`);
    }
    if (request.interests && request.interests.length > 0) {
      parts.push(`- Interests: ${request.interests.join(', ')}`);
    }
    if (request.travelStyle) {
      parts.push(`- Travel style: ${request.travelStyle}`);
    }
    if (request.dates?.start) {
      parts.push(`- Travel dates: ${request.dates.start} to ${request.dates.end || 'flexible'}`);
    }
    if (request.origin) {
      parts.push(`- Departing from: ${request.origin}`);
    }
    
    parts.push('\nProvide 3-5 destination recommendations in JSON format with name, country, description, highlights, activities, average daily cost, best time to visit, and other relevant details.');
    
    return parts.join('\n');
  }

  /**
   * Build itinerary creation prompt
   */
  private buildItineraryPrompt(
    request: TripPlanRequest,
    destination: string,
    flights: FlightOffer[]
  ): string {
    const parts = [`Create a detailed ${request.duration?.days || 7}-day itinerary for ${destination} with these requirements:`];
    
    if (request.budget) {
      parts.push(`- Budget: ${request.budget.currency || 'USD'} ${request.budget.total || request.budget.perDay + '/day'}`);
    }
    if (request.interests && request.interests.length > 0) {
      parts.push(`- Must include activities for: ${request.interests.join(', ')}`);
    }
    if (request.travelStyle) {
      parts.push(`- Travel style: ${request.travelStyle}`);
    }
    if (request.travelers) {
      parts.push(`- Travelers: ${request.travelers.adults} adults${request.travelers.children ? `, ${request.travelers.children} children` : ''}`);
    }
    if (request.preferences?.accommodation) {
      parts.push(`- Accommodation preference: ${request.preferences.accommodation}`);
    }
    
    parts.push('\nCreate a day-by-day plan in JSON format including:');
    parts.push('- Daily activities with times and descriptions');
    parts.push('- Restaurant recommendations for each meal');
    parts.push('- Transportation between locations');
    parts.push('- Accommodation suggestions');
    parts.push('- Estimated costs');
    parts.push('- Practical tips and notes');
    
    if (flights.length > 0) {
      parts.push(`\nNote: Flight options are available from ${flights[0].price.currency} ${flights[0].price.grandTotal}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Parse destination recommendations from AI response
   */
  private parseDestinationResponse(text: string): Destination[] {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.parseDestinationsFallback(text);
      }

      const destinations = JSON.parse(jsonMatch[0]);
      return destinations.map((dest: any) => ({
        name: dest.name || 'Unknown',
        country: dest.country || 'Unknown',
        code: dest.code,
        description: dest.description || '',
        highlights: dest.highlights || [],
        bestTimeToVisit: dest.bestTimeToVisit || 'Year-round',
        averageCost: {
          perDay: dest.averageCost?.perDay || 100,
          currency: dest.averageCost?.currency || 'USD',
          level: dest.averageCost?.level || 'moderate',
        },
        activities: dest.activities || [],
        cuisine: dest.cuisine || [],
        climate: dest.climate || 'Varied',
        safetyRating: dest.safetyRating,
        visaRequirement: dest.visaRequirement,
        recommendedDuration: dest.recommendedDuration,
        nearbyAttractions: dest.nearbyAttractions,
      }));
    } catch (error) {
      logger.warn('Failed to parse destination JSON, using fallback', { error });
      return this.parseDestinationsFallback(text);
    }
  }

  /**
   * Fallback parser for destinations
   */
  private parseDestinationsFallback(text: string): Destination[] {
    // Simple fallback - extract destination names from text
    const destinations: Destination[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('1.') || line.includes('2.') || line.includes('3.')) {
        const match = line.match(/\d\.\s*([^:,]+)/);
        if (match) {
          destinations.push({
            name: match[1].trim(),
            country: 'Various',
            description: 'Recommended destination',
            highlights: ['Explore local attractions', 'Experience culture', 'Enjoy cuisine'],
            bestTimeToVisit: 'Check local seasons',
            averageCost: {
              perDay: 100,
              currency: 'USD',
              level: 'moderate',
            },
            activities: ['Sightseeing', 'Dining', 'Shopping'],
            cuisine: ['Local specialties'],
            climate: 'Varied',
          });
        }
      }
    }
    
    return destinations;
  }

  /**
   * Parse itinerary from AI response
   */
  private parseItineraryResponse(text: string, destination: string): Itinerary {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultItinerary(destination);
      }

      const data = JSON.parse(jsonMatch[0]);
      return {
        id: uuidv4(),
        title: data.title || `${destination} Adventure`,
        duration: data.duration || { days: 7, nights: 6 },
        totalCost: data.totalCost || this.estimateTotalCost(data),
        days: data.days || this.createDefaultDays(7),
        transportation: data.transportation || [],
        accommodation: data.accommodation || [],
        tips: data.tips || ['Book activities in advance', 'Learn basic local phrases'],
        packingList: data.packingList,
        weatherForecast: data.weatherForecast,
        emergencyContacts: data.emergencyContacts,
      };
    } catch (error) {
      logger.warn('Failed to parse itinerary JSON, using default', { error });
      return this.createDefaultItinerary(destination);
    }
  }

  /**
   * Parse travel advice from AI response
   */
  private parseTravelAdvice(text: string): TravelAdvice[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.createDefaultAdvice();
      }

      const advice = JSON.parse(jsonMatch[0]);
      return advice.map((item: any) => ({
        category: item.category || 'general',
        title: item.title || 'Travel Tip',
        content: item.content || '',
        priority: item.priority || 'medium',
        sources: item.sources,
      }));
    } catch (error) {
      logger.warn('Failed to parse advice JSON, using defaults', { error });
      return this.createDefaultAdvice();
    }
  }

  /**
   * Parse tips from AI response
   */
  private parseTips(text: string): string[] {
    const tips: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned && (cleaned.match(/^\d+\./) || cleaned.startsWith('-') || cleaned.startsWith('•'))) {
        const tip = cleaned.replace(/^[\d\.\-\•\*]+\s*/, '').trim();
        if (tip.length > 10) {
          tips.push(tip);
        }
      }
    }
    
    return tips.length > 0 ? tips : [
      'Research local customs before arrival',
      'Keep copies of important documents',
      'Download offline maps',
      'Learn basic local phrases',
      'Check visa requirements well in advance',
    ];
  }

  /**
   * Create default itinerary structure
   */
  private createDefaultItinerary(destination: string): Itinerary {
    return {
      id: uuidv4(),
      title: `${destination} Experience`,
      duration: { days: 7, nights: 6 },
      totalCost: {
        estimated: 2000,
        currency: 'USD',
        breakdown: {
          accommodation: 700,
          activities: 500,
          food: 500,
          transportation: 300,
        },
      },
      days: this.createDefaultDays(7),
      transportation: [],
      accommodation: [],
      tips: [
        'Book accommodations in advance',
        'Research local transportation options',
        'Check weather forecast before packing',
        'Have local currency on hand',
      ],
    };
  }

  /**
   * Create default day plans
   */
  private createDefaultDays(count: number): DayPlan[] {
    const days: DayPlan[] = [];
    
    for (let i = 1; i <= count; i++) {
      days.push({
        day: i,
        title: `Day ${i} - Explore`,
        description: 'Discover local attractions and culture',
        activities: [
          {
            time: '09:00',
            name: 'Morning Activity',
            description: 'Start your day with a local experience',
            location: 'City Center',
            duration: '2 hours',
          },
          {
            time: '14:00',
            name: 'Afternoon Exploration',
            description: 'Visit popular attractions',
            location: 'Various',
            duration: '3 hours',
          },
        ],
        meals: [
          { type: 'breakfast', restaurant: 'Hotel or local café' },
          { type: 'lunch', restaurant: 'Local restaurant' },
          { type: 'dinner', restaurant: 'Recommended dining spot' },
        ],
        transportation: [],
        estimatedCost: 200,
      });
    }
    
    return days;
  }

  /**
   * Create default travel advice
   */
  private createDefaultAdvice(): TravelAdvice[] {
    return [
      {
        category: 'safety',
        title: 'Stay Safe',
        content: 'Keep valuables secure, stay aware of surroundings, use reputable transportation',
        priority: 'high',
      },
      {
        category: 'health',
        title: 'Health Precautions',
        content: 'Check vaccination requirements, pack basic medications, stay hydrated',
        priority: 'high',
      },
      {
        category: 'money',
        title: 'Money Matters',
        content: 'Notify banks of travel, have multiple payment methods, keep emergency cash',
        priority: 'medium',
      },
      {
        category: 'culture',
        title: 'Cultural Etiquette',
        content: 'Research local customs, dress appropriately, learn basic greetings',
        priority: 'medium',
      },
    ];
  }

  /**
   * Estimate total cost from itinerary data
   */
  private estimateTotalCost(data: any): any {
    const breakdown: any = {
      accommodation: 0,
      activities: 0,
      food: 0,
      transportation: 0,
      other: 0,
    };

    // Estimate from days
    if (data.days) {
      for (const day of data.days) {
        breakdown.activities += day.estimatedCost || 100;
        breakdown.food += 50; // Daily food estimate
      }
    }

    // Add accommodation
    if (data.accommodation) {
      for (const hotel of data.accommodation) {
        breakdown.accommodation += hotel.totalCost || 100;
      }
    }

    const total = Object.values(breakdown).reduce((sum: number, val: any) => sum + val, 0);

    return {
      estimated: total,
      currency: 'USD',
      breakdown,
    };
  }

  /**
   * Generate cache key for requests
   */
  private generateCacheKey(request: any): string {
    const key = JSON.stringify({
      budget: request.budget?.total,
      interests: request.interests?.sort(),
      style: request.travelStyle,
      duration: request.duration?.days,
    });
    return Buffer.from(key).toString('base64').substring(0, 20);
  }
}

// Export singleton instance
export const travelAgentService = new TravelAgentService();