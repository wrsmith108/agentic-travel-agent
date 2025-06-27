# Password Storage Migration Notes

## Issue Fixed
Previously, passwords were stored in memory only, causing login failures after server restarts. This has been fixed by storing password hashes in the user data files.

## Changes Made
1. Added `passwordHash` field to UserProfileSchema in `/src/schemas/user.ts`
2. Updated authentication service to store password hashes with user data during registration
3. Updated login process to read password hashes from user data files
4. Maintained backward compatibility for existing users

## Impact on Existing Users
- **New users** (registered after the fix): Passwords persist across server restarts ✅
- **Existing users** (registered before the fix): Cannot log in because they have no stored password hash ⚠️

## Migration Options for Existing Users

### Option 1: Re-register
Users can create a new account with a different email address.

### Option 2: Use Password Reset
If password reset emails are configured, users can:
1. Click "Forgot Password"
2. Receive reset token
3. Set new password (which will be stored persistently)

### Option 3: Manual Migration Script
For development/testing, you can manually add password hashes to existing user files:

```bash
# Example: Add password hash for test@example.com
# Password: TestPass123!
# Hash: $2a$10$YourHashHere...

# Edit the user file and add the passwordHash field after the email field
```

### Option 4: Automated Migration
Create a one-time migration script that:
1. Prompts for user email and new password
2. Hashes the password
3. Updates the user data file

## Testing Password Persistence

```bash
# Test new user registration and persistence
npx tsx src/utils/testPasswordPersistence.ts

# Test login after restart
npx tsx src/utils/testLoginOnly.ts "email@example.com" "password"
```

## Security Note
Password hashes are stored using bcrypt with 10 salt rounds, providing secure one-way encryption.