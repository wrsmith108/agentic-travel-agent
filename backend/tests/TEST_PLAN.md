# AI Travel Agent MVP Test Plan

## Test Scope

Testing will cover all MVP features:
1. Authentication (register, login, logout)
2. Flight search functionality
3. Saved searches management
4. Price monitoring and alerts
5. User preferences
6. AI conversational interface
7. Email notifications (in test mode)

## Test Environment

- **Mode**: Demo mode (no external API calls)
- **Database**: In-memory/file storage
- **Redis**: In-memory mode
- **Email**: Test mode (logged, not sent)

## Test Categories

### 1. Unit Tests
- Service layer functions
- Utility functions
- Data validation

### 2. Integration Tests
- API endpoint testing
- Service integration
- Error handling

### 3. End-to-End Tests
- Complete user workflows
- Multi-step operations

## Test Cases

### Authentication Tests
1. ✅ Register new user with valid data
2. ✅ Register with duplicate email (should fail)
3. ✅ Login with valid credentials
4. ✅ Login with invalid credentials (should fail)
5. ✅ Logout and session invalidation
6. ✅ Access protected endpoint without auth (should fail)

### Flight Search Tests
1. ✅ Search flights with valid parameters
2. ✅ Search with invalid airport codes (should fail)
3. ✅ Search with past dates (should fail)
4. ✅ Search with various cabin classes
5. ✅ Search round-trip vs one-way
6. ✅ Handle demo mode mock data

### Saved Searches Tests
1. ✅ Save a new search
2. ✅ List saved searches
3. ✅ Update saved search (enable/disable alerts)
4. ✅ Delete saved search
5. ✅ Set price alert thresholds
6. ✅ Handle search expiration

### Price Monitoring Tests
1. ✅ Check prices for saved searches
2. ✅ Generate price drop alerts
3. ✅ Respect user notification preferences
4. ✅ Handle batch processing
5. ✅ Test cooldown periods

### User Preferences Tests
1. ✅ Get default preferences
2. ✅ Update notification preferences
3. ✅ Update search preferences
4. ✅ Update display preferences
5. ✅ Reset preferences to defaults
6. ✅ Validate preference values

### AI Conversation Tests
1. ✅ Start new conversation
2. ✅ Continue existing conversation
3. ✅ Natural language flight search
4. ✅ Handle ambiguous queries
5. ✅ Get conversation history

### Email Notification Tests
1. ✅ Price alert email generation
2. ✅ Email queue processing
3. ✅ Rate limiting
4. ✅ Test mode verification (no actual sending)

## Test Execution Order

1. Environment setup and health check
2. Authentication flow
3. User preferences setup
4. Flight search operations
5. Save and manage searches
6. Price monitoring simulation
7. AI conversation testing
8. Integration scenarios

## Success Criteria

- All unit tests pass
- All integration tests pass
- No critical errors in logs
- Response times < 1 second for searches
- Proper error handling and messages
- Demo mode works without external dependencies

## Test Data

### Test Users
- `test1@example.com` / `TestPass123!`
- `test2@example.com` / `TestPass123!`

### Test Routes
- JFK → LAX (New York to Los Angeles)
- ORD → MIA (Chicago to Miami)
- SFO → SEA (San Francisco to Seattle)

### Test Dates
- Near future: 30 days from now
- Far future: 90 days from now
- Past date: Yesterday (error case)