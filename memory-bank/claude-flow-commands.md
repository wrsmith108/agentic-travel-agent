# 🤖 Claude-Flow Command Reference
## Project-Specific Commands for Agentic Travel Agent

**Generated**: June 23, 2025  
**Purpose**: Quick reference for team members using Claude-Flow

---

## 📦 Data Layer Implementation Commands

### Research Phase
```bash
# Research file locking strategies
./claude-flow sparc run researcher "Compare Node.js file locking libraries: proper-lockfile vs node-file-lock vs fs-ext"

# Research atomic write patterns
./claude-flow sparc run researcher "Atomic file write patterns for Node.js with examples"

# Store research findings
./claude-flow memory store "file_locking_research" "proper-lockfile recommended for cross-platform compatibility"
```

### Architecture Phase
```bash
# Design the data layer
./claude-flow sparc run architect "Design UserDataManager interface with these methods: createUser, readUserData, updateUserData, deleteUser, with atomic operations"

# Store architecture decisions
./claude-flow memory store "data_layer_architecture" "Interface defined, using proper-lockfile, temp file + rename pattern"
```

### Implementation Phase
```bash
# TDD approach (recommended)
./claude-flow sparc tdd "UserDataManager service implementing atomic file operations with proper-lockfile"

# Or direct implementation
./claude-flow sparc run coder "Implement UserDataManager in backend/src/services/storage/userDataManager.ts"

# Parallel test implementation
./claude-flow sparc run tester "Unit tests for UserDataManager with concurrent access scenarios"
```

---

## 🔐 Authentication System Commands

### Full Swarm Approach
```bash
./claude-flow swarm "Implement complete session-based authentication system" \
  --strategy development \
  --mode hierarchical \
  --max-agents 5 \
  --parallel \
  --monitor
```

### Individual Components
```bash
# Auth service
./claude-flow sparc run coder "AuthService with bcrypt password hashing and session management"

# Auth routes
./claude-flow sparc run coder "Express routes for /api/v1/auth endpoints: register, login, logout, me"

# Auth middleware
./claude-flow sparc run coder "requireAuth middleware for protecting routes"

# Frontend forms
./claude-flow agent spawn coder --name "auth-forms" 
# Implement login and registration forms with React Hook Form
```

---

## 🤖 AI Integration Commands

### Research and Planning
```bash
# Research streaming responses
./claude-flow sparc run researcher "Implement streaming responses with Anthropic Claude API and Express SSE"

# Design conversation flow
./claude-flow sparc run architect "Design conversation state management for multi-turn flight search dialogs"
```

### Implementation
```bash
# Conversation service
./claude-flow swarm "Build AI conversation service with flight criteria extraction" \
  --strategy development \
  --mode distributed \
  --max-agents 4

# Store prompts
./claude-flow memory store "ai_system_prompt" "You are a helpful travel agent specializing in finding the best flight deals..."

# UI implementation
./claude-flow sparc run coder "React chat interface with streaming support in frontend/src/components/ai-agent"
```

---

## ✈️ Flight Search Commands

### Amadeus Integration
```bash
# Research Amadeus APIs
./claude-flow sparc run researcher "Amadeus Flight Offers Search API v2 implementation examples"

# Implement service
./claude-flow sparc tdd "FlightSearchService with Amadeus integration and demo mode support"

# Price monitoring
./claude-flow sparc run coder "Implement price monitoring with node-cron scheduled checks"
```

### Parallel Implementation
```bash
# Launch multiple agents
./claude-flow agent spawn coder --name "flight-service"
./claude-flow agent spawn coder --name "flight-routes"  
./claude-flow agent spawn tester --name "flight-tests"

# Monitor progress
./claude-flow agent list
./claude-flow monitor
```

---

## 📊 Dashboard UI Commands

