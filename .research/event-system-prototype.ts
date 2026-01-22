// Event System Prototype - Hook-based architecture
// Based on Week 3 research findings: EventEmitter + Emittery patterns

import { EventEmitter } from 'events';

// ============================================================================
// Interfaces
// ============================================================================

export interface HookOptions {
  timeout?: number;
  parallel?: boolean;
}

export interface HookResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  index?: number;
}

export interface TaskEvents {
  'before:task:create': { task: Task };
  'after:task:create': { task: Task };
  'before:task:complete': { task: Task };
  'after:task:complete': { task: Task };
  'before:task:update': { task: Task; changes: Partial<Task> };
  'after:task:update': { task: Task; changes: Partial<Task> };
}

export interface ContainerEvents {
  'before:container:start': { taskId: string; containerId: string };
  'after:container:start': { taskId: string; containerId: string };
  'before:container:stop': { taskId: string; containerId: string };
  'after:container:stop': { taskId: string; containerId: string };
  'before:container:remove': { taskId: string; containerId: string };
  'after:container:remove': { taskId: string; containerId: string };
}

export interface GitEvents {
  'before:git:commit': { task: Task; files: string[] };
  'after:git:commit': { task: Task; hash: string };
  'before:git:push': { task: Task; branch: string };
  'after:git:push': { task: Task; success: boolean };
}

export interface PlanEvents {
  'before:plan:execute': { task: Task; steps: string[] };
  'after:plan:execute': { task: Task; results: any[] };
  'before:plan:finalize': { task: Task; status: string };
  'after:plan:finalize': { task: Task; summary: string };
}

export type AllEvents = TaskEvents | ContainerEvents | GitEvents | PlanEvents;

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  containerId?: string;
  [key: string]: any;
}

// ============================================================================
// Hook System Class
// ============================================================================

export class HookSystem extends EventEmitter {
  private metrics = new Map<string, { count: number; totalTime: number; maxTime: number }>();
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Register a before hook for an event
   */
  before<T extends keyof AllEvents>(
    event: T,
    listener: (data: AllEvents[T]) => Promise<void> | void
  ): this {
    const eventName = `before:${event}` as string;
    this.on(eventName, listener);
    return this;
  }

  /**
   * Register an after hook for an event
   */
  after<T extends keyof AllEvents>(
    event: T,
    listener: (data: AllEvents[T]) => Promise<void> | void
  ): this {
    const eventName = `after:${event}` as string;
    this.on(eventName, listener);
    return this;
  }

  /**
   * Execute action with before/after hooks
   * 
   * Execution order:
   * 1. All before hooks (sequential, order preserved)
   * 2. Main action
   * 3. All after hooks (sequential, order preserved)
   * 
   * Error handling:
   * - Errors in before hooks stop execution
   * - Errors in after hooks are logged but don't stop
   */
  async execute<T extends keyof AllEvents>(
    event: T,
    action: (data: AllEvents[T]) => Promise<void>,
    data: AllEvents[T],
    options: HookOptions = {}
  ): Promise<void> {
    const { timeout = this.DEFAULT_TIMEOUT, parallel = false } = options;
    const startTime = performance.now();

    try {
      // Execute before hooks
      await this.runHooks(`before:${event}` as string, data, { timeout, parallel });

      // Execute main action
      await action(data);

      // Execute after hooks (continue even if one fails)
      await this.runHooks(`after:${event}` as string, data, { 
        timeout, 
        parallel,
        continueOnError: true 
      });
    } finally {
      // Update metrics
      this.updateMetrics(event as string, performance.now() - startTime);
    }
  }

