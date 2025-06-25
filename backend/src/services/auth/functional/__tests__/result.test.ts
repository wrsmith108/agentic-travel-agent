import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  flatMapErr,
  mapAsync,
  flatMapAsync,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  expect as expectResult,
  all,
  allSettled,
  firstOk,
  allAsync,
  allSettledAsync,
  tryCatch,
  tryCatchAsync,
  pipe,
  type Result,
  type OkType,
  type ErrType,
} from '../types/result';

describe('Result Pattern', () => {
  describe('Constructors', () => {
    it('should create Ok result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should create Err result', () => {
      const result = err('error message');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('error message');
    });
  });

  describe('Type Guards', () => {
    it('should identify Ok results', () => {
      const okResult = ok(42);
      const errResult = err('error');

      expect(isOk(okResult)).toBe(true);
      expect(isOk(errResult)).toBe(false);
    });

    it('should identify Err results', () => {
      const okResult = ok(42);
      const errResult = err('error');

      expect(isErr(okResult)).toBe(false);
      expect(isErr(errResult)).toBe(true);
    });
  });

  describe('map', () => {
    it('should transform Ok value', () => {
      const result = ok(42);
      const mapped = map(result, (x) => x * 2);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(84);
      }
    });

    it('should pass through Err unchanged', () => {
      const result = err('error');
      const mapped = map(result, (x: number) => x * 2);

      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe('error');
      }
    });
  });

  describe('mapErr', () => {
    it('should transform Err value', () => {
      const result = err('error');
      const mapped = mapErr(result, (e) => `Modified: ${e}`);

      expect(isErr(mapped)).toBe(true);
      if (isErr(mapped)) {
        expect(mapped.error).toBe('Modified: error');
      }
    });

    it('should pass through Ok unchanged', () => {
      const result = ok(42);
      const mapped = mapErr(result, (e: string) => `Modified: ${e}`);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(42);
      }
    });
  });

  describe('flatMap', () => {
    it('should chain Ok results', () => {
      const result = ok(42);
      const chained = flatMap(result, (x) => ok(x * 2));

      expect(isOk(chained)).toBe(true);
      if (isOk(chained)) {
        expect(chained.value).toBe(84);
      }
    });

    it('should short-circuit on first Err', () => {
      const result = ok(42);
      const chained = flatMap(result, (x) => err('computation failed'));

      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe('computation failed');
      }
    });

    it('should not execute function on Err input', () => {
      const result = err('initial error');
      let executed = false;
      const chained = flatMap(result, (x: number) => {
        executed = true;
        return ok(x * 2);
      });

      expect(executed).toBe(false);
      expect(isErr(chained)).toBe(true);
      if (isErr(chained)) {
        expect(chained.error).toBe('initial error');
      }
    });
  });

  describe('flatMapErr', () => {
    it('should recover from errors', () => {
      const result = err('error');
      const recovered = flatMapErr(result, (e) => ok(42));

      expect(isOk(recovered)).toBe(true);
      if (isOk(recovered)) {
        expect(recovered.value).toBe(42);
      }
    });

    it('should chain error transformations', () => {
      const result = err('error');
      const transformed = flatMapErr(result, (e) => err(`Wrapped: ${e}`));

      expect(isErr(transformed)).toBe(true);
      if (isErr(transformed)) {
        expect(transformed.error).toBe('Wrapped: error');
      }
    });

    it('should not execute function on Ok input', () => {
      const result = ok(42);
      let executed = false;
      const transformed = flatMapErr(result, (e: string) => {
        executed = true;
        return err('new error');
      });

      expect(executed).toBe(false);
      expect(isOk(transformed)).toBe(true);
    });
  });

  describe('Async operations', () => {
    it('should map async functions', async () => {
      const result = ok(42);
      const mapped = await mapAsync(result, async (x) => x * 2);

      expect(isOk(mapped)).toBe(true);
      if (isOk(mapped)) {
        expect(mapped.value).toBe(84);
      }
    });

    it('should flatMap async functions', async () => {
      const result = ok(42);
      const chained = await flatMapAsync(result, async (x) => ok(x * 2));

      expect(isOk(chained)).toBe(true);
      if (isOk(chained)) {
        expect(chained.value).toBe(84);
      }
    });
  });

  describe('Unwrapping', () => {
    it('should unwrap Ok values', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw on unwrap of Err', () => {
      const result = err('error');
      expect(() => unwrap(result)).toThrow();
    });

    it('should unwrapOr with default', () => {
      const okResult = ok(42);
      const errResult = err('error');

      expect(unwrapOr(okResult, 0)).toBe(42);
      expect(unwrapOr(errResult, 0)).toBe(0);
    });

    it('should unwrapOrElse with function', () => {
      const okResult = ok(42);
      const errResult = err('error');

      expect(unwrapOrElse(okResult, () => 0)).toBe(42);
      expect(unwrapOrElse(errResult, (e) => e.length)).toBe(5);
    });

    it('should expect with custom message', () => {
      const result = ok(42);
      expect(expectResult(result, 'Should have value')).toBe(42);

      const errResult = err('error');
      expect(() => expectResult(errResult, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('Combinators', () => {
    it('should combine all Ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = all(results);

      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should fail on first Err in all', () => {
      const results = [ok(1), err('error'), ok(3)];
      const combined = all(results);

      expect(isErr(combined)).toBe(true);
      if (isErr(combined)) {
        expect(combined.error).toBe('error');
      }
    });

    it('should collect all settled results', () => {
      const results = [ok(1), err('error'), ok(3)];
      const settled = allSettled(results);

      expect(settled.successes).toEqual([1, 3]);
      expect(settled.failures).toEqual(['error']);
    });

    it('should find first Ok result', () => {
      const results = [err('error1'), err('error2'), ok(42), ok(43)];
      const first = firstOk(results);

      expect(isOk(first)).toBe(true);
      if (isOk(first)) {
        expect(first.value).toBe(42);
      }
    });

    it('should collect all errors if no Ok in firstOk', () => {
      const results = [err('error1'), err('error2'), err('error3')];
      const first = firstOk(results);

      expect(isErr(first)).toBe(true);
      if (isErr(first)) {
        expect(first.error).toEqual(['error1', 'error2', 'error3']);
      }
    });
  });

  describe('Async Combinators', () => {
    it('should combine all async Ok results', async () => {
      const results = [Promise.resolve(ok(1)), Promise.resolve(ok(2)), Promise.resolve(ok(3))];
      const combined = await allAsync(results);

      expect(isOk(combined)).toBe(true);
      if (isOk(combined)) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should collect all settled async results', async () => {
      const results = [
        Promise.resolve(ok(1)),
        Promise.resolve(err('error')),
        Promise.resolve(ok(3)),
      ];
      const settled = await allSettledAsync(results);

      expect(settled.successes).toEqual([1, 3]);
      expect(settled.failures).toEqual(['error']);
    });
  });

  describe('Try-Catch Wrappers', () => {
    it('should wrap successful function in Ok', () => {
      const result = tryCatch(
        () => 42,
        (e) => 'computation failed'
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should wrap throwing function in Err', () => {
      const result = tryCatch(
        () => {
          throw new Error('boom');
        },
        (e) => 'computation failed'
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('computation failed');
      }
    });

    it('should wrap async success in Ok', async () => {
      const result = await tryCatchAsync(
        async () => 42,
        (e) => 'async failed'
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('should wrap async rejection in Err', async () => {
      const result = await tryCatchAsync(
        async () => {
          throw new Error('async boom');
        },
        (e) => 'async failed'
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('async failed');
      }
    });
  });

  describe('Pipe Function', () => {
    it('should compose multiple operations', () => {
      const result = pipe(
        ok(5),
        (r) => map(r, (x) => x * 2),
        (r) => map(r, (x) => x + 1),
        (r) => flatMap(r, (x) => (x > 10 ? ok(x) : err('too small')))
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(11);
      }
    });

    it('should short-circuit on error', () => {
      const result = pipe(
        ok(5),
        (r) => map(r, (x) => x * 2),
        (r) => flatMap(r, (x) => err('failed')),
        (r) => map(r, (x) => x + 1) // This should not execute
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('failed');
      }
    });
  });

  describe('Type Utilities', () => {
    it('should extract Ok type', () => {
      type TestResult = Result<number, string>;
      type ExtractedOk = OkType<TestResult>;

      const value: ExtractedOk = 42;
      expect(value).toBe(42);
    });

    it('should extract Err type', () => {
      type TestResult = Result<number, string>;
      type ExtractedErr = ErrType<TestResult>;

      const error: ExtractedErr = 'error';
      expect(error).toBe('error');
    });
  });
});
