# TypeScript Developer Guidelines

## 🎯 Purpose
Prevent type errors before they happen by following consistent patterns and best practices.

## 🚨 Golden Rules

1. **Never use `any`** - Use `unknown` and narrow the type
2. **Always use type guards** - Never access properties directly on union types
3. **Prefer immutability** - Use `readonly` and `const` assertions
4. **Type first, code second** - Define interfaces before implementation
5. **Fail at compile time** - Not at runtime

## 📋 Quick Reference Checklist

Before committing code, ensure:
- [ ] No `any` types (use `unknown` instead)
- [ ] All functions have explicit return types
- [ ] All parameters have type annotations
- [ ] Result pattern used for all async operations
- [ ] Type guards used before property access
- [ ] Dates stored as ISO strings, not Date objects
- [ ] All types exported from their modules
- [ ] No type assertions (`as`) without justification

## 🔧 Common Patterns

### 1. Result Pattern Usage
```typescript
// ❌ BAD - Throws errors
async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id);
  if (!user) throw new Error('Not found');
  return user;
}

// ✅ GOOD - Returns Result
async function getUser(id: UserId): Promise<Result<User, AppError>> {
  const result = await db.findUser(id);
  if (isErr(result)) {
    return result;
  }
  
  if (!result.value) {
    return err({
      name: 'NotFoundError',
      message: 'User not found',
      code: 'USER_NOT_FOUND',
      statusCode: 404
    });
  }
  
  return ok(result.value);
}
```

### 2. Type Guard Before Access
```typescript
// ❌ BAD - Direct property access
function processResult(result: Result<User, AppError>) {
  if (result.error) {  // Error: property doesn't exist
    console.log(result.error.message);
  }
  return result.value.name;  // Error: might not exist
}

// ✅ GOOD - Type guard first
function processResult(result: Result<User, AppError>): string {
  if (isErr(result)) {
    console.log(result.error.message);
    return 'Unknown';
  }
  return result.value.name;
}
```

### 3. Date Handling
```typescript
// ❌ BAD - Mixed Date types
interface User {
  createdAt: Date | string;  // Ambiguous!
}

// ✅ GOOD - Consistent string type
interface User {
  createdAt: ISODateString;  // Always ISO string
}

// Conversion utilities
const user: User = {
  createdAt: dateUtils.toISO(new Date())
};

// Parse when needed
const date = dateUtils.fromISO(user.createdAt);
```

### 4. Null/Undefined Handling
```typescript
// ❌ BAD - Assumes value exists
function getName(user: User | undefined): string {
  return user.name;  // Error: might be undefined
}

// ✅ GOOD - Explicit checks
function getName(user: User | undefined): string {
  if (!user) {
    return 'Guest';
  }
  return user.name;
}

// ✅ BETTER - Optional chaining
function getName(user: User | undefined): string {
  return user?.name ?? 'Guest';
}
```

### 5. Array Access Safety
```typescript
// ❌ BAD - Unsafe array access
const firstUser = users[0];
console.log(firstUser.name);  // Might crash!

// ✅ GOOD - Safe access
const firstUser = users[0];
if (firstUser) {
  console.log(firstUser.name);
}

// ✅ BETTER - With noUncheckedIndexedAccess
const firstUser = users.at(0);
if (firstUser) {
  console.log(firstUser.name);
}
```

### 6. Type Exports
```typescript
// ❌ BAD - Types not exported
// userService.ts
interface UserFilters {
  active?: boolean;
  role?: string;
}

export class UserService {
  find(filters: UserFilters) { ... }
}

// ✅ GOOD - Export what consumers need
export interface UserFilters {
  active?: boolean;
  role?: string;
}

export class UserService {
  find(filters: UserFilters) { ... }
}
```

### 7. Discriminated Unions
```typescript
// ❌ BAD - Ambiguous state
interface Response {
  data?: User;
  error?: Error;
  loading?: boolean;
}

// ✅ GOOD - Clear states
type Response = 
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: Error };

function handleResponse(response: Response) {
  switch (response.status) {
    case 'loading':
      return 'Loading...';
    case 'success':
      return response.data.name;
    case 'error':
      return response.error.message;
  }
}
```

