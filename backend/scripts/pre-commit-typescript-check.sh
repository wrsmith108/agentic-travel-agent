#!/bin/bash

# TypeScript Error Prevention Pre-commit Hook
# Prevents commits if TypeScript errors are detected

echo "🔍 Running TypeScript error prevention check..."

# Run TypeScript type check
echo "📝 Checking TypeScript compilation..."
npm run typecheck

# Check exit code
if [ $? -ne 0 ]; then
  echo "❌ COMMIT BLOCKED: TypeScript errors detected!"
  echo "🚨 Please resolve all TypeScript errors before committing."
  echo "📊 Run 'npm run typecheck' to see detailed error information."
  echo "📋 Refer to /backend/docs/TYPESCRIPT_ERROR_PREVENTION.md for resolution patterns."
  exit 1
fi

# Run Result pattern validation
echo "🔍 Validating Result pattern usage..."
node backend/scripts/validate-result-patterns.js

if [ $? -ne 0 ]; then
  echo "❌ COMMIT BLOCKED: Result pattern violations detected!"
  echo "🚨 Please fix Result pattern violations before committing."
  echo "📋 Use 'isOk()/isErr()' guards instead of direct property access."
  exit 1
fi

# Run import validation
echo "🔍 Validating import consistency..."
node backend/scripts/validate-imports.js

if [ $? -ne 0 ]; then
  echo "❌ COMMIT BLOCKED: Import violations detected!"
  echo "🚨 Please resolve import conflicts before committing."
  echo "📋 Ensure single source of truth for Result utilities."
  exit 1
fi

echo "✅ All TypeScript error prevention checks passed!"
echo "🎉 Commit approved - maintaining zero TypeScript error standard."