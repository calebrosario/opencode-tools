// Plan Hooks Tests - Phase 2: MVP Core
// Week 12, Task 12.13: Hook Tests

import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import { createPlanFileCreatorHook } from "../../src/hooks/plan-hooks/file-creator";
import { createPlanUpdaterHook } from "../../src/hooks/plan-hooks/updater";
import { createPlanFinalizerHook } from "../../src/hooks/plan-hooks/finalizer";
import type { TaskResult } from "../../src/types/lifecycle";

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
      await expect(hook("task-456", result)).resolves.not.toThrow();
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
      await expect(hook("task-789", result)).resolves.not.toThrow();
    });
  });
});
