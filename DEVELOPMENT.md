# 🚀 Development Quick Start

> **🎆 NEW**: Leverage Claude-Flow swarm capabilities for 2-3x faster development! See [CLAUDE-FLOW-STRATEGY.md](./CLAUDE-FLOW-STRATEGY.md)

## Prerequisites
- Node.js 20+ installed
- npm 10+ installed

## ⚡ Claude-Flow Accelerated Development

### Fastest Path (Recommended)
```bash
# Launch development swarm for next feature
./claude-flow swarm "Implement user data layer with atomic operations" \
  --strategy development --parallel --monitor

# Or use TDD mode
./claude-flow sparc tdd "UserDataManager service"
```

### Check Claude-Flow Status
```bash
./claude-flow status              # System status
./claude-flow memory list         # Available memory keys
./claude-flow agent list          # Active agents
./claude-flow monitor             # Real-time monitoring
```

## Traditional Quick Start

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Features Implemented

### ✅ Day 1 - Foundation Complete

- **Environment Setup**: TypeScript workspace with strict mode
- **API Keys**: Configured for Anthropic, Amadeus, SendGrid, and Twilio
- **Logging**: Winston logger with file and console output
- **Monitoring**: Prometheus metrics with health check endpoints
- **Demo Mode**: Toggle switch in header for demo/live mode
- **Error Handling**: Global error handler with proper status codes
- **Security**: Helmet, CORS, session management configured

## Available Endpoints

### Backend (http://localhost:3001)
- `GET /health` - Health check endpoint
- `GET /metrics` - Prometheus metrics
- `GET /api/v1` - API information

### Frontend (http://localhost:3000)
- 50/50 split screen layout
- Demo mode toggle in header
- Dashboard (left) and AI Agent (right) panels

## Development Commands

```bash
# Run tests
npm test

# Check types
npm run typecheck

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## API Connectivity Test

To test API connectivity:
```bash
cd backend && npx tsx src/utils/testApiConnectivity.ts
```

## Next Steps

### Day 2 Progress ✅
- [x] Removed Twilio (SendGrid only)
- [x] Removed Prometheus metrics
- [x] Fixed TypeScript configuration
- [x] Created Claude-Flow documentation

### Remaining Implementation (With Claude-Flow)

#### 1. User Data Layer (Next - 1.5 hours)
```bash
./claude-flow swarm "Implement user data layer" \
  --strategy development --mode hierarchical --parallel
```

#### 2. Authentication System (2 hours)
```bash
./claude-flow swarm "Build session-based auth" \
  --strategy development --mode distributed --parallel
```

#### 3. AI Integration (3 hours)
```bash
./claude-flow swarm "Integrate Claude AI conversation" \
  --strategy development --mode mesh --parallel
```

#### 4. Flight Search (2 hours)
```bash
./claude-flow swarm "Amadeus flight search integration" \
  --strategy development --parallel
```

### Claude-Flow Resources
- [CLAUDE-FLOW-STRATEGY.md](./CLAUDE-FLOW-STRATEGY.md) - Complete swarm strategies
- [memory-bank/claude-flow-commands.md](./memory-bank/claude-flow-commands.md) - Command reference
- [IMPLEMENTATION-PROGRESS.md](./IMPLEMENTATION-PROGRESS.md) - Progress tracking
- [SPARC-GUIDE.md](./SPARC-GUIDE.md) - SPARC agent task specifications