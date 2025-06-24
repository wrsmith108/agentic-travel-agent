# 🤖✈️ Agentic Travel Agent

> An AI-powered travel planning assistant that proactively monitors flight and accommodation options based on us
er preferences, alleviating the high friction and cognitive load of comparing options across multiple platforms through an agentic approach that continuously works on behalf of the user.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

## 🎯 Project Overview

The Agentic Travel Agent is an MVP that demonstrates the power of AI-driven travel assistance. It features a conversational AI interface that helps users set up intelligent flight monitoring for multiple destinations, providing historical price context and proactive email notifications when flights meet their criteria.

### 🌟 Key Features

- **🤖 AI-Powered Conversational Interface**: Natural language processing for intuitive destination setup
- **📊 Proactive Flight Monitoring**: Continuous price tracking with intelligent alerts
- **📈 Historical Price Context**: 3-month historical and projected pricing via Amadeus API
- **🎯 Personalized Preferences**: Individual criteria per destination with flexible options
- **📧 Email Notifications**: Timely alerts when flights meet user criteria
- **👤 User Profile Management**: Add, edit, and delete destination monitoring
- **🔒 Secure Authentication**: Google OAuth 2.0 integration

## 🚀 Claude-Flow Accelerated Development

> **NEW**: This project is optimized for [Claude-Flow](https://github.com/anthropics/claude-flow) development with multi-agent swarm capabilities for 2.8x faster implementation!

### Quick Development with Claude-Flow

```bash
# Launch development swarm for any feature
./claude-flow swarm "Implement [feature]" --strategy development --parallel --monitor

# Example: Complete the data layer in 1.5 hours instead of 4 hours
./claude-flow swarm "Implement user data layer with atomic operations" \
  --strategy development --mode hierarchical --max-agents 4 --parallel
```

### Key Benefits
- **Parallel Development**: Multiple agents work on different components simultaneously
- **Memory Coordination**: Agents share context through persistent memory
- **178% Faster**: Complete MVP in ~11.5 hours vs 32 hours traditional development

See [CLAUDE-FLOW-STRATEGY.md](./CLAUDE-FLOW-STRATEGY.md) for complete swarm strategies.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  External APIs  │
│                 │    │                 │    │                 │
│ React + TS      │◄──►│ Node.js + TS    │◄──►│ Anthropic Claude│
│ Tailwind CSS    │    │ Express.js      │    │ Amadeus API     │
│ Vite            │    │ Auth + Sessions │    │ SendGrid        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Cost Control    │
                    │   & Security    │
                    │   Middleware    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Data Storage   │
                    │                 │
                    │ File-based JSON │
                    │ (MVP Approach)  │
                    └─────────────────┘
```

### ⚠️ Risk-Aware MVP Architecture

**Cost Control First**: All API calls pass through cost tracking and rate limiting
**Security by Design**: Input validation, sanitization, and audit logging
**Scalable Foundation**: Repository pattern for future database migration

### 🎨 Technology Stack

#### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS for responsive design
- **State Management**: React Context API
- **Build Tool**: Vite for fast development
- **HTTP Client**: Axios for API communication

#### Backend
- **Runtime**: Node.js 18+ with Express.js
- **Language**: TypeScript for type safety
- **Authentication**: Session-based (OAuth planned)
- **Email Service**: SendGrid
- **AI Integration**: Anthropic Claude Opus 4
- **Scheduling**: node-cron for periodic tasks
- **Validation**: Zod for input validation

#### External Services
- **Flight Data**: Amadeus API
- **Email Delivery**: SendGrid
- **Authentication**: Google OAuth 2.0
- **Hosting**: Vercel (frontend) + Railway (backend)

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/agentic-travel-agent.git
   cd agentic-travel-agent
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Setup**
   
   Create `.env` files in both frontend and backend directories:
   
   **Backend `.env`:**
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Amadeus API
   AMADEUS_CLIENT_ID=your_amadeus_client_id
   AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
   AMADEUS_ENVIRONMENT=test
   
   # SendGrid
   SENDGRID_API_KEY=your_sendgrid_api_key
   FROM_EMAIL=noreply@yourdomain.com
   
   # Session Secret
   SESSION_SECRET=your_session_secret
   ```
   
   **Frontend `.env`:**
   ```env
   VITE_API_BASE_URL=http://localhost:3001
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   ```

4. **Start Development Servers**
   ```bash
   npm run dev
   ```
   
   This will start both frontend (http://localhost:5173) and backend (http://localhost:3001) servers concurrently.

## 📖 Usage Examples

### Setting Up Flight Monitoring

1. **Authentication**: Sign in with your Google account
2. **Conversational Setup**: Interact with the AI agent:
   ```
   Agent: "Hi! I'd love to help you set up flight monitoring. Where would you like to go?"
   User: "I want to visit Tokyo sometime in April"
   Agent: "Great choice! What specific date in April are you thinking?"
   User: "April 20th"
   Agent: "Perfect! What's your budget for flights to Tokyo?"
   User: "$1200"
   ```
3. **Price Context**: View historical pricing data and trends
4. **Preferences**: Set flight preferences (direct, 1-stop, 2-stops)
5. **Monitoring**: Receive email alerts when flights match your criteria

### Managing Destinations

- **View Dashboard**: See all your monitored destinations
- **Edit Criteria**: Update price thresholds and preferences
- **Add Destinations**: Set up monitoring for multiple trips
- **Delete Monitoring**: Remove destinations you're no longer interested in

## 📁 Project Structure

```
agentic-travel-agent/
├── frontend/                 # React TypeScript application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── ai-agent/     # Conversational interface
│   │   │   ├── dashboard/    # User destination management
│   │   │   ├── auth/         # Authentication components
│   │   │   └── shared/       # Reusable UI components
│   │   ├── services/         # API communication
│   │   ├── hooks/           # React custom hooks
│   │   └── utils/           # Helper functions
│   └── package.json
├── backend/                  # Node.js Express API
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── services/        # Business logic
│   │   │   ├── ai-agent/    # NLP and conversation logic
│   │   │   ├── flight/      # Amadeus API integration
│   │   │   ├── email/       # Notification service
│   │   │   └── auth/        # Authentication service
│   │   ├── jobs/            # Scheduled background tasks
│   │   └── utils/           # Helper functions
│   └── package.json
├── data/                    # File-based storage (MVP)
│   ├── users/              # User profiles
│   ├── destinations/       # Flight monitoring criteria
│   ├── price_history/      # Historical pricing data
│   └── flight_matches/     # Found flight alerts
├── docs/                   # Documentation
├── memory-bank/            # Development tracking
└── package.json           # Root package configuration
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

- **Unit Tests**: >80% code coverage target
- **Integration Tests**: API endpoints and services
- **E2E Tests**: Critical user journeys
- **Performance Tests**: Load testing with realistic data

## 🚀 Deployment

### Production Build

```bash
# Build both frontend and backend
npm run build

# Build frontend only
npm run build:frontend

# Build backend only
npm run build:backend
```

### Deployment Platforms

- **Frontend**: Vercel (recommended)
- **Backend**: Railway (recommended)
- **Alternative**: Docker containers on any cloud provider

### Environment Variables

Ensure all production environment variables are properly configured:
- Database connections (if migrated from file storage)
- API keys for external services
- OAuth credentials for production domains
- Email service configuration

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Follow code standards**
   - TypeScript strict mode
   - ESLint (Airbnb configuration)
   - Prettier for formatting
   - Conventional commit messages
5. **Write tests** for new functionality
6. **Submit a pull request**

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Consistent code formatting
- **Commit Messages**: Conventional commits format
- **Branch Strategy**: Git Flow with feature branches

### Documentation

- **API Documentation**: OpenAPI/Swagger specs
- **Code Documentation**: JSDoc for all functions
- **Architecture Documentation**: System design docs

## 📊 Success Metrics

### Technical Metrics
- **AI Agent Conversation Completion Rate**: >80%
- **Flight Data Accuracy**: >95%
- **Email Delivery Rate**: >98%
- **System Uptime**: >99%
- **API Response Time**: <2 seconds

### User Experience Metrics
- **Destination Setup Completion**: >70%
- **User Return Rate After First Alert**: >40%
- **Email Open Rate**: >35%
- **Average Destinations per User**: 2-3

## 🗺️ Roadmap

### Phase 2: Enhanced Features (Weeks 4-6)
- **Database Migration**: Move from files to PostgreSQL
- **Multiple Flight Types**: Support for multi-city trips
- **Advanced AI**: Improved natural language understanding
- **Mobile App**: React Native application

### Phase 3: Scale & Monetization (Weeks 7-12)
- **Booking Integration**: Direct booking capabilities
- **Premium Features**: Advanced alerts and analytics
- **Hotel Monitoring**: Expand to accommodation tracking
- **API Platform**: Allow third-party integrations

### Long-term Vision
- **Multi-modal Travel**: Trains, buses, car rentals
- **Group Travel**: Collaborative trip planning
- **Travel Insights**: Predictive analytics and recommendations
- **Global Expansion**: Multi-language and currency support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Amadeus API** for comprehensive flight data
- **SendGrid** for reliable email delivery
- **Google OAuth** for secure authentication
- **React & Node.js** communities for excellent tooling

## 📞 Support

- **Documentation**: Check the `/docs` directory
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join our GitHub Discussions
- **Email**: support@agentic-travel-agent.com

---

**Built with ❤️ by the Agentic Travel Agent Team**

*Making travel planning effortless through intelligent automation*