# Automated Testing Plan: MVP Travel Agent

## Executive Summary

This document outlines a comprehensive automated testing strategy for the MVP Travel Agent, ensuring quality through systematic testing at all levels while maintaining alignment with the 6-week development timeline.

## Test Strategy

### Testing Philosophy
- **TEST-DRIVEN DEVELOPMENT**: Write failing tests before any production code
- **Behavior-focused**: Test what the system does, not how it does it  
- **Shift-left approach**: Test early and often
- **Risk-based testing**: Focus on critical user paths
- **Automation-first**: Manual testing only for exploratory and UX validation
- **Fail-fast principle**: Quick feedback loops in CI/CD

### Development Process
Per [DEVELOPMENT-GUIDELINES.md](./DEVELOPMENT-GUIDELINES.md):
1. Write a failing test that describes desired behavior
2. Write minimal code to make the test pass
3. Refactor while keeping tests green
4. Never write production code without a failing test first

### Test Pyramid Distribution
```
         /--------\
        /   E2E    \     10% - Critical user journeys
       /   (20)     \
      /--------------\
     /  Integration   \   30% - API and service tests
    /     (60)        \
   /------------------\
  /      Unit          \  60% - Component and function tests
 /       (120)          \
/-----------------------\
```

### Tools & Frameworks

#### Frontend Testing
- **Unit Tests**: Vitest + React Testing Library
- **Component Tests**: Storybook + Chromatic
- **E2E Tests**: Playwright
- **Visual Regression**: Percy

#### Backend Testing
- **Unit Tests**: Jest
- **API Tests**: Supertest
- **Integration Tests**: Jest + Docker
- **Load Tests**: k6

#### Infrastructure
- **CI/CD**: GitHub Actions
- **Test Reporting**: Allure
- **Monitoring**: Datadog Synthetics

## Test Coverage Plan

### Critical User Journeys
1. **First-time Flight Search**
   - Natural language input → Parameter extraction → API call → Results display
   
2. **Search Refinement**
   - Modify search → Update results → Compare options

3. **Save Search Flow**
   - Create saved search → Verify limit (3) → Edit/Delete

4. **Notification Flow**
   - Batch process → Detect changes → Send email → Track delivery

### API Testing Requirements

#### Conversation API
```typescript
describe('Conversation API', () => {
  test('POST /api/v1/chat - Valid flight search', async () => {
    const response = await request(app)
      .post('/api/v1/chat')
      .send({ message: "Flights from NYC to Paris in April" })
      .expect(200);
    
    expect(response.body).toMatchObject({
      success: true,
      data: {
        message: expect.stringContaining('Paris'),
        context: { type: 'flight_search' },
        suggestions: expect.arrayContaining([expect.any(String)])
      }
    });
  });
});
```

#### Amadeus Integration
```typescript
describe('Amadeus Service', () => {
  test('Flight search with mock data', async () => {
    const criteria = {
      origin: 'JFK',
      destination: 'CDG',
      departureDate: '2024-04-15',
      adults: 1
    };
    
    const results = await amadeusService.searchFlights(criteria);
    expect(results).toHaveLength(expect.any(Number));
    expect(results[0]).toHaveProperty('price');
  });
});
```

### UI Component Testing

#### Chat Interface
```typescript
describe('ChatInterface', () => {
  test('Sends message on Enter key', async () => {
    const onSend = jest.fn();
    const { getByPlaceholderText } = render(
      <ChatInterface onSendMessage={onSend} />
    );
    
    const input = getByPlaceholderText(/Ask me about flights/);
    await userEvent.type(input, 'Test message{enter}');
    
    expect(onSend).toHaveBeenCalledWith('Test message');
  });
});
```

### Performance Criteria
- **Response Time**: p95 < 3 seconds
- **Concurrent Users**: Support 100 simultaneous chats
- **Batch Processing**: Complete 1000 searches in 10 minutes

## End-to-End Test Scenarios

### Scenario 1: Complete Flight Search
```typescript
test('User completes flight search', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:5173');
  
  // Start conversation
  await page.fill('[data-testid="chat-input"]', 'I need a flight to London');
  await page.press('[data-testid="chat-input"]', 'Enter');
  
  // Wait for agent response
  await expect(page.locator('[data-testid="agent-message"]'))
    .toContainText('London');
  
  // Provide details
  await page.fill('[data-testid="chat-input"]', 'From Boston on May 15');
  await page.press('[data-testid="chat-input"]', 'Enter');
  
  // Verify results appear
  await expect(page.locator('[data-testid="flight-results"]'))
    .toBeVisible();
  await expect(page.locator('[data-testid="flight-card"]'))
    .toHaveCount(greaterThan(0));
});
```

