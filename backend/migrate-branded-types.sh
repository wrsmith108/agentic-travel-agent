#!/bin/bash

echo "=== Migrating branded types to single source ==="

# Step 1: Update imports in all files to use the canonical source
echo "Step 1: Updating imports..."

# Find all TypeScript files that import branded types from non-canonical locations
find src -name "*.ts" -type f | while read file; do
  # Skip the canonical file itself
  if [[ "$file" == "src/types/brandedTypes.ts" ]]; then
    continue
  fi
  
  # Replace imports from auth/functional/types
  sed -i '' 's|from '\''\.*/auth/functional/types'\''|from '\''@/types/brandedTypes'\''|g' "$file"
  sed -i '' 's|from "\.*/auth/functional/types"|from "@/types/brandedTypes"|g' "$file"
  
  # Replace imports from auth/functional/types/core
  sed -i '' 's|from '\''\.*/auth/functional/types/core'\''|from '\''@/types/brandedTypes'\''|g' "$file"
  sed -i '' 's|from "\.*/auth/functional/types/core"|from "@/types/brandedTypes"|g' "$file"
  
  # Replace imports from storage/functional/types
  sed -i '' 's|from '\''\.*/storage/functional/types'\''|from '\''@/types/brandedTypes'\''|g' "$file"
  sed -i '' 's|from "\.*/storage/functional/types"|from "@/types/brandedTypes"|g' "$file"
  
  # Replace imports from utils/jwt
  sed -i '' 's|AccessToken.*from '\''\.*/utils/jwt'\''|AccessToken from '\''@/types/brandedTypes'\''|g' "$file"
  sed -i '' 's|RefreshToken.*from '\''\.*/utils/jwt'\''|RefreshToken from '\''@/types/brandedTypes'\''|g' "$file"
  
  # Replace imports from types/conversation
  sed -i '' 's|ConversationId.*from '\''\.*/types/conversation'\''|ConversationId from '\''@/types/brandedTypes'\''|g' "$file"
  sed -i '' 's|MessageId.*from '\''\.*/types/conversation'\''|MessageId from '\''@/types/brandedTypes'\''|g' "$file"
done

# Step 2: Remove duplicate type definitions
echo "Step 2: Removing duplicate type definitions..."

# Comment out duplicate type definitions in auth/functional/types.ts
if [ -f "src/services/auth/functional/types.ts" ]; then
  sed -i '' 's/^export type UserId = /\/\/ Removed - using @\/types\/brandedTypes: export type UserId = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type SessionId = /\/\/ Removed - using @\/types\/brandedTypes: export type SessionId = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type Email = /\/\/ Removed - using @\/types\/brandedTypes: export type Email = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type HashedPassword = /\/\/ Removed - using @\/types\/brandedTypes: export type HashedPassword = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type AuthToken = /\/\/ Removed - using @\/types\/brandedTypes: export type AuthToken = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type RefreshToken = /\/\/ Removed - using @\/types\/brandedTypes: export type RefreshToken = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type ResetToken = /\/\/ Removed - using @\/types\/brandedTypes: export type ResetToken = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type VerificationToken = /\/\/ Removed - using @\/types\/brandedTypes: export type VerificationToken = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type IPAddress = /\/\/ Removed - using @\/types\/brandedTypes: export type IPAddress = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type UserAgent = /\/\/ Removed - using @\/types\/brandedTypes: export type UserAgent = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type DeviceFingerprint = /\/\/ Removed - using @\/types\/brandedTypes: export type DeviceFingerprint = /g' src/services/auth/functional/types.ts
  sed -i '' 's/^export type Timestamp = /\/\/ Removed - using @\/types\/brandedTypes: export type Timestamp = /g' src/services/auth/functional/types.ts
fi

# Comment out duplicate type definitions in auth/functional/types/core.ts
if [ -f "src/services/auth/functional/types/core.ts" ]; then
  sed -i '' 's/^export type UserId = /\/\/ Removed - using @\/types\/brandedTypes: export type UserId = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type Email = /\/\/ Removed - using @\/types\/brandedTypes: export type Email = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type HashedPassword = /\/\/ Removed - using @\/types\/brandedTypes: export type HashedPassword = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type PlainPassword = /\/\/ Removed - using @\/types\/brandedTypes: export type PlainPassword = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type SessionId = /\/\/ Removed - using @\/types\/brandedTypes: export type SessionId = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type AccessToken = /\/\/ Removed - using @\/types\/brandedTypes: export type AccessToken = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type RefreshToken = /\/\/ Removed - using @\/types\/brandedTypes: export type RefreshToken = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type Timestamp = /\/\/ Removed - using @\/types\/brandedTypes: export type Timestamp = /g' src/services/auth/functional/types/core.ts
  sed -i '' 's/^export type Duration = /\/\/ Removed - using @\/types\/brandedTypes: export type Duration = /g' src/services/auth/functional/types/core.ts
