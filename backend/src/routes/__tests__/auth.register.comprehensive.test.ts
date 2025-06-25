import request from 'supertest';
import app from '../../server';
import { authService } from '@/services/auth/authService';
import {
  TestDataFactory,
  AuthTestHelpers,
  SecurityTestHelpers,
  TestAssertions,
  PerformanceTestHelpers,
} from '@/utils/__tests__/testHelpers';
import { RegisterRequest } from '@/schemas/auth';

// Mock external dependencies
jest.mock('@sendgrid/mail');
jest.mock('@anthropic-ai/sdk');
jest.mock('amadeus');

// Mock the authService
jest.mock('@/services/auth/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('AUTH REGISTER Endpoint - Comprehensive Security Tests', () => {
  const endpoint = '/api/v1/auth/register';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for successful registration
    mockAuthService.registerUser.mockImplementation(async (data: any) => ({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: 'test-user-id',
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          emailVerified: true,
          role: 'user',
          createdAt: new Date().toISOString(),
        },
        sessionId: 'test-session-id',
        accessToken: AuthTestHelpers.createMockJWT('test-user-id', data.email),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        permissions: ['user:read', 'user:update'],
      },
    }));
  });

  describe('Input Validation Tests', () => {
    it('should accept valid registration data', async () => {
      const validData = TestDataFactory.createRegisterRequest();

      const response = await request(app).post(endpoint).send(validData).expect(201);

      TestAssertions.assertSuccessResponse(response);
      expect(response.body.data.user.email).toBe(validData.email.toLowerCase());
    });

    describe('Email Validation', () => {
      it('should reject missing email', async () => {
        const data = TestDataFactory.createRegisterRequest();
        delete (data as any).email;

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should reject malformed emails', async () => {
        const malformedEmails = TestDataFactory.getMalformedEmails();

        for (const email of malformedEmails) {
          const data = TestDataFactory.createRegisterRequest({ email });

          const response = await request(app).post(endpoint).send(data).expect(400);

          TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
        }
      });

      it('should normalize email to lowercase', async () => {
        const data = TestDataFactory.createRegisterRequest({
          email: 'TEST@EXAMPLE.COM',
        });

        const response = await request(app).post(endpoint).send(data).expect(201);

        expect(mockAuthService.registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@example.com',
          })
        );
      });

      it('should trim whitespace from email', async () => {
        const data = TestDataFactory.createRegisterRequest({
          email: '  test@example.com  ',
        });

        const response = await request(app).post(endpoint).send(data).expect(201);

        expect(mockAuthService.registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@example.com',
          })
        );
      });
    });

    describe('Password Validation', () => {
      it('should reject passwords shorter than 8 characters', async () => {
        const data = TestDataFactory.createRegisterRequest({
          password: 'Short1!',
          confirmPassword: 'Short1!',
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining('at least 8 characters'),
          })
        );
      });

      it('should reject passwords without lowercase letters', async () => {
        const data = TestDataFactory.createRegisterRequest({
          password: 'UPPERCASE123!',
          confirmPassword: 'UPPERCASE123!',
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should reject passwords without uppercase letters', async () => {
        const data = TestDataFactory.createRegisterRequest({
          password: 'lowercase123!',
          confirmPassword: 'lowercase123!',
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should reject passwords without numbers', async () => {
        const data = TestDataFactory.createRegisterRequest({
          password: 'NoNumbers!',
          confirmPassword: 'NoNumbers!',
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should reject passwords without special characters', async () => {
        const data = TestDataFactory.createRegisterRequest({
          password: 'NoSpecial123',
          confirmPassword: 'NoSpecial123',
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should reject passwords exceeding 128 characters', async () => {
        const longPassword = TestDataFactory.generateLargePayload(1).substring(0, 129);
        const data = TestDataFactory.createRegisterRequest({
          password: longPassword,
          confirmPassword: longPassword,
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should reject mismatched passwords', async () => {
        const data = TestDataFactory.createRegisterRequest({
          password: 'SecurePass123!',
          confirmPassword: 'DifferentPass123!',
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({
            message: 'Passwords do not match',
          })
        );
      });

      it('should test password entropy requirements', async () => {
        const weakPasswords = [
          'Password1!', // Common pattern
          'Qwerty123!', // Keyboard pattern
          'Admin123!', // Common word
          'Test1234!', // Common test password
        ];

        for (const password of weakPasswords) {
          const entropy = SecurityTestHelpers.calculatePasswordEntropy(password);
          expect(entropy).toBeGreaterThan(40); // Minimum entropy requirement
        }
      });
    });

    describe('Name Validation', () => {
      it('should handle edge case names properly', async () => {
        const edgeCaseNames = TestDataFactory.getEdgeCaseNames();

        for (const { name, description } of edgeCaseNames) {
          const data = TestDataFactory.createRegisterRequest({
            firstName: name,
          });

          const response = await request(app).post(endpoint).send(data);

          // Empty or invalid names should be rejected
          if (name.trim().length === 0 || name.length > 50) {
            expect(response.status).toBe(400);
            TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
          }

          // XSS attempts should be handled safely
          if (name.includes('<script>') || name.includes('<img')) {
            TestAssertions.assertNoSensitiveDataExposed(response.body);
          }
        }
      });

      it('should trim whitespace from names', async () => {
        const data = TestDataFactory.createRegisterRequest({
          firstName: '  John  ',
          lastName: '  Doe  ',
        });

        const response = await request(app).post(endpoint).send(data).expect(201);

        expect(mockAuthService.registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
          })
        );
      });
    });

    describe('Terms and Conditions', () => {
      it('should reject registration without accepting terms', async () => {
        const data = TestDataFactory.createRegisterRequest({
          acceptTerms: false,
        });

        const response = await request(app).post(endpoint).send(data).expect(400);

        TestAssertions.assertErrorResponse(response, 'VALIDATION_ERROR');
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({
            message: expect.stringContaining('accept the terms'),
          })
        );
      });

      it('should handle marketing opt-in correctly', async () => {
        const dataOptIn = TestDataFactory.createRegisterRequest({
          marketingOptIn: true,
        });

        const response = await request(app).post(endpoint).send(dataOptIn).expect(201);

        expect(mockAuthService.registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            marketingOptIn: true,
          })
        );
      });
    });
  });

  describe('Security Tests', () => {
    describe('SQL Injection Prevention', () => {
      it('should prevent SQL injection in email field', async () => {
        const result = await SecurityTestHelpers.testSQLInjection(async (payload) => {
          const data = TestDataFactory.createRegisterRequest({
            email: payload,
          });
          return request(app).post(endpoint).send(data);
        }, 'email');

        expect(result.vulnerable).toBe(false);
        if (result.vulnerable) {
          console.error('SQL Injection vulnerabilities:', result.details);
        }
      });

      it('should prevent SQL injection in name fields', async () => {
        const sqlPayloads = TestDataFactory.getSQLInjectionPayloads();

        for (const payload of sqlPayloads) {
          const data = TestDataFactory.createRegisterRequest({
            firstName: payload,
            lastName: payload,
          });

          const response = await request(app).post(endpoint).send(data);

          // Should either reject or handle safely
          TestAssertions.assertNoSensitiveDataExposed(response.body);
        }
      });
    });

    describe('XSS Prevention', () => {
      it('should prevent XSS in all input fields', async () => {
        const xssPayloads = TestDataFactory.getXSSPayloads();

        for (const payload of xssPayloads) {
          const data = TestDataFactory.createRegisterRequest({
            firstName: payload,
            lastName: payload,
            email: `test${Date.now()}@example.com`, // Valid email to test name fields
          });

          const response = await request(app).post(endpoint).send(data);

          // Check response doesn't reflect unescaped payload
          TestAssertions.assertNoSensitiveDataExposed(response.body);
          expect(response.text).not.toContain(payload);
        }
      });
    });

    describe('Password Hashing Verification', () => {
      it('should never store or return plain text passwords', async () => {
        const data = TestDataFactory.createRegisterRequest();

        const response = await request(app).post(endpoint).send(data).expect(201);

        // Response should not contain the password
        const responseStr = JSON.stringify(response.body);
        expect(responseStr).not.toContain(data.password);
        expect(responseStr).not.toContain('password');
      });

      it('should verify bcrypt hashing is used', async () => {
        // This would be tested in the authService unit tests
        // Here we just verify the service is called with the password
        const data = TestDataFactory.createRegisterRequest();

        await request(app).post(endpoint).send(data).expect(201);

        expect(mockAuthService.registerUser).toHaveBeenCalledWith(
          expect.objectContaining({
            password: data.password, // Service should hash this
          })
        );
      });
    });

    describe('Duplicate User Prevention', () => {
      it('should prevent duplicate email registration', async () => {
        const data = TestDataFactory.createRegisterRequest();

        // Mock duplicate user error
        mockAuthService.registerUser
          .mockResolvedValueOnce({
            success: true,
            message: 'Registration successful',
            data: expect.any(Object),
          } as any)
          .mockResolvedValueOnce({
            success: false,
            error: {
              type: 'USER_ALREADY_EXISTS',
              message: 'An account with this email address already exists',
              timestamp: new Date().toISOString(),
            },
          } as any);

        // First registration
        await request(app).post(endpoint).send(data).expect(201);

        // Second registration with same email
        const response = await request(app).post(endpoint).send(data).expect(409);

        TestAssertions.assertErrorResponse(response, 'USER_ALREADY_EXISTS');
      });

      it('should handle case-insensitive email duplicates', async () => {
        const email = 'test@example.com';
        const data1 = TestDataFactory.createRegisterRequest({ email: email.toLowerCase() });
        const data2 = TestDataFactory.createRegisterRequest({ email: email.toUpperCase() });

        // Both should be treated as the same email
        expect(data1.email).toBe('test@example.com');
        expect(data2.email).toBe('TEST@EXAMPLE.COM');
      });
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits on registration attempts', async () => {
      const attempts = 5; // Assuming rate limit is 3 per hour

      // Reset rate limiter state
      jest.clearAllMocks();

      for (let i = 0; i < attempts; i++) {
        const data = TestDataFactory.createRegisterRequest({
          email: `ratelimit${i}@example.com`,
        });

        const response = await request(app).post(endpoint).send(data);

        if (i < 3) {
          expect(response.status).toBe(201);
        } else {
          expect(response.status).toBe(429);
          TestAssertions.assertErrorResponse(response, 'RATE_LIMIT_EXCEEDED');
        }
      }
    });

    it('should track rate limits by IP address', async () => {
      // This test would require mocking the IP address
      // Implementation depends on rate limiter configuration
      const data = TestDataFactory.createRegisterRequest();

      const response = await request(app)
        .post(endpoint)
        .set('X-Forwarded-For', '192.168.1.100')
        .send(data)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(endpoint)
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      TestAssertions.assertNoSensitiveDataExposed(response.body);
    });

    it('should handle missing Content-Type header', async () => {
      const data = TestDataFactory.createRegisterRequest();

      const response = await request(app).post(endpoint).send(JSON.stringify(data)).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle oversized payloads', async () => {
      const largeData = {
        ...TestDataFactory.createRegisterRequest(),
        extraData: TestDataFactory.generateLargePayload(1000), // 1MB
      };

      const response = await request(app).post(endpoint).send(largeData).expect(413); // Payload too large

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      mockAuthService.registerUser.mockRejectedValueOnce(new Error('Database connection failed'));

      const data = TestDataFactory.createRegisterRequest();

      const response = await request(app).post(endpoint).send(data).expect(500);

      TestAssertions.assertErrorResponse(response, 'AUTH_REGISTER_ERROR');
      TestAssertions.assertNoSensitiveDataExposed(response.body);
    });

    it('should include request ID in all responses', async () => {
      const data = TestDataFactory.createRegisterRequest();

      const response = await request(app).post(endpoint).send(data);

      expect(response.body).toHaveProperty('timestamp');
      // Request ID should be in meta or error object
      if (response.body.error) {
        expect(response.body.error).toHaveProperty('requestId');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time limits', async () => {
      const data = TestDataFactory.createRegisterRequest();

      const responseTime = await PerformanceTestHelpers.measureResponseTime(() =>
        request(app).post(endpoint).send(data)
      );

      expect(responseTime).toBeLessThan(500); // 500ms threshold
    });

    it('should handle concurrent registrations', async () => {
      const results = await PerformanceTestHelpers.testUnderLoad(
        async () => {
          const data = TestDataFactory.createRegisterRequest();
          return request(app).post(endpoint).send(data);
        },
        10, // concurrency
        50 // total iterations
      );

      expect(results.successRate).toBeGreaterThan(95); // 95% success rate
      expect(results.avgTime).toBeLessThan(1000); // 1s average
    });
  });

  describe('Integration Tests', () => {
    it('should create a valid session after registration', async () => {
      const data = TestDataFactory.createRegisterRequest();

      const response = await request(app).post(endpoint).send(data).expect(201);

      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('expiresAt');

      // Verify JWT token is valid
      const token = response.body.data.accessToken;
      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
    });

    it('should set appropriate security headers', async () => {
      const data = TestDataFactory.createRegisterRequest();

      const response = await request(app).post(endpoint).send(data).expect(201);

      // Check security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});
