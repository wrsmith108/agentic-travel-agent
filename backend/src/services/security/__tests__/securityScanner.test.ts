import { SecurityScanner } from '../securityScanner';
import { AppError, ErrorCodes } from '../../../middleware/errorHandler';
import { isOk, isErr } from '../../../utils/result';

describe('SecurityScanner', () => {
  let securityScanner: SecurityScanner;

  beforeEach(() => {
    jest.clearAllMocks();
    securityScanner = new SecurityScanner();
  });

  describe('Input Validation', () => {
    it('should detect SQL injection attempts', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
        "1; DELETE FROM users WHERE 1=1"
      ];

      maliciousInputs.forEach(input => {
        const result = securityScanner.scanForSQLInjection(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
          expect(result.error.message).toContain('SQL injection');
        }
      });
    });

    it('should allow safe SQL-like content', () => {
      const safeInputs = [
        "John O'Connor",
        "user@example.com",
        "This is a normal string",
        "Price: $19.99",
        "Version 1.0.1"
      ];

      safeInputs.forEach(input => {
        const result = securityScanner.scanForSQLInjection(input);
        expect(isOk(result)).toBe(true);
      });
    });

    it('should detect XSS attempts', () => {
      const xssInputs = [
        "<script>alert('xss')</script>",
        "javascript:alert(1)",
        "<img src=x onerror=alert(1)>",
        "<svg onload=alert(1)>",
        "javascript:void(0)",
        "<iframe src=javascript:alert(1)></iframe>"
      ];

      xssInputs.forEach(input => {
        const result = securityScanner.scanForXSS(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
          expect(result.error.message).toContain('XSS');
        }
      });
    });

    it('should allow safe HTML content', () => {
      const safeInputs = [
        "Hello World",
        "user@example.com",
        "Price < 100",
        "a > b",
        "Math.min(a, b)"
      ];

      safeInputs.forEach(input => {
        const result = securityScanner.scanForXSS(input);
        expect(isOk(result)).toBe(true);
      });
    });

    it('should detect command injection attempts', () => {
      const commandInjections = [
        "; ls -la",
        "& whoami",
        "| cat /etc/passwd",
        "$(id)",
        "`uname -a`",
        "foo; rm -rf /"
      ];

      commandInjections.forEach(input => {
        const result = securityScanner.scanForCommandInjection(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
          expect(result.error.message).toContain('command injection');
        }
      });
    });

    it('should detect path traversal attempts', () => {
      const pathTraversals = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32",
        "%2e%2e%2f%2e%2e%2f",
        "....//....//",
        "/var/log/../../../etc/passwd"
      ];

      pathTraversals.forEach(input => {
        const result = securityScanner.scanForPathTraversal(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
          expect(result.error.message).toContain('path traversal');
        }
      });
    });
  });

  describe('Password Security', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!Password',
        'C0mplex#Pass123',
        'Secure$Pa55w0rd',
        'Test123!@#ABC'
      ];

      strongPasswords.forEach(password => {
        const result = securityScanner.validatePasswordStrength(password);
        expect(isOk(result)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
        'admin',
        'letmein'
      ];

      weakPasswords.forEach(password => {
        const result = securityScanner.validatePasswordStrength(password);
        expect(isErr(result)).toBe(true);
      });
    });

    it('should detect common password patterns', () => {
      const commonPatterns = [
        'password',
        'admin',
        'test',
        '12345678',
        'qwertyui',
        'asdfghjk'
      ];

      commonPatterns.forEach(password => {
        const result = securityScanner.validatePasswordStrength(password);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('common pattern');
        }
      });
    });
  });

  describe('Rate Limiting Detection', () => {
    it('should detect rapid login attempts', () => {
      const userIP = '192.168.1.100';
      
      // Simulate multiple rapid login attempts
      for (let i = 0; i < 10; i++) {
        securityScanner.recordLoginAttempt(userIP, false);
      }

      const result = securityScanner.checkRateLimit(userIP, 'login');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
      }
    });

    it('should allow normal login rate', () => {
      const userIP = '192.168.1.101';
      
      // Simulate normal login attempts
      securityScanner.recordLoginAttempt(userIP, true);
      securityScanner.recordLoginAttempt(userIP, false);

      const result = securityScanner.checkRateLimit(userIP, 'login');
      expect(isOk(result)).toBe(true);
    });
  });

  describe('Security Headers Validation', () => {
    it('should validate security headers configuration', () => {
      const headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
      };

      const result = securityScanner.validateSecurityHeaders(headers);
      expect(isOk(result)).toBe(true);
    });

    it('should detect missing security headers', () => {
      const incompleteHeaders = {
        'X-Content-Type-Options': 'nosniff'
      };

      const result = securityScanner.validateSecurityHeaders(incompleteHeaders);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Missing security headers');
      }
    });
  });

  describe('File Upload Security', () => {
    it('should validate safe file extensions', () => {
      const safeFiles = [
        'document.pdf',
        'image.jpg',
        'data.json',
        'config.yaml',
        'readme.txt'
      ];

      safeFiles.forEach(filename => {
        const result = securityScanner.validateFileUpload(filename, 'application/pdf');
        expect(isOk(result)).toBe(true);
      });
    });

    it('should block dangerous file types', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'virus.scr',
        'backdoor.php',
        'shell.jsp'
      ];

      dangerousFiles.forEach(filename => {
        const result = securityScanner.validateFileUpload(filename, 'application/octet-stream');
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('dangerous content');
        }
      });
    });

    it('should validate file size limits', () => {
      const largeFileSize = 100 * 1024 * 1024; // 100MB
      const result = securityScanner.validateFileSize(largeFileSize, 'image');
      
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('exceeds limit');
      }
    });
  });

  describe('Network Security', () => {
    it('should detect suspicious IP addresses', () => {
      // Set NODE_ENV to production to enable private IP filtering
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const suspiciousIPs = [
        '10.0.0.1',      // Private network
        '192.168.1.1',   // Private network
        '172.16.0.1',    // Private network
        '127.0.0.1'      // Localhost
      ];

      suspiciousIPs.forEach(ip => {
        const result = securityScanner.validateIPAddress(ip);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error.message).toContain('private/internal IP');
        }
      });

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should allow public IP addresses', () => {
      const publicIPs = [
        '8.8.8.8',
        '1.1.1.1',
        '208.67.222.222'
      ];

      publicIPs.forEach(ip => {
        const result = securityScanner.validateIPAddress(ip);
        expect(isOk(result)).toBe(true);
      });
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize user input', () => {
      const dirtyInput = '<script>alert("xss")</script>Hello World';
      const sanitized = securityScanner.sanitizeInput(dirtyInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello World');
    });

    it('should sanitize SQL injection attempts', () => {
      const sqlInput = "'; DROP TABLE users; --";
      const sanitized = securityScanner.sanitizeInput(sqlInput);
      
      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).not.toContain('--');
    });
  });

  describe('Security Audit', () => {
    it('should perform comprehensive security audit', () => {
      const auditData = {
        input: "normal user input",
        ip: "203.0.113.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      };

      const result = securityScanner.performSecurityAudit(auditData);
      expect(isOk(result)).toBe(true);
    });

    it('should detect multiple security issues', () => {
      const auditData = {
        input: "<script>alert('xss')</script>",
        ip: "192.168.1.1",
        userAgent: "BadBot/1.0",
        headers: {}
      };

      const result = securityScanner.performSecurityAudit(auditData);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Multiple security violations');
      }
    });
  });

  describe('Security Metrics', () => {
    it('should track security events', () => {
      securityScanner.recordSecurityEvent('xss_attempt', { severity: 'high' });
      securityScanner.recordSecurityEvent('sql_injection', { severity: 'critical' });
      
      const metrics = securityScanner.getSecurityMetrics();
      
      expect(metrics.totalEvents).toBe(2);
      expect(metrics.eventsByType['xss_attempt']).toBe(1);
      expect(metrics.eventsByType['sql_injection']).toBe(1);
    });

    it('should calculate security score', () => {
      // Record various security events
      securityScanner.recordSecurityEvent('xss_attempt', { severity: 'high' });
      securityScanner.recordSecurityEvent('failed_login', { severity: 'medium' });
      
      const score = securityScanner.calculateSecurityScore();
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100); // Should be reduced due to security events
    });
  });

  describe('Threat Detection', () => {
    it('should detect coordinated attacks', () => {
      const attackPattern = {
        sourceIPs: ['1.2.3.4', '1.2.3.5', '1.2.3.6'],
        userAgent: 'AttackBot/1.0',
        timeWindow: 60000, // 1 minute
        requestCount: 100
      };

      const result = securityScanner.detectCoordinatedAttack(attackPattern);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('coordinated attack');
      }
    });

    it('should detect anomalous behavior', () => {
      const behaviorData = {
        userId: 'user123',
        requestCount: 1000,
        timeWindow: 300000, // 5 minutes
        failedAttempts: 50,
        locationChanges: 10
      };

      const result = securityScanner.detectAnomalousBehavior(behaviorData);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('anomalous behavior');
      }
    });
  });
});