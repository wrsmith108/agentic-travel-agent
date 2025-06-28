# AI Travel Agent API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication
All endpoints (except auth endpoints) require authentication via session cookies. Include the session cookie received from login in all requests.

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "message": "Registration successful"
  }
}
```

#### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "customSessionId": "session-uuid"
  }
}
```

#### Logout
```http
POST /auth/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Flight Search

#### Search Flights
```http
POST /flights/search
```

**Request Body:**
```json
{
  "origin": "JFK",
  "destination": "LAX",
  "departureDate": "2024-03-15",
  "returnDate": "2024-03-22",
  "adults": 1,
  "cabinClass": "ECONOMY",
  "nonStop": false,
  "maxPrice": 1000,
  "currency": "USD"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "offers": [
      {
        "id": "offer-uuid",
        "price": {
          "currency": "USD",
          "total": "450.00",
          "base": "380.00",
          "grandTotal": "450.00"
        },
        "itineraries": [
          {
            "duration": "PT5H30M",
            "segments": [
              {
                "departure": {
                  "iataCode": "JFK",
                  "terminal": "4",
                  "at": "2024-03-15T08:00:00"
                },
                "arrival": {
                  "iataCode": "LAX",
                  "terminal": "7",
                  "at": "2024-03-15T11:30:00"
                },
                "carrierCode": "AA",
                "number": "123",
                "aircraft": {
                  "code": "738"
                },
                "duration": "PT5H30M"
              }
            ]
          }
        ],
        "validatingAirlineCodes": ["AA"],
        "travelerPricings": [
          {
            "travelerId": "1",
            "fareOption": "STANDARD",
            "travelerType": "ADULT",
            "price": {
              "currency": "USD",
              "total": "450.00",
              "base": "380.00"
            }
          }
        ]
      }
    ],
    "meta": {
      "count": 25
    }
  }
}
```

#### Get Saved Searches
```http
GET /flights/saved-searches
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "search-uuid",
      "name": "NYC to LA Spring Break",
      "searchParams": {
        "origin": "JFK",
        "destination": "LAX",
        "departureDate": "2024-03-15",
        "returnDate": "2024-03-22"
      },
      "priceAlerts": {
        "enabled": true,
        "targetPrice": 400,
        "lastCheckedPrice": 450
      },
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### Save Search
```http
POST /flights/saved-searches
```

**Request Body:**
```json
{
  "name": "NYC to LA Spring Break",
  "searchParams": {
    "origin": "JFK",
    "destination": "LAX",
    "departureDate": "2024-03-15",
    "returnDate": "2024-03-22",
    "adults": 1,
    "cabinClass": "ECONOMY"
  },
  "priceAlerts": {
    "enabled": true,
    "targetPrice": 400
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "search-uuid",
    "message": "Search saved successfully"
  }
}
```

#### Delete Saved Search
```http
DELETE /flights/saved-searches/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Search deleted successfully"
}
```

#### Check Price Alerts
```http
POST /flights/check-prices
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "savedSearchId": "search-uuid",
      "savedSearchName": "NYC to LA Spring Break",
      "currentLowestPrice": 380,
      "previousPrice": 450,
      "priceChange": -70,
      "percentChange": -15.5,
      "alert": {
        "id": "alert-uuid",
        "type": "PRICE_DROP",
        "message": "Price dropped by $70 (15.5%)",
        "flightOffer": { /* flight details */ }
      }
    }
  ]
}
```

### Conversational AI Agent

#### Start Conversation
```http
POST /travel-agent/chat
```

**Request Body:**
```json
{
  "message": "I need to fly from New York to Los Angeles next month for a week",
  "conversationId": "optional-conversation-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "I'd be happy to help you find flights from New York to Los Angeles! To provide the best options, could you tell me:\n1. Your specific travel dates?\n2. How many passengers?\n3. Any preference for cabin class?\n4. Do you have a budget in mind?",
    "conversationId": "conversation-uuid",
    "suggestedActions": [
      {
        "type": "search",
        "params": {
          "origin": "NYC",
          "destination": "LAX"
        }
      }
    ]
  }
}
```

#### Get Conversation History
```http
GET /conversations/:conversationId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "conversation-uuid",
    "messages": [
      {
        "id": "msg-uuid-1",
        "role": "user",
        "content": "I need to fly from New York to Los Angeles next month",
        "timestamp": "2024-01-15T10:00:00Z"
      },
      {
        "id": "msg-uuid-2",
        "role": "assistant",
        "content": "I'd be happy to help...",
        "timestamp": "2024-01-15T10:00:05Z"
      }
    ],
    "metadata": {
      "lastActivity": "2024-01-15T10:00:05Z",
      "messageCount": 2
    }
  }
}
```

### User Preferences

#### Get Preferences
```http
GET /preferences
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "notifications": {
      "emailEnabled": true,
      "frequency": "INSTANT",
      "priceAlerts": {
        "enabled": true,
        "thresholdType": "PERCENTAGE",
        "thresholdValue": 10,
        "onlyPriceDrops": true
      },
      "searchExpiration": {
        "enabled": true,
        "daysBeforeExpiry": 7
      },
      "marketing": {
        "enabled": false,
        "deals": false,
        "newsletter": false
      }
    },
    "search": {
      "defaultCabinClass": "ECONOMY",
      "preferredAirlines": ["AA", "DL"],
      "excludedAirlines": [],
      "maxStops": 1,
      "includeBudgetAirlines": true,
      "flexibleDates": {
        "enabled": false,
        "daysBefore": 3,
        "daysAfter": 3
      },
      "baggageIncluded": false
    },
    "display": {
      "currency": "USD",
      "dateFormat": "MM/DD/YYYY",
      "timeFormat": "12h",
      "temperatureUnit": "fahrenheit",
      "distanceUnit": "miles",
      "language": "en",
      "theme": "auto"
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Update Preferences
```http
PATCH /preferences
```

**Request Body (partial update):**
```json
{
  "notifications": {
    "frequency": "DAILY",
    "priceAlerts": {
      "thresholdValue": 15
    }
  },
  "search": {
    "preferredAirlines": ["AA", "DL", "UA"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated preferences object */ }
}
```

#### Reset Preferences
```http
POST /preferences/reset
```

**Response:**
```json
{
  "success": true,
  "data": { /* default preferences object */ },
  "message": "Preferences have been reset to defaults"
}
```

### Monitoring & Health

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "operational",
    "redis": "operational",
    "amadeus": "operational"
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

#### Get Metrics
```http
GET /monitoring/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": {
      "total": 15420,
      "success": 15000,
      "error": 420
    },
    "performance": {
      "avgResponseTime": 245,
      "p95ResponseTime": 890,
      "p99ResponseTime": 1200
    },
    "searches": {
      "total": 3500,
      "saved": 850,
      "withAlerts": 600
    }
  }
}
```

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional additional details */ }
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid request data
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Access denied
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict (e.g., duplicate email)
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVICE_ERROR`: Internal server error
- `EXTERNAL_SERVICE_ERROR`: Third-party service error

## Rate Limiting

- Authentication endpoints: 5 requests per minute
- Search endpoints: 30 requests per minute
- Other endpoints: 60 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Best Practices

1. **Always handle errors**: Check the `success` field before processing data
2. **Use pagination**: For list endpoints, use `limit` and `offset` parameters
3. **Cache responses**: Flight search results can be cached for up to 30 minutes
4. **Batch operations**: Use batch endpoints when checking multiple saved searches
5. **Set preferences**: Configure user preferences to optimize the experience