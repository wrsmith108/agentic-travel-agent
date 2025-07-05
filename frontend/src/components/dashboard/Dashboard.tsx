// Main Dashboard Component
import React, { useState, useEffect } from 'react';
import { SavedSearchesList } from './SavedSearchesList';
import { PriceAlertsList } from './PriceAlertsList';
import { SearchHistoryList } from './SearchHistory';
import { DashboardHeader } from './DashboardHeader';
import { PreferencesModal } from '../preferences/PreferencesModal';
import { searchService, priceAlertService, searchHistoryService } from '../../services';
import type { SavedSearch, PriceAlert, SearchHistory } from '../../types';

interface DashboardProps {
  className?: string;
}

type DashboardTab = 'searches' | 'alerts' | 'history';

export const Dashboard: React.FC<DashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('searches');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [searchesResponse, alertsResponse, historyResponse] = await Promise.allSettled([
        searchService.getSavedSearches(),
        priceAlertService.getPriceAlerts(),
        searchHistoryService.getSearchHistory()
      ]);

      if (searchesResponse.status === 'fulfilled') {
        setSavedSearches(searchesResponse.value);
      } else {
        console.error('Failed to load saved searches:', searchesResponse.reason);
      }

      if (alertsResponse.status === 'fulfilled') {
        setPriceAlerts(alertsResponse.value);
      } else {
        console.error('Failed to load price alerts:', alertsResponse.reason);
      }

      if (historyResponse.status === 'fulfilled') {
        setSearchHistory(historyResponse.value);
      } else {
        console.error('Failed to load search history:', historyResponse.reason);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSearch = async (searchId: string) => {
    try {
      await searchService.deleteSavedSearch(searchId);
      setSavedSearches(prev => prev.filter(search => search.id !== searchId));
    } catch (err) {
      console.error('Failed to delete search:', err);
      setError('Failed to delete search');
    }
  };

  const handleMarkAlertAsRead = async (alertId: string) => {
    try {
      await priceAlertService.markAlertAsRead(alertId);
      // Update the local state to mark the alert as read
      setPriceAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, isRead: true } : alert
      ));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
      setError('Failed to mark alert as read');
    }
  };

  const handleClearHistory = async () => {
    try {
      await searchHistoryService.clearSearchHistory();
      setSearchHistory([]);
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

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`${className} h-full flex flex-col`}>
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchCount={savedSearches.length}
        alertCount={priceAlerts.length}
        onOpenPreferences={handleOpenPreferences}
      />
      
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
          <p className="text-sm">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="text-xs underline hover:no-underline mt-1"
          >
            Try again
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'searches' && (
          <SavedSearchesList 
            searches={savedSearches}
            onDeleteSearch={handleDeleteSearch}
            onRefresh={loadDashboardData}
          />
        )}
        
        {activeTab === 'alerts' && (
          <PriceAlertsList
            alerts={priceAlerts}
            onMarkAsRead={handleMarkAlertAsRead}
            onRefresh={loadDashboardData}
          />
        )}
        
        {activeTab === 'history' && (
          <SearchHistoryList
            history={searchHistory}
            onClearHistory={handleClearHistory}
            onRefresh={loadDashboardData}
          />
        )}
      </div>
      
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={handleClosePreferences}
      />
    </div>
  );
};