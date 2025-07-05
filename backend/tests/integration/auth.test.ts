/**
 * Authentication Integration Tests
 */

import request from 'supertest';
import app from '../../src/server';
import { closeDatabase } from '../../src/config/database';

describe('Authentication Endpoints', () => {
  let server: any;
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    agent = request.agent(app);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'testuser1@example.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await agent
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.firstName).toBe(userData.firstName);
      expect(response.body.data.user.lastName).toBe(userData.lastName);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should fail to register with duplicate email', async () => {
      const userData = {
        email: 'testuser1@example.com', // Same as above
        password: 'TestPass123!',
        firstName: 'Another',
        lastName: 'User'
      };

      const response = await agent
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await agent
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should fail with weak password', async () => {
      const userData = {
        email: 'testuser2@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await agent
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeAll(async () => {
      // Ensure user exists
      await agent.post('/api/v1/auth/register').send({
        email: 'logintest@example.com',
        password: 'LoginPass123!',
        firstName: 'Login',
        lastName: 'Test'
      });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'LoginPass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('logintest@example.com');
      expect(response.body.data.customSessionId).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should fail with incorrect password', async () => {
      const response = await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail with non-existent email', async () => {
      const response = await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      // First login
      await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'LoginPass123!'
        });

      // Then logout
      const response = await agent
        .post('/api/v1/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('Protected Routes', () => {
    it('should access protected route when authenticated', async () => {
      // Login first
      await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'LoginPass123!'
        });

      // Access protected route
      const response = await agent
        .get('/api/v1/preferences')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should fail to access protected route when not authenticated', async () => {
      // Create new agent (no session)
      const newAgent = request.agent(app);
      
      const response = await newAgent
        .get('/api/v1/preferences')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});