import { Result, ok, err, isOk, isErr } from '@/utils/result';

/**
 * Result pattern implementation for explicit error handling
 * Provides a type-safe way to handle success and failure cases
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Create a successful result
 */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/**
 * Create an error result
 */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/**
 * Type guards
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

/**
 * Map the value of a successful result
 */
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => (isOk(result) ? ok(fn(result.value)) : result);

/**
 * Map the error of a failed result
 */
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => (isErr(result) ? err(fn(result.error)) : result);

/**
 * FlatMap for chaining operations that return Results
 */
export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (isOk(result) ? fn(result.value) : result);

/**
 * Extract the value or provide a default
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  isOk(result) ? result.value : defaultValue;

/**
 * Extract the value or compute it from the error
 */
export const unwrapOrElse = <T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T => (isOk(result) ? result.value : fn(result.error));

/**
 * Convert a Result to a Promise (useful for async operations)
 */
export const toPromise = <T, E>(result: Result<T, E>): Promise<T> =>
  isOk(result) ? Promise.resolve(result.value) : Promise.reject(result.error);

/**
 * Convert a Promise to a Result
 */
export const fromPromise = async <T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> => {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(error as E);
  }
};

/**
 * Combine multiple Results into a single Result
 * If all are Ok, returns Ok with array of values
 * If any are Err, returns the first Err
 */
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  
  return ok(values);
};

/**
 * Try to execute a function and return a Result
 */
export const tryCatch = <T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (error) {
    const mappedError = mapError ? mapError(error) : (error as E);
    return err(mappedError);
  }
};

/**
 * Try to execute an async function and return a Result
 */
export const tryCatchAsync = async <T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    const mappedError = mapError ? mapError(error) : (error as E);
    return err(mappedError);
  }
};