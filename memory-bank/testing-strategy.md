# 🧪 Testing Strategy & Coverage Standards
## Agentic Travel Agent MVP

**Senior QA Engineering Standards**  
**Target**: 100% test coverage with comprehensive E2E testing  
**Tools**: Jest, Vitest, Playwright, Testing Library  
**Updated**: June 23, 2025

---

## 🎯 Testing Philosophy

### Ultra-think Testing Approach
1. **Test First Mindset**: Write tests before or alongside implementation
2. **Behavior-Driven Testing**: Focus on user behavior, not implementation details
3. **Confidence-Driven Coverage**: 100% line coverage with meaningful assertions
4. **Production Parity**: Tests must run in environments matching production
5. **Fast Feedback Loops**: Test suites must complete in under 2 minutes

### Testing Pyramid Strategy
```
                   🔺 E2E Tests (5%)
                  Critical user journeys
                 Authentication, booking flow
               
              🔸 Integration Tests (15%)
             API endpoints, service interactions
            External API mocking, database operations
           
         🔹 Unit Tests (80%)
        Components, services, utilities, hooks
       Business logic, validation, transformations
```

---

## 📊 Coverage Requirements

### Mandatory Coverage Targets
- **Line Coverage**: 100% (no exceptions)
- **Branch Coverage**: 100% (all code paths tested)
- **Function Coverage**: 100% (all functions called)
- **Statement Coverage**: 100% (all statements executed)

### Coverage Exclusions (Only if justified)
```typescript
// Explicitly excluded patterns
/* istanbul ignore next */
/* c8 ignore start */
/* c8 ignore stop */

// Allowed exclusions:
// - Type-only files (*.d.ts)
// - Configuration files (vite.config.ts, etc.)
// - Development utilities
// - Generated code
```

### Coverage Enforcement
```json
// Jest/Vitest configuration
{
  "coverageThreshold": {
    "global": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    },
    "./src/services/": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    }
  }
}
```

---

## 🔧 Frontend Testing Strategy (React + TypeScript)

### Testing Stack
- **Test Runner**: Vitest (Vite-native, faster than Jest)
- **Component Testing**: React Testing Library
- **User Interactions**: @testing-library/user-event
- **Mock Framework**: Vitest built-in mocks
- **Coverage**: c8 (v8 coverage)
- **E2E**: Playwright

### Component Testing Standards
```typescript
// FlightSearchForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FlightSearchForm } from './FlightSearchForm';

describe('FlightSearchForm', () => {
  const mockOnSubmit = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when rendering with initial criteria', () => {
    it('should display origin airport input field', () => {
      render(<FlightSearchForm onSubmit={mockOnSubmit} />);
      
      const originInput = screen.getByLabelText(/origin airport/i);
      expect(originInput).toBeInTheDocument();
      expect(originInput).toHaveAttribute('type', 'text');
    });

    it('should have empty form when no initial criteria provided', () => {
      render(<FlightSearchForm onSubmit={mockOnSubmit} />);
      
      expect(screen.getByLabelText(/origin airport/i)).toHaveValue('');
      expect(screen.getByLabelText(/destination airport/i)).toHaveValue('');
    });
  });

  describe('when user enters valid search criteria', () => {
    it('should enable submit button with complete criteria', async () => {
      render(<FlightSearchForm onSubmit={mockOnSubmit} />);
      
      await user.type(screen.getByLabelText(/origin airport/i), 'YYZ');
      await user.type(screen.getByLabelText(/destination airport/i), 'NRT');
      await user.type(screen.getByLabelText(/departure date/i), '2025-04-20');
      
      const submitButton = screen.getByRole('button', { name: /search flights/i });
      expect(submitButton).toBeEnabled();
    });

    it('should call onSubmit with correct search criteria', async () => {
      render(<FlightSearchForm onSubmit={mockOnSubmit} />);
      
      await user.type(screen.getByLabelText(/origin airport/i), 'YYZ');
      await user.type(screen.getByLabelText(/destination airport/i), 'NRT');
      await user.type(screen.getByLabelText(/departure date/i), '2025-04-20');
      await user.click(screen.getByRole('button', { name: /search flights/i }));
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          origin: 'YYZ',
          destination: 'NRT',
          departureDate: '2025-04-20',
          passengers: { adults: 1, children: 0, infants: 0 },
          travelClass: 'economy'
        });
      });
    });
  });

  describe('when user enters invalid data', () => {
    it('should show validation error for invalid airport code', async () => {
      render(<FlightSearchForm onSubmit={mockOnSubmit} />);
      
      await user.type(screen.getByLabelText(/origin airport/i), 'INVALID');
      await user.tab(); // Trigger validation
      
      await waitFor(() => {
        expect(screen.getByText(/airport code must be 3 letters/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button with invalid criteria', async () => {
      render(<FlightSearchForm onSubmit={mockOnSubmit} />);
      
      await user.type(screen.getByLabelText(/origin airport/i), 'INVALID');
      
      const submitButton = screen.getByRole('button', { name: /search flights/i });
      expect(submitButton).toBeDisabled();
    });
  });
});
```

