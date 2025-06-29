// Generic type guards for common patterns

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

export function hasProperties<T extends object, K extends PropertyKey>(
  obj: T,
  ...keys: K[]
): obj is T & Record<K, unknown> {
  return keys.every(key => key in obj);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    value instanceof Promise ||
    (isObject(value) && 'then' in value && isFunction(value.then))
  );
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// Array type guards
export function isNonEmptyArray<T>(value: T[]): value is [T, ...T[]] {
  return value.length > 0;
}

export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(guard);
}

// Object type guards
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Utility type guard creators
export function createEnumGuard<T extends string | number>(
  enumObject: Record<string, T>
): (value: unknown) => value is T {
  const values = new Set(Object.values(enumObject));
  return (value: unknown): value is T => values.has(value as T);
}

export function createLiteralGuard<T extends string | number | boolean>(
  ...literals: T[]
): (value: unknown) => value is T {
  const literalSet = new Set(literals);
  return (value: unknown): value is T => literalSet.has(value as T);
}

// Complex type guards
export function isRecord(
  value: unknown
): value is Record<string | number | symbol, unknown> {
  return isObject(value);
}

export function isRecordOf<K extends PropertyKey, V>(
  value: unknown,
  keyGuard: (key: unknown) => key is K,
  valueGuard: (value: unknown) => value is V
): value is Record<K, V> {
  if (!isRecord(value)) return false;
  
  return Object.entries(value).every(([key, val]) => 
    keyGuard(key) && valueGuard(val)
  );
}

// Assertion functions (for use with TypeScript 3.7+)
export function assertDefined<T>(
  value: T | undefined,
  message = 'Value is undefined'
): asserts value is T {
  if (value === undefined) {
    throw new Error(message);
  }
}

export function assertNonNull<T>(
  value: T | null,
  message = 'Value is null'
): asserts value is T {
  if (value === null) {
    throw new Error(message);
  }
}

export function assertPresent<T>(
  value: T | null | undefined,
  message = 'Value is null or undefined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}