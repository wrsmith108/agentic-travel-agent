# 🏗️ Architecture Decision Records (ADR)
## Agentic Travel Agent MVP

**Senior Architect Team Documentation**  
**Standard**: Ultra-think implementation with 100% test coverage  
**Updated**: June 23, 2025

---

## 📋 Core Architectural Decisions

### ADR-001: Authentication Strategy
- **Decision**: Session-based auth for MVP, OAuth in future iterations
- **Context**: Localhost testing priority, production auth later
- **Consequences**: Simplified MVP, requires OAuth implementation in Phase 2
- **Status**: ✅ Approved

### ADR-002: AI Integration
- **Decision**: Direct Anthropic API integration (Claude Opus 4)
- **Context**: Requesty availability uncertain, direct API more reliable
- **Consequences**: Direct API management, consistent responses
- **Status**: ✅ Approved

### ADR-003: Scheduling Strategy
- **Decision**: Node-cron for MVP with Bull/BullMQ migration path
- **Context**: MVP simplicity vs. production reliability trade-off
- **Consequences**: Memory leak monitoring required, future migration planned
- **Status**: ✅ Approved with monitoring

### ADR-004: Data Storage
- **Decision**: Single JSON file per user for MVP
- **Context**: Simple MVP, database migration after testing
- **Consequences**: File locking considerations, atomic writes required
- **Status**: ✅ Approved

### ADR-005: Price Monitoring
- **Decision**: On-demand price checks with weekly update preparation
- **Context**: $100/month API budget constraint
- **Consequences**: User-triggered searches, background job architecture ready
- **Status**: ✅ Approved

### ADR-006: UI Architecture
- **Decision**: 50/50 split screen (Dashboard | AI Agent)
- **Context**: Equal emphasis on monitoring and conversation
- **Consequences**: Responsive design complexity, state synchronization
- **Status**: ✅ Approved

### ADR-007: Notification Service Strategy [IMPLEMENTED]
- **Decision**: Email-only notifications using SendGrid for MVP
- **Context**: User provided both SendGrid and Twilio credentials, causing confusion
- **Consequences**: Simpler implementation, matches original requirements
- **Status**: ✅ Implemented (Twilio removed, SendGrid only)
- **Implementation Date**: June 23, 2025

### ADR-008: Testing Coverage Strategy [REVISED]
- **Decision**: 80% coverage for MVP, 100% for production
- **Context**: 100% coverage slowing MVP development velocity
- **Consequences**: Faster iteration, some edge cases untested
- **Status**: 🔄 Revised from original 100% requirement

### ADR-009: Monitoring Infrastructure [IMPLEMENTED]
- **Decision**: Basic logging and health checks only for MVP
- **Context**: Prometheus metrics over-engineered for localhost MVP
- **Consequences**: Simpler setup, add metrics when scaling
- **Status**: ✅ Implemented (Prometheus removed, simple logging only)
- **Implementation Date**: June 23, 2025

### ADR-010: Security Posture
- **Decision**: Environment variables for secrets, rotation after exposure
- **Context**: API keys were thought to be exposed but investigation showed proper .gitignore
- **Consequences**: Maintain strict .env practices, regular security audits
- **Status**: ✅ Verified Secure (keys properly gitignored)

### ADR-011: TypeScript Configuration
- **Decision**: Separate tsconfig for frontend node files without project references
- **Context**: TypeScript project references causing emit conflicts with Vite
- **Consequences**: Cleaner configuration, standard Vite setup
- **Status**: ✅ Implemented
- **Implementation Date**: June 23, 2025

---

## 🎯 Technical Standards & Patterns

### Code Quality Standards
- **TypeScript Strict Mode**: Enabled across all projects
- **ESLint**: Airbnb configuration with 2025 updates
- **Prettier**: Consistent formatting (2-space indents, single quotes)
- **Test Coverage**: 100% line coverage required
- **E2E Testing**: Playwright for critical user journeys
- **Documentation**: JSDoc for all public APIs

### Error Handling Patterns
```typescript
// Standard error handling pattern
interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Implementation example
async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<ServiceResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    logger.error(`${context} failed`, { error });
    return {
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: `${context} failed: ${error.message}`,
        details: { originalError: error }
      }
    };
  }
}
```

### Logging Standards
```typescript
// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'agentic-travel-agent',
    version: process.env.APP_VERSION 
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({ 
      format: winston.format.simple() 
    })
  ]
});
```

---

## 📁 Project Structure Standards

