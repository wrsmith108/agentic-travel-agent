import { Result, ok, err, isOk, isErr } from '../result';
import { AppError, createSystemError } from '../../services/auth/functional/types/errors';

// Convert promise to Result
export async function resultFromPromise<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(error as E);
  }
}

// Map over successful Result
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

// Async map over successful Result
export async function mapResultAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>> {
  if (isOk(result)) {
    try {
      const value = await fn(result.value);
      return ok(value);
    } catch (error) {
      return err(error as E);
    }
  }
  return result;
}

// FlatMap over successful Result
export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

// Async flatMap
export async function flatMapResultAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

// Collect array of Results into Result of array
export function collectResults<T, E>(
  results: Result<T, E>[]
): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

// Collect with partial success
export function collectResultsPartial<T, E>(
  results: Result<T, E>[]
): { successes: T[]; failures: E[] } {
  const successes: T[] = [];
  const failures: E[] = [];
  
  for (const result of results) {
    if (isOk(result)) {
      successes.push(result.value);
    } else {
      failures.push(result.error);
    }
  }
  
  return { successes, failures };
}

// Chain multiple Results
export function chainResults<T, E>(
  ...fns: Array<(input: any) => Result<any, E>>
): (input: T) => Result<any, E> {
  return (input: T) => {
    let result: Result<any, E> = ok(input);
    
    for (const fn of fns) {
      if (isErr(result)) {
        return result;
      }
      result = fn(result.value);
    }
    
    return result;
  };
}

// Get value or default
export function getOrElse<T, E>(
  result: Result<T, E>,
  defaultValue: T
): T {
  return isOk(result) ? result.value : defaultValue;
}

// Get value or compute default
export function getOrElseLazy<T, E>(
  result: Result<T, E>,
  defaultFn: () => T
): T {
  return isOk(result) ? result.value : defaultFn();
}

// Convert Result to nullable
export function toNullable<T, E>(
  result: Result<T, E>
): T | null {
  return isOk(result) ? result.value : null;
}

// Convert nullable to Result
export function fromNullable<T, E>(
  value: T | null | undefined,
  error: E
): Result<T, E> {
  return value !== null && value !== undefined ? ok(value) : err(error);
}

// Try-catch wrapper
export function tryCatch<T, E = Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(errorHandler ? errorHandler(error) : (error as E));
  }
}

// Async try-catch wrapper
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(errorHandler ? errorHandler(error) : (error as E));
  }
}

// Combine two Results
export function combine<T1, T2, E>(
  result1: Result<T1, E>,
  result2: Result<T2, E>
): Result<[T1, T2], E> {
  if (isErr(result1)) return result1;
  if (isErr(result2)) return result2;
  return ok([result1.value, result2.value]);
}

// Combine multiple Results
export function combineAll<E>(
  ...results: Result<any, E>[]
): Result<any[], E> {
  const values: any[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

// Type predicate for Result
export function isResult<T, E>(
  value: unknown
): value is Result<T, E> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value.ok === true || value.ok === false)
  );
}

// Create AppError helper
export function createAppError(
  error: unknown,
  defaultMessage = 'An unexpected error occurred'
): AppError {
  const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  if (error instanceof Error) {
    return createSystemError(
      error.message,
      'UNEXPECTED_ERROR',
      generateRequestId(),
      error.stack
    );
  }
  
  return createSystemError(
    defaultMessage,
    'UNEXPECTED_ERROR',
    generateRequestId()
  );
}