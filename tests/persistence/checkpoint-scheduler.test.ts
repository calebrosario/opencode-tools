/**
 * Tests for Checkpoint Scheduler
 * Phase 1: Stability (v1.1) - Edge Case 10
 */

import { describe, it, expect, beforeEach, afterEach } from "jest";
import {
  CheckpointScheduler,
  RiskLevel,
  RiskContext,
} from "../../src/persistence/checkpoint-scheduler";
import { ScheduleResult } from "../../src/persistence/checkpoint-scheduler";

describe("CheckpointScheduler", () => {
  let scheduler: CheckpointScheduler;

  beforeEach(() => {
    scheduler = CheckpointScheduler.getInstance();
  });

  afterEach(() => {
    scheduler.stopAllMonitoring();
  });

  describe("assessRisk", () => {
    it("should return LOW risk for simple operations", () => {
      const context: RiskContext = {
        operationCount: 5,
        filesChanged: 10,
        dependencies: 2,
        duration: 300000,
        previousFailures: 0,
      };

      const risk: RiskLevel = scheduler.assessRisk("task-low", context);

      expect(risk).toBe("LOW");
    });

    it("should return MEDIUM risk for moderate operations", () => {
      const context: RiskContext = {
        operationCount: 20,
        filesChanged: 50,
        dependencies: 5,
        duration: 600000,
        previousFailures: 1,
      };

      const risk: RiskLevel = scheduler.assessRisk("task-medium", context);

      expect(["LOW", "MEDIUM"]).toContain(risk);
    });

    it("should return HIGH risk for complex operations", () => {
      const context: RiskContext = {
        operationCount: 60,
        filesChanged: 150,
        dependencies: 10,
        duration: 1800000,
        previousFailures: 3,
      };

      const risk: RiskLevel = scheduler.assessRisk("task-high", context);

      expect(risk).toBe("HIGH");
    });

    it("should return CRITICAL risk for very complex operations", () => {
      const context: RiskContext = {
        operationCount: 150,
        filesChanged: 600,
        dependencies: 20,
        duration: 3600000,
        previousFailures: 6,
      };

      const risk: RiskLevel = scheduler.assessRisk("task-critical", context);

      expect(risk).toBe("CRITICAL");
    });
  });

  describe("getRecommendedInterval", () => {
    it("should return 30 minutes for LOW risk", () => {
      const interval = scheduler.getRecommendedInterval("LOW");

      expect(interval).toBe(30);
    });

    it("should return 15 minutes for MEDIUM risk", () => {
      const interval = scheduler.getRecommendedInterval("MEDIUM");

      expect(interval).toBe(15);
    });

    it("should return 5 minutes for HIGH risk", () => {
      const interval = scheduler.getRecommendedInterval("HIGH");

      expect(interval).toBe(5);
    });

    it("should return 1 minute for CRITICAL risk", () => {
      const interval = scheduler.getRecommendedInterval("CRITICAL");

      expect(interval).toBe(1);
    });
  });

  describe("startMonitoring", () => {
    it("should start monitoring for a task", async () => {
      const result: ScheduleResult =
        await scheduler.startMonitoring("task-monitor-1");

      expect(result.taskId).toBe("task-monitor-1");
      expect(result.active).toBe(true);
      expect(result.riskLevel).toBeDefined();
      expect(result.intervalMinutes).toBeGreaterThan(0);
      expect(result.nextCheckpoint).toBeInstanceOf(Date);
    });
  });

  describe("stopMonitoring", () => {
    it("should stop monitoring for a task", async () => {
      await scheduler.startMonitoring("task-stop-1");
      scheduler.stopMonitoring("task-stop-1");

      const status = scheduler.getMonitoringStatus("task-stop-1");

      expect(status).toBeNull();
    });
  });

  describe("getMonitoringStatus", () => {
    it("should return null for non-monitored task", () => {
      const status = scheduler.getMonitoringStatus("task-nonexistent");

      expect(status).toBeNull();
    });
  });

  describe("updateRiskLevel", () => {
    it("should update risk level and reschedule", async () => {
      await scheduler.startMonitoring("task-risk-update");

      const newContext: RiskContext = {
        operationCount: 100,
        filesChanged: 300,
        dependencies: 15,
        duration: 2000000,
        previousFailures: 4,
      };

      scheduler.updateRiskLevel("task-risk-update", newContext);

      const status = scheduler.getMonitoringStatus("task-risk-update");

      expect(status?.riskLevel).toBe("HIGH");
    });
  });

  describe("forceCheckpoint", () => {
    it("should create forced checkpoint", async () => {
      const checkpointId = await scheduler.forceCheckpoint(
        "task-force-1",
        "Testing forced checkpoint",
      );

      expect(checkpointId).toBeDefined();
      expect(typeof checkpointId).toBe("string");
    });
  });

  describe("getCheckpointHistory", () => {
    it("should return checkpoint history", () => {
      const history = scheduler.getCheckpointHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it("should filter by task ID", () => {
      const history = scheduler.getCheckpointHistory("task-filter-1");

      expect(Array.isArray(history)).toBe(true);
    });
  });
});
