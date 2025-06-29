/**
 * Conversational Search Service
 * Natural language interface for flight searches using Claude AI
 */

import Anthropic from '@anthropic-ai/sdk';
import { createTimestamp } from '@/services/auth/functional/types';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err } from '../../utils/result';
import { isOk, isErr } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { getRedisClient } from '../redis/redisClient';
import { flightSearchService } from '../flights/flightSearchService';
import { enhancedAmadeusService } from '../flights/enhancedAmadeusService';
import {
  FlightSearchQuery,
  AdvancedSearchOptions,
  NaturalLanguageSearch,
  validateNaturalLanguageSearch,
} from '../../schemas/flight';
import { UserFlightPreferences } from '../../models/flight';

// Conversation context stored per session
interface ConversationContext {
  sessionId: string;
  userId?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  currentSearch?: FlightSearchQuery;
  searchHistory: FlightSearchQuery[];
  preferences?: UserFlightPreferences;
  lastUpdated: string;
}

// Parsed intent from natural language
interface ParsedIntent {
  action: 'search' | 'modify' | 'clarify' | 'save' | 'book' | 'help';
  searchQuery?: Partial<FlightSearchQuery>;
  modifiers?: {
    flexibleDates?: boolean;
    priceLimit?: number;
    preferNonStop?: boolean;
    specificAirlines?: string[];
  };
  clarificationNeeded?: {
    field: string;
    reason: string;
    suggestions?: string[];
  };
}

// System prompt for Claude
const TRAVEL_AGENT_PROMPT = `You are an expert travel agent AI assistant specializing in flight searches. Your role is to help users find the best flights by understanding their natural language requests and converting them into structured search queries.

Key responsibilities:
1. Extract flight search parameters from natural language (origin, destination, dates, passengers)
2. Ask clarifying questions when information is missing or ambiguous
3. Provide helpful suggestions based on user preferences and search context
4. Explain flight options clearly with prices, durations, and recommendations

When parsing user queries:
- Identify city names and convert to IATA codes when possible
- Parse flexible date preferences (e.g., "sometime in December", "next weekend")
- Understand passenger counts and types (adults, children, infants)
- Detect budget constraints and preferences
- Recognize airline preferences or restrictions

Always maintain a friendly, professional tone and provide specific, actionable information.

Output format for search queries:
- Use JSON format for structured data
- Include confidence levels for ambiguous inputs
- Suggest alternatives when appropriate`;

