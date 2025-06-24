import React from 'react';
import { useDemoMode } from '../../contexts/DemoModeContext';

export const DemoModeToggle: React.FC = () => {
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const showToggle = import.meta.env.VITE_SHOW_DEMO_TOGGLE === 'true';

  if (!showToggle) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Demo Mode</span>
      <button
        onClick={toggleDemoMode}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${isDemoMode ? 'bg-primary-600' : 'bg-gray-300'}
        `}
        role="switch"
        aria-checked={isDemoMode}
        aria-label="Toggle demo mode"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${isDemoMode ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      <span className="text-xs text-gray-500">
        {isDemoMode ? 'ON' : 'OFF'}
      </span>
    </div>
  );
};