# Functional Programming Refactor Plan

## Overview
This document outlines the plan to refactor the codebase from class-based OOP to functional programming, following the development guidelines from citypaul/.dotfiles.

## Phase 1: Convert AuthService to Functional Module

### Current Structure (Class-based)
```typescript
class AuthService {
  private userDataManager: UserDataManager;
  private passwordStorage: Map<string, string>;
  // ... other private fields
  
  constructor(userDataManager?: UserDataManager) { ... }
  
  async registerUser(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> { ... }
  async loginUser(data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> { ... }
  // ... other methods
}

export const authService = new AuthService();
```

### Target Structure (Functional)
```typescript
// auth/types.ts - Domain types
export type UserId = string & { readonly brand: unique symbol };
export type SessionId = string & { readonly brand: unique symbol };
export type HashedPassword = string & { readonly brand: unique symbol };

// auth/storage.ts - Storage operations
const passwordStorage = new Map<UserId, HashedPassword>();

export const storeUserPassword = async (userId: UserId, hashedPassword: HashedPassword): Promise<void> => {
  passwordStorage.set(userId, hashedPassword);
};

export const getUserPasswordHash = async (userId: UserId): Promise<HashedPassword | null> => {
  return passwordStorage.get(userId) || null;
};

// auth/operations.ts - Business logic
export const registerUser = (userDataManager: UserDataManagerOps) => 
  async (data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> => {
    // Implementation
  };

export const loginUser = (userDataManager: UserDataManagerOps) => 
  async (data: unknown): Promise<AuthSuccessResponse | AuthErrorResponse> => {
    // Implementation
  };

// auth/index.ts - Public API
import { getUserDataManagerOps } from '@/services/storage';

const userDataOps = getUserDataManagerOps();

export const auth = {
  register: registerUser(userDataOps),
  login: loginUser(userDataOps),
  logout: logoutUser(userDataOps),
  // ... other operations
};
```

### Benefits
- Explicit dependencies
- Easier to test (can inject mocks)
- Better tree-shaking
- Follows functional programming principles

## Phase 2: Convert UserDataManager to Functional Module ✅ COMPLETE

### Current Structure
```typescript
class UserDataManager {
  private dataDir: string;
  
  async createUser(userData: CreateUserProfile): Promise<UserProfile> { ... }
  async readUserData(userId: string): Promise<UserProfile | null> { ... }
  // ... other methods
}
```

### Target Structure
```typescript
// storage/types.ts
export type UserDataManagerOps = {
  createUser: (userData: CreateUserProfile) => Promise<UserProfile>;
  readUserData: (userId: UserId) => Promise<UserProfile | null>;
  updateUserData: (userId: UserId, updates: Partial<UserProfile>) => Promise<UserProfile>;
  deleteUser: (userId: UserId) => Promise<boolean>;
  findUserByEmail: (email: Email) => Promise<UserProfile | null>;
};

// storage/fileOperations.ts
const createFileOps = (dataDir: string) => ({
  writeUser: async (userId: UserId, data: UserProfile): Promise<void> => { ... },
  readUser: async (userId: UserId): Promise<UserProfile | null> => { ... },
  deleteUser: async (userId: UserId): Promise<boolean> => { ... },
});

// storage/userDataManager.ts
export const createUserDataManagerOps = (dataDir: string): UserDataManagerOps => {
  const fileOps = createFileOps(dataDir);
  
  return {
    createUser: async (userData: CreateUserProfile): Promise<UserProfile> => {
      // Implementation using fileOps
    },
    readUserData: async (userId: UserId): Promise<UserProfile | null> => {
      // Implementation using fileOps
    },
    // ... other operations
  };
};

// storage/index.ts
export const getUserDataManagerOps = (): UserDataManagerOps => {
  const dataDir = env.USER_DATA_DIR || path.join(process.cwd(), 'user-data');
  return createUserDataManagerOps(dataDir);
};
```

## Phase 3: Implement Result Pattern ✅ COMPLETE

### Define Result Type
```typescript
// utils/result.ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

// Utility functions
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => isOk(result) ? ok(fn(result.value)) : result;

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => isOk(result) ? fn(result.value) : result;

export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => isErr(result) ? err(fn(result.error)) : result;
```

### Update Auth Operations to Use Result
```typescript
// auth/types.ts
export type AuthError = 
  | { type: 'INVALID_CREDENTIALS'; message: string }
  | { type: 'USER_NOT_FOUND'; message: string }
  | { type: 'USER_ALREADY_EXISTS'; message: string }
  | { type: 'VALIDATION_ERROR'; message: string; details?: unknown }
  | { type: 'SERVER_ERROR'; message: string };

export type AuthSuccess = {
  user: SessionUser;
  sessionId: SessionId;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
};

// auth/operations.ts
export const registerUser = (userDataManager: UserDataManagerOps) => 
  async (data: unknown): Promise<Result<AuthSuccess, AuthError>> => {
    // Validate input
    const validationResult = validateRegisterRequest(data);
    if (isErr(validationResult)) {
      return err({
        type: 'VALIDATION_ERROR',
        message: validationResult.error.message,
        details: validationResult.error.details
      });
    }
    
    const registerData = validationResult.value;
    
    // Check if user exists
    const existingUser = await userDataManager.findUserByEmail(registerData.email);
    if (existingUser) {
      return err({
        type: 'USER_ALREADY_EXISTS',
        message: 'An account with this email address already exists'
      });
    }
    
    // Continue with registration...
    // Return ok(authSuccess) on success
  };
```

### Update Routes to Handle Results
```typescript
// routes/auth.ts
router.post('/register', async (req, res) => {
  const result = await auth.register(req.body);
  
  if (isOk(result)) {
    res.status(201).json({
      success: true,
      data: result.value
    });
  } else {
    const statusCode = getStatusCodeFromError(result.error);
    res.status(statusCode).json({
      success: false,
      error: result.error
    });
  }
});
```

## Testing Strategy for MVP

### Current Approach (Keep for MVP)
```typescript
// Tests can still access internals for MVP
jest.spyOn(authService as any, 'storeUserPassword').mockImplementation(...);
```

### Production Approach (Future)
```typescript
// Test only through public API
const result = await auth.register(validUserData);
expect(isOk(result)).toBe(true);
```

### Add Testing Notes
```typescript
// auth/__tests__/auth.test.ts
/**
 * MVP Testing Note:
 * These tests currently access private implementation details for comprehensive testing.
 * For production, refactor to test only through public API as per TDD best practices.
 */
```

## Migration Steps

### Step 1: Create new functional modules alongside existing classes
1. Create `auth/functional/` directory
2. Implement functional versions without breaking existing code
3. Add comprehensive tests for new modules

### Step 2: Update consumers gradually
1. Update routes to use new functional API
2. Update middleware to use new patterns
3. Maintain backward compatibility during transition

### Step 3: Remove old class-based code
1. Once all consumers updated, remove old classes
2. Move functional code to main directories
3. Update all imports

## Benefits of This Approach
1. **Testability**: Pure functions are easier to test
2. **Composability**: Functions can be composed together
3. **Type Safety**: Result pattern makes error handling explicit
4. **Maintainability**: Smaller, focused functions
5. **Performance**: Better tree-shaking, no class overhead

## Timeline Estimate
- Phase 1 (AuthService): 2-3 hours
- Phase 2 (UserDataManager): 2-3 hours  
- Phase 3 (Result Pattern): 3-4 hours
- Testing & Integration: 2-3 hours
- Total: ~10-13 hours

## Notes
- Keep existing tests working during refactor
- Commit each phase separately
- Run full test suite after each phase
- Document any API changes clearly