import type { Request, Response, NextFunction } from 'express';
import { createTimestamp } from '@/services/auth/functional/types';

// Extend Request type to include file upload properties
declare global {
  namespace Express {
    interface Request {
      file?: any;
      files?: any;
    }
  }
}
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { logWarn, logError } from '@/utils/logger';
import { AppError, ErrorCodes } from './errorHandler';

/**
 * Input sanitization middleware for security
 * Following 2025 OWASP best practices
 */

// Define safe patterns for different input types
const SAFE_PATTERNS = {
  // Alphanumeric with common punctuation
  general: /^[\w\s\-.,!?'"()]+$/,
  // Email pattern
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // UUID pattern
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // Date patterns
  date: /^\d{4}-\d{2}-\d{2}$/,
  datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
  // URL pattern (simplified)
  url: /^https?:\/\/[\w\-.]+(:\d+)?(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/,
  // Phone pattern (international)
  phone: /^\+?[\d\s\-().]+$/,
};

// SQL injection patterns to block
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|into|where|table)\b)/i,
  /(';|";|--|\*|\/\*|\*\/|xp_|sp_)/i,
  /(\b(or|and)\b\s*\d+\s*=\s*\d+)/i,
];

// NoSQL injection patterns to block
const NOSQL_INJECTION_PATTERNS = [
  /(\$\w+\s*:)/,
  /(\$where|\$ne|\$eq|\$gt|\$gte|\$lt|\$lte|\$in|\$nin)/,
  /{.*["\']?\$\w+["\']?\s*:/,
];

// XSS patterns are handled by DOMPurify instead

/**
 * Sanitize string input
 */
export function sanitizeString(
  input: string,
  options: {
    maxLength?: number;
    allowHtml?: boolean;
    pattern?: RegExp;
    transform?: 'lowercase' | 'uppercase' | 'trim';
  } = {}
): string {
  let sanitized = input;

  // Apply length limit
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // Apply transformation
  switch (options.transform) {
    case 'lowercase':
      sanitized = sanitized.toLowerCase();
      break;
    case 'uppercase':
      sanitized = sanitized.toUpperCase();
      break;
    case 'trim':
      sanitized = sanitized.trim();
      break;
  }

  // Remove HTML if not allowed
  if (!options.allowHtml) {
    sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
  } else {
    // Allow safe HTML only
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target'],
    });
  }

  // Check against pattern if provided
  if (options.pattern && !options.pattern.test(sanitized)) {
    throw new AppError(400, 'Invalid input format', ErrorCodes.VALIDATION_ERROR);
  }

  // Check for injection attempts
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      logWarn('SQL injection attempt detected', { input: sanitized.substring(0, 100) });
      throw new AppError(400, 'Invalid input detected', ErrorCodes.VALIDATION_ERROR);
    }
  }

  for (const pattern of NOSQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      logWarn('NoSQL injection attempt detected', { input: sanitized.substring(0, 100) });
      throw new AppError(400, 'Invalid input detected', ErrorCodes.VALIDATION_ERROR);
    }
  }

  return sanitized;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any, schema?: z.ZodSchema): any {
  if (schema) {
    // Use Zod schema for validation if provided
    try {
      return schema.parse(obj);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid input data', ErrorCodes.VALIDATION_ERROR, error.errors);
      }
      throw error;
    }
  }

  // Manual sanitization for objects without schema
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key
    const sanitizedKey = sanitizeString(key, { maxLength: 100, pattern: /^[\w\-_.]+$/ });

    // Sanitize value based on type
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value, { maxLength: 10000 });
    } else if (typeof value === 'object') {
      sanitized[sanitizedKey] = sanitizeObject(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to sanitize all inputs
 */
export const sanitizeInputs = (
  options: {
    bodySchema?: z.ZodSchema;
    querySchema?: z.ZodSchema;
    paramsSchema?: z.ZodSchema;
  } = {}
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize body
      if (req.body && Object.keys(req.body).length > 0) {
        req.body = sanitizeObject(req.body, options.bodySchema);
      }

      // Sanitize query parameters
      if (req.query && Object.keys(req.query).length > 0) {
        const sanitizedQuery: any = {};
        for (const [key, value] of Object.entries(req.query)) {
          const sanitizedKey = sanitizeString(key, { maxLength: 50, pattern: /^[\w\-_.]+$/ });
          if (typeof value === 'string') {
            sanitizedQuery[sanitizedKey] = sanitizeString(value, { maxLength: 200 });
          } else if (Array.isArray(value)) {
            sanitizedQuery[sanitizedKey] = value.map((v) =>
              typeof v === 'string' ? sanitizeString(v, { maxLength: 200 }) : v
            );
          } else {
            sanitizedQuery[sanitizedKey] = value;
          }
        }
        req.query = sanitizedQuery;
      }

      // Sanitize route parameters
      if (req.params && Object.keys(req.params).length > 0) {
        const sanitizedParams: any = {};
        for (const [key, value] of Object.entries(req.params)) {
          const sanitizedKey = sanitizeString(key, { maxLength: 50, pattern: /^[\w\-_.]+$/ });
          sanitizedParams[sanitizedKey] = sanitizeString(value, { maxLength: 200 });
        }
        req.params = sanitizedParams;
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code || ErrorCodes.VALIDATION_ERROR,
            message: error.message,
            details: error.details,
          },
          meta: {
            timestamp: createTimestamp(),
            ...(req.id && { requestId: req.id }),
          },
        });
      } else {
        logError('Input sanitization error', error);
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: 'Input validation failed',
          },
          meta: {
            timestamp: createTimestamp(),
            ...(req.id && { requestId: req.id }),
          },
        });
      }
    }
  };
};

