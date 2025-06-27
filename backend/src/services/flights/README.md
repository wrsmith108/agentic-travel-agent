# Flight Search Service

## Overview
The Flight Search Service integrates with the Amadeus API to provide real-time flight search capabilities.

## Features
- **Flight Search**: Search flights with multiple parameters (origin, destination, dates, travelers, class)
- **Airport Search**: Find airports by keyword or location
- **Location Information**: Get detailed airport and city information
- **Price Formatting**: Automatic currency formatting
- **Error Handling**: Comprehensive error handling with Result pattern

## API Endpoints

### 1. Search Flights
```bash
POST /api/v1/flights/search
Authorization: Bearer <token>

{
  "origin": "JFK",
  "destination": "LAX",
  "departureDate": "2024-07-26",
  "returnDate": "2024-08-02",    // optional
  "adults": 1,
  "children": 0,
  "infants": 0,
  "travelClass": "ECONOMY",      // ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST
  "nonStop": false,
  "currencyCode": "USD",
  "maxPrice": 1000,              // optional
  "maxResults": 10
}
```

### 2. Quick Search
```bash
POST /api/v1/flights/quick-search
Authorization: Bearer <token>

{
  "from": "NYC",
  "to": "LON",
  "when": "2024-07-26T10:00:00Z",
  "returnWhen": "2024-08-02T10:00:00Z",  // optional
  "travelers": 2
}
```

### 3. Search Airports
```bash
GET /api/v1/flights/airports?keyword=Paris
Authorization: Bearer <token>
```

### 4. Get Location Info
```bash
GET /api/v1/flights/locations/JFK
Authorization: Bearer <token>
```

## Response Format

### Flight Search Response
```json
{
  "success": true,
  "data": {
    "flights": [
      {
        "id": "1",
        "origin": "JFK",
        "destination": "LAX",
        "departureTime": "2024-07-26T10:00:00",
        "arrivalTime": "2024-07-26T13:30:00",
        "duration": "5h 30m",
        "stops": 0,
        "carrier": "AA",
        "carrierName": "American Airlines",
        "price": {
          "total": 250,
          "currency": "USD",
          "formatted": "$250"
        },
        "cabin": "ECONOMY",
        "bookableSeats": 9,
        "segments": [...]
      }
    ],
    "count": 10
  }
}
```

## Configuration
Set the following environment variables:
```
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_ENVIRONMENT=test  # or 'production'
```

## Error Handling
The service uses the Result pattern with typed errors:
- `VALIDATION_ERROR`: Invalid search parameters
- `API_ERROR`: Amadeus API errors
- `RATE_LIMIT`: Too many requests
- `NOT_FOUND`: Resource not found
- `AUTHENTICATION_ERROR`: Invalid API credentials
- `SYSTEM_ERROR`: Internal server errors

## Demo
Visit http://localhost:3001/travel-agent.html for a full demo with:
- AI chat integration
- Real-time flight search
- Interactive flight results

## Testing
Run the test script:
```bash
npx tsx src/utils/testFlightSearch.ts
```

## Notes
- The Amadeus test environment has limited data (mainly major routes)
- Production environment requires paid account
- Rate limits apply (check Amadeus documentation)
- All flights require authentication via JWT token