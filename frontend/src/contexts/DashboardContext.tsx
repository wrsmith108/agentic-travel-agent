import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { SavedSearch, PriceAlert, SearchHistory, SavedSearchRequest } from '../types';
import type { FlightSearchRequest } from '../types/flight';
import type { PriceAlertRequest } from '../types/priceAlert';
import { searchService } from '../services/searchService';
import { priceAlertService } from '../services/priceAlertService';

interface ExtractedTravelData {
  searchRequest?: Partial<FlightSearchRequest>;
  priceAlert?: Partial<PriceAlertRequest>;
  confidence: number;
  extractedFields: string[];
  ambiguousFields: string[];
}

interface DashboardContextType {
  // State
  savedSearches: SavedSearch[];
  priceAlerts: PriceAlert[];
  searchHistory: SearchHistory[];
  extractedData: ExtractedTravelData | null;
  
  // Actions
  setSavedSearches: (searches: SavedSearch[]) => void;
  setPriceAlerts: (alerts: PriceAlert[]) => void;
  setSearchHistory: (history: SearchHistory[]) => void;
  setExtractedData: (data: ExtractedTravelData | null) => void;
  
  // Utilities
  addSavedSearch: (search: SavedSearchRequest) => Promise<void>;
  addPriceAlert: (alert: PriceAlert) => void;
  refreshDashboard: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedTravelData | null>(null);

  const addSavedSearch = useCallback(async (searchRequest: SavedSearchRequest) => {
    try {
      console.log('DashboardContext: addSavedSearch called with:', searchRequest);
      
      console.log('DashboardContext: Calling API with request:', searchRequest);
      const savedSearch = await searchService.createSavedSearch(searchRequest);
      console.log('DashboardContext: API returned saved search:', savedSearch);
      
      setSavedSearches(prev => {
        const updated = [...prev, savedSearch];
        console.log('DashboardContext: Updated saved searches:', updated);
        return updated;
      });
    } catch (error) {
      console.error('❌ DashboardContext: Failed to save search:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        searchRequest
      });
      throw error; // Re-throw so caller can handle UI feedback
    }
  }, []);

  const addPriceAlert = useCallback((alert: PriceAlert) => {
    setPriceAlerts(prev => [...prev, alert]);
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      // Load saved searches
      const savedSearches = await searchService.getSavedSearches();
      setSavedSearches(savedSearches);

      // Load price alerts
      const priceAlerts = await priceAlertService.getPriceAlerts();
      setPriceAlerts(priceAlerts);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    }
  }, []);

  // Load dashboard data on mount
  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  return (
    <DashboardContext.Provider
      value={{
        savedSearches,
        priceAlerts,
        searchHistory,
        extractedData,
        setSavedSearches,
        setPriceAlerts,
        setSearchHistory,
        setExtractedData,
        addSavedSearch,
        addPriceAlert,
        refreshDashboard,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export type { ExtractedTravelData };