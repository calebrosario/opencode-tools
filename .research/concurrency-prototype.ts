/**
 * Concurrency Model Prototype
 *
 * This module implements optimistic locking for Docker task management
 * to support multiple concurrent agents working on the same task.
 *
 * Key Features:
 * - Optimistic locking with version-based conflict detection
 * - Exclusive vs Collaborative lock modes
 * - Lock timeout and renewal mechanisms
 * - Conflict detection and resolution
 * - Backoff and retry strategies
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum LockMode {
  /** Single agent has exclusive access to task */
  EXCLUSIVE = 'exclusive',

  /** Multiple agents can collaborate on same task with conflict detection */
  COLLABORATIVE = 'collaborative',
}

export enum LockStatus {
  ACQUIRED = 'acquired',
  RELEASED = 'released',
  EXPIRED = 'expired',
  CONFLICT = 'conflict',
  TIMEOUT = 'timeout',
}

export interface Lock {
  taskId: string;
  agentId: string;
  mode: LockMode;
  version: number;
  acquiredAt: Date;
  expiresAt: Date;
  lastRenewedAt: Date;
}

export interface LockAcquisitionOptions {
  mode?: LockMode;
  timeout?: number; // milliseconds
  retry?: {
    maxAttempts?: number;
    backoffMs?: number;
  };
}

export interface LockResult {
  success: boolean;
  lock?: Lock;
  status?: LockStatus;
  conflict?: ConflictInfo;
}

export interface ConflictInfo {
  conflictWith: string;
  expectedVersion: number;
  actualVersion: number;
  operation: string;
}

// ============================================================================
// OPTIMISTIC LOCKING ENGINE
// ============================================================================

export class OptimisticLockEngine {
  private locks: Map<string, Lock> = new Map();
  private taskVersions: Map<string, number> = new Map();

  /**
   * Attempt to acquire lock on a task
   */
  async acquireLock(
    taskId: string,
    agentId: string,
    options: LockAcquisitionOptions = {}
  ): Promise<LockResult> {
    const {
      mode = LockMode.EXCLUSIVE,
      timeout = 30000, // 30 seconds default
      retry = {
        maxAttempts: 3,
        backoffMs: 100,
      },
    } = options;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < retry.maxAttempts) {
      try {
        const result = await this.tryAcquire(taskId, agentId, mode, timeout);

        if (result.success) {
          return result;
        }

        if (result.status === LockStatus.CONFLICT) {
          // Conflict is not retryable with same operation
          return result;
        }

        // Backoff before retry
        await this.sleep(retry.backoffMs * (attempt + 1));
      } catch (error) {
        lastError = error as Error;
      }

      attempt++;
    }

