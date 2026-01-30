// Task Lifecycle Hooks - Phase 2: MVP Core
// Week 12, Day 1-2: Task Lifecycle Hooks Implementation

import { logger } from '../util/logger';
import { TaskResult } from '../types/lifecycle';

// Hook type definitions
export type BeforeTaskStartHook = (taskId: string, agentId: string) => Promise<void>;
export type AfterTaskStartHook = (taskId: string, agentId: string) => Promise<void>;
export type BeforeTaskCompleteHook = (taskId: string, result: TaskResult) => Promise<void>;
export type AfterTaskCompleteHook = (taskId: string, result: TaskResult) => Promise<void>;
export type BeforeTaskFailHook = (taskId: string, error: string) => Promise<void>;
export type AfterTaskFailHook = (taskId: string, error: string) => Promise<void>;

interface Hook {
  id: string;
  type: string;
  fn: (...args: any[]) => Promise<void>;
  priority: number;
  registeredAt: Date;
}

/**
 * TaskLifecycleHooks - Manages all lifecycle hooks
 *
 * Hook execution order (by priority, lowest first):
 * 1. beforeTaskStart
 * 2. TaskLifecycle.startTask() executes
 * 3. afterTaskStart
 *
 * 4. beforeTaskComplete
 * 5. TaskLifecycle.completeTask() executes
 * 6. afterTaskComplete
 *
 * (Similar pattern for failTask)
 */
export class TaskLifecycleHooks {
  private static instance: TaskLifecycleHooks;

  private hooks: Map<string, Hook[]> = new Map();
  private hookCounter = 0;

  private constructor() {}

  public static getInstance(): TaskLifecycleHooks {
    if (!TaskLifecycleHooks.instance) {
      TaskLifecycleHooks.instance = new TaskLifecycleHooks();
    }
    return TaskLifecycleHooks.instance;
  }

  // Hook Registration

  /**
   * Register a hook to execute before a task starts
   * @param hook - Hook function to execute
   * @param priority - Lower numbers execute first (default: 10)
   */
  public registerBeforeTaskStart(hook: BeforeTaskStartHook, priority: number = 10): string {
    const hookId = this.registerHook('beforeTaskStart', hook, priority);
    logger.info('BeforeTaskStart hook registered', { hookId, priority });
    return hookId;
  }

  /**
   * Register a hook to execute after a task starts
   * @param hook - Hook function to execute
   * @param priority - Lower numbers execute first (default: 10)
   */
  public registerAfterTaskStart(hook: AfterTaskStartHook, priority: number = 10): string {
    const hookId = this.registerHook('afterTaskStart', hook, priority);
    logger.info('AfterTaskStart hook registered', { hookId, priority });
    return hookId;
  }

  /**
   * Register a hook to execute before a task completes
   * @param hook - Hook function to execute
   * @param priority - Lower numbers execute first (default: 10)
   */
  public registerBeforeTaskComplete(hook: BeforeTaskCompleteHook, priority: number = 10): string {
    const hookId = this.registerHook('beforeTaskComplete', hook, priority);
    logger.info('BeforeTaskComplete hook registered', { hookId, priority });
    return hookId;
  }

  /**
   * Register a hook to execute after a task completes
   * @param hook - Hook function to execute
   * @param priority - Lower numbers execute first (default: 10)
   */
  public registerAfterTaskComplete(hook: AfterTaskCompleteHook, priority: number = 10): string {
    const hookId = this.registerHook('afterTaskComplete', hook, priority);
    logger.info('AfterTaskComplete hook registered', { hookId, priority });
    return hookId;
  }

  /**
   * Register a hook to execute before a task fails
   * @param hook - Hook function to execute
   * @param priority - Lower numbers execute first (default: 10)
   */
  public registerBeforeTaskFail(hook: BeforeTaskFailHook, priority: number = 10): string {
    const hookId = this.registerHook('beforeTaskFail', hook, priority);
    logger.info('BeforeTaskFail hook registered', { hookId, priority });
    return hookId;
  }

  /**
   * Register a hook to execute after a task fails
   * @param hook - Hook function to execute
   * @param priority - Lower numbers execute first (default: 10)
   */
  public registerAfterTaskFail(hook: AfterTaskFailHook, priority: number = 10): string {
    const hookId = this.registerHook('afterTaskFail', hook, priority);
    logger.info('AfterTaskFail hook registered', { hookId, priority });
    return hookId;
  }

