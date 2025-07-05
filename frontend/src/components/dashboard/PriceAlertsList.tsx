// Price Alerts List Component
import React from 'react';
import type { PriceAlert } from '../../types';

interface PriceAlertsListProps {
  alerts: PriceAlert[];
  onMarkAsRead: (alertId: string) => void;
  onRefresh: () => void;
}

export const PriceAlertsList: React.FC<PriceAlertsListProps> = ({
  alerts,
  onMarkAsRead,
  onRefresh
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRoute = (alert: PriceAlert) => {
    const { origin, destination } = alert.searchCriteria;
    return `${origin} → ${destination}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(price);
  };

  const formatTripType = (tripType: string) => {
    return tripType === 'round_trip' ? 'Round Trip' : 'One Way';
  };

  const formatClass = (flightClass: string) => {
    return flightClass.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPriceStatus = (alert: PriceAlert) => {
    if (!alert.currentPrice) return null;
    
    const difference = alert.currentPrice - alert.targetPrice;
    const isBelow = difference <= 0;
    
    return {
      isBelow,
      difference: Math.abs(difference),
      percentage: Math.abs((difference / alert.targetPrice) * 100)
    };
  };

  if (alerts.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4">
          <span className="text-4xl">🔔</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No price alerts yet
        </h3>
        <p className="text-gray-500 mb-4">
          Create price alerts to get notified when flight prices drop below your target.
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
          Price Alerts ({alerts.length})
        </h3>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => {
          const priceStatus = getPriceStatus(alert);
          
          return (
            <div
              key={alert.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="text-lg font-medium text-gray-900 truncate">
                      {alert.name}
                    </h4>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      alert.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {alert.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {!alert.isRead && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        New
                      </span>
                    )}
                    {priceStatus?.isBelow && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        🚨 Target Hit!
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-4">
                      <span className="font-medium">{formatRoute(alert)}</span>
                      <span>{alert.searchCriteria.passengers} passenger{alert.searchCriteria.passengers > 1 ? 's' : ''}</span>
                      <span>{formatClass(alert.searchCriteria.class)}</span>
                      <span>{formatTripType(alert.searchCriteria.tripType)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span>
                        Departure: {formatDate(alert.searchCriteria.departureDate)}
                      </span>
                      {alert.searchCriteria.returnDate && (
                        <span>
                          Return: {formatDate(alert.searchCriteria.returnDate)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-4 text-xs">
                      <span>
                        Created: {formatDate(alert.createdAt)}
                      </span>
                      {alert.lastChecked && (
                        <span>
                          Last checked: {formatDate(alert.lastChecked)}
                        </span>
                      )}
                      {alert.triggerCount > 0 && (
                        <span>
                          Triggered {alert.triggerCount} time{alert.triggerCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <div>
                        <span className="text-xs text-gray-500">Target Price</span>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatPrice(alert.targetPrice)}
                        </div>
                      </div>
                      
                      {alert.currentPrice && (
                        <div>
                          <span className="text-xs text-gray-500">Current Price</span>
                          <div className={`text-sm font-semibold ${
                            priceStatus?.isBelow ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPrice(alert.currentPrice)}
                            {priceStatus && (
                              <span className="ml-1 text-xs">
                                ({priceStatus.isBelow ? '-' : '+'}{formatPrice(priceStatus.difference)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-xs text-gray-500">Notifications</span>
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          {alert.notifications.email && (
                            <span className="bg-blue-100 text-blue-600 px-1 rounded">📧</span>
                          )}
                          {alert.notifications.push && (
                            <span className="bg-green-100 text-green-600 px-1 rounded">📱</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  {!alert.isRead && (
                    <button
                      onClick={() => onMarkAsRead(alert.id)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-md transition-colors"
                      title="Mark as read"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};