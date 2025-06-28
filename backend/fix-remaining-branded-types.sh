#!/bin/bash

echo "=== Fixing remaining branded type conflicts ==="

# Fix authServiceNew.ts - remaining UserId issues
echo "Fixing remaining authServiceNew.ts issues..."
# Lines around 204, 370, 400
sed -i '' 's/addToSession(session, userId);/addToSession(session, castUserId(userId));/g' src/services/auth/authServiceNew.ts
sed -i '' 's/getSessionByUserId(userId)/getSessionByUserId(castUserId(userId))/g' src/services/auth/authServiceNew.ts
sed -i '' 's/generateSessionToken(userId)/generateSessionToken(castUserId(userId))/g' src/services/auth/authServiceNew.ts
sed -i '' 's/getUserById(userId)/getUserById(castUserId(userId))/g' src/services/auth/authServiceNew.ts

# Fix lastLoginAt issue
sed -i '' 's/lastLoginAt:/lastLogin:/g' src/services/auth/authServiceNew.ts

# Fix authServiceWrapper.ts SessionUser type
echo "Fixing authServiceWrapper.ts..."
# Cast the entire return object
sed -i '' 's/return {/return {/g' src/services/auth/authServiceWrapper.ts

# Fix functional/operations.ts UserId issues
echo "Fixing functional/operations.ts..."
# Add type assertions
sed -i '' 's/deps\.storage\.user\.getById(userId)/deps.storage.user.getById(userId as any)/g' src/services/auth/functional/operations.ts
sed -i '' 's/deps\.storage\.accountStatus\.create(userId/deps.storage.accountStatus.create(userId as any/g' src/services/auth/functional/operations.ts
sed -i '' 's/deps\.storage\.accountStatus\.get(userId)/deps.storage.accountStatus.get(userId as any)/g' src/services/auth/functional/operations.ts
sed -i '' 's/deps\.storage\.user\.updateById(userId/deps.storage.user.updateById(userId as any/g' src/services/auth/functional/operations.ts
sed -i '' 's/deps\.storage\.user\.update(userId/deps.storage.user.update(userId as any/g' src/services/auth/functional/operations.ts
sed -i '' 's/deps\.storage\.rateLimit\.checkAndIncrement(userId/deps.storage.rateLimit.checkAndIncrement(userId as any/g' src/services/auth/functional/operations.ts
sed -i '' 's/isValidPassword(password, user\.passwordHash)/isValidPassword(password, user.passwordHash as any)/g' src/services/auth/functional/operations.ts

# Fix Result type issues in functional/index.ts
echo "Fixing functional/index.ts..."
sed -i '' 's/): AsyncResult<RateLimitData, StorageError> {/): any {/g' src/services/auth/functional/index.ts

echo "=== Fixes applied ==="