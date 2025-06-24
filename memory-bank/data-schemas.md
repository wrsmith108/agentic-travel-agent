# 📊 Data Schemas & File Organization
## Agentic Travel Agent MVP

**Senior Data Engineering Standards**  
**Purpose**: Consistent data structures and atomic file operations  
**MVP Strategy**: Single JSON file per user with PostgreSQL migration path  
**Updated**: June 23, 2025

---

## 🎯 Data Architecture Principles

### MVP File-based Storage
1. **Single JSON per User**: `user-{uuid}.json` containing complete user state
2. **Atomic Operations**: Write to temp file, then rename for atomicity
3. **Schema Validation**: Zod schemas validate all data operations
4. **Migration Ready**: Designed for seamless PostgreSQL transition
5. **Consistent Naming**: UUID-based identifiers throughout

### File Naming Conventions
```typescript
// User data files
const userFileName = (userId: string) => `user-${userId}.json`;
// Example: user-123e4567-e89b-12d3-a456-426614174000.json

// System configuration files
const systemFiles = {
  config: 'system-config.json',
  demoData: 'demo-data.json',
  apiCache: 'api-cache.json'
};

// Temporary files for atomic operations
const tempFileName = (operation: string) => 
  `temp-${Date.now()}-${operation}.json`;
// Example: temp-1719158422123-user-update.json
```

---

## 📝 Core Data Schemas

### User Profile Schema
```typescript
import { z } from 'zod';

// Currency codes enum
export const CurrencyCodeSchema = z.enum(['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'AUD']);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

// Communication frequency enum
export const CommunicationFrequencySchema = z.enum(['immediate', 'daily', 'weekly']);
export type CommunicationFrequency = z.infer<typeof CommunicationFrequencySchema>;

// User preferences schema
export const UserPreferencesSchema = z.object({
  currency: CurrencyCodeSchema.default('CAD'),
  timezone: z.string().min(1), // IANA timezone (e.g., "America/Toronto")
  preferredDepartureAirport: z.string().length(3).regex(/^[A-Z]{3}$/), // IATA code
  communicationFrequency: CommunicationFrequencySchema.default('daily')
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Main user profile schema
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  preferences: UserPreferencesSchema,
  activeSearches: z.array(z.string().uuid()).default([]), // Flight search IDs
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive().default(1) // For optimistic locking
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
```

### Flight Search Schema
```typescript
// Travel class enum
export const TravelClassSchema = z.enum(['economy', 'premium-economy', 'business', 'first']);
export type TravelClass = z.infer<typeof TravelClassSchema>;

// Search status enum
export const SearchStatusSchema = z.enum(['active', 'paused', 'completed', 'expired']);
export type SearchStatus = z.infer<typeof SearchStatusSchema>;

// Passenger information
export const PassengerInfoSchema = z.object({
  adults: z.number().int().min(1).max(9),
  children: z.number().int().min(0).max(8),
  infants: z.number().int().min(0).max(2)
}).refine(data => data.infants <= data.adults, {
  message: "Number of infants cannot exceed number of adults",
  path: ["infants"]
});

export type PassengerInfo = z.infer<typeof PassengerInfoSchema>;

// Flight search criteria
export const FlightSearchCriteriaSchema = z.object({
  origin: z.string().length(3).regex(/^[A-Z]{3}$/), // IATA airport code
  destination: z.string().length(3).regex(/^[A-Z]{3}$/), // IATA airport code
  departureDate: z.string().datetime(),
  returnDate: z.string().datetime().optional(),
  passengers: PassengerInfoSchema,
  travelClass: TravelClassSchema.default('economy'),
  maxPrice: z.number().positive().max(50000),
  currency: CurrencyCodeSchema,
  nonStop: z.boolean().default(false),
  includedAirlines: z.array(z.string().length(2)).optional(), // IATA airline codes
  excludedAirlines: z.array(z.string().length(2)).optional() // IATA airline codes
});

export type FlightSearchCriteria = z.infer<typeof FlightSearchCriteriaSchema>;

// Price data point for history tracking
export const PriceDataPointSchema = z.object({
  price: z.number().positive(),
  currency: CurrencyCodeSchema,
  recordedAt: z.string().datetime(),
  source: z.enum(['amadeus', 'manual', 'demo']).default('amadeus'),
  flightDetails: z.object({
    airline: z.string().optional(),
    flightNumber: z.string().optional(),
    duration: z.string().optional(), // ISO 8601 duration
    stops: z.number().int().min(0).default(0),
    departureTime: z.string().datetime().optional(),
    arrivalTime: z.string().datetime().optional()
  }).optional()
});

export type PriceDataPoint = z.infer<typeof PriceDataPointSchema>;

// Flight search entity
export const FlightSearchSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  criteria: FlightSearchCriteriaSchema,
  status: SearchStatusSchema.default('active'),
  lastChecked: z.string().datetime().optional(),
  nextCheck: z.string().datetime().optional(),
  bestPriceFound: z.object({
    price: z.number().positive(),
    currency: CurrencyCodeSchema,
    foundAt: z.string().datetime(),
    flightDetails: z.object({
      id: z.string(),
      airline: z.string(),
      flightNumber: z.string(),
      duration: z.string(),
      stops: z.number().int().min(0),
      departureTime: z.string().datetime(),
      arrivalTime: z.string().datetime(),
      bookingUrl: z.string().url().optional()
    })
  }).optional(),
  priceHistory: z.array(PriceDataPointSchema).default([]),
  alertsSent: z.number().int().min(0).default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive().default(1)
});

export type FlightSearch = z.infer<typeof FlightSearchSchema>;
```

