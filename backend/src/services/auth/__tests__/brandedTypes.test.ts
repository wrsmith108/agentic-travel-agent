import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Comprehensive tests for branded types in the functional auth module
 * Tests type branding, validation, and type safety for domain types
 */

// Mock branded types - these will be replaced with actual implementations
type UserId = string & { readonly brand: unique symbol };
type SessionId = string & { readonly brand: unique symbol };
type HashedPassword = string & { readonly brand: unique symbol };
type Email = string & { readonly brand: unique symbol };
type ResetToken = string & { readonly brand: unique symbol };

// Type guard functions that will be tested
const isUserId = (value: string): value is UserId => {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
};

const isSessionId = (value: string): value is SessionId => {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
};

const isHashedPassword = (value: string): value is HashedPassword => {
  // Bcrypt hash pattern: $2[ayb]$[cost]$[salt][hash]
  return /^\$2[ayb]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
};

const isEmail = (value: string): value is Email => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const isResetToken = (value: string): value is ResetToken => {
  return /^[a-f0-9]{64}$/.test(value);
};

// Constructor functions with validation
const createUserId = (value: string): UserId => {
  if (!isUserId(value)) {
    throw new Error('Invalid UserId format');
  }
  return value as UserId;
};

const createSessionId = (value: string): SessionId => {
  if (!isSessionId(value)) {
    throw new Error('Invalid SessionId format');
  }
  return value as SessionId;
};

const createHashedPassword = (value: string): HashedPassword => {
  if (!isHashedPassword(value)) {
    throw new Error('Invalid HashedPassword format');
  }
  return value as HashedPassword;
};

const createEmail = (value: string): Email => {
  const normalized = value.toLowerCase().trim();
  if (!isEmail(normalized)) {
    throw new Error('Invalid Email format');
  }
  return normalized as Email;
};

const createResetToken = (value: string): ResetToken => {
  if (!isResetToken(value)) {
    throw new Error('Invalid ResetToken format');
  }
  return value as ResetToken;
};

