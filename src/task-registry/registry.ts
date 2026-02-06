// Task Registry - PostgreSQL Integration (Phase 1: Drizzle ORM)
// Week 17, Day 2-3: Refactor TaskRegistry for PostgreSQL with Drizzle

import { eq, and, or, desc, sql } from "drizzle-orm";
import { logger } from "../util/logger";
import { Task, TaskStatus, OpenCodeError, TaskFilters } from "../types";
import { DatabaseManager } from "../persistence/database";
import * as schema from "../persistence/schema";
import type { TaskSelect } from "../persistence/schema";

export class TaskRegistry {
  // Singleton instance for backward compatibility with existing code imports
  private static instance: TaskRegistry;
  private db: ReturnType<typeof DatabaseManager.prototype.getDatabase> | null =
    null;
  private ready: Promise<void> | null = null;
  private initializing: boolean = false;

  private constructor() {}

  public static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  private async ensureReady(): Promise<void> {
    // Guard against concurrent initialization attempts
    if (!this.ready && !this.initializing) {
      this.initializing = true;
      this.ready = this.initialize().finally(() => {
        this.initializing = false;
      });
    }
    if (this.ready) {
      await this.ready;
    }
  }

  public async initialize(): Promise<void> {
    try {
      const dbManager = DatabaseManager.getInstance();
      this.db = dbManager.getDatabase();

      logger.info("TaskRegistry initialized with Drizzle ORM");
    } catch (error) {
      logger.error("Failed to initialize TaskRegistry", { error });
      throw error;
    }
  }

  // CRUD Operations

  public async create(task: Task): Promise<Task> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    try {
      const results = await this.db
        .insert(schema.tasks)
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

  public async getById(id: string): Promise<Task | null> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    try {
      const results = await this.db
        .select()
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

  public async list(filters: TaskFilters = {}): Promise<Task[]> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    try {
      const whereConditions: ReturnType<typeof and>[] = [];

      if (filters.status) {
        whereConditions.push(eq(schema.tasks.status, filters.status));
      }
      if (filters.owner) {
        whereConditions.push(eq(schema.tasks.owner, filters.owner));
      }

      // Build query with optional conditions
      let query: any = this.db.select().from(schema.tasks);

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

  public async update(
    id: string,
    updates: Partial<Task>,
  ): Promise<Task | null> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    try {
      const results = await this.db
        .update(schema.tasks)
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

  public async delete(id: string): Promise<boolean> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    try {
      const results = await this.db
        .delete(schema.tasks)
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

  public async bulkCreate(tasks: Task[]): Promise<Task[]> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

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

      const results = await this.db
        .insert(schema.tasks)
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

  public async count(filters: TaskFilters = {}): Promise<number> {
    await this.ensureReady();

    if (!this.db) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    try {
      let query = this.db
        .select({ count: sql`count(*)` })
        .from(schema.tasks) as any;

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

  private rowToTask(row: TaskSelect): Task {
    const dbRow = row as any;
    return {
      id: dbRow.id,
      name: dbRow.name,
      status: dbRow.status as TaskStatus,
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

// Export singleton instance for backward compatibility
export const taskRegistry = TaskRegistry.getInstance();
