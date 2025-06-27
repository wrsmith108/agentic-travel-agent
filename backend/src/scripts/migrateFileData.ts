#!/usr/bin/env npx tsx
/**
 * Migrate user data from file storage to PostgreSQL database
 */

import { promises as fs } from 'fs';
import path from 'path';
import { initializeDatabase } from '@/config/database';
import { createUser, findUserByEmail, asEmail } from '@/services/storage/database/userService';
import { getUserDataManagerOps } from '@/services/storage/functional';
import { UserDataFile, validateUserDataFile } from '@/schemas/user';
import logger from '@/utils/logger';

const DATA_DIR = path.join(__dirname, '../../data/users');

interface MigrationStats {
  totalFiles: number;
  successfulMigrations: number;
  skippedExisting: number;
  failures: number;
  errors: string[];
}

/**
 * Get all user data files
 */
async function getUserDataFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter(file => file.startsWith('user-') && file.endsWith('.json'));
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      logger.info('No existing user data directory found');
      return [];
    }
    throw error;
  }
}

/**
 * Read and parse a user data file
 */
async function readUserDataFile(filename: string): Promise<UserDataFile | null> {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return validateUserDataFile(data);
  } catch (error) {
    logger.error('Failed to read user data file', {
      filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Migrate a single user
 */
async function migrateUser(userData: UserDataFile): Promise<boolean> {
  try {
    const profile = userData.profile;
    
    // Check if user already exists in database
    const existingUser = await findUserByEmail(asEmail(profile.email));
    if (existingUser) {
      logger.info('User already exists in database, skipping', {
        userId: profile.id,
        email: profile.email,
      });
      return false; // Skipped
    }

    // Create user in database
    const createUserData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      passwordHash: profile.passwordHash,
      preferences: profile.preferences,
    };

    await createUser(createUserData);
    
    logger.info('User migrated successfully', {
      userId: profile.id,
      email: profile.email,
    });
    
    return true; // Success
  } catch (error) {
    logger.error('Failed to migrate user', {
      userId: userData.profile.id,
      email: userData.profile.email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Run the data migration
 */
async function runDataMigration(): Promise<void> {
  const stats: MigrationStats = {
    totalFiles: 0,
    successfulMigrations: 0,
    skippedExisting: 0,
    failures: 0,
    errors: [],
  };

  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connection established for migration');

    // Get all user data files
    const userFiles = await getUserDataFiles();
    stats.totalFiles = userFiles.length;

    if (userFiles.length === 0) {
      logger.info('No user data files found to migrate');
      return;
    }

    logger.info('Starting data migration', {
      totalFiles: userFiles.length,
    });

    // Migrate each user
    for (const filename of userFiles) {
      try {
        const userData = await readUserDataFile(filename);
        if (!userData) {
          stats.failures++;
          stats.errors.push(`Failed to read file: ${filename}`);
          continue;
        }

        const migrated = await migrateUser(userData);
        if (migrated) {
          stats.successfulMigrations++;
        } else {
          stats.skippedExisting++;
        }
      } catch (error) {
        stats.failures++;
        const errorMsg = `Failed to migrate ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(errorMsg);
        logger.error('User migration failed', {
          filename,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Report results
    logger.info('Data migration completed', stats);
    
    console.log('\n📊 Migration Results:');
    console.log('====================');
    console.log(`Total files processed: ${stats.totalFiles}`);
    console.log(`Successful migrations: ${stats.successfulMigrations}`);
    console.log(`Skipped (already exist): ${stats.skippedExisting}`);
    console.log(`Failures: ${stats.failures}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (stats.failures > 0) {
      console.log('\n⚠️  Some migrations failed. Check logs for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All migrations completed successfully!');
    }
  } catch (error) {
    logger.error('Data migration process failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('❌ Migration process failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Backup existing data files
 */
async function backupDataFiles(): Promise<void> {
  try {
    const backupDir = path.join(__dirname, '../../data/users_backup_' + Date.now());
    await fs.mkdir(backupDir, { recursive: true });
    
    const userFiles = await getUserDataFiles();
    
    if (userFiles.length === 0) {
      logger.info('No files to backup');
      return;
    }

    for (const filename of userFiles) {
      const sourcePath = path.join(DATA_DIR, filename);
      const backupPath = path.join(backupDir, filename);
      await fs.copyFile(sourcePath, backupPath);
    }

    logger.info('Data files backed up', {
      backupDir,
      fileCount: userFiles.length,
    });
    
    console.log(`✅ Backed up ${userFiles.length} files to: ${backupDir}`);
  } catch (error) {
    logger.error('Failed to backup data files', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Show migration preview
 */
async function showPreview(): Promise<void> {
  try {
    const userFiles = await getUserDataFiles();
    
    console.log('\n📋 Migration Preview:');
    console.log('====================');
    console.log(`Files to migrate: ${userFiles.length}`);
    
    if (userFiles.length > 0) {
      console.log('\nFiles:');
      for (const filename of userFiles.slice(0, 10)) { // Show first 10
        const userData = await readUserDataFile(filename);
        if (userData) {
          console.log(`  - ${filename} (${userData.profile.email})`);
        } else {
          console.log(`  - ${filename} (⚠️  parse error)`);
        }
      }
      
      if (userFiles.length > 10) {
        console.log(`  ... and ${userFiles.length - 10} more files`);
      }
    }
    
    console.log('\nRun with "migrate" to start the migration process.');
  } catch (error) {
    console.error('Preview failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'migrate':
    runDataMigration();
    break;
  case 'backup':
    backupDataFiles();
    break;
  case 'preview':
    showPreview();
    break;
  default:
    console.log('Usage: npx tsx src/scripts/migrateFileData.ts <command>');
    console.log('Commands:');
    console.log('  preview  - Show what files will be migrated');
    console.log('  backup   - Backup existing data files');
    console.log('  migrate  - Migrate data from files to database');
    process.exit(1);
}