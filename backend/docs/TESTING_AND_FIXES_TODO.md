# Testing and Fixes TODO List

## Current Status
- TypeScript errors reduced from 363 to 196 (46% reduction)
- Core MVP features implemented: Conversational search, saved searches, price monitoring, email notifications, user preferences
- API routes created but need documentation
- Unit tests exist but coverage unknown due to TypeScript errors

## 1. TypeScript Error Resolution (Priority: CRITICAL)
**Estimated Time: 5-6 hours**
**Why:** Cannot run tests until TypeScript compilation succeeds

### Remaining 196 Errors:
- [ ] Property access errors (39) - Add type definitions or interfaces
- [ ] Type assignment issues (38) - Fix incompatible type assignments  
- [ ] Missing type exports (31) - Export required types from modules
- [ ] Argument type mismatches (17) - Align function signatures
- [ ] Variable scoping issues (10) - Fix block-scoped redeclarations
- [ ] Null handling (8) - Use proper null checks or optional chaining
- [ ] Other minor issues (53) - Various small fixes

### Action Plan:
1. Fix missing exports first (enables other fixes)
2. Define missing interfaces for complex objects
3. Resolve type mismatches systematically
4. Run `npm run typecheck` after each batch of fixes

## 2. Testing Implementation (Priority: HIGH)
**Estimated Time: 8-10 hours**
**Why:** No tests = no confidence in code changes

### Unit Tests Needed:
- [ ] **User Preferences Service** (userPreferencesService.test.ts)
  - Test CRUD operations
  - Test Redis integration
  - Test default preferences
  - Test validation

- [ ] **Booking Service** (flightBookingService.test.ts)
  - Test booking creation flow
  - Test price confirmation
  - Test error handling
  - Mock Amadeus API calls

- [ ] **Email Service** (emailService.test.ts)
  - Test email formatting
  - Test rate limiting
  - Test template rendering
  - Mock SMTP calls

- [ ] **Conversational Search** (expand existing test)
  - Test natural language parsing
  - Test flight search integration
  - Test context management

### Integration Tests Needed:
- [ ] **End-to-End Flight Search** (flights.e2e.test.ts)
  - Natural language query → flight results
  - Saved search creation
  - Price monitoring trigger

- [ ] **User Preferences Flow** (preferences.integration.test.ts)
  - Create user → set preferences → verify persistence
  - Test preference inheritance in searches

- [ ] **Price Monitoring Batch** (priceMonitoring.e2e.test.ts)
  - Create saved search → simulate price change → verify alert

- [ ] **Authentication Flow** (auth.e2e.test.ts)
  - Register → login → access protected routes
  - Session management
  - Token refresh

## 3. Critical Bug Fixes (Priority: HIGH)
**Estimated Time: 3-4 hours**

### Known Issues:
- [ ] **Redis Connection Handling**
  - Add connection retry logic
  - Implement graceful shutdown
  - Add connection pooling

- [ ] **Error Response Consistency**
  - Standardize all error responses to use AppError
  - Ensure .code property is used consistently
  - Add error logging

- [ ] **Date Handling**
  - Ensure all dates stored as ISO strings
  - Add timezone handling
  - Validate date inputs

- [ ] **Type Safety**
  - Remove remaining `as any` casts where possible
  - Add proper type guards
  - Implement branded types consistently

## 4. API Documentation (Priority: MEDIUM)
**Estimated Time: 4-5 hours**
**Why:** Required for MVP completion

### Documentation Tasks:
- [ ] **OpenAPI/Swagger Setup**
  - Install swagger-ui-express
  - Create OpenAPI spec file
  - Document all endpoints

- [ ] **Endpoint Documentation**
  - Request/response schemas
  - Authentication requirements
  - Rate limits
  - Example requests

- [ ] **Integration Guide**
  - Authentication flow
  - Error handling
  - Rate limiting
  - Webhooks (future)

## 5. Performance & Security (Priority: MEDIUM)
**Estimated Time: 3-4 hours**

### Performance:
- [ ] Add request caching for flight searches
- [ ] Implement database connection pooling
- [ ] Add response compression
- [ ] Optimize Redis queries

### Security:
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (when DB added)
- [ ] Rate limiting per user
- [ ] API key rotation mechanism

## 6. Deployment Preparation (Priority: LOW)
**Estimated Time: 2-3 hours**

- [ ] Environment variable validation
- [ ] Health check endpoint
- [ ] Graceful shutdown handling
- [ ] Docker configuration
- [ ] CI/CD pipeline setup

## Testing Strategy

### Phase 1: Fix TypeScript (Day 1)
1. Run automated fix scripts for common patterns
2. Manually fix remaining type issues
3. Ensure `npm run typecheck` passes

### Phase 2: Run Existing Tests (Day 1-2)
1. Run `npm test` to identify failing tests
2. Fix test compilation errors
3. Update tests for recent code changes
4. Achieve 80%+ coverage on existing code

### Phase 3: Write Missing Tests (Day 2-3)
1. Write unit tests for new services
2. Create integration test suite
3. Add e2e tests for critical paths
4. Mock all external dependencies

### Phase 4: Fix Discovered Issues (Day 3-4)
1. Fix bugs found during testing
2. Improve error handling
3. Add missing validations
4. Performance optimizations

## Success Criteria
- [ ] 0 TypeScript errors
- [ ] All tests passing (npm test)
- [ ] 80%+ test coverage
- [ ] API documentation complete
- [ ] No critical security issues
- [ ] Performance benchmarks met

## Recommended Execution Order
1. **Fix TypeScript errors** (blocker for everything else)
2. **Fix existing tests** (immediate feedback)
3. **Write unit tests** (find bugs early)
4. **Integration tests** (validate system behavior)
5. **API documentation** (MVP requirement)
6. **Performance/Security** (production readiness)

## Total Estimated Time: 25-32 hours

## Next Immediate Steps
1. Run the remaining TypeScript fix scripts
2. Manually resolve the top error categories
3. Get to 0 TypeScript errors
4. Run and fix existing test suite
5. Report back on test coverage gaps