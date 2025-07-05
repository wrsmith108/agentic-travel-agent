// Dashboard Header Component with Navigation Tabs
import React from 'react';

type DashboardTab = 'searches' | 'alerts' | 'history';

interface DashboardHeaderProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  searchCount: number;
  alertCount: number;
  onOpenPreferences: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  onTabChange,
  searchCount,
  alertCount,
  onOpenPreferences
}) => {
  const tabs = [
    {
      id: 'searches' as const,
      label: 'Saved Searches',
      count: searchCount,
      icon: '🔍'
    },
    {
      id: 'alerts' as const,
      label: 'Price Alerts',
      count: alertCount,
      icon: '🔔'
    },
    {
      id: 'history' as const,
      label: 'Search History',
      count: undefined,
      icon: '📜'
    }
  ];

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Travel Dashboard
          </h2>
          
          <button
            onClick={onOpenPreferences}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            title="Open Preferences"
          >
            <span className="mr-2">⚙️</span>
            <span>Preferences</span>
          </button>
        </div>
        
        <nav className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                ${activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`
                  ml-2 px-2 py-0.5 text-xs rounded-full
                  ${activeTab === tab.id
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};