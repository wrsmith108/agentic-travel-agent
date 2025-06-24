# 🚀 Next Implementation Steps

**Current Task**: User Data Layer  
**Estimated Time**: 1.5 hours with Claude-Flow

---

## 📋 Task 1: User Data Layer Implementation

### Quick Start Commands

```bash
# Option 1: Full Swarm (Recommended - 1.5 hours)
./claude-flow swarm "Implement complete user data layer with atomic file operations" \
  --strategy development \
  --mode hierarchical \
  --max-agents 4 \
  --parallel \
  --monitor

# Option 2: TDD Approach (2 hours)
./claude-flow sparc tdd "UserDataManager service with file locking and atomic writes"

# Option 3: Step by Step (3 hours)
./claude-flow sparc run architect "Design file storage patterns"
./claude-flow sparc run coder "Implement UserDataManager"
./claude-flow sparc run tester "Create concurrent access tests"
```

### Implementation Checklist

#### Step 1: Install Dependencies (5 min)
```bash
cd backend
npm install proper-lockfile
npm install --save-dev @types/proper-lockfile
```

#### Step 2: Create Directory Structure (5 min)
```bash
mkdir -p backend/src/services/storage
mkdir -p backend/src/schemas
mkdir -p data/users
mkdir -p data/system
touch data/users/.gitkeep
touch data/system/.gitkeep
```

#### Step 3: Implement Schemas (15 min)
Create `backend/src/schemas/user.ts`:
```typescript
import { z } from 'zod';

export const UserPreferencesSchema = z.object({
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP']).default('CAD'),
  timezone: z.string().default('America/Toronto'),
  preferredDepartureAirport: z.string().regex(/^[A-Z]{3}$/),
  communicationFrequency: z.enum(['immediate', 'daily', 'weekly']).default('daily'),
});

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  preferences: UserPreferencesSchema,
  activeSearches: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
```

#### Step 4: Implement UserDataManager (45 min)
Create `backend/src/services/storage/userDataManager.ts`:
```typescript
import { promises as fs } from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';
import { v4 as uuidv4 } from 'uuid';
import { UserProfile, UserProfileSchema } from '@/schemas/user';
import { env } from '@/config/env';
import logger from '@/utils/logger';

export class UserDataManager {
  private dataDir: string;
  
  constructor() {
    this.dataDir = path.join(env.DATA_DIRECTORY, 'users');
  }

  async createUser(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    const user: UserProfile = {
      ...profile,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validated = UserProfileSchema.parse(user);
    const filePath = this.getUserFilePath(validated.id);
    
    await this.writeAtomically(filePath, validated);
    logger.info('User created', { userId: validated.id });
    
    return validated;
  }

  async readUserData(userId: string): Promise<UserProfile | null> {
    const filePath = this.getUserFilePath(userId);
    
    try {
      const data = await this.readWithLock(filePath);
      if (!data) return null;
      
      return UserProfileSchema.parse(JSON.parse(data));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateUserData(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.readUserData(userId);
    if (!current) {
      throw new Error(`User ${userId} not found`);
    }

    const updated: UserProfile = {
      ...current,
      ...updates,
      id: current.id, // Prevent ID changes
      createdAt: current.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    };

    const validated = UserProfileSchema.parse(updated);
    const filePath = this.getUserFilePath(userId);
    
    await this.writeAtomically(filePath, validated);
    logger.info('User updated', { userId });
    
    return validated;
  }

  async deleteUser(userId: string): Promise<void> {
    const filePath = this.getUserFilePath(userId);
    
    try {
      await fs.unlink(filePath);
      logger.info('User deleted', { userId });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async listUsers(): Promise<string[]> {
    const files = await fs.readdir(this.dataDir);
    return files
      .filter(f => f.startsWith('user-') && f.endsWith('.json'))
      .map(f => f.replace('user-', '').replace('.json', ''));
  }

  async userExists(userId: string): Promise<boolean> {
    const filePath = this.getUserFilePath(userId);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private getUserFilePath(userId: string): string {
    return path.join(this.dataDir, `user-${userId}.json`);
  }

  private async readWithLock(filePath: string): Promise<string | null> {
    let release: (() => Promise<void>) | null = null;
    
    try {
      release = await lockfile.lock(filePath, { retries: 3 });
      const data = await fs.readFile(filePath, 'utf-8');
      return data;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    } finally {
      if (release) await release();
    }
  }

  private async writeAtomically(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    let release: (() => Promise<void>) | null = null;
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write to temp file
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      
      // Lock and rename
      release = await lockfile.lock(filePath, { retries: 3 });
      await fs.rename(tempPath, filePath);
    } finally {
      if (release) await release();
      
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {}
    }
  }
}

export const userDataManager = new UserDataManager();
```

