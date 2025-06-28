# AI Travel Agent Backend

An intelligent conversational travel agent API that helps users search for flights, monitor prices, and receive alerts when prices drop.

## Features

### ✅ MVP Features (Implemented)
- **Conversational Flight Search**: Natural language interface powered by Claude AI
- **Saved Searches**: Store and manage flight search preferences
- **Price Monitoring**: Automated batch processing to track price changes
- **Email Notifications**: Real-time alerts when prices drop below thresholds
- **User Preferences**: Customizable notification and search settings

### 🚧 Future Features
- Flight booking and payment processing
- Hotel and car rental search
- Multi-city trip planning
- Mobile app support

## Quick Start

### Prerequisites
- Node.js 18+
- Redis (optional - will use memory mode if not available)
- PostgreSQL (optional - will use file mode if not available)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agentic-travel-agent.git
cd agentic-travel-agent/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
# Required
SESSION_SECRET=your-secret-key-change-in-production

# Optional (for full functionality)
AMADEUS_CLIENT_ID=your_amadeus_id
AMADEUS_CLIENT_SECRET=your_amadeus_secret
CLAUDE_API_KEY=your_claude_key

# Feature flags
FEATURE_DEMO_MODE=true  # Use mock data if APIs not configured
```

5. Build and start:
```bash
npm run build
npm run start
```

The API will be available at `http://localhost:8000`

## API Documentation

- [API Documentation](./docs/API_DOCUMENTATION.md) - Detailed endpoint documentation
- [OpenAPI Specification](./docs/openapi.yaml) - Swagger/OpenAPI 3.0 spec
- [Integration Guide](./docs/INTEGRATION_GUIDE.md) - Examples in multiple languages

## Development

### Available Scripts

```bash
npm run dev          # Start in development mode with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run test         # Run test suite
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
```

### Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── schemas/        # Zod validation schemas
│   ├── services/       # Business logic services
│   │   ├── auth/       # Authentication
│   │   ├── flights/    # Flight search & Amadeus integration
│   │   ├── ai/         # Claude AI integration
│   │   ├── batch/      # Price monitoring processor
│   │   ├── preferences/# User preferences
│   │   └── notifications/ # Email service
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── docs/               # Documentation
└── tests/              # Test files
```

### Key Technologies

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Validation**: Zod schemas
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for sessions and temporary data
- **AI**: Claude API for conversational interface
- **Flights**: Amadeus API for real flight data
- **Email**: Nodemailer with SMTP
- **Monitoring**: Custom metrics service
- **Testing**: Jest with supertest

### Development Guidelines

1. **Type Safety**: Use TypeScript strict mode, no `any` types
2. **Error Handling**: Use Result pattern (Ok/Err) for all operations
3. **Validation**: Define Zod schemas for all inputs
4. **Testing**: Write tests for new features
5. **Documentation**: Update API docs when adding endpoints

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Architecture

### System Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Express   │────▶│   Services  │
│   (Web/App) │     │   Server    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Redis     │     │  PostgreSQL │
                    │   Cache     │     │   Database  │
                    └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐            ▼
                    │  External   │     ┌─────────────┐
                    │    APIs      │     │    Batch    │
                    │ - Amadeus    │     │  Processor  │
                    │ - Claude     │     └─────────────┘
                    │ - SMTP       │
                    └─────────────┘
```

### Security Features

- Session-based authentication with secure cookies
- Password hashing with bcrypt
- Input sanitization and validation
- Rate limiting on all endpoints
- SQL injection protection
- XSS prevention
- CORS configuration

### Performance Optimizations

- Redis caching for frequent queries
- Connection pooling for database
- Batch processing for price monitoring
- Lazy loading of external services
- Response compression

## Deployment

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8000
CMD ["npm", "start"]
```

### Environment Variables

See [.env.example](./.env.example) for all available configuration options.

### Health Checks

The API provides health endpoints for monitoring:
- `GET /health` - Basic health check
- `GET /api/v1/monitoring/metrics` - Detailed metrics

## Troubleshooting

### Common Issues

1. **Redis connection failed**: The app will fall back to memory storage
2. **Database connection failed**: The app will fall back to file storage
3. **External API errors**: Enable demo mode for testing without APIs

### Debug Mode

Enable debug logging:
```bash
DEBUG=travel-agent:* npm run dev
```

## Contributing

1. Check the [MVP Scope](./docs/MVP_SCOPE.md) before adding features
2. Follow the coding guidelines in [CLAUDE.md](../CLAUDE.md)
3. Write tests for new functionality
4. Update documentation as needed

## License

MIT License - see [LICENSE](../LICENSE) file for details

## Support

- 📧 Email: support@example.com
- 📚 [API Documentation](./docs/API_DOCUMENTATION.md)
- 🐛 [Issue Tracker](https://github.com/yourusername/agentic-travel-agent/issues)