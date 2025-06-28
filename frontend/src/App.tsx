import { useState } from 'react';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { Header } from './components/shared/Header';
import { ChatInterface } from './components/ai-agent';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
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
      const response = await fetch('http://localhost:3001/api/v1/demo/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message,
          sessionId: sessionId || undefined 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Store session ID for conversation continuity
        if (data.data.sessionId && !sessionId) {
          setSessionId(data.data.sessionId);
        }

        // Add AI response
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.data.message,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or check your connection.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DemoModeProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        {/* Main Content Area - 50/50 Split */}
        <main className="flex h-[calc(100vh-4rem)]">
          {/* Left Panel - Dashboard */}
          <div className="w-1/2 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Your Travel Dashboard
              </h2>
              <p className="text-gray-600">
                Your monitored destinations and active searches will appear here.
              </p>
              
              {/* Placeholder for dashboard content */}
              <div className="mt-8 space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="text-gray-500">No active searches</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Start a conversation with the AI agent to set up flight monitoring
                  </p>
                </div>
              </div>
            </div>
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
              />
            </div>
          </div>
        </main>
      </div>
    </DemoModeProvider>
  );
}

export default App;