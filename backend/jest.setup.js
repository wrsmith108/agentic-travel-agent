// Load test environment variables
const dotenv = require('dotenv');
const path = require('path');

// Load .env.test file
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock console.error for cleaner test output
const originalError = console.error;
console.error = (...args) => {
  // Ignore specific error messages during tests
  const errorString = args.join(' ');
  if (
    errorString.includes('Invalid environment variables') ||
    errorString.includes('Database connection failed') ||
    errorString.includes('Redis connection failed')
  ) {
    return;
  }
  originalError(...args);
};