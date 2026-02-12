// Session Interruption Handler - Edge Case 1
// Week 15, Day 5: Detect interruption, graceful shutdown, save state, resume

import { EventEmitter } from "events";
import { logger } from "../util/logger";
import { multiLayerPersistence } from "../persistence/multi-layer";
import { taskLifecycleHooks } from "../hooks/task-lifecycle";

// Configuration
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000; // 5 seconds max for cleanup
const CHECKPOINT_COOLDOWN_MS = 30000; // 30 seconds between checkpoints
const HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds
const SESSION_TIMEOUT_MS = 300000; // 5 minutes of inactivity = interruption

export interface SessionState {
  sessionId: string;
  taskId?: string;
  agentId?: string;
  lastActivity: Date;
  checkpointId?: string;
  status: "active" | "interrupted" | "resuming" | "shutdown";
}

export interface InterruptionOptions {
  taskId?: string;
  agentId?: string;
  saveCheckpoint?: boolean;
  cleanupTimeoutMs?: number;
}

export class InterruptionHandler extends EventEmitter {
  private static instance: InterruptionHandler;
  private sessionState: Map<string, SessionState>;
  private lastCheckpointTime: number;
  private heartbeatInterval?: NodeJS.Timeout;
  private shutdownPromise: Promise<void> | null = null;
  private isShuttingDown = false;

  private constructor() {
    super();
    this.sessionState = new Map();
    this.lastCheckpointTime = 0;

    this.setupSignalHandlers();
    this.startHeartbeatMonitor();
    this.registerHooks();
  }

  public static getInstance(): InterruptionHandler {
    if (!InterruptionHandler.instance) {
      InterruptionHandler.instance = new InterruptionHandler();
    }
    return InterruptionHandler.instance;
  }

  /**
   * Start tracking a session
   */
  public startSession(
    sessionId: string,
    taskId?: string,
    agentId?: string,
  ): void {
    const state: SessionState = {
      sessionId,
      taskId,
      agentId,
      lastActivity: new Date(),
      status: "active",
    };

    this.sessionState.set(sessionId, state);
    logger.info("Session started", { sessionId, taskId, agentId });
    this.emit("session:started", state);
  }

  /**
   * Update session activity timestamp
   */
  public updateActivity(sessionId: string): void {
    const state = this.sessionState.get(sessionId);
    if (state) {
      state.lastActivity = new Date();
      logger.debug("Session activity updated", { sessionId });
    }
  }

