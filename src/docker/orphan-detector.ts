// Orphaned Container Detector
// Week 16, Day 1-2: Detect and clean up orphaned containers

import Dockerode from "dockerode";
import { logger } from "../util/logger";
import { DockerManager } from "./manager";
import { ContainerInfo, ContainerStatus } from "../types";

export interface OrphanDetectorConfig {
  enabled: boolean;
  detectionIntervalMs: number;
  autoCleanupEnabled: boolean;
  orphanAgeThresholdMs: number;
  labelPrefix: string;
}

// Default configuration
const DEFAULT_CONFIG: OrphanDetectorConfig = {
  enabled: true,
  detectionIntervalMs: 5 * 60 * 1000, // 5 minutes
  autoCleanupEnabled: true,
  orphanAgeThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
  labelPrefix: "opencode.task",
};

// Orphan container result
interface OrphanContainer {
  containerId: string;
  containerName: string;
  taskId: string;
  status: ContainerStatus;
  createdAt: Date;
  ageMs: number;
  reason: string;
}

// Detection result
interface DetectionResult {
  orphansFound: OrphanContainer[];
  containersChecked: number;
  detectionTime: Date;
}

// Cleanup result
interface CleanupResult {
  containersRemoved: string[];
  containersFailed: Array<{ containerId: string; error: string }>;
  spaceReclaimed: number;
  cleanupTime: Date;
}

/**
 * Orphaned Container Detector
 *
 * Detects and cleans up orphaned containers that are no longer associated with active tasks.
 * Orphaned containers are defined as:
 * - Containers with the `opencode.task.id` label
 * - Where the associated task no longer exists in the task registry
 * - Or the container has been in a stopped/exited state for > 24 hours
 */
export class OrphanDetector {
  private static instance: OrphanDetector;
  private config: OrphanDetectorConfig;
  private docker: Dockerode;
  private dockerManager: DockerManager;
  private detectionTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Track known task IDs to identify orphaned containers
  private knownTaskIds: Set<string> = new Set();
  private lastDetectionTime: Date | null = null;

