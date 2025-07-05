import React, { useState, useEffect } from 'react';
import { usePreferences } from '../../contexts/PreferencesContext';
import type { NotificationPreferences } from '../../types/preferences';

interface NotificationSettingsProps {
  preferences: NotificationPreferences;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences
}) => {
  const { updatePreferences, isLoading, error } = usePreferences();
  
  // Local state for form
  const [localSettings, setLocalSettings] = useState<NotificationPreferences>(preferences);

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize local state when preferences prop changes
  useEffect(() => {
    setLocalSettings(preferences);
  }, [preferences]);

  // Check for changes
  useEffect(() => {
    const changed = Object.keys(localSettings).some(key => {
      const k = key as keyof NotificationPreferences;
      return localSettings[k] !== preferences[k];
    });
    
    setHasChanges(changed);
  }, [localSettings, preferences]);

  const handleEmailFrequencyChange = (frequency: NotificationPreferences['emailFrequency']) => {
    setLocalSettings(prev => ({
      ...prev,
      emailFrequency: frequency
    }));
  };

  const handleToggleChange = (key: keyof Omit<NotificationPreferences, 'emailFrequency'>) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;

    setSaving(true);
    try {
      await updatePreferences({ notifications: localSettings });
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save notification settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(preferences);
    setHasChanges(false);
  };

  const emailFrequencyOptions = [
    { value: 'immediate', label: 'Immediate', description: 'Get notified as soon as something happens' },
    { value: 'daily', label: 'Daily Digest', description: 'Receive a summary once per day' },
    { value: 'weekly', label: 'Weekly Summary', description: 'Get updates once per week' },
    { value: 'disabled', label: 'Disabled', description: 'No email notifications' }
  ] as const;

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Notification Settings
          </h3>
          <p className="text-sm text-gray-600">
            Manage how and when you receive notifications about flights and deals.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading notification settings
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Frequency */}
          <div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-900 mb-4">
                Email Frequency
              </legend>
              <div className="space-y-3">
                {emailFrequencyOptions.map((option) => (
                  <div key={option.value} className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id={`frequency-${option.value}`}
                        name="emailFrequency"
                        type="radio"
                        value={option.value}
                        checked={localSettings.emailFrequency === option.value}
                        onChange={() => handleEmailFrequencyChange(option.value)}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label 
                        htmlFor={`frequency-${option.value}`}
                        className="font-medium text-gray-700 cursor-pointer"
                      >
                        {option.label}
                      </label>
                      <p className="text-gray-500">{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Notification Types */}
          <div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-900 mb-4">
                Notification Types
              </legend>
              <div className="space-y-4">
                {/* Price Alerts */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="priceAlerts"
                      type="checkbox"
                      checked={localSettings.priceAlerts}
                      onChange={() => handleToggleChange('priceAlerts')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="priceAlerts" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Price Alerts
                    </label>
                    <p className="text-sm text-gray-500">
                      Get notified when flight prices drop for your saved searches
                    </p>
                  </div>
                </div>

                {/* Deal Notifications */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="dealNotifications"
                      type="checkbox"
                      checked={localSettings.dealNotifications}
                      onChange={() => handleToggleChange('dealNotifications')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="dealNotifications" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Deal Notifications
                    </label>
                    <p className="text-sm text-gray-500">
                      Receive notifications about special deals and limited-time offers
                    </p>
                  </div>
                </div>

                {/* Marketing Emails */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="marketingEmails"
                      type="checkbox"
                      checked={localSettings.marketingEmails}
                      onChange={() => handleToggleChange('marketingEmails')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="marketingEmails" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Marketing Emails
                    </label>
                    <p className="text-sm text-gray-500">
                      Receive promotional content, travel tips, and marketing communications
                    </p>
                  </div>
                </div>

                {/* System Updates */}
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="systemUpdates"
                      type="checkbox"
                      checked={localSettings.systemUpdates}
                      onChange={() => handleToggleChange('systemUpdates')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3">
                    <label htmlFor="systemUpdates" className="text-sm font-medium text-gray-700 cursor-pointer">
                      System Updates
                    </label>
                    <p className="text-sm text-gray-500">
                      Important updates about system maintenance, new features, and service changes
                    </p>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <button
                type="submit"
                disabled={!hasChanges || saving}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  hasChanges && !saving
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasChanges || saving}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  hasChanges && !saving
                    ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                }`}
              >
                Reset
              </button>
            </div>
            
            {hasChanges && (
              <div className="text-sm text-amber-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                You have unsaved changes
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotificationSettings;