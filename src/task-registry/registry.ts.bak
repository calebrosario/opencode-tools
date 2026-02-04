// Task Registry - Phase 2: MVP Core
// Week 9, Day 1-2: Task Registry Implementation

import Database from 'better-sqlite3';
import { logger } from '../util/logger';
import { Task, TaskStatus, OpenCodeError } from '../types';
import { DatabaseManager } from '../persistence/database';

export interface TaskFilters {
  status?: TaskStatus;
  owner?: string;
  limit?: number;
  offset?: number;
}

export class TaskRegistry {
  private static instance: TaskRegistry;
  private db: Database.Database | null = null;

  private constructor() {}

  public static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const dbManager = DatabaseManager.getInstance();
      this.db = dbManager.getDatabase();

      logger.info('TaskRegistry initialized');
    } catch (error) {
      logger.error('Failed to initialize TaskRegistry', { error });
      throw error;
    }
  }

  // CRUD Operations

  public async create(task: Task): Promise<Task> {
    if (!this.db) {
      throw new OpenCodeError('REGISTRY_NOT_INITIALIZED', 'TaskRegistry not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (id, name, status, owner, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      stmt.run(
        task.id,
        task.name,
        task.status,
        task.owner || null,
        task.metadata ? JSON.stringify(task.metadata) : null,
        now,
        now
      );

      logger.info('Task created', { taskId: task.id, name: task.name, status: task.status });

      return task;
    } catch (error) {
      logger.error('Failed to create task', { taskId: task.id, error });
      throw new OpenCodeError('TASK_CREATE_FAILED', 'Failed to create task', { taskId: task.id, error });
    }
  }

  public async getById(id: string): Promise<Task | null> {
    if (!this.db) {
      throw new OpenCodeError('REGISTRY_NOT_INITIALIZED', 'TaskRegistry not initialized');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.rowToTask(row);
    } catch (error) {
      logger.error('Failed to get task', { taskId: id, error });
      throw new OpenCodeError('TASK_GET_FAILED', 'Failed to get task', { taskId: id, error });
    }
  }

  public async update(id: string, updates: Partial<Task>): Promise<Task> {
    if (!this.db) {
      throw new OpenCodeError('REGISTRY_NOT_INITIALIZED', 'TaskRegistry not initialized');
    }

    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new OpenCodeError('TASK_NOT_FOUND', 'Task not found', { taskId: id });
      }

      const updatesObj: any = {};
      if (updates.name !== undefined) updatesObj.name = updates.name;
      if (updates.status !== undefined) updatesObj.status = updates.status;
      if (updates.owner !== undefined) updatesObj.owner = updates.owner;
      if (updates.metadata !== undefined) updatesObj.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;

      const setClause = Object.keys(updatesObj).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updatesObj), id];

      const stmt = this.db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`);
      stmt.run(...values);

      const updated = await this.getById(id);
      if (!updated) {
        throw new OpenCodeError('TASK_UPDATE_FAILED', 'Failed to update task', { taskId: id });
      }

      logger.info('Task updated', { taskId: id, updates: Object.keys(updatesObj) });

      return updated;
    } catch (error) {
      logger.error('Failed to update task', { taskId: id, error });
      throw new OpenCodeError('TASK_UPDATE_FAILED', 'Failed to update task', { taskId: id, error });
    }
  }

  public async delete(id: string): Promise<void> {
    if (!this.db) {
      throw new OpenCodeError('REGISTRY_NOT_INITIALIZED', 'TaskRegistry not initialized');
    }

    try {
      const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new OpenCodeError('TASK_NOT_FOUND', 'Task not found', { taskId: id });
      }

      logger.info('Task deleted', { taskId: id });
    } catch (error) {
      logger.error('Failed to delete task', { taskId: id, error });
      throw new OpenCodeError('TASK_DELETE_FAILED', 'Failed to delete task', { taskId: id, error });
    }
  }

  public async list(filters?: TaskFilters): Promise<Task[]> {
    if (!this.db) {
      throw new OpenCodeError('REGISTRY_NOT_INITIALIZED', 'TaskRegistry not initialized');
    }

    try {
      let query = 'SELECT * FROM tasks';
      const params: any[] = [];
      const conditions: string[] = [];

      if (filters?.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }

      if (filters?.owner) {
        conditions.push('owner = ?');
        params.push(filters.owner);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => this.rowToTask(row));
    } catch (error) {
      logger.error('Failed to list tasks', { filters, error });
      throw new OpenCodeError('TASK_LIST_FAILED', 'Failed to list tasks', { filters, error });
    }
  }

  // Query Operations

  public async getByStatus(status: TaskStatus): Promise<Task[]> {
    return this.list({ status });
  }

  public async getByOwner(owner: string): Promise<Task[]> {
    return this.list({ owner });
  }

  public async getRecent(limit: number = 100): Promise<Task[]> {
    return this.list({ limit });
  }

  // Batch Operations

  public async bulkInsert(tasks: Task[]): Promise<Task[]> {
    if (!this.db) {
      throw new OpenCodeError('REGISTRY_NOT_INITIALIZED', 'TaskRegistry not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO tasks (id, name, status, owner, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const insertedTasks: Task[] = [];

      this.db.transaction(() => {
        for (const task of tasks) {
          stmt.run(
            task.id,
            task.name,
            task.status,
            task.owner || null,
            task.metadata ? JSON.stringify(task.metadata) : null,
            now,
            now
          );
          insertedTasks.push(task);
        }
      })();

      logger.info('Tasks bulk inserted', { count: tasks.length });

      return insertedTasks;
    } catch (error) {
      logger.error('Failed to bulk insert tasks', { count: tasks.length, error });
      throw new OpenCodeError('TASK_BULK_INSERT_FAILED', 'Failed to bulk insert tasks', { count: tasks.length, error });
    }
  }

  public async bulkUpdate(updates: Array<{id: string, changes: Partial<Task>}>): Promise<Task[]> {
    const updatedTasks: Task[] = [];

    for (const { id, changes } of updates) {
      const task = await this.update(id, changes);
      updatedTasks.push(task);
    }

    logger.info('Tasks bulk updated', { count: updates.length });

    return updatedTasks;
  }

  // Lifecycle Operations

  public async markRunning(id: string): Promise<Task> {
    return this.update(id, { status: 'running' });
  }

  public async markCompleted(id: string): Promise<Task> {
    return this.update(id, { status: 'completed' });
  }

  public async markFailed(id: string, error: string): Promise<Task> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new OpenCodeError('TASK_NOT_FOUND', 'Task not found', { taskId: id });
    }

    const metadata = existing.metadata || {};
    metadata.error = error;

    return this.update(id, { status: 'failed', metadata });
  }

  // Helper Methods

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      name: row.name,
      status: row.status as TaskStatus,
      owner: row.owner || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Export singleton instance
export const taskRegistry = TaskRegistry.getInstance();
