// Price Alert TypeScript definitions

import type { FlightSearchRequest } from './flight';

export interface PriceAlert {
  id: string;
  userId?: string;
  name: string;
  searchCriteria: FlightSearchRequest;
  targetPrice: number;
  currentPrice?: number;
  isActive: boolean;
  isRead: boolean;
  notifications: {
    email: boolean;
    push: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastChecked?: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface PriceAlertRequest {
  name: string;
  searchCriteria: FlightSearchRequest;
  targetPrice: number;
  notifications: {
    email: boolean;
    push: boolean;
  };
}

export interface PriceAlertResponse {
  alerts: PriceAlert[];
  total: number;
  active: number;
  inactive: number;
}

export interface PriceUpdate {
  alertId: string;
  oldPrice?: number;
  newPrice: number;
  priceDifference: number;
  percentageChange: number;
  timestamp: string;
  triggered: boolean;
}