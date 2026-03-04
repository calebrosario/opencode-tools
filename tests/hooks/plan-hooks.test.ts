// Plan Hooks Tests - Phase 2: MVP Core
// Week 12, Task 12.13: Hook Tests

import { jest } from "@jest/globals";

// Mock taskRegistry before importing hooks (scoped to this module only)
jest.mock("../../src/task-registry/registry", () => ({
  taskRegistry: {
    getById: jest.fn().mockResolvedValue(undefined as any),
  },
}));

// NOTE: Removed global fs mock - it pollutes other tests that need real fs operations
// The plan hooks log internally and don't require actual file operations for these tests

import { describe, test, expect, beforeEach } from "@jest/globals";
import { createPlanFileCreatorHook } from "../../src/hooks/plan-hooks/file-creator";
import { createPlanUpdaterHook } from "../../src/hooks/plan-hooks/updater";
import { createPlanFinalizerHook } from "../../src/hooks/plan-hooks/finalizer";
import type { TaskResult } from "../../src/types/lifecycle";
import { taskRegistry } from "../../src/task-registry/registry";

const mockGetById = taskRegistry.getById as jest.Mock;

describe("Plan Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Plan File Creator Hook", () => {
    test("should create hook function", () => {
      const hook = createPlanFileCreatorHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createPlanFileCreatorHook();
      // Mock taskRegistry.getById to return undefined (task not found)
      mockGetById.mockResolvedValueOnce(undefined as any);
      // Hook returns undefined if task not found (graceful degradation)
      await expect(hook("task-123", "agent-1")).resolves.toBeUndefined();
    });
  });

  describe("Plan Updater Hook", () => {
    test("should create hook function", () => {
      const hook = createPlanUpdaterHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and result", async () => {
      const hook = createPlanUpdaterHook();
      const result: TaskResult = {
        success: true,
        data: { output: "done" },
      };
      // Hook logs internally (real file operations are placeholders)
      await expect(hook("task-456", result)).resolves.toBeUndefined();
    });
  });

  describe("Plan Finalizer Hook", () => {
    test("should create hook function", () => {
      const hook = createPlanFinalizerHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and result", async () => {
      const hook = createPlanFinalizerHook();
      const result: TaskResult = {
        success: true,
        data: { output: "done" },
      };
      // Hook logs internally (real file operations are placeholders)
      await expect(hook("task-789", result)).resolves.toBeUndefined();
    });
  });
});
