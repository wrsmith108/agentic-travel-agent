// Dashboard Component Connected to DashboardContext
import React, { useState } from 'react';
import { SavedSearchesList } from './SavedSearchesList';
import { PriceAlertsList } from './PriceAlertsList';
import { SearchHistoryList } from './SearchHistory';
import { DashboardHeader } from './DashboardHeader';
import { PreferencesModal } from '../preferences/PreferencesModal';
import { useDashboard } from '../../contexts/DashboardContext';
import { searchService, priceAlertService } from '../../services';

type DashboardTab = 'searches' | 'alerts' | 'history';

export const DashboardConnected: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('searches');
  const [error, setError] = useState<string | null>(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  
  // Use the DashboardContext that has working backend integration
  const { 
    savedSearches, 
    priceAlerts, 
    searchHistory, 
    refreshDashboard 
  } = useDashboard();

  const handleDeleteSearch = async (searchId: string) => {
    try {
      console.log('🗑️ Attempting to delete search:', searchId);
      await searchService.deleteSavedSearch(searchId);
      console.log('✅ Delete request completed successfully');
      await refreshDashboard(); // Refresh from context
    } catch (err) {
      console.error('❌ Failed to delete search:', {
        searchId,
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        response: (err as any).response,
        status: (err as any).status
      });
      setError('Failed to delete search');
    }
  };

  const handleMarkAlertAsRead = async (alertId: string) => {
    try {
      await priceAlertService.markAlertAsRead(alertId);
      await refreshDashboard(); // Refresh from context
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
      setError('Failed to mark alert as read');
    }
  };

  const handleClearHistory = async () => {
    try {
      // TODO: Implement clear history API call when backend is ready
      console.log('Clear history requested');
    } catch (err) {
      console.error('Failed to clear history:', err);
      setError('Failed to clear search history');
    }
  };

  const handleOpenPreferences = () => {
    setIsPreferencesOpen(true);
  };

  const handleClosePreferences = () => {
    setIsPreferencesOpen(false);
  };

  const handleRefresh = async () => {
    try {
      setError(null);
      await refreshDashboard();
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
      setError('Failed to refresh dashboard data');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Dashboard Header */}
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchCount={savedSearches.length}
        alertCount={priceAlerts.length}
        onOpenPreferences={handleOpenPreferences}
      />

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'searches' && (
          <SavedSearchesList
            searches={savedSearches}
            onDeleteSearch={handleDeleteSearch}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'alerts' && (
          <PriceAlertsList
            alerts={priceAlerts}
            onMarkAsRead={handleMarkAlertAsRead}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'history' && (
          <SearchHistoryList
            history={searchHistory}
            onClearHistory={handleClearHistory}
            onRefresh={handleRefresh}
          />
        )}
      </div>

      {/* Preferences Modal */}
      {isPreferencesOpen && (
        <PreferencesModal
          isOpen={isPreferencesOpen}
          onClose={handleClosePreferences}
        />
      )}
    </div>
  );
};