  private constructor(config: Partial<OrphanDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dockerManager = DockerManager.getInstance();
    this.docker = new Dockerode({
      socketPath: process.env.DOCKER_SOCKET || "/var/run/docker.sock",
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(
    config?: Partial<OrphanDetectorConfig>,
  ): OrphanDetector {
    if (!OrphanDetector.instance) {
      OrphanDetector.instance = new OrphanDetector(config);
    }
    return OrphanDetector.instance;
  }

  /**
   * Initialize the detector
   */
  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("OrphanDetector is disabled in configuration");
      return;
    }

    try {
      logger.info("Initializing OrphanDetector", {
        detectionInterval: this.config.detectionIntervalMs,
        autoCleanupEnabled: this.config.autoCleanupEnabled,
        orphanAgeThreshold: this.config.orphanAgeThresholdMs,
        labelPrefix: this.config.labelPrefix,
      });

      // Perform initial detection
      await this.detectOrphans();

      // Start periodic detection
      this.startPeriodicDetection();

      logger.info("✅ OrphanDetector initialized and started");
    } catch (error) {
      logger.error("Failed to initialize OrphanDetector", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update known task IDs
   * Called by task lifecycle when tasks are created/completed
   */
  public updateKnownTasks(taskIds: string[]): void {
    this.knownTaskIds = new Set(taskIds);
    logger.debug("Updated known task IDs", { count: taskIds.length });
  }

  /**
   * Add a single task ID to known tasks
   */
  public addKnownTask(taskId: string): void {
    this.knownTaskIds.add(taskId);
    logger.debug("Added task to known tasks", { taskId });
  }

  /**
   * Remove a task ID from known tasks
   */
  public removeKnownTask(taskId: string): void {
    this.knownTaskIds.delete(taskId);
    logger.debug("Removed task from known tasks", { taskId });
  }

  /**
   * Detect orphaned containers
   * @returns Detection result with list of orphans
   */
  public async detectOrphans(): Promise<DetectionResult> {
    if (this.isRunning) {
      logger.warn("Detection already in progress, skipping");
      return {
        orphansFound: [],
        containersChecked: 0,
        detectionTime: new Date(),
      };
    }

    this.isRunning = true;
    const detectionTime = new Date();

    try {
      logger.info("Starting orphaned container detection", { detectionTime });

      // List all containers (including stopped)
      const containers = await this.dockerManager.listContainers(true);
      const orphans: OrphanContainer[] = [];

      for (const container of containers) {
        const orphanInfo = await this.checkIfOrphan(container);

        if (orphanInfo) {
          orphans.push(orphanInfo);
        }
      }

      const result: DetectionResult = {
        orphansFound: orphans,
        containersChecked: containers.length,
        detectionTime,
      };

      this.lastDetectionTime = detectionTime;

      logger.info("Orphaned container detection completed", {
        containersChecked: result.containersChecked,
        orphansFound: result.orphansFound.length,
        detectionTime: result.detectionTime,
      });

      // Log each orphan
      if (result.orphansFound.length > 0) {
        for (const orphan of result.orphansFound) {
          logger.warn("Orphaned container detected", {
            containerId: orphan.containerId,
            containerName: orphan.containerName,
            taskId: orphan.taskId,
            status: orphan.status,
            ageHours: orphan.ageMs / (1000 * 60 * 60),
            reason: orphan.reason,
          });
        }
      }

      // Auto-cleanup orphans if enabled
      if (this.config.autoCleanupEnabled && result.orphansFound.length > 0) {
        await this.cleanupOrphans(result.orphansFound);
      }

      return result;
    } catch (error) {
      logger.error("Failed to detect orphaned containers", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if a container is orphaned
   */
  private async checkIfOrphan(
    container: ContainerInfo,
  ): Promise<OrphanContainer | null> {
    const now = Date.now();
    const createdAt = container.createdAt.getTime();
    const ageMs = now - createdAt;

    // Get task ID from labels
    const taskId = container.labels?.[`${this.config.labelPrefix}.id`];

    // Only check containers with task labels
    if (!taskId) {
      return null; // Not managed by OpenCode
    }

    // Check if task is in known tasks
    if (this.knownTaskIds.has(taskId)) {
      return null; // Task is still active
    }

    // Determine reason for orphaning
    let reason: string = "";
    let isOrphan: boolean = false;

    if (container.status === "running" || container.status === "paused") {
      reason = `Task ${taskId} not found in task registry`;
      isOrphan = true;
    } else if (
      container.status === "exited" ||
      container.status === "dead" ||
      container.status === "stopped"
    ) {
      if (ageMs > this.config.orphanAgeThresholdMs) {
        reason = `Container stopped for ${Math.floor(ageMs / (1000 * 60 * 60))} hours (exceeds ${Math.floor(this.config.orphanAgeThresholdMs / (1000 * 60 * 60))}h threshold)`;
        isOrphan = true;
      }
    } else {
      reason = `Task ${taskId} not found in task registry`;
      isOrphan = !this.knownTaskIds.has(taskId);
    }

    if (!isOrphan) {
      return null;
    }

    return {
      containerId: container.id,
      containerName: container.name,
      taskId,
      status: container.status,
      createdAt: container.createdAt,
      ageMs,
      reason,
    };
  }

  /**
   * Clean up orphaned containers
   * @param orphans List of orphan containers to clean up
   * @returns Cleanup result
   */
  public async cleanupOrphans(
    orphans: OrphanContainer[],
  ): Promise<CleanupResult> {
    logger.info("Starting cleanup of orphaned containers", {
      count: orphans.length,
      autoCleanupEnabled: this.config.autoCleanupEnabled,
    });

    const containersRemoved: string[] = [];
    const containersFailed: Array<{ containerId: string; error: string }> = [];
    let totalSpaceReclaimed = 0;

    for (const orphan of orphans) {
      try {
        // Check if container meets cleanup criteria
        const shouldCleanup = await this.shouldCleanupOrphan(orphan);

        if (!shouldCleanup) {
          logger.info("Skipping orphan cleanup (threshold not met)", {
            containerId: orphan.containerId,
            containerName: orphan.containerName,
            ageHours: orphan.ageMs / (1000 * 60 * 60),
            thresholdHours: this.config.orphanAgeThresholdMs / (1000 * 60 * 60),
          });
          continue;
        }

        // Remove container with force flag
        await this.dockerManager.removeContainer(
          orphan.containerId,
          true,
          false,
        );

        containersRemoved.push(orphan.containerId);

        logger.info("✅ Cleaned up orphaned container", {
          containerId: orphan.containerId,
          containerName: orphan.containerName,
          taskId: orphan.taskId,
          ageHours: orphan.ageMs / (1000 * 60 * 60),
          reason: orphan.reason,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        containersFailed.push({
          containerId: orphan.containerId,
          error: errorMessage,
        });

        logger.error("Failed to clean up orphaned container", {
          containerId: orphan.containerId,
          containerName: orphan.containerName,
          error: errorMessage,
        });
      }
    }

    const result: CleanupResult = {
      containersRemoved,
      containersFailed,
      spaceReclaimed: totalSpaceReclaimed,
      cleanupTime: new Date(),
    };

    logger.info("Orphaned container cleanup completed", {
      containersRemoved: result.containersRemoved.length,
      containersFailed: result.containersFailed.length,
      spaceReclaimed: result.spaceReclaimed,
      cleanupTime: result.cleanupTime,
    });

    return result;
  }

  /**
   * Determine if an orphan should be cleaned up
   */
  private async shouldCleanupOrphan(orphan: OrphanContainer): Promise<boolean> {
    // Auto-cleanup if enabled and container is old enough
    if (this.config.autoCleanupEnabled) {
      return orphan.ageMs > this.config.orphanAgeThresholdMs;
    }

    // Manual cleanup only
    return false;
  }

  /**
   * Start periodic detection
   */
  private startPeriodicDetection(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
    }

    this.detectionTimer = setInterval(() => {
      this.detectOrphans().catch((error) => {
        logger.error("Periodic orphan detection failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.detectionIntervalMs);

    logger.info("Periodic orphan detection started", {
      intervalMs: this.config.detectionIntervalMs,
    });
  }

  /**
   * Stop periodic detection
   */
  public stop(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }

    logger.info("OrphanDetector stopped");
  }

  /**
   * Get last detection time
   */
  public getLastDetectionTime(): Date | null {
    return this.lastDetectionTime;
  }

  /**
   * Get detector status
   */
  public getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    detectionIntervalMs: number;
    autoCleanupEnabled: boolean;
    knownTaskCount: number;
    lastDetectionTime: Date | null;
  } {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      detectionIntervalMs: this.config.detectionIntervalMs,
      autoCleanupEnabled: this.config.autoCleanupEnabled,
      knownTaskCount: this.knownTaskIds.size,
      lastDetectionTime: this.lastDetectionTime,
    };
  }
}

// Export singleton instance
export const orphanDetector = OrphanDetector.getInstance();
