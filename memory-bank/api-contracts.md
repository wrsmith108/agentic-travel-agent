# 📄 API Contracts & Interfaces
## Agentic Travel Agent MVP

**Version**: 1.0.0  
**Base URL**: `http://localhost:3001/api/v1`  
**Format**: REST/JSON  
**Auth**: Session-based (cookies)

---

## 🔐 Authentication APIs

### Register User
```typescript
POST /api/v1/auth/register

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "preferences": {
    "currency": "CAD",
    "timezone": "America/Toronto",
    "preferredDepartureAirport": "YYZ",
    "communicationFrequency": "daily"
  }
}

Response: 201 Created
{
  "success": true,
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "preferences": { ... }
    }
  }
}

Errors:
- 400: Invalid input data
- 409: Email already exists
```

### Login
```typescript
POST /api/v1/auth/login

Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}

Errors:
- 401: Invalid credentials
- 404: User not found
```

### Logout
```typescript
POST /api/v1/auth/logout

Response: 200 OK
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### Get Current User
```typescript
GET /api/v1/auth/me

Response: 200 OK
{
  "success": true,
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "preferences": { ... },
      "activeSearches": ["search-id-1", "search-id-2"]
    }
  }
}

Errors:
- 401: Not authenticated
```

---

## ✈️ Flight Search APIs

### Search Flights
```typescript
POST /api/v1/flights/search

Request:
{
  "origin": "YYZ",
  "destination": "NRT",
  "departureDate": "2025-04-20T00:00:00.000Z",
  "returnDate": "2025-04-27T00:00:00.000Z",  // optional
  "passengers": {
    "adults": 1,
    "children": 0,
    "infants": 0
  },
  "travelClass": "economy",
  "maxPrice": 1200,
  "currency": "CAD",
  "nonStop": false
}

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "offer-123",
      "price": 1150,
      "currency": "CAD",
      "airline": "AC",
      "flightNumber": "AC001",
      "departureTime": "2025-04-20T22:00:00.000Z",
      "arrivalTime": "2025-04-21T14:00:00.000Z",
      "duration": "PT14H",
      "stops": 0,
      "bookingUrl": "https://..."
    }
  ],
  "meta": {
    "searchId": "search-456",
    "resultCount": 25,
    "cached": false
  }
}

Errors:
- 400: Invalid search criteria
- 403: Demo mode (limited routes)
- 503: Amadeus API unavailable
```

### Get Price History
```typescript
GET /api/v1/flights/history?origin=YYZ&destination=NRT&days=90

Response: 200 OK
{
  "success": true,
  "data": {
    "route": "YYZ-NRT",
    "currency": "CAD",
    "priceHistory": [
      {
        "date": "2025-03-20T00:00:00.000Z",
        "minPrice": 980,
        "avgPrice": 1250,
        "maxPrice": 2100
      }
    ],
    "statistics": {
      "currentPrice": 1150,
      "averagePrice": 1250,
      "lowestPrice": 980,
      "trend": "decreasing"
    }
  }
}
```

### Create Price Monitor
```typescript
POST /api/v1/flights/monitor

Request:
{
  "searchId": "search-456",
  "maxPrice": 1000,
  "notificationPreferences": {
    "channel": "email",  // email, sms, whatsapp
    "frequency": "immediate"  // immediate, daily, weekly
  }
}

Response: 201 Created
{
  "success": true,
  "data": {
    "monitoringId": "monitor-789",
    "status": "active",
    "criteria": { ... },
    "nextCheck": "2025-06-24T00:00:00.000Z"
  }
}

Errors:
- 400: Invalid monitoring criteria
- 404: Search not found
- 409: Already monitoring
```

### List User's Monitors
```typescript
GET /api/v1/flights/monitors

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "monitor-789",
      "searchCriteria": { ... },
      "status": "active",
      "lastChecked": "2025-06-23T12:00:00.000Z",
      "alertsSent": 2,
      "bestPriceFound": {
        "price": 950,
        "foundAt": "2025-06-22T08:00:00.000Z"
      }
    }
  ]
}
```

### Update Monitor
```typescript
PUT /api/v1/flights/monitors/:monitorId

Request:
{
  "status": "paused",  // active, paused, cancelled
  "maxPrice": 1100,
  "notificationPreferences": { ... }
}

Response: 200 OK
{
  "success": true,
  "data": {
    "id": "monitor-789",
    "status": "paused",
    "updatedAt": "2025-06-23T14:00:00.000Z"
  }
}
```

---

## 🤖 AI Conversation APIs

### Start Conversation
```typescript
POST /api/v1/ai/conversations

Response: 201 Created
{
  "success": true,
  "data": {
    "conversationId": "conv-123",
    "welcomeMessage": "Hi! I'd love to help you find great flights. Where are you thinking of going?",
    "status": "active"
  }
}
```

### Send Message
```typescript
POST /api/v1/ai/conversations/:conversationId/messages

Request:
{
  "message": "I want to visit Tokyo in April"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "messageId": "msg-456",
    "response": "Tokyo in April sounds wonderful! The cherry blossoms should be beautiful. What dates in April are you considering?",
    "extractedInfo": {
      "destination": "NRT",
      "month": "April",
      "year": 2025
    },
    "needsMoreInfo": ["departureDate", "origin", "passengers"]
  }
}

Errors:
- 404: Conversation not found
- 429: Rate limit exceeded
- 503: AI service unavailable
```

### Get Conversation History
```typescript
GET /api/v1/ai/conversations/:conversationId