### Component Development
```bash
# Swarm for complete dashboard
./claude-flow swarm "Build flight search dashboard with active searches list" \
  --strategy development \
  --mode mesh \
  --parallel

# Individual components
./claude-flow sparc run coder "FlightSearchList component showing active price monitors"
./claude-flow sparc run coder "PriceHistoryChart using recharts library"
./claude-flow sparc run designer "Dashboard layout with 50/50 split screen"
```

---

## 🧪 Testing Commands

### Comprehensive Testing
```bash
# Full test suite
./claude-flow swarm "Implement comprehensive test suite with 80% coverage" \
  --strategy testing \
  --mode distributed \
  --max-agents 6 \
  --parallel

# Specific test types
./claude-flow sparc run tester "Integration tests for all API endpoints"
./claude-flow sparc run tester "Component tests for React components"
./claude-flow sparc run tester "E2E test for complete flight search flow"
```

---

## 📝 Memory Management Best Practices

### Store Implementation Details
```bash
# After completing each component
./claude-flow memory store "user_data_complete" "UserDataManager implemented with proper-lockfile, 100% test coverage"
./claude-flow memory store "auth_complete" "Session auth working, bcrypt passwords, secure cookies"
./claude-flow memory store "ai_integration_complete" "Claude streaming responses, flight extraction working"
```

### Coordinate Between Agents
```bash
# Before starting new work
./claude-flow memory get "api_endpoints"
./claude-flow memory get "data_schemas"
./claude-flow memory get "testing_standards"

# List all memory keys
./claude-flow memory list

# Export for backup
./claude-flow memory export $(date +%Y%m%d)-backup.json
```

---

## 🔄 Daily Workflow

### Morning Setup
```bash
# 1. Start orchestration
./claude-flow start --ui --port 3000

# 2. Check status
./claude-flow status
./claude-flow memory list

# 3. Review tasks
./claude-flow task list
```

### During Development
```bash
# Create tasks
./claude-flow task create implementation "Add file locking to UserDataManager"
./claude-flow task create bug "Fix TypeScript error in auth middleware"

# Use appropriate SPARC mode
./claude-flow sparc run debugger "Debug file locking race condition"
./claude-flow sparc run optimizer "Improve API response time"
```

### End of Day
```bash
# Store progress
./claude-flow memory store "day_progress" "Completed data layer, started auth system"

# Export memory
./claude-flow memory export daily-backup.json

# Review metrics
./claude-flow analytics dashboard
```

---

## 🚀 Performance Optimization

### Analysis Commands
```bash
# Analyze current performance
./claude-flow sparc run analyzer "Identify performance bottlenecks in current implementation"

# Optimization swarm
./claude-flow swarm "Optimize file I/O and API response times" \
  --strategy optimization \
  --mode centralized \
  --monitor
```

---

## 🛡️ Security Review

### Security Audit
```bash
# Full security review
./claude-flow sparc run reviewer "Security audit of authentication and data storage"

# Specific checks
./claude-flow security scan
./claude-flow security audit
```

---

## 📚 Documentation

### Auto-generate Docs
```bash
# API documentation
./claude-flow sparc run documenter "Generate OpenAPI specification from Express routes"

# Code documentation
./claude-flow sparc run documenter "Add JSDoc comments to all public APIs"

# Update guides
./claude-flow memory store "update_sparc_guide" "Add new interfaces and examples"
```

---

## 🎯 Quick Command Cheatsheet

```bash
# Most used commands for this project
alias flow-status='./claude-flow status'
alias flow-swarm='./claude-flow swarm'
alias flow-tdd='./claude-flow sparc tdd'
alias flow-memory='./claude-flow memory'
alias flow-monitor='./claude-flow monitor'

# Project-specific swarms
alias flow-data='./claude-flow swarm "Implement user data layer" --strategy development --parallel'
alias flow-auth='./claude-flow swarm "Build authentication system" --strategy development --parallel'
alias flow-ai='./claude-flow swarm "Integrate AI conversation" --strategy development --parallel'
alias flow-test='./claude-flow swarm "Run comprehensive tests" --strategy testing --parallel'
```

Use these commands to maximize development efficiency with Claude-Flow!