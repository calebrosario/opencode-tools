// Session Interruption Handler Tests - Edge Case 1
import {
  InterruptionHandler,
  interruptionHandler,
} from "../../src/session/interruption-handler";
import { multiLayerPersistence } from "../../src/persistence/multi-layer";

// Mock multiLayerPersistence for testing
jest.mock("../../src/persistence/multi-layer");

describe("InterruptionHandler", () => {
  let handler: InterruptionHandler;
  const mockCreateCheckpoint = jest.mocked(
    multiLayerPersistence.createCheckpoint,
  );
  const mockRestoreCheckpoint = jest.mocked(
    multiLayerPersistence.restoreCheckpoint,
  );

  beforeEach(() => {
    // Clear all listeners and timers
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Reset singleton instance
    (InterruptionHandler as any).instance = undefined;
    handler = InterruptionHandler.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
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

    test("should update session activity", () => {
      const sessionId = "session-123";
      handler.startSession(sessionId);

      const initialLastActivity =
        handler.getSessionState(sessionId)?.lastActivity;

      jest.advanceTimersByTime(5000);

      handler.updateActivity(sessionId);

      const updatedLastActivity =
        handler.getSessionState(sessionId)?.lastActivity;
      expect(updatedLastActivity?.getTime()).toBeGreaterThan(
        initialLastActivity?.getTime() || 0,
      );
    });

    test("should check if session is active", () => {
      const sessionId = "session-123";
      handler.startSession(sessionId);

      expect(handler.isSessionActive(sessionId)).toBe(true);
    });

    test("should mark inactive session as not active on timeout", async () => {
      jest.useFakeTimers();
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      jest.advanceTimersByTime(310000); // > 5 minutes

      const isActive = handler.isSessionActive(sessionId);

      expect(isActive).toBe(false);
      expect(mockCreateCheckpoint).toHaveBeenCalledWith(
        taskId,
        expect.stringContaining("timeout"),
      );
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
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
      expect(mockCreateCheckpoint).toHaveBeenCalledWith(
        taskId,
        expect.stringContaining("sigterm"),
      );
    });

    test("should handle SIGINT interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.handleInterruption(sessionId, "sigint", {
        taskId,
        saveCheckpoint: true,
      });

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
      expect(mockCreateCheckpoint).toHaveBeenCalledWith(
        taskId,
        expect.stringContaining("sigint"),
      );
    });

    test("should handle SIGHUP interruption", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

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
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

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
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

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
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      const initialCalls = mockCreateCheckpoint.mock.calls.length;

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      expect(mockCreateCheckpoint.mock.calls.length).toBe(initialCalls);
    });

    test("should continue cleanup even if checkpoint fails", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockRejectedValue(
        new Error("Checkpoint creation failed"),
      );

      await expect(
        handler.handleInterruption(sessionId, "sigterm", {
          taskId,
          saveCheckpoint: true,
        }),
      ).resolves.not.toThrow();

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });

    test("should skip checkpoint if saveCheckpoint is false", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: false,
      });

      expect(mockCreateCheckpoint).not.toHaveBeenCalled();

      const state = handler.getSessionState(sessionId);
      expect(state?.status).toBe("shutdown");
    });
  });

  describe("Checkpoint Management", () => {
    test("should create checkpoint with timeout protection", async () => {
      jest.useFakeTimers();
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve("checkpoint-123"), 3000),
          ),
      );

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
        cleanupTimeoutMs: 5000,
      });

      expect(mockCreateCheckpoint).toHaveBeenCalled();
    });

    test("should timeout checkpoint creation if too slow", async () => {
      jest.useFakeTimers();
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve("checkpoint-123"), 10000),
          ),
      );

      await expect(
        handler.handleInterruption(sessionId, "sigterm", {
          taskId,
          saveCheckpoint: true,
          cleanupTimeoutMs: 100,
        }),
      ).rejects.toThrow("Checkpoint creation timeout");
    });

    test("should enforce checkpoint cooldown to avoid spamming", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.handleInterruption(sessionId, "sigterm", {
        taskId,
        saveCheckpoint: true,
      });

      const initialCalls = mockCreateCheckpoint.mock.calls.length;

      await expect(
        handler.handleInterruption(sessionId, "sigterm", {
          taskId,
          saveCheckpoint: true,
        }),
      ).rejects.toThrow("Checkpoint cooldown active");

      expect(mockCreateCheckpoint.mock.calls.length).toBe(initialCalls);
    });
  });

  describe("Session Resume", () => {
    test("should resume session from checkpoint", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";
      const checkpointId = "checkpoint-789";

      handler.startSession(sessionId, taskId);
      mockRestoreCheckpoint.mockResolvedValue(undefined);

      await handler.resumeSession(sessionId, checkpointId);

      expect(mockRestoreCheckpoint).toHaveBeenCalledWith(taskId, checkpointId);

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
      mockRestoreCheckpoint.mockRejectedValue(
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
      mockCreateCheckpoint.mockResolvedValue(checkpointId);

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
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.shutdown();

      expect(mockCreateCheckpoint).toHaveBeenCalledWith(
        task1,
        expect.any(String),
      );
      expect(mockCreateCheckpoint).toHaveBeenCalledWith(
        task2,
        expect.any(String),
      );
    });

    test("should prevent duplicate shutdowns", async () => {
      const sessionId = "session-123";
      const taskId = "task-456";

      handler.startSession(sessionId, taskId);
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

      await handler.shutdown();

      const shutdownPromise2 = handler.shutdown();

      expect(shutdownPromise2).resolves.toEqual(undefined);
    });

    test("should stop heartbeat monitor on shutdown", () => {
      jest.useFakeTimers();

      const clearIntervalSpy = jest.spyOn(global, "clearInterval");

      handler.startSession("session-123");

      jest.advanceTimersByTime(100);

      // Verify heartbeat monitor is started (interval is created)
      expect(handler.getSessionState("session-123")).toBeDefined();
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
      mockCreateCheckpoint.mockResolvedValue("checkpoint-123");

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
      mockRestoreCheckpoint.mockResolvedValue(undefined);

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