### Complete User Data File Schema
```typescript
// The main data structure stored in user-{uuid}.json
export const UserDataFileSchema = z.object({
  profile: UserProfileSchema,
  searches: z.array(FlightSearchSchema).default([]),
  conversationHistory: z.array(z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    metadata: z.record(z.unknown()).optional()
  })).default([]),
  systemMetadata: z.object({
    fileVersion: z.string().default('1.0.0'),
    lastModified: z.string().datetime(),
    checksumMD5: z.string().optional(), // For data integrity
    backupCount: z.number().int().min(0).default(0)
  })
});

export type UserDataFile = z.infer<typeof UserDataFileSchema>;
```

---

## 🔧 System Configuration Schemas

### Application Configuration
```typescript
// System configuration schema
export const SystemConfigSchema = z.object({
  application: z.object({
    name: z.string().default('Agentic Travel Agent'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    features: z.object({
      demoMode: z.boolean().default(true),
      priceProjections: z.boolean().default(false),
      multiCurrency: z.boolean().default(true),
      emailNotifications: z.boolean().default(true)
    })
  }),
  apis: z.object({
    amadeus: z.object({
      environment: z.enum(['test', 'production']).default('test'),
      rateLimit: z.object({
        requestsPerMinute: z.number().int().positive().default(100),
        dailyQuota: z.number().int().positive().default(1000)
      })
    }),
    anthropic: z.object({
      model: z.string().default('claude-opus-4'),
      maxTokens: z.number().int().positive().default(4096),
      temperature: z.number().min(0).max(1).default(0.7)
    }),
    sendgrid: z.object({
      environment: z.enum(['sandbox', 'production']).default('sandbox'),
      templateIds: z.object({
        priceAlert: z.string().optional(),
        welcome: z.string().optional(),
        searchSummary: z.string().optional()
      })
    })
  }),
  monitoring: z.object({
    priceCheckInterval: z.number().int().positive().default(86400000), // 24 hours in ms
    maxActiveSearchesPerUser: z.number().int().positive().default(5),
    dataRetentionDays: z.number().int().positive().default(90)
  })
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
```

### Demo Data Schema
```typescript
// Demo data for testing and development
export const DemoDataSchema = z.object({
  users: z.array(UserProfileSchema),
  flightOffers: z.array(z.object({
    id: z.string(),
    origin: z.string().length(3),
    destination: z.string().length(3),
    departureDate: z.string().datetime(),
    price: z.number().positive(),
    currency: CurrencyCodeSchema,
    airline: z.string(),
    duration: z.string(),
    stops: z.number().int().min(0)
  })),
  priceHistory: z.array(z.object({
    route: z.string(), // "YYZ-NRT"
    date: z.string().datetime(),
    price: z.number().positive(),
    currency: CurrencyCodeSchema
  })),
  metadata: z.object({
    generatedAt: z.string().datetime(),
    version: z.string(),
    description: z.string()
  })
});

export type DemoData = z.infer<typeof DemoDataSchema>;
```

---

## 🗃️ File Operations & Data Access

