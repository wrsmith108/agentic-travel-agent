import { useState, useRef } from 'react';
import type { FlightSearchRequest } from '@/types/flight';
import type { SavedSearchRequest } from '@/types/search';
import { savedSearchService } from '@/services/savedSearchService';

interface SaveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchCriteria: FlightSearchRequest;
  onSaveSuccess?: () => void;
  onSaveSearch?: (search: any) => Promise<void>;
}

interface FormData {
  name: string;
  description: string;
  isPriceAlertEnabled: boolean;
  targetPrice: number | null;
}

export const SaveSearchModal = ({
  isOpen,
  onClose,
  searchCriteria,
  onSaveSuccess,
  onSaveSearch
}: SaveSearchModalProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    isPriceAlertEnabled: false,
    targetPrice: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    console.log('SaveSearchModal: handleSubmit called');
    
    if (!formData.name.trim()) {
      console.log('SaveSearchModal: Name validation failed');
      setError('Please enter a name for your saved search');
      return;
    }

    console.log('SaveSearchModal: Starting save with formData:', formData);
    setIsLoading(true);
    setError(null);

    try {
      const request: SavedSearchRequest = {
        name: formData.name.trim(),
        searchCriteria,
        isPriceAlertEnabled: formData.isPriceAlertEnabled,
        ...(formData.description.trim() && { description: formData.description.trim() }),
        ...(formData.isPriceAlertEnabled && formData.targetPrice !== null && { targetPrice: formData.targetPrice })
      };

      console.log('SaveSearchModal: Calling API with request:', request);
      
      // Use the provided onSaveSearch function if available, otherwise use the service directly
      if (onSaveSearch) {
        console.log('SaveSearchModal: Using provided onSaveSearch function');
        await onSaveSearch(request);
      } else {
        console.log('SaveSearchModal: Using savedSearchService directly');
        await savedSearchService.createSavedSearch(request);
      }
      
      console.log('SaveSearchModal: Save successful');
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        isPriceAlertEnabled: false,
        targetPrice: null
      });
      
      onSaveSuccess?.();
      onClose();
    } catch (err) {
      console.error('❌ SaveSearchModal: Detailed error:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        request: {
          name: formData.name.trim(),
          searchCriteria,
          isPriceAlertEnabled: formData.isPriceAlertEnabled,
          description: formData.description.trim(),
          targetPrice: formData.targetPrice
        }
      });
      
      // Extract more specific error message
      let errorMessage = 'Failed to save search. Please try again.';
      if (err instanceof Error) {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSearchSummary = () => {
    const parts = [];
    
    if (searchCriteria.origin && searchCriteria.destination) {
      parts.push(`${searchCriteria.origin} to ${searchCriteria.destination}`);
    }
    
    if (searchCriteria.departureDate) {
      parts.push(`departing ${new Date(searchCriteria.departureDate).toLocaleDateString()}`);
    }
    
    if (searchCriteria.returnDate) {
      parts.push(`returning ${new Date(searchCriteria.returnDate).toLocaleDateString()}`);
    }
    
    if (searchCriteria.passengers) {
      parts.push(`${searchCriteria.passengers} passenger${searchCriteria.passengers !== 1 ? 's' : ''}`);
    }
    
    return parts.join(', ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Save Search</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Summary */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Search: </span>
            {generateSearchSummary()}
          </p>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Summer vacation to Paris"
              required
            />
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Add notes about this search..."
            />
          </div>

          {/* Price Alert Toggle */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="priceAlert" className="text-sm font-medium text-gray-700">
                Enable price alerts
              </label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isPriceAlertEnabled: !formData.isPriceAlertEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isPriceAlertEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isPriceAlertEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Target Price Field */}
            {formData.isPriceAlertEnabled && (
              <div>
                <label htmlFor="targetPrice" className="block text-sm font-medium text-gray-700 mb-1">
                  Target price (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="targetPrice"
                    value={formData.targetPrice || ''}
                    onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value ? Number(e.target.value) : null })}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Alert me when price drops below..."
                    min="0"
                    step="0.01"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  We'll notify you when prices drop below this amount
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Search'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};