# Password Module Integration Guide

## Overview

The functional password module (`password.ts`) provides pure functions for password operations with dependency injection. This guide shows how to integrate it with the existing `authService.ts`.

## Key Benefits

1. **Type Safety**: Uses branded `HashedPassword` type to prevent mixing plain and hashed passwords
2. **Testability**: Pure functions with dependency injection make testing easier
3. **Flexibility**: Configurable password requirements and salt rounds
4. **Security**: Built-in password strength calculation and history tracking

## Integration Steps

### 1. Import the Module

```typescript
import bcrypt from 'bcryptjs';
import {
  createPasswordHasher,
  createPasswordVerifier,
  createPasswordStorage,
  type BcryptDependency,
  type HashedPassword,
} from './functional/password';
```

### 2. Create Bcrypt Adapter

```typescript
const bcryptAdapter: BcryptDependency = {
  hash: bcrypt.hash,
  compare: bcrypt.compare,
  genSalt: bcrypt.genSalt,
  getRounds: bcrypt.getRounds,
};
```

### 3. Initialize Password Functions in AuthService

```typescript
class AuthService {
  private readonly hashPassword: (password: string) => Promise<HashedPassword>;
  private readonly verifyPassword: (password: string, hash: HashedPassword) => Promise<boolean>;

  constructor() {
    // Initialize password functions
    this.hashPassword = createPasswordHasher(bcryptAdapter);
    this.verifyPassword = createPasswordVerifier(bcryptAdapter);
    // ... rest of constructor
  }
}
```

### 4. Replace Existing Password Operations

#### Before (Current Implementation):

```typescript
// In registerUser method
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(registerRequest.password, saltRounds);
await this.storeUserPassword(userProfile.id, hashedPassword);
```

#### After (Using Functional Module):

```typescript
// In registerUser method
const hashedPassword = await this.hashPassword(registerRequest.password);
const passwordStorage = createPasswordStorage(userProfile.id, hashedPassword);
await this.storeUserPassword(passwordStorage);
```

#### Before (Password Verification):

```typescript
// In loginUser method
const passwordValid = await bcrypt.compare(loginRequest.password, storedPasswordHash);
```

#### After (Using Functional Module):

```typescript
// In loginUser method
const hashedPassword = storedPasswordHash as HashedPassword; // After validation
const passwordValid = await this.verifyPassword(loginRequest.password, hashedPassword);
```

### 5. Update Password Storage Methods

```typescript
private async storeUserPassword(storage: PasswordStorageEntry): Promise<void> {
  // Store the complete storage object instead of just the hash
  this.passwordStorage.set(storage.userId, storage);
}

private async getUserPasswordHash(userId: string): Promise<HashedPassword | null> {
  const storage = this.passwordStorage.get(userId);
  return storage?.hash || null;
}
```

## Migration Strategy

1. **Phase 1**: Add the functional module without removing existing code
2. **Phase 2**: Create adapter methods that use the new functions internally
3. **Phase 3**: Gradually replace direct bcrypt calls with functional alternatives
4. **Phase 4**: Remove old password handling code

## Testing Benefits

With the functional approach, testing becomes much easier:

```typescript
// Mock bcrypt for testing
const mockBcrypt: BcryptDependency = {
  hash: jest.fn().mockResolvedValue('$2a$12$mockedHash'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('$2a$12$mockedSalt'),
  getRounds: jest.fn().mockReturnValue(12),
};

// Test password operations without actual bcrypt
const hasher = createPasswordHasher(mockBcrypt);
const hash = await hasher('testPassword');
expect(mockBcrypt.hash).toHaveBeenCalledWith('testPassword', 12);
```

## Advanced Features

### Password Strength Feedback

```typescript
import { calculatePasswordStrength } from './functional/password';

// In registration endpoint
const strength = calculatePasswordStrength(registerRequest.password);
if (strength.strength === 'weak') {
  return createAuthError('VALIDATION_ERROR', 'Password is too weak', {
    feedback: strength.feedback,
  });
}
```

### Password History

```typescript
import { wasPasswordPreviouslyUsed, addToPasswordHistory } from './functional/password';

// Check if password was used before
const history = await this.getPasswordHistory(userId);
const wasUsed = await wasPasswordPreviouslyUsed(bcryptAdapter, newPassword, history);

if (wasUsed) {
  return { success: false, message: 'Password was previously used' };
}
```

## Configuration

The module supports custom configuration:

```typescript
const customConfig = {
  saltRounds: 14, // Increase for higher security
  minLength: 10,
  maxLength: 256,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

const hasher = createPasswordHasher(bcryptAdapter, customConfig);
```

## Next Steps

1. Create unit tests for the password module
2. Add password history storage to the database layer
3. Implement password expiration policies
4. Add support for argon2 as an alternative to bcrypt
