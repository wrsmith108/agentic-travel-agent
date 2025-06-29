# TypeScript Error Resolution Execution Plan

## Current State: 196 Errors Remaining

## Resolution Strategy
Fix errors in dependency order to prevent cascading issues. Start with foundational types and work up to consumers.

## Day 1: Foundation Types (Target: 50 errors fixed)

### Step 1: Fix Type Exports (1 hour)
**Goal:** Ensure all types are properly exported from their modules

```bash
# Find all interfaces/types not exported
npm run typecheck 2>&1 | grep "Cannot find name" | sort | uniq
```

**Action Items:**
1. Add missing exports to `src/types/index.ts`
2. Create barrel exports for each module
3. Update import statements to use central exports

**Fix Pattern:**
```typescript
// src/types/index.ts
export type { User, CreateUserDto, UpdateUserDto } from './user';
export type { AppError, ErrorCode } from './errors';
export type { AuthSuccess, AuthFailure } from './auth';
export type { FlightSearch, FlightResult } from './flights';
export type { Conversation, Message } from './conversation';
```

### Step 2: Fix Date Type Mismatches (1 hour)
**Goal:** Standardize all date handling to ISO strings

```bash
# Create and run date fix script
cat > scripts/fix-remaining-dates.js << 'EOF'
const fs = require('fs');
const path = require('path');
const { findFilesWithErrors, createBackup } = require('./fix-utils');

const filesToFix = findFilesWithErrors('not assignable to type \'Date\'');

filesToFix.forEach(file => {
  createBackup(file);
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix Date property assignments
  content = content.replace(
    /(\w+)\.createdAt\s*=\s*new Date\(\)/g,
    '$1.createdAt = new Date().toISOString()'
  );
  
  // Fix inline Date objects in returns
  content = content.replace(
    /createdAt:\s*new Date\(\)/g,
    'createdAt: new Date().toISOString()'
  );
  
  fs.writeFileSync(file, content);
});
EOF

node scripts/fix-remaining-dates.js
```

### Step 3: Fix Result Type Guards (1.5 hours)
**Goal:** Use proper type guards for Result access

```bash
# Run enhanced Result pattern fix
node scripts/enhance-fix-result-patterns.js

# Fix any remaining manual cases
grep -r "result\.error" src/ --include="*.ts" | grep -v "isErr"
```

## Day 2: Service Layer (Target: 60 errors fixed)

### Step 4: Fix Service Return Types (2 hours)
**Goal:** Ensure all services return proper Result types

**Checklist:**
1. [ ] AuthService methods return Result<AuthSuccess, AppError>
2. [ ] UserService methods return Result<User, AppError>
3. [ ] FlightService methods return Result<FlightResult, AppError>
4. [ ] ConversationService methods return Result<Conversation, AppError>

**Fix Pattern:**
```typescript
// Before
async findUser(id: string): Promise<User | null> {
  // ...
}

// After
async findUser(id: UserId): Promise<Result<User, AppError>> {
  try {
    const user = await this.repository.findById(id);
    if (!user) {
      return err({
        name: 'NotFoundError',
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        statusCode: 404
      });
    }
    return ok(user);
  } catch (error) {
    return err(createAppError(error));
  }
}
```

### Step 5: Fix Repository Layer (1.5 hours)
**Goal:** Align repository interfaces with service expectations

**Tasks:**
1. Update repository method signatures
2. Add proper type conversions for database results
3. Handle null cases with Result pattern

## Day 3: API Layer (Target: 50 errors fixed)

### Step 6: Fix Route Handlers (2 hours)
**Goal:** Ensure route handlers properly handle Result types

**Fix Pattern:**
```typescript
// Before
router.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json(user);
});

// After
router.get('/users/:id', async (req: Request, res: Response) => {
  const result = await userService.findById(userId(req.params.id));
  
  if (isErr(result)) {
    return res.status(result.error.statusCode).json({
      error: result.error.message,
      code: result.error.code
    });
  }
  
  res.json(result.value);
});
```

