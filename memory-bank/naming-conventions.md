# 📝 Naming Conventions & Code Standards
## Agentic Travel Agent MVP

**Senior Engineering Team Standards**  
**Purpose**: Eliminate naming inconsistencies and syntax errors  
**Compliance**: TypeScript strict mode, ESLint Airbnb, Prettier  
**Updated**: June 23, 2025

---

## 🎯 Core Naming Principles

### Universal Rules
1. **Be Descriptive**: Names should clearly indicate purpose and behavior
2. **Avoid Abbreviations**: Use full words unless industry standard (e.g., `id`, `url`, `api`)
3. **Use English**: All names in American English
4. **Be Consistent**: Same naming pattern for same concept across codebase
5. **Avoid Reserved Words**: No JavaScript/TypeScript keywords as identifiers

---

## 📁 File & Directory Naming

### Directory Structure
```
frontend/src/
├── components/          # React components
│   ├── ai-agent/        # kebab-case for feature directories
│   ├── dashboard/
│   ├── shared/
│   └── settings/
├── services/            # Business logic services
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── types/               # TypeScript definitions
├── constants/           # Application constants
└── __tests__/           # Test files

backend/src/
├── routes/              # Express route handlers
├── services/            # Business logic services
│   ├── ai-agent/
│   ├── flight/
│   ├── email/
│   └── storage/
├── middleware/          # Express middleware
├── jobs/                # Background jobs
├── utils/               # Utility functions
├── types/               # TypeScript interfaces
├── config/              # Configuration
└── __tests__/           # Test files
```

### File Naming Standards
```typescript
// React Components - PascalCase
FlightSearchForm.tsx
UserPreferencesModal.tsx
PriceAlertCard.tsx
DashboardHeader.tsx

// Services - camelCase
flightMonitoringService.ts
userPreferencesService.ts
emailNotificationService.ts
conversationService.ts

// Utilities - camelCase
dateUtils.ts
validationUtils.ts
formatUtils.ts
apiUtils.ts

// Types/Interfaces - PascalCase
FlightSearchCriteria.ts
UserProfile.ts
ApiResponse.ts
EmailTemplate.ts

// Constants - SCREAMING_SNAKE_CASE
API_ENDPOINTS.ts
ERROR_CODES.ts
VALIDATION_SCHEMAS.ts
APP_CONSTANTS.ts

// Hooks - camelCase with 'use' prefix
useFlightSearch.ts
useUserPreferences.ts
useConversation.ts
useLocalStorage.ts

// Test Files - match source with .test or .spec
FlightSearchForm.test.tsx
flightMonitoringService.test.ts
userPreferences.integration.test.ts
flightSearch.e2e.spec.ts

// Data Files - kebab-case with descriptive suffix
user-{uuid}.json
flight-search-{id}.json
system-config.json
demo-data.json
```

---

## 🔧 TypeScript Naming Standards

### Interfaces & Types
```typescript
// Interfaces - PascalCase with 'I' prefix for disambiguation when needed
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
}

interface IUserRepository {  // When interface/class name conflict
  findById(id: string): Promise<UserProfile>;
}

// Types - PascalCase
type FlightSearchStatus = 'active' | 'paused' | 'completed';
type CurrencyCode = 'CAD' | 'USD' | 'EUR' | 'GBP';
type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

// Generic type parameters - Single uppercase letter
interface ApiResponse<T> {
  data: T;
  success: boolean;
}

interface Repository<TEntity, TKey> {
  findById(id: TKey): Promise<TEntity | null>;
  save(entity: TEntity): Promise<TEntity>;
}
```

### Classes & Methods
```typescript
// Classes - PascalCase
class FlightMonitoringService {
  private readonly amadeusClient: AmadeusClient;
  
  // Methods - camelCase, descriptive verbs
  async searchFlights(criteria: FlightSearchCriteria): Promise<FlightOffer[]> {}
  async createPriceAlert(userId: string, searchId: string): Promise<void> {}
  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {}
  
  // Private methods - camelCase with underscore prefix if needed for clarity
  private async _validateSearchCriteria(criteria: FlightSearchCriteria): Promise<void> {}
  private async _formatAmadeusResponse(response: AmadeusResponse): Promise<FlightOffer[]> {}
}

// Abstract classes - PascalCase with 'Abstract' prefix
abstract class AbstractEmailService {
  abstract sendEmail(template: EmailTemplate, data: Record<string, unknown>): Promise<void>;
}

// Service implementations - PascalCase with service type suffix
class SendGridEmailService extends AbstractEmailService {}
class MockEmailService extends AbstractEmailService {}
```

