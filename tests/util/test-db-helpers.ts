// Test Database Helpers
// Week 17, Task 17.5: Test database isolation and utilities

import { DatabaseManager } from "../../src/persistence/database";
import * as schema from "../../src/persistence/schema";
import { sql } from "drizzle-orm";
import { logger } from "../../src/util/logger";

/**
 * Setup test database with isolation
 * Creates a fresh database connection and clears existing data
 */
export async function setupTestDatabase(): Promise<void> {
  const dbManager = DatabaseManager.getInstance();
  const db = dbManager.getDatabase();

  // Clear existing test data
  await db.delete(schema.tasks);
  logger.info("Test database cleared");
}

/**
 * Cleanup test database after tests
 * Clears all data but keeps connection pool open for subsequent tests
 */
export async function cleanupTestDatabase(): Promise<void> {
  const dbManager = DatabaseManager.getInstance();
  const db = dbManager.getDatabase();

  // Clear data but don't close connection - maintains singleton pattern
  await db.delete(schema.tasks);
  logger.info("Test database data cleared");
}

/**
 * Begin transaction for test isolation
 * All changes will be rolled back on test completion
 */
export async function beginTestTransaction(): Promise<void> {
  const dbManager = DatabaseManager.getInstance();
  const db = dbManager.getDatabase();

  await db.execute(sql`BEGIN`);
  logger.debug("Test transaction begun");
}

/**
 * Rollback transaction after test
 * Reverts all changes made during test
 */
export async function rollbackTestTransaction(): Promise<void> {
  const dbManager = DatabaseManager.getInstance();
  const db = dbManager.getDatabase();

  await db.execute(sql`ROLLBACK`);
  logger.debug("Test transaction rolled back");
}

/**
 * Seed test tasks into database
 * @param tasks - Array of tasks to insert
 */
export async function seedTestTasks(tasks: any[]): Promise<void> {
  const dbManager = DatabaseManager.getInstance();
  const db = dbManager.getDatabase();

  if (tasks.length === 0) {
    logger.debug("No tasks to seed");
    return;
  }

  await db.insert(schema.tasks).values(tasks);
  logger.info(`Seeded ${tasks.length} test tasks`);
}

/**
 * Create a test task with default values
 * @param id - Task ID
 * @param name - Task name
 * @param status - Task status
 * @param owner - Task owner
 * @returns Test task object
 */
export function createTestTask(
  id: string,
  name: string,
  status: string = "pending",
  owner?: string,
): any {
  return {
    id,
    name,
    status,
    owner: owner || null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
