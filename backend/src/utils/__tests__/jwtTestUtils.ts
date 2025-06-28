import jwt from 'jsonwebtoken';
import { createTimestamp } from '@/services/auth/functional/types';
import { JWTPayload } from '@/schemas/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * JWT Test Utilities
 * Helper functions for creating various JWT tokens for testing
 */

export const JWT_TEST_SECRET = 'test-jwt-secret-for-testing-only';
export const JWT_TEST_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';

/**
 * Create a valid JWT token for testing
 */
export const createValidJWT = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4(),
  expiresIn: string | number = '1h',
  additionalClaims?: Partial<JWTPayload>
): string => {
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof expiresIn === 'string' ? now + parseExpiresIn(expiresIn) : now + expiresIn;

  const payload: JWTPayload = {
    sub: userId,
    email: 'test@example.com',
    role: 'user',
    sessionId,
    iat: now,
    exp,
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
    ...additionalClaims,
  };

  return jwt.sign(payload, JWT_TEST_SECRET);
};

/**
 * Create an expired JWT token
 */
export const createExpiredJWT = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4(),
  expiredBySeconds: number = 3600 // 1 hour ago
): string => {
  const now = Math.floor(Date.now() / 1000);

  const payload: JWTPayload = {
    sub: userId,
    email: 'test@example.com',
    role: 'user',
    sessionId,
    iat: now - expiredBySeconds - 60, // issued before expiry
    exp: now - expiredBySeconds, // expired
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };

  return jwt.sign(payload, JWT_TEST_SECRET);
};

/**
 * Create a JWT with invalid signature
 */
export const createInvalidSignatureJWT = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4()
): string => {
  const validToken = createValidJWT(userId, sessionId);
  const parts = validToken.split('.');

  // Modify the signature part
  const invalidSignature = Buffer.from('invalid-signature').toString('base64url');
  return `${parts[0]}.${parts[1]}.${invalidSignature}`;
};

/**
 * Create a malformed JWT (missing parts)
 */
export const createMalformedJWT = (
  type:
    | 'missing-header'
    | 'missing-payload'
    | 'missing-signature'
    | 'invalid-format' = 'invalid-format'
): string => {
  switch (type) {
    case 'missing-header':
      return '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.signature';
    case 'missing-payload':
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..signature';
    case 'missing-signature':
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
    case 'invalid-format':
    default:
      return 'not-a-jwt-token-at-all';
  }
};

/**
 * Create a JWT signed with wrong secret
 */
export const createWrongSecretJWT = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4()
): string => {
  const now = Math.floor(Date.now() / 1000);

  const payload: JWTPayload = {
    sub: userId,
    email: 'test@example.com',
    role: 'user',
    sessionId,
    iat: now,
    exp: now + 3600,
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };

  return jwt.sign(payload, 'wrong-secret-key');
};

/**
 * Create a JWT with invalid issuer
 */
export const createInvalidIssuerJWT = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4()
): string => {
  return createValidJWT(userId, sessionId, '1h', {
    iss: 'invalid-issuer',
  });
};

/**
 * Create a JWT with invalid audience
 */
export const createInvalidAudienceJWT = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4()
): string => {
  return createValidJWT(userId, sessionId, '1h', {
    aud: 'invalid-audience',
  });
};

/**
 * Create a JWT with missing required claims
 */
export const createMissingClaimsJWT = (
  missingClaims: Array<'sub' | 'email' | 'role' | 'sessionId'>
): string => {
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: any = {
    sub: uuidv4(),
    email: 'test@example.com',
    role: 'user',
    sessionId: uuidv4(),
    iat: now,
    exp: now + 3600,
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };

  // Remove specified claims
  missingClaims.forEach((claim) => delete fullPayload[claim]);

  return jwt.sign(fullPayload, JWT_TEST_SECRET);
};

/**
 * Create a refresh token
 */
export const createRefreshToken = (
  userId: string = uuidv4(),
  sessionId: string = uuidv4(),
  expiresIn: string = '7d'
): string => {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: userId,
    sessionId,
    type: 'refresh',
    iat: now,
    exp: now + parseExpiresIn(expiresIn),
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };

  return jwt.sign(payload, JWT_TEST_REFRESH_SECRET);
};

/**
 * Create a JWT with custom expiry time
 */
export const createCustomExpiryJWT = (
  expiresAt: Date,
  userId: string = uuidv4(),
  sessionId: string = uuidv4()
): string => {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor(expiresAt.getTime() / 1000);

  const payload: JWTPayload = {
    sub: userId,
    email: 'test@example.com',
    role: 'user',
    sessionId,
    iat: now,
    exp,
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
  };

  return jwt.sign(payload, JWT_TEST_SECRET);
};

/**
 * Decode JWT without verification (for testing)
 */
export const decodeJWT = (token: string): any => {
  return jwt.decode(token, { complete: true });
};

/**
 * Verify JWT with test secret
 */
export const verifyTestJWT = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_TEST_SECRET) as JWTPayload;
};

/**
 * Helper to parse express-style duration strings
 */
function parseExpiresIn(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) throw new Error('Invalid duration format');

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error('Invalid duration unit');
  }
}

/**
 * Mock auth service methods for testing
 */
export const mockAuthServiceMethods = {
  validateJWTToken: jest.fn(),
  validateSession: jest.fn(),
  getUserById: jest.fn(),
  logoutUser: jest.fn(),
  createUserSession: jest.fn(),
};

/**
 * Create mock session user
 */
export const createMockSessionUser = (overrides?: Partial<any>) => ({
  id: uuidv4(),
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  isEmailVerified: true,
  role: 'user',
  createdAt: createTimestamp(),
  ...overrides,
});

/**
 * Create mock user profile
 */
export const createMockUserProfile = (overrides?: Partial<any>) => ({
  id: uuidv4(),
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  preferences: {
    currency: 'CAD',
    timezone: 'America/Toronto',
    preferredDepartureAirport: 'YYZ',
    communicationFrequency: 'daily',
    subscriptionTier: 'free',
  },
  createdAt: createTimestamp(),
  updatedAt: createTimestamp(),
  ...overrides,
});

/**
 * Create mock JWT payload
 */
export const createMockJWTPayload = (overrides?: Partial<JWTPayload>): JWTPayload => {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: uuidv4(),
    email: 'test@example.com',
    role: 'user',
    sessionId: uuidv4(),
    iat: now,
    exp: now + 3600,
    iss: 'agentic-travel-agent',
    aud: 'agentic-travel-agent-users',
    ...overrides,
  };
};
