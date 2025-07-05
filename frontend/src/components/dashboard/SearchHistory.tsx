// Search History Component
import React from 'react';
import type { SearchHistory } from '../../types';

interface SearchHistoryListProps {
  history: SearchHistory[];
  onClearHistory: () => void;
  onRefresh: () => void;
}

export const SearchHistoryList: React.FC<SearchHistoryListProps> = ({
  history,
  onClearHistory,
  onRefresh
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(price);
  };

  const getStatusColor = (status: SearchHistory['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'no_results':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: SearchHistory['status']) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'no_results':
        return '⚠️';
      default:
        return '🔍';
    }
  };

  const getStatusText = (status: SearchHistory['status']) => {
    switch (status) {
      case 'success':
        return 'Success';
      case 'failed':
        return 'Failed';
      case 'no_results':
        return 'No Results';
      default:
        return 'Unknown';
    }
  };

  if (history.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4">
          <span className="text-4xl">📊</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No search history yet
        </h3>
        <p className="text-gray-500 mb-4">
          Your recent flight searches will appear here once you start searching.
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
          Search History ({history.length})
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-lg">{getStatusIcon(item.status)}</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {getStatusText(item.status)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(item.executedAt)}
                  </span>
                </div>

                <div className="flex items-center space-x-6 text-sm text-gray-600">
                  <div>
                    <span className="text-xs text-gray-500">Results Found</span>
                    <div className="font-medium text-gray-900">
                      {item.resultsCount.toLocaleString()} flight{item.resultsCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {item.lowestPrice && (
                    <div>
                      <span className="text-xs text-gray-500">Lowest Price</span>
                      <div className="font-semibold text-green-600">
                        {formatPrice(item.lowestPrice)}
                      </div>
                    </div>
                  )}

                  {item.averagePrice && (
                    <div>
                      <span className="text-xs text-gray-500">Average Price</span>
                      <div className="font-medium text-gray-900">
                        {formatPrice(item.averagePrice)}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs text-gray-500">Search ID</span>
                    <div className="font-mono text-xs text-gray-600">
                      {item.searchId.slice(0, 8)}...
                    </div>
                  </div>
                </div>

                {item.status === 'failed' && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    Search failed. Please try again or contact support if the issue persists.
                  </div>
                )}

                {item.status === 'no_results' && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                    No flights found for your search criteria. Try adjusting your dates or destinations.
                  </div>
                )}
              </div>

              <div className="ml-4 flex-shrink-0">
                {item.status === 'success' && item.resultsCount > 0 && (
                  <button
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
                    title="View results"
                  >
                    View Results
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {history.length > 10 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            Showing recent searches. Older searches are automatically cleaned up.
          </p>
        </div>
      )}
    </div>
  );
};