### 8. Branded Types
```typescript
// ❌ BAD - Primitive confusion
function transfer(fromId: string, toId: string, amount: number) {
  // Easy to mix up parameters!
}

// ✅ GOOD - Type safety with brands
function transfer(
  from: UserId, 
  to: UserId, 
  amount: Money
): Result<Transaction, AppError> {
  // Can't accidentally swap parameters
}

// Usage
const result = transfer(
  userId('user123'),
  userId('user456'),
  money(100.50)
);
```

## 🛠️ Type Utilities to Use

### Built-in Utilities
```typescript
// Extract return type
type UserResponse = Awaited<ReturnType<typeof getUser>>;

// Make all properties optional
type PartialUser = Partial<User>;

// Make all properties required
type RequiredUser = Required<User>;

// Pick specific properties
type UserSummary = Pick<User, 'id' | 'name' | 'email'>;

// Omit properties
type UserWithoutPassword = Omit<User, 'password'>;

// Make properties readonly
type ReadonlyUser = Readonly<User>;
```

### Custom Type Helpers
```typescript
// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// Nullable (T | null | undefined)
type Nullable<T> = T | null | undefined;

// NonEmptyArray
type NonEmptyArray<T> = [T, ...T[]];

// Exact type (no excess properties)
type Exact<T, U> = T & Record<Exclude<keyof U, keyof T>, never>;
```

## 📝 Code Review Checklist

When reviewing TypeScript code, check for:

### Type Safety
- [ ] No `any` types without justification
- [ ] All function parameters typed
- [ ] All function return types explicit
- [ ] No unchecked type assertions

### Error Handling
- [ ] Result pattern used for fallible operations
- [ ] Type guards before property access
- [ ] No direct throws in business logic
- [ ] Consistent error shapes (AppError)

### Data Types
- [ ] Dates stored as ISO strings
- [ ] Branded types for domain concepts
- [ ] No primitive obsession
- [ ] Clear null/undefined handling

### Module Organization
- [ ] Types exported from modules
- [ ] No circular dependencies
- [ ] Clear module boundaries
- [ ] Types co-located with implementation

## 🚀 Getting Started Template

When creating a new module:

```typescript
// types.ts
import { Result } from '@/utils/result';
import { AppError } from '@/types/errors';
import { UserId, ISODateString } from '@/utils/types/brands';

export interface CreateUserDto {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface UserService {
  create(data: CreateUserDto): Promise<Result<User, AppError>>;
  findById(id: UserId): Promise<Result<User, AppError>>;
  update(id: UserId, data: Partial<CreateUserDto>): Promise<Result<User, AppError>>;
  delete(id: UserId): Promise<Result<void, AppError>>;
}
```

## 🎓 Learning Resources

1. **TypeScript Handbook**: Official documentation
2. **Type Challenges**: Practice advanced types
3. **Team Patterns Doc**: Our specific patterns
4. **Code Examples**: Look at well-typed modules

## ⚡ Quick Fixes

### "Property does not exist on type"
```typescript
// Check if using type guard
if (isErr(result)) {
  console.log(result.error);  // Now safe
}
```

### "Type 'string' is not assignable to type 'Date'"
```typescript
// Convert consistently
const date = dateUtils.fromISO(dateString);
```

### "Cannot find name 'X'"
```typescript
// Export the type from module
export type { X } from './types';
```

### "Object is possibly 'null' or 'undefined'"
```typescript
// Use optional chaining or guards
const name = user?.profile?.name ?? 'Unknown';
```

## 🏁 Summary

Following these guidelines will:
- Prevent 90% of type errors
- Make code self-documenting
- Catch bugs at compile time
- Improve IDE autocomplete
- Make refactoring safer

Remember: **If TypeScript complains, it's trying to save you from a runtime error!**