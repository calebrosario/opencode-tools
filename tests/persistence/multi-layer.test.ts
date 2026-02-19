// Multi-Layer Persistence Tests - Phase 2: MVP Core
// Week 9, Day 5: Persistence Tests

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { multiLayerPersistence } from "../../src/persistence/multi-layer";
import { LogEntry, AgentDecision } from "../../src/persistence/multi-layer";

describe("MultiLayerPersistence", () => {
  const testTaskId = "test-task-persistence";

  beforeAll(async () => {
    // Clean up any existing test data
    try {
      await multiLayerPersistence.cleanup(testTaskId);
    } catch (error) {
      // Ignore if task doesn't exist
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await multiLayerPersistence.cleanup(testTaskId);
  });

  describe("Layer 1: state.json", () => {
    test("should save and load state", async () => {
      const state = {
        taskId: testTaskId,
        status: "pending",
        data: { test: "data" },
        lastUpdated: new Date().toISOString(),
      };

      await multiLayerPersistence.saveState(testTaskId, state);
      const loaded = await multiLayerPersistence.loadState(testTaskId);

      expect(loaded).not.toBeNull();
      expect(loaded?.taskId).toBe(state.taskId);
      expect(loaded?.data).toEqual(state.data);
    });

    test("should handle missing state gracefully", async () => {
      const nonExistentTask = "non-existent-task";
      const loaded = await multiLayerPersistence.loadState(nonExistentTask);

      expect(loaded).toBeNull();
    });
  });

  describe("Layer 2: JSONL logs", () => {
    test("should append and load logs", async () => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Test log message",
        data: { key: "value" },
      };

      await multiLayerPersistence.appendLog(testTaskId, logEntry);
      const logs = await multiLayerPersistence.loadLogs(testTaskId);

      expect(logs.length).toBe(1);
      expect(logs[0]?.message).toBe(logEntry.message);
      expect(logs[0]?.level).toBe(logEntry.level);
    });

    test("should batch append logs", async () => {
      const entries: LogEntry[] = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        level: "info",
        message: `Batch log entry ${i}`,
        data: { index: i },
      }));

      await multiLayerPersistence.batchAppendLogs(testTaskId, entries);
      const logs = await multiLayerPersistence.loadLogs(testTaskId);

      expect(logs.length).toBeGreaterThanOrEqual(100);
    });

    test("should load logs with filters", async () => {
      const entries: LogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Info message",
        },
        {
          timestamp: new Date().toISOString(),
          level: "error",
          message: "Error message",
        },
      ];

      await multiLayerPersistence.batchAppendLogs(testTaskId, entries);

      const infoLogs = await multiLayerPersistence.loadLogs(testTaskId, {
        level: "info",
      });
      const errorLogs = await multiLayerPersistence.loadLogs(testTaskId, {
        level: "error",
      });

      expect(infoLogs.length).toBeGreaterThanOrEqual(1);
      expect(errorLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Layer 3: decisions.md", () => {
    test("should append and load decisions", async () => {
      const decision: AgentDecision = {
        timestamp: new Date().toISOString(),
        agentId: "test-agent",
        decision: "Test decision",
        reasoning: "Test reasoning for the decision",
        metadata: { key: "value" },
      };

      await multiLayerPersistence.appendDecision(testTaskId, decision);
      const decisions = await multiLayerPersistence.loadDecisions(testTaskId);

      expect(decisions.length).toBe(1);
      expect(decisions[0]?.decision).toBe(decision.decision);
      expect(decisions[0]?.agentId).toBe(decision.agentId);
    });
  });

  describe("Layer 4: checkpoints", () => {
    test("should create and list checkpoints", async () => {
      const checkpointId = await multiLayerPersistence.createCheckpoint(
        testTaskId,
        "Test checkpoint",
      );

      expect(checkpointId).toContain("checkpoint_");

      const checkpoints =
        await multiLayerPersistence.listCheckpoints(testTaskId);
      expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    });

    test("should restore from checkpoint", async () => {
      // Create initial state
      const initialState = {
        taskId: testTaskId,
        status: "running",
        data: { step: 1 },
        lastUpdated: new Date().toISOString(),
      };

      await multiLayerPersistence.saveState(testTaskId, initialState);

      // Create checkpoint
      const checkpointId =
        await multiLayerPersistence.createCheckpoint(testTaskId);

      // Modify state
      const modifiedState = {
        ...initialState,
        data: { step: 2 },
      };

      await multiLayerPersistence.saveState(testTaskId, modifiedState);

      // Restore from checkpoint
      await multiLayerPersistence.restoreCheckpoint(testTaskId, checkpointId);

      const restoredState = await multiLayerPersistence.loadState(testTaskId);
      expect(restoredState?.data?.step).toBe(1);
    });
  });

  describe("cleanup", () => {
    test("should cleanup all layers", async () => {
      // Create data in all layers
      await multiLayerPersistence.saveState(testTaskId, {
        taskId: testTaskId,
        status: "pending",
        data: {},
        lastUpdated: new Date().toISOString(),
      });

      await multiLayerPersistence.appendLog(testTaskId, {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Test log",
      });

      await multiLayerPersistence.createCheckpoint(testTaskId);

      // Cleanup
      await multiLayerPersistence.cleanup(testTaskId);

      // Verify cleanup
      const state = await multiLayerPersistence.loadState(testTaskId);
      expect(state).toBeNull();

      const logs = await multiLayerPersistence.loadLogs(testTaskId);
      expect(logs.length).toBe(0);

      const checkpoints =
        await multiLayerPersistence.listCheckpoints(testTaskId);
      expect(checkpoints.length).toBe(0);
    });
  });
});
