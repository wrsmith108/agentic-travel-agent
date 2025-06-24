# 🤖 SPARC Agent Execution Guide
## Agentic Travel Agent MVP

**Purpose**: Enable Claude Flow SPARC agents to work efficiently on this codebase  
**Format**: Task-oriented with clear boundaries and interfaces  

---

## 🎯 Project Current State

### What's Built
- ✅ TypeScript full-stack foundation
- ✅ React frontend with 50/50 split layout
- ✅ Express backend with logging
- ✅ Demo mode toggle
- ⚠️ Dual notification services (needs decision)
- ❌ No data layer yet
- ❌ No authentication yet
- ❌ No AI integration yet

### Critical Issues to Fix First
1. **API keys in git** - Need rotation
2. **Notification service** - Pick SendGrid OR Twilio
3. **TypeScript config** - Has workarounds
4. **Over-engineered monitoring** - Simplify

---

## 📁 Codebase Map for Agents

### Frontend Structure
```
frontend/src/
├── components/          # UI Components
│   ├── ai-agent/       # EMPTY - Build conversation UI here
│   ├── dashboard/      # EMPTY - Build flight search list here
│   ├── auth/           # EMPTY - Build login/register here
│   └── shared/         # ✅ Has Header, DemoModeToggle
├── contexts/           # ✅ Has DemoModeContext
├── services/           # EMPTY - Build API clients here
├── hooks/              # EMPTY - Build custom hooks here
├── types/              # EMPTY - Add TypeScript types here
└── utils/              # EMPTY - Add helpers here
```

### Backend Structure
```
backend/src/
├── config/             # ✅ Has env.ts
├── middleware/         # ✅ Has errorHandler.ts
├── routes/             # EMPTY - Build API routes here
├── services/           # EMPTY - Build business logic here
│   ├── ai-agent/      # EMPTY - Claude integration here
│   ├── flight/        # EMPTY - Amadeus integration here
│   ├── email/         # EMPTY - Notification service here
│   └── storage/       # EMPTY - Data management here
├── utils/              # ✅ Has logger, monitoring, testApi
└── server.ts           # ✅ Express server setup
```

---

## 🔧 Task Specifications for SPARC

### TASK: Implement User Data Layer [PRIORITY: HIGH]
**Agent**: coder, architect  
**Dependencies**: None  
**Location**: `backend/src/services/storage/`  
**Claude-Flow Commands**:
```bash
# Option 1: TDD Approach (Recommended)
./claude-flow sparc tdd "UserDataManager with atomic file operations and proper-lockfile"

# Option 2: Swarm Approach
./claude-flow swarm "Implement user data layer with file locking" \
  --strategy development --mode hierarchical --parallel

# Option 3: Individual SPARC modes
./claude-flow sparc run architect "Design file locking strategy"
./claude-flow sparc run coder "Implement UserDataManager service"
./claude-flow sparc run tester "Test concurrent file access"
```

**Required Implementation**:
```typescript
// Interface to implement
interface UserDataManager {
  createUser(profile: UserProfile): Promise<UserDataFile>
  readUserData(userId: string): Promise<UserDataFile | null>
  updateUserData(userId: string, updates: Partial<UserDataFile>): Promise<UserDataFile>
  deleteUser(userId: string): Promise<void>
  listUsers(): Promise<string[]> // List all user IDs
  userExists(userId: string): Promise<boolean>
}

// File operations pattern
// 1. Use proper-lockfile for locking
// 2. Write to temp file first
// 3. Atomic rename to final location
// 4. Validate with Zod schemas
```

**Implementation Details**:
```typescript
// Dependencies to install
// npm install proper-lockfile
// npm install @types/proper-lockfile --save-dev

import lockfile from 'proper-lockfile';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UserProfileSchema } from '@/schemas/user';

// File structure
// data/
//   users/
//     user-{uuid}.json
//     .locks/           // Lock files directory
```

**Test Requirements**: 
- Concurrent access tests (multiple reads/writes)
- Atomic operation verification
- Error handling (corrupted files, missing files)
- 100% coverage including edge cases

