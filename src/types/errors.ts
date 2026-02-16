/**
 * Custom Error Types - Refactoring Priority 1
 * Provides type-safe, structured error handling across the codebase
 */

/**
 * Base error class for all application errors
 *
 * Provides:
 * - Error codes for programmatic handling
 * - Contextual metadata
 * - Consistent error structure
 * - Timestamp for tracking
 * - JSON serialization for logging
 */
export class OpenCodeError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack,
    };
  }
}

// ============================================================================
// Task Lifecycle Errors
// ============================================================================

export enum TaskErrorCode {
  TASK_NOT_FOUND = "TASK_NOT_FOUND",
  INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION",
  TASK_UPDATE_FAILED = "TASK_UPDATE_FAILED",
  TASK_CREATION_FAILED = "TASK_CREATION_FAILED",
  TASK_DELETION_FAILED = "TASK_DELETION_FAILED",
}

export class TaskLifecycleError extends OpenCodeError {
  constructor(code: TaskErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createTaskNotFoundError = (taskId: string): TaskLifecycleError =>
  new TaskLifecycleError(
    TaskErrorCode.TASK_NOT_FOUND,
    `Task not found: ${taskId}`,
    { taskId },
  );

export const createInvalidTransitionError = (
  taskId: string,
  currentStatus: string,
  attemptedStatus: string,
): TaskLifecycleError =>
  new TaskLifecycleError(
    TaskErrorCode.INVALID_STATE_TRANSITION,
    `Cannot transition task ${taskId} from ${currentStatus} to ${attemptedStatus}`,
    { taskId, currentStatus, attemptedStatus },
  );

export const createTaskUpdateError = (taskId: string): TaskLifecycleError =>
  new TaskLifecycleError(
    TaskErrorCode.TASK_UPDATE_FAILED,
    `Failed to update task: ${taskId}`,
    { taskId },
  );

// ============================================================================
// Registry Errors
// ============================================================================

export enum RegistryErrorCode {
  REGISTRY_NOT_INITIALIZED = "REGISTRY_NOT_INITIALIZED",
  TASK_ALREADY_EXISTS = "TASK_ALREADY_EXISTS",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  QUERY_FAILED = "QUERY_FAILED",
}

export class RegistryError extends OpenCodeError {
  constructor(code: RegistryErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createRegistryNotInitializedError = (): RegistryError =>
  new RegistryError(
    RegistryErrorCode.REGISTRY_NOT_INITIALIZED,
    "Registry not initialized",
  );

// ============================================================================
// Session Errors
// ============================================================================

export enum SessionErrorCode {
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  SESSION_NO_TASK_ID = "SESSION_NO_TASK_ID",
  SESSION_RESUME_FAILED = "SESSION_RESUME_FAILED",
  CHECKPOINT_COOLDOWN_ACTIVE = "CHECKPOINT_COOLDOWN_ACTIVE",
  AGENT_NOT_REGISTERED = "AGENT_NOT_REGISTERED",
}

export class SessionError extends OpenCodeError {
  constructor(code: SessionErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createSessionNotFoundError = (sessionId: string): SessionError =>
  new SessionError(
    SessionErrorCode.SESSION_NOT_FOUND,
    `Session not found: ${sessionId}`,
    { sessionId },
  );

export const createSessionNoTaskIdError = (sessionId: string): SessionError =>
  new SessionError(
    SessionErrorCode.SESSION_NO_TASK_ID,
    `Session ${sessionId} has no task ID`,
    { sessionId },
  );

// ============================================================================
// Docker Errors
// ============================================================================

export enum DockerErrorCode {
  SOCKET_NOT_FOUND = "SOCKET_NOT_FOUND",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  NOT_RESPONDING = "NOT_RESPONDING",
  DOCKERODE_NOT_INSTALLED = "DOCKERODE_NOT_INSTALLED",
  CONTAINER_ERROR = "CONTAINER_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  IMAGE_NOT_ALLOWED = "IMAGE_NOT_ALLOWED",
}

export class DockerError extends OpenCodeError {
  constructor(code: DockerErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createDockerSocketNotFoundError = (paths: string[]): DockerError =>
  new DockerError(DockerErrorCode.SOCKET_NOT_FOUND, "Docker socket not found", {
    paths,
  });

export const createDockerodeNotInstalledError = (): DockerError =>
  new DockerError(
    DockerErrorCode.DOCKERODE_NOT_INSTALLED,
    "dockerode module not installed",
  );

export const createImageNotAllowedError = (image: string): DockerError =>
  new DockerError(
    DockerErrorCode.IMAGE_NOT_ALLOWED,
    `Image not allowed: ${image}`,
    { image },
  );

// ============================================================================
// Persistence Errors
// ============================================================================

export enum PersistenceErrorCode {
  DATABASE_NOT_INITIALIZED = "DATABASE_NOT_INITIALIZED",
  SAVE_FAILED = "SAVE_FAILED",
  LOAD_FAILED = "LOAD_FAILED",
  CHECKPOINT_INVALID = "CHECKPOINT_INVALID",
  CHECKPOINT_CREATION_FAILED = "CHECKPOINT_CREATION_FAILED",
}

export class PersistenceError extends OpenCodeError {
  constructor(code: PersistenceErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createDatabaseNotInitializedError = (): PersistenceError =>
  new PersistenceError(
    PersistenceErrorCode.DATABASE_NOT_INITIALIZED,
    "Database not initialized",
  );

export const createCheckpointInvalidError = (
  reason: string,
): PersistenceError =>
  new PersistenceError(
    PersistenceErrorCode.CHECKPOINT_INVALID,
    `Invalid checkpoint: ${reason}`,
    { reason },
  );

// ============================================================================
// Process Errors
// ============================================================================

export enum ProcessErrorCode {
  CONFIG_MISSING = "CONFIG_MISSING",
  INVALID_COMMAND = "INVALID_COMMAND",
  PROCESS_NOT_FOUND = "PROCESS_NOT_FOUND",
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
}

export class ProcessError extends OpenCodeError {
  constructor(code: ProcessErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createProcessConfigError = (): ProcessError =>
  new ProcessError(
    ProcessErrorCode.CONFIG_MISSING,
    "Process config must include command",
  );

export const createInvalidCommandError = (command: string): ProcessError =>
  new ProcessError(
    ProcessErrorCode.INVALID_COMMAND,
    `Invalid command: ${command}`,
    { command },
  );

// ============================================================================
// Git Operation Errors
// ============================================================================

export enum GitErrorCode {
  LOCK_ACQUISITION_FAILED = "LOCK_ACQUISITION_FAILED",
  BRANCH_CREATION_FAILED = "BRANCH_CREATION_FAILED",
  SUBMODULE_CREATION_FAILED = "SUBMODULE_CREATION_FAILED",
}

export class GitError extends OpenCodeError {
  constructor(code: GitErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createLockAcquisitionError = (
  lockFile: string,
  timeout: number,
): GitError =>
  new GitError(
    GitErrorCode.LOCK_ACQUISITION_FAILED,
    `Failed to acquire lock after ${timeout}ms: ${lockFile}`,
    { lockFile, timeout },
  );

// ============================================================================
// Hook System Errors
// ============================================================================

export enum HookErrorCode {
  HOOK_EXECUTION_FAILED = "HOOK_EXECUTION_FAILED",
  PLAN_UPDATE_FAILED = "PLAN_UPDATE_FAILED",
  PLAN_FINALIZATION_FAILED = "PLAN_FINALIZATION_FAILED",
}

export class HookError extends OpenCodeError {
  constructor(code: HookErrorCode, message: string, details?: any) {
    super(code, message, details);
  }
}

export const createHookExecutionError = (
  hookId: string,
  originalError: unknown,
): HookError =>
  new HookError(
    HookErrorCode.HOOK_EXECUTION_FAILED,
    `Hook execution failed: ${hookId}`,
    { hookId, originalError },
  );

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an error is an OpenCodeError
 */
export const isOpenCodeError = (error: unknown): error is OpenCodeError =>
  error instanceof OpenCodeError;

/**
 * Extract error code from unknown error
 */
export const getErrorCode = (error: unknown): string | undefined => {
  if (isOpenCodeError(error)) {
    return error.code;
  }
  return undefined;
};

/**
 * Get safe error details from unknown error
 */
export const getSafeErrorDetails = (error: unknown): any => {
  if (isOpenCodeError(error)) {
    return error.details;
  }
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return null;
};
