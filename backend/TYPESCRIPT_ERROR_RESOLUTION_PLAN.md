# TypeScript Error Resolution Plan

## Current Status
**176 errors** remaining, categorized as follows:

| Error Code | Count | Description | Priority |
|------------|-------|-------------|----------|
| TS2339 | 48 | Property does not exist | High |
| TS2322 | 30 | Type assignment errors | High |
| TS2345 | 19 | Argument type mismatch | Medium |
| TS2304 | 19 | Cannot find name | High |
| TS2352 | 16 | Type conversion errors | Medium |
| TS18050 | 10 | Null cannot be used | Medium |
| TS2552 | 9 | Cannot find name (typos) | High |
| TS2349 | 5 | Expression not callable | Low |
| TS2769 | 4 | No overload matches | Low |
| TS2551 | 3 | Property does not exist (typo) | Low |

## Resolution Strategy

### Phase 1: Quick Wins (Est. 50-60 errors)
**Target:** Fix missing imports and typos

#### 1.1 Add Missing isErr/isOk Imports (19 errors)
```javascript
// Create script: fix-missing-result-imports.js
// Target files with TS2304 errors
// Add: import { isOk, isErr } from '@/utils/result';
```

#### 1.2 Fix Import Typos (9 errors)
- Files referencing `isErr` but importing as `err`
- Correct casing issues

### Phase 2: Type Conversions (Est. 40-50 errors)
**Target:** Fix Zod validation and Result type mismatches

#### 2.1 Create Zod-to-Result Converter
```typescript
// utils/zodToResult.ts
export function zodToResult<T>(parseResult: SafeParseReturnType<any, T>): Result<T, ValidationError> {
  if (parseResult.success) {
    return ok(parseResult.data);
  }
  return err({
    type: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: parseResult.error.errors
  });
}
```

#### 2.2 Fix SafeParseReturnType Usage
- Replace direct usage with zodToResult wrapper
- Update validation middleware

### Phase 3: Redis Client Types (Est. 20-30 errors)
**Target:** Handle Buffer returns from Redis

#### 3.1 Create Redis Type Wrapper
```typescript
// services/redis/typeHelpers.ts
export async function getStringFromRedis(key: string): Promise<Result<string | null, AppError>> {
  const result = await redisClient.get(key);
  if (isErr(result)) return result;
  if (!result.value) return ok(null);
  return ok(result.value.toString());
}
```

#### 3.2 Update All Redis Usage
- Replace direct .get() calls with type-safe wrapper
- Handle Buffer to string conversions

### Phase 4: Date/Time Handling (Est. 16 errors)
**Target:** Remaining Date to string conversions

#### 4.1 Enhanced Date Fix Script
```javascript
// fix-remaining-date-conversions.js
// Target patterns missed by previous scripts:
// - Direct Date assignments to string properties
// - toISOString() calls that need type assertions
```

### Phase 5: JWT and Auth Types (Est. 20-30 errors)
**Target:** Fix JWT payload and auth error handling

#### 4.1 Fix JWT Sign Options
- Correct expiresIn parameter placement
- Fix secret type issues

#### 4.2 Auth Error Type Handling
- Fix places using error objects as HTTP status codes
- Proper error extraction from Result types

## Implementation Plan

### Step 1: Create Automated Scripts (Day 1)
1. `fix-missing-result-imports.js` - Add missing imports
2. `fix-zod-validation-types.js` - Convert Zod results
3. `fix-redis-buffer-types.js` - Handle Buffer conversions

### Step 2: Run Scripts in Order (Day 1)
1. Run import fixes first (least risky)
2. Run type conversion fixes
3. Test after each script

### Step 3: Manual Fixes (Day 2)
1. JWT configuration issues
2. Complex type mismatches
3. Any errors not caught by scripts

### Step 4: Validation (Day 2)
1. Run typecheck after each phase
2. Document error reduction
3. Test critical paths

## Expected Outcomes

| Phase | Expected Errors Fixed | Remaining |
|-------|---------------------|-----------|
| Start | 0 | 176 |
| Phase 1 | 50-60 | ~120 |
| Phase 2 | 40-50 | ~75 |
| Phase 3 | 20-30 | ~50 |
| Phase 4 | 16 | ~35 |
| Phase 5 | 20-30 | <10 |

## Success Criteria
- TypeScript build completes successfully
- All tests can run (even if some fail)
- Server can start in development mode

## Risk Mitigation
1. **Backup Strategy**: All changes in git commits
2. **Rollback Plan**: Each phase is independently revertable
3. **Testing**: Validate after each phase
4. **Documentation**: Update error prevention guide with new patterns

## Next Steps
1. Review and approve plan
2. Create first automation script
3. Begin Phase 1 implementation