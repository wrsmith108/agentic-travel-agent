/**
 * Utility to convert Zod SafeParseReturnType to Result pattern
 */

import { z } from 'zod';
import { Result, ok, err } from './result';
import { AppError } from '@/middleware/errorHandler';

/**
 * Convert Zod SafeParseReturnType to Result pattern
 */
export function zodToResult<T>(
  parseResult: z.SafeParseReturnType<any, T>
): Result<T, AppError> {
  if (parseResult.success) {
    return ok(parseResult.data);
  }
  
  // Extract validation errors
  const errors = parseResult.error.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code
  }));
  
  return err({
    statusCode: 400,
    message: 'Validation failed',
    errorCode: 'VALIDATION_ERROR',
    details: { errors }
  } as AppError);
}

/**
 * Helper to validate and convert in one step
 */
export function validateWithResult<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Result<T, AppError> {
  return zodToResult(schema.safeParse(data));
}