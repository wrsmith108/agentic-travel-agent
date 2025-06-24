import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.FEATURE_DEMO_MODE = 'true';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Mock external services by default
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');
jest.mock('@sendgrid/mail');

// Increase test timeout for integration tests
jest.setTimeout(10000);

// Clean up after tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});