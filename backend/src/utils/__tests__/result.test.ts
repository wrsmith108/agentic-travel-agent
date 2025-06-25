import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrapOr,
  unwrapOrElse,
  toPromise,
  fromPromise,
  all,
  tryCatch,
  tryCatchAsync,
  Result,
} from '../result';

describe('Result Pattern', () => {
  describe('Basic construction', () => {
    it('should create Ok result', () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('should create Err result', () => {
      const result = err('error message');
      expect(result).toEqual({ ok: false, error: 'error message' });
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('map', () => {
    it('should map Ok value', () => {
      const result = ok(10);
      const mapped = map(result, (x) => x * 2);
      expect(mapped).toEqual(ok(20));
    });

    it('should not map Err value', () => {
      const result = err('error');
      const mapped = map(result, (x: number) => x * 2);
      expect(mapped).toEqual(err('error'));
    });
  });

  describe('mapErr', () => {
    it('should not map Ok value', () => {
      const result = ok(10);
      const mapped = mapErr(result, (e) => `Error: ${e}`);
      expect(mapped).toEqual(ok(10));
    });

    it('should map Err value', () => {
      const result = err('failed');
      const mapped = mapErr(result, (e) => `Error: ${e}`);
      expect(mapped).toEqual(err('Error: failed'));
    });
  });

  describe('flatMap', () => {
    it('should chain Ok results', () => {
      const divide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return err('Division by zero');
        return ok(a / b);
      };

      const result = flatMap(ok(10), (x) => divide(x, 2));
      expect(result).toEqual(ok(5));
    });

    it('should not chain on Err', () => {
      const divide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return err('Division by zero');
        return ok(a / b);
      };

      const result = flatMap(err('initial error'), (x: number) => divide(x, 2));
      expect(result).toEqual(err('initial error'));
    });

    it('should propagate Err from chained operation', () => {
      const divide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return err('Division by zero');
        return ok(a / b);
      };

      const result = flatMap(ok(10), (x) => divide(x, 0));
      expect(result).toEqual(err('Division by zero'));
    });
  });

  describe('unwrapOr', () => {
    it('should return value for Ok', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default for Err', () => {
      const result = err('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('unwrapOrElse', () => {
    it('should return value for Ok', () => {
      const result = ok(42);
      expect(unwrapOrElse(result, (e) => 0)).toBe(42);
    });

    it('should compute value for Err', () => {
      const result = err('error');
      expect(unwrapOrElse(result, (e) => e.length)).toBe(5);
    });
  });

  describe('toPromise', () => {
    it('should resolve Ok to Promise', async () => {
      const result = ok(42);
      await expect(toPromise(result)).resolves.toBe(42);
    });

    it('should reject Err to Promise', async () => {
      const result = err('error');
      await expect(toPromise(result)).rejects.toBe('error');
    });
  });

  describe('fromPromise', () => {
    it('should convert resolved Promise to Ok', async () => {
      const promise = Promise.resolve(42);
      const result = await fromPromise(promise);
      expect(result).toEqual(ok(42));
    });

    it('should convert rejected Promise to Err', async () => {
      const promise = Promise.reject('error');
      const result = await fromPromise(promise);
      expect(result).toEqual(err('error'));
    });
  });

  describe('all', () => {
    it('should combine all Ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = all(results);
      expect(combined).toEqual(ok([1, 2, 3]));
    });

    it('should return first Err', () => {
      const results = [ok(1), err('error1'), ok(3), err('error2')];
      const combined = all(results);
      expect(combined).toEqual(err('error1'));
    });

    it('should handle empty array', () => {
      const results: Result<number, string>[] = [];
      const combined = all(results);
      expect(combined).toEqual(ok([]));
    });
  });

  describe('tryCatch', () => {
    it('should return Ok for successful function', () => {
      const result = tryCatch(() => 42);
      expect(result).toEqual(ok(42));
    });

    it('should return Err for throwing function', () => {
      const result = tryCatch(() => {
        throw new Error('failed');
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as Error).message).toBe('failed');
      }
    });

    it('should map error with custom mapper', () => {
      const result = tryCatch(
        () => {
          throw new Error('failed');
        },
        (e) => `Error occurred: ${(e as Error).message}`
      );
      expect(result).toEqual(err('Error occurred: failed'));
    });
  });

  describe('tryCatchAsync', () => {
    it('should return Ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(result).toEqual(ok(42));
    });

    it('should return Err for rejected async function', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('async failed');
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
        expect((result.error as Error).message).toBe('async failed');
      }
    });

    it('should map async error with custom mapper', async () => {
      const result = await tryCatchAsync(
        async () => {
          throw new Error('async failed');
        },
        (e) => `Async error: ${(e as Error).message}`
      );
      expect(result).toEqual(err('Async error: async failed'));
    });
  });

  describe('Real world examples', () => {
    it('should handle user registration flow', async () => {
      type User = { id: string; email: string };
      type AuthError = { type: string; message: string };

      const validateEmail = (email: string): Result<string, AuthError> => {
        if (!email.includes('@')) {
          return err({ type: 'VALIDATION_ERROR', message: 'Invalid email' });
        }
        return ok(email);
      };

      const checkUserExists = async (email: string): Promise<Result<void, AuthError>> => {
        // Simulate checking if user exists
        if (email === 'existing@example.com') {
          return err({ type: 'USER_EXISTS', message: 'User already exists' });
        }
        return ok(undefined);
      };

      const createUser = async (email: string): Promise<Result<User, AuthError>> => {
        // Simulate user creation
        return ok({ id: '123', email });
      };

      // Registration flow
      const register = async (email: string): Promise<Result<User, AuthError>> => {
        // Validate email
        const emailResult = validateEmail(email);
        if (isErr(emailResult)) return emailResult;

        // Check if user exists
        const existsResult = await checkUserExists(emailResult.value);
        if (isErr(existsResult)) return existsResult;

        // Create user
        return createUser(emailResult.value);
      };

      // Test successful registration
      const successResult = await register('new@example.com');
      expect(successResult).toEqual(ok({ id: '123', email: 'new@example.com' }));

      // Test invalid email
      const invalidResult = await register('invalid-email');
      expect(invalidResult).toEqual(
        err({ type: 'VALIDATION_ERROR', message: 'Invalid email' })
      );

      // Test existing user
      const existingResult = await register('existing@example.com');
      expect(existingResult).toEqual(
        err({ type: 'USER_EXISTS', message: 'User already exists' })
      );
    });

    it('should handle division with error handling', () => {
      const safeDivide = (a: number, b: number): Result<number, string> => {
        if (b === 0) return err('Division by zero');
        if (!isFinite(a) || !isFinite(b)) return err('Invalid numbers');
        return ok(a / b);
      };

      expect(safeDivide(10, 2)).toEqual(ok(5));
      expect(safeDivide(10, 0)).toEqual(err('Division by zero'));
      expect(safeDivide(Infinity, 2)).toEqual(err('Invalid numbers'));

      // Chain operations
      const result = flatMap(safeDivide(20, 2), (x) =>
        flatMap(safeDivide(x, 5), (y) => safeDivide(100, y))
      );
      expect(result).toEqual(ok(50)); // 20/2=10, 10/5=2, 100/2=50
    });
  });
});