import { Result, ok, err, isOk, isErr } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import createLogger from '../../utils/logger';
const logger = createLogger('UsecurityScanner');import * as validator from 'validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { Result, ok, err, isErr } from '@/utils/result';

// Initialize DOMPurify for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

interface SecurityEvent {
  type: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: { [type: string]: number };
  eventsBySeverity: { [severity: string]: number };
  lastEventTime: number;
  securityScore: number;
}

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blocked: boolean;
}

interface CoordinatedAttackPattern {
  sourceIPs: string[];
  userAgent: string;
  timeWindow: number;
  requestCount: number;
}

interface AnomalousBehavior {
  userId: string;
  requestCount: number;
  timeWindow: number;
  failedAttempts: number;
  locationChanges: number;
}

export class SecurityScanner {
  private securityEvents: SecurityEvent[] = [];
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: string[] = [];

  // Common attack patterns
  private readonly SQL_INJECTION_PATTERNS = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /((\%27)|(\'))select/i,
    /((\%27)|(\'))insert/i,
    /((\%27)|(\'))delete/i,
    /((\%27)|(\'))update/i,
    /((\%27)|(\'))drop/i,
    /((\%27)|(\'))create/i,
    /((\%27)|(\'))alter/i,
    /((\%27)|(\'))exec/i
  ];

  private readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi
  ];

  private readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$\(\)]/,
    /\$\([^)]*\)/,
    /`[^`]*`/,
    /\|\s*\w+/,
    /;\s*\w+/,
    /&&\s*\w+/,
    /\|\|\s*\w+/
  ];

  private readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[\/\\]/,
    /%2e%2e[\/\\]/i,
    /\.{2,}[\/\\]/,
    /%252e/i,
    /\.\.[\/\\].*[\/\\]/,
    /[\/\\]\.\.$/
  ];

  private readonly DANGEROUS_FILE_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'scr', 'pif', 'vbs', 'js', 'jar', 'com',
    'php', 'jsp', 'asp', 'aspx', 'py', 'rb', 'pl', 'sh', 'bash'
  ];

  private readonly COMMON_PASSWORDS = [
    'password', 'admin', 'test', 'guest', 'user', 'root', 'administrator',
    '123456', '12345678', 'qwerty', 'abc123', 'password123', 'admin123',
    'letmein', 'welcome', 'monkey', 'dragon', 'master', 'login'
  ];

  private readonly PRIVATE_IP_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];

  scanForSQLInjection(input: string): Result<void, AppError> {
    if (!input) return ok(undefined);

    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        this.recordSecurityEvent('sql_injection_attempt', { 
          severity: 'critical',
          input: input.substring(0, 100) // Truncate for logging
        });
        
        return err(new AppError(
          400,
          'Potential SQL injection detected in input',
          ErrorCodes.VALIDATION_ERROR
        ));
      }
    }

    return ok(undefined);
  }

  scanForXSS(input: string): Result<void, AppError> {
    if (!input) return ok(undefined);

    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        this.recordSecurityEvent('xss_attempt', {
          severity: 'high',
          input: input.substring(0, 100)
        });

        return err(new AppError(
          400,
          'Potential XSS attack detected in input',
          ErrorCodes.VALIDATION_ERROR
        ));
      }
    }

    return ok(undefined);
  }

  scanForCommandInjection(input: string): Result<void, AppError> {
    if (!input) return ok(undefined);

    for (const pattern of this.COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        this.recordSecurityEvent('command_injection_attempt', {
          severity: 'critical',
          input: input.substring(0, 100)
        });

        return err(new AppError(
          400,
          'Potential command injection detected in input',
          ErrorCodes.VALIDATION_ERROR
        ));
      }
    }

    return ok(undefined);
  }

  scanForPathTraversal(input: string): Result<void, AppError> {
    if (!input) return ok(undefined);

    const decodedInput = decodeURIComponent(input);
    
    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(input) || pattern.test(decodedInput)) {
        this.recordSecurityEvent('path_traversal_attempt', {
          severity: 'high',
          input: input.substring(0, 100)
        });

        return err(new AppError(
          400,
          'Potential path traversal detected in input',
          ErrorCodes.VALIDATION_ERROR
        ));
      }
    }

    return ok(undefined);
  }

  validatePasswordStrength(password: string): Result<void, AppError> {
    if (!password) {
      return err(new AppError(400, 'Password is required', ErrorCodes.VALIDATION_ERROR));
    }

    // Check length
    if (password.length < 8) {
      return err(new AppError(
        400,
        'Password must be at least 8 characters long',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
      return err(new AppError(
        400,
        'Password must contain at least one uppercase letter',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    // Check for lowercase
    if (!/[a-z]/.test(password)) {
      return err(new AppError(
        400,
        'Password must contain at least one lowercase letter',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    // Check for numbers
    if (!/\d/.test(password)) {
      return err(new AppError(
        400,
        'Password must contain at least one number',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    // Check for special characters
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return err(new AppError(
        400,
        'Password must contain at least one special character',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    // Check against common passwords
    if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      return err(new AppError(
        400,
        'Password contains a common pattern and is not secure',
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    return ok(undefined);
  }

  recordLoginAttempt(ip: string, success: boolean): void {
    const key = `login:${ip}`;
    const now = Date.now();
    const existing = this.rateLimits.get(key);

    if (existing) {
      existing.count++;
      existing.lastAttempt = now;
      
      if (!success) {
        // Increase penalty for failed attempts
        existing.count += 2;
      }
    } else {
      this.rateLimits.set(key, {
        count: success ? 1 : 3,
        firstAttempt: now,
        lastAttempt: now,
        blocked: false
      });
    }

    if (!success) {
      this.recordSecurityEvent('failed_login', {
        severity: 'medium',
        ip,
        timestamp: now
      });
    }
  }

  checkRateLimit(ip: string, action: string): Result<void, AppError> {
    const key = `${action}:${ip}`;
    const entry = this.rateLimits.get(key);
    
    if (!entry) return ok(undefined);

    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    const maxAttempts = action === 'login' ? 5 : 10;

    // Reset if time window has passed
    if (now - entry.firstAttempt > timeWindow) {
      this.rateLimits.delete(key);
      return ok(undefined);
    }

    if (entry.count > maxAttempts) {
      this.recordSecurityEvent('rate_limit_exceeded', {
        severity: 'high',
        ip,
        action,
        attempts: entry.count
      });

      return err(new AppError(
        429,
        `Rate limit exceeded for ${action}. Try again later.`,
        ErrorCodes.RATE_LIMIT_EXCEEDED
      ));
    }

    return ok(undefined);
  }

  validateSecurityHeaders(headers: { [key: string]: string }): Result<void, AppError> {
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Strict-Transport-Security'
    ];

    const missingHeaders: string[] = [];

    for (const header of requiredHeaders) {
      if (!headers[header]) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      return err(new AppError(
        400,
        `Missing security headers: ${missingHeaders.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    return ok(undefined);
  }

  validateFileUpload(filename: string, mimetype: string): Result<void, AppError> {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (extension && this.DANGEROUS_FILE_EXTENSIONS.includes(extension)) {
      this.recordSecurityEvent('dangerous_file_upload', {
        severity: 'high',
        filename,
        extension,
        mimetype
      });

      return err(new AppError(
        400,
        `File type '${extension}' is not allowed as it may contain dangerous content`,
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    return ok(undefined);
  }

  validateFileSize(size: number, type: string): Result<void, AppError> {
    const limits: { [key: string]: number } = {
      image: 10 * 1024 * 1024,    // 10MB
      document: 50 * 1024 * 1024, // 50MB
      video: 100 * 1024 * 1024,   // 100MB
      default: 5 * 1024 * 1024    // 5MB
    };

    const limit = limits[type] || limits.default;

    if (size > limit) {
      return err(new AppError(
        400,
        `File size (${Math.round(size / 1024 / 1024)}MB) exceeds limit (${Math.round(limit / 1024 / 1024)}MB) for ${type} files`,
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    return ok(undefined);
  }

  validateIPAddress(ip: string): Result<void, AppError> {
    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      return err(new AppError(
        403,
        'IP address is blocked',
        ErrorCodes.AUTHORIZATION_FAILED
      ));
    }

    // Check for private/internal IPs in production
    if (process.env.NODE_ENV === 'production') {
      for (const pattern of this.PRIVATE_IP_RANGES) {
        if (pattern.test(ip)) {
          this.recordSecurityEvent('suspicious_ip_access', {
            severity: 'medium',
            ip
          });

          return err(new AppError(
            400,
            'Access from private/internal IP addresses is not allowed',
            ErrorCodes.VALIDATION_ERROR,
            { reason: 'suspicious IP' }
          ));
        }
      }
    }

    return ok(undefined);
  }

  sanitizeInput(input: string): string {
    if (!input) return input;

    // Remove HTML tags and potentially dangerous content
    let sanitized = purify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    // Additional SQL injection character removal
    sanitized = sanitized.replace(/['"`;\\]/g, '');
    
    // Remove script tags and javascript
    sanitized = sanitized.replace(/<script.*?>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    return sanitized.trim();
  }

  performSecurityAudit(data: any): Result<void, AppError> {
    const issues: string[] = [];

    // Check input for various attack vectors
    if (data.input) {
      const sqlCheck = this.scanForSQLInjection(data.input);
      if (isErr(sqlCheck)) issues.push('SQL injection attempt');

      const xssCheck = this.scanForXSS(data.input);
      if (isErr(xssCheck)) issues.push('XSS attempt');

      const cmdCheck = this.scanForCommandInjection(data.input);
      if (isErr(cmdCheck)) issues.push('Command injection attempt');
    }

    // Check IP address
    if (data.ip) {
      const ipCheck = this.validateIPAddress(data.ip);
      if (isErr(ipCheck)) issues.push('Suspicious IP address');
    }

    // Check security headers
    if (data.headers) {
      const headerCheck = this.validateSecurityHeaders(data.headers);
      if (isErr(headerCheck)) issues.push('Missing security headers');
    }

    if (issues.length > 0) {
      this.recordSecurityEvent('security_audit_failure', {
        severity: 'high',
        issues,
        data: JSON.stringify(data).substring(0, 500)
      });

      return err(new AppError(
        400,
        `Multiple security violations detected: ${issues.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR
      ));
    }

    return ok(undefined);
  }

  recordSecurityEvent(type: string, metadata: any): void {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      severity: metadata.severity || 'medium',
      metadata
    };

    this.securityEvents.push(event);

    // Log security event
    logger.warn('Security event recorded', {
      type,
      severity: event.severity,
      metadata
    });

    // Limit stored events
    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-5000);
    }
  }

  getSecurityMetrics(): SecurityMetrics {
    const eventsByType: { [type: string]: number } = {};
    const eventsBySeverity: { [severity: string]: number } = {};

    this.securityEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      lastEventTime: this.securityEvents.length > 0 
        ? this.securityEvents[this.securityEvents.length - 1].timestamp 
        : 0,
      securityScore: this.calculateSecurityScore()
    };
  }

  calculateSecurityScore(): number {
    const baseScore = 100;
    const recentEvents = this.securityEvents.filter(
      event => Date.now() - event.timestamp < 86400000 // Last 24 hours
    );

    let penalty = 0;
    recentEvents.forEach(event => {
      switch (event.severity) {
        case 'critical': penalty += 20; break;
        case 'high': penalty += 10; break;
        case 'medium': penalty += 5; break;
        case 'low': penalty += 1; break;
      }
    });

    return Math.max(0, baseScore - penalty);
  }

  detectCoordinatedAttack(pattern: CoordinatedAttackPattern): Result<void, AppError> {
    const { sourceIPs, userAgent, timeWindow, requestCount } = pattern;

    // Check if multiple IPs with same user agent are making high volume requests
    if (sourceIPs.length > 3 && requestCount > 50) {
      this.recordSecurityEvent('coordinated_attack', {
        severity: 'critical',
        sourceIPs: sourceIPs.slice(0, 10), // Limit logged IPs
        userAgent,
        requestCount
      });

      // Block the IPs
      sourceIPs.forEach(ip => this.blockedIPs.add(ip));

      return err(new AppError(
        403,
        'Coordinated attack detected. Source IPs have been blocked.',
        ErrorCodes.AUTHORIZATION_FAILED
      ));
    }

    return ok(undefined);
  }

  detectAnomalousBehavior(behavior: AnomalousBehavior): Result<void, AppError> {
    const { userId, requestCount, timeWindow, failedAttempts, locationChanges } = behavior;

    // Calculate anomaly score
    let anomalyScore = 0;

    // High request rate
    const requestRate = requestCount / (timeWindow / 1000);
    if (requestRate > 10) anomalyScore += 30; // More than 10 requests per second

    // High failure rate
    const failureRate = failedAttempts / requestCount;
    if (failureRate > 0.5) anomalyScore += 25; // More than 50% failures

    // Frequent location changes
    if (locationChanges > 3) anomalyScore += 20;

    if (anomalyScore > 50) {
      this.recordSecurityEvent('anomalous_behavior', {
        severity: 'high',
        userId,
        anomalyScore,
        requestCount,
        failedAttempts,
        locationChanges
      });

      return err(new AppError(
        429,
        'Anomalous behavior detected. Account may be compromised.',
        ErrorCodes.RATE_LIMIT_EXCEEDED
      ));
    }

    return ok(undefined);
  }

  // Helper function for Result type checking
  private isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return !result.ok;
  }
}

// Export singleton instance
export const securityScanner = new SecurityScanner();

// Also export for testing
export default SecurityScanner;