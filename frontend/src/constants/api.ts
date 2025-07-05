// API Configuration Constants

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

export const API_ENDPOINTS = {
  // Chat endpoints
  DEMO_CHAT: '/api/v1/demo/chat',
  
  // Flight search endpoints
  FLIGHT_SEARCH: '/api/v1/flights/search',
  FLIGHT_SEARCH_NATURAL: '/api/v1/flights/search/natural',
  FLIGHT_DETAILS: '/api/v1/flights/:id',
  
  // Saved searches endpoints
  SAVED_SEARCHES: '/api/v1/searches',
  SAVED_SEARCH_BY_ID: '/api/v1/searches/:id',
  
  // Search history endpoints
  SEARCH_HISTORY: '/api/v1/searches/history',
  
  // Price monitoring endpoints
  PRICE_ALERTS: '/api/v1/price-alerts',
  PRICE_ALERT_BY_ID: '/api/v1/price-alerts/:id',
  
  // User preferences endpoints
  USER_PREFERENCES: '/api/v1/preferences',
  
  // Session management
  SESSIONS: '/api/v1/sessions',
  SESSION_BY_ID: '/api/v1/sessions/:id',
} as const;

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

export const RESPONSE_STATUS = {
  SUCCESS: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;