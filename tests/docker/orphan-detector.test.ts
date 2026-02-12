/**
 * Tests for Orphaned Container Detector
 * Week 16, Day 1-2: Orphaned Container Detection
 */

import {
  OrphanDetector,
  OrphanDetectorConfig,
} from "../../src/docker/orphan-detector";
import { DockerManager } from "../../src/docker/manager";
import { ContainerInfo, ContainerStatus } from "../../src/types";

// Mock DockerManager
jest.mock("../../src/docker/manager");

const mockDockerManager = DockerManager as jest.Mocked<typeof DockerManager>;

// Mock logger
jest.mock("../../src/util/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const logger = require("../../src/util/logger").logger;

describe("OrphanDetector", () => {
  let detector: OrphanDetector;
  let mockListContainers: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton
    (OrphanDetector as any).instance = null;

    // Create new detector instance
    detector = OrphanDetector.getInstance();

    // Mock DockerManager methods
    mockDockerManager.getInstance.mockReturnValue(mockDockerManager as any);
    mockListContainers = jest.fn();
    mockDockerManager.listContainers = mockListContainers;
    mockDockerManager.removeContainer = jest.fn();
    mockDockerManager.inspectContainer = jest.fn();
  });

  afterEach(async () => {
    // Stop detector after each test
    detector.stop();
  });

  describe("Singleton Pattern", () => {
    test("should return same instance on multiple calls", () => {
      const instance1 = OrphanDetector.getInstance();
      const instance2 = OrphanDetector.getInstance();

      expect(instance1).toBe(instance2);
    });

    test("should allow custom configuration", () => {
      const customConfig: Partial<OrphanDetectorConfig> = {
        detectionIntervalMs: 10 * 60 * 1000,
        autoCleanupEnabled: false,
      };

      const customDetector = OrphanDetector.getInstance(customConfig);

      expect(customDetector).toBe(detector);
    });
  });

  describe("Initialization", () => {
    test("should initialize successfully with default config", async () => {
      await detector.initialize();

      expect(detector.getStatus().enabled).toBe(true);
      expect(detector.getStatus().isRunning).toBe(false);
      expect(detector.getStatus().autoCleanupEnabled).toBe(true);
    });

    test("should start periodic detection on initialization", async () => {
      await detector.initialize();

      // Wait a bit for initial detection
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockListContainers).toHaveBeenCalled();
      expect(detector.getLastDetectionTime()).not.toBeNull();
    });

    test("should not start detection when disabled", async () => {
      (OrphanDetector as any).instance = null;
      const disabledDetector = OrphanDetector.getInstance({
        enabled: false,
      });

      await disabledDetector.initialize();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("disabled"),
      );
    });
  });

  describe("Known Task Management", () => {
    test("should update known task IDs", () => {
      const taskIds = ["task-1", "task-2", "task-3"];

      detector.updateKnownTasks(taskIds);

      expect(detector.getStatus().knownTaskCount).toBe(3);
    });

    test("should add single task ID", () => {
      detector.addKnownTask("task-1");

      expect(detector.getStatus().knownTaskCount).toBe(1);
    });

    test("should remove task ID", () => {
      detector.addKnownTask("task-1");
      detector.removeKnownTask("task-1");

      expect(detector.getStatus().knownTaskCount).toBe(0);
    });

    test("should handle duplicate task IDs", () => {
      detector.addKnownTask("task-1");
      detector.addKnownTask("task-1");

      expect(detector.getStatus().knownTaskCount).toBe(1);
    });

    test("should handle non-existent task ID removal", () => {
      expect(() => {
        detector.removeKnownTask("non-existent");
      }).not.toThrow();
    });
  });

  describe("Orphan Detection", () => {
    const createMockContainer = (
      overrides: Partial<ContainerInfo> = {},
    ): ContainerInfo => ({
      id: "container-123",
      name: "opencode_task-1",
      image: "node:20",
      status: "exited",
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      labels: {
        "opencode.task.id": "task-1",
      },
      ...overrides,
    });

    test("should detect orphaned container without known task", async () => {
      const container = createMockContainer();
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.containersChecked).toBe(1);
      expect(result.orphansFound).toHaveLength(1);
      expect(result.orphansFound[0].taskId).toBe("task-1");
    });

    test("should not detect container with active task as orphan", async () => {
      const container = createMockContainer();
      mockListContainers.mockResolvedValue([container]);

      // Add task to known tasks
      detector.addKnownTask("task-1");

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(0);
    });

    test("should not detect container without task label", async () => {
      const container = createMockContainer({
        labels: {}, // No task label
      });
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(0);
    });

    test("should detect running container without known task as orphan", async () => {
      const container = createMockContainer({
        status: "running",
        createdAt: new Date(), // Recently created
      });
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(1);
      expect(result.orphansFound[0].status).toBe("running");
      expect(result.orphansFound[0].reason).toContain("not found");
    });

    test("should detect paused container without known task as orphan", async () => {
      const container = createMockContainer({
        status: "paused",
      });
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(1);
      expect(result.orphansFound[0].status).toBe("paused");
    });

    test("should detect stopped container older than threshold as orphan", async () => {
      const container = createMockContainer({
        status: "exited",
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(1);
      expect(result.orphansFound[0].ageMs).toBeGreaterThan(24 * 60 * 60 * 1000);
      expect(result.orphansFound[0].reason).toContain("stopped for");
    });

    test("should not detect stopped container newer than threshold as orphan", async () => {
      const container = createMockContainer({
        status: "exited",
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
      });
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(0);
    });

    test("should detect dead container older than threshold as orphan", async () => {
      const container = createMockContainer({
        status: "dead",
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });
      mockListContainers.mockResolvedValue([container]);

      const result = await detector.detectOrphans();

      expect(result.orphansFound).toHaveLength(1);
      expect(result.orphansFound[0].status).toBe("dead");
    });

    test("should detect multiple orphaned containers", async () => {
      const containers = [
        createMockContainer({
          id: "container-1",
          name: "opencode_task-1",
          labels: { "opencode.task.id": "task-1" },
        }),
        createMockContainer({
          id: "container-2",
          name: "opencode_task-2",
          labels: { "opencode.task.id": "task-2" },
        }),
        createMockContainer({
          id: "container-3",
          name: "opencode_task-3",
          labels: { "opencode.task.id": "task-3" },
        }),
      ];
      mockListContainers.mockResolvedValue(containers);

      const result = await detector.detectOrphans();

      expect(result.containersChecked).toBe(3);
      expect(result.orphansFound).toHaveLength(3);
    });

    test("should handle empty container list", async () => {
      mockListContainers.mockResolvedValue([]);

      const result = await detector.detectOrphans();

      expect(result.containersChecked).toBe(0);
      expect(result.orphansFound).toHaveLength(0);
    });

    test("should log orphan detection events", async () => {
      const container = createMockContainer();
      mockListContainers.mockResolvedValue([container]);

      await detector.detectOrphans();

      expect(logger.warn).toHaveBeenCalledWith(
        "Orphaned container detected",
        expect.objectContaining({
          taskId: "task-1",
          containerId: "container-123",
        }),
      );
    });
  });

  describe("Orphan Cleanup", () => {
    const createMockOrphan = (taskId: string): any => ({
      containerId: `container-${taskId}`,
      containerName: `opencode_${taskId}`,
      taskId,
      status: "exited" as ContainerStatus,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      ageMs: 25 * 60 * 60 * 1000,
      reason: "Container stopped for 25 hours",
    });

    test("should clean up orphaned containers", async () => {
      const orphans = [createMockOrphan("task-1"), createMockOrphan("task-2")];
      mockDockerManager.removeContainer.mockResolvedValue(undefined);

      const result = await detector.cleanupOrphans(orphans);

      expect(result.containersRemoved).toHaveLength(2);
      expect(result.containersRemoved).toContain("container-task-1");
      expect(result.containersRemoved).toContain("container-task-2");
      expect(mockDockerManager.removeContainer).toHaveBeenCalledTimes(2);
    });

    test("should use force flag when removing containers", async () => {
      const orphans = [createMockOrphan("task-1")];
      mockDockerManager.removeContainer.mockResolvedValue(undefined);

      await detector.cleanupOrphans(orphans);

      expect(mockDockerManager.removeContainer).toHaveBeenCalledWith(
        "container-task-1",
        true, // force
        false, // removeVolumes
      );
    });

    test("should handle removal failures gracefully", async () => {
      const orphans = [createMockOrphan("task-1"), createMockOrphan("task-2")];
      mockDockerManager.removeContainer
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Container not found"));

      const result = await detector.cleanupOrphans(orphans);

      expect(result.containersRemoved).toHaveLength(1);
      expect(result.containersFailed).toHaveLength(1);
      expect(result.containersFailed[0].containerId).toBe("container-task-2");
    });

    test("should not cleanup containers under age threshold", async () => {
      const youngOrphan: any = {
        containerId: "container-young",
        containerName: "opencode_young",
        taskId: "task-young",
        status: "exited" as ContainerStatus,
        createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        ageMs: 10 * 60 * 60 * 1000,
        reason: "Container stopped for 10 hours",
      };

      mockDockerManager.removeContainer.mockResolvedValue(undefined);

      await detector.cleanupOrphans([youngOrphan]);

      expect(mockDockerManager.removeContainer).not.toHaveBeenCalled();
    });

    test("should log cleanup events", async () => {
      const orphans = [createMockOrphan("task-1")];
      mockDockerManager.removeContainer.mockResolvedValue(undefined);

      await detector.cleanupOrphans(orphans);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up orphaned container"),
        expect.objectContaining({
          taskId: "task-1",
        }),
      );
    });

    test("should log cleanup failures", async () => {
      const orphans = [createMockOrphan("task-1")];
      const error = new Error("Container in use");
      mockDockerManager.removeContainer.mockRejectedValue(error);

      await detector.cleanupOrphans(orphans);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to clean up orphaned container",
        expect.objectContaining({
          containerId: "container-task-1",
        }),
      );
    });
  });

  describe("Periodic Detection", () => {
    test("should run detection periodically", async () => {
      jest.useFakeTimers();
      mockListContainers.mockResolvedValue([]);

      await detector.initialize();

      // Fast-forward time
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockListContainers).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test("should handle periodic detection errors", async () => {
      jest.useFakeTimers();
      mockListContainers
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("Docker error"))
        .mockResolvedValue([]);

      await detector.initialize();

      // Fast-forward past multiple detection cycles
      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Periodic orphan detection failed"),
        expect.any(Object),
      );

      jest.useRealTimers();
    });

    test("should stop periodic detection on stop()", async () => {
      jest.useFakeTimers();
      mockListContainers.mockResolvedValue([]);

      await detector.initialize();

      const initialCallCount = mockListContainers.mock.calls.length;

      // Stop detection
      detector.stop();

      // Fast-forward time
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(mockListContainers.mock.calls.length).toBe(initialCallCount);

      jest.useRealTimers();
    });
  });

  describe("Status and Queries", () => {
    test("should return detector status", async () => {
      await detector.initialize();

      const status = detector.getStatus();

      expect(status).toHaveProperty("enabled");
      expect(status).toHaveProperty("isRunning");
      expect(status).toHaveProperty("detectionIntervalMs");
      expect(status).toHaveProperty("autoCleanupEnabled");
      expect(status).toHaveProperty("knownTaskCount");
      expect(status).toHaveProperty("lastDetectionTime");
    });

    test("should return last detection time", async () => {
      mockListContainers.mockResolvedValue([]);

      await detector.detectOrphans();

      const lastDetection = detector.getLastDetectionTime();

      expect(lastDetection).toBeInstanceOf(Date);
      expect(lastDetection).not.toBeNull();
    });

    test("should return null for last detection time if never run", () => {
      const lastDetection = detector.getLastDetectionTime();

      expect(lastDetection).toBeNull();
    });
  });

  describe("Integration Scenarios", () => {
    test("should detect and cleanup orphans automatically", async () => {
      const container = createMockContainer();
      mockListContainers.mockResolvedValue([container]);
      mockDockerManager.removeContainer.mockResolvedValue(undefined);

      await detector.detectOrphans();

      expect(mockDockerManager.removeContainer).toHaveBeenCalled();
    });

    test("should track containers across multiple detection cycles", async () => {
      const container1 = createMockContainer({
        id: "container-1",
        labels: { "opencode.task.id": "task-1" },
      });
      const container2 = createMockContainer({
        id: "container-2",
        labels: { "opencode.task.id": "task-2" },
      });

      mockListContainers.mockResolvedValue([container1]);

      await detector.detectOrphans();
      expect(mockListContainers).toHaveBeenCalledTimes(1);

      // Update known tasks
      detector.addKnownTask("task-1");

      // Second detection - task-1 should not be orphaned
      mockListContainers.mockResolvedValue([container1, container2]);

      await detector.detectOrphans();
      expect(mockListContainers).toHaveBeenCalledTimes(2);
    });

    test("should handle concurrent detection requests", async () => {
      const container = createMockContainer();
      mockListContainers.mockResolvedValue([container]);

      // Fire multiple concurrent detections
      const promise1 = detector.detectOrphans();
      const promise2 = detector.detectOrphans();
      const promise3 = detector.detectOrphans();

      const results = await Promise.all([promise1, promise2, promise3]);

      // Only one should actually run, others should be skipped
      const actualDetections = results.filter((r) => r.containersChecked > 0);
      expect(actualDetections).toHaveLength(1);
    });
  });
});
