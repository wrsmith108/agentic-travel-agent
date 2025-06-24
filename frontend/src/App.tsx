import { DemoModeProvider } from './contexts/DemoModeContext';
import { Header } from './components/shared/Header';

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
          <div className="w-1/2 bg-gray-50 overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                AI Travel Assistant
              </h2>
              <p className="text-gray-600">
                Chat with me to set up flight monitoring for your destinations.
              </p>
              
              {/* Placeholder for AI chat interface */}
              <div className="mt-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <p className="text-gray-500">AI conversation interface coming soon</p>
                  <p className="text-sm text-gray-400 mt-2">
                    This is where you'll chat with the AI to set up your travel preferences
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </DemoModeProvider>
  );
}

export default App;