### Variables & Functions
```typescript
// Variables - camelCase
const flightSearchCriteria: FlightSearchCriteria = {};
const userPreferences: UserPreferences = {};
const currentDate: Date = new Date();
const isSearchActive: boolean = true;

// Constants - SCREAMING_SNAKE_CASE
const MAX_FLIGHT_RESULTS = 50;
const API_TIMEOUT_MS = 30000;
const DEFAULT_CURRENCY = 'CAD';
const PRICE_CHECK_INTERVAL_HOURS = 24;

// Function names - camelCase with descriptive verbs
function validateFlightCriteria(criteria: FlightSearchCriteria): ValidationResult {}
function formatPriceDisplay(price: number, currency: CurrencyCode): string {}
function calculatePriceChange(current: number, previous: number): PriceChange {}

// Async functions - clearly indicate async behavior
async function fetchFlightOffers(criteria: FlightSearchCriteria): Promise<FlightOffer[]> {}
async function saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {}
```

---

## ⚛️ React Component Naming

### Component Structure
```typescript
// Component files - PascalCase
// FlightSearchForm.tsx
import React, { useState, useCallback } from 'react';
import { FlightSearchCriteria } from '@/types/FlightSearchCriteria';

interface FlightSearchFormProps {
  onSubmit: (criteria: FlightSearchCriteria) => void;
  initialCriteria?: Partial<FlightSearchCriteria>;
  isLoading?: boolean;
}

export const FlightSearchForm: React.FC<FlightSearchFormProps> = ({
  onSubmit,
  initialCriteria,
  isLoading = false
}) => {
  // State variables - camelCase with descriptive names
  const [searchCriteria, setSearchCriteria] = useState<FlightSearchCriteria>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isFormValid, setIsFormValid] = useState<boolean>(false);

  // Event handlers - camelCase with 'handle' prefix
  const handleOriginChange = useCallback((value: string) => {
    setSearchCriteria(prev => ({ ...prev, origin: value }));
  }, []);

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (isFormValid) {
      onSubmit(searchCriteria);
    }
  }, [searchCriteria, isFormValid, onSubmit]);

  // Render methods - camelCase with 'render' prefix
  const renderOriginInput = () => (
    <input
      type="text"
      value={searchCriteria.origin || ''}
      onChange={(e) => handleOriginChange(e.target.value)}
      placeholder="Departure airport (e.g., YYZ)"
    />
  );

  return (
    <form onSubmit={handleSubmit} className="flight-search-form">
      {renderOriginInput()}
      {/* ... other form fields */}
    </form>
  );
};

// Export component as default and named
export default FlightSearchForm;
```

### Hook Naming
```typescript
// Custom hooks - camelCase with 'use' prefix
// useFlightSearch.ts
export const useFlightSearch = (initialCriteria?: FlightSearchCriteria) => {
  const [searchResults, setSearchResults] = useState<FlightOffer[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const executeSearch = useCallback(async (criteria: FlightSearchCriteria) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const results = await flightSearchService.searchFlights(criteria);
      setSearchResults(results);
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    executeSearch
  };
};
```

---

## 🌐 API & Route Naming

### REST API Endpoints
```typescript
// RESTful conventions - kebab-case for URLs
GET    /api/v1/users/{userId}
POST   /api/v1/users
PUT    /api/v1/users/{userId}
DELETE /api/v1/users/{userId}

GET    /api/v1/users/{userId}/flight-searches
POST   /api/v1/users/{userId}/flight-searches
PUT    /api/v1/users/{userId}/flight-searches/{searchId}
DELETE /api/v1/users/{userId}/flight-searches/{searchId}

GET    /api/v1/flight-searches/{searchId}/price-history
POST   /api/v1/flight-searches/{searchId}/check-prices

// System endpoints
GET    /api/v1/health
GET    /api/v1/metrics
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
```

