import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { AgentMessage } from './AgentMessage';
import { SaveSearchModal } from './SaveSearchModal';
import type { FlightSearchRequest } from '@/types/flight';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  flightSearchCriteria?: FlightSearchRequest; // Optional flight search data
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string) => Promise<void>;
  messages?: Message[];
  isLoading?: boolean;
  onSaveSearch?: (search: any) => Promise<void>;
}

export const ChatInterface = ({
  onSendMessage,
  messages = [],
  isLoading = false,
  onSaveSearch
}: ChatInterfaceProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false);
  const [currentSearchCriteria, setCurrentSearchCriteria] = useState<FlightSearchRequest | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debug: Monitor onSendMessage prop
  useEffect(() => {
    console.log('ChatInterface mounted/updated - onSendMessage:', onSendMessage);
    console.log('typeof onSendMessage:', typeof onSendMessage);
  }, [onSendMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Form submitted!');
    console.log('inputMessage:', inputMessage);
    console.log('onSendMessage:', onSendMessage);
    
    if (!inputMessage.trim() || isSending || !onSendMessage) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    try {
      console.log('Calling onSendMessage with:', message);
      await onSendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    console.log('Input changed:', e.target.value);
    setInputMessage(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    console.log('Key down:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('Enter pressed without shift, submitting form');
      const form = e.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handlePromptClick = (prompt: string) => {
    console.log('Prompt clicked:', prompt);
    setInputMessage(prompt);
    // Focus the input after setting the prompt
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Sample starter prompts
  const starterPrompts = [
    "I'm looking for flights to Europe this summer",
    "Help me plan a weekend getaway",
    "What are the best destinations for a family vacation?",
    "I need to find cheap flights to Japan"
  ];

  // Extract flight search criteria from messages
  useEffect(() => {
    console.log('ChatInterface: Checking messages for flight search criteria', messages);
    
    // Look for the most recent message with flight search criteria
    const recentFlightMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.flightSearchCriteria);

    console.log('ChatInterface: Found flight message:', recentFlightMessage);
    
    if (recentFlightMessage && recentFlightMessage.flightSearchCriteria) {
      console.log('ChatInterface: Setting currentSearchCriteria:', recentFlightMessage.flightSearchCriteria);
      setCurrentSearchCriteria(recentFlightMessage.flightSearchCriteria);
    }
  }, [messages]);

  const handleSaveSearch = () => {
    console.log('handleSaveSearch called, currentSearchCriteria:', currentSearchCriteria);
    if (currentSearchCriteria) {
      setShowSaveSearchModal(true);
    }
  };

  const handleSaveSearchSuccess = () => {
    // Could show a success toast here
    console.log('Search saved successfully!');
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          /* Welcome State */
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Hi! I'm your AI Travel Assistant
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              I can help you find flights, plan trips, suggest destinations, and answer travel questions. What can I help you with today?
            </p>
            
            {/* Starter Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {starterPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  className="p-3 text-sm bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <>
            {/* Save Search Button - show when we have flight search criteria */}
            {console.log('Rendering messages section, currentSearchCriteria:', currentSearchCriteria)}
            {currentSearchCriteria && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleSaveSearch}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save This Search
                </button>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'user' ? (
                  /* User Message */
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-blue-600 text-white p-3 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span className="text-xs text-blue-100 mt-1 block">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <AgentMessage
                    content={message.content}
                    timestamp={message.timestamp}
                  />
                )}
              </div>
            ))}
            
            {/* Loading Message */}
            {isLoading && (
              <AgentMessage
                content=""
                timestamp={new Date().toISOString()}
                isLoading={true}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form
          onSubmit={handleSubmit}
          className="flex gap-3 items-end"
        >
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about flights, destinations, or travel plans..."
              className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 min-h-[40px]"
              rows={1}
              disabled={isSending}
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="flex-shrink-0 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ position: 'relative', zIndex: 10 }}
            onClickCapture={(e) => {
              console.log('Button onClickCapture fired!');
              console.log('Event phase:', e.eventPhase);
            }}
            onClick={(e) => {
              console.log('Button onClick fired!');
              console.log('Event type:', e.type);
              console.log('Button disabled?', !inputMessage.trim() || isSending);
              console.log('inputMessage:', inputMessage);
              console.log('onSendMessage exists?', !!onSendMessage);
            }}
            onMouseDown={(e) => {
              console.log('Button onMouseDown fired!');
              console.log('MouseDown - button:', e.button);
            }}
            onPointerDown={(e) => {
              console.log('Button onPointerDown fired!');
              console.log('PointerDown - pointerType:', e.pointerType);
            }}
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
        
        {/* Debug button */}
        <button
          type="button"
          onClick={() => {
            console.log('Debug button clicked!');
            console.log('Current inputMessage:', inputMessage);
            console.log('Attempting programmatic form submission...');
            
            // Try to submit the form programmatically
            const form = document.querySelector('form');
            if (form) {
              console.log('Found form, attempting submit event dispatch');
              const submitEvent = new Event('submit', {
                bubbles: true,
                cancelable: true,
              });
              form.dispatchEvent(submitEvent);
            }
          }}
          className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
        >
          Debug: Test Click
        </button>
      </div>

      {/* Save Search Modal */}
      <SaveSearchModal
        isOpen={showSaveSearchModal}
        onClose={() => setShowSaveSearchModal(false)}
        searchCriteria={currentSearchCriteria || {
          origin: '',
          destination: '',
          departureDate: '',
          passengers: 1,
          class: 'economy',
          tripType: 'round_trip'
        }}
        onSaveSuccess={handleSaveSearchSuccess}
        onSaveSearch={onSaveSearch!}
      />
    </div>
  );
};