describe('Branded Types', () => {
  describe('UserId', () => {
    it('should validate correct UUID v4 format', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(isUserId(validUuid)).toBe(true);
    });

    it('should reject invalid UUID formats', () => {
      const invalidUuids = [
        '550e8400-e29b-11d4-a716-446655440000', // v1 UUID
        '550e8400e29b41d4a716446655440000', // No dashes
        'not-a-uuid',
        '',
        '550e8400-e29b-41d4-a716-44665544000', // Too short
        '550e8400-e29b-41d4-a716-4466554400000', // Too long
      ];

      invalidUuids.forEach((invalid) => {
        expect(isUserId(invalid)).toBe(false);
      });
    });

    it('should create UserId from valid string', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const userId = createUserId(validUuid);
      expect(userId).toBe(validUuid);
    });

    it('should throw error for invalid UserId', () => {
      expect(() => createUserId('invalid-id')).toThrow('Invalid UserId format');
    });

    it('should maintain type safety', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const userId = createUserId(validUuid);

      // TypeScript should enforce this at compile time
      // This test verifies runtime behavior matches type expectations
      expect(typeof userId).toBe('string');
      expect(userId).toBe(validUuid);
    });
  });

  describe('SessionId', () => {
    it('should validate correct UUID v4 format', () => {
      const validSessionId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      expect(isSessionId(validSessionId)).toBe(true);
    });

    it('should reject invalid session ID formats', () => {
      const invalidIds = [
        'session-123',
        '12345',
        'f47ac10b58cc4372a5670e02b2c3d479', // No dashes
        'f47ac10b-58cc-1372-a567-0e02b2c3d479', // Invalid version
      ];

      invalidIds.forEach((invalid) => {
        expect(isSessionId(invalid)).toBe(false);
      });
    });

    it('should create SessionId from valid string', () => {
      const validId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const sessionId = createSessionId(validId);
      expect(sessionId).toBe(validId);
    });

    it('should throw error for invalid SessionId', () => {
      expect(() => createSessionId('invalid-session')).toThrow('Invalid SessionId format');
    });
  });

  describe('HashedPassword', () => {
    it('should validate correct bcrypt hash format', () => {
      const validHashes = [
        '$2b$12$EXRkfkdmXn2gzds2SSitu.MW9.gAVqa9eLS1//RYtYCmB1eLHg.fa',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        '$2y$12$QjSH496pcT5CEbzjD/vtVeH03tfHKFy36d4J0Ltp3lRtee9HDxY3K',
      ];

      validHashes.forEach((hash) => {
        expect(isHashedPassword(hash)).toBe(true);
      });
    });

    it('should reject invalid bcrypt hash formats', () => {
      const invalidHashes = [
        'plaintext',
        '$2b$12$toolong' + 'a'.repeat(60),
        '$2c$12$invalid-version',
        '$2b$99$invalid-cost',
        '$2b$12$tooshort',
        '',
        '$1$12$different-algo',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA256
      ];

      invalidHashes.forEach((invalid) => {
        expect(isHashedPassword(invalid)).toBe(false);
      });
    });

    it('should create HashedPassword from valid bcrypt hash', () => {
      const validHash = '$2b$12$EXRkfkdmXn2gzds2SSitu.MW9.gAVqa9eLS1//RYtYCmB1eLHg.fa';
      const hashedPassword = createHashedPassword(validHash);
      expect(hashedPassword).toBe(validHash);
    });

    it('should throw error for invalid hash format', () => {
      expect(() => createHashedPassword('not-a-hash')).toThrow('Invalid HashedPassword format');
    });

    it('should validate all bcrypt variants', () => {
      const variants = ['$2a$', '$2b$', '$2y$'];
      variants.forEach((variant) => {
        const hash = `${variant}10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`;
        expect(isHashedPassword(hash)).toBe(true);
      });
    });
  });

  describe('Email', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'test+tag@example.com',
        'user123@test-domain.com',
        'a@b.co',
        'user@subdomain.example.com',
      ];

      validEmails.forEach((email) => {
        expect(isEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@@example.com',
        'user@example',
        'user @example.com',
        'user@example .com',
        '',
        'user@.com',
        '.user@example.com',
      ];

      invalidEmails.forEach((invalid) => {
        expect(isEmail(invalid)).toBe(false);
      });
    });

    it('should create Email with normalization', () => {
      const email = createEmail('  User@EXAMPLE.com  ');
      expect(email).toBe('user@example.com');
    });

    it('should throw error for invalid email', () => {
      expect(() => createEmail('not-an-email')).toThrow('Invalid Email format');
    });

    it('should handle email edge cases', () => {
      // Very long but valid email
      const longEmail = 'a'.repeat(64) + '@example.com';
      expect(isEmail(longEmail)).toBe(true);

      // Email with multiple dots
      const dotsEmail = 'user.name.test@example.com';
      expect(isEmail(dotsEmail)).toBe(true);

      // Email with hyphen in domain
      const hyphenEmail = 'user@test-example.com';
      expect(isEmail(hyphenEmail)).toBe(true);
    });
  });

  describe('ResetToken', () => {
    it('should validate correct reset token format', () => {
      const validToken = 'a'.repeat(64);
      const hexToken = '0123456789abcdef' + 'fedcba9876543210'.repeat(3);

      expect(isResetToken(hexToken)).toBe(true);
    });

    it('should reject invalid reset token formats', () => {
      const invalidTokens = [
        'too-short',
        'a'.repeat(63), // Too short
        'a'.repeat(65), // Too long
        'g'.repeat(64), // Invalid hex character
        '0123456789ABCDEF' + 'FEDCBA9876543210'.repeat(3), // Uppercase
        '',
        'invalid-token-format',
      ];

      invalidTokens.forEach((invalid) => {
        expect(isResetToken(invalid)).toBe(false);
      });
    });

    it('should create ResetToken from valid hex string', () => {
      const validToken = '0123456789abcdef' + 'fedcba9876543210'.repeat(3);
      const resetToken = createResetToken(validToken);
      expect(resetToken).toBe(validToken);
    });

    it('should throw error for invalid reset token', () => {
      expect(() => createResetToken('invalid')).toThrow('Invalid ResetToken format');
    });

    it('should validate only lowercase hex', () => {
      const uppercase = '0123456789ABCDEF' + 'FEDCBA9876543210'.repeat(3);
      const lowercase = uppercase.toLowerCase();

      expect(isResetToken(uppercase)).toBe(false);
      expect(isResetToken(lowercase)).toBe(true);
    });
  });

  describe('Type Safety Integration', () => {
    it('should prevent type confusion between branded types', () => {
      const userId = createUserId('550e8400-e29b-41d4-a716-446655440000');
      const sessionId = createSessionId('f47ac10b-58cc-4372-a567-0e02b2c3d479');

      // These should be different branded types
      // TypeScript would prevent assignment at compile time
      expect(userId).not.toBe(sessionId);
      expect(typeof userId).toBe('string');
      expect(typeof sessionId).toBe('string');
    });

    it('should maintain brand information through serialization', () => {
      const userId = createUserId('550e8400-e29b-41d4-a716-446655440000');
      const serialized = JSON.stringify({ userId });
      const deserialized = JSON.parse(serialized);

      // After deserialization, need to re-validate
      expect(isUserId(deserialized.userId)).toBe(true);
      const reconstructed = createUserId(deserialized.userId);
      expect(reconstructed).toBe(userId);
    });
  });

  describe('Error Handling', () => {
    it('should provide descriptive error messages', () => {
      const errorCases = [
        { fn: () => createUserId('invalid'), message: 'Invalid UserId format' },
        { fn: () => createSessionId('invalid'), message: 'Invalid SessionId format' },
        { fn: () => createHashedPassword('invalid'), message: 'Invalid HashedPassword format' },
        { fn: () => createEmail('invalid'), message: 'Invalid Email format' },
        { fn: () => createResetToken('invalid'), message: 'Invalid ResetToken format' },
      ];

      errorCases.forEach(({ fn, message }) => {
        expect(fn).toThrow(message);
      });
    });

    it('should handle null and undefined gracefully', () => {
      const values = [null, undefined];

      values.forEach((value) => {
        expect(isUserId(value as any)).toBe(false);
        expect(isSessionId(value as any)).toBe(false);
        expect(isHashedPassword(value as any)).toBe(false);
        expect(isEmail(value as any)).toBe(false);
        expect(isResetToken(value as any)).toBe(false);
      });
    });
  });
});
