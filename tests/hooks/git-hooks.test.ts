// Git Hooks Tests - Phase 2: MVP Core
// Week 12, Task 12.13: Hook Tests

import { jest } from "@jest/globals";

// Mock git operations before importing hooks (scoped to this module only)
jest.mock("../../src/util/git-operations", () => ({
  createTaskBranch: jest.fn().mockResolvedValue({
    success: true,
    branchName: "task/task-123",
    attempts: 1,
  } as any),
  getWorkspacePath: jest.fn().mockReturnValue("/tmp/workspace" as any),
  getSubmoduleStatus: jest.fn().mockResolvedValue("error" as any),
  resolveSubmoduleConflict: jest.fn().mockResolvedValue({
    success: true,
    resolution: "rebase",
    status: "clean",
  } as any),
}));

// NOTE: Removed global child_process mock - it pollutes other tests that use exec (e.g., tar commands)
// The git hooks use git-operations which is already mocked above

import { describe, test, expect, beforeEach } from "@jest/globals";
import { createPreTaskBranchCreatorHook } from "../../src/hooks/git-hooks/branch-creator";
import { createBranchNameValidatorHook } from "../../src/hooks/git-hooks/branch-validator";
import { createSubmoduleCreatorHook } from "../../src/hooks/git-hooks/submodule-creator";
import { createTaskBranch } from "../../src/util/git-operations";

const mockCreateTaskBranch = createTaskBranch as jest.Mock;

describe("Git Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Branch Creator Hook", () => {
    test("should create hook function", () => {
      const hook = createPreTaskBranchCreatorHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createPreTaskBranchCreatorHook();
      // Mock createTaskBranch to return success
      mockCreateTaskBranch.mockResolvedValueOnce({
        success: true,
        branchName: "task/task-123",
        attempts: 1,
      } as any);
      // Hook logs internally (real exec calls are placeholders)
      await expect(hook("task-123", "agent-1")).resolves.toBeUndefined();
    });
  });

  describe("Branch Validator Hook", () => {
    test("should create hook function", () => {
      const hook = createBranchNameValidatorHook();
      expect(typeof hook).toBe("function");
    });

    test("should validate branch name format", async () => {
      const hook = createBranchNameValidatorHook();
      // task-123 matches the pattern (only lowercase, numbers, and hyphens after task/)
      await expect(hook("task-123", "agent-1")).resolves.toBeUndefined();
    });

    test("should reject invalid branch name format", async () => {
      const hook = createBranchNameValidatorHook();
      // TASK-123 has uppercase, doesn't match pattern
      await expect(hook("TASK-123", "agent-1")).rejects.toThrow(
        "Invalid branch name",
      );
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
      // getSubmoduleStatus returns "error" so it skips conflict resolution
      // and exec is mocked so the actual git commands won't throw
      await expect(hook("task-456", "agent-1")).resolves.toBeUndefined();
    });
  });
});
