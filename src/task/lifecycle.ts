import { Task, TaskStatus } from "../types";
import type { TaskConfig, TaskResult } from "../types/lifecycle";
import { taskRegistry } from "../task-registry/registry";
import { multiLayerPersistence } from "../persistence/multi-layer";
import { logger } from "../util/logger";
import { lockManager } from "../util/lock-manager";
import { taskLifecycleHooks } from "../hooks/task-lifecycle";
import { taskMetrics } from "../monitoring/metrics";
import { TaskErrors } from "../util/errors-custom";
import { LOCK_PREFIX } from "../util/task-lifecycle-constants";

export class TaskLifecycle {
  private static instance: TaskLifecycle;

  private constructor() {}

  public static getInstance(): TaskLifecycle {
    if (!TaskLifecycle.instance) {
      TaskLifecycle.instance = new TaskLifecycle();
    }
    return TaskLifecycle.instance;
  }

  private async getTaskOrThrow(taskId: string): Promise<Task> {
    const task = await taskRegistry.getById(taskId);
    if (!task) {
      throw TaskErrors.taskNotFound(taskId);
    }
    return task;
  }

  private async executeTransition<T>(
    taskId: string,
    transitionType: "start" | "complete" | "fail" | "cancel" | "delete",
    lockOwner: string,
    transitionFn: (task: Task) => Promise<T>,
  ): Promise<T>;
  private async executeTransition(
    taskId: string,
    transitionType: "delete",
    lockOwner: string,
    transitionFn: (task: Task) => Promise<void>,
  ): Promise<void>;
  private async executeTransition<T>(
    taskId: string,
    transitionType: "start" | "complete" | "fail" | "cancel" | "delete",
    lockOwner: string,
    transitionFn: (task: Task) => Promise<T>,
  ): Promise<T> {
    const task = await this.getTaskOrThrow(taskId);

    return lockManager.withLock(
      `${LOCK_PREFIX.TASK}${taskId}`,
      `${LOCK_PREFIX.LIFECYCLE}${lockOwner}`,
      async () => {
        const result = await transitionFn(task);
        return result;
      },
    );
  }

  /**
   * Create a new task
   */
  public async createTask(config: TaskConfig): Promise<Task> {
    const taskId = config.id || `task_${Date.now()}`;
    const owner = config.owner || "system";
    const timerId = taskMetrics.startTimer({ operation: "create" });

    try {
      return await lockManager.withLock(
        `task:${taskId}`,
        `lifecycle:${owner}`,
        async () => {
          // Create task object
          const task: Task = {
            id: taskId,
            name: config.name,
            status: "pending",
            owner,
            metadata: config.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Save to registry
          await taskRegistry.create(task);

          // Initialize persistence layers
          await this.initializePersistence(taskId, task);

          // Track metrics
          taskMetrics.created({ status: "pending" });
          taskMetrics.stopTimer(timerId);

          logger.info("Task created", { taskId, name: task.name, owner });

          return task;
        },
      );
    } catch (error) {
      taskMetrics.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Start a task (transition: pending -> running)
   * Executes: beforeTaskStart hooks -> start -> afterTaskStart hooks
   */
  public async startTask(taskId: string, agentId: string): Promise<Task> {
    await taskLifecycleHooks.executeBeforeTaskStart(taskId, agentId);

    return this.executeTransition(taskId, "start", agentId, async (task) => {
      if (task.status === "running") {
        throw TaskErrors.taskAlreadyStarted(taskId);
      }
      if (task.status !== "pending") {
        throw TaskErrors.invalidStateTransition(taskId, task.status, "running");
      }

      const updated = await taskRegistry.update(taskId, {
        status: "running",
      });
      if (!updated) {
        throw TaskErrors.taskUpdateFailed(taskId);
      }

      logger.info("Task started", { taskId, agentId });
      await taskLifecycleHooks.executeAfterTaskStart(taskId, agentId);

      return updated;
    });
  }

  /**
   * Complete a task (transition: running -> completed)
   * Executes: beforeTaskComplete hooks -> complete -> afterTaskComplete hooks
   */
  public async completeTask(taskId: string, result: TaskResult): Promise<Task> {
    await taskLifecycleHooks.executeBeforeTaskComplete(taskId, result);

    const timerId = taskMetrics.startTimer({ operation: "complete" });

    try {
      const completedTask = await this.executeTransition(
        taskId,
        "complete",
        "system",
        async (task) => {
          if (task.status === "completed") {
            throw TaskErrors.taskAlreadyCompleted(taskId);
          }
          if (task.status !== "running") {
            throw TaskErrors.invalidStateTransition(
              taskId,
              task.status,
              "completed",
            );
          }

          const updated = await taskRegistry.update(taskId, {
            status: "completed",
          });
          if (!updated) {
            throw TaskErrors.taskUpdateFailed(taskId);
          }

          await multiLayerPersistence.appendLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Task completed successfully",
            data: { result },
          });

          taskMetrics.completed({ status: "completed" });
          logger.info("Task completed", { taskId, result });
          await taskLifecycleHooks.executeAfterTaskComplete(taskId, result);

          return updated;
        },
      );

      taskMetrics.stopTimer(timerId);
      return completedTask;
    } catch (error) {
      taskMetrics.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Fail a task (transition: running -> failed)
   * Executes: beforeTaskFail hooks -> fail -> afterTaskFail hooks
   */
  public async failTask(taskId: string, error: string): Promise<Task> {
    await taskLifecycleHooks.executeBeforeTaskFail(taskId, error);

    const timerId = taskMetrics.startTimer({ operation: "fail" });

    try {
      const failedTask = await this.executeTransition(
        taskId,
        "fail",
        "system",
        async (task) => {
          if (task.status === "failed") {
            throw TaskErrors.taskAlreadyFailed(taskId);
          }
          if (task.status !== "running") {
            throw TaskErrors.invalidStateTransition(
              taskId,
              task.status,
              "failed",
            );
          }

          const updated = await taskRegistry.update(taskId, {
            status: "failed",
            metadata: { error },
          });
          if (!updated) {
            throw TaskErrors.taskUpdateFailed(taskId);
          }

          await multiLayerPersistence.appendLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "error",
            message: "Task failed",
            data: { error },
          });

          taskMetrics.failed({ status: "failed" });
          logger.error("Task failed", { taskId, error });
          await taskLifecycleHooks.executeAfterTaskFail(taskId, error);

          return updated;
        },
      );

      taskMetrics.stopTimer(timerId);
      return failedTask;
    } catch (error) {
      taskMetrics.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Cancel a task (transition: pending -> cancelled or running -> cancelled)
   */
  public async cancelTask(taskId: string): Promise<Task> {
    const timerId = taskMetrics.startTimer({ operation: "cancel" });

    try {
      const cancelledTask = await this.executeTransition(
        taskId,
        "cancel",
        "system",
        async (task) => {
          if (task.status === "cancelled") {
            throw TaskErrors.taskAlreadyCancelled(taskId);
          }
          if (!["pending", "running"].includes(task.status)) {
            throw TaskErrors.invalidStateTransition(
              taskId,
              task.status,
              "cancelled",
            );
          }

          const updated = await taskRegistry.update(taskId, {
            status: "cancelled",
          });
          if (!updated) {
            throw TaskErrors.taskUpdateFailed(taskId);
          }

          await multiLayerPersistence.appendLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "warning",
            message: "Task cancelled",
            data: { fromStatus: task.status },
          });

          taskMetrics.cancelled({ status: "cancelled" });
          logger.warn("Task cancelled", { taskId });

          return updated;
        },
      );

      taskMetrics.stopTimer(timerId);
      return cancelledTask;
    } catch (error) {
      taskMetrics.stopTimer(timerId);
      throw error;
    }
  }

  /**
   * Delete a task (transition: any status -> deleted)
   */
  public async deleteTask(taskId: string): Promise<void> {
    await this.executeTransition(taskId, "delete", "system", async (task) => {
      await taskRegistry.delete(taskId);
      await multiLayerPersistence.cleanup(taskId);
      logger.info("Task deleted", { taskId });
    });
  }

  public async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const task = await this.getTaskOrThrow(taskId);
    return task.status;
  }

  /**
   * Initialize persistence layers for a new task
   */
  private async initializePersistence(
    taskId: string,
    task: Task,
  ): Promise<void> {
    // Save initial state
    await multiLayerPersistence.saveState(taskId, {
      taskId,
      status: task.status,
      data: task.metadata || {},
      lastUpdated: task.updatedAt.toISOString(),
    });

    // Log task creation
    await multiLayerPersistence.appendLog(taskId, {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Task created",
      data: { name: task.name, owner: task.owner },
    });
  }
}

// Export singleton instance
export const taskLifecycle = TaskLifecycle.getInstance();
