# TypeScript Strict Mode Migration Plan

## Executive Summary
This document outlines a phased approach to enable TypeScript strict mode and prevent future type errors. The goal is to achieve type safety while maintaining development velocity.

## Migration Philosophy
- **Incremental Progress**: Enable settings gradually to avoid overwhelming errors
- **Fix Forward**: Don't suppress errors, fix them properly
- **Team Alignment**: Everyone follows the same type patterns
- **Automated Enforcement**: Let tools catch issues before PR

## Phase 1: Immediate Actions (Week 1)

### 1.1 Create Type Utilities Library
```typescript
// src/utils/types/index.ts
export * from './brands';
export * from './dates';
export * from './guards';
export * from './result-helpers';
```

#### Brand Types (src/utils/types/brands.ts)
```typescript
// Prevent primitive type confusion
export type UserId = string & { __brand: 'UserId' };
export type Email = string & { __brand: 'Email' };
export type SessionId = string & { __brand: 'SessionId' };
export type ISODateString = string & { __brand: 'ISODate' };
export type UnixTimestamp = number & { __brand: 'UnixTime' };

// Factory functions
export const userId = (id: string): UserId => id as UserId;
export const email = (str: string): Email => str as Email;
export const sessionId = (id: string): SessionId => id as SessionId;
export const isoDate = (date: Date | string): ISODateString => {
  if (typeof date === 'string') return date as ISODateString;
  return date.toISOString() as ISODateString;
};
export const unixTime = (ms: number): UnixTimestamp => ms as UnixTimestamp;
```

#### Date Utilities (src/utils/types/dates.ts)
```typescript
import { ISODateString, UnixTimestamp } from './brands';

export const dateUtils = {
  toISO: (date: Date): ISODateString => date.toISOString() as ISODateString,
  fromISO: (iso: ISODateString): Date => new Date(iso),
  toUnix: (date: Date): UnixTimestamp => date.getTime() as UnixTimestamp,
  fromUnix: (unix: UnixTimestamp): Date => new Date(unix),
  
  // Safe conversions
  ensureISO: (value: Date | string | undefined): ISODateString | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value as ISODateString;
    return value.toISOString() as ISODateString;
  }
};
```

#### Type Guards (src/utils/types/guards.ts)
```typescript
export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return key in obj;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}
```

#### Result Helpers (src/utils/types/result-helpers.ts)
```typescript
import { Result, ok, err, isOk, isErr } from '../result';

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

export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

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
```

### 1.2 Enable noImplicitAny (Day 1-2)
```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    // Keep other settings as false for now
  }
}
```

**Fix Pattern:**
```typescript
// Before
function process(data) { ... }

// After
function process(data: unknown) { ... }
// or with proper type
function process(data: UserData) { ... }
```

### 1.3 Fix Top Error Categories (Day 3-5)
1. Export missing types from modules
2. Add type annotations to function parameters
3. Replace property access with type-guarded access
4. Fix date/string conversions using utilities

## Phase 2: Type Safety Enforcement (Week 2)

### 2.1 Enable strictNullChecks
```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Fix Pattern:**
```typescript
// Before
const user = users.find(u => u.id === id);
return user.name; // Error: user might be undefined

// After
const user = users.find(u => u.id === id);
if (!user) {
  return err(new Error('User not found'));
}
return ok(user.name);
```

### 2.2 Enable noUnusedLocals and noUnusedParameters
```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 2.3 Create ESLint Rules
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
  }
};
```

## Phase 3: Full Strict Mode (Week 3)

### 3.1 Enable Remaining Strict Settings
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true
  }
}
```

### 3.2 Type Coverage Requirements
- Minimum 95% type coverage
- No implicit any
- All public APIs fully typed
- Type tests for complex types

## Developer Guidelines

### Type-First Development
1. **Write types before implementation**
   ```typescript
   // 1. Define the contract
   interface UserService {
     findById(id: UserId): Promise<Result<User, AppError>>;
     create(data: CreateUserDto): Promise<Result<User, AppError>>;
   }
   
   // 2. Implement with type safety
   class UserServiceImpl implements UserService {
     // Implementation guided by types
   }
   ```

2. **Use discriminated unions for state**
   ```typescript
   type LoadingState<T> = 
     | { status: 'idle' }
     | { status: 'loading' }
     | { status: 'success'; data: T }
     | { status: 'error'; error: Error };
   ```

3. **Prefer readonly and const**
   ```typescript
   interface User {
     readonly id: UserId;
     readonly email: Email;
     readonly createdAt: ISODateString;
   }
   ```

### Common Patterns

#### Pattern: Safe Property Access
```typescript
// Bad
const name = user.profile.name; // Might throw

// Good
const name = user.profile?.name ?? 'Unknown';
```

#### Pattern: Type Narrowing
```typescript
// Bad
if (result.error) { ... }

// Good
if (isErr(result)) {
  // TypeScript knows result.error exists here
}
```

#### Pattern: Exhaustive Checks
```typescript
function handleState(state: LoadingState<User>): string {
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'loading':
      return 'Loading...';
    case 'success':
      return `User: ${state.data.name}`;
    case 'error':
      return `Error: ${state.error.message}`;
    default:
      // This ensures we handle all cases
      const _exhaustive: never = state;
      return _exhaustive;
  }
}
```

## Automation and Tooling

### Pre-commit Hook
```bash
#!/bin/sh
# .husky/pre-commit

npm run typecheck || {
  echo "❌ Type errors found. Fix them before committing."
  exit 1
}

npm run lint || {
  echo "❌ Lint errors found. Run 'npm run lint:fix'"
  exit 1
}
```

### CI/CD Integration
```yaml
# .github/workflows/typecheck.yml
name: Type Check
on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
```

### Type Coverage Reporting
```json
{
  "scripts": {
    "type-coverage": "type-coverage --detail --strict"
  }
}
```

## Migration Checklist

### Week 1
- [ ] Create type utilities library
- [ ] Enable noImplicitAny
- [ ] Fix function parameter types
- [ ] Export missing types
- [ ] Document patterns in team wiki

### Week 2
- [ ] Enable strictNullChecks
- [ ] Fix nullable access patterns
- [ ] Enable unused checks
- [ ] Setup ESLint rules
- [ ] Add pre-commit hooks

### Week 3
- [ ] Enable full strict mode
- [ ] Fix remaining errors
- [ ] Add type coverage reporting
- [ ] Update CI/CD pipeline
- [ ] Team training session

## Success Metrics
- 0 TypeScript errors in strict mode
- 95%+ type coverage
- 50% reduction in runtime errors
- 80% faster bug detection
- 100% of team following patterns

## Long-term Maintenance
1. **Monthly type debt review**
2. **Quarterly tooling updates**
3. **Type pattern documentation**
4. **New developer onboarding**
5. **Performance monitoring**

## Conclusion
Enabling strict mode is not just about fixing errors—it's about establishing a culture of type safety that prevents future issues and makes the codebase more maintainable, refactorable, and reliable.