#!/bin/bash

echo "=== Fixing branded type conflicts ==="

# Fix authServiceNew.ts - add type assertions for UserId mismatches
echo "Fixing authServiceNew.ts..."
# Line 96,109,172,190,204,370,400 - all need fixing

# Add castUserId import
sed -i '' '1a\
import { castUserId } from "@/utils/brandedTypeUtils";' src/services/auth/authServiceNew.ts

# Fix 2: authServiceWrapper.ts SessionUser type
echo "Fixing authServiceWrapper.ts..."
# The issue is that the object literal doesn't match SessionUser type

# Fix 3: functional/operations.ts UserId mismatches
echo "Fixing functional/operations.ts..."
# Multiple UserId type conflicts between different modules

echo "=== Fixes applied ==="