  // Hook Execution (called by TaskLifecycle)

  /**
   * Execute all beforeTaskStart hooks
   * Hooks execute in priority order (lowest first)
   */
  public async executeBeforeTaskStart(taskId: string, agentId: string): Promise<void> {
    await this.executeHooks('beforeTaskStart', taskId, agentId);
  }

  /**
   * Execute all afterTaskStart hooks
   * Hooks execute in priority order (lowest first)
   */
  public async executeAfterTaskStart(taskId: string, agentId: string): Promise<void> {
    await this.executeHooks('afterTaskStart', taskId, agentId);
  }

  /**
   * Execute all beforeTaskComplete hooks
   * Hooks execute in priority order (lowest first)
   */
  public async executeBeforeTaskComplete(taskId: string, result: TaskResult): Promise<void> {
    await this.executeHooks('beforeTaskComplete', taskId, result);
  }

  /**
   * Execute all afterTaskComplete hooks
   * Hooks execute in priority order (lowest first)
   */
  public async executeAfterTaskComplete(taskId: string, result: TaskResult): Promise<void> {
    await this.executeHooks('afterTaskComplete', taskId, result);
  }

  /**
   * Execute all beforeTaskFail hooks
   * Hooks execute in priority order (lowest first)
   */
  public async executeBeforeTaskFail(taskId: string, error: string): Promise<void> {
    await this.executeHooks('beforeTaskFail', taskId, error);
  }

  /**
   * Execute all afterTaskFail hooks
   * Hooks execute in priority order (lowest first)
   */
  public async executeAfterTaskFail(taskId: string, error: string): Promise<void> {
    await this.executeHooks('afterTaskFail', taskId, error);
  }

  // Hook Management

  /**
   * Unregister a hook by ID
   */
  public unregisterHook(hookId: string): void {
    for (const [type, hooks] of this.hooks.entries()) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        logger.info('Hook unregistered', { hookId, type });
        return;
      }
    }
    logger.warn('Hook not found for unregistration', { hookId });
  }

  /**
   * Get all registered hooks
   */
  public getAllHooks(): Hook[] {
    const allHooks: Hook[] = [];
    for (const hooks of this.hooks.values()) {
      allHooks.push(...hooks);
    }
    return allHooks;
  }

  /**
   * Get hooks of a specific type
   */
  public getHooksByType(type: string): Hook[] {
    return this.hooks.get(type) || [];
  }

  // Private Methods

  /**
   * Internal hook registration
   */
  private registerHook(type: string, fn: (...args: any[]) => Promise<void>, priority: number): string {
    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }

    const hookId = `hook_${this.hookCounter++}`;
    const hook: Hook = {
      id: hookId,
      type,
      fn,
      priority,
      registeredAt: new Date(),
    };

    const hooks = this.hooks.get(type)!;
    hooks.push(hook);

    // Sort by priority (lowest first)
    hooks.sort((a, b) => a.priority - b.priority);

    return hookId;
  }

  /**
   * Internal hook execution
   * Hooks execute sequentially in priority order
   * If a hook throws, it's logged but execution continues
   */
  private async executeHooks(type: string, ...args: any[]): Promise<void> {
    const hooks = this.hooks.get(type);

    if (!hooks || hooks.length === 0) {
      logger.debug(`No ${type} hooks to execute`);
      return;
    }

    logger.debug(`Executing ${type} hooks`, { count: hooks.length });

    for (const hook of hooks) {
      const startTime = Date.now();

      try {
        await hook.fn(...args);

        const duration = Date.now() - startTime;
        logger.debug(`Hook executed`, { hookId: hook.id, type, duration: `${duration}ms` });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(`Hook execution failed`, {
          hookId: hook.id,
          type,
          error: errorMessage,
          duration: `${duration}ms`,
        });

        // Continue executing remaining hooks even if one fails
        // Individual hooks should handle their own error recovery
      }
    }

    logger.debug(`All ${type} hooks executed`);
  }
}

// Export singleton instance
export const taskLifecycleHooks = TaskLifecycleHooks.getInstance();
