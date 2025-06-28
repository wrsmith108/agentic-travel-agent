# TypeScript Error Prevention Guide

## Common Error Patterns and Prevention Strategies

### 1. Result Type Usage Errors

**Pattern:** Direct property access on Result types
```typescript
// ❌ WRONG - Causes TS2339: Property 'error' does not exist
if (result.error) { ... }
if (!result.error) { ... }
return result.error;

// ✅ CORRECT - Type-safe Result handling
if (isErr(result)) { ... }
if (isOk(result)) { ... }
return isErr(result) ? result.error : null;
```

**Prevention:**
- Always import `isOk` and `isErr` when working with Result types
- Use ESLint rule to ban direct `.error` or `.value` access without type guards
- Create snippet templates for Result handling patterns

### 2. Duplicate Type Definitions

**Pattern:** Re-defining types that already exist
```typescript
// ❌ WRONG - Duplicate Result type in auth/functional/types.ts
export type Result<T, E> = Ok<T> | Err<E>;
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

// ✅ CORRECT - Re-export from canonical source
export type { Result } from '@/utils/result';
```

**Prevention:**
- Establish single source of truth for common types
- Use TypeScript project references to enforce module boundaries
- Document where core types should be imported from

### 3. Missing Type Exports

**Pattern:** Using types internally but not exporting them
```typescript
// ❌ WRONG - Types used in passwordManagement.ts but not exported from types.ts
type PlainPassword = string;
type PasswordStorage = { ... };

// ✅ CORRECT - Export all types used by other modules
export type PlainPassword = string;
export type PasswordStorage = { ... };
```

**Prevention:**
- Use `--isolatedModules` TypeScript flag
- Run `tsc --noEmit` in CI/CD pipeline
- Use explicit exports over implicit ones

### 4. Inconsistent Property Naming

**Pattern:** Different property names for same concept
```typescript
// ❌ WRONG - Inconsistent naming
interface AccountStatus {
  emailVerified: boolean;  // In one place
  isEmailVerified: boolean; // In another place
}

// ✅ CORRECT - Consistent naming convention
interface AccountStatus {
  isEmailVerified: boolean;
  isAccountLocked: boolean;
  isAccountSuspended: boolean;
}
```

**Prevention:**
- Establish naming conventions (prefer `is` prefix for booleans)
- Use shared interfaces across modules
- Create type validators that enforce conventions

### 5. Mixed Error Handling Patterns

**Pattern:** Mixing Result pattern with success/error objects
```typescript
// ❌ WRONG - Mixing patterns
if (response.success) { ... }  // Old pattern
if (isOk(result)) { ... }     // New pattern

// ✅ CORRECT - Consistent Result pattern
if (isOk(result)) { ... }
```

**Prevention:**
- Complete migration before using new patterns
- Create adapter functions during transition
- Use feature flags for gradual rollout

### 6. Import Path Issues

**Pattern:** Incorrect relative imports for moved types
```typescript
// ❌ WRONG - After moving branded types
import { UserId } from './types';

// ✅ CORRECT - Import from new location
import { UserId } from '@/types/brandedTypes';
```

**Prevention:**
- Use TypeScript path aliases consistently
- Update all imports when moving files
- Use automated refactoring tools

## Recommended TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

## ESLint Rules for Error Prevention

```javascript
module.exports = {
  rules: {
    // Prevent direct Result property access
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[property.name="error"][object.name=/result|response/]',
        message: 'Use isErr() to check Result types before accessing .error'
      },
      {
        selector: 'MemberExpression[property.name="value"][object.name=/result|response/]',
        message: 'Use isOk() to check Result types before accessing .value'
      }
    ],
    
    // Enforce consistent imports
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['*/functional/types'],
            importNames: ['ok', 'err', 'isOk', 'isErr', 'Result'],
            message: 'Import Result utilities from @/utils/result instead'
          }
        ]
      }
    ]
  }
};
```

## Development Workflow Recommendations

### 1. Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
npm run typecheck
npm run lint
```

### 2. IDE Configuration
- Enable TypeScript strict mode checking
- Configure auto-imports to prefer @/ paths
- Use TypeScript language service for real-time feedback

### 3. Code Review Checklist
- [ ] All Result types use isOk/isErr guards
- [ ] No duplicate type definitions
- [ ] All exported types are intentional
- [ ] Consistent property naming
- [ ] Single error handling pattern per module
- [ ] Correct import paths

### 4. Migration Strategy
When refactoring to new patterns:
1. Create adapter layer first
2. Update tests to use new pattern
3. Migrate implementation
4. Remove adapter layer
5. Update all consumers

## Automated Tooling

### Custom Scripts
1. **fix-result-patterns.js** - Automatically fix Result type usage
2. **fix-result-imports.js** - Update imports to use @/utils/result
3. **validate-exports.js** - Ensure all used types are exported

### CI/CD Checks
```yaml
- name: TypeScript Check
  run: npm run typecheck
  
- name: Lint Check
  run: npm run lint

- name: Import Validation
  run: node scripts/validate-imports.js
```

## Type Safety Patterns

### 1. Branded Types Usage
```typescript
// Always validate when creating branded types
const userId = createUserId(id); // Validates format
const email = createEmail(emailString); // Validates email format
```

### 2. Exhaustive Type Checking
```typescript
// TypeScript will error if cases are missed
switch (error.type) {
  case 'INVALID_CREDENTIALS':
  case 'USER_NOT_FOUND':
  case 'SYSTEM_ERROR':
    return handleError(error);
  default:
    const _exhaustive: never = error;
    throw new Error('Unhandled error type');
}
```

### 3. Type-safe Builders
```typescript
// Use builder pattern for complex types
const session = createSession()
  .withUserId(userId)
  .withEmail(email)
  .withExpiry(timestamp)
  .build(); // Returns Result<Session, ValidationError>
```

## Summary

The majority of TypeScript errors encountered were preventable through:
1. **Consistent patterns** - Using Result pattern everywhere
2. **Single source of truth** - One location for type definitions  
3. **Automated validation** - Pre-commit hooks and CI checks
4. **Clear conventions** - Documented naming and structure rules
5. **Gradual migration** - Using adapters during transitions
6. **Tool assistance** - ESLint rules and TypeScript configuration

By implementing these preventive measures, similar errors can be avoided in future development.