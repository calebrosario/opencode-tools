// Session Interruption Handler Tests - Edge Case 1
import { test, expect, jest, describe, beforeEach } from "@jest/globals";
import {
  InterruptionHandler,
  interruptionHandler,
} from "../../src/session/interruption-handler";

// Mock multiLayerPersistence
jest.mock("../../src/persistence/multi-layer", () => ({
  multiLayerPersistence: {
    createCheckpoint: jest.fn(
      async (taskId: string, reason: string) =>
        `checkpoint-${taskId}-${Date.now()}`,
    ),
    restoreCheckpoint: jest.fn(
      async (_taskId: string, _checkpointId: string) => undefined,
    ),
  },
}));

import { multiLayerPersistence } from "../../src/persistence/multi-layer";

describe("InterruptionHandler", () => {
  let handler: InterruptionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    InterruptionHandler.resetInstance();
    handler = InterruptionHandler.getInstance();
  });

  describe("Session Lifecycle", () => {
    test("should start a new session", () => {
      const sessionId = "session-123";
      const taskId = "task-456";
      const agentId = "agent-789";

      handler.startSession(sessionId, taskId, agentId);

      const state = handler.getSessionState(sessionId);
      expect(state).toBeDefined();
      expect(state?.sessionId).toBe(sessionId);
      expect(state?.taskId).toBe(taskId);
      expect(state?.agentId).toBe(agentId);
      expect(state?.status).toBe("active");
    });

    test("should check if session is active", () => {
      const sessionId = "session-123";
      handler.startSession(sessionId);

      expect(handler.isSessionActive(sessionId)).toBe(true);
    });

    test("should cleanup session state", () => {
      const sessionId = "session-123";
      handler.startSession(sessionId);

      expect(handler.getSessionState(sessionId)).toBeDefined();

      handler.cleanupSession(sessionId);

      expect(handler.getSessionState(sessionId)).toBeUndefined();
    });
  });

  describe("Interruption Detection", () => {
    test("should handle SIGTERM interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
      expect(multiLayerPersistence.createCheckpoint).toHaveBeenCalledWith(
        taskId,
        expect.stringContaining("sigterm"),
      );
    });

    test("should handle SIGINT interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "sigint", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });

    test("should handle SIGHUP interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "sighup", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });

    test("should handle timeout interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "timeout", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });

    test("should handle disconnect interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "disconnect", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });

    test("should not create checkpoint if already interrupted", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      const initialCalls = (multiLayerPersistence.createCheckpoint as jest.Mock)
        .mock.calls.length;

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      expect(
        (multiLayerPersistence.createCheckpoint as jest.Mock).mock.calls.length,
      ).toBe(initialCalls);
    });

    test("should continue cleanup even if checkpoint fails", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockRejectedValue(
        new Error("Checkpoint creation failed"),
      );

      await expect(
        handler.handleInterruption(sessionId, "sigterm", {
          taskId,
          saveCheckpoint: true,
        }),
      ).resolves.toBeUndefined();

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });

    test("should skip checkpoint if saveCheckpoint is false", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: false,
      });

      expect(multiLayerPersistence.createCheckpoint).not.toHaveBeenCalled();

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });
  });

  describe("Checkpoint Management", () => {
    test("should enforce checkpoint cooldown to avoid spamming", async () => {
      const sessionId1 = "session-1";
      const sessionId2 = "session-2";
      const taskId = "task-456";

      handler.startSession(sessionId1, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption(sessionId1, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      const initialCalls = (multiLayerPersistence.createCheckpoint as jest.Mock)
        .mock.calls.length;

      // Second session should trigger cooldown
      handler.startSession(sessionId2, taskId);

      await handler.handleInterruption(sessionId2, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      // Second call should not create another checkpoint due to cooldown
      expect(
        (multiLayerPersistence.createCheckpoint as jest.Mock).mock.calls.length,
      ).toBe(initialCalls);
    });
  });

  describe("Session Resume", () => {
    test("should resume session from checkpoint", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";
      const checkpointId = "checkpoint-789";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.restoreCheckpoint as jest.Mock).mockResolvedValue(
        undefined,
      );

      await handler.resumeSession(sessionId, checkpointId);

      expect(multiLayerPersistence.restoreCheckpoint).toHaveBeenCalledWith(
        taskId,
        checkpointId,
      );

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("active");
    });

    test("should throw if session not found", async () => {
      await expect(
        handler.resumeSession("nonexistent-session", "checkpoint-123"),
      ).rejects.toThrow("Session nonexistent-session not found");
    });

    test("should throw if session has no task ID", async () => {
      const sessionId = "session-123";
      handler.startSession(sessionId);

      await expect(
        handler.resumeSession(sessionId, "checkpoint-123"),
      ).rejects.toThrow("Session session-123 has no task ID");
    });

    test("should mark session as interrupted on resume failure", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";
      const checkpointId = "checkpoint-789";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.restoreCheckpoint as jest.Mock).mockRejectedValue(
        new Error("Checkpoint corrupted"),
      );

      await expect(
        handler.resumeSession(sessionId, checkpointId),
      ).rejects.toThrow();

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("interrupted");
    });
  });

  describe("Latest Checkpoint Tracking", () => {
    test("should return latest checkpoint ID after interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";
      const checkpointId = "checkpoint-789";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        checkpointId,
      );

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      expect(handler.getLatestCheckpointId(sessionId)).toBe(checkpointId);
    });

    test("should return undefined if no checkpoint created", () => {
      const sessionId = "session-123";
      handler.startSession(sessionId);

      expect(handler.getLatestCheckpointId(sessionId)).toBeUndefined();
    });
  });

  describe("Graceful Shutdown", () => {
    test("should shutdown all active sessions", async () => {
      const session1 = "session-1";
      const session2 = "session-2";
      const task1 = "task-1";
      const task2 = "task-2";

      handler.startSession(session1, task1);
      handler.startSession(session2, task2);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.shutdown();

      expect(multiLayerPersistence.createCheckpoint).toHaveBeenCalledWith(
        task1,
        expect.any(String),
      );
      expect(multiLayerPersistence.createCheckpoint).toHaveBeenCalledWith(
        task2,
        expect.any(String),
      );
    });

    test("should prevent duplicate shutdowns", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.shutdown();

      const shutdownPromise2 = handler.shutdown();

      expect(shutdownPromise2).resolves.toEqual(undefined);
    });
  });

  describe("Event Emission", () => {
    test("should emit session:started event", () => {
      const emitSpy = jest.spyOn(handler, "emit");

      handler.startSession("session-123");

      expect(emitSpy).toHaveBeenCalledWith(
        "session:started",
        expect.objectContaining({
          sessionId: "session-123",
          status: "active",
        }),
      );
    });

    test("should emit session:interrupted event", async () => {
      const emitSpy = jest.spyOn(handler, "emit");

      handler.startSession("session-123", "task-456");
      (multiLayerPersistence.createCheckpoint as jest.Mock).mockResolvedValue(
        "checkpoint-123",
      );

      await handler.handleInterruption("session-123", "sigterm", {
        taskId: "task-456",
        saveCheckpoint: true,
      });

      expect(emitSpy).toHaveBeenCalledWith(
        "session:interrupted",
        expect.objectContaining({
          sessionId: "session-123",
          reason: "sigterm",
        }),
      );
    });

    test("should emit session:resumed event", async () => {
      const emitSpy = jest.spyOn(handler, "emit");

      handler.startSession("session-123", "task-456");
      (multiLayerPersistence.restoreCheckpoint as jest.Mock).mockResolvedValue(
        undefined,
      );

      await handler.resumeSession("session-123", "checkpoint-789");

      expect(emitSpy).toHaveBeenCalledWith(
        "session:resumed",
        expect.objectContaining({
          sessionId: "session-123",
          checkpointId: "checkpoint-789",
        }),
      );
    });
  });
});