#### Step 5: Write Tests (30 min)
Create `backend/src/services/storage/__tests__/userDataManager.test.ts`:
```typescript
import { userDataManager } from '../userDataManager';
import { UserProfile } from '@/schemas/user';
import { promises as fs } from 'fs';
import path from 'path';

describe('UserDataManager', () => {
  const testUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    preferences: {
      currency: 'CAD' as const,
      timezone: 'America/Toronto',
      preferredDepartureAirport: 'YYZ',
      communicationFrequency: 'daily' as const,
    },
  };

  beforeEach(async () => {
    // Clean test data
    const users = await userDataManager.listUsers();
    for (const userId of users) {
      await userDataManager.deleteUser(userId);
    }
  });

  it('should create a new user', async () => {
    const user = await userDataManager.createUser(testUser);
    
    expect(user.id).toBeDefined();
    expect(user.firstName).toBe('John');
    expect(user.email).toBe('john@example.com');
    expect(user.createdAt).toBeDefined();
  });

  it('should handle concurrent writes', async () => {
    const promises = Array(10).fill(null).map((_, i) => 
      userDataManager.createUser({
        ...testUser,
        email: `user${i}@example.com`,
      })
    );
    
    const users = await Promise.all(promises);
    expect(users).toHaveLength(10);
    expect(new Set(users.map(u => u.id)).size).toBe(10);
  });

  it('should update user atomically', async () => {
    const user = await userDataManager.createUser(testUser);
    
    const updated = await userDataManager.updateUserData(user.id, {
      firstName: 'Jane',
    });
    
    expect(updated.firstName).toBe('Jane');
    expect(updated.id).toBe(user.id);
    expect(updated.createdAt).toBe(user.createdAt);
    expect(updated.updatedAt).not.toBe(user.updatedAt);
  });
});
```

---

## 📊 After Data Layer: Remaining Implementation

### Day 2-3 Timeline

| Time | Task | Claude-Flow Command |
|------|------|-------------------|
| 2:00 PM | ✅ Data Layer Complete | Memory: `./claude-flow memory store "data_layer_complete" "File locking implemented"` |
| 2:30 PM | Start Auth System | `./claude-flow swarm "Authentication system" --mode distributed` |
| 4:30 PM | Auth Tests | `./claude-flow sparc run tester "Auth integration tests"` |
| 5:00 PM | Day 2 Complete | `./claude-flow memory export day2-backup.json` |

### Day 3 Plan

1. **Morning (9 AM - 12 PM)**: AI Integration
   ```bash
   ./claude-flow swarm "Claude AI conversation interface" \
     --strategy development --mode mesh --max-agents 6
   ```

2. **Afternoon (1 PM - 3 PM)**: Flight Search
   ```bash
   ./claude-flow swarm "Amadeus flight search integration" \
     --strategy development --parallel
   ```

3. **Late Afternoon (3 PM - 5 PM)**: Dashboard UI
   ```bash
   ./claude-flow swarm "React dashboard components" \
     --strategy development --mode mesh
   ```

---

## 🎯 Success Criteria for Data Layer

- [ ] All tests pass with 100% coverage
- [ ] Concurrent access handled properly
- [ ] Atomic writes verified
- [ ] No race conditions
- [ ] Proper error handling
- [ ] TypeScript types working

---

## 💡 Pro Tips

1. **Use TDD Mode** for best results:
   ```bash
   ./claude-flow sparc tdd "UserDataManager with all tests passing"
   ```

2. **Monitor Progress**:
   ```bash
   ./claude-flow monitor  # In another terminal
   ```

3. **Store Decisions**:
   ```bash
   ./claude-flow memory store "file_locking" "Using proper-lockfile with temp file pattern"
   ```

Ready to implement? Start with the swarm command above! 🚀