**Common Pitfalls**:
- ✅ Always release locks in finally blocks
- ✅ Handle ENOENT errors gracefully
- ✅ Validate data after reading from disk
- ❌ Don't use sync file operations
- ❌ Don't forget to create directories

### TASK: Build Authentication System
**Agent**: coder  
**Dependencies**: User Data Layer  
**Location**: `backend/src/services/auth/`, `backend/src/routes/auth.ts`  
**Interfaces**:
```typescript
// Routes needed
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me

// Session interface
interface SessionUser {
  id: string
  email: string
  firstName: string
  lastName: string
}
```
**Test Requirements**: Integration tests for all endpoints
**Gotchas**: Use express-session (already installed)

### TASK: Create AI Conversation Interface
**Agent**: coder, researcher  
**Dependencies**: Auth system  
**Location**: `backend/src/services/ai-agent/`, `frontend/src/components/ai-agent/`  
**Interfaces**:
```typescript
// Backend service
interface ConversationService {
  startConversation(userId: string): Promise<Conversation>
  sendMessage(conversationId: string, message: string): Promise<AIResponse>
  extractFlightCriteria(message: string): Promise<FlightSearchCriteria | null>
}

// Frontend component props
interface AIAgentChatProps {
  onFlightSearchCreated: (criteria: FlightSearchCriteria) => void
}
```
**Test Requirements**: Mock Anthropic responses in tests
**Gotchas**: Use streaming responses, handle rate limits

### TASK: Integrate Flight Search
**Agent**: coder  
**Dependencies**: AI interface  
**Location**: `backend/src/services/flight/`  
**Interfaces**:
```typescript
interface FlightSearchService {
  searchFlights(criteria: FlightSearchCriteria): Promise<FlightOffer[]>
  getHistoricalPrices(route: string, dateRange: DateRange): Promise<PriceHistory>
  createPriceAlert(userId: string, searchId: string): Promise<void>
}
```
**Test Requirements**: Mock Amadeus in tests, handle errors
**Gotchas**: Amadeus test environment has limited routes

### TASK: Fix Notification Service
**Agent**: architect, coder  
**Dependencies**: None  
**Decision Needed**: SendGrid vs Twilio  
**Location**: `backend/src/services/email/`  
**Actions**:
1. Remove one service (recommend remove Twilio)
2. Update schemas to match
3. Implement email templates
4. Test in sandbox mode

---

## 🔌 API Contracts

### Authentication Endpoints
```typescript
// POST /api/v1/auth/register
Request: {
  email: string
  password: string
  firstName: string
  lastName: string
  preferences: UserPreferences
}
Response: ApiResponse<{ user: SessionUser, sessionId: string }>

// POST /api/v1/auth/login
Request: {
  email: string
  password: string
}
Response: ApiResponse<{ user: SessionUser, sessionId: string }>
```

### Flight Search Endpoints
```typescript
// POST /api/v1/flights/search
Request: FlightSearchCriteria
Response: ApiResponse<FlightOffer[]>

// GET /api/v1/flights/history/:searchId
Response: ApiResponse<PriceHistory[]>

// POST /api/v1/flights/monitor
Request: {
  searchId: string
  maxPrice: number
  preferences: MonitoringPreferences
}
Response: ApiResponse<{ monitoringId: string }>
```

### AI Conversation Endpoints
```typescript
// POST /api/v1/ai/conversations
Response: ApiResponse<{ conversationId: string }>

// POST /api/v1/ai/conversations/:id/messages
Request: { message: string }
Response: ApiResponse<{
  response: string
  extractedCriteria?: FlightSearchCriteria
}>
```

---

## 🧪 Testing Strategy for Agents

### Unit Tests
- Mock all external services
- Use `vitest` for frontend
- Use `jest` for backend
- Aim for 80% coverage (not 100% for MVP)

### Integration Tests
```typescript
// Template for API tests
describe('POST /api/v1/auth/register', () => {
  it('should create user with valid data', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(validUserData)
    
    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
  })
})
```

### E2E Tests (Defer to Week 4)
- Use Playwright
- Test critical paths only
- Run against localhost

---