### Step 7: Fix Middleware Types (1 hour)
**Goal:** Ensure middleware properly types req/res/next

**Tasks:**
1. Add proper Express type imports
2. Type custom properties on Request
3. Fix async middleware error handling

## Day 4: Final Cleanup (Target: 36 errors fixed)

### Step 8: Fix Test Files (1.5 hours)
**Goal:** Update tests to match new type signatures

**Common Fixes:**
1. Update mock return types to use Result
2. Add type guards in assertions
3. Fix date comparisons

### Step 9: Fix Edge Cases (1.5 hours)
**Goal:** Handle remaining unique errors

**Categories:**
1. Complex generic types
2. Conditional type issues
3. Module resolution problems
4. Third-party library types

### Step 10: Enable Strict Mode (1 hour)
**Goal:** Gradually enable strict settings

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

## Automated Fix Scripts

### Script 1: Fix Missing Type Imports
```javascript
// scripts/fix-missing-imports.js
const { addImportToFile } = require('./fix-utils');

const missingImports = [
  { file: 'src/services/user.ts', import: "import { Result, ok, err } from '@/utils/result';" },
  { file: 'src/routes/auth.ts', import: "import { AppError } from '@/types/errors';" },
  // Add more as discovered
];

missingImports.forEach(({ file, import }) => {
  addImportToFile(file, import);
});
```

### Script 2: Fix Property Access
```javascript
// scripts/fix-property-access.js
const fixes = [
  { pattern: /user\.profile\.name/g, replacement: "user.profile?.name ?? 'Unknown'" },
  { pattern: /error\.errorCode/g, replacement: "error.code" },
  // Add more patterns
];

// Apply fixes...
```

## Validation Checklist

After each phase, run:
```bash
# Check error count
npm run typecheck 2>&1 | grep "error TS" | wc -l

# Check specific error types
npm run typecheck 2>&1 | grep "TS2339" | wc -l  # Property does not exist
npm run typecheck 2>&1 | grep "TS2345" | wc -l  # Argument type mismatch
npm run typecheck 2>&1 | grep "TS2322" | wc -l  # Type not assignable

# Run tests to ensure nothing broke
npm test -- --passWithNoTests
```

## Progress Tracking

### Day 1 Checkpoint
- [ ] All types exported: ___/50 errors fixed
- [ ] Dates standardized: ___/50 errors fixed
- [ ] Result guards fixed: ___/50 errors fixed
- **Total Day 1:** ___/50 errors fixed

### Day 2 Checkpoint
- [ ] Service layer typed: ___/60 errors fixed
- [ ] Repository layer aligned: ___/60 errors fixed
- **Total Day 2:** ___/60 errors fixed

### Day 3 Checkpoint
- [ ] Route handlers fixed: ___/50 errors fixed
- [ ] Middleware typed: ___/50 errors fixed
- **Total Day 3:** ___/50 errors fixed

### Day 4 Checkpoint
- [ ] Tests updated: ___/36 errors fixed
- [ ] Edge cases resolved: ___/36 errors fixed
- [ ] Strict mode enabled: ___/36 errors fixed
- **Total Day 4:** ___/36 errors fixed

## Common Pitfalls to Avoid

1. **Don't use `as any`** - It hides the problem
2. **Don't ignore null checks** - Add proper guards
3. **Don't skip type exports** - Other files need them
4. **Don't mix Date objects and strings** - Pick one
5. **Don't forget async error handling** - Use Result pattern

## Success Criteria
- [ ] 0 TypeScript errors
- [ ] All tests passing
- [ ] No new runtime errors
- [ ] Code follows guidelines
- [ ] Team can maintain velocity

## Next Steps After Resolution
1. Enable full strict mode
2. Add type coverage monitoring
3. Setup pre-commit hooks
4. Document patterns learned
5. Team knowledge sharing session