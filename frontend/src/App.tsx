import { DemoModeProvider } from './contexts/DemoModeContext';
import { Header } from './components/shared/Header';
import { ChatInterface } from './components/ai-agent';

function App() {
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
                onSendMessage={async (message) => {
                  console.log('Sending message:', message);
                  // TODO: Implement API call to conversation service
                }}
                messages={[
                  // Demo message to show formatting
                  {
                    id: "demo-1",
                    role: "assistant" as const,
                    content: `Perfect! I'd be delighted to help you find **flights** to London! ✈️

London has several major airports to choose from:
- **LHR** (Heathrow) - Main international hub with most carriers
- **LGW** (Gatwick) - Popular alternative with good connections  
- **STN** (Stansted) - Budget airline hub, great for **cost-effective** travel

For the best **flight** deals and **departure** times, I'll need some details about your **travel** plans. **Prices** can vary dramatically based on your specific **departure** airport and dates.

---

### Questions for you:

1. What is your **departure** city and airport code?
2. When would you like to travel (specific dates)?
3. How many passengers will be traveling?
4. Do you have a **budget** preference?`,
                    timestamp: new Date().toISOString()
                  }
                ]}
                isLoading={false}
              />
            </div>
          </div>
        </main>
      </div>
    </DemoModeProvider>
  );
}

export default App;