Response: 200 OK
{
  "success": true,
  "data": {
    "conversationId": "conv-123",
    "messages": [
      {
        "id": "msg-1",
        "role": "assistant",
        "content": "Hi! I'd love to help...",
        "timestamp": "2025-06-23T10:00:00.000Z"
      },
      {
        "id": "msg-2",
        "role": "user",
        "content": "I want to visit Tokyo in April",
        "timestamp": "2025-06-23T10:01:00.000Z"
      }
    ],
    "extractedCriteria": {
      "destination": "NRT",
      "departureDate": "2025-04-20",
      "passengers": { "adults": 1 }
    }
  }
}
```

### Create Search from Conversation
```typescript
POST /api/v1/ai/conversations/:conversationId/create-search

Response: 201 Created
{
  "success": true,
  "data": {
    "searchId": "search-789",
    "criteria": {
      "origin": "YYZ",
      "destination": "NRT",
      "departureDate": "2025-04-20T00:00:00.000Z",
      "passengers": { "adults": 1, "children": 0, "infants": 0 },
      "maxPrice": 1200,
      "currency": "CAD"
    },
    "message": "Great! I've set up monitoring for flights from Toronto to Tokyo on April 20th with a budget of $1,200 CAD."
  }
}

Errors:
- 400: Incomplete criteria
- 404: Conversation not found
```

---

## 👤 User Management APIs

### Get User Profile
```typescript
GET /api/v1/users/profile

Response: 200 OK
{
  "success": true,
  "data": {
    "profile": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "preferences": { ... },
      "createdAt": "2025-06-01T00:00:00.000Z"
    },
    "statistics": {
      "activeSearches": 3,
      "totalSearches": 15,
      "alertsSent": 8
    }
  }
}
```

### Update User Preferences
```typescript
PUT /api/v1/users/preferences

Request:
{
  "currency": "USD",
  "timezone": "America/New_York",
  "preferredDepartureAirport": "JFK",
  "communicationFrequency": "weekly"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "preferences": { ... },
    "updatedAt": "2025-06-23T14:00:00.000Z"
  }
}
```

### Delete Account
```typescript
DELETE /api/v1/users/account

Response: 200 OK
{
  "success": true,
  "data": {
    "message": "Account deleted successfully",
    "deletedAt": "2025-06-23T14:00:00.000Z"
  }
}
```

---

## 📧 Notification APIs

### Get Notification History
```typescript
GET /api/v1/notifications

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "notif-123",
      "type": "price_alert",
      "channel": "email",
      "sentAt": "2025-06-22T10:00:00.000Z",
      "status": "delivered",
      "content": {
        "subject": "Price Drop Alert: Toronto to Tokyo",
        "priceChange": -150,
        "newPrice": 950
      }
    }
  ]
}
```

### Update Notification Settings
```typescript
PUT /api/v1/notifications/settings

Request:
{
  "email": {
    "enabled": true,
    "address": "user@example.com"
  },
  "sms": {
    "enabled": false,
    "phoneNumber": "+16041234567"
  },
  "whatsapp": {
    "enabled": true,
    "phoneNumber": "+16041234567"
  }
}

Response: 200 OK
{
  "success": true,
  "data": {
    "settings": { ... },
    "updatedAt": "2025-06-23T14:00:00.000Z"
  }
}
```

---

## 🔧 System APIs

### Health Check
```typescript
GET /health

Response: 200 OK
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2025-06-23T14:00:00.000Z",
  "environment": "development",
  "checks": {
    "database": true,
    "externalApis": {
      "anthropic": true,
      "amadeus": true,
      "sendgrid": true,
      "twilio": true
    },
    "diskSpace": true,
    "memory": true
  }
}
```

### API Info
```typescript
GET /api/v1

Response: 200 OK
{
  "success": true,
  "data": {
    "name": "Agentic Travel Agent API",
    "version": "1.0.0",
    "environment": "development",
    "features": {
      "demoMode": true,
      "emailNotifications": true,
      "smsNotifications": true,
      "whatsappNotifications": true
    }
  }
}
```

---

## 🌐 Common Response Formats

### Success Response
```typescript
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-06-23T14:00:00.000Z",
    "requestId": "req-123"
  }
}
```

### Error Response
```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "meta": {
    "timestamp": "2025-06-23T14:00:00.000Z",
    "requestId": "req-123"
  }
}
```

### Pagination (Future)
```typescript
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 📋 Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| AUTHENTICATION_REQUIRED | 401 | User not authenticated |
| AUTHORIZATION_FAILED | 403 | User lacks permission |
| RESOURCE_NOT_FOUND | 404 | Resource doesn't exist |
| DUPLICATE_RESOURCE | 409 | Resource already exists |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| EXTERNAL_API_ERROR | 503 | External service failed |
| INTERNAL_SERVER_ERROR | 500 | Server error |

---

## 🔑 Authentication Details

### Session Management
- Sessions stored server-side
- Session cookie: `connect.sid`
- Cookie settings: HTTPOnly, Secure (in production)
- Session timeout: 7 days
- Sliding expiration: Yes

### Required Headers
```
Content-Type: application/json
Cookie: connect.sid=...
```

### CORS Settings
- Allowed origins: http://localhost:3000, http://localhost:5173
- Credentials: true
- Methods: GET, POST, PUT, DELETE, OPTIONS

---

**Note**: All timestamps are in ISO 8601 format (UTC). All currency amounts are in cents/minor units unless specified otherwise.