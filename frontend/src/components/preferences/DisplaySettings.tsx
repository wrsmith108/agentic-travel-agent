/**
 * Display Settings Component
 * Manages UI display preferences and currency settings
 */

import React, { useState } from 'react';
import { usePreferences } from '../../contexts/PreferencesContext';
import type { DisplayPreferences } from '../../types/preferences';

interface DisplaySettingsProps {
  preferences: DisplayPreferences;
}

export const DisplaySettings: React.FC<DisplaySettingsProps> = ({ preferences }) => {
  const { updatePreferences } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localPreferences, setLocalPreferences] = useState(preferences);

  const handleInputChange = (field: keyof DisplayPreferences, value: string | boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updatePreferences({
        display: localPreferences,
      });
    } catch (error) {
      console.error('Failed to update display preferences:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setLocalPreferences(preferences);
  };

  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(localPreferences);

  const currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'SEK', name: 'Swedish Krona' },
    { code: 'NOK', name: 'Norwegian Krone' },
    { code: 'DKK', name: 'Danish Krone' },
  ];

  const timeFormats = [
    { value: '12h', label: '12-hour (2:30 PM)' },
    { value: '24h', label: '24-hour (14:30)' },
  ];

  const dateFormats = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
  ];

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
  ];

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Vancouver',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'UTC',
  ];

  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System Default' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Display Settings</h3>
        <p className="text-gray-600 mb-6">
          Customize how information is displayed throughout the application.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Currency */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
            Preferred Currency
          </label>
          <select
            id="currency"
            value={localPreferences.currency}
            onChange={(e) => handleInputChange('currency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {currencies.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">
            All prices will be displayed in your preferred currency
          </p>
        </div>

        {/* Time Format */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Time Format
          </label>
          <div className="space-y-2">
            {timeFormats.map((format) => (
              <div key={format.value} className="flex items-center">
                <input
                  id={`time-${format.value}`}
                  type="radio"
                  name="timeFormat"
                  value={format.value}
                  checked={localPreferences.timeFormat === format.value}
                  onChange={(e) => handleInputChange('timeFormat', e.target.value)}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
                <label htmlFor={`time-${format.value}`} className="ml-3 text-sm text-gray-700">
                  {format.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Date Format */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Date Format
          </label>
          <div className="space-y-2">
            {dateFormats.map((format) => (
              <div key={format.value} className="flex items-center">
                <input
                  id={`date-${format.value}`}
                  type="radio"
                  name="dateFormat"
                  value={format.value}
                  checked={localPreferences.dateFormat === format.value}
                  onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
                <label htmlFor={`date-${format.value}`} className="ml-3 text-sm text-gray-700">
                  {format.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
            Language
          </label>
          <select
            id="language"
            value={localPreferences.language}
            onChange={(e) => handleInputChange('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Interface language (requires page refresh)
          </p>
        </div>

        {/* Timezone */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            id="timezone"
            value={localPreferences.timezone}
            onChange={(e) => handleInputChange('timezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone.replace('_', ' ')}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Times will be displayed in your selected timezone
          </p>
        </div>

        {/* Theme */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Theme
          </label>
          <div className="space-y-2">
            {themes.map((theme) => (
              <div key={theme.value} className="flex items-center">
                <input
                  id={`theme-${theme.value}`}
                  type="radio"
                  name="theme"
                  value={theme.value}
                  checked={localPreferences.theme === theme.value}
                  onChange={(e) => handleInputChange('theme', e.target.value)}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
                <label htmlFor={`theme-${theme.value}`} className="ml-3 text-sm text-gray-700">
                  {theme.label}
                </label>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            System default will follow your device's theme setting
          </p>
        </div>

        {/* Compact View */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="compact-view" className="block text-sm font-medium text-gray-700">
                Compact View
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Use a more condensed layout to show more information
              </p>
            </div>
            <div className="ml-4">
              <input
                id="compact-view"
                type="checkbox"
                checked={localPreferences.compactView}
                onChange={(e) => handleInputChange('compactView', e.target.checked)}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Changes
            </button>
            <button
              type="submit"
              disabled={!hasChanges || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          {hasChanges && (
            <p className="text-sm text-amber-600 mt-2">
              You have unsaved changes that will be lost if you navigate away.
            </p>
          )}
        </div>
      </form>
    </div>
  );
};