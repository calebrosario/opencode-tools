import { logger } from "../util/logger";
import { Task, OpenCodeError, TaskFilters } from "../types";
import { DatabaseAdapter } from "../persistence/database-adapter";
import { createAdapterFromEnv } from "../config/database";

export class TaskRegistry {
  private static instance: TaskRegistry;
  private adapter: DatabaseAdapter | null = null;
  private ready: Promise<void> | null = null;
  private initializing: boolean = false;

  private constructor() {}

  public static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
      TaskRegistry.instance.ensureReady().catch((error) => {
        logger.error("Failed to auto-initialize TaskRegistry", { error });
      });
    }
    return TaskRegistry.instance;
  }

  public static setAdapter(adapter: DatabaseAdapter): void {
    const instance = TaskRegistry.getInstance();
    instance.adapter = adapter;
    logger.info("TaskRegistry adapter set manually");
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready && !this.initializing) {
      this.initializing = true;
      this.ready = this.initialize()
        .then(() => {})
        .catch((error) => {
          this.ready = null;
          throw error;
        })
        .finally(() => {
          this.initializing = false;
        });
    }
    if (this.ready) {
      await this.ready;
    }
  }

  public async initialize(): Promise<void> {
    try {
      if (!this.adapter) {
        this.adapter = createAdapterFromEnv();
      }
      await this.adapter.initialize();
      logger.info("TaskRegistry initialized with DatabaseAdapter");
    } catch (error) {
      logger.error("Failed to initialize TaskRegistry", { error });
      throw error;
    }
  }

  // CRUD Operations

  public async create(task: Task): Promise<Task> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.create(task);
  }

  public async getById(id: string): Promise<Task | null> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.getById(id);
  }

  public async list(filters: TaskFilters = {}): Promise<Task[]> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.list(filters);
  }

  public async update(
    id: string,
    updates: Partial<Task>,
  ): Promise<Task | null> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.update(id, updates);
  }

  public async delete(id: string): Promise<boolean> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.delete(id);
  }

  public async bulkCreate(tasks: Task[]): Promise<Task[]> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.bulkCreate(tasks);
  }

  public async count(filters: TaskFilters = {}): Promise<number> {
    await this.ensureReady();

    if (!this.adapter) {
      throw new OpenCodeError(
        "REGISTRY_NOT_INITIALIZED",
        "TaskRegistry not initialized",
      );
    }

    return this.adapter.count(filters);
  }
}

export const taskRegistry = TaskRegistry.getInstance();
