// Task Registry - PostgreSQL Integration (Phase 1: Drizzle ORM)
// Week 17, Day 2-3: Refactor TaskRegistry for PostgreSQL with Drizzle

import { eq, and, or, desc, sql } from "drizzle-orm";
import { logger } from "../util/logger";
import { Task, TaskStatus, OpenCodeError, TaskFilters } from "../types";
import { DatabaseManager } from "../persistence/database";
import * as schema from "../persistence/schema";

export interface TaskFilters {
  status?: TaskStatus;
  owner?: string;
  limit?: number;
  offset?: number;
}

export class TaskRegistry {
  private static instance: TaskRegistry;
  private db: ReturnType<typeof DatabaseManager.prototype.getDatabase> | null =
    null;
  private ready: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
      // Auto-initialize when instance is created
      TaskRegistry.instance.ready = TaskRegistry.instance
        .initialize()
        .catch((err) => {
          logger.error("Failed to auto-initialize TaskRegistry", { err });
          throw err;
        });
    }
    return TaskRegistry.instance;
  }

  private async ensureReady(): Promise<void> {
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
      const [newTask] = await this.db
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
      const [result] = await this.db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, id))
        .limit(1);

      return result.length > 0 ? this.rowToTask(result[0]) : null;
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
      let query = this.db.select().from(schema.tasks);

      if (filters.status) {
        query = query.where(eq(schema.tasks.status, filters.status));
      }
      if (filters.owner) {
        query = query.where(eq(schema.tasks.owner, filters.owner));
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      query = query.orderBy(desc(schema.tasks.createdAt));

      const results = await query;
      return results.map((row) => this.rowToTask(row));
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
      const [result] = await this.db
        .update(schema.tasks)
        .set({
          status: updates.status,
          owner: updates.owner || null,
          metadata: updates.metadata ? JSON.stringify(updates.metadata) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.tasks.id, id))
        .returning();

      if (result.length === 0) {
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
      const [result] = await this.db
        .delete(schema.tasks)
        .where(eq(schema.tasks.id, id))
        .returning();

      const success = result.length > 0;

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

      const [result] = await this.db
        .insert(schema.tasks)
        .values(values)
        .returning();

      logger.info("Bulk tasks created", { count: tasks.length });

      return result;
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
        .select({ count: sql`count(*)::int` })
        .from(schema.tasks);

      if (filters.status) {
        query = query.where(eq(schema.tasks.status, filters.status));
      }
      if (filters.owner) {
        query = query.where(eq(schema.tasks.owner, filters.owner));
      }

      const [result] = await query;
      return result[0]?.count || 0;
    } catch (error) {
      logger.error("Failed to count tasks", { error });
      throw new OpenCodeError("TASK_COUNT_FAILED", "Failed to count tasks", {
        error,
      });
    }
  }

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      name: row.name,
      status: row.status as TaskStatus,
      owner: row.owner,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
