# AI Conversation Service

## Overview
The AI Conversation Service provides a complete chat interface powered by Claude API for travel planning assistance.

## Features
- **Conversation Management**: Create, retrieve, update, and delete conversations
- **Context-Aware Responses**: Maintains travel preferences and conversation history
- **User Authentication**: Secure access with JWT authentication
- **Export Functionality**: Export conversations as markdown
- **Real-time Chat**: Send messages and receive AI responses

## API Endpoints

### Conversations
- `POST /api/v1/conversations` - Create new conversation
- `GET /api/v1/conversations` - List user conversations
- `GET /api/v1/conversations/:id` - Get specific conversation
- `DELETE /api/v1/conversations/:id` - Delete conversation
- `POST /api/v1/conversations/:id/clear` - Clear conversation messages
- `GET /api/v1/conversations/:id/export` - Export as markdown

### Messages
- `POST /api/v1/conversations/:id/messages` - Send message to conversation

### Context
- `PATCH /api/v1/conversations/:id/context` - Update travel preferences

## Usage Examples

### 1. Create Conversation
```bash
curl -X POST http://localhost:3001/api/v1/conversations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"initialMessage": "I want to plan a trip to Japan"}'
```

### 2. Send Message
```bash
curl -X POST http://localhost:3001/api/v1/conversations/CONV_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "What are the best times to visit Tokyo?"}'
```

### 3. Update Travel Preferences
```bash
curl -X PATCH http://localhost:3001/api/v1/conversations/CONV_ID/context \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "preferences": {
        "budget": 3000,
        "departureAirport": "JFK",
        "destinations": ["Tokyo", "Kyoto"],
        "travelDates": {
          "start": "2024-04-10",
          "end": "2024-04-20",
          "flexible": true
        },
        "travelers": {
          "adults": 2,
          "children": 0,
          "infants": 0
        },
        "interests": ["culture", "food", "temples"]
      }
    }
  }'
```

## Demo Scripts

### Command Line Demo
```bash
npx tsx src/utils/conversationDemo.ts
```

### Test Suite
```bash
npx tsx src/utils/testConversationAPI.ts
```

### Web Interface
Open http://localhost:3001/chat-demo.html in your browser

## Configuration
Set the following in your `.env` file:
```
ANTHROPIC_API_KEY=your_api_key_here
USE_NEW_AUTH=true
```

## Architecture
- **conversationService.ts**: Core business logic with functional programming
- **conversation.ts routes**: RESTful API endpoints
- **conversation.ts types**: TypeScript type definitions and schemas
- **In-memory storage**: Simple storage (replace with database in production)

## Next Steps
1. Add database persistence (PostgreSQL/MongoDB)
2. Implement conversation search
3. Add multi-language support
4. Integrate with flight search API
5. Add conversation templates
6. Implement conversation sharing