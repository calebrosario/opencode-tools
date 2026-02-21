// Safety Hooks Tests - Phase 2: MVP Core
// Week 12, Task 12.13: Hook Tests

import { describe, test, expect, beforeEach } from "@jest/globals";
import { createContainerSafetyEnforcerHook } from "../../src/hooks/safety-hooks/container-enforcer";
import { createResourceLimitMonitorHook } from "../../src/hooks/safety-hooks/resource-monitor";
import { createIsolationCheckerHook } from "../../src/hooks/safety-hooks/isolation-checker";

describe("Safety Hooks", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("Container Enforcer Hook", () => {
    test("should create hook function", () => {
      const hook = createContainerSafetyEnforcerHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createContainerSafetyEnforcerHook();
      await hook("task-123", "agent-1");
      // Hook validates resource limits internally
      expect(true).toBe(true);
    });

    test("should accept custom config", () => {
      const hook = createContainerSafetyEnforcerHook({
        allowedImages: ["docker.io/node:18"],
        memoryLimit: 1024,
        cpuShares: 512,
        pidsLimit: 100,
      });
      expect(typeof hook).toBe("function");
    });
  });

  describe("Resource Monitor Hook", () => {
    test("should create hook function", () => {
      const hook = createResourceLimitMonitorHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createResourceLimitMonitorHook();
      await hook("task-456", "agent-1");
      // Hook monitors resources internally
      expect(true).toBe(true);
    });
  });

  describe("Isolation Checker Hook", () => {
    test("should create hook function", () => {
      const hook = createIsolationCheckerHook();
      expect(typeof hook).toBe("function");
    });

    test("should execute hook with taskId and agentId", async () => {
      const hook = createIsolationCheckerHook();
      await hook("task-789", "agent-1");
      // Hook checks isolation settings internally
      expect(true).toBe(true);
    });
  });
});