/**
 * Sanitize file uploads
 */
export const sanitizeFileUpload = (
  options: {
    allowedTypes?: string[];
    maxSize?: number; // bytes
    scanForVirus?: boolean;
  } = {}
) => {
  const defaultOptions = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    scanForVirus: false, // Would integrate with ClamAV or similar in production
  };

  const finalOptions = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if files are present
    if (!req.files && !req.file) {
      next();
      return;
    }

    try {
      const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [req.file];

      for (const file of files) {
        if (!file) continue;

        // Check file type
        if (finalOptions.allowedTypes && !finalOptions.allowedTypes.includes(file.mimetype)) {
          throw new AppError(
            400,
            `File type ${file.mimetype} not allowed`,
            ErrorCodes.VALIDATION_ERROR
          );
        }

        // Check file size
        if (finalOptions.maxSize && file.size > finalOptions.maxSize) {
          throw new AppError(
            400,
            `File size exceeds maximum of ${finalOptions.maxSize} bytes`,
            ErrorCodes.VALIDATION_ERROR
          );
        }

        // Sanitize filename
        file.originalname = sanitizeString(file.originalname, {
          maxLength: 255,
          pattern: /^[\w\-. ]+$/,
        });

        // In production, scan for viruses here
        if (finalOptions.scanForVirus) {
          // TODO: Integrate with antivirus service
          logWarn('Virus scanning not implemented in MVP');
        }
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code || ErrorCodes.VALIDATION_ERROR,
            message: error.message,
          },
        });
      } else {
        logError('File upload sanitization error', error);
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: 'File validation failed',
          },
        });
      }
    }
  };
};

/**
 * Specific sanitizers for common inputs
 */
export const sanitizers = {
  email: (email: string): string => {
    const sanitized = sanitizeString(email, {
      maxLength: 255,
      transform: 'lowercase',
      pattern: SAFE_PATTERNS.email,
    });
    return sanitized;
  },

  username: (username: string): string => {
    return sanitizeString(username, {
      maxLength: 50,
      pattern: /^[\w\-_.]+$/,
      transform: 'trim',
    });
  },

  password: (password: string): string => {
    // Don't transform passwords, but check length
    if (password.length < 8 || password.length > 128) {
      throw new AppError(
        400,
        'Password must be between 8 and 128 characters',
        ErrorCodes.VALIDATION_ERROR
      );
    }
    return password;
  },

  url: (url: string): string => {
    return sanitizeString(url, {
      maxLength: 2000,
      pattern: SAFE_PATTERNS.url,
    });
  },

  phoneNumber: (phone: string): string => {
    return sanitizeString(phone, {
      maxLength: 20,
      pattern: SAFE_PATTERNS.phone,
    });
  },

  date: (date: string): string => {
    return sanitizeString(date, {
      maxLength: 10,
      pattern: SAFE_PATTERNS.date,
    });
  },

  uuid: (uuid: string): string => {
    return sanitizeString(uuid, {
      maxLength: 36,
      pattern: SAFE_PATTERNS.uuid,
      transform: 'lowercase',
    });
  },
};