### Hook Testing Standards
```typescript
// useFlightSearch.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useFlightSearch } from './useFlightSearch';
import * as flightService from '@/services/flightService';

vi.mock('@/services/flightService');

describe('useFlightSearch', () => {
  const mockSearchFlights = vi.mocked(flightService.searchFlights);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty search results', () => {
    const { result } = renderHook(() => useFlightSearch());
    
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchError).toBeNull();
  });

  it('should execute search and update results', async () => {
    const mockResults = [
      { id: 'flight-1', price: 1150, currency: 'CAD' }
    ];
    mockSearchFlights.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useFlightSearch());
    
    await result.current.executeSearch({
      origin: 'YYZ',
      destination: 'NRT',
      departureDate: '2025-04-20'
    });

    await waitFor(() => {
      expect(result.current.searchResults).toEqual(mockResults);
      expect(result.current.isSearching).toBe(false);
    });
  });

  it('should handle search errors gracefully', async () => {
    const errorMessage = 'API rate limit exceeded';
    mockSearchFlights.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useFlightSearch());
    
    await result.current.executeSearch({
      origin: 'YYZ',
      destination: 'NRT',
      departureDate: '2025-04-20'
    });

    await waitFor(() => {
      expect(result.current.searchError).toBe(errorMessage);
      expect(result.current.isSearching).toBe(false);
      expect(result.current.searchResults).toEqual([]);
    });
  });
});
```

---

## 🖥️ Backend Testing Strategy (Node.js + Express)

### Testing Stack
- **Test Runner**: Jest (Node.js standard)
- **API Testing**: Supertest
- **Mocking**: Jest built-in mocks
- **Coverage**: Jest built-in coverage
- **Database**: In-memory/mock for tests

### Service Testing Standards
```typescript
// flightMonitoringService.test.ts
import { flightMonitoringService } from './flightMonitoringService';
import * as amadeusClient from '@/utils/amadeusClient';
import * as emailService from '@/services/emailService';

jest.mock('@/utils/amadeusClient');
jest.mock('@/services/emailService');

describe('FlightMonitoringService', () => {
  const mockAmadeusClient = amadeusClient as jest.Mocked<typeof amadeusClient>;
  const mockEmailService = emailService as jest.Mocked<typeof emailService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchFlights', () => {
    it('should return flight offers for valid search criteria', async () => {
      const searchCriteria = {
        origin: 'YYZ',
        destination: 'NRT',
        departureDate: '2025-04-20',
        passengers: { adults: 1, children: 0, infants: 0 }
      };

      const mockAmadeusResponse = {
        data: [
          { id: '1', price: { total: '1150.00', currency: 'CAD' } }
        ]
      };

      mockAmadeusClient.searchFlights.mockResolvedValue(mockAmadeusResponse);

      const result = await flightMonitoringService.searchFlights(searchCriteria);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject({
        id: '1',
        price: 1150,
        currency: 'CAD'
      });
    });

    it('should handle Amadeus API errors gracefully', async () => {
      const searchCriteria = {
        origin: 'YYZ',
        destination: 'NRT',
        departureDate: '2025-04-20',
        passengers: { adults: 1, children: 0, infants: 0 }
      };

      mockAmadeusClient.searchFlights.mockRejectedValue(
        new Error('Amadeus API rate limit exceeded')
      );

      const result = await flightMonitoringService.searchFlights(searchCriteria);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXTERNAL_API_ERROR');
      expect(result.error?.message).toContain('Amadeus API rate limit exceeded');
    });
  });

  describe('monitorPriceChanges', () => {
    it('should send email notification when price drops below threshold', async () => {
      const userId = 'user-123';
      const searchId = 'search-456';
      const currentPrice = 1050;
      const threshold = 1200;

      mockAmadeusClient.searchFlights.mockResolvedValue({
        data: [{ id: '1', price: { total: '1050.00', currency: 'CAD' } }]
      });
      mockEmailService.sendPriceAlert.mockResolvedValue({ success: true });

      const result = await flightMonitoringService.monitorPriceChanges(
        userId,
        searchId,
        threshold
      );

      expect(result.success).toBe(true);
      expect(mockEmailService.sendPriceAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          currentPrice,
          threshold,
          priceChange: expect.any(Number)
        })
      );
    });
  });
});
```