## ⚠️ Common Pitfalls to Avoid

### TypeScript Issues
- ✅ Strict mode is ON - no `any` types
- ✅ Use optional chaining `?.` 
- ✅ Check for undefined explicitly
- ❌ Don't use `!` non-null assertion

### File Operations
- ✅ Always use atomic writes (temp + rename)
- ✅ Validate paths to prevent traversal
- ✅ Handle concurrent access
- ❌ Don't use sync methods

### API Integration
- ✅ Always check demo mode first
- ✅ Handle rate limits gracefully
- ✅ Log all external API calls
- ❌ Don't retry infinitely

### Security
- ✅ Validate all inputs with Zod
- ✅ Use parameterized queries (when DB added)
- ✅ Hash passwords with bcrypt
- ❌ Never log sensitive data

---

## 🚀 Quick Commands for Agents

### Development
```bash
# Start everything
npm run dev

# Run specific tests
npm run test -- UserDataManager
npm run test -- --coverage

# Type checking
npm run typecheck

# Fix linting
npm run lint:fix
```

### Testing APIs
```bash
# Test API connectivity
cd backend && npx tsx src/utils/testApiConnectivity.ts

# Quick server check
curl http://localhost:3001/health
curl http://localhost:3001/api/v1
```

### File Generation
```bash
# Generate types from schemas
# TODO: Add type generation script

# Create new component
# TODO: Add component generator
```

---

## 📋 Memory Bank References

### Must Read Before Starting
1. `/memory-bank/data-schemas.md` - All data structures
2. `/memory-bank/naming-conventions.md` - Coding standards
3. `/memory-bank/architecture-decisions.md` - Key decisions
4. `/memory-bank/cto-review.md` - Current issues

### Update After Changes
1. `/memory-bank/decision-log.md` - Log decisions
2. `/memory-bank/implementation-status.md` - Track progress
3. `/DEVELOPMENT.md` - Quick start guide

---

## 💡 Claude-Flow Integration Tips

### Leverage Memory for Coordination
```bash
# Store implementation decisions
./claude-flow memory store "data_layer_decisions" "Using proper-lockfile, temp file pattern, Zod validation"

# Retrieve before starting
./claude-flow memory get "data_schemas"
./claude-flow memory get "naming_conventions"
```

### Use Parallel Agents
```bash
# Launch multiple agents for different parts
./claude-flow agent spawn coder --name "data-layer-core"
./claude-flow agent spawn tester --name "data-layer-tests"
./claude-flow agent spawn coder --name "data-validation"

# Monitor all agents
./claude-flow monitor
```

### Swarm Patterns for Each Phase
```bash
# Data Layer Swarm
./claude-flow swarm "Complete user data management implementation" \
  --strategy development --mode hierarchical --max-agents 4 --parallel

# Auth System Swarm  
./claude-flow swarm "Build session-based authentication" \
  --strategy development --mode distributed --max-agents 5 --parallel

# AI Integration Swarm
./claude-flow swarm "Integrate Claude API with conversation management" \
  --strategy development --mode mesh --max-agents 6 --parallel
```

## 🎯 Success Criteria for Tasks

### Definition of Done
- [ ] Code compiles with no TypeScript errors
- [ ] Tests pass with 80%+ coverage
- [ ] No ESLint warnings
- [ ] API documented with examples
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] Demo mode supported

### Code Review Checklist
- [ ] Follows naming conventions
- [ ] Handles errors gracefully
- [ ] Has appropriate tests
- [ ] Updates documentation
- [ ] No security vulnerabilities
- [ ] Performs well enough for MVP

---

## 🔄 Handoff Protocol

### When Starting a Task
1. Read relevant memory bank docs
2. Check current implementation status
3. Review existing code in area
4. Plan approach and interfaces
5. Implement with tests
6. Update documentation

### When Completing a Task
1. Ensure all tests pass
2. Update implementation status
3. Document any decisions made
4. Note any technical debt
5. Update this guide if needed
6. Commit with clear message

---

**Remember**: This is an MVP. Prefer simple solutions that work over complex ones that might be "better". We can always refactor later!