### Route Handler Naming
```typescript
// Route handlers - camelCase with HTTP method prefix
// userRoutes.ts
export const getUserById = async (req: Request, res: Response): Promise<void> => {};
export const createUser = async (req: Request, res: Response): Promise<void> => {};
export const updateUser = async (req: Request, res: Response): Promise<void> => {};
export const deleteUser = async (req: Request, res: Response): Promise<void> => {};

// flightSearchRoutes.ts
export const getFlightSearches = async (req: Request, res: Response): Promise<void> => {};
export const createFlightSearch = async (req: Request, res: Response): Promise<void> => {};
export const updateFlightSearch = async (req: Request, res: Response): Promise<void> => {};
export const deleteFlightSearch = async (req: Request, res: Response): Promise<void> => {};
export const checkFlightPrices = async (req: Request, res: Response): Promise<void> => {};
```

---

## 📊 Database & Data Naming

### JSON File Naming
```typescript
// User data files
user-{uuid}.json
// Example: user-123e4567-e89b-12d3-a456-426614174000.json

// System configuration
system-config.json
demo-data.json
api-cache.json

// Temporary files
temp-{timestamp}-{operation}.json
// Example: temp-20250623143022-price-check.json
```

### Data Object Properties
```typescript
// JSON object properties - camelCase
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "John",
  "lastName": "Doe",
  "emailAddress": "john.doe@example.com",
  "createdAt": "2025-06-23T14:30:22.123Z",
  "updatedAt": "2025-06-23T14:30:22.123Z",
  "userPreferences": {
    "preferredCurrency": "CAD",
    "preferredTimezone": "America/Toronto",
    "preferredDepartureAirport": "YYZ",
    "communicationFrequency": "daily"
  },
  "activeFlightSearches": [
    {
      "id": "search-456e7890-f12b-34d5-a678-901234567890",
      "searchCriteria": {
        "originAirport": "YYZ",
        "destinationAirport": "NRT",
        "departureDate": "2025-04-20T00:00:00.000Z",
        "passengerCount": {
          "adults": 1,
          "children": 0,
          "infants": 0
        },
        "travelClass": "economy",
        "maxPrice": 1200,
        "currency": "CAD"
      },
      "searchStatus": "active",
      "lastPriceCheck": "2025-06-23T12:00:00.000Z",
      "priceHistory": []
    }
  ]
}
```

---

## 🧪 Test Naming Standards

### Test File Organization
```typescript
// Unit tests - match source file name
FlightSearchForm.test.tsx
flightMonitoringService.test.ts
userPreferencesService.test.ts

// Integration tests - describe integration
flightSearch.integration.test.ts
emailNotification.integration.test.ts
userAuthentication.integration.test.ts

// E2E tests - describe user journey
userRegistration.e2e.spec.ts
flightSearchWorkflow.e2e.spec.ts
priceAlertNotification.e2e.spec.ts
```

### Test Structure & Naming
```typescript
// Test descriptions - clear, descriptive sentences
describe('FlightSearchForm', () => {
  describe('when rendering with initial criteria', () => {
    it('should display the origin airport in the input field', () => {});
    it('should pre-select the travel class dropdown', () => {});
    it('should disable the submit button if criteria is invalid', () => {});
  });

  describe('when user submits valid search criteria', () => {
    it('should call onSubmit with the search criteria', () => {});
    it('should show loading state while processing', () => {});
    it('should clear any previous validation errors', () => {});
  });

  describe('when user enters invalid airport code', () => {
    it('should display validation error message', () => {});
    it('should prevent form submission', () => {});
    it('should highlight the invalid field', () => {});
  });
});

// Test variable naming - descriptive and clear
describe('flightMonitoringService', () => {
  it('should return flight offers when search criteria is valid', async () => {
    // Arrange
    const validSearchCriteria: FlightSearchCriteria = {
      origin: 'YYZ',
      destination: 'NRT',
      departureDate: '2025-04-20',
      passengers: { adults: 1, children: 0, infants: 0 },
      maxPrice: 1200,
      currency: 'CAD'
    };

    const expectedFlightOffers: FlightOffer[] = [
      { id: 'flight-1', price: 1150, currency: 'CAD' },
      { id: 'flight-2', price: 1180, currency: 'CAD' }
    ];

    // Act
    const actualFlightOffers = await flightMonitoringService.searchFlights(validSearchCriteria);

    // Assert
    expect(actualFlightOffers).toEqual(expectedFlightOffers);
  });
});
```

