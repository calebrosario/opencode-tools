import { promises as fs } from "fs";
import { join, dirname } from "path";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { logger } from "../util/logger";
import { multiLayerPersistence, Checkpoint } from "./multi-layer";

export interface CompressionResult {
  checkpointId: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  filesCompressed: string[];
}

export interface RotationPolicy {
  keepLastN: number;
  keepDaily: number;
  keepWeekly: number;
  maxAge?: number;
}

export interface StorageStats {
  totalBytes: number;
  totalGB: number;
  checkpointCount: number;
  oldestCheckpoint?: string;
  newestCheckpoint?: string;
}

export interface OptimizerConfig {
  maxStorageGB: number;
  compressionEnabled: boolean;
  rotationPolicy: RotationPolicy;
}

const DEFAULT_CONFIG: OptimizerConfig = {
  maxStorageGB: 5,
  compressionEnabled: true,
  rotationPolicy: {
    keepLastN: 10,
    keepDaily: 7,
    keepWeekly: 4,
  },
};

export class CheckpointOptimizer {
  private static instance: CheckpointOptimizer;
  private config: OptimizerConfig;
  private basePath: string;

  private constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.basePath = join(process.cwd(), "data", "tasks");
  }

  public static getInstance(
    config?: Partial<OptimizerConfig>,
  ): CheckpointOptimizer {
    if (!CheckpointOptimizer.instance) {
      CheckpointOptimizer.instance = new CheckpointOptimizer(config);
    }
    return CheckpointOptimizer.instance;
  }

  public async compressCheckpoint(
    taskId: string,
    checkpointId: string,
  ): Promise<CompressionResult> {
    const checkpointPath = join(
      this.basePath,
      taskId,
      "checkpoints",
      checkpointId,
    );
    const filesToCompress = ["state.json", "logs.jsonl", "manifest.json"];
    const compressedFiles: string[] = [];
    let originalSize = 0;
    let compressedSize = 0;

    try {
      for (const file of filesToCompress) {
        const filePath = join(checkpointPath, file);
        const compressedPath = `${filePath}.gz`;

        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);
          originalSize += stats.size;

          await pipeline(
            createReadStream(filePath),
            createGzip(),
            createWriteStream(compressedPath),
          );

          const compressedStats = await fs.stat(compressedPath);
          compressedSize += compressedStats.size;
          compressedFiles.push(file);

          await fs.unlink(filePath);
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            logger.warn("File compression skipped", {
              taskId,
              checkpointId,
              file,
              error: error.message,
            });
          }
        }
      }

      const compressionRatio =
        originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

      logger.info("Checkpoint compressed", {
        taskId,
        checkpointId,
        originalSize,
        compressedSize,
        compressionRatio: `${compressionRatio.toFixed(1)}%`,
        filesCompressed: compressedFiles.length,
      });

      return {
        checkpointId,
        originalSize,
        compressedSize,
        compressionRatio,
        filesCompressed: compressedFiles,
      };
    } catch (error: any) {
      logger.error("Failed to compress checkpoint", {
        taskId,
        checkpointId,
        error: error.message,
      });
      throw error;
    }
  }

  public async decompressCheckpoint(
    taskId: string,
    checkpointId: string,
  ): Promise<void> {
    const checkpointPath = join(
      this.basePath,
      taskId,
      "checkpoints",
      checkpointId,
    );
    const compressedFiles = [
      "state.json.gz",
      "logs.jsonl.gz",
      "manifest.json.gz",
    ];

    try {
      for (const gzFile of compressedFiles) {
        const compressedPath = join(checkpointPath, gzFile);
        const decompressedPath = compressedPath.replace(".gz", "");

        try {
          await fs.access(compressedPath);
          await pipeline(
            createReadStream(compressedPath),
            createGunzip(),
            createWriteStream(decompressedPath),
          );
          await fs.unlink(compressedPath);
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            logger.warn("File decompression skipped", {
              taskId,
              checkpointId,
              file: gzFile,
              error: error.message,
            });
          }
        }
      }

      logger.info("Checkpoint decompressed", { taskId, checkpointId });
    } catch (error: any) {
      logger.error("Failed to decompress checkpoint", {
        taskId,
        checkpointId,
        error: error.message,
      });
      throw error;
    }
  }

  public async getCheckpointSize(
    taskId: string,
    checkpointId: string,
  ): Promise<number> {
    const checkpointPath = join(
      this.basePath,
      taskId,
      "checkpoints",
      checkpointId,
    );
    let totalSize = 0;

    try {
      const files = await fs.readdir(checkpointPath);
      for (const file of files) {
        const filePath = join(checkpointPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
      return totalSize;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return 0;
      }
      throw error;
    }
  }

  public async getTotalStorageUsed(): Promise<number> {
    let totalBytes = 0;

    try {
      const tasks = await fs.readdir(this.basePath);
      for (const taskId of tasks) {
        const checkpointsPath = join(this.basePath, taskId, "checkpoints");
        try {
          const checkpoints = await fs.readdir(checkpointsPath);
          for (const checkpointId of checkpoints) {
            totalBytes += await this.getCheckpointSize(taskId, checkpointId);
          }
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            logger.warn("Failed to read task checkpoints", {
              taskId,
              error: error.message,
            });
          }
        }
      }

      return totalBytes;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return 0;
      }
      throw error;
    }
  }

  public async getStorageStats(): Promise<StorageStats> {
    const totalBytes = await this.getTotalStorageUsed();
    const totalGB = totalBytes / (1024 * 1024 * 1024);

    let oldestCheckpoint: string | undefined;
    let newestCheckpoint: string | undefined;
    let checkpointCount = 0;

    try {
      const tasks = await fs.readdir(this.basePath);
      for (const taskId of tasks) {
        const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
        checkpointCount += checkpoints.length;

        for (const cp of checkpoints) {
          if (!oldestCheckpoint || cp.timestamp < oldestCheckpoint) {
            oldestCheckpoint = cp.timestamp;
          }
          if (!newestCheckpoint || cp.timestamp > newestCheckpoint) {
            newestCheckpoint = cp.timestamp;
          }
        }
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        logger.warn("Failed to get checkpoint stats", { error: error.message });
      }
    }

    return {
      totalBytes,
      totalGB,
      checkpointCount,
      oldestCheckpoint,
      newestCheckpoint,
    };
  }

  public async enforceStorageLimit(): Promise<string[]> {
    const maxBytes = this.config.maxStorageGB * 1024 * 1024 * 1024;
    let currentBytes = await this.getTotalStorageUsed();
    const deletedCheckpoints: string[] = [];

    if (currentBytes <= maxBytes) {
      return deletedCheckpoints;
    }

    logger.info("Storage limit exceeded, cleaning up old checkpoints", {
      currentGB: (currentBytes / (1024 * 1024 * 1024)).toFixed(2),
      maxGB: this.config.maxStorageGB,
    });

    const allCheckpoints: Array<{ taskId: string; checkpoint: Checkpoint }> =
      [];

    try {
      const tasks = await fs.readdir(this.basePath);
      for (const taskId of tasks) {
        const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
        for (const cp of checkpoints) {
          allCheckpoints.push({ taskId, checkpoint: cp });
        }
      }
    } catch (error: any) {
      logger.error("Failed to list checkpoints for cleanup", {
        error: error.message,
      });
      return deletedCheckpoints;
    }

    allCheckpoints.sort((a, b) =>
      a.checkpoint.timestamp.localeCompare(b.checkpoint.timestamp),
    );

    const keepLastN = this.config.rotationPolicy.keepLastN;
    const toDelete = allCheckpoints.slice(0, allCheckpoints.length - keepLastN);

    for (const { taskId, checkpoint } of toDelete) {
      if (currentBytes <= maxBytes) break;

      try {
        const checkpointPath = join(
          this.basePath,
          taskId,
          "checkpoints",
          checkpoint.id,
        );
        const size = await this.getCheckpointSize(taskId, checkpoint.id);
        await fs.rm(checkpointPath, { recursive: true, force: true });
        currentBytes -= size;
        deletedCheckpoints.push(`${taskId}/${checkpoint.id}`);

        logger.info("Deleted old checkpoint", {
          taskId,
          checkpointId: checkpoint.id,
          freedBytes: size,
        });
      } catch (error: any) {
        logger.error("Failed to delete checkpoint", {
          taskId,
          checkpointId: checkpoint.id,
          error: error.message,
        });
      }
    }

    return deletedCheckpoints;
  }

  public async createIncrementalCheckpoint(
    taskId: string,
    description: string = "",
  ): Promise<string> {
    const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);

    if (checkpoints.length === 0) {
      return multiLayerPersistence.createCheckpoint(taskId, description);
    }

    const lastCheckpoint = checkpoints[0];
    if (!lastCheckpoint) {
      return multiLayerPersistence.createCheckpoint(taskId, description);
    }

    const checkpointPath = join(
      this.basePath,
      taskId,
      "checkpoints",
      lastCheckpoint.id,
    );

    let lastState: any = null;
    try {
      const stateData = await fs.readFile(
        join(checkpointPath, "state.json"),
        "utf-8",
      );
      lastState = JSON.parse(stateData);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        logger.warn("Could not read last checkpoint state", {
          taskId,
          error: error.message,
        });
      }
    }

    const currentState = await multiLayerPersistence.loadState(taskId);

    if (
      lastState &&
      currentState &&
      JSON.stringify(lastState.data) === JSON.stringify(currentState.data)
    ) {
      logger.info("No state changes, skipping incremental checkpoint", {
        taskId,
        lastCheckpointId: lastCheckpoint.id,
      });
      return lastCheckpoint.id;
    }

    const checkpointId = await multiLayerPersistence.createCheckpoint(
      taskId,
      description || `Incremental checkpoint at ${new Date().toISOString()}`,
    );

    if (this.config.compressionEnabled) {
      await this.compressCheckpoint(taskId, checkpointId);
    }

    await this.enforceStorageLimit();

    return checkpointId;
  }

  public async rotateCheckpoints(
    taskId: string,
    policy?: RotationPolicy,
  ): Promise<string[]> {
    const rotationPolicy = policy || this.config.rotationPolicy;
    const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
    const deletedIds: string[] = [];

    if (checkpoints.length <= rotationPolicy.keepLastN) {
      return deletedIds;
    }

    const toDelete = checkpoints.slice(rotationPolicy.keepLastN);

    for (const cp of toDelete) {
      try {
        const checkpointPath = join(
          this.basePath,
          taskId,
          "checkpoints",
          cp.id,
        );
        await fs.rm(checkpointPath, { recursive: true, force: true });
        deletedIds.push(cp.id);

        logger.info("Rotated out old checkpoint", {
          taskId,
          checkpointId: cp.id,
        });
      } catch (error: any) {
        logger.error("Failed to rotate checkpoint", {
          taskId,
          checkpointId: cp.id,
          error: error.message,
        });
      }
    }

    return deletedIds;
  }

  public updateConfig(config: Partial<OptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const checkpointOptimizer = CheckpointOptimizer.getInstance();
