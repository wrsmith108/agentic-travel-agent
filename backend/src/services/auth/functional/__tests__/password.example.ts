/**
 * Example usage of the functional password module
 * This demonstrates how to use the password operations with dependency injection
 */

import bcrypt from 'bcryptjs';
import {
  hashPassword,
  verifyPassword,
  createPasswordStorage,
  calculatePasswordStrength,
  createPasswordHasher,
  createPasswordVerifier,
  type BcryptDependency,
  type HashedPassword,
} from '../password';

// Create bcrypt dependency adapter
const bcryptAdapter: BcryptDependency = {
  hash: bcrypt.hash,
  compare: bcrypt.compare,
  genSalt: bcrypt.genSalt,
  getRounds: bcrypt.getRounds,
};

// Example 1: Direct usage with dependency injection
async function example1() {
  const plainPassword = 'MySecure@Password123';

  // Check password strength
  const strength = calculatePasswordStrength(plainPassword);
  console.log('Password strength:', strength);

  // Hash password
  const hashedPassword = await hashPassword(bcryptAdapter, plainPassword);
  console.log('Hashed password:', hashedPassword);

  // Verify password
  const isValid = await verifyPassword(bcryptAdapter, plainPassword, hashedPassword);
  console.log('Password valid:', isValid);

  // Create storage entry
  const storageEntry = createPasswordStorage('user123', hashedPassword);
  console.log('Storage entry:', storageEntry);
}

// Example 2: Using factory functions for cleaner code
async function example2() {
  // Create specialized functions with dependencies baked in
  const hasher = createPasswordHasher(bcryptAdapter);
  const verifier = createPasswordVerifier(bcryptAdapter);

  const plainPassword = 'AnotherSecure@Pass456';

  // Now we can use these functions without passing bcrypt each time
  const hashedPassword = await hasher(plainPassword);
  const isValid = await verifier(plainPassword, hashedPassword);

  console.log('Password hashed and verified:', isValid);
}

// Example 3: Integration with existing auth service
async function migrateExistingPassword(existingHash: string): Promise<HashedPassword> {
  // When loading from storage, we need to validate it's a proper hash
  if (!/^\$2[aby]\$\d{2}\$/.test(existingHash)) {
    throw new Error('Invalid password hash format in storage');
  }

  // Cast to branded type after validation
  return existingHash as HashedPassword;
}

// Example 4: Custom configuration
async function example4() {
  const customConfig = {
    saltRounds: 14, // Higher security
    minLength: 12,
    maxLength: 256,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  };

  const hasher = createPasswordHasher(bcryptAdapter, customConfig);
  const strongPassword = 'SuperSecure@Password2024!';

  const hash = await hasher(strongPassword);
  console.log('Hash with custom config:', hash);
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('=== Example 1: Direct Usage ===');
    await example1();

    console.log('\n=== Example 2: Factory Functions ===');
    await example2();

    console.log('\n=== Example 4: Custom Configuration ===');
    await example4();
  })().catch(console.error);
}
