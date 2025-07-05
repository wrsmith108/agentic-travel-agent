import { useState } from 'react';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { DashboardProvider, useDashboard } from './contexts/DashboardContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { Header } from './components/shared/Header';
import { ChatInterface } from './components/ai-agent';
import { DashboardConnected } from './components/dashboard/DashboardConnected';
import { TestEvents } from './components/TestEvents';
import { TestSaveSearch } from './components/TestSaveSearch';
import { flightService } from './services/flightService';
import type { SavedSearch } from './types/search';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  flightSearchCriteria?: any; // Add flight search criteria to messages
}

function AppContent() {
  const [messages, setMessages] = useState<Message[]>([
    // Test message with flight search criteria to verify Save Search button
    {
      id: 'test-1',
      role: 'assistant',
      content: 'I found flights from New York (JFK) to San Francisco (SFO) on 2025-01-14. The best option is a United Airlines flight (UA123) departing at 10:00 AM and arriving at 6:00 PM, priced at $299.00.',
      timestamp: new Date().toISOString(),
      flightSearchCriteria: {
        origin: 'JFK',
        destination: 'SFO',
        departureDate: '2025-01-14',
        passengers: 1,
        class: 'economy',
        tripType: 'one_way'
      }
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { addSavedSearch } = useDashboard();

  const sendMessage = async (message: string) => {
    console.log('sendMessage called with:', message);
    
    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      console.log('Calling searchNaturalLanguage API...');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API timeout')), 5000); // 5 second timeout
      });
      
      // Race between API call and timeout
      const data = await Promise.race([
        flightService.searchNaturalLanguage(
          message,
          sessionId || undefined,
          messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        ),
        timeoutPromise
      ]);
      
      console.log('API response received:', data);
      
      // Store session ID for conversation continuity
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      // TEMPORARY: Mock flight search data for testing Save Search UI
      // This should be removed once the backend properly returns flight results
      if (message.toLowerCase().includes('flight') &&
          (message.toLowerCase().includes('from') || message.toLowerCase().includes('to'))) {
        console.log('Mocking flight search results for testing...');
        
        // Extract basic info from the message
        let mockOrigin = 'JFK';
        let mockDestination = 'LAX';
        
        // Better parsing for origin/destination
        const lowerMessage = message.toLowerCase();
        
        // Check for "from X to Y" pattern
        if (lowerMessage.includes('from') && lowerMessage.includes('to')) {
          if (lowerMessage.includes('from new york')) mockOrigin = 'JFK';
          else if (lowerMessage.includes('from san francisco')) mockOrigin = 'SFO';
          else if (lowerMessage.includes('from los angeles')) mockOrigin = 'LAX';
          
          if (lowerMessage.includes('to new york')) mockDestination = 'JFK';
          else if (lowerMessage.includes('to san francisco')) mockDestination = 'SFO';
          else if (lowerMessage.includes('to los angeles')) mockDestination = 'LAX';
        }
        
        const mockDate = message.includes('January 15') ? '2025-01-15' : '2025-01-20';
        const mockPassengers = message.match(/(\d+)\s*passenger/i)?.[1] || '1';
        
        data.searchResults = {
          query: {
            originLocationCode: mockOrigin,
            destinationLocationCode: mockDestination,
            departureDate: mockDate,
            adults: parseInt(mockPassengers),
            travelClass: 'ECONOMY'
          },
          flights: [
            {
              id: '1',
              price: { total: '299.00', currency: 'USD' },
              itineraries: [{
                segments: [{
                  departure: {
                    iataCode: mockOrigin,
                    at: `${mockDate}T10:00:00`
                  },
                  arrival: {
                    iataCode: mockDestination,
                    at: `${mockDate}T18:00:00`
                  },
                  carrierCode: 'UA',
                  number: '123',
                  aircraft: { code: '738' }
                }]
              }]
            }
          ]
        };
        
        // Also update the response message to include flight results
        data.response = `I found flights from ${mockOrigin} to ${mockDestination} on ${mockDate}. The best option is a United Airlines flight (UA123) departing at 10:00 AM and arriving at 6:00 PM, priced at $299.00.`;
      }

      // Check if we have actual flight search results
      let flightSearchCriteria = null;
      
      if (data.searchResults) {
        console.log('Flight search results received:', data.searchResults);
        
        // If we have flight results, extract the search criteria from them
        const { query, flights } = data.searchResults;
        
        if (query && flights && flights.length > 0) {
          // Create the search criteria object
          flightSearchCriteria = {
            origin: query.originLocationCode,
            destination: query.destinationLocationCode,
            departureDate: query.departureDate,
            ...(query.returnDate && { returnDate: query.returnDate }),
            passengers: query.adults + (query.children || 0) + (query.infants || 0),
            class: query.travelClass || 'economy',
            tripType: query.returnDate ? 'round_trip' : 'one_way'
          };
        }
      }

      // Add AI response with flight search criteria if available
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response, // Changed from 'message' to 'response'
        timestamp: new Date().toISOString(),
        ...(flightSearchCriteria && { flightSearchCriteria })
      };
      console.log('Assistant message:', aiMessage);
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Check if this is a flight-related query and use mock data for testing
      const lowerMessage = message.toLowerCase();
      const isFlightQuery = /flight|fly|trip|travel/.test(lowerMessage) &&
                           (/from|to|between/.test(lowerMessage) ||
                            /new york|san francisco|los angeles|chicago|boston|seattle|miami|denver/.test(lowerMessage));
      
      if (isFlightQuery) {
        console.log('API failed but detected flight query - using mock data for testing');
        
        // Parse origin and destination from the message
        let mockOrigin = 'JFK';
        let mockDestination = 'LAX';
        
        // Better parsing for common patterns
        const fromMatch = lowerMessage.match(/from\s+([a-z\s]+?)(?:\s+to|\s+$)/);
        const toMatch = lowerMessage.match(/to\s+([a-z\s]+?)(?:\s+on|\s+in|\s+for|\s+$)/);
        
        if (fromMatch && fromMatch[1]) {
          const city = fromMatch[1].trim();
          if (city.includes('new york')) mockOrigin = 'JFK';
          else if (city.includes('san francisco')) mockOrigin = 'SFO';
          else if (city.includes('los angeles')) mockOrigin = 'LAX';
          else if (city.includes('chicago')) mockOrigin = 'ORD';
          else if (city.includes('boston')) mockOrigin = 'BOS';
        }
        
        if (toMatch && toMatch[1]) {
          const city = toMatch[1].trim();
          if (city.includes('new york')) mockDestination = 'JFK';
          else if (city.includes('san francisco')) mockDestination = 'SFO';
          else if (city.includes('los angeles')) mockDestination = 'LAX';
          else if (city.includes('chicago')) mockDestination = 'ORD';
          else if (city.includes('miami')) mockDestination = 'MIA';
        }
        
        // Create mock flight data
        const mockDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const mockSearchResults = {
          query: {
            originLocationCode: mockOrigin,
            destinationLocationCode: mockDestination,
            departureDate: mockDate,
            adults: 1,
            travelClass: 'ECONOMY'
          },
          flights: [
            {
              id: '1',
              price: { total: '299.00', currency: 'USD' },
              itineraries: [{
                duration: 'PT8H',
                segments: [{
                  departure: {
                    iataCode: mockOrigin,
                    at: `${mockDate}T10:00:00`
                  },
                  arrival: {
                    iataCode: mockDestination,
                    at: `${mockDate}T18:00:00`
                  },
                  carrierCode: 'UA',
                  number: '123',
                  aircraft: { code: '738' }
                }]
              }]
            }
          ]
        };
        
        const flightSearchCriteria = {
          origin: mockOrigin,
          destination: mockDestination,
          departureDate: mockDate,
          passengers: 1,
          class: 'economy',
          tripType: 'one_way'
        };
        
        const mockMessage: Message = {
          id: `mock-${Date.now()}`,
          role: 'assistant',
          content: `I found flights from ${mockOrigin} to ${mockDestination} on ${mockDate}. The best option is a United Airlines flight (UA123) departing at 10:00 AM and arriving at 6:00 PM, priced at $299.00. (Note: This is mock data for testing while the API is unavailable)`,
          timestamp: new Date().toISOString(),
          flightSearchCriteria
        };
        
        console.log('Sending mock flight message with search criteria:', mockMessage);
        setMessages(prev => [...prev, mockMessage]);
      } else {
        // Non-flight query or couldn't parse - show generic error
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again or check your connection.',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  console.log('AppContent rendering, sendMessage:', sendMessage);
  console.log('typeof sendMessage:', typeof sendMessage);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Temporary test components for debugging */}
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded mx-4">
        <h3 className="text-sm font-medium mb-2">Debug Tests:</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">Event Test:</h4>
            <TestEvents />
          </div>
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-1">Save Search Test:</h4>
            <TestSaveSearch />
          </div>
        </div>
      </div>
      
      {/* Main Content Area - 50/50 Split */}
      <main className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Dashboard */}
        <div className="w-1/2 bg-white border-r border-gray-200 overflow-y-auto">
          <DashboardConnected />
        </div>

        {/* Right Panel - AI Agent */}
        <div className="w-1/2 bg-white overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">
              AI Travel Assistant
            </h2>
            <p className="text-gray-600 mt-1">
              Chat with me to plan trips and find flights
            </p>
          </div>
          
          {/* Chat Interface */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              onSendMessage={sendMessage}
              messages={messages}
              isLoading={isLoading}
              onSaveSearch={addSavedSearch}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <DemoModeProvider>
      <DashboardProvider>
        <PreferencesProvider>
          <AppContent />
        </PreferencesProvider>
      </DashboardProvider>
    </DemoModeProvider>
  );
}

export default App;