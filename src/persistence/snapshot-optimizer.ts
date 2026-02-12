import { promises as fs } from "fs";
import { join, dirname, basename } from "path";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../util/logger";

const execAsync = promisify(exec);

export interface SnapshotOptions {
  includePaths: string[];
  excludePatterns?: string[];
  compress?: boolean;
  compressionLevel?: number;
  followSymlinks?: boolean;
}

export interface SnapshotResult {
  snapshotId: string;
  taskId: string;
  filesIncluded: number;
  totalSize: number;
  compressedSize?: number;
  duration: number;
  manifest: SnapshotManifest;
}

export interface SnapshotManifest {
  id: string;
  taskId: string;
  timestamp: string;
  includePaths: string[];
  excludePatterns: string[];
  files: string[];
  chunks?: ChunkInfo[];
  checksum: string;
}

export interface ChunkInfo {
  originalFile: string;
  chunkIndex: number;
  chunkSize: number;
  totalChunks: number;
}

export interface ChunkResult {
  originalFile: string;
  chunks: string[];
  manifest: ChunkInfo[];
  totalSize: number;
}

export interface TarOptions {
  compressionLevel?: number;
  excludePatterns?: string[];
  followSymlinks?: boolean;
}

export interface SnapshotInfo {
  id: string;
  taskId: string;
  timestamp: string;
  size: number;
  fileCount: number;
  hasChunks: boolean;
}

const CHUNK_SIZE = 50 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

export class SnapshotOptimizer {
  private static instance: SnapshotOptimizer;
  private basePath: string;

  private constructor() {
    this.basePath = join(process.cwd(), "data", "tasks");
  }

  public static getInstance(): SnapshotOptimizer {
    if (!SnapshotOptimizer.instance) {
      SnapshotOptimizer.instance = new SnapshotOptimizer();
    }
    return SnapshotOptimizer.instance;
  }

  public async createSelectiveSnapshot(
    taskId: string,
    options: SnapshotOptions,
  ): Promise<SnapshotResult> {
    const startTime = Date.now();
    const snapshotId = `snapshot_${Date.now()}`;
    const snapshotPath = join(this.basePath, taskId, "snapshots", snapshotId);

    try {
      await fs.mkdir(snapshotPath, { recursive: true });

      const files: string[] = [];
      let totalSize = 0;

      for (const includePath of options.includePaths) {
        const fullPath = join(this.basePath, taskId, includePath);
        const foundFiles = await this.listFiles(
          fullPath,
          options.excludePatterns || [],
        );

        for (const file of foundFiles) {
          const stats = await fs.stat(file);
          if (stats.isFile()) {
            const relativePath = file.replace(join(this.basePath, taskId), "");
            files.push(relativePath);
            totalSize += stats.size;
          }
        }
      }

      let compressedSize: number | undefined;
      if (options.compress !== false) {
        await this.createOptimizedTar(
          join(this.basePath, taskId),
          join(snapshotPath, "snapshot.tar.gz"),
          {
            compressionLevel: options.compressionLevel || 6,
            excludePatterns: options.excludePatterns,
            followSymlinks: options.followSymlinks,
          },
        );
        const tarStats = await fs.stat(join(snapshotPath, "snapshot.tar.gz"));
        compressedSize = tarStats.size;
      }

      const manifest: SnapshotManifest = {
        id: snapshotId,
        taskId,
        timestamp: new Date().toISOString(),
        includePaths: options.includePaths,
        excludePatterns: options.excludePatterns || [],
        files,
        checksum: await this.generateChecksum(files.join(",")),
      };

      await fs.writeFile(
        join(snapshotPath, "manifest.json"),
        JSON.stringify(manifest, null, 2),
      );

      const duration = Date.now() - startTime;

      logger.info("Selective snapshot created", {
        taskId,
        snapshotId,
        fileCount: files.length,
        totalSize,
        compressedSize,
        duration,
      });

      return {
        snapshotId,
        taskId,
        filesIncluded: files.length,
        totalSize,
        compressedSize,
        duration,
        manifest,
      };
    } catch (error: any) {
      logger.error("Failed to create selective snapshot", {
        taskId,
        snapshotId,
        error: error.message,
      });
      throw error;
    }
  }

