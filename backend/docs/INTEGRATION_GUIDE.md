# AI Travel Agent Integration Guide

## Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Redis server running (or use demo mode)
- Amadeus API credentials (or use demo mode)

### 2. Environment Setup

Create a `.env` file in the backend directory:

```env
# Server Configuration
NODE_ENV=development
PORT=8000
HOST=localhost

# Database (optional - will use file mode if not set)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travel_agent
DB_USER=your_user
DB_PASSWORD=your_password

# Redis (optional - will use memory mode if not set)
REDIS_HOST=localhost
REDIS_PORT=6379

# Session Secret (required)
SESSION_SECRET=your-super-secret-key-change-in-production

# External APIs
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
CLAUDE_API_KEY=your_claude_api_key

# Feature Flags
FEATURE_DEMO_MODE=true
FEATURE_EMAIL_NOTIFICATIONS=false

# Email Configuration (if notifications enabled)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=AI Travel Agent <noreply@example.com>
```

### 3. Installation

```bash
cd backend
npm install
npm run build
npm run start
```

## Integration Examples

### JavaScript/TypeScript

```typescript
class TravelAgentClient {
  private baseUrl: string;
  private sessionCookie?: string;

  constructor(baseUrl: string = 'http://localhost:8000/api/v1') {
    this.baseUrl = baseUrl;
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
      credentials: 'include'
    });
    return response.json();
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    
    // Store session cookie for subsequent requests
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      this.sessionCookie = cookies.split(';')[0];
    }
    
    return response.json();
  }

  async searchFlights(params: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults?: number;
  }) {
    const response = await fetch(`${this.baseUrl}/flights/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.sessionCookie || ''
      },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async chatWithAgent(message: string, conversationId?: string) {
    const response = await fetch(`${this.baseUrl}/travel-agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.sessionCookie || ''
      },
      body: JSON.stringify({ message, conversationId })
    });
    return response.json();
  }
}

// Usage example
const client = new TravelAgentClient();

// Register and login
await client.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe'
});

await client.login('user@example.com', 'SecurePass123!');

// Search for flights
const searchResults = await client.searchFlights({
  origin: 'JFK',
  destination: 'LAX',
  departureDate: '2024-03-15',
  returnDate: '2024-03-22',
  adults: 1
});

// Chat with AI agent
const chatResponse = await client.chatWithAgent(
  'I need to fly from New York to Los Angeles next month'
);
console.log(chatResponse.data.response);
```

### Python

```python
import requests
from datetime import datetime, timedelta

class TravelAgentClient:
    def __init__(self, base_url='http://localhost:8000/api/v1'):
        self.base_url = base_url
        self.session = requests.Session()
    
    def register(self, email, password, first_name, last_name):
        response = self.session.post(
            f'{self.base_url}/auth/register',
            json={
                'email': email,
                'password': password,
                'firstName': first_name,
                'lastName': last_name
            }
        )
        return response.json()
    
    def login(self, email, password):
        response = self.session.post(
            f'{self.base_url}/auth/login',
            json={'email': email, 'password': password}
        )
        return response.json()
    
    def search_flights(self, origin, destination, departure_date, 
                      return_date=None, adults=1):
        params = {
            'origin': origin,
            'destination': destination,
            'departureDate': departure_date,
            'adults': adults
        }
        if return_date:
            params['returnDate'] = return_date
        
        response = self.session.post(
            f'{self.base_url}/flights/search',
            json=params
        )
        return response.json()
    
    def save_search(self, name, search_params, enable_alerts=True, 
                   target_price=None):
        data = {
            'name': name,
            'searchParams': search_params,
            'priceAlerts': {
                'enabled': enable_alerts
            }
        }
        if target_price:
            data['priceAlerts']['targetPrice'] = target_price
        
        response = self.session.post(
            f'{self.base_url}/flights/saved-searches',
            json=data
        )
        return response.json()
    
    def chat_with_agent(self, message, conversation_id=None):
        data = {'message': message}
        if conversation_id:
            data['conversationId'] = conversation_id
        
        response = self.session.post(
            f'{self.base_url}/travel-agent/chat',
            json=data
        )
        return response.json()

# Usage example
client = TravelAgentClient()

# Register and login
client.register('user@example.com', 'SecurePass123!', 'John', 'Doe')
client.login('user@example.com', 'SecurePass123!')

# Search for flights
next_month = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
return_date = (datetime.now() + timedelta(days=37)).strftime('%Y-%m-%d')

results = client.search_flights('JFK', 'LAX', next_month, return_date)
print(f"Found {len(results['data']['offers'])} flights")

# Save search with price alert
if results['data']['offers']:
    lowest_price = min(
        float(offer['price']['total']) 
        for offer in results['data']['offers']
    )
    
    client.save_search(
        'NYC to LA Next Month',
        {
            'origin': 'JFK',
            'destination': 'LAX',
            'departureDate': next_month,
            'returnDate': return_date,
            'adults': 1
        },
        enable_alerts=True,
        target_price=lowest_price * 0.9  # Alert if 10% cheaper
    )

# Chat with AI agent
chat_response = client.chat_with_agent(
    'What are the best times to fly to avoid crowds?'
)
print(chat_response['data']['response'])
```

## WebSocket Integration (Future)

For real-time price updates and notifications:

```javascript
// Coming in future version
const ws = new WebSocket('ws://localhost:8000/ws');

ws.on('open', () => {
  // Subscribe to price updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'price-updates',
    searchIds: ['search-uuid-1', 'search-uuid-2']
  }));
});

ws.on('message', (data) => {
  const update = JSON.parse(data);
  if (update.type === 'price-alert') {
    console.log(`Price dropped for ${update.searchName}: $${update.newPrice}`);
  }
});
```

## Best Practices

### 1. Error Handling
Always check the `success` field and handle errors appropriately:

```javascript
const result = await client.searchFlights(params);
if (!result.success) {
  switch (result.error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 60000));
      break;
    case 'VALIDATION_ERROR':
      // Fix input data
      console.error('Invalid input:', result.error.details);
      break;
    default:
      // Log and handle gracefully
      console.error('API Error:', result.error.message);
  }
}
```

### 2. Session Management
Store and reuse session cookies to avoid repeated logins:

```javascript
// Save session after login
localStorage.setItem('travelAgentSession', sessionCookie);

// Restore session on app start
const savedSession = localStorage.getItem('travelAgentSession');
if (savedSession) {
  client.setSession(savedSession);
}
```

### 3. Rate Limiting
Respect rate limits to avoid being blocked:

```javascript
class RateLimitedClient extends TravelAgentClient {
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async makeRequest(fn: () => Promise<any>) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }
  
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      await request();
      // Wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }
}
```

### 4. Caching
Cache search results to improve performance:

```javascript
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function cachedSearch(params) {
  const cacheKey = JSON.stringify(params);
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const result = await client.searchFlights(params);
  cache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  
  return result;
}
```

## Testing

### Using Demo Mode
Enable demo mode for testing without external dependencies:

```env
FEATURE_DEMO_MODE=true
```

This provides:
- Mock flight data
- Simulated price changes
- Test user accounts
- No external API calls

### Test Credentials
In demo mode, use these test accounts:
- Email: `demo@example.com`
- Password: `DemoPass123!`

### API Testing with cURL

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# Login (save cookies)
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Search flights (with cookies)
curl -X POST http://localhost:8000/api/v1/flights/search \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"origin":"JFK","destination":"LAX","departureDate":"2024-03-15"}'
```

## Monitoring Integration

### Prometheus Metrics
Metrics are exposed at `/metrics` endpoint:

```yaml
# Example Prometheus configuration
scrape_configs:
  - job_name: 'travel-agent-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/v1/monitoring/metrics/prometheus'
```

### Health Checks
For Kubernetes or load balancer health checks:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Support

For issues or questions:
1. Check the [API Documentation](./API_DOCUMENTATION.md)
2. Review [TypeScript type definitions](../src/types/)
3. Open an issue on GitHub
4. Contact support@example.com