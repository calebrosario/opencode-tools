// Task Lifecycle Manager - Phase 2: MVP Core
// Week 9, Day 4: Task Lifecycle Implementation
// Week 12, Day 1: Hooks Integration

import { Task, TaskStatus } from "../types";
import type { TaskConfig, TaskResult } from "../types/lifecycle";
import { taskRegistry } from "../task-registry/registry";
import { multiLayerPersistence } from "../persistence/multi-layer";
import { logger } from "../util/logger";
import { lockManager } from "../util/lock-manager";
import { taskLifecycleHooks } from "../hooks/task-lifecycle";
import { taskMetrics } from "../monitoring/metrics";

export class TaskLifecycle {
  private static instance: TaskLifecycle;

  private constructor() {}

  public static getInstance(): TaskLifecycle {
    if (!TaskLifecycle.instance) {
      TaskLifecycle.instance = new TaskLifecycle();
    }
    return TaskLifecycle.instance;
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
    // Execute before hooks
    await taskLifecycleHooks.executeBeforeTaskStart(taskId, agentId);

    return lockManager.withLock(
      `task:${taskId}`,
      `lifecycle:${agentId}`,
      async () => {
        const task = await taskRegistry.getById(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }

        // Validate state transition
        if (task!.status !== "pending") {
          throw new Error(`Cannot start task with status: ${task!.status}`);
        }

        // Update task status
        const updated = await taskRegistry.update(taskId, {
          status: "running",
        });
        if (!updated) {
          throw new Error(`Failed to update task: ${taskId}`);
        }

        // Log state transition
        await multiLayerPersistence.appendLog(taskId, {
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Task started by agent ${agentId}`,
          data: { fromStatus: task.status, toStatus: "running", agentId },
        });

        logger.info("Task started", { taskId, agentId });

        // Execute after hooks
        await taskLifecycleHooks.executeAfterTaskStart(taskId, agentId);

        return updated!;
      },
    );
  }

  /**
   * Complete a task (transition: running -> completed)
   * Executes: beforeTaskComplete hooks -> complete -> afterTaskComplete hooks
   */
  public async completeTask(taskId: string, result: TaskResult): Promise<Task> {
    // Execute before hooks
    await taskLifecycleHooks.executeBeforeTaskComplete(taskId, result);

    const task = await taskRegistry.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const timerId = taskMetrics.startTimer({ operation: "complete" });

    try {
      return await lockManager.withLock(
        `task:${taskId}`,
        `lifecycle:${task.owner || "system"}`,
        async () => {
          // Validate state transition
          if (task!.status !== "running") {
            throw new Error(
              `Cannot complete task with status: ${task!.status}`,
            );
          }

          // Update task status
          const updated = await taskRegistry.update(taskId, {
            status: "completed",
          });
          if (!updated) {
            throw new Error(`Failed to update task: ${taskId}`);
          }

          // Save result to persistence
          await multiLayerPersistence.appendLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Task completed successfully",
            data: { result },
          });

          // Track metrics
          taskMetrics.completed({ status: "completed" });
          taskMetrics.stopTimer(timerId);

          logger.info("Task completed", { taskId, result });

          // Execute after hooks
          await taskLifecycleHooks.executeAfterTaskComplete(taskId, result);

          return updated!;
        },
      );
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
    // Execute before hooks
    await taskLifecycleHooks.executeBeforeTaskFail(taskId, error);

    const task = await taskRegistry.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const timerId = taskMetrics.startTimer({ operation: "fail" });

    try {
      return await lockManager.withLock(
        `task:${taskId}`,
        `lifecycle:${task.owner || "system"}`,
        async () => {
          // Validate state transition
          if (task!.status !== "running") {
            throw new Error(`Cannot fail task with status: ${task!.status}`);
          }

          // Update task status
          const updated = await taskRegistry.update(taskId, {
            status: "failed",
            metadata: { error },
          });
          if (!updated) {
            throw new Error(`Failed to update task: ${taskId}`);
          }

          // Save error to persistence
          await multiLayerPersistence.appendLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "error",
            message: "Task failed",
            data: { error },
          });

          // Track metrics
          taskMetrics.failed({ status: "failed" });
          taskMetrics.stopTimer(timerId);

          logger.error("Task failed", { taskId, error });

          // Execute after hooks
          await taskLifecycleHooks.executeAfterTaskFail(taskId, error);

          return updated!;
        },
      );
    } catch (err) {
      taskMetrics.stopTimer(timerId);
      throw err;
    }
  }

  /**
   * Cancel a task (transition: pending -> cancelled or running -> cancelled)
   */
  public async cancelTask(taskId: string): Promise<Task> {
    const task = await taskRegistry.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const timerId = taskMetrics.startTimer({ operation: "cancel" });

    try {
      return await lockManager.withLock(
        `task:${taskId}`,
        `lifecycle:${task!.owner || "system"}`,
        async () => {
          // Validate state transition
          if (!["pending", "running"].includes(task!.status)) {
            throw new Error(`Cannot cancel task with status: ${task!.status}`);
          }

          // Update task status
          const updated = await taskRegistry.update(taskId, {
            status: "cancelled",
          });
          if (!updated) {
            throw new Error(`Failed to update task: ${taskId}`);
          }

          // Log cancellation
          await multiLayerPersistence.appendLog(taskId, {
            timestamp: new Date().toISOString(),
            level: "warning",
            message: "Task cancelled",
            data: { fromStatus: task!.status },
          });

          // Track metrics
          taskMetrics.cancelled({ status: "cancelled" });
          taskMetrics.stopTimer(timerId);

          logger.warn("Task cancelled", { taskId });

          return updated!;
        },
      );
    } catch (err) {
      taskMetrics.stopTimer(timerId);
      throw err;
    }
  }

  /**
   * Delete a task (transition: any status -> deleted)
   */
  public async deleteTask(taskId: string): Promise<void> {
    const task = await taskRegistry.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    return lockManager.withLock(
      `task:${taskId}`,
      `lifecycle:${task.owner || "system"}`,
      async () => {
        // Delete from registry
        await taskRegistry.delete(taskId);

        // Cleanup persistence
        await multiLayerPersistence.cleanup(taskId);

        logger.info("Task deleted", { taskId });
      },
    );
  }

  /**
   * Get task status
   */
  public async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const task = await taskRegistry.getById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

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
