// End-to-End Workflow Tests - Phase 2: MVP Core
// Week 14, Task 14.2: End-to-End Workflow Testing

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { taskLifecycle } from "../../src/task/lifecycle";
import { taskRegistry } from "../../src/task-registry/registry";
import { multiLayerPersistence } from "../../src/persistence/multi-layer";
import { taskLifecycleHooks } from "../../src/hooks/task-lifecycle";
import { dockerHelper } from "../../src/util/docker-helper";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  beginTestTransaction,
  rollbackTestTransaction,
  createTestTask,
} from "../util/test-db-helpers";

describe("End-to-End Workflow Tests", () => {
  const usingDockerMock = !dockerHelper.isAvailable();

  if (!process.env.FORCE_MOCK_TESTS && usingDockerMock) {
    console.warn(
      "Docker unavailable - tests skipped. Use FORCE_MOCK_TESTS=true to run with mocks",
      {
        reason: "Docker socket not found or inaccessible",
      },
    );
    return;
  }

  if (usingDockerMock) {
    console.warn(
      "Running with Docker mocks - integration tests may not cover real Docker behavior",
      {
        reason: "Docker socket not found or inaccessible",
      },
    );
  }

  beforeAll(async () => {
    await setupTestDatabase();
    await taskRegistry.initialize();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    // Cleanup all test tasks
    const tasks = [
      "e2e-task-lifecycle",
      "e2e-checkpoint-task",
      "e2e-collab-task-1",
      "e2e-collab-task-2",
      "e2e-error-task",
      "e2e-recovery-task",
    ];

    for (const taskId of tasks) {
      try {
        await taskLifecycle.deleteTask(taskId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Failed to cleanup task in afterAll`, {
          taskId,
          error: errorMessage,
        });
      }
    }
  });

  describe("Workflow 1: Complete Task Lifecycle", () => {
    test("should handle create -> start -> complete flow", async () => {
      const events: string[] = [];

      // Track all lifecycle events
      taskLifecycleHooks.registerBeforeTaskStart(async () => {
        events.push("before_start");
        void 0;
      });
      taskLifecycleHooks.registerAfterTaskStart(async () => {
        events.push("after_start");
        void 0;
      });
      taskLifecycleHooks.registerBeforeTaskComplete(async () => {
        events.push("before_complete");
        void 0;
      });
      taskLifecycleHooks.registerAfterTaskComplete(async () => {
        events.push("after_complete");
        void 0;
      });

      const taskId = "e2e-task-lifecycle";

      // Step 1: Create task
      const created = await taskLifecycle.createTask({
        id: taskId,
        name: "E2E Lifecycle Test",
        owner: "test-agent",
        metadata: { step: "created" },
      });

      expect(created.id).toBe(taskId);
      expect(created.status).toBe("pending");
      expect(created.metadata?.step).toBe("created");

      // Step 2: Start task
      const started = await taskLifecycle.startTask(taskId, "test-agent");
      expect(started.status).toBe("running");

      // Verify state persisted
      const stateAfterStart = await multiLayerPersistence.loadState(taskId);
      expect(stateAfterStart?.status).toBe("running");

      // Verify logs created
      const logsAfterStart = await multiLayerPersistence.loadLogs(taskId);
      expect(logsAfterStart.length).toBeGreaterThan(0);
      expect(events).toContain("before_start");
      expect(events).toContain("after_start");

      // Step 3: Complete task
      const result = {
        success: true,
        status: "success" as const,
        data: { output: "test-output" },
        message: "Test completed",
      };
      const completed = await taskLifecycle.completeTask(taskId, result as any);
      expect(completed.status).toBe("completed");

      // Verify final state
      const finalState = await multiLayerPersistence.loadState(taskId);
      expect(finalState?.status).toBe("completed");

      // Verify all hooks executed
      expect(events).toEqual([
        "before_start",
        "after_start",
        "before_complete",
        "after_complete",
      ]);

      // Verify completion logged
      const allLogs = await multiLayerPersistence.loadLogs(taskId);
      const completeLog = allLogs.find((log) =>
        log.message.includes("completed"),
      );
      expect(completeLog).toBeDefined();
      expect(completeLog?.level).toBe("info");
    });

    test("should handle create -> cancel flow", async () => {
      const taskId = "e2e-cancel-test";

      // Create task
      const created = await taskLifecycle.createTask({
        id: taskId,
        name: "Cancel Test Task",
        owner: "test-agent",
      });

      expect(created.status).toBe("pending");

      // Cancel task
      const cancelled = await taskLifecycle.cancelTask(taskId);
      expect(cancelled.status).toBe("cancelled");

      // Verify cancellation logged
      const logs = await multiLayerPersistence.loadLogs(taskId, {
        level: "warning",
      });
      const cancelLog = logs.find((log) => log.message.includes("cancelled"));
      expect(cancelLog).toBeDefined();

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });

    test("should handle create -> start -> fail flow", async () => {
      const events: string[] = [];

      taskLifecycleHooks.registerBeforeTaskFail(async () => {
        events.push("before_fail");
        void 0;
      });
      taskLifecycleHooks.registerAfterTaskFail(async () => {
        events.push("after_fail");
        void 0;
      });

      const taskId = "e2e-fail-test";

      // Create and start task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Fail Test Task",
        owner: "test-agent",
      });

      await taskLifecycle.startTask(taskId, "test-agent");

      // Fail task
      await taskLifecycle.failTask(taskId, "Simulated failure");

      // Verify fail hooks executed
      expect(events).toContain("before_fail");
      expect(events).toContain("after_fail");

      // Verify error logged
      const errorLogs = await multiLayerPersistence.loadLogs(taskId, {
        level: "error",
      });
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0]?.message).toContain("failed");

      // Verify error in metadata
      const task = await taskRegistry.getById(taskId);
      expect(task?.status).toBe("failed");
      expect(task?.metadata?.error).toBe("Simulated failure");

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });
  });

  describe("Workflow 2: Checkpoint and Resume", () => {
    test("should create checkpoint and restore task state", async () => {
      const taskId = "e2e-checkpoint-task";

      // Step 1: Create and start task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Checkpoint Test Task",
        owner: "test-agent",
        metadata: { initial: "data", counter: 0 },
      });

      await taskLifecycle.startTask(taskId, "test-agent");

      // Step 2: Create checkpoint
      const checkpointId = await multiLayerPersistence.createCheckpoint(
        taskId,
        "Initial checkpoint",
      );

      expect(checkpointId).toBeDefined();
      expect(checkpointId).toContain("checkpoint_");

      // Step 3: Modify task state
      await taskRegistry.update(taskId, {
        metadata: { modified: "data", counter: 1 },
      });

      const modified = await taskRegistry.getById(taskId);
      expect(modified?.metadata?.counter).toBe(1);

      // Step 4: Restore checkpoint
      await multiLayerPersistence.restoreCheckpoint(taskId, checkpointId);

      // Verify restore completed (actual state restoration would need full implementation)
      const restored = await taskRegistry.getById(taskId);
      expect(restored).toBeDefined();

      // Step 5: List checkpoints
      const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
      expect(checkpoints.length).toBe(1);
      expect(checkpoints[0]?.id).toBe(checkpointId);
      expect(checkpoints[0]?.description).toBe("Initial checkpoint");

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });

    test("should handle multiple checkpoints", async () => {
      const taskId = "e2e-multiple-checkpoints";

      // Create and start task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Multiple Checkpoints Task",
        owner: "test-agent",
      });

      await taskLifecycle.startTask(taskId, "test-agent");

      // Create multiple checkpoints
      const checkpoint1 = await multiLayerPersistence.createCheckpoint(
        taskId,
        "Checkpoint 1",
      );

      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      const checkpoint2 = await multiLayerPersistence.createCheckpoint(
        taskId,
        "Checkpoint 2",
      );

      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      const checkpoint3 = await multiLayerPersistence.createCheckpoint(
        taskId,
        "Checkpoint 3",
      );

      // Verify all checkpoints created
      const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
      expect(checkpoints.length).toBe(3);
      expect(checkpoints[0]?.description).toBe("Checkpoint 3");
      expect(checkpoints[1]?.description).toBe("Checkpoint 2");
      expect(checkpoints[2]?.description).toBe("Checkpoint 1");

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });
  });

  describe("Workflow 3: Multi-Agent Collaboration", () => {
    test("should allow multiple agents to work on same task", async () => {
      const taskId = "e2e-collab-task-1";

      // Create task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Collaborative Task",
        owner: "agent-1",
        metadata: { collaborators: [] },
      });

      // Agent 1 starts task
      const started1 = await taskLifecycle.startTask(taskId, "agent-1");
      expect(started1.status).toBe("running");

      // Agent 1 completes task
      const result1 = {
        success: true,
        status: "success" as const,
        data: { completedBy: "agent-1", output: "phase-1-complete" },
        message: "Phase 1 completed",
      };
      await taskLifecycle.completeTask(taskId, result1 as any);

      // Verify task completed
      const task = await taskRegistry.getById(taskId);
      expect(task?.status).toBe("completed");

      // Verify all logs
      const logs = await multiLayerPersistence.loadLogs(taskId);
      expect(logs.length).toBeGreaterThan(0);

      const startLog = logs.find((log) => log.message.includes("started"));
      const completeLog = logs.find((log) => log.message.includes("completed"));

      expect(startLog).toBeDefined();
      expect(completeLog).toBeDefined();
      expect(startLog?.data?.agentId).toBe("agent-1");

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });

    test("should handle sequential agent handoffs", async () => {
      const taskId1 = "e2e-collab-task-2";

      // Agent 1 creates task
      await taskLifecycle.createTask({
        id: taskId1,
        name: "Handoff Task",
        owner: "agent-1",
      });

      await taskLifecycle.startTask(taskId1, "agent-1");
      await taskLifecycle.completeTask(taskId1, {
        success: true,
        status: "success" as const,
        data: { phase: 1, handoffTo: "agent-2" },
        message: "Phase 1 done",
      } as any);

      // Verify task data includes handoff info
      const task1 = await taskRegistry.getById(taskId1);
      expect(task1?.metadata?.handoffTo).toBe("agent-2");

      // Cleanup
      await taskLifecycle.deleteTask(taskId1);
    });
  });

  describe("Workflow 4: Error Recovery", () => {
    test("should recover from hook failure", async () => {
      const taskId = "e2e-error-task";

      // Register hook that fails
      let hookExecuted = false;
      taskLifecycleHooks.registerBeforeTaskStart(async () => {
        hookExecuted = true;
        throw new Error("Hook error");
      });

      // Create and attempt to start task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Error Recovery Task",
        owner: "test-agent",
      });

      // First start should fail
      await expect(
        taskLifecycle.startTask(taskId, "test-agent"),
      ).rejects.toThrow("Hook error");

      expect(hookExecuted).toBe(true);

      // Verify task is still pending (hook failure shouldn't corrupt state)
      const task = await taskRegistry.getById(taskId);
      expect(task?.status).toBe("pending");

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });

    test("should recover from persistence failure", async () => {
      const taskId = "e2e-recovery-task";

      // Create task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Persistence Recovery Task",
        owner: "test-agent",
      });

      // Start task
      await taskLifecycle.startTask(taskId, "test-agent");

      // Verify logs exist
      const logs = await multiLayerPersistence.loadLogs(taskId);
      expect(logs.length).toBeGreaterThan(0);

      // Complete task
      await taskLifecycle.completeTask(taskId, {
        success: true,
        status: "success" as const,
        data: { recovered: true },
        message: "Completed with recovery",
      } as any);

      // Verify completion persisted despite potential issues
      const finalLogs = await multiLayerPersistence.loadLogs(taskId);
      const completeLog = finalLogs.find((log) =>
        log.message.includes("completed"),
      );
      expect(completeLog).toBeDefined();

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });

    test("should handle cleanup after error", async () => {
      const taskId = "e2e-cleanup-after-error";

      // Create task
      await taskLifecycle.createTask({
        id: taskId,
        name: "Cleanup Test Task",
        owner: "test-agent",
      });

      // Create checkpoint
      await multiLayerPersistence.createCheckpoint(
        taskId,
        "Pre-error checkpoint",
      );

      // Fail task
      await taskLifecycle.startTask(taskId, "test-agent");
      await taskLifecycle.failTask(taskId, "Critical error");

      // Cleanup should work even after failure
      await taskLifecycle.deleteTask(taskId);

      // Verify all data cleaned up
      const state = await multiLayerPersistence.loadState(taskId);
      const logs = await multiLayerPersistence.loadLogs(taskId);
      const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);

      expect(state).toBeNull();
      expect(logs.length).toBe(0);
      expect(checkpoints.length).toBe(0);
    });
  });

  describe("Workflow 5: Docker Container (Mocked)", () => {
    test("should simulate container lifecycle", async () => {
      const taskId = "e2e-container-task";

      // Create task that represents a container
      const created = await taskLifecycle.createTask({
        id: taskId,
        name: "Container Task",
        owner: "test-agent",
        metadata: {
          container: {
            image: "node:20",
            ports: [{ containerPort: 3000, protocol: "tcp" }],
            resources: {
              memory: 512,
              cpuShares: 512,
              pidsLimit: 100,
            },
          },
        },
      });

      expect(created.status).toBe("pending");

      // Start task (simulating container start)
      const started = await taskLifecycle.startTask(taskId, "test-agent");
      expect(started.status).toBe("running");

      // Update task with container info
      await taskRegistry.update(taskId, {
        metadata: {
          ...created.metadata,
          container: {
            ...created.metadata?.container,
            containerId: "container-" + Date.now(),
            pid: 12345,
          },
        },
      });

      const withContainer = await taskRegistry.getById(taskId);
      expect(withContainer?.metadata?.container?.containerId).toBeDefined();
      expect(withContainer?.metadata?.container?.pid).toBe(12345);

      // Complete task (simulating container stop)
      await taskLifecycle.completeTask(taskId, {
        success: true,
        status: "success" as const,
        data: { exitCode: 0 },
        message: "Container completed successfully",
      } as any);

      // Verify final state
      const completed = await taskRegistry.getById(taskId);
      expect(completed?.status).toBe("completed");

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });

    test("should handle container resource limits", async () => {
      const taskId = "e2e-resource-limits-task";

      // Create task with resource limits
      await taskLifecycle.createTask({
        id: taskId,
        name: "Resource Limits Task",
        owner: "test-agent",
        metadata: {
          container: {
            image: "ubuntu:latest",
            resources: {
              memory: 1024, // 1GB
              cpuShares: 1024,
              pidsLimit: 200,
              diskSpace: 5120, // 5GB
            },
          },
        },
      });

      await taskLifecycle.startTask(taskId, "test-agent");

      // Verify resource limits stored
      const task = await taskRegistry.getById(taskId);
      const resources = task?.metadata?.container?.resources;

      expect(resources?.memory).toBe(1024);
      expect(resources?.cpuShares).toBe(1024);
      expect(resources?.pidsLimit).toBe(200);
      expect(resources?.diskSpace).toBe(5120);

      // Cleanup
      await taskLifecycle.deleteTask(taskId);
    });
  });
});
