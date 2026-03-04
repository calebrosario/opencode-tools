// Task Lifecycle Hooks Tests - Phase 2: MVP Core
// Week 12, Task 12.13: Hook Tests

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { taskLifecycleHooks } from "../../src/hooks/task-lifecycle";
import { TaskResult } from "../../src/types/lifecycle";

describe("TaskLifecycleHooks", () => {
  beforeEach(() => {
    const allHooks = taskLifecycleHooks.getAllHooks();
    allHooks.forEach((hook) => taskLifecycleHooks.unregisterHook(hook.id));
  });

  afterEach(() => {
    const allHooks = taskLifecycleHooks.getAllHooks();
    allHooks.forEach((hook) => taskLifecycleHooks.unregisterHook(hook.id));
  });

  describe("Hook Registration", () => {
    test("should register beforeTaskStart hook", () => {
      const mockHook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerBeforeTaskStart(mockHook);
      expect(hookId).toMatch(/^hook_\d+$/);
      expect(taskLifecycleHooks.getHooksByType("beforeTaskStart").length).toBe(
        1,
      );
    });

    test("should register afterTaskStart hook", () => {
      const mockHook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerAfterTaskStart(mockHook);
      expect(hookId).toMatch(/^hook_\d+$/);
      expect(taskLifecycleHooks.getHooksByType("afterTaskStart").length).toBe(
        1,
      );
    });

    test("should register beforeTaskComplete hook", () => {
      const mockHook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerBeforeTaskComplete(mockHook);
      expect(hookId).toMatch(/^hook_\d+$/);
      expect(
        taskLifecycleHooks.getHooksByType("beforeTaskComplete").length,
      ).toBe(1);
    });

    test("should register afterTaskComplete hook", () => {
      const mockHook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerAfterTaskComplete(mockHook);
      expect(hookId).toMatch(/^hook_\d+$/);
      expect(
        taskLifecycleHooks.getHooksByType("afterTaskComplete").length,
      ).toBe(1);
    });

    test("should register beforeTaskFail hook", () => {
      const mockHook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerBeforeTaskFail(mockHook);
      expect(hookId).toMatch(/^hook_\d+$/);
      expect(taskLifecycleHooks.getHooksByType("beforeTaskFail").length).toBe(
        1,
      );
    });

    test("should register afterTaskFail hook", () => {
      const mockHook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerAfterTaskFail(mockHook);
      expect(hookId).toMatch(/^hook_\d+$/);
      expect(taskLifecycleHooks.getHooksByType("afterTaskFail").length).toBe(1);
    });

    test("should return unique hook ID for each registration", () => {
      const hook1 = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hook2 = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const id1 = taskLifecycleHooks.registerBeforeTaskStart(hook1);
      const id2 = taskLifecycleHooks.registerBeforeTaskStart(hook2);
      expect(id1).not.toBe(id2);
    });
  });

  describe("Priority Ordering", () => {
    test("should execute hooks in priority order (lowest first)", async () => {
      const executionOrder: number[] = [];
      taskLifecycleHooks.registerBeforeTaskStart(async () => {
        executionOrder.push(10);
      }, 10);
      taskLifecycleHooks.registerBeforeTaskStart(async () => {
        executionOrder.push(1);
      }, 1);
      taskLifecycleHooks.registerBeforeTaskStart(async () => {
        executionOrder.push(5);
      }, 5);
      await taskLifecycleHooks.executeBeforeTaskStart("task-1", "agent-1");
      expect(executionOrder).toEqual([1, 5, 10]);
    });
  });

  describe("Error Handling", () => {
    test("should continue executing remaining hooks if one fails", async () => {
      const hook1 = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hook2 = jest.fn().mockReturnValue(Promise.reject(new Error("Hook 2 failed"))) as any;
      const hook3 = jest.fn().mockReturnValue(Promise.resolve()) as any;
      taskLifecycleHooks.registerBeforeTaskStart(hook1, 10);
      taskLifecycleHooks.registerBeforeTaskStart(hook2, 5);
      taskLifecycleHooks.registerBeforeTaskStart(hook3, 1);
      await taskLifecycleHooks.executeBeforeTaskStart("task-1", "agent-1");
      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
      expect(hook3).toHaveBeenCalled();
    });
  });

  describe("Hook Management", () => {
    test("should unregister hook by ID", () => {
      const hook = jest.fn().mockReturnValue(Promise.resolve()) as any;
      const hookId = taskLifecycleHooks.registerBeforeTaskStart(hook);
      expect(taskLifecycleHooks.getHooksByType("beforeTaskStart").length).toBe(
        1,
      );
      taskLifecycleHooks.unregisterHook(hookId);
      expect(taskLifecycleHooks.getHooksByType("beforeTaskStart").length).toBe(
        0,
      );
    });

    test("should get all registered hooks", () => {
      taskLifecycleHooks.registerBeforeTaskStart(
        jest.fn().mockReturnValue(Promise.resolve()) as any,
      );
      taskLifecycleHooks.registerAfterTaskStart(
        jest.fn().mockReturnValue(Promise.resolve()) as any,
      );
      taskLifecycleHooks.registerBeforeTaskComplete(
        jest.fn().mockReturnValue(Promise.resolve()) as any,
      );
      const allHooks = taskLifecycleHooks.getAllHooks();
      expect(allHooks.length).toBe(3);
      expect(allHooks.map((h) => h.type)).toEqual([
        "beforeTaskStart",
        "afterTaskStart",
        "beforeTaskComplete",
      ]);
    });
  });
});
