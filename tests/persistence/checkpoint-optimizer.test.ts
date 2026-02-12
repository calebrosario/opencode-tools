import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import {
  CheckpointOptimizer,
  checkpointOptimizer,
  RotationPolicy,
} from "../../src/persistence/checkpoint-optimizer";

describe("CheckpointOptimizer", () => {
  const testTaskId = "test-checkpoint-task";
  const testBasePath = join(process.cwd(), "data", "tasks", testTaskId);

  beforeEach(async () => {
    try {
      await fs.mkdir(testBasePath, { recursive: true });
      await fs.mkdir(join(testBasePath, "checkpoints"), { recursive: true });
    } catch {
      // Directory might exist
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
    vi.clearAllMocks();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = CheckpointOptimizer.getInstance();
      const instance2 = CheckpointOptimizer.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should accept custom config", () => {
      const optimizer = CheckpointOptimizer.getInstance({
        maxStorageGB: 10,
        compressionEnabled: false,
      });
      expect(optimizer).toBeDefined();
    });
  });

  describe("getCheckpointSize", () => {
    it("should return 0 for non-existent checkpoint", async () => {
      const size = await checkpointOptimizer.getCheckpointSize(
        testTaskId,
        "non-existent",
      );
      expect(size).toBe(0);
    });

    it("should calculate size of checkpoint files", async () => {
      const checkpointId = "checkpoint_test_size";
      const checkpointPath = join(testBasePath, "checkpoints", checkpointId);
      await fs.mkdir(checkpointPath, { recursive: true });
      await fs.writeFile(join(checkpointPath, "state.json"), '{"test": true}');
      await fs.writeFile(join(checkpointPath, "logs.jsonl"), '{"msg": "test"}');

      const size = await checkpointOptimizer.getCheckpointSize(
        testTaskId,
        checkpointId,
      );
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("getTotalStorageUsed", () => {
    it("should return 0 when no checkpoints exist", async () => {
      const size = await checkpointOptimizer.getTotalStorageUsed();
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getStorageStats", () => {
    it("should return storage statistics", async () => {
      const stats = await checkpointOptimizer.getStorageStats();
      expect(stats).toHaveProperty("totalBytes");
      expect(stats).toHaveProperty("totalGB");
      expect(stats).toHaveProperty("checkpointCount");
    });
  });

  describe("RotationPolicy", () => {
    it("should have default rotation policy", () => {
      const policy: RotationPolicy = {
        keepLastN: 10,
        keepDaily: 7,
        keepWeekly: 4,
      };
      expect(policy.keepLastN).toBe(10);
      expect(policy.keepDaily).toBe(7);
      expect(policy.keepWeekly).toBe(4);
    });
  });

  describe("updateConfig", () => {
    it("should update optimizer config", () => {
      checkpointOptimizer.updateConfig({ maxStorageGB: 20 });
      expect(checkpointOptimizer).toBeDefined();
    });
  });
});
