// Database Adapter Interface
// Abstraction layer for database operations, supporting multiple database backends
// (PostgreSQL, SQLite, etc.)

import { Task, TaskFilters } from "../types";

/**
 * DatabaseAdapter interface for abstracting database operations
 * Follows Repository pattern to enable swapping database backends
 *
 * Implementations:
 * - PostgreSQLAdapter: Uses Drizzle ORM with PostgreSQL
 * - SQLiteAdapter: Uses native SQLite (legacy, for migration compatibility)
 */
export interface DatabaseAdapter {
  /**
   * Initialize database connection and schema
   * @throws Error if connection fails
   */
  initialize(): Promise<void>;

  /**
   * Close database connection and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Create a new task
   * @param task - Task object to create
   * @returns Created task with generated fields
   * @throws Error if creation fails
   */
  create(task: Task): Promise<Task>;

  /**
   * Get task by ID
   * @param id - Task ID to retrieve
   * @returns Task object or null if not found
   * @throws Error if query fails
   */
  getById(id: string): Promise<Task | null>;

  /**
   * List tasks with optional filtering
   * @param filters - Optional filters for status, owner, limit, offset
   * @returns Array of tasks matching filters
   * @throws Error if query fails
   */
  list(filters?: TaskFilters): Promise<Task[]>;

  /**
   * Update task by ID
   * @param id - Task ID to update
   * @param updates - Partial task object with fields to update
   * @returns Updated task or null if not found
   * @throws Error if update fails
   */
  update(id: string, updates: Partial<Task>): Promise<Task | null>;

  /**
   * Delete task by ID
   * @param id - Task ID to delete
   * @returns true if deleted, false if not found
   * @throws Error if deletion fails
   */
  delete(id: string): Promise<boolean>;

  /**
   * Bulk create multiple tasks
   * @param tasks - Array of tasks to create
   * @returns Array of created tasks
   * @throws Error if bulk creation fails
   */
  bulkCreate(tasks: Task[]): Promise<Task[]>;

  /**
   * Count tasks with optional filtering
   * @param filters - Optional filters for status, owner
   * @returns Number of tasks matching filters
   * @throws Error if count fails
   */
  count(filters?: TaskFilters): Promise<number>;

  /**
   * Execute raw SQL query (for advanced use cases)
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query result
   * @throws Error if query fails
   */
  executeRaw<T = any>(query: string, params?: any[]): Promise<T>;

  /**
   * Get database connection health status
   * @returns true if connection is healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Database configuration interface
 * Supports multiple database types and connection settings
 */
export interface DatabaseConfig {
  /** Database type: postgresql, sqlite */
  type: "postgresql" | "sqlite";

  /** Connection string or file path */
  connectionString?: string;

  /** PostgreSQL-specific configuration */
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;

  /** Connection pool settings */
  pool?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };

  /** SQLite-specific configuration */
  file?: string;
  readonly?: boolean;
}

/**
 * Create database adapter from configuration
 * Factory function to instantiate appropriate adapter based on config
 *
 * @param config - Database configuration
 * @returns DatabaseAdapter instance
 * @throws Error if config is invalid
 */
export function createDatabaseAdapter(config: DatabaseConfig): DatabaseAdapter {
  // Import implementations dynamically to avoid circular dependencies
  if (config.type === "postgresql") {
    const { PostgreSQLAdapter } = require("./postgresql-adapter");
    return new PostgreSQLAdapter(config);
  } else if (config.type === "sqlite") {
    const { SQLiteAdapter } = require("./sqlite-adapter");
    return new SQLiteAdapter(config);
  }

  throw new Error(`Unsupported database type: ${config.type}`);
}
