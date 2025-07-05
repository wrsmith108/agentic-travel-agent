/**
 * Preferences Context
 * Manages user preferences state and API interactions
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { preferencesService } from '../services/preferencesService';
import { createDefaultPreferences } from '../types/preferences';
import type { UserPreferences, UserPreferencesUpdate } from '../types/preferences';

interface PreferencesContextType {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  updatePreferences: (updates: UserPreferencesUpdate) => Promise<void>;
  resetPreferences: () => Promise<void>;
  refetch: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

interface PreferencesProviderProps {
  children: ReactNode;
}

export const PreferencesProvider: React.FC<PreferencesProviderProps> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await preferencesService.getPreferences();
      setPreferences(data);
    } catch (err) {
      // If preferences don't exist, create defaults
      if (err instanceof Error && err.message.includes('404')) {
        try {
          // Create default preferences for current user
          const defaultPrefs = createDefaultPreferences('current-user');
          setPreferences(defaultPrefs);
        } catch (defaultErr) {
          setError('Failed to load preferences');
          console.error('Failed to create default preferences:', defaultErr);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
        console.error('Failed to fetch preferences:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: UserPreferencesUpdate) => {
    if (!preferences) return;

    setError(null);
    
    try {
      const updatedPreferences = await preferencesService.updatePreferences(updates);
      setPreferences(updatedPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      console.error('Failed to update preferences:', err);
      throw err;
    }
  };

  const resetPreferences = async () => {
    setError(null);
    
    try {
      const resetPreferences = await preferencesService.resetPreferences();
      setPreferences(resetPreferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset preferences');
      console.error('Failed to reset preferences:', err);
      throw err;
    }
  };

  const refetch = async () => {
    await fetchPreferences();
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const contextValue: PreferencesContextType = {
    preferences,
    isLoading,
    error,
    updatePreferences,
    resetPreferences,
    refetch,
  };

  return (
    <PreferencesContext.Provider value={contextValue}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  
  return context;
};