  public async createChunkedSnapshot(
    taskId: string,
    filePath: string,
  ): Promise<ChunkResult> {
    const fullPath = join(this.basePath, taskId, filePath);
    const stats = await fs.stat(fullPath);

    if (stats.size <= LARGE_FILE_THRESHOLD) {
      return {
        originalFile: filePath,
        chunks: [filePath],
        manifest: [
          {
            originalFile: filePath,
            chunkIndex: 0,
            chunkSize: stats.size,
            totalChunks: 1,
          },
        ],
        totalSize: stats.size,
      };
    }

    const chunkDir = join(this.basePath, taskId, "chunks", basename(filePath));
    await fs.mkdir(chunkDir, { recursive: true });

    const chunks: string[] = [];
    const manifest: ChunkInfo[] = [];
    const totalChunks = Math.ceil(stats.size / CHUNK_SIZE);

    const fileHandle = await fs.open(fullPath, "r");
    let bytesRead = 0;
    let chunkIndex = 0;

    try {
      while (bytesRead < stats.size) {
        const chunkPath = join(chunkDir, `chunk_${chunkIndex}.bin`);
        const currentChunkSize = Math.min(CHUNK_SIZE, stats.size - bytesRead);
        const buffer = Buffer.alloc(currentChunkSize);

        await fileHandle.read(buffer, 0, currentChunkSize, bytesRead);
        await fs.writeFile(chunkPath, buffer);

        chunks.push(chunkPath.replace(join(this.basePath, taskId), ""));
        manifest.push({
          originalFile: filePath,
          chunkIndex,
          chunkSize: currentChunkSize,
          totalChunks,
        });

        bytesRead += currentChunkSize;
        chunkIndex++;
      }
    } finally {
      await fileHandle.close();
    }

    const manifestPath = join(chunkDir, "chunk_manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    logger.info("File chunked", {
      taskId,
      originalFile: filePath,
      originalSize: stats.size,
      chunkCount: chunks.length,
    });