export class ConversationalSearchService {
  private anthropic: Anthropic;
  private redisClient: ReturnType<typeof getRedisClient>;
  private conversationTTL: number = 24 * 60 * 60; // 24 hours

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY || '',
    });
    this.redisClient = getRedisClient();
  }

  /**
   * Process a natural language search query
   */
  async processQuery(
    query: NaturalLanguageSearch,
    userId?: string
  ): Promise<Result<{
    response: string;
    searchResults?: any;
    suggestions?: string[];
    sessionId: string;
  }, AppError>> {
    try {
      // Validate input
      const validated = validateNaturalLanguageSearch(query);

      // Get or create conversation context
      const context = await this.getOrCreateContext(validated.sessionId, userId);
      
      // Add user message to context
      context.messages.push({
        role: 'user',
        content: validated.query,
        timestamp: createTimestamp(),
      });

      // Parse intent and extract search parameters
      const intent = await this.parseIntent(validated.query, context);

      // Handle different intents
      let response: string;
      let searchResults: any;
      let suggestions: string[] = [];

      switch (intent.action) {
        case 'search':
          const searchResult = await this.handleSearchIntent(intent, context);
          response = searchResult.response;
          searchResults = searchResult.results;
          suggestions = searchResult.suggestions;
          break;

        case 'modify':
          const modifyResult = await this.handleModifyIntent(intent, context);
          response = modifyResult.response;
          searchResults = modifyResult.results;
          break;

        case 'clarify':
          response = await this.handleClarifyIntent(intent, context);
          suggestions = intent.clarificationNeeded?.suggestions || [];
          break;

        case 'save':
          response = await this.handleSaveIntent(context, userId);
          break;

        case 'book':
          response = await this.handleBookingIntent(context);
          break;

        case 'help':
        default:
          response = this.getHelpResponse();
          suggestions = this.getCommonSearchExamples();
      }

      // Add assistant response to context
      context.messages.push({
        role: 'assistant',
        content: response,
        timestamp: createTimestamp(),
      });

      // Save updated context
      await this.saveContext(context);

      return ok({
        response,
        searchResults,
        suggestions,
        sessionId: context.sessionId,
      });
    } catch (error) {
      console.error('Conversational search error:', error);
      return err(new AppError(500, 'Failed to process query', ErrorCodes.SERVICE_ERROR));
    }
  }

  /**
   * Parse user intent from natural language
   */
  private async parseIntent(query: string, context: ConversationContext): Promise<ParsedIntent> {
    try {
      const systemPrompt = `${TRAVEL_AGENT_PROMPT}

Current conversation context:
- Previous searches: ${JSON.stringify(context.searchHistory.slice(-3))}
- Current search: ${JSON.stringify(context.currentSearch)}
- User preferences: ${JSON.stringify(context.preferences)}

Parse the user's query and return a JSON response with:
{
  "action": "search|modify|clarify|save|book|help",
  "searchQuery": {
    "originLocationCode": "XXX",
    "destinationLocationCode": "XXX", 
    "departureDate": "YYYY-MM-DD",
    "returnDate": "YYYY-MM-DD",
    "adults": 1,
    "children": 0,
    "infants": 0,
    "travelClass": "ECONOMY|PREMIUM_ECONOMY|BUSINESS|FIRST",
    "nonStop": true/false
  },
  "modifiers": {
    "flexibleDates": true/false,
    "priceLimit": 1000,
    "preferNonStop": true/false,
    "specificAirlines": ["XX", "YY"]
  },
  "clarificationNeeded": {
    "field": "fieldName",
    "reason": "explanation",
    "suggestions": ["option1", "option2"]
  }
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: query,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { action: 'help' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and convert airport codes if needed
      if (parsed.searchQuery) {
        await this.validateAndConvertAirportCodes(parsed.searchQuery);
      }

      return parsed;
    } catch (error) {
      console.error('Intent parsing error:', error);
      return { action: 'help' };
    }
  }

  /**
   * Handle search intent
   */
  private async handleSearchIntent(
    intent: ParsedIntent,
    context: ConversationContext
  ): Promise<{ response: string; results?: any; suggestions: string[] }> {
    if (!intent.searchQuery || !this.isCompleteSearchQuery(intent.searchQuery)) {
      return {
        response: 'I need more information to search for flights. ' + this.getMissingFieldsMessage(intent.searchQuery),
        suggestions: this.getSearchSuggestions(intent.searchQuery),
      };
    }

    // Convert to full search query
    const searchQuery: FlightSearchQuery = {
      originLocationCode: intent.searchQuery.originLocationCode!,
      destinationLocationCode: intent.searchQuery.destinationLocationCode!,
      departureDate: intent.searchQuery.departureDate!,
      returnDate: intent.searchQuery.returnDate,
      adults: intent.searchQuery.adults || 1,
      children: intent.searchQuery.children || 0,
      infants: intent.searchQuery.infants || 0,
      travelClass: intent.searchQuery.travelClass,
      nonStop: intent.searchQuery.nonStop,
      max: 10,
    };

    // Apply modifiers
    const advancedOptions: AdvancedSearchOptions = {};
    if (intent.modifiers?.flexibleDates) {
      advancedOptions.flexibleDates = {
        enabled: true,
        daysBefore: 3,
        daysAfter: 3,
      };
    }
    if (intent.modifiers?.priceLimit) {
      advancedOptions.priceRange = {
        min: 0,
        max: intent.modifiers.priceLimit,
      };
    }

    // Perform search
    const searchResult = await flightSearchService.searchFlights(
      searchQuery,
      context.userId,
      context.preferences,
      advancedOptions
    );

    if (!isOk(searchResult)) {
      return {
        response: 'I encountered an error while searching for flights. Please try again or refine your search.',
        suggestions: ['Try different dates', 'Check airport codes', 'Reduce number of passengers'],
      };
    }

    const { flights, analytics } = (isOk(searchResult) ? searchResult.value : undefined);

    // Update context
    context.currentSearch = searchQuery;
    context.searchHistory.push(searchQuery);

    // Generate response
    const response = this.generateSearchResponse(flights, analytics, searchQuery);
    const suggestions = this.generateSearchSuggestions(flights, analytics);

    return { response, results: (isOk(searchResult) ? searchResult.value : undefined), suggestions };
  }

  /**
   * Handle modify intent
   */
  private async handleModifyIntent(
    intent: ParsedIntent,
    context: ConversationContext
  ): Promise<{ response: string; results?: any }> {
    if (!context.currentSearch) {
      return {
        response: 'I don\'t have a previous search to modify. Please start with a new flight search.',
      };
    }

    // Apply modifications to current search
    const modifiedSearch = {
      ...context.currentSearch,
      ...intent.searchQuery,
    };

    // Perform new search with modifications
    const searchResult = await flightSearchService.searchFlights(
      modifiedSearch,
      context.userId,
      context.preferences
    );

    if (!isOk(searchResult)) {
      return {
        response: 'I couldn\'t find flights with those modifications. Would you like to try different criteria?',
      };
    }

    const { flights, analytics } = (isOk(searchResult) ? searchResult.value : undefined);

    // Update context
    context.currentSearch = modifiedSearch;
    context.searchHistory.push(modifiedSearch);

    const response = this.generateModificationResponse(flights, analytics, intent.searchQuery);
    return { response, results: (isOk(searchResult) ? searchResult.value : undefined) };
  }

  /**
   * Handle clarification intent
   */
  private async handleClarifyIntent(intent: ParsedIntent, context: ConversationContext): Promise<string> {
    if (!intent.clarificationNeeded) {
      return 'I\'m not sure what you\'re asking. Could you please rephrase your question?';
    }

    const { field, reason, suggestions } = intent.clarificationNeeded;

    let response = `I need to clarify the ${field}. ${reason}`;
    
    if (suggestions && suggestions.length > 0) {
      response += '\n\nHere are some options:\n';
      suggestions.forEach((suggestion, index) => {
        response += `${index + 1}. ${suggestion}\n`;
      });
    }

    return response;
  }

  /**
   * Handle save intent
   */
  private async handleSaveIntent(context: ConversationContext, userId?: string): Promise<string> {
    if (!userId) {
      return 'You need to be logged in to save searches. Please sign in and try again.';
    }

    if (!context.currentSearch) {
      return 'I don\'t have a search to save. Please perform a flight search first.';
    }

    const result = await flightSearchService.createSavedSearch({
      userId,
      name: `${context.currentSearch.originLocationCode} to ${context.currentSearch.destinationLocationCode} - ${context.currentSearch.departureDate}`,
      searchQuery: context.currentSearch,
      priceAlerts: {
        enabled: true,
        percentDrop: 10,
      },
    });

    if (isOk(result)) {
      return `I've saved your search! I'll monitor prices and notify you if they drop by 10% or more. You can manage your saved searches in your account settings.`;
    }

    return 'I couldn\'t save your search right now. Please try again later.';
  }

  /**
   * Handle booking intent
   */
  private async handleBookingIntent(context: ConversationContext): Promise<string> {
    return `To book a flight, I'll need to redirect you to our secure booking page. Here's what you'll need:

1. Passenger information (names as on passport)
2. Contact details
3. Payment information

Would you like me to guide you through the booking process?`;
  }

  /**
   * Generate search response from results
   */
  private generateSearchResponse(
    flights: any[],
    analytics: any,
    query: FlightSearchQuery
  ): string {
    if (flights.length === 0) {
      return `I couldn't find any flights from ${query.originLocationCode} to ${query.destinationLocationCode} on ${query.departureDate}. 

Consider:
- Checking nearby airports
- Being flexible with your dates
- Removing the non-stop filter if applied`;
    }

    let response = `I found ${flights.length} flights from ${query.originLocationCode} to ${query.destinationLocationCode} on ${query.departureDate}.\n\n`;

    // Highlight best options
    if (analytics.cheapestOption) {
      const cheap = analytics.cheapestOption;
      response += `💰 **Cheapest Option**: ${cheap.price.currency} ${cheap.price.grandTotal} - ${cheap.itineraries[0].segments[0].carrierCode}\n`;
      response += `   Departs: ${this.formatTime(cheap.itineraries[0].segments[0].departure.at)}, Duration: ${this.formatDuration(cheap.itineraries[0].duration)}\n\n`;
    }

    if (analytics.fastestOption && analytics.fastestOption.id !== analytics.cheapestOption?.id) {
      const fast = analytics.fastestOption;
      response += `⚡ **Fastest Option**: ${fast.price.currency} ${fast.price.grandTotal} - ${fast.itineraries[0].segments[0].carrierCode}\n`;
      response += `   Duration: ${this.formatDuration(fast.itineraries[0].duration)}\n\n`;
    }

    if (analytics.bestValueOption) {
      const value = analytics.bestValueOption;
      response += `⭐ **Best Value**: ${value.price.currency} ${value.price.grandTotal} - ${value.itineraries[0].segments[0].carrierCode}\n`;
      response += `   Good balance of price and duration\n\n`;
    }

    // Add recommendations
    if (analytics.recommendations && analytics.recommendations.length > 0) {
      response += '💡 **Tips**:\n';
      analytics.recommendations.forEach((rec: string) => {
        response += `- ${rec}\n`;
      });
    }

    return response;
  }

  /**
   * Generate modification response
   */
  private generateModificationResponse(
    flights: any[],
    analytics: any,
    modifications: any
  ): string {
    let response = 'I\'ve updated your search';

    const modDetails: string[] = [];
    if (modifications.departureDate) modDetails.push(`new date: ${modifications.departureDate}`);
    if (modifications.travelClass) modDetails.push(`class: ${modifications.travelClass}`);
    if (modifications.nonStop !== undefined) modDetails.push(modifications.nonStop ? 'non-stop only' : 'including connections');

    if (modDetails.length > 0) {
      response += ` with ${modDetails.join(', ')}`;
    }
    response += '.\n\n';

    if (flights.length === 0) {
      response += 'No flights found with these criteria. Would you like to try different options?';
    } else {
      response += `Found ${flights.length} flights. `;
      if (analytics.priceRange) {
        response += `Prices range from ${analytics.priceRange.min} to ${analytics.priceRange.max} ${flights[0]?.price.currency || 'USD'}.`;
      }
    }

    return response;
  }

  /**
   * Get or create conversation context
   */
  private async getOrCreateContext(sessionId?: string, userId?: string): Promise<ConversationContext> {
    const id = sessionId || uuidv4();
    const key = `conversation:${id}`;

    const result = await this.redisClient.get(key);
    if (isOk(result) && result.value) {
      const context: ConversationContext = JSON.parse(result.value);
      context.lastUpdated = createTimestamp();
      return context;
    }

    // Create new context
    return {
      sessionId: id,
      userId,
      messages: [],
      searchHistory: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Save conversation context
   */
  private async saveContext(context: ConversationContext): Promise<void> {
    const key = `conversation:${context.sessionId}`;
    await this.redisClient.set(key, JSON.stringify(context), this.conversationTTL);
  }

  /**
   * Validate and convert airport codes
   */
  private async validateAndConvertAirportCodes(searchQuery: Partial<FlightSearchQuery>): Promise<void> {
    // If we have city names instead of IATA codes, convert them
    if (searchQuery.originLocationCode && searchQuery.originLocationCode.length > 3) {
      const result = await enhancedAmadeusService.searchAirports(searchQuery.originLocationCode);
      if (isOk(result) && result.value.length > 0) {
        searchQuery.originLocationCode = result.value[0].iataCode;
      }
    }

    if (searchQuery.destinationLocationCode && searchQuery.destinationLocationCode.length > 3) {
      const result = await enhancedAmadeusService.searchAirports(searchQuery.destinationLocationCode);
      if (isOk(result) && result.value.length > 0) {
        searchQuery.destinationLocationCode = result.value[0].iataCode;
      }
    }
  }

  /**
   * Check if search query is complete
   */
  private isCompleteSearchQuery(query: Partial<FlightSearchQuery>): boolean {
    return !!(
      query.originLocationCode &&
      query.destinationLocationCode &&
      query.departureDate
    );
  }

  /**
   * Get missing fields message
   */
  private getMissingFieldsMessage(query?: Partial<FlightSearchQuery>): string {
    const missing: string[] = [];
    
    if (!query?.originLocationCode) missing.push('departure city');
    if (!query?.destinationLocationCode) missing.push('destination city');
    if (!query?.departureDate) missing.push('departure date');

    return `Please provide: ${missing.join(', ')}.`;
  }

  /**
   * Get search suggestions based on partial query
   */
  private getSearchSuggestions(query?: Partial<FlightSearchQuery>): string[] {
    const suggestions: string[] = [];

    if (!query?.originLocationCode) {
      suggestions.push('Where are you departing from?');
    }
    if (!query?.destinationLocationCode) {
      suggestions.push('Where would you like to go?');
    }
    if (!query?.departureDate) {
      suggestions.push('When would you like to travel?');
    }
    if (!query?.adults) {
      suggestions.push('How many passengers?');
    }

    return suggestions;
  }

  /**
   * Generate search suggestions based on results
   */
  private generateSearchSuggestions(flights: any[], analytics: any): string[] {
    const suggestions: string[] = [];

    if (flights.length > 0) {
      suggestions.push('Try flexible dates for better prices');
      suggestions.push('Set up price alerts for this route');
      
      if (analytics.airlines?.length > 1) {
        suggestions.push(`Compare ${analytics.airlines[0].name} vs ${analytics.airlines[1]?.name || 'other airlines'}`);
      }
    }

    return suggestions;
  }

  /**
   * Format time for display
   */
  private formatTime(isoTime: string): string {
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  /**
   * Format duration for display
   */
  private formatDuration(isoDuration: string): string {
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
   * Get help response
   */
  private getHelpResponse(): string {
    return `I'm your AI travel assistant! I can help you:

🔍 **Search Flights**: Just tell me where and when you want to go
💰 **Find Deals**: I'll show you the best prices and options
📅 **Flexible Dates**: I can search multiple dates to find the best fares
💾 **Save Searches**: Save your searches and get price alerts
✈️ **Book Flights**: I'll guide you through the booking process

**Example searches:**
- "Find flights from New York to Paris in December"
- "I need a round trip to Tokyo next month for 2 people"
- "Show me cheap flights to anywhere warm in January"
- "Business class flights from London to Singapore"

What would you like to search for?`;
  }

  /**
   * Get common search examples
   */
  private getCommonSearchExamples(): string[] {
    return [
      'Flights from New York to London next week',
      'Cheapest flights to Paris in December',
      'Non-stop flights from LA to Tokyo',
      'Weekend trip to Miami for 2 adults',
      'Business class to Dubai in January',
    ];
  }
}

// Export singleton instance
export const conversationalSearchService = new ConversationalSearchService();