### Directory Naming Convention
```
agentic-travel-agent/
├── frontend/                     # React TypeScript SPA
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ai-agent/        # Conversation interface
│   │   │   ├── dashboard/       # Monitoring dashboard
│   │   │   ├── auth/            # Authentication forms
│   │   │   ├── shared/          # Common UI components
│   │   │   └── settings/        # User preferences
│   │   ├── services/            # API communication layer
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Helper functions
│   │   ├── types/               # TypeScript type definitions
│   │   ├── constants/           # Application constants
│   │   └── __tests__/           # Test files
│   ├── public/                  # Static assets
│   └── package.json
├── backend/                      # Node.js Express API
│   ├── src/
│   │   ├── routes/              # Express route handlers
│   │   ├── services/            # Business logic services
│   │   │   ├── ai-agent/        # Claude conversation logic
│   │   │   ├── flight/          # Amadeus API integration
│   │   │   ├── email/           # SendGrid notification service
│   │   │   ├── auth/            # Session management
│   │   │   └── storage/         # File-based data management
│   │   ├── middleware/          # Express middleware
│   │   ├── jobs/                # Background task definitions
│   │   ├── utils/               # Shared utilities
│   │   ├── types/               # TypeScript interfaces
│   │   ├── config/              # Environment configuration
│   │   └── __tests__/           # Test files
│   └── package.json
├── data/                        # File-based storage (MVP)
│   ├── users/                   # User profile JSONs
│   └── system/                  # System configuration
├── docs/                        # Documentation
├── memory-bank/                 # Architecture & development docs
├── logs/                        # Application logs
└── package.json                 # Root workspace configuration
```

### File Naming Standards
- **Components**: PascalCase (`FlightSearchForm.tsx`)
- **Services**: camelCase (`flightMonitoringService.ts`)
- **Utilities**: camelCase (`dateUtils.ts`)
- **Types**: PascalCase (`FlightSearchCriteria.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_ENDPOINTS.ts`)
- **User Data Files**: `user-{uuid}.json`
- **Test Files**: `{component}.test.tsx` or `{service}.test.ts`

---

## 🔧 Data Schema Standards

### User Profile Schema
```typescript
interface UserProfile {
  id: string;                    // UUID v4
  firstName: string;
  lastName: string;
  email: string;
  preferences: {
    currency: CurrencyCode;      // Default: 'CAD'
    timezone: string;            // IANA timezone
    preferredDepartureAirport: string; // IATA code
    communicationFrequency: 'immediate' | 'daily' | 'weekly';
  };
  activeSearches: FlightSearch[];
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}

interface FlightSearch {
  id: string;                    // UUID v4
  criteria: {
    origin: string;              // IATA code
    destination: string;         // IATA code
    departureDate: string;       // ISO 8601 date
    returnDate?: string;         // ISO 8601 date (optional)
    passengers: {
      adults: number;
      children: number;
      infants: number;
    };
    travelClass: 'economy' | 'premium-economy' | 'business' | 'first';
    maxPrice: number;
    currency: CurrencyCode;
  };
  status: 'active' | 'paused' | 'completed';
  lastChecked?: string;          // ISO 8601
  bestPriceFound?: {
    price: number;
    currency: CurrencyCode;
    foundAt: string;             // ISO 8601
    flightDetails: AmadeusFlightOffer;
  };
  priceHistory: PriceDataPoint[];
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### API Response Standards
```typescript
// Standardized API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// Standard error codes
enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}
```

---

## 🧪 Testing Strategy

### Test Coverage Requirements
- **Unit Tests**: 100% line coverage for services and utilities
- **Integration Tests**: All API endpoints and external service integrations
- **Component Tests**: All React components with user interaction scenarios
- **E2E Tests**: Critical user journeys (auth, search creation, notifications)

### Testing Tools & Standards
```typescript
// Jest configuration for consistent testing
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
};

// Playwright E2E configuration
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
};
```

---

## 🚀 Deployment & DevOps Standards

### Environment Configuration
```typescript
// Environment validation schema
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(3001),
  ANTHROPIC_API_KEY: z.string().min(1),
  AMADEUS_CLIENT_ID: z.string().min(1),
  AMADEUS_CLIENT_SECRET: z.string().min(1),
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DATA_DIRECTORY: z.string().default('./data'),
  SESSION_SECRET: z.string().min(32)
});

export const env = envSchema.parse(process.env);
```

### CI/CD Pipeline Standards
```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run typecheck
      
      - name: Lint
        run: npm run lint
      
      - name: Unit tests
        run: npm run test:coverage
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📊 Performance & Monitoring Standards

### Performance Metrics
- **Page Load Time**: < 2 seconds (95th percentile)
- **API Response Time**: < 500ms (average)
- **Memory Usage**: < 512MB per process
- **CPU Usage**: < 70% sustained

### Monitoring Implementation
```typescript
// Performance monitoring middleware
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
};
```

---

## 🔒 Security Standards

### Security Headers
```typescript
// Security middleware configuration
import helmet from 'helmet';

export const securityConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.anthropic.com", "https://api.amadeus.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});
```

### Input Validation Standards
```typescript
// Zod validation schemas for all endpoints
import { z } from 'zod';

export const FlightSearchSchema = z.object({
  origin: z.string().length(3).regex(/^[A-Z]{3}$/),
  destination: z.string().length(3).regex(/^[A-Z]{3}$/),
  departureDate: z.string().datetime(),
  returnDate: z.string().datetime().optional(),
  passengers: z.object({
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(8),
    infants: z.number().int().min(0).max(2)
  }),
  maxPrice: z.number().positive().max(50000),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP'])
});
```

---

**Status**: ✅ Architecture Foundation Complete  
**Next**: Implement consistent naming conventions and project structure  
**Review**: All decisions documented with rationale and consequences  
**Compliance**: 2025 standards, TypeScript strict mode, 100% test coverage