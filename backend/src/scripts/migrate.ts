#!/usr/bin/env npx tsx
/**
 * Database migration runner
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { getDatabaseConfig, createDatabasePool } from '@/config/database';
import logger from '@/utils/logger';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Create migrations tracking table
 */
async function createMigrationsTable(pool: Pool): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      migration_id VARCHAR(255) UNIQUE NOT NULL,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  await pool.query(sql);
  logger.info('Migrations table ready');
}

/**
 * Get list of migration files
 */
async function getMigrationFiles(): Promise<Migration[]> {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure proper order

    const migrations: Migration[] = [];

    for (const filename of sqlFiles) {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = await fs.readFile(filePath, 'utf-8');
      const id = filename.replace('.sql', '');
      
      migrations.push({ id, filename, sql });
    }

    return migrations;
  } catch (error) {
    logger.error('Failed to read migration files', { error });
    throw error;
  }
}

/**
 * Get applied migrations from database
 */
async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query(
    `SELECT migration_id FROM ${MIGRATIONS_TABLE} ORDER BY applied_at`
  );
  
  return result.rows.map(row => row.migration_id);
}

/**
 * Apply a single migration
 */
async function applyMigration(pool: Pool, migration: Migration): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Execute migration SQL
    await client.query(migration.sql);
    
    // Record migration as applied
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (migration_id, filename) VALUES ($1, $2)`,
      [migration.id, migration.filename]
    );
    
    await client.query('COMMIT');
    
    logger.info('Migration applied successfully', {
      migrationId: migration.id,
      filename: migration.filename,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed', {
      migrationId: migration.id,
      filename: migration.filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run pending migrations
 */
async function runMigrations(): Promise<void> {
  const config = getDatabaseConfig();
  const pool = createDatabasePool(config);

  try {
    // Test connection
    await pool.query('SELECT 1');
    logger.info('Database connection established');

    // Create migrations table
    await createMigrationsTable(pool);

    // Get migrations
    const allMigrations = await getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(pool);

    // Find pending migrations
    const pendingMigrations = allMigrations.filter(
      migration => !appliedMigrations.includes(migration.id)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info('Running migrations', {
      pendingCount: pendingMigrations.length,
      migrations: pendingMigrations.map(m => m.id),
    });

    // Apply pending migrations
    for (const migration of pendingMigrations) {
      await applyMigration(pool, migration);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration process failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Show migration status
 */
async function showStatus(): Promise<void> {
  const config = getDatabaseConfig();
  const pool = createDatabasePool(config);

  try {
    await pool.query('SELECT 1');
    
    await createMigrationsTable(pool);
    
    const allMigrations = await getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(pool);

    console.log('\nMigration Status:');
    console.log('================');

    for (const migration of allMigrations) {
      const isApplied = appliedMigrations.includes(migration.id);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      console.log(`${status} ${migration.id} (${migration.filename})`);
    }

    const pendingCount = allMigrations.length - appliedMigrations.length;
    console.log(`\nTotal: ${allMigrations.length} migrations, ${pendingCount} pending\n`);
  } catch (error) {
    logger.error('Failed to show migration status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Reset database (DROP ALL TABLES - USE WITH CAUTION)
 */
async function resetDatabase(): Promise<void> {
  const config = getDatabaseConfig();
  const pool = createDatabasePool(config);

  try {
    console.log('⚠️  WARNING: This will drop all tables and data!');
    console.log('Only use this in development environments.');
    
    // In a real scenario, you'd want user confirmation here
    if (config.database.includes('prod')) {
      throw new Error('Cannot reset production database');
    }

    await pool.query('SELECT 1');
    
    // Drop all tables
    const dropTablesSQL = `
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO ${config.user};
      GRANT ALL ON SCHEMA public TO public;
    `;
    
    await pool.query(dropTablesSQL);
    logger.info('Database reset completed');
    
    // Run migrations after reset
    await pool.end();
    await runMigrations();
  } catch (error) {
    logger.error('Database reset failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    runMigrations();
    break;
  case 'status':
    showStatus();
    break;
  case 'reset':
    resetDatabase();
    break;
  default:
    console.log('Usage: npx tsx src/scripts/migrate.ts <command>');
    console.log('Commands:');
    console.log('  up, migrate  - Run pending migrations');
    console.log('  status       - Show migration status');
    console.log('  reset        - Reset database (development only)');
    process.exit(1);
}