### API Route Testing Standards
```typescript
// userRoutes.integration.test.ts
import request from 'supertest';
import { app } from '@/server';
import * as userService from '@/services/userService';

jest.mock('@/services/userService');

describe('User Routes Integration', () => {
  const mockUserService = userService as jest.Mocked<typeof userService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/users/:userId', () => {
    it('should return user profile when user exists', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      };

      mockUserService.getUserById.mockResolvedValue({
        success: true,
        data: mockUser
      });

      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: mockUser
      });
    });

    it('should return 404 when user does not exist', async () => {
      const userId = 'nonexistent-user';

      mockUserService.getUserById.mockResolvedValue({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });

      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'USER_NOT_FOUND' }
      });
    });

    it('should validate UUID format in user ID parameter', async () => {
      const invalidUserId = 'invalid-uuid';

      const response = await request(app)
        .get(`/api/v1/users/${invalidUserId}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' }
      });
    });
  });

  describe('POST /api/v1/users/:userId/flight-searches', () => {
    it('should create flight search with valid criteria', async () => {
      const userId = 'user-123';
      const searchCriteria = {
        origin: 'YYZ',
        destination: 'NRT',
        departureDate: '2025-04-20',
        passengers: { adults: 1, children: 0, infants: 0 },
        maxPrice: 1200,
        currency: 'CAD'
      };

      const mockCreatedSearch = {
        id: 'search-456',
        ...searchCriteria,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      mockUserService.createFlightSearch.mockResolvedValue({
        success: true,
        data: mockCreatedSearch
      });

      const response = await request(app)
        .post(`/api/v1/users/${userId}/flight-searches`)
        .send(searchCriteria)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: mockCreatedSearch
      });
    });

    it('should validate flight search criteria', async () => {
      const userId = 'user-123';
      const invalidCriteria = {
        origin: 'INVALID', // Should be 3 letters
        destination: 'NRT',
        departureDate: 'invalid-date',
        passengers: { adults: 0 } // Should be at least 1
      };

      const response = await request(app)
        .post(`/api/v1/users/${userId}/flight-searches`)
        .send(invalidCriteria)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'VALIDATION_ERROR' }
      });
    });
  });
});
```

---

## 🌐 End-to-End Testing Strategy (Playwright)

### E2E Testing Scope
- **Critical User Journeys**: Authentication, flight search, price monitoring
- **Cross-Browser**: Chrome, Firefox, Safari (WebKit)
- **Mobile Responsive**: Test mobile viewports
- **Performance**: Core Web Vitals monitoring
- **Accessibility**: WCAG compliance testing

### E2E Test Standards
```typescript
// flightSearchWorkflow.e2e.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Flight Search Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/');
  });

  test('should complete full flight search and monitoring setup', async () => {
    // Step 1: Navigate to flight search
    await page.click('[data-testid="start-flight-search"]');
    await expect(page.locator('[data-testid="flight-search-form"]')).toBeVisible();

    // Step 2: Fill in search criteria
    await page.fill('[data-testid="origin-input"]', 'YYZ');
    await page.fill('[data-testid="destination-input"]', 'NRT');
    await page.fill('[data-testid="departure-date"]', '2025-04-20');
    await page.fill('[data-testid="max-price"]', '1200');

    // Step 3: Submit search
    await page.click('[data-testid="search-submit"]');
    
    // Wait for results to load
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="flight-offer"]')).toHaveCount.greaterThan(0);

    // Step 4: Set up price monitoring
    await page.click('[data-testid="setup-monitoring"]');
    await expect(page.locator('[data-testid="monitoring-confirmation"]')).toBeVisible();

    // Step 5: Verify monitoring is active
    await page.click('[data-testid="dashboard-tab"]');
    await expect(page.locator('[data-testid="active-search"]')).toContainText('YYZ → NRT');
    await expect(page.locator('[data-testid="search-status"]')).toContainText('Active');
  });

  test('should handle API errors gracefully', async () => {
    // Mock API error response
    await page.route('**/api/v1/flight-searches', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: false, 
          error: { code: 'EXTERNAL_API_ERROR', message: 'Service temporarily unavailable' }
        })
      });
    });

    // Attempt flight search
    await page.click('[data-testid="start-flight-search"]');
    await page.fill('[data-testid="origin-input"]', 'YYZ');
    await page.fill('[data-testid="destination-input"]', 'NRT');
    await page.click('[data-testid="search-submit"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Service temporarily unavailable');
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should be accessible with keyboard navigation', async () => {
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Focus on search button
    await page.keyboard.press('Enter'); // Activate search form
    
    await page.keyboard.press('Tab'); // Focus on origin input
    await page.keyboard.type('YYZ');
    
    await page.keyboard.press('Tab'); // Focus on destination input
    await page.keyboard.type('NRT');
    
    await page.keyboard.press('Tab'); // Focus on date input
    await page.keyboard.type('2025-04-20');
    
    await page.keyboard.press('Tab'); // Focus on submit button
    await page.keyboard.press('Enter'); // Submit form

    // Verify form submission worked
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should be responsive on mobile devices', async () => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.click('[data-testid="start-flight-search"]');
    
    // Verify mobile layout
    const searchForm = page.locator('[data-testid="flight-search-form"]');
    await expect(searchForm).toHaveClass(/mobile-layout/);
    
    // Test touch interactions
    await page.tap('[data-testid="origin-input"]');
    await page.fill('[data-testid="origin-input"]', 'YYZ');
    
    // Verify mobile-specific UI elements
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });
});
```

### Performance Testing
```typescript
// performance.e2e.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    await page.goto('/');

    // Measure First Contentful Paint
    const fcp = await page.evaluate(() => {
      return new Promise(resolve => {
        new PerformanceObserver(list => {
          const fcpEntry = list.getEntries().find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) resolve(fcpEntry.startTime);
        }).observe({ entryTypes: ['paint'] });
      });
    });

    expect(fcp).toBeLessThan(1800); // FCP should be under 1.8s

    // Measure Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise(resolve => {
        new PerformanceObserver(list => {
          const lcpEntry = list.getEntries().at(-1);
          resolve(lcpEntry?.startTime || 0);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        setTimeout(() => resolve(0), 5000); // Fallback timeout
      });
    });

    expect(lcp).toBeLessThan(2500); // LCP should be under 2.5s

    // Measure Cumulative Layout Shift
    const cls = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          resolve(clsValue);
        }).observe({ entryTypes: ['layout-shift'] });
        
        setTimeout(() => resolve(clsValue), 5000);
      });
    });

    expect(cls).toBeLessThan(0.1); // CLS should be under 0.1
  });
});
```

---

## 🔧 Test Configuration Files

### Vitest Configuration (Frontend)
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        'src/__tests__/setup.ts'
      ],
      thresholds: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Jest Configuration (Backend)
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 10000
};
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  webServer: [
    {
      command: 'npm run dev:frontend',
      port: 3000,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'npm run dev:backend',
      port: 3001,
      reuseExistingServer: !process.env.CI
    }
  ]
});
```

---

## 📋 Test Quality Checklist

### Before Implementation
- [ ] Test cases cover all user stories and acceptance criteria
- [ ] Error scenarios and edge cases identified
- [ ] Performance benchmarks established
- [ ] Accessibility requirements defined
- [ ] Cross-browser compatibility confirmed

### During Development
- [ ] Tests written before or alongside implementation
- [ ] All branches and code paths covered
- [ ] Mocks isolate units under test
- [ ] Tests are deterministic and repeatable
- [ ] Test names clearly describe behavior

### Before Release
- [ ] 100% coverage achieved across all test types
- [ ] E2E tests pass on all target browsers
- [ ] Performance tests meet Core Web Vitals
- [ ] Accessibility tests pass WCAG standards
- [ ] Integration tests cover all API endpoints

---

**Status**: ✅ Testing Strategy Defined  
**Coverage**: 100% line, branch, function, statement coverage required  
**Tools**: Vitest, Jest, Playwright, Testing Library  
**Next**: Implement dependency management strategy