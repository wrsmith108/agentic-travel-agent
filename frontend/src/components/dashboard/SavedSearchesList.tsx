// Saved Searches List Component
import React from 'react';
import type { SavedSearch } from '../../types';

interface SavedSearchesListProps {
  searches: SavedSearch[];
  onDeleteSearch: (searchId: string) => void;
  onRefresh: () => void;
}

export const SavedSearchesList: React.FC<SavedSearchesListProps> = ({
  searches,
  onDeleteSearch,
  onRefresh
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRoute = (search: SavedSearch) => {
    if (!search.searchCriteria) return 'No route specified';
    const { origin, destination } = search.searchCriteria;
    return `${origin} → ${destination}`;
  };

  const formatPassengers = (search: SavedSearch) => {
    if (!search.searchCriteria) return 'No passengers specified';
    const { passengers } = search.searchCriteria;
    return `${passengers} passenger${passengers > 1 ? 's' : ''}`;
  };

  const formatTripType = (tripType: string) => {
    return tripType === 'round_trip' ? 'Round Trip' : 'One Way';
  };

  const formatClass = (flightClass: string) => {
    return flightClass.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (searches.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4">
          <span className="text-4xl">🔍</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No saved searches yet
        </h3>
        <p className="text-gray-500 mb-4">
          Save your flight searches to monitor prices and get notified of deals.
        </p>
        <button
          onClick={onRefresh}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Saved Searches ({searches.length})
        </h3>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {searches.map((search) => (
          <div
            key={search.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-lg font-medium text-gray-900 truncate">
                    {search.name}
                  </h4>
                  {search.isPriceAlertEnabled && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <span className="mr-1">🔔</span>
                      Price Alert
                    </span>
                  )}
                  {!search.isActive && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  )}
                </div>

                {search.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {search.description}
                  </p>
                )}

                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">{formatRoute(search)}</span>
                    <span>{formatPassengers(search)}</span>
                    {search.searchCriteria && (
                      <>
                        <span>{formatClass(search.searchCriteria.class)}</span>
                        <span>{formatTripType(search.searchCriteria.tripType)}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {search.searchCriteria && (
                      <>
                        <span>
                          Departure: {formatDate(search.searchCriteria.departureDate)}
                        </span>
                        {search.searchCriteria.returnDate && (
                          <span>
                            Return: {formatDate(search.searchCriteria.returnDate)}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 text-xs">
                    <span>
                      Created: {formatDate(search.createdAt)}
                    </span>
                    {search.lastSearched && (
                      <span>
                        Last searched: {formatDate(search.lastSearched)}
                      </span>
                    )}
                  </div>
                </div>

                {search.isPriceAlertEnabled && search.targetPrice && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">
                      Target price: 
                      <span className="ml-1 font-semibold text-green-600">
                        ${search.targetPrice.toFixed(2)}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => onDeleteSearch(search.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};