---

## 🔧 Environment & Configuration Naming

### Environment Variables
```bash
# Application configuration - SCREAMING_SNAKE_CASE
NODE_ENV=development
APP_NAME=agentic_travel_agent
APP_VERSION=1.0.0
APP_PORT=3001

# API credentials - service name + purpose
ANTHROPIC_API_KEY=sk-ant-...
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_ENVIRONMENT=test
SENDGRID_API_KEY=SG.your_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# System configuration
LOG_LEVEL=info
DATA_DIRECTORY=./data
SESSION_SECRET=your_secure_session_secret
API_TIMEOUT_MS=30000

# Feature flags - FEATURE_ prefix
FEATURE_DEMO_MODE=true
FEATURE_PRICE_PROJECTIONS=false
FEATURE_MULTI_CURRENCY=true
```

### Configuration Object Naming
```typescript
// config/appConfig.ts
export const appConfig = {
  server: {
    port: process.env.APP_PORT || 3001,
    environment: process.env.NODE_ENV || 'development'
  },
  apis: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com'
    },
    amadeus: {
      clientId: process.env.AMADEUS_CLIENT_ID,
      clientSecret: process.env.AMADEUS_CLIENT_SECRET,
      environment: process.env.AMADEUS_ENVIRONMENT || 'test'
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL
    }
  },
  features: {
    demoMode: process.env.FEATURE_DEMO_MODE === 'true',
    priceProjections: process.env.FEATURE_PRICE_PROJECTIONS === 'true',
    multiCurrency: process.env.FEATURE_MULTI_CURRENCY === 'true'
  }
};
```

---

## 📋 CSS & Styling Naming

### CSS Classes - BEM Methodology
```css
/* Block - component name */
.flight-search-form { }
.price-alert-card { }
.user-preferences-modal { }

/* Element - part of block */
.flight-search-form__input { }
.flight-search-form__submit-button { }
.price-alert-card__title { }
.price-alert-card__price { }

/* Modifier - variation of block or element */
.flight-search-form--loading { }
.flight-search-form__submit-button--disabled { }
.price-alert-card--highlighted { }
```

### Tailwind CSS Classes
```typescript
// Component styling - descriptive class combinations
const FlightSearchForm = () => (
  <form className="bg-white rounded-lg shadow-md p-6 space-y-4">
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-700">
        Origin Airport
      </label>
      <input className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
      Search Flights
    </button>
  </form>
);
```

---

## ✅ Naming Conventions Checklist

### Pre-Implementation Review
- [ ] All file names follow established patterns
- [ ] TypeScript interfaces use PascalCase
- [ ] Variables and functions use camelCase
- [ ] Constants use SCREAMING_SNAKE_CASE
- [ ] CSS classes follow BEM methodology
- [ ] API endpoints use RESTful conventions
- [ ] Test descriptions are clear and descriptive
- [ ] Environment variables are properly categorized
- [ ] No reserved words used as identifiers
- [ ] All names are descriptive and unambiguous

### Code Review Standards
- [ ] Consistent naming across related components
- [ ] No abbreviations unless industry standard
- [ ] Event handlers use 'handle' prefix
- [ ] Render methods use 'render' prefix
- [ ] Boolean variables use 'is', 'has', 'can', 'should' prefixes
- [ ] Async functions clearly indicate async behavior
- [ ] Generic type parameters use single uppercase letters
- [ ] Private methods are clearly distinguished

---

**Status**: ✅ Naming Conventions Established  
**Compliance**: TypeScript strict mode, ESLint Airbnb, BEM CSS  
**Review**: All naming patterns documented with examples  
**Next**: Implement standardized project structure