import React, { useState, useEffect } from 'react';
import type { SearchPreferences } from '@/types/preferences';
import { usePreferences } from '@/contexts/PreferencesContext';

interface SearchSettingsProps {
  preferences: SearchPreferences;
}

export const SearchSettings: React.FC<SearchSettingsProps> = ({ preferences }) => {
  const { updatePreferences, isLoading } = usePreferences();
  const [formData, setFormData] = useState<SearchPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(preferences);
    setHasChanges(false);
  }, [preferences]);

  const handleInputChange = (field: keyof SearchPreferences, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    setHasChanges(JSON.stringify(newFormData) !== JSON.stringify(preferences));
  };

  const handleBudgetRangeChange = (field: 'min' | 'max' | 'currency', value: string | number) => {
    const currentBudgetRange = formData.budgetRange || { min: 0, max: 10000, currency: 'USD' };
    const newBudgetRange = { ...currentBudgetRange, [field]: value };
    handleInputChange('budgetRange', newBudgetRange);
  };

  const handleAirlineChange = (index: number, value: string) => {
    const newAirlines = [...formData.preferredAirlines];
    newAirlines[index] = value;
    handleInputChange('preferredAirlines', newAirlines);
  };

  const addAirline = () => {
    const newAirlines = [...formData.preferredAirlines, ''];
    handleInputChange('preferredAirlines', newAirlines);
  };

  const removeAirline = (index: number) => {
    const newAirlines = formData.preferredAirlines.filter((_, i) => i !== index);
    handleInputChange('preferredAirlines', newAirlines);
  };

  const handleSave = async () => {
    try {
      await updatePreferences({ search: formData });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save search preferences:', error);
    }
  };

  const handleReset = () => {
    setFormData(preferences);
    setHasChanges(false);
  };

  const currencies = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'CAD', label: 'CAD - Canadian Dollar' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
    { value: 'AUD', label: 'AUD - Australian Dollar' },
  ];

  const cabinClasses = [
    { value: 'economy', label: 'Economy' },
    { value: 'premium_economy', label: 'Premium Economy' },
    { value: 'business', label: 'Business' },
    { value: 'first', label: 'First Class' },
  ];

  const maxStopsOptions = [
    { value: 0, label: 'Direct flights only' },
    { value: 1, label: 'Up to 1 stop' },
    { value: 2, label: 'Up to 2 stops' },
    { value: 3, label: 'Up to 3 stops' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Search Preferences</h3>
        <div className="space-y-4">
          {/* Default Airports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Departure Airport
              </label>
              <input
                type="text"
                value={formData.defaultDepartureAirport || ''}
                onChange={(e) => handleInputChange('defaultDepartureAirport', e.target.value || undefined)}
                placeholder="e.g., JFK, LAX, NYC"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Arrival Airport
              </label>
              <input
                type="text"
                value={formData.defaultArrivalAirport || ''}
                onChange={(e) => handleInputChange('defaultArrivalAirport', e.target.value || undefined)}
                placeholder="e.g., LHR, CDG, LON"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Cabin Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Cabin Class
            </label>
            <select
              value={formData.preferredCabinClass}
              onChange={(e) => handleInputChange('preferredCabinClass', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {cabinClasses.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Max Stops */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Stops
            </label>
            <select
              value={formData.maxStops}
              onChange={(e) => handleInputChange('maxStops', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {maxStopsOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Flexible Dates */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="flexibleDates"
              checked={formData.flexibleDates}
              onChange={(e) => handleInputChange('flexibleDates', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="flexibleDates" className="ml-2 block text-sm text-gray-700">
              Enable flexible dates (±3 days)
            </label>
          </div>

          {/* Preferred Airlines */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Airlines
            </label>
            <div className="space-y-2">
              {formData.preferredAirlines.map((airline, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={airline}
                    onChange={(e) => handleAirlineChange(index, e.target.value)}
                    placeholder="e.g., American Airlines, Delta"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeAirline(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAirline}
                className="w-full px-3 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
              >
                + Add Airline
              </button>
            </div>
          </div>

          {/* Budget Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Range (Optional)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                <input
                  type="number"
                  value={formData.budgetRange?.min || ''}
                  onChange={(e) => handleBudgetRangeChange('min', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                <input
                  type="number"
                  value={formData.budgetRange?.max || ''}
                  onChange={(e) => handleBudgetRangeChange('max', parseInt(e.target.value) || 10000)}
                  placeholder="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <select
                  value={formData.budgetRange?.currency || 'USD'}
                  onChange={(e) => handleBudgetRangeChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {currencies.map(currency => (
                    <option key={currency.value} value={currency.value}>
                      {currency.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};