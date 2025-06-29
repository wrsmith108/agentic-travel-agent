// Central export point for all type utilities

export * from './brands';
export * from './dates';
export * from './guards';
export * from './result-helpers';

// Re-export commonly used types
export type { Result, Ok, Err } from '../result';
export { ok, err, isOk, isErr } from '../result';

// Utility types
export type Nullable<T> = T | null | undefined;
export type NonEmptyArray<T> = [T, ...T[]];
export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};
export type Exact<T, U> = T & Record<Exclude<keyof U, keyof T>, never>;

// Common type predicates
export type Predicate<T> = (value: T) => boolean;
export type TypeGuard<T, S extends T> = (value: T) => value is S;

// Function types
export type AsyncFunction<T, R> = (arg: T) => Promise<R>;
export type SyncFunction<T, R> = (arg: T) => R;
export type VoidFunction = () => void;
export type AsyncVoidFunction = () => Promise<void>;

// Object key types
export type ObjectKeys<T> = keyof T;
export type ObjectValues<T> = T[keyof T];
export type ObjectEntries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T];

// Conditional types
export type If<C extends boolean, T, F> = C extends true ? T : F;
export type IsAny<T> = 0 extends 1 & T ? true : false;
export type IsNever<T> = [T] extends [never] ? true : false;
export type IsUnknown<T> = IsAny<T> extends true
  ? false
  : unknown extends T
  ? true
  : false;

// String manipulation types
export type Trim<S extends string> = S extends ` ${infer T}`
  ? Trim<T>
  : S extends `${infer T} `
  ? Trim<T>
  : S;

export type Split<
  S extends string,
  D extends string
> = S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

// Tuple types
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];
export type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;

// Promise types
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type PromiseValue<T> = T extends Promise<infer U> ? U : never;

// Error handling types
export type ErrorOr<T> = T | Error;
export type MaybeError<T> = { success: true; value: T } | { success: false; error: Error };

// Validation types
export type ValidationError = {
  field: string;
  message: string;
  value?: unknown;
};

export type ValidationResult<T> = 
  | { valid: true; data: T }
  | { valid: false; errors: ValidationError[] };