// Database Manager - PostgreSQL Integration (Phase 1: Drizzle ORM)
// This module now uses Drizzle ORM for PostgreSQL database operations

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { logger } from "../util/logger";
import * as schema from "./schema";

export class DatabaseManager {
  private db: ReturnType<typeof drizzle> | null = null;
  private pool: Pool | null = null;
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
      // Close existing pool before creating new one to prevent memory leaks
      if (this.pool) {
        await this.pool.end();
        logger.info("Closed existing database connection pool");
      }

      // Create connection pool for PostgreSQL
      this.pool = new Pool({
        connectionString:
          process.env.DATABASE_URL || "postgresql://localhost:5432/opencode",
        max: 20, // Maximum number of connections
        idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
        connectionTimeoutMillis: 2000, // Connection timeout 2 seconds
      });

      // Initialize Drizzle ORM with schema
      this.db = drizzle({
        client: this.pool,
        schema,
      });

      logger.info("✅ PostgreSQL database initialized with Drizzle ORM", {
        url: process.env.DATABASE_URL || "postgresql://localhost:5432/opencode",
        poolSize: 20,
      });

      // Create tables automatically via Drizzle migrations
      // (Migrations will be run separately)
    } catch (error: unknown) {
      logger.error("❌ Failed to initialize PostgreSQL database", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public getDatabase(): ReturnType<typeof drizzle> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info("Database connection closed");
    }
    this.db = null;
  }
}

// Initialize Database Manager (crashes app on failure - database is critical)
DatabaseManager.getInstance()
  .initialize()
  .catch((error) => {
    logger.error(
      "CRITICAL: Failed to initialize Database Manager - database is required",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
    // Database is critical infrastructure - crash app if initialization fails
    // This prevents silent failures where app continues with broken database
    process.exit(1);
  });
