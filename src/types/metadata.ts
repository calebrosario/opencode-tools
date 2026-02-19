// Structured Metadata Schemas for Task Management
// Defines types for all known metadata fields that can be stored in tasks

/**
 * Task Metadata - Common fields used across the system
 *
 * Each task can have arbitrary metadata, but common fields have
 * defined here for documentation and validation purposes.
 */

// Common metadata fields that appear in the system
export interface TaskMetadata {
  /**
   * Unique task identifier assigned by agent
   */
  taskId?: string;

  /**
   * Agent or component that created/managing this task
   */
  agentId?: string;

  /**
   * Human-readable description of what the task represents
   */
  description?: string;

  /**
   * Tags for categorizing tasks (e.g., "bug", "feature", "research")
   */
  tags?: string[];

  /**
   * Priority level for task scheduling
   */
  priority?: "low" | "medium" | "high";

  /**
   * Estimated time to complete task (in hours)
   */
  estimatedHours?: number;

  /**
   * Actual completion timestamp (set when task completes)
   */
  completedAt?: Date;

  /**
   * Parent task ID if this task was spawned from another task
   */
  parentTaskId?: string;

  /**
   * Container ID if task is running in a container
   */
  containerId?: string;

  /**
   * Workspace directory where task execution context is stored
   */
  workspacePath?: string;

  /**
   * Resource usage metrics for this task execution
   */
  resourceUsage?: {
    memoryMB?: number;
    cpuPercent?: number;
    durationMs?: number;
  };

  /**
   * Retry configuration if task execution failed
   */
  retryConfig?: {
    maxAttempts?: number;
    retryDelayMs?: number;
    backoffMultiplier?: number;
  };

  /**
   * Security context for task execution
   */
  securityContext?: {
    permissions?: string[];
    allowedHosts?: string[];
  };

  /**
   * Environment variables used during task execution
   */
  environment?: Record<string, string>;

  /**
   * Arbitrary application-specific metadata
   * Stored as JSONB in database, but defined here for documentation
   */
  [key: string]: unknown;
}

/**
 * Task-specific metadata schemas
 *
 * Different agent types may use specialized metadata fields.
 * These schemas can be combined with TaskMetadata.
 */

/**
 * Generic task execution metadata
 */
export interface GenericTaskMetadata extends TaskMetadata {
  /**
   * Whether task execution is dry run (no actual changes)
   */
  isDryRun?: boolean;

  /**
   * Checkpoint snapshot that this task was created from
   */
  createdFromSnapshot?: string;

  /**
   * Whether task should be persisted across sessions
   */
  persistAcrossSessions?: boolean;
}

/**
 * Agent task metadata
 */
export interface AgentTaskMetadata extends TaskMetadata {
  /**
   * CLI command that generated this task
   */
  command?: string;

  /**
   * Arguments passed to the CLI command
   */
  arguments?: string[];

  /**
   * Working directory during task execution
   */
  workingDirectory?: string;

  /**
   * Exit code from task execution
   */
  exitCode?: number;

  /**
   * Whether the task succeeded
   */
  succeeded?: boolean;

  /**
   * Output from task execution (stdout, stderr, files)
   */
  output?: {
    stdout?: string;
    stderr?: string;
    files?: string[];
  };
}

/**
 * MCP server metadata
 */
export interface MCPTaskMetadata extends TaskMetadata {
  /**
   * MCP tool that was invoked
   */
  toolName?: string;

  /**
   * Parameters passed to the MCP tool
   */
  toolParameters?: Record<string, unknown>;

  /**
   * MCP tool execution result
   */
  toolResult?: {
    success?: boolean;
    error?: string;
    data?: unknown;
  };
}

/**
 * Persistence metadata
 */
export interface PersistenceTaskMetadata extends TaskMetadata {
  /**
   * Last time this task was loaded from persistence layer
   */
  loadedAt?: Date;

  /**
   * Number of times this task was saved
   */
  saveCount?: number;

  /**
   * Size of task data in storage
   */
  storageSizeBytes?: number;
}

/**
 * Docker container task metadata
 */
export interface DockerTaskMetadata extends TaskMetadata {
  /**
   * Docker image used for this task
   */
  image?: string;

  /**
   * Container configuration
   */
  containerConfig?: {
    memoryLimit?: number;
    cpuLimit?: number;
    environment?: Record<string, string>;
    volumeMounts?: string[];
    networkMode?: string;
  };

  /**
   * Container ID
   */
  containerId: string;

  /**
   * Container exit code (0 = success)
   */
  containerExitCode?: number;

  /**
   * Container state at completion
   */
  containerState?: "created" | "running" | "exited" | "paused" | "dead";

  /**
   * Resource usage metrics
   */
  resourceUsage?: {
    memoryMB?: number;
    cpuPercent?: number;
    durationMs?: number;
  };
}

/**
 * Network task metadata
 */
export interface NetworkTaskMetadata extends TaskMetadata {
  /**
   * Network ID for task execution
   */
  networkId?: string;

  /**
   * Network mode (bridge, host, none)
   */
  networkMode?: "bridge" | "host" | "none";

  /**
   * Network isolation mode
   */
  isolationMode?: "bridge" | "none";
}

/**
 * Checkpoint metadata
 */
export interface CheckpointTaskMetadata extends TaskMetadata {
  /**
   * Checkpoint ID
   */
  checkpointId?: string;

  /**
   * Description of what's included in this checkpoint
   */
  description?: string;

  /**
   * Files included in this checkpoint
   */
  files?: string[];

  /**
   * Total size of checkpoint in bytes
   */
  totalSizeBytes?: number;

  /**
   * Compression format used
   */
  compression?: "gzip" | "zip" | "none";
}

/**
 * Type guards for metadata validation
 *
 * These functions help ensure metadata objects conform to expected schemas.
 */

// Common field types that all valid metadata must have
// String fields
const stringFields: (keyof TaskMetadata)[] = [
  "taskId",
  "agentId",
  "description",
  "tags",
  "priority",
  "workspacePath",
  "containerId",
  "networkId",
  "checkpointId",
];

/**
 * Type guard to check if object is valid TaskMetadata
 */
export function isTaskMetadata(value: unknown): value is TaskMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  // Record<string, unknown> field for arbitrary metadata
  if ("[key: string]: unknown" in value) {
    return false;
  }

  return true;
}

/**
 * Merge multiple TaskMetadata objects into one
 * Useful when combining metadata from different sources
 */
export function mergeTaskMetadata(...objects: TaskMetadata[]): TaskMetadata {
  const merged: TaskMetadata = {};

  for (const obj of objects) {
    if (!obj) {
      continue;
    }

    for (const key of stringFields) {
      // Skip if already set from earlier object
      if (key in merged) {
        continue;
      }

      const value = obj[key];
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }
  }

  return merged;
}
