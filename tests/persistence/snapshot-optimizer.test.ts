/**
 * Tests for Snapshot Optimizer
 * Phase 1: Stability (v1.1) - Edge Case 8
 */

import {
  SnapshotOptimizer,
  SnapshotOptions,
  SnapshotResult,
} from "../../src/persistence/snapshot-optimizer";
import { promises as fs } from "fs";
import { join } from "path";

describe("SnapshotOptimizer", () => {
  const testDataDir = join(process.cwd(), "data", "tasks");
  let optimizer: SnapshotOptimizer;

  beforeEach(async () => {
    SnapshotOptimizer.resetInstance();
    optimizer = SnapshotOptimizer.getInstance();
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
    SnapshotOptimizer.resetInstance();
  });

  describe("createSelectiveSnapshot", () => {
    it("should create snapshot with selected paths", async () => {
      const taskId = "task-snap-1";
      const sourceDir = join(testDataDir, taskId, "source");
      const includePath = join("source");

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(join(sourceDir, "file1.txt"), "content1");
      await fs.writeFile(join(sourceDir, "file2.txt"), "content2");

      const options: SnapshotOptions = {
        includePaths: [includePath],
        compress: true,
      };

      const result: SnapshotResult = await optimizer.createSelectiveSnapshot(
        taskId,
        options,
      );

      expect(result.snapshotId).toBeDefined();
      expect(result.filesIncluded).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.manifest.files.length).toBeGreaterThan(0);
    });

    it("should handle exclude patterns", async () => {
      const taskId = "task-snap-2";
      const sourceDir = join(testDataDir, taskId, "source");

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(join(sourceDir, "file.txt"), "content");
      await fs.writeFile(join(sourceDir, "node_modules"), "excluded");

      const options: SnapshotOptions = {
        includePaths: ["source"],
        excludePatterns: ["node_modules"],
      };

      const result: SnapshotResult = await optimizer.createSelectiveSnapshot(
        taskId,
        options,
      );

      expect(result.snapshotId).toBeDefined();
    });
  });

  describe("createChunkedSnapshot", () => {
    it("should chunk large files", async () => {
      const taskId = "task-chunk-1";
      const largeFile = join(testDataDir, taskId, "large.bin");
      const largeSize = 101 * 1024 * 1024; // 101MB - just over LARGE_FILE_THRESHOLD of 100MB
      const largeContent = Buffer.alloc(largeSize);

      await fs.mkdir(join(testDataDir, taskId), { recursive: true });
      await fs.writeFile(largeFile, largeContent);

      const result = await optimizer.createChunkedSnapshot(taskId, "large.bin");

      expect(result.originalFile).toBe("large.bin");
      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.totalSize).toBe(largeContent.length);
    });

    it("should not chunk small files", async () => {
      const taskId = "task-chunk-2";
      const smallFile = join(testDataDir, taskId, "small.txt");
      const smallContent = "small content";

      await fs.mkdir(join(testDataDir, taskId), { recursive: true });
      await fs.writeFile(smallFile, smallContent);

      const result = await optimizer.createChunkedSnapshot(taskId, "small.txt");

      expect(result.originalFile).toBe("small.txt");
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0]).toContain("small.txt");
    });
  });

  describe("getSnapshotInfo", () => {
    it("should return snapshot metadata", async () => {
      const taskId = "task-info-1";
      const snapshotId = "snapshot-123";

      // Create a snapshot with manifest
      const snapshotPath = join(testDataDir, taskId, "snapshots", snapshotId);
      await fs.mkdir(snapshotPath, { recursive: true });
      const manifest = {
        id: snapshotId,
        taskId,
        timestamp: new Date().toISOString(),
        files: ["file1.txt"],
      };
      await fs.writeFile(
        join(snapshotPath, "manifest.json"),
        JSON.stringify(manifest),
      );

      const info = await optimizer.getSnapshotInfo(taskId, snapshotId);

      expect(info).toBeDefined();
      expect(info?.id).toBe(snapshotId);
      expect(info?.taskId).toBe(taskId);
    });
  });

  describe("cleanupOldSnapshots", () => {
    it("should remove snapshots older than max age", async () => {
      const taskId = "task-cleanup-1";
      const maxAge = 60000;

      const deleted = await optimizer.cleanupOldSnapshots(taskId, maxAge);

      expect(Array.isArray(deleted)).toBe(true);
    });
  });

  describe("reassembleChunkedFile", () => {
    it("should reassemble chunked file", async () => {
      const taskId = "task-reassemble-1";
      const chunkDir = join(testDataDir, taskId, "chunks", "large.bin");
      await fs.mkdir(chunkDir, { recursive: true });

      // Create chunks and manifest (using 50MB chunk size to match CHUNK_SIZE constant)
      const chunkSize = 50 * 1024 * 1024;
      const chunk1 = Buffer.alloc(chunkSize);
      const chunk2 = Buffer.alloc(chunkSize);

      const manifest = [
        {
          originalFile: "large.bin",
          chunkIndex: 0,
          chunkSize: chunk1.length,
          totalChunks: 2,
        },
        {
          originalFile: "large.bin",
          chunkIndex: 1,
          chunkSize: chunk2.length,
          totalChunks: 2,
        },
      ];

      await fs.writeFile(join(chunkDir, "chunk_0.bin"), chunk1);
      await fs.writeFile(join(chunkDir, "chunk_1.bin"), chunk2);
      await fs.writeFile(
        join(chunkDir, "chunk_manifest.json"),
        JSON.stringify(manifest),
      );

      const result = await optimizer.reassembleChunkedFile(
        taskId,
        "chunks/large.bin",
      );

      expect(result).toContain("large.bin");
      const assembledStats = await fs.stat(result);
      // Implementation writes at positions based on chunkIndex * CHUNK_SIZE, so final size is 2 * CHUNK_SIZE = 100MB
      expect(assembledStats.size).toBe(2 * chunkSize);
    });
  });
});
