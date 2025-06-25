# Functional Auth Service Architecture

## Overview

This directory contains the functional programming implementation of the authentication service. All modules follow pure functional principles with explicit dependencies and immutable data structures.

## Module Structure

### Core Modules

1. **types/** - Domain types and branded types
   - `core.ts` - Core domain types (UserId, SessionId, etc.)
   - `auth.ts` - Authentication-specific types
   - `errors.ts` - Error types using discriminated unions
   - `results.ts` - Result pattern implementation

2. **storage/** - Storage operations (side effects isolated here)
   - `password.ts` - Password storage operations
   - `session.ts` - Session storage operations
   - `tokens.ts` - Token storage (reset, verification)
   - `userAccount.ts` - Account status storage

3. **operations/** - Business logic (pure functions)
   - `register.ts` - User registration logic
   - `login.ts` - User login logic
   - `logout.ts` - User logout logic
   - `password.ts` - Password management operations
   - `session.ts` - Session management operations
   - `validation.ts` - Input validation functions

4. **security/** - Security-related functions
   - `hashing.ts` - Password hashing operations
   - `rateLimiting.ts` - Rate limiting logic
   - `tokens.ts` - Token generation and validation
   - `jwt.ts` - JWT operations

5. **utils/** - Utility functions
   - `result.ts` - Result pattern utilities
   - `validation.ts` - Validation helpers
   - `time.ts` - Time-related utilities
   - `crypto.ts` - Cryptographic utilities

6. **session/** - Session management
   - `manager.ts` - Session lifecycle management
   - `storage.ts` - Session storage interface
   - `validation.ts` - Session validation

## Dependency Flow

```
┌─────────────┐
│   index.ts  │ ◄── Public API
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│ operations/ │ ◄───┤ Deps Injected│
└──────┬──────┘     └──────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   storage/  │     │  security/   │     │    utils/    │
└─────────────┘     └──────────────┘     └──────────────┘
       │                   │                     │
       └───────────────────┴─────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    types/   │
                    └─────────────┘
```

## Interface Contracts

### Storage Interfaces

```typescript
type PasswordStorageOps = {
  store: (userId: UserId, hash: HashedPassword) => Promise<Result<void, StorageError>>;
  retrieve: (userId: UserId) => Promise<Result<HashedPassword, StorageError>>;
  delete: (userId: UserId) => Promise<Result<void, StorageError>>;
};

type SessionStorageOps = {
  create: (session: SessionData) => Promise<Result<SessionId, StorageError>>;
  get: (sessionId: SessionId) => Promise<Result<SessionData, StorageError>>;
  update: (sessionId: SessionId, data: Partial<SessionData>) => Promise<Result<void, StorageError>>;
  delete: (sessionId: SessionId) => Promise<Result<void, StorageError>>;
  findByUserId: (userId: UserId) => Promise<Result<SessionData[], StorageError>>;
};
```

### Operation Interfaces

```typescript
type AuthOperations = {
  register: (data: unknown) => Promise<Result<AuthSuccess, AuthError>>;
  login: (data: unknown) => Promise<Result<AuthSuccess, AuthError>>;
  logout: (sessionId: SessionId) => Promise<Result<void, AuthError>>;
  validateSession: (sessionId: SessionId) => Promise<Result<SessionUser, AuthError>>;
  resetPassword: (data: unknown) => Promise<Result<void, AuthError>>;
  changePassword: (userId: UserId, data: unknown) => Promise<Result<void, AuthError>>;
};
```

## Functional Principles

1. **Pure Functions**: All business logic functions are pure
2. **Immutability**: All data structures are immutable
3. **Explicit Dependencies**: Dependencies injected, not imported
4. **Composability**: Small functions that compose into larger operations
5. **Error Handling**: Explicit error handling with Result pattern
6. **No Side Effects**: Side effects isolated to storage layer

## Migration Strategy

1. Implement all modules in parallel with existing code
2. Maintain backward compatibility through adapter layer
3. Gradually migrate consumers to new API
4. Remove old implementation once migration complete
