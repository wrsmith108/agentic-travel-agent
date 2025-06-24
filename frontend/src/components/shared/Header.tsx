import React from 'react';
import { DemoModeToggle } from './DemoModeToggle';
import { useDemoMode } from '../../contexts/DemoModeContext';

export const Header: React.FC = () => {
  const { isDemoMode } = useDemoMode();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and App Name */}
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {import.meta.env.VITE_APP_NAME || 'Agentic Travel Agent'}
            </h1>
            {isDemoMode && (
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                DEMO
              </span>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            <DemoModeToggle />
            
            {/* Placeholder for user menu */}
            <div className="flex items-center space-x-3">
              <button className="text-sm text-gray-700 hover:text-gray-900">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};