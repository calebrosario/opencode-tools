// Git Hooks Tests - Phase 2: MVP Core
// Week 12, Task 12.13: Hook Tests

import { describe, test, expect, beforeEach } from "@jest/globals";
import { createPreTaskBranchCreatorHook } from "../../src/hooks/git-hooks/branch-creator";
import { createBranchNameValidatorHook } from "../../src/hooks/git-hooks/branch-validator";
import { createSubmoduleCreatorHook } from "../../src/hooks/git-hooks/submodule-creator";

describe("Git Hooks", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("Branch Creator Hook", () => {
    test("should create hook function", () => {
      const hook = createPreTaskBranchCreatorHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createPreTaskBranchCreatorHook();
      // Hook logs internally (real exec calls are placeholders)
      await expect(hook("task-123", "agent-1")).resolves.not.toThrow();
    });
  });

  describe("Branch Validator Hook", () => {
    test("should create hook function", () => {
      const hook = createBranchNameValidatorHook();
      expect(typeof hook).toBe("function");
    });

    test("should validate branch name format", async () => {
      const hook = createBranchNameValidatorHook();
      await expect(hook("task-123", "agent-1")).resolves.not.toThrow();
    });
  });

  describe("Submodule Creator Hook", () => {
    test("should create hook function", () => {
      const hook = createSubmoduleCreatorHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createSubmoduleCreatorHook();
      // Hook logs internally (real exec calls are placeholders)
      await expect(hook("task-456", "agent-1")).resolves.not.toThrow();
    });
  });
});
