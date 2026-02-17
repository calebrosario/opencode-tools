// PostgreSQL Adapter - Drizzle ORM Implementation
// Implements DatabaseAdapter interface using Drizzle ORM with PostgreSQL

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../util/logger";
import { Task, TaskFilters, OpenCodeError } from "../types";
import * as schema from "./schema";
import { DatabaseAdapter, DatabaseConfig } from "./database-adapter";
import type { TaskSelect } from "./schema";

export class PostgreSQLAdapter implements DatabaseAdapter {
  private db: ReturnType<typeof drizzle> | null = null;
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private initialized: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn("PostgreSQLAdapter already initialized");
      return;
    }

    try {
      if (this.pool) {
        await this.pool.end();
        logger.info("Closed existing PostgreSQL connection pool");
      }

      const connectionString =
        this.config.connectionString || this.buildConnectionString();

      this.pool = new Pool({
        connectionString,
        max: this.config.pool?.max || 20,
        idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000,
        connectionTimeoutMillis:
          this.config.pool?.connectionTimeoutMillis || 2000,
      });

      this.db = drizzle({
        client: this.pool,
        schema,
      });

      this.initialized = true;

      logger.info("✅ PostgreSQL adapter initialized with Drizzle ORM", {
        connectionString: this.maskConnectionString(connectionString),
        poolSize: this.config.pool?.max || 20,
      });
    } catch (error: unknown) {
      logger.error("❌ Failed to initialize PostgreSQL adapter", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info("PostgreSQL connection closed");
    }
    this.db = null;
    this.initialized = false;
  }

  async create(task: Task): Promise<Task> {
    this.ensureInitialized();

    try {
      const results = await this.db!.insert(schema.tasks)
        .values({
          id: task.id,
          name: task.name,
          status: task.status,
          owner: task.owner || null,
          metadata: task.metadata || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const newTask = results[0] ? this.rowToTask(results[0]) : null;

      if (!newTask) {
        throw new OpenCodeError(
          "TASK_CREATE_FAILED",
          "Failed to create task: no result returned",
        );
      }

      logger.info("Task created", {
        taskId: task.id,
        name: task.name,
        status: task.status,
      });

      return newTask;
    } catch (error) {
      logger.error("Failed to create task", { taskId: task.id, error });
      throw new OpenCodeError("TASK_CREATE_FAILED", "Failed to create task", {
        taskId: task.id,
        error,
      });
    }
  }

  async getById(id: string): Promise<Task | null> {
    this.ensureInitialized();

    try {
      const results = await this.db!.select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, id))
        .limit(1);

      return results[0] ? this.rowToTask(results[0]) : null;
    } catch (error) {
      logger.error("Failed to get task by ID", { taskId: id, error });
      throw new OpenCodeError("TASK_GET_FAILED", "Failed to get task", {
        taskId: id,
        error,
      });
    }
  }

  async list(filters: TaskFilters = {}): Promise<Task[]> {
    this.ensureInitialized();

    try {
      const whereConditions: ReturnType<typeof and>[] = [];

      if (filters.status) {
        whereConditions.push(eq(schema.tasks.status, filters.status));
      }
      if (filters.owner) {
        whereConditions.push(eq(schema.tasks.owner, filters.owner));
      }

      let query: any = this.db!.select().from(schema.tasks);

      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions));
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      query = query.orderBy(desc(schema.tasks.createdAt));

      const results = await query;
      return results.map((row: any) => this.rowToTask(row));
    } catch (error) {
      logger.error("Failed to list tasks", { error });
      throw new OpenCodeError("TASK_LIST_FAILED", "Failed to list tasks", {
        error,
      });
    }
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    this.ensureInitialized();

    try {
      const results = await this.db!.update(schema.tasks)
        .set({
          status: updates.status,
          owner: updates.owner || null,
          metadata: updates.metadata ? (updates.metadata as any) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.tasks.id, id))
        .returning();

      if (results.length === 0) {
        logger.warn("Task update affected 0 rows", { taskId: id });
        return null;
      }

      const updated = await this.getById(id);
      return updated;
    } catch (error) {
      logger.error("Failed to update task", { taskId: id, error });
      throw new OpenCodeError("TASK_UPDATE_FAILED", "Failed to update task", {
        taskId: id,
        error,
      });
    }
  }

  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const results = await this.db!.delete(schema.tasks)
        .where(eq(schema.tasks.id, id))
        .returning();

      const success = results.length > 0;

      if (success) {
        logger.info("Task deleted", { taskId: id });
      } else {
        logger.warn("Task delete affected 0 rows", { taskId: id });
      }

      return success;
    } catch (error) {
      logger.error("Failed to delete task", { taskId: id, error });
      throw new OpenCodeError("TASK_DELETE_FAILED", "Failed to delete task", {
        taskId: id,
        error,
      });
    }
  }

  async bulkCreate(tasks: Task[]): Promise<Task[]> {
    this.ensureInitialized();

    try {
      const values = tasks.map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        owner: task.owner || null,
        metadata: task.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const results = await this.db!.insert(schema.tasks)
        .values(values)
        .returning();

      logger.info("Bulk tasks created", { count: tasks.length });

      return results.map((row) => this.rowToTask(row));
    } catch (error) {
      logger.error("Failed to bulk create tasks", { error });
      throw new OpenCodeError(
        "TASK_BULK_CREATE_FAILED",
        "Failed to bulk create tasks",
        { error },
      );
    }
  }

  async count(filters: TaskFilters = {}): Promise<number> {
    this.ensureInitialized();

    try {
      let query = this.db!.select({ count: sql`count(*)` }).from(
        schema.tasks,
      ) as any;

      if (filters.status) {
        query = query.where(eq(schema.tasks.status, filters.status));
      }
      if (filters.owner) {
        query = query.where(eq(schema.tasks.owner, filters.owner));
      }

      const results = await query;
      const [{ count }] = results;
      return count || 0;
    } catch (error) {
      logger.error("Failed to count tasks", { error });
      throw new OpenCodeError("TASK_COUNT_FAILED", "Failed to count tasks", {
        error,
      });
    }
  }

  async executeRaw<T = any>(query: string, params?: any[]): Promise<T> {
    this.ensureInitialized();

    try {
      const result = await this.pool!.query(query, params);
      return result as T;
    } catch (error) {
      logger.error("Failed to execute raw SQL", { query, error });
      throw new OpenCodeError("QUERY_FAILED", "Failed to execute query", {
        query,
        error,
      });
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }

      const client = await this.pool.connect();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error("PostgreSQL health check failed", { error });
      return false;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new OpenCodeError(
        "DATABASE_NOT_INITIALIZED",
        "Database adapter not initialized. Call initialize() first.",
      );
    }
  }

  private buildConnectionString(): string {
    if (this.config.host && this.config.port && this.config.database) {
      return `postgresql://${this.config.username || "postgres"}:${
        this.config.password || ""
      }@${this.config.host}:${this.config.port}/${this.config.database}`;
    }
    return "postgresql://localhost:5432/opencode";
  }

  private maskConnectionString(connectionString: string): string {
    // Mask password in connection string for logging
    return connectionString.replace(/:[^:]*@/, ":***@");
  }

  private rowToTask(row: TaskSelect): Task {
    const dbRow = row as any;
    return {
      id: dbRow.id,
      name: dbRow.name,
      status: dbRow.status,
      owner: dbRow.owner || undefined,
      metadata: (dbRow.metadata as any) || undefined,
      createdAt:
        dbRow.createdAt instanceof Date
          ? dbRow.createdAt.toISOString()
          : new Date(String(dbRow.createdAt)).toISOString(),
      updatedAt:
        dbRow.updatedAt instanceof Date
          ? dbRow.updatedAt.toISOString()
          : new Date(String(dbRow.updatedAt)).toISOString(),
    };
  }
}
