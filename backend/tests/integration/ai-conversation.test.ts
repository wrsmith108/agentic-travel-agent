/**
 * AI Travel Agent Conversation Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';

describe('AI Travel Agent Conversation Endpoints', () => {
  let agent: request.SuperAgentTest;
  let conversationId: string;
  const testUser = {
    email: 'aitest@example.com',
    password: 'AITest123!',
    firstName: 'AI',
    lastName: 'Tester'
  };

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    agent = request.agent(app);

    // Register and login test user
    await agent.post('/api/v1/auth/register').send(testUser);
    await agent.post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/v1/travel-agent/chat', () => {
    it('should start a new conversation', async () => {
      const response = await agent
        .post('/api/v1/travel-agent/chat')
        .send({
          message: 'I need to fly from New York to Los Angeles next month'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.response).toBeDefined();
      expect(typeof response.body.data.response).toBe('string');
      expect(response.body.data.conversationId).toBeDefined();
      
      // Save for future tests
      conversationId = response.body.data.conversationId;

      // Check if response is contextually relevant (demo mode)
      const aiResponse = response.body.data.response.toLowerCase();
      expect(
        aiResponse.includes('new york') || 
        aiResponse.includes('los angeles') ||
        aiResponse.includes('flight') ||
        aiResponse.includes('travel')
      ).toBe(true);
    });

    it('should continue existing conversation', async () => {
      const response = await agent
        .post('/api/v1/travel-agent/chat')
        .send({
          message: 'I want to travel on March 15th for one week',
          conversationId: conversationId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.conversationId).toBe(conversationId);
      expect(response.body.data.response).toBeDefined();
    });

    it('should handle flight search intent', async () => {
      const response = await agent
        .post('/api/v1/travel-agent/chat')
        .send({
          message: 'Find me flights from JFK to LAX on December 25th'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBeDefined();
      
      // Check for suggested actions (if implemented)
      if (response.body.data.suggestedActions) {
        expect(Array.isArray(response.body.data.suggestedActions)).toBe(true);
      }
    });

    it('should handle ambiguous queries', async () => {
      const response = await agent
        .post('/api/v1/travel-agent/chat')
        .send({
          message: 'I want to go somewhere warm'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBeDefined();
      
      // AI should ask for clarification
      const aiResponse = response.body.data.response.toLowerCase();
      expect(
        aiResponse.includes('where') || 
        aiResponse.includes('destination') ||
        aiResponse.includes('specific') ||
        aiResponse.includes('help')
      ).toBe(true);
    });

    it('should handle price-related queries', async () => {
      const response = await agent
        .post('/api/v1/travel-agent/chat')
        .send({
          message: 'What is the cheapest time to fly to Europe?'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBeDefined();
      
      const aiResponse = response.body.data.response.toLowerCase();
      expect(
        aiResponse.includes('price') || 
        aiResponse.includes('cheap') ||
        aiResponse.includes('cost') ||
        aiResponse.includes('budget')
      ).toBe(true);
    });

    it('should fail without message', async () => {
      const response = await agent
        .post('/api/v1/travel-agent/chat')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/conversations/:conversationId', () => {
    it('should retrieve conversation history', async () => {
      const response = await agent
        .get(`/api/v1/conversations/${conversationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.conversationId).toBe(conversationId);
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      expect(response.body.data.messages.length).toBeGreaterThan(0);

      // Check message structure
      const message = response.body.data.messages[0];
      expect(message.id).toBeDefined();
      expect(message.role).toBeDefined();
      expect(['user', 'assistant'].includes(message.role)).toBe(true);
      expect(message.content).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('should fail with non-existent conversation ID', async () => {
      const response = await agent
        .get('/api/v1/conversations/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/conversations', () => {
    it('should list all user conversations', async () => {
      const response = await agent
        .get('/api/v1/conversations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check conversation summary structure
      const conv = response.body.data[0];
      expect(conv.conversationId).toBeDefined();
      expect(conv.title).toBeDefined();
      expect(conv.lastMessage).toBeDefined();
      expect(conv.messageCount).toBeDefined();
      expect(conv.createdAt).toBeDefined();
      expect(conv.updatedAt).toBeDefined();
    });
  });
});