import { Result, ok, err, isOk, isErr } from '@/utils/result';

/**
 * Result pattern implementation for explicit error handling
 * Inspired by Rust's Result type and functional programming patterns
 */

// Core Result types
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

// Type alias for async results
export type AsyncResult<T, E> = Promise<Result<T, E>>;

// Constructors
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

// Type guards
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

// Basic operations
export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  isOk(result) ? ok(fn(result.value)) : result;

export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  isErr(result) ? err(fn(result.error)) : result;

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (isOk(result) ? fn(result.value) : result);

export const flatMapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> => (isErr(result) ? fn(result.error) : result);

// Async operations
export const mapAsync = async <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): AsyncResult<U, E> => (isOk(result) ? ok(await fn(result.value)) : result);

export const flatMapAsync = async <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => AsyncResult<U, E>
): AsyncResult<U, E> => (isOk(result) ? fn(result.value) : result);

// Utility functions
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) return result.value;
  throw new Error(`Called unwrap on an Err value: ${JSON.stringify(result.error)}`);
};

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  isOk(result) ? result.value : defaultValue;

export const unwrapOrElse = <T, E>(result: Result<T, E>, fn: (error: E) => T): T =>
  isOk(result) ? result.value : fn(result.error);

export const expect = <T, E>(result: Result<T, E>, message: string): T => {
  if (isOk(result)) return result.value;
  throw new Error(`${message}: ${JSON.stringify(result.error)}`);
};

// Combinators
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) return result;
    values.push(result.value);
  }
  return ok(values);
};

export const allSettled = <T, E>(results: Result<T, E>[]): { successes: T[]; failures: E[] } => {
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
};

export const firstOk = <T, E>(results: Result<T, E>[]): Result<T, E[]> => {
  const errors: E[] = [];
  for (const result of results) {
    if (isOk(result)) return result;
    errors.push(result.error);
  }
  return err(errors);
};

// Async combinators
export const allAsync = async <T, E>(results: AsyncResult<T, E>[]): AsyncResult<T[], E> => {
  const awaited = await Promise.all(results);
  return all(awaited);
};

export const allSettledAsync = async <T, E>(
  results: AsyncResult<T, E>[]
): Promise<{ successes: T[]; failures: E[] }> => {
  const awaited = await Promise.all(results);
  return allSettled(awaited);
};

// Try-catch wrapper
export const tryCatch = <T, E>(fn: () => T, mapError: (error: unknown) => E): Result<T, E> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(mapError(error));
  }
};

export const tryCatchAsync = async <T, E>(
  fn: () => Promise<T>,
  mapError: (error: unknown) => E
): AsyncResult<T, E> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(mapError(error));
  }
};

// Pipe function for composing operations
export const pipe = <T, E>(
  result: Result<T, E>,
  ...fns: Array<(result: Result<any, E>) => Result<any, E>>
): Result<any, E> => fns.reduce((acc, fn) => fn(acc), result as Result<any, E>);

// Type utilities
export type OkType<T> = T extends Result<infer U, any> ? U : never;
export type ErrType<T> = T extends Result<any, infer E> ? E : never;