    return {
      success: false,
      status: LockStatus.TIMEOUT,
      lock: undefined,
    };
  }

  /**
   * Try to acquire lock (single attempt)
   */
  private async tryAcquire(
    taskId: string,
    agentId: string,
    mode: LockMode,
    timeout: number
  ): Promise<LockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeout);

    // Check if task has version
    const currentVersion = this.taskVersions.get(taskId) ?? 0;
    const existingLock = this.locks.get(taskId);

    // Validate existing lock
    if (existingLock) {
      // Check if lock is expired
      if (existingLock.expiresAt <= now) {
        // Lock expired, clean it up
        this.locks.delete(taskId);
      } else if (existingLock.agentId === agentId) {
        // Same agent, allow renewal
        existingLock.expiresAt = expiresAt;
        existingLock.lastRenewedAt = now;
        return {
          success: true,
          lock: existingLock,
          status: LockStatus.ACQUIRED,
        };
      } else if (mode === LockMode.EXCLUSIVE) {
        // Different agent, exclusive mode: conflict
        return {
          success: false,
          status: LockStatus.CONFLICT,
          conflict: {
            conflictWith: existingLock.agentId,
            expectedVersion: existingLock.version,
            actualVersion: currentVersion,
            operation: 'acquire_exclusive_lock',
          },
        };
      } else if (mode === LockMode.COLLABORATIVE) {
        // Collaborative mode: allow multiple agents
        // Check for version conflict
        const newVersion = currentVersion + 1;
        const lock: Lock = {
          taskId,
          agentId,
          mode: LockMode.COLLABORATIVE,
          version: newVersion,
          acquiredAt: now,
          expiresAt,
          lastRenewedAt: now,
        };

        this.locks.set(taskId, lock);
        this.taskVersions.set(taskId, newVersion);

        return {
          success: true,
          lock,
          status: LockStatus.ACQUIRED,
        };
      }
    }

    // No existing lock, create new one
    const newVersion = currentVersion + 1;
    const lock: Lock = {
      taskId,
      agentId,
      mode,
      version: newVersion,
      acquiredAt: now,
      expiresAt,
      lastRenewedAt: now,
    };

    this.locks.set(taskId, lock);
    this.taskVersions.set(taskId, newVersion);

    return {
      success: true,
      lock,
      status: LockStatus.ACQUIRED,
    };
  }

  /**
   * Release lock on a task
   */
  async releaseLock(taskId: string, agentId: string, expectedVersion: number): Promise<LockResult> {
    const lock = this.locks.get(taskId);

    if (!lock) {
      return {
        success: false,
        status: LockStatus.RELEASED,
      };
    }

    if (lock.agentId !== agentId) {
      return {
        success: false,
        status: LockStatus.CONFLICT,
        conflict: {
          conflictWith: lock.agentId,
          expectedVersion,
          actualVersion: lock.version,
          operation: 'release_lock',
        },
      };
    }

    if (lock.version !== expectedVersion) {
      return {
        success: false,
        status: LockStatus.CONFLICT,
        conflict: {
          conflictWith: lock.agentId,
          expectedVersion,
          actualVersion: lock.version,
          operation: 'release_lock_version_mismatch',
        },
      };
    }

    this.locks.delete(taskId);
    return {
      success: true,
      status: LockStatus.RELEASED,
      lock,
    };
  }

  /**
   * Check if task is locked
   */
  isLocked(taskId: string): boolean {
    const lock = this.locks.get(taskId);
    if (!lock) return false;

    // Check if lock is expired
    if (lock.expiresAt <= new Date()) {
      this.locks.delete(taskId);
      return false;
    }

    return true;
  }

  /**
   * Get lock information for a task
   */
  getLock(taskId: string): Lock | undefined {
    const lock = this.locks.get(taskId);

    if (!lock) return undefined;

    // Check if lock is expired
    if (lock.expiresAt <= new Date()) {
      this.locks.delete(taskId);
      return undefined;
    }

    return lock;
  }

  /**
   * Renew lock (extend timeout)
   */
  async renewLock(taskId: string, agentId: string, additionalTimeout: number): Promise<LockResult> {
    const lock = this.locks.get(taskId);

    if (!lock) {
      return {
        success: false,
        status: LockStatus.RELEASED,
      };
    }

    if (lock.agentId !== agentId) {
      return {
        success: false,
        status: LockStatus.CONFLICT,
        conflict: {
          conflictWith: lock.agentId,
          expectedVersion: lock.version,
          actualVersion: lock.version,
          operation: 'renew_lock',
        },
      };
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + additionalTimeout);

    lock.expiresAt = newExpiresAt;
    lock.lastRenewedAt = now;

    return {
      success: true,
      lock,
      status: LockStatus.ACQUIRED,
    };
  }

  /**
   * Clean up expired locks
   */
  cleanupExpiredLocks(): number {
    const now = new Date();
    let cleaned = 0;

    for (const [taskId, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(taskId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalLocks: this.locks.size,
      totalTasks: this.taskVersions.size,
      locksByMode: {
        exclusive: Array.from(this.locks.values()).filter((l) => l.mode === LockMode.EXCLUSIVE).length,
        collaborative: Array.from(this.locks.values()).filter((l) => l.mode === LockMode.COLLABORATIVE).length,
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CONFLICT DETECTOR
// ============================================================================

export class ConflictDetector {
  /**
   * Detect if operations will conflict based on versions
   */
  detectVersionConflict(
    taskId: string,
    expectedVersion: number,
    actualVersion: number
  ): ConflictInfo | null {
    if (expectedVersion !== actualVersion) {
      return {
        conflictWith: 'unknown',
        expectedVersion,
        actualVersion,
        operation: 'version_mismatch',
      };
    }

    return null;
  }

  /**
   * Detect collaborative conflicts (multiple agents modifying same data)
   */
  detectCollaborativeConflicts(
    operations: Array<{ agentId: string; taskId: string; timestamp: Date }>
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Group operations by task
    const byTask = new Map<string, Array<{ agentId: string; timestamp: Date }>>();
    for (const op of operations) {
      if (!byTask.has(op.taskId)) {
        byTask.set(op.taskId, []);
      }
      byTask.get(op.taskId)!.push(op);
    }

    // Check for overlapping operations on same task
    for (const [taskId, ops] of byTask.entries()) {
      if (ops.length > 1) {
        // Sort by timestamp
        ops.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Check for concurrent operations (within 1 second)
        for (let i = 0; i < ops.length - 1; i++) {
          const timeDiff = ops[i + 1].timestamp.getTime() - ops[i].timestamp.getTime();

          if (timeDiff < 1000) {
            conflicts.push({
              conflictWith: ops[i + 1].agentId,
              expectedVersion: ops[i].timestamp.getTime(),
              actualVersion: ops[i + 1].timestamp.getTime(),
              operation: `concurrent_write_${taskId}`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Suggest conflict resolution strategy
   */
  suggestResolution(conflict: ConflictInfo): string {
    switch (conflict.operation) {
      case 'version_mismatch':
        return 'Version conflict detected. Reload latest version and retry with updated data.';
      case 'acquire_exclusive_lock':
        return 'Task locked by another agent. Wait for lock release or use collaborative mode.';
      case 'concurrent_write':
        return 'Multiple agents writing concurrently. Consider using collaborative mode with conflict detection.';
      default:
        return 'Unknown conflict. Review operation and retry.';
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

