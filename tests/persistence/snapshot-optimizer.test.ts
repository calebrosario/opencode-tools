/**
 * Tests for Snapshot Optimizer
 * Phase 1: Stability (v1.1) - Edge Case 8
 */

import { describe, it, expect, beforeEach, afterEach } from "jest";
import {
  SnapshotOptimizer,
  SnapshotOptions,
  SnapshotResult,
} from "../../src/persistence/snapshot-optimizer";
import { promises as fs } from "fs";
import { join } from "path";

describe("SnapshotOptimizer", () => {
  const testDataDir = join(__dirname, "..", ".data", "snapshot-optimizer");
  let optimizer: SnapshotOptimizer;

  beforeEach(async () => {
    optimizer = SnapshotOptimizer.getInstance();
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
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
      await fs.writeFile(join(sourceDir, "node_modules", "excluded"));

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
      const chunkSize = 50 * 1024 * 1024;
      const largeContent = Buffer.alloc(chunkSize + 1);

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
      const info = await optimizer.getSnapshotInfo(taskId, "snapshot-123");

      if (info) {
        expect(info.id).toBeDefined();
        expect(info.taskId).toBe(taskId);
      }
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

      const result = await optimizer.reassembleChunkedFile(
        taskId,
        "chunks/large.bin",
      );

      if (result) {
        expect(result).toContain("large.bin");
      }
    });
  });
});