fi

# Comment out duplicate type definitions in storage/functional/types.ts
if [ -f "src/services/storage/functional/types.ts" ]; then
  sed -i '' 's/^export type UserId = /\/\/ Removed - using @\/types\/brandedTypes: export type UserId = /g' src/services/storage/functional/types.ts
  sed -i '' 's/^export type Email = /\/\/ Removed - using @\/types\/brandedTypes: export type Email = /g' src/services/storage/functional/types.ts
  sed -i '' 's/^export type FilePath = /\/\/ Removed - using @\/types\/brandedTypes: export type FilePath = /g' src/services/storage/functional/types.ts
fi

# Comment out duplicate type definitions in utils/jwt.ts
if [ -f "src/utils/jwt.ts" ]; then
  sed -i '' 's/^export type AccessToken = /\/\/ Removed - using @\/types\/brandedTypes: export type AccessToken = /g' src/utils/jwt.ts
  sed -i '' 's/^export type RefreshToken = /\/\/ Removed - using @\/types\/brandedTypes: export type RefreshToken = /g' src/utils/jwt.ts
fi

# Comment out duplicate type definitions in types/conversation.ts
if [ -f "src/types/conversation.ts" ]; then
  sed -i '' 's/^export type ConversationId = /\/\/ Removed - using @\/types\/brandedTypes: export type ConversationId = /g' src/types/conversation.ts
  sed -i '' 's/^export type MessageId = /\/\/ Removed - using @\/types\/brandedTypes: export type MessageId = /g' src/types/conversation.ts
fi

# Step 3: Add re-exports where needed
echo "Step 3: Adding re-exports for compatibility..."

# Add re-export to auth/functional/types.ts
if [ -f "src/services/auth/functional/types.ts" ]; then
  echo "" >> src/services/auth/functional/types.ts
  echo "// Re-export branded types from canonical source" >> src/services/auth/functional/types.ts
  echo "export { UserId, SessionId, Email, HashedPassword, AuthToken, RefreshToken, ResetToken, VerificationToken, IPAddress, UserAgent, DeviceFingerprint, Timestamp } from '@/types/brandedTypes';" >> src/services/auth/functional/types.ts
fi

# Add re-export to auth/functional/types/core.ts
if [ -f "src/services/auth/functional/types/core.ts" ]; then
  echo "" >> src/services/auth/functional/types/core.ts
  echo "// Re-export branded types from canonical source" >> src/services/auth/functional/types/core.ts
  echo "export { UserId, Email, HashedPassword, PlainPassword, SessionId, AccessToken, RefreshToken, Timestamp, Duration } from '@/types/brandedTypes';" >> src/services/auth/functional/types/core.ts
fi

# Add re-export to storage/functional/types.ts
if [ -f "src/services/storage/functional/types.ts" ]; then
  echo "" >> src/services/storage/functional/types.ts
  echo "// Re-export branded types from canonical source" >> src/services/storage/functional/types.ts
  echo "export { UserId, Email, FilePath } from '@/types/brandedTypes';" >> src/services/storage/functional/types.ts
fi

# Add re-export to utils/jwt.ts
if [ -f "src/utils/jwt.ts" ]; then
  echo "" >> src/utils/jwt.ts
  echo "// Re-export branded types from canonical source" >> src/utils/jwt.ts
  echo "export { AccessToken, RefreshToken } from '@/types/brandedTypes';" >> src/utils/jwt.ts
fi

# Add re-export to types/conversation.ts
if [ -f "src/types/conversation.ts" ]; then
  echo "" >> src/types/conversation.ts
  echo "// Re-export branded types from canonical source" >> src/types/conversation.ts
  echo "export { ConversationId, MessageId } from '@/types/brandedTypes';" >> src/types/conversation.ts
fi

echo "=== Migration complete ==="
echo "Note: You may need to manually fix some imports and type references."
echo "Run 'npm run build' to check for any remaining issues."