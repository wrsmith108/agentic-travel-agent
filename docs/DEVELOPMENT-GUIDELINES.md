# Development Guidelines for AI Travel Agent

## Core Development Philosophy

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE**. Every single line of production code must be written in response to a failing test. This ensures:
- Complete test coverage
- Better design through test-first thinking
- Confidence in refactoring
- Living documentation through tests

## Fundamental Principles

### 1. Test-Driven Development (TDD)
```typescript
// ❌ WRONG: Writing code first
function calculateFlightPrice(base: number, taxes: number) {
  return base + taxes;
}

// ✅ CORRECT: Write test first
describe('calculateFlightPrice', () => {
  it('should sum base price and taxes', () => {
    expect(calculateFlightPrice(100, 20)).toBe(120);
  });
});
// THEN implement to make test pass
```

### 2. Behavior-Driven Testing
Test behavior, not implementation details:
```typescript
// ❌ WRONG: Testing implementation
it('should call amadeus.searchFlights with params', () => {
  const spy = jest.spyOn(amadeus, 'searchFlights');
  service.findFlights(criteria);
  expect(spy).toHaveBeenCalledWith(criteria);
});

// ✅ CORRECT: Testing behavior
it('should return flights matching search criteria', async () => {
  const flights = await service.findFlights({
    origin: 'JFK',
    destination: 'LHR',
    date: '2024-05-01'
  });
  
  expect(flights).toContainEqual(
    expect.objectContaining({
      origin: 'JFK',
      destination: 'LHR'
    })
  );
});
```

### 3. Functional Programming
Embrace immutability and pure functions:
```typescript
// ❌ WRONG: Mutating data
function addSavedSearch(user: User, search: SavedSearch) {
  user.savedSearches.push(search); // Mutation!
  return user;
}

// ✅ CORRECT: Return new immutable data
function addSavedSearch(user: User, search: SavedSearch): User {
  return {
    ...user,
    savedSearches: [...user.savedSearches, search]
  };
}
```

### 4. TypeScript Strict Mode
No compromises on type safety:
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Code Style Guidelines

### TypeScript Best Practices

#### Use `type` over `interface`
```typescript
// ❌ Avoid
interface FlightSearch {
  origin: string;
  destination: string;
}

// ✅ Prefer
type FlightSearch = {
  origin: string;
  destination: string;
};
```

#### Never use `any` or type assertions
```typescript
// ❌ NEVER
const data: any = fetchData();
const flight = data as Flight;

// ✅ Always type properly
const data: unknown = fetchData();
const flight = parseFlightData(data); // Returns Flight | Error
```

#### Use Zod for runtime validation
```typescript
import { z } from 'zod';

// Define schema first
const FlightSearchSchema = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  date: z.string().datetime(),
  flexibility: z.number().min(0).max(7).optional()
});

// Derive type from schema
type FlightSearch = z.infer<typeof FlightSearchSchema>;

// Validate at runtime
function validateSearch(input: unknown): FlightSearch {
  return FlightSearchSchema.parse(input);
}
```

### Functional Programming Patterns

#### Small, Composable Functions
```typescript
// ❌ Large, complex function
function processFlightSearch(input: string, user: User) {
  // 50 lines of code doing multiple things
}

// ✅ Small, focused functions
const parseSearchInput = (input: string): SearchParams => {...};
const validateSearchParams = (params: SearchParams): ValidatedSearch => {...};
const applyUserPreferences = (search: ValidatedSearch, user: User): PersonalizedSearch => {...};

// Compose them
const processFlightSearch = flow(
  parseSearchInput,
  validateSearchParams,
  (search) => applyUserPreferences(search, user)
);
```

#### Avoid Mutations
```typescript
// ❌ Mutating arrays
const flights = [...];
flights.sort((a, b) => a.price - b.price);

// ✅ Create new sorted array
const sortedFlights = [...flights].sort((a, b) => a.price - b.price);
// or
const sortedFlights = flights.toSorted((a, b) => a.price - b.price);
```

## Testing Standards

### Test Structure
```typescript
describe('FlightSearchService', () => {
  describe('searchFlights', () => {
    it('should return flights for valid search criteria', async () => {
      // Arrange
      const criteria = createValidSearchCriteria();
      
      // Act
      const result = await service.searchFlights(criteria);
      
      // Assert
      expect(result).toMatchObject({
        flights: expect.arrayContaining([
          expect.objectContaining({
            origin: criteria.origin,
            destination: criteria.destination
          })
        ])
      });
    });
    
    it('should handle API errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

### Test Utilities
Create test builders for complex objects:
```typescript
// testBuilders.ts
export const aFlight = (overrides: Partial<Flight> = {}): Flight => ({
  id: 'test-flight-1',
  origin: 'JFK',
  destination: 'LHR',
  price: { amount: 500, currency: 'USD' },
  departureTime: '2024-05-01T10:00:00Z',
  arrivalTime: '2024-05-01T22:00:00Z',
  ...overrides
});

// Usage in tests
const cheapFlight = aFlight({ price: { amount: 200, currency: 'USD' } });
```

## Project-Specific Guidelines

### AI Agent Conversation Testing
```typescript
describe('Travel Agent Conversations', () => {
  it('should extract flight search parameters from natural language', () => {
    const input = "I need a flight from NYC to London next Tuesday";
    const params = extractSearchParams(input);
    
    expect(params).toEqual({
      origin: 'NYC',
      destination: 'LON',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    });
  });
});
```

### Error Handling Pattern
```typescript
// Use Result type for error handling
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

function searchFlights(criteria: SearchCriteria): Result<Flight[]> {
  try {
    const flights = amadeus.searchFlights(criteria);
    return { success: true, data: flights };
  } catch (error) {
    return { success: false, error };
  }
}
```

## Integration with Existing Codebase

### Migration Strategy
1. New features: Apply all guidelines immediately
2. Existing code: Refactor when touched (Boy Scout Rule)
3. Critical paths: Prioritize adding tests
4. Legacy code: Wrap in tested adapters

### Tooling Configuration
```json
// package.json additions
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "zod": "^3.22.0"
  }
}
```

## Code Review Checklist

Before submitting PR:
- [ ] All new code has tests written first
- [ ] No `any` types or type assertions
- [ ] All data is immutable
- [ ] Functions are pure where possible
- [ ] Error cases are tested
- [ ] Types are derived from Zod schemas
- [ ] No implementation details in tests
- [ ] Code follows functional patterns

## References
- Original guidelines: https://github.com/citypaul/.dotfiles/blob/main/claude/.claude/CLAUDE.md
- Testing best practices: https://kentcdodds.com/blog/testing-implementation-details
- Functional TypeScript: https://github.com/gcanti/fp-ts

---

*These guidelines ensure high-quality, maintainable code for the AI Travel Agent MVP and beyond.*