  /**
   * Run hooks with error handling and timeout support
   */
  private async runHooks(
    event: string,
    data: any,
    options: { timeout: number; parallel: boolean; continueOnError: boolean } = {
      timeout: this.DEFAULT_TIMEOUT,
      parallel: false,
      continueOnError: false
    }
  ): Promise<void> {
    const listeners = this.listeners(event);
    if (listeners.length === 0) return;

    const { timeout, parallel, continueOnError } = options;
    const results: HookResult[] = [];

    if (parallel) {
      // Parallel execution (for non-dependent hooks)
      const promises = listeners.map((listener, index) =>
        this.runWithTimeout(listener, data, timeout).catch(error => ({
          success: false,
          error: error as Error,
          index
        }))
      );

      const parallelResults: any = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // Sequential execution (preserves order, default for hooks)
      for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i];
        
        try {
          const result = await this.runWithTimeout(listener, data, timeout);
          results.push({ success: true, data: result, index: i });
        } catch (error) {
          results.push({ success: false, error: error as Error, index: i });
          
          if (!continueOnError) {
            throw error; // Stop hook chain on first error
          }
        }
      }
    }

    // Log failed hooks
    const failedHooks = results.filter(r => !r.success);
    if (failedHooks.length > 0) {
      console.error(`[HookSystem] ${failedHooks.length} hooks failed for event '${event}':`);
      failedHooks.forEach(r => console.error(`  [${r.index}]`, r.error?.message));
    }
  }

  /**
   * Execute a hook with timeout protection
   */
  private async runWithTimeout<T>(
    listener: (data: any) => Promise<T> | T,
    data: any,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      Promise.resolve(listener(data)),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Hook timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Update metrics for a hook event
   */
  private updateMetrics(event: string, duration: number): void {
    const metrics = this.metrics.get(event) ?? { count: 0, totalTime: 0, maxTime: 0 };
    metrics.count++;
    metrics.totalTime += duration;
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    this.metrics.set(event, metrics);

    // Log slow hooks
    if (duration > 100) {
      console.warn(`[HookSystem] Slow hook '${event}': ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get metrics for all hook events
   */
  getMetrics(event?: string): Map<string, { count: number; totalTime: number; maxTime: number }> {
    if (event) {
      const metrics = this.metrics.get(event);
      return new Map([[event, metrics!]]);
    }
    return new Map(this.metrics);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Remove all hooks for an event
   */
  removeHooks<T extends keyof AllEvents>(event: T): this {
    this.removeAllListeners(`before:${event}` as string);
    this.removeAllListeners(`after:${event}` as string);
    return this;
  }
}

// ============================================================================
// Event Logger (for crash recovery)
// ============================================================================

export class EventLogger {
  private writeQueue: string[] = [];
  private writeInterval: NodeJS.Timeout | null = null;

  constructor(private logPath: string) {
    this.startBatchWriter();
  }

  /**
   * Start batch writer to flush events periodically
   */
  private startBatchWriter(): void {
    this.writeInterval = setInterval(() => {
      this.flush();
    }, 1000); // Flush every second
  }

  /**
   * Log an event
   */
  async log(event: string, data: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      data: JSON.stringify(data)
    };

    this.writeQueue.push(JSON.stringify(entry));
  }

  /**
   * Flush queue to disk
   */
  private async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return;

    const batch = this.writeQueue.join('\n') + '\n';
    this.writeQueue = [];

    await Bun.write(this.logPath, batch);
  }

  /**
   * Replay events from log
   */
  async replay(handler: (event: string, data: any) => Promise<void>): Promise<void> {
    const content = await Bun.file(this.logPath).text();
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const entry = JSON.parse(line);
      const data = JSON.parse(entry.data);
      await handler(entry.event, data);
    }
  }

  /**
   * Clear event log
   */
  async clear(): Promise<void> {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
    }
    await this.flush();
    await Bun.write(this.logPath, '');
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function exampleUsage() {
  // Initialize hook system
  const hooks = new HookSystem();

  // Register before/after hooks
  hooks.before('task:create', async (data) => {
    console.log('[Hook] Before task create:', data.task.title);
    data.task.id = crypto.randomUUID();
    data.task.createdAt = new Date();
  });

  hooks.after('task:create', async (data) => {
    console.log('[Hook] After task create:', data.task.id);
    await notifyTeam(data.task);
  });

  hooks.before('container:start', async (data) => {
    console.log('[Hook] Before container start:', data.containerId);
    await validateContainer(data.containerId);
  });

  hooks.after('container:start', async (data) => {
    console.log('[Hook] After container start:', data.containerId);
    await logContainerStart(data.containerId);
  });

  hooks.before('git:commit', async (data) => {
    console.log('[Hook] Before git commit:', data.files.length);
    await runLint(data.files);
  });

  hooks.after('git:commit', async (data) => {
    console.log('[Hook] After git commit:', data.hash);
    await triggerBuild(data.hash);
  });

  // Execute task creation with hooks
  const taskData: Task = {
    id: '',
    title: 'Build event system',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await hooks.execute('task:create', async (data) => {
    // Main action: create task in database
    console.log('[Action] Creating task:', data.task.title);
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, 10));
  }, { task: taskData });

  // Check metrics
  console.log('\n=== Hook Metrics ===');
  const metrics = hooks.getMetrics();
  for (const [event, stats] of metrics) {
    console.log(`${event}:`);
    console.log(`  Count: ${stats.count}`);
    console.log(`  Total time: ${stats.totalTime.toFixed(2)}ms`);
    console.log(`  Avg time: ${(stats.totalTime / stats.count).toFixed(2)}ms`);
    console.log(`  Max time: ${stats.maxTime.toFixed(2)}ms`);
  }
}

// Export for use in tests
export { exampleUsage };