    return {
      originalFile: filePath,
      chunks,
      manifest,
      totalSize: stats.size,
    };
  }

  public async createOptimizedTar(
    sourcePath: string,
    destPath: string,
    options: TarOptions = {},
  ): Promise<void> {
    const excludeFlags = (options.excludePatterns || [])
      .map((p) => `--exclude='${p}'`)
      .join(" ");

    const followSymlinks = options.followSymlinks ? "" : "--no-recursion";
    const compressionLevel = options.compressionLevel || 6;

    const command = `tar ${followSymlinks} ${excludeFlags} -czf "${destPath}" -C "${sourcePath}" .`;

    try {
      await execAsync(command, { timeout: 300000 });
      logger.info("Optimized tar created", { sourcePath, destPath });
    } catch (error: any) {
      logger.error("Failed to create optimized tar", {
        sourcePath,
        destPath,
        error: error.message,
      });
      throw error;
    }
  }

  public async restoreFromSnapshot(
    taskId: string,
    snapshotId: string,
  ): Promise<void> {
    const snapshotPath = join(this.basePath, taskId, "snapshots", snapshotId);

    try {
      const tarPath = join(snapshotPath, "snapshot.tar.gz");
      const destPath = join(this.basePath, taskId);

      await execAsync(`tar -xzf "${tarPath}" -C "${destPath}"`, {
        timeout: 300000,
      });

      logger.info("Snapshot restored", { taskId, snapshotId });
    } catch (error: any) {
      logger.error("Failed to restore snapshot", {
        taskId,
        snapshotId,
        error: error.message,
      });
      throw error;
    }
  }

  public async getSnapshotInfo(
    taskId: string,
    snapshotId: string,
  ): Promise<SnapshotInfo> {
    const snapshotPath = join(this.basePath, taskId, "snapshots", snapshotId);

    try {
      const manifestData = await fs.readFile(
        join(snapshotPath, "manifest.json"),
        "utf-8",
      );
      const manifest: SnapshotManifest = JSON.parse(manifestData);

      let size = 0;
      try {
        const tarStats = await fs.stat(join(snapshotPath, "snapshot.tar.gz"));
        size = tarStats.size;
      } catch {}

      return {
        id: snapshotId,
        taskId,
        timestamp: manifest.timestamp,
        size,
        fileCount: manifest.files.length,
        hasChunks: (manifest.chunks?.length || 0) > 0,
      };
    } catch (error: any) {
      logger.error("Failed to get snapshot info", {
        taskId,
        snapshotId,
        error: error.message,
      });
      throw error;
    }
  }

  public async cleanupOldSnapshots(
    taskId: string,
    maxAge: number,
  ): Promise<string[]> {
    const snapshotsPath = join(this.basePath, taskId, "snapshots");
    const deleted: string[] = [];

    try {
      const snapshots = await fs.readdir(snapshotsPath);
      const cutoff = Date.now() - maxAge;

      for (const snapshotId of snapshots) {
        const snapshotDir = join(snapshotsPath, snapshotId);
        const stats = await fs.stat(snapshotDir);

        if (stats.birthtimeMs < cutoff) {
          await fs.rm(snapshotDir, { recursive: true, force: true });
          deleted.push(snapshotId);
          logger.info("Old snapshot cleaned up", { taskId, snapshotId });
        }
      }

      return deleted;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return deleted;
      }
      throw error;
    }
  }

  public async reassembleChunkedFile(
    taskId: string,
    chunkDir: string,
  ): Promise<string> {
    const fullChunkDir = join(this.basePath, taskId, chunkDir);
    const manifestPath = join(fullChunkDir, "chunk_manifest.json");

    const manifestData = await fs.readFile(manifestPath, "utf-8");
    const manifest: ChunkInfo[] = JSON.parse(manifestData);

    const originalFileName = manifest[0]?.originalFile;
    if (!originalFileName) {
      throw new Error("Invalid chunk manifest: missing original file name");
    }

    const outputPath = join(this.basePath, taskId, originalFileName);
    const writeHandle = await fs.open(outputPath, "w");

    try {
      for (const chunk of manifest) {
        const chunkPath = join(fullChunkDir, `chunk_${chunk.chunkIndex}.bin`);
        const chunkData = await fs.readFile(chunkPath);
        await writeHandle.write(
          chunkData,
          0,
          chunkData.length,
          chunk.chunkIndex * CHUNK_SIZE,
        );
      }
    } finally {
      await writeHandle.close();
    }

    logger.info("Chunked file reassembled", {
      taskId,
      originalFile: originalFileName,
      chunkCount: manifest.length,
    });

    return outputPath;
  }

  private async listFiles(
    dirPath: string,
    excludePatterns: string[],
  ): Promise<string[]> {
    const files: string[] = [];

    const shouldExclude = (filePath: string): boolean => {
      return excludePatterns.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(filePath);
      });
    };

    const traverse = async (currentPath: string) => {
      if (shouldExclude(currentPath)) return;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentPath, entry.name);
          if (shouldExclude(fullPath)) continue;

          if (entry.isDirectory()) {
            await traverse(fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          logger.warn("Failed to traverse directory", {
            path: currentPath,
            error: error.message,
          });
        }
      }
    };

    await traverse(dirPath);
    return files;
  }

  private async generateChecksum(data: string): Promise<string> {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

export const snapshotOptimizer = SnapshotOptimizer.getInstance();
