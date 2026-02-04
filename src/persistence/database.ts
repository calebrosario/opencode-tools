// Database Manager - Phase 1: Critical Edge Cases
// This module will handle SQLite database operations with concurrency support

import Database from 'better-sqlite3';
import { logger } from '../util/logger';
import { DATABASE_PATH } from '../config';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private static instance: DatabaseManager;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // Ensure database directory exists
      mkdirSync(dirname(DATABASE_PATH), { recursive: true });

      // Initialize SQLite database
      this.db = new Database(DATABASE_PATH);

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');

      logger.info('✅ SQLite database initialized', {
        path: DATABASE_PATH,
        journalMode: 'WAL',
      });

      // Initialize tables (to be implemented)
      this.initializeTables();

    } catch (error: unknown) {
      logger.error('❌ Failed to initialize database', {
        error: error instanceof Error ? error.message : String(error),
        path: DATABASE_PATH,
      });
      throw error;
    }
  }

  private initializeTables(): void {
    if (!this.db) return;

    // Tasks table (Phase 2 - MVP Core)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        owner TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    `);

    logger.info('Database tables initialized');
  }

  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }
}

// Initialize Database Manager
DatabaseManager.getInstance().initialize().catch((error) => {
  logger.error('Failed to initialize Database Manager', { error: error instanceof Error ? error.message : String(error) });
});
