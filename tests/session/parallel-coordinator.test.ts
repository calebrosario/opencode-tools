import { describe, it, expect, beforeEach, afterEach } from "jest";
import {
  ParallelCoordinator,
  ConflictType,
  ResolutionStrategy,
  AgentResult,
  MergedResult,
} from "../../src/session/parallel-coordinator";
import {
  Operation,
  ConflictInfo,
} from "../../src/session/parallel-coordinator";

describe("ParallelCoordinator", () => {
  let coordinator: ParallelCoordinator;

  beforeEach(async () => {
    coordinator = ParallelCoordinator.getInstance();
  });

  afterEach(async () => {
    await coordinator.unregisterAgent("agent-1").catch(() => {});
    await coordinator.unregisterAgent("agent-2").catch(() => {});
    await coordinator.unregisterAgent("agent-3").catch(() => {});
  });

  describe("registerAgent", () => {
    it("should register new agent", async () => {
      await coordinator.registerAgent(
        "agent-1",
        "task-parallel",
        "/tmp/workspace-1",
      );

      const status = await coordinator.getAgentStatus("agent-1");

      expect(status?.agentId).toBe("agent-1");
      expect(status?.active).toBe(true);
    });

    it("should update existing agent registration", async () => {
      await coordinator.registerAgent(
        "agent-2",
        "task-parallel",
        "/tmp/workspace-2",
      );
      await coordinator.registerAgent(
        "agent-2",
        "task-parallel",
        "/tmp/workspace-2-updated",
      );

      const status = await coordinator.getAgentStatus("agent-2");

      expect(status?.workspace).toBe("/tmp/workspace-2-updated");
    });
  });

  describe("detectConflict", () => {
    it("should detect FILE_WRITE conflict", async () => {
      await coordinator.registerAgent(
        "agent-3",
        "task-conflict",
        "/tmp/workspace-3",
      );

      const operation: Operation = {
        agentId: "agent-3",
        taskId: "task-conflict",
        type: "FILE_WRITE",
        target: "/tmp/file.txt",
        timestamp: new Date(),
      };

      const conflict: ConflictInfo | null = await coordinator.detectConflict(
        "agent-3",
        operation,
      );

      expect(conflict).toBeNull();
    });

    it("should detect RESOURCE_LOCK conflict when resource already locked", async () => {
      await coordinator.registerAgent(
        "agent-4",
        "task-resource",
        "/tmp/workspace-4",
      );
      await coordinator.acquireResource("agent-4", "resource-1");

      const acquired = await coordinator.acquireResource(
        "agent-4",
        "resource-1",
      );

      expect(acquired).toBe(true);
    });
  });

  describe("acquireResource", () => {
    it("should acquire unheld resource", async () => {
      await coordinator.registerAgent(
        "agent-5",
        "task-resource-2",
        "/tmp/workspace-5",
      );

      const acquired = await coordinator.acquireResource(
        "agent-5",
        "new-resource",
      );

      expect(acquired).toBe(true);
    });

    it("should fail when resource held by other agent", async () => {
      await coordinator.registerAgent(
        "agent-6",
        "task-resource-3",
        "/tmp/workspace-6",
      );
      await coordinator.registerAgent(
        "agent-7",
        "task-resource-3",
        "/tmp/workspace-7",
      );

      await coordinator.acquireResource("agent-6", "shared-resource");
      const acquired = await coordinator.acquireResource(
        "agent-7",
        "shared-resource",
      );

      expect(acquired).toBe(false);
    });
  });

  describe("releaseResource", () => {
    it("should release held resource", async () => {
      await coordinator.registerAgent(
        "agent-8",
        "task-release",
        "/tmp/workspace-8",
      );

      await coordinator.acquireResource("agent-8", "resource-release");
      await coordinator.releaseResource("agent-8", "resource-release");

      const acquiredAgain = await coordinator.acquireResource(
        "agent-8",
        "resource-release",
      );

      expect(acquiredAgain).toBe(true);
    });
  });

  describe("resolveConflict", () => {
    it("should resolve conflict with SKIP strategy", async () => {
      const result = await coordinator.resolveConflict(
        "conflict-test-1",
        "SKIP",
      );

      expect(result.conflictId).toBeDefined();
      expect(result.strategy).toBe("SKIP");
      expect(result.success).toBe(true);
    });

    it("should resolve conflict with ABORT strategy", async () => {
      const result = await coordinator.resolveConflict(
        "conflict-test-2",
        "ABORT",
      );

      expect(result.conflictId).toBeDefined();
      expect(result.strategy).toBe("ABORT");
      expect(typeof result.success).toBe("boolean");
    });

    it("should return failure for nonexistent conflict", async () => {
      const result = await coordinator.resolveConflict(
        "nonexistent-conflict",
        "MERGE",
      );

      expect(result.success).toBe(false);
    });
  });

  describe("mergeResults", () => {
    it("should merge multiple agent results", async () => {
      const results: AgentResult[] = [
        {
          agentId: "agent-a",
          taskId: "task-merge",
          status: "success",
          outputs: { key1: "value1", key2: "value2" },
          filesModified: ["file1.ts", "file2.ts"],
          errors: [],
          completedAt: new Date(),
        },
        {
          agentId: "agent-b",
          taskId: "task-merge",
          status: "success",
          outputs: { key3: "value3" },
          filesModified: ["file3.ts"],
          errors: [],
          completedAt: new Date(),
        },
      ];

      const merged: MergedResult = await coordinator.mergeResults(
        "task-merge",
        results,
      );

      expect(merged.taskId).toBe("task-merge");
      expect(merged.successCount).toBe(2);
      expect(merged.failureCount).toBe(0);
      expect(Object.keys(merged.mergedOutputs).length).toBeGreaterThan(0);
      expect(merged.allFilesModified.length).toBeGreaterThan(0);
    });

    it("should track merge conflicts", async () => {
      const results: AgentResult[] = [
        {
          agentId: "agent-conflict-1",
          taskId: "task-merge-conflict",
          status: "success",
          outputs: { sharedKey: "value1" },
          filesModified: [],
          errors: [],
          completedAt: new Date(),
        },
        {
          agentId: "agent-conflict-2",
          taskId: "task-merge-conflict",
          status: "success",
          outputs: { sharedKey: "value2" },
          filesModified: [],
          errors: [],
          completedAt: new Date(),
        },
      ];

      const merged: MergedResult = await coordinator.mergeResults(
        "task-merge-conflict",
        results,
      );

      expect(merged.mergeConflicts.length).toBeGreaterThan(0);
    });
  });

  describe("isolateWorkspace", () => {
    it("should create isolated workspace directory", async () => {
      await coordinator.registerAgent(
        "agent-isolate",
        "task-isolate",
        "/tmp/workspace-isolate",
      );

      const workspace = await coordinator.isolateWorkspace("agent-isolate");

      expect(workspace.agentId).toBe("agent-isolate");
      expect(workspace.isolated).toBe(true);
      expect(workspace.workspacePath).toContain("agent_isolate");
    });
  });

  describe("getAgentStatus", () => {
    it("should return null for unregistered agent", async () => {
      const status = await coordinator.getAgentStatus("unregistered-agent");

      expect(status).toBeNull();
    });
  });

  describe("getActiveConflicts", () => {
    it("should return list of active conflicts", () => {
      const conflicts = coordinator.getActiveConflicts();

      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe("unregisterAgent", () => {
    it("should unregister agent and release resources", async () => {
      await coordinator.registerAgent(
        "agent-unregister",
        "task-unregister",
        "/tmp/workspace-unregister",
      );
      await coordinator.acquireResource(
        "agent-unregister",
        "resource-unregister",
      );

      await coordinator.unregisterAgent("agent-unregister");

      const status = await coordinator.getAgentStatus("agent-unregister");

      expect(status).toBeNull();
    });
  });
});