### Scenario 2: Save Search Limit
```typescript
test('Enforces 3 saved search limit', async ({ page }) => {
  // Setup: Create 3 saved searches
  for (let i = 1; i <= 3; i++) {
    await createSavedSearch(page, `Search ${i}`);
  }
  
  // Attempt to save 4th search
  await page.click('[data-testid="save-search-btn"]');
  
  // Verify limit message
  await expect(page.locator('[data-testid="limit-reached"]'))
    .toContainText('maximum of 3 saved searches');
  
  // Verify save button is disabled
  await expect(page.locator('[data-testid="save-search-btn"]'))
    .toBeDisabled();
});
```

### Edge Cases
1. **Invalid Airport Codes**
2. **Past Dates**
3. **Network Failures**
4. **Amadeus API Errors**
5. **Session Timeouts**

## Test Data Management

### Mock Data Strategy
```typescript
// Mock Amadeus responses
export const mockFlightData = {
  successful: {
    data: [
      {
        id: "1",
        price: { total: "450.00", currency: "USD" },
        itineraries: [/* ... */]
      }
    ]
  },
  noResults: { data: [] },
  error: { errors: [{ code: 500, title: "Server Error" }] }
};
```

### Test Environment
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres-test:
    image: postgres:14
    environment:
      POSTGRES_DB: travel_agent_test
      POSTGRES_PASSWORD: test
    
  redis-test:
    image: redis:7-alpine
    
  app-test:
    build: .
    environment:
      NODE_ENV: test
      DATABASE_URL: postgres://postgres:test@postgres-test:5432/travel_agent_test
      REDIS_URL: redis://redis-test:6379
      AMADEUS_ENV: test
```

## Test Automation Framework

### Page Object Model
```typescript
// pages/ChatPage.ts
export class ChatPage {
  constructor(private page: Page) {}
  
  async sendMessage(text: string) {
    await this.page.fill('[data-testid="chat-input"]', text);
    await this.page.press('[data-testid="chat-input"]', 'Enter');
  }
  
  async waitForAgentResponse() {
    await this.page.waitForSelector('[data-testid="agent-message"]:last-child');
  }
  
  async getLastAgentMessage() {
    return this.page.locator('[data-testid="agent-message"]:last-child').textContent();
  }
}
```

### Test Utilities
```typescript
// utils/testHelpers.ts
export const createTestUser = async () => {
  return await db.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      preferences: { communicationPreference: 'email' }
    }
  });
};

export const waitForBatchJob = async () => {
  // Poll job status
  let status = 'pending';
  while (status === 'pending') {
    await sleep(1000);
    status = await getJobStatus('weekly-search-batch');
  }
  return status;
};
```

## Execution Plan

### Test Execution Schedule

#### Phase 1-2: Core Conversation
- Unit tests for NLP utilities
- Chat component tests
- Basic E2E conversation flow

#### Phase 3: Amadeus Integration
- Mock Amadeus responses
- API integration tests
- Flight results display tests

#### Phase 4: Search Persistence
- Database operation tests
- CRUD operation tests
- Limit enforcement tests

#### Phase 5: Batch Processing
- Job queue tests
- Diff algorithm tests
- Mock notification tests

#### Phase 6: Notifications
- Email template tests
- Delivery tracking tests
- Unsubscribe flow tests

### Regression Test Suite
```yaml
# .github/workflows/regression.yml
name: Regression Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Full Test Suite
        run: |
          npm run test:unit
          npm run test:integration
          npm run test:e2e
```

### Smoke Tests
```typescript
// smoke/health.test.ts
describe('Smoke Tests', () => {
  test('App loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Travel Agent/);
  });
  
  test('API health check', async () => {
    const response = await fetch('/health');
    expect(response.status).toBe(200);
  });
  
  test('Can send chat message', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="chat-input"]', 'Hello');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Hello');
  });
});
```

## Manual Testing Requirements

### Exploratory Testing (4 hours/week)
1. **Conversation Flow**: Natural language variations
2. **Visual Design**: Cross-browser compatibility
3. **Accessibility**: Screen reader testing
4. **Mobile Experience**: Touch interactions

### User Acceptance Criteria
- [ ] Complete flight search in < 5 messages
- [ ] Save and retrieve search successfully
- [ ] Receive notification email
- [ ] Error messages are helpful
- [ ] Mobile experience is smooth

## Success Metrics

### Test Coverage Goals
- **Unit Test Coverage**: > 80%
- **API Test Coverage**: 100% of endpoints
- **E2E Coverage**: All critical paths

### Quality Gates
- All tests must pass before merge
- No decrease in coverage
- Performance benchmarks maintained
- Zero critical security vulnerabilities

## Implementation Timeline

### Week 1: Foundation
- Set up test infrastructure
- Configure CI/CD pipeline
- Create test utilities

### Week 2-3: Core Tests
- Unit tests for conversation logic
- Component tests for UI
- First E2E test

### Week 4: Integration Tests
- Amadeus mock setup
- API integration tests
- Search flow E2E

### Week 5: Advanced Tests
- Batch processing tests
- Performance tests
- Security scans

### Week 6: Hardening
- Full regression suite
- Load testing
- UAT preparation

---

*This automated testing plan ensures comprehensive coverage while maintaining development velocity for the MVP Travel Agent.*