  /**
   * Get session state
   */
  public getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionState.get(sessionId);
  }

  /**
   * Check if session is active
   */
  public isSessionActive(sessionId: string): boolean {
    const state = this.sessionState.get(sessionId);
    if (!state) return false;

    // Check timeout
    const timeSinceActivity = Date.now() - state.lastActivity.getTime();
    if (timeSinceActivity > SESSION_TIMEOUT_MS) {
      logger.warn("Session timeout detected", {
        sessionId,
        timeSinceActivity,
      });
      this.handleInterruption(sessionId, "timeout");
      return false;
    }

    return state.status === "active";
  }

  /**
   * Gracefully handle session interruption
   */
  public async handleInterruption(
    sessionId: string,
    reason: "sigterm" | "sigint" | "sighup" | "timeout" | "disconnect",
    options: InterruptionOptions = {},
  ): Promise<void> {
    const state = this.sessionState.get(sessionId);
    if (!state) {
      logger.warn("Session not found for interruption", { sessionId, reason });
      return;
    }

    if (state.status !== "active") {
      logger.debug("Session already interrupted", {
        sessionId,
        status: state.status,
      });
      return;
    }

    logger.info("Handling session interruption", {
      sessionId,
      taskId: state.taskId,
      reason,
    });

    // Mark as interrupted
    state.status = "interrupted";
    this.emit("session:interrupted", { sessionId, reason, state });

    const {
      taskId,
      saveCheckpoint = true,
      cleanupTimeoutMs = GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    } = options;

    // Create checkpoint with timeout
    if (saveCheckpoint && taskId) {
      try {
        const checkpointId = await this.createCheckpointWithTimeout(
          sessionId,
          taskId,
          cleanupTimeoutMs,
          reason,
        );
        state.checkpointId = checkpointId;
        logger.info("Checkpoint created on interruption", {
          sessionId,
          taskId,
          checkpointId,
          reason,
        });
      } catch (checkpointError) {
        logger.error("Failed to create checkpoint on interruption", {
          sessionId,
          taskId,
          error:
            checkpointError instanceof Error
              ? checkpointError.message
              : String(checkpointError),
        });
        // Continue with cleanup even if checkpoint fails
      }
    }

    // Emit graceful shutdown event
    this.emit("session:shutdown", { sessionId, reason, state });

    // Mark as shutdown
    state.status = "shutdown";
  }

  /**
   * Resume a session from checkpoint
   */
  public async resumeSession(
    sessionId: string,
    checkpointId: string,
  ): Promise<void> {
    const state = this.sessionState.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!state.taskId) {
      throw new Error(`Session ${sessionId} has no task ID`);
    }

    logger.info("Resuming session from checkpoint", {
      sessionId,
      taskId: state.taskId,
      checkpointId,
    });

    // Mark as resuming
    state.status = "resuming";
    this.emit("session:resuming", { sessionId, checkpointId, state });

    try {
      // Restore checkpoint
      await multiLayerPersistence.restoreCheckpoint(state.taskId, checkpointId);

      // Update activity timestamp
      state.lastActivity = new Date();
      state.status = "active";

      logger.info("Session resumed successfully", {
        sessionId,
        taskId: state.taskId,
        checkpointId,
      });

      this.emit("session:resumed", { sessionId, checkpointId, state });
    } catch (error) {
      state.status = "interrupted";
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to resume session", {
        sessionId,
        taskId: state.taskId,
        checkpointId,
        error: errorMessage,
      });

      this.emit("session:resumeFailed", { sessionId, checkpointId, error });

      throw new Error(`Failed to resume session ${sessionId}: ${errorMessage}`);
    }
  }

  /**
   * Get latest checkpoint for a session
   */
  public getLatestCheckpointId(sessionId: string): string | undefined {
    const state = this.sessionState.get(sessionId);
    return state?.checkpointId;
  }

  /**
   * Cleanup session state
   */
  public cleanupSession(sessionId: string): void {
    const state = this.sessionState.get(sessionId);
    if (state) {
      logger.info("Cleaning up session", { sessionId, status: state.status });
      this.sessionState.delete(sessionId);
      this.emit("session:cleaned", { sessionId, state });
    }
  }

  /**
   * Shutdown all sessions
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress");
      return this.shutdownPromise ?? Promise.resolve();
    }

    this.isShuttingDown = true;
    logger.info("Initiating graceful shutdown", {
      activeSessions: this.sessionState.size,
    });

    this.shutdownPromise = this.performGracefulShutdown();

    return this.shutdownPromise!;
  }

  // Private Methods

  /**
   * Setup signal handlers for interruption detection
   */
  private setupSignalHandlers(): void {
    const handleSignal = async (signal: NodeJS.Signals, reason: string) => {
      logger.info(`Received ${signal} signal`, { reason });
      await this.handleAllInterruptions(reason);
    };

    // Register signal handlers
    process.on("SIGTERM", () => handleSignal("SIGTERM", "sigterm"));
    process.on("SIGINT", () => handleSignal("SIGINT", "sigint"));
    process.on("SIGHUP", () => handleSignal("SIGHUP", "sighup"));

    logger.info("Signal handlers registered", {
      signals: ["SIGTERM", "SIGINT", "SIGHUP"],
    });
  }

  /**
   * Start heartbeat monitor for timeout detection
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkSessionTimeouts();
    }, HEARTBEAT_INTERVAL_MS);

    logger.info("Heartbeat monitor started", {
      interval: `${HEARTBEAT_INTERVAL_MS}ms`,
    });
  }

  /**
   * Check all sessions for timeouts
   */
  private checkSessionTimeouts(): void {
    const now = Date.now();
    const timeoutMs = SESSION_TIMEOUT_MS;

    for (const [sessionId, state] of this.sessionState.entries()) {
      if (state.status !== "active") continue;

      const timeSinceActivity = now - state.lastActivity.getTime();

      if (timeSinceActivity > timeoutMs) {
        logger.warn("Session timeout detected via heartbeat", {
          sessionId,
          timeSinceActivity,
        });
        this.handleInterruption(sessionId, "timeout", {
          taskId: state.taskId,
          saveCheckpoint: true,
        });
      }
    }
  }

  /**
   * Register hooks for integration
   */
  private registerHooks(): void {
    // Register beforeTaskFail hook to create checkpoint on failure
    taskLifecycleHooks.registerBeforeTaskFail(
      async (taskId: string, error: string) => {
        // Find session for this task
        const sessionId = this.findSessionByTaskId(taskId);

        if (sessionId) {
          logger.info("Task failure detected, creating checkpoint", {
            taskId,
            sessionId,
            error,
          });

          await this.handleInterruption(sessionId, "disconnect", {
            taskId,
            saveCheckpoint: true,
          });
        }
      },
      5, // High priority
    );

    logger.info("Interruption handler hooks registered");
  }

  /**
   * Find session ID by task ID
   */
  private findSessionByTaskId(taskId: string): string | undefined {
    for (const [sessionId, state] of this.sessionState.entries()) {
      if (state.taskId === taskId) {
        return sessionId;
      }
    }
    return undefined;
  }

  /**
   * Create checkpoint with timeout protection
   */
  private async createCheckpointWithTimeout(
    sessionId: string,
    taskId: string,
    timeoutMs: number,
    reason: string,
  ): Promise<string> {
    // Check cooldown to avoid spamming checkpoints
    const now = Date.now();
    if (now - this.lastCheckpointTime < CHECKPOINT_COOLDOWN_MS) {
      logger.info("Checkpoint cooldown active, skipping", {
        sessionId,
        taskId,
        cooldownRemaining: `${CHECKPOINT_COOLDOWN_MS - (now - this.lastCheckpointTime)}ms`,
      });
      throw new Error("Checkpoint cooldown active");
    }

    return Promise.race([
      multiLayerPersistence.createCheckpoint(
        taskId,
        `Checkpoint on ${reason} at ${new Date().toISOString()}`,
      ),
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error("Checkpoint creation timeout")),
          timeoutMs,
        ),
      ),
    ]).finally(() => {
      this.lastCheckpointTime = Date.now();
    });
  }

  /**
   * Handle interruption for all active sessions
   */
  private async handleAllInterruptions(reason: string): Promise<void> {
    const activeSessions: Array<{ sessionId: string; state: SessionState }> =
      [];

    for (const [sessionId, state] of this.sessionState.entries()) {
      if (state.status === "active") {
        activeSessions.push({ sessionId, state });
      }
    }

    logger.info(`Handling ${reason} for all sessions`, {
      count: activeSessions.length,
    });

    // Handle all sessions in parallel
    await Promise.all(
      activeSessions.map(({ sessionId, state }) =>
        this.handleInterruption(sessionId, reason as any, {
          taskId: state.taskId,
          saveCheckpoint: true,
          cleanupTimeoutMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS,
        }),
      ),
    );
  }

  /**
   * Perform graceful shutdown
   */
  private async performGracefulShutdown(): Promise<void> {
    logger.info("Performing graceful shutdown");

    try {
      // Stop heartbeat monitor
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      // Handle all active sessions
      await this.handleAllInterruptions("shutdown");

      // Cleanup all sessions
      for (const sessionId of this.sessionState.keys()) {
        this.cleanupSession(sessionId);
      }

      // Remove signal handlers
      process.removeAllListeners("SIGTERM");
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGHUP");

      logger.info("Graceful shutdown complete");
    } catch (error) {
      logger.error("Error during graceful shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const interruptionHandler = InterruptionHandler.getInstance();