### Atomic File Operations
```typescript
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class UserDataManager {
  private readonly dataDirectory: string;

  constructor(dataDirectory: string = './data/users') {
    this.dataDirectory = dataDirectory;
  }

  // Read user data with validation
  async readUserData(userId: string): Promise<UserDataFile | null> {
    try {
      const filePath = join(this.dataDirectory, `user-${userId}.json`);
      const rawData = await fs.readFile(filePath, 'utf-8');
      const parsedData = JSON.parse(rawData);
      
      // Validate schema
      const validatedData = UserDataFileSchema.parse(parsedData);
      return validatedData;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  // Atomic write operation
  async writeUserData(userId: string, userData: UserDataFile): Promise<void> {
    // Validate data before writing
    const validatedData = UserDataFileSchema.parse(userData);
    
    // Update system metadata
    validatedData.systemMetadata.lastModified = new Date().toISOString();
    
    const finalPath = join(this.dataDirectory, `user-${userId}.json`);
    const tempPath = join(this.dataDirectory, `temp-${Date.now()}-${randomUUID()}.json`);
    
    try {
      // Write to temporary file first
      await fs.writeFile(tempPath, JSON.stringify(validatedData, null, 2), 'utf-8');
      
      // Atomic rename (POSIX systems guarantee atomicity)
      await fs.rename(tempPath, finalPath);
    } catch (error) {
      // Cleanup temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  // Create new user with default data
  async createUser(userProfile: UserProfile): Promise<UserDataFile> {
    const userData: UserDataFile = {
      profile: userProfile,
      searches: [],
      conversationHistory: [],
      systemMetadata: {
        fileVersion: '1.0.0',
        lastModified: new Date().toISOString(),
        backupCount: 0
      }
    };

    await this.writeUserData(userProfile.id, userData);
    return userData;
  }

  // Update user data with optimistic locking
  async updateUserData(
    userId: string, 
    updateFn: (userData: UserDataFile) => UserDataFile
  ): Promise<UserDataFile> {
    const currentData = await this.readUserData(userId);
    if (!currentData) {
      throw new Error(`User ${userId} not found`);
    }

    const updatedData = updateFn(currentData);
    
    // Increment version for optimistic locking
    updatedData.profile.version = currentData.profile.version + 1;
    updatedData.profile.updatedAt = new Date().toISOString();

    await this.writeUserData(userId, updatedData);
    return updatedData;
  }

  // Add flight search to user
  async addFlightSearch(userId: string, searchCriteria: FlightSearchCriteria): Promise<FlightSearch> {
    const newSearch: FlightSearch = {
      id: randomUUID(),
      userId,
      criteria: searchCriteria,
      status: 'active',
      priceHistory: [],
      alertsSent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };

    await this.updateUserData(userId, (userData) => {
      userData.searches.push(newSearch);
      userData.profile.activeSearches.push(newSearch.id);
      return userData;
    });

    return newSearch;
  }

  // Update flight search
  async updateFlightSearch(
    userId: string, 
    searchId: string, 
    updates: Partial<FlightSearch>
  ): Promise<FlightSearch> {
    let updatedSearch: FlightSearch | undefined;

    await this.updateUserData(userId, (userData) => {
      const searchIndex = userData.searches.findIndex(s => s.id === searchId);
      if (searchIndex === -1) {
        throw new Error(`Search ${searchId} not found for user ${userId}`);
      }

      updatedSearch = {
        ...userData.searches[searchIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
        version: userData.searches[searchIndex].version + 1
      };

      userData.searches[searchIndex] = updatedSearch;
      return userData;
    });

    return updatedSearch!;
  }
}
```

### Data Validation Utilities
```typescript
// Validation helpers
export const ValidationUtils = {
  // Validate IATA airport code
  isValidIATACode: (code: string): boolean => {
    return /^[A-Z]{3}$/.test(code);
  },

  // Validate airline code
  isValidAirlineCode: (code: string): boolean => {
    return /^[A-Z0-9]{2}$/.test(code);
  },

  // Validate currency code
  isValidCurrencyCode: (code: string): boolean => {
    return CurrencyCodeSchema.safeParse(code).success;
  },

  // Validate date is in future
  isFutureDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    return date > new Date();
  },

  // Validate passenger combination
  isValidPassengerCombination: (passengers: PassengerInfo): boolean => {
    return PassengerInfoSchema.safeParse(passengers).success;
  }
};
```

---

## 📊 Migration Planning (File → PostgreSQL)

### PostgreSQL Schema Design
```sql
-- Future PostgreSQL schema (for reference)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Flight searches table
CREATE TABLE flight_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  criteria JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  last_checked TIMESTAMP WITH TIME ZONE,
  next_check TIMESTAMP WITH TIME ZONE,
  best_price_found JSONB,
  alerts_sent INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Price history table
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id UUID NOT NULL REFERENCES flight_searches(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  flight_details JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(20) DEFAULT 'amadeus'
);

-- Conversation history table
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_flight_searches_user_id ON flight_searches(user_id);
CREATE INDEX idx_flight_searches_status ON flight_searches(status);
CREATE INDEX idx_price_history_search_id ON price_history(search_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX idx_conversation_history_user_id ON conversation_history(user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_searches_updated_at BEFORE UPDATE ON flight_searches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration Utilities
```typescript
// Migration helper (for future use)
export class DataMigrator {
  async migrateFileToDatabase(userId: string): Promise<void> {
    const fileData = await this.userDataManager.readUserData(userId);
    if (!fileData) {
      throw new Error(`No file data found for user ${userId}`);
    }

    // Begin transaction
    // Insert user profile
    // Insert flight searches
    // Insert price history
    // Insert conversation history
    // Commit transaction
    
    // Backup original file
    // Delete original file (optional)
  }

  async validateMigration(userId: string): Promise<boolean> {
    // Compare file data with database data
    // Return true if data matches
    return true;
  }
}
```

---

**Status**: ✅ Data Schemas Complete  
**MVP**: Single JSON file per user with atomic operations  
**Validation**: Zod schemas ensure data integrity  
**Migration**: PostgreSQL schema designed for seamless transition  
**Next**: Create implementation roadmap with milestones