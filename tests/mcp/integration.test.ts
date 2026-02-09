// MCP Server Integration Tests - Phase 2: MVP Core
// Week 10, Day 5: MCP Integration Tests

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "@jest/globals";
import { MCPServerEnhanced } from "../../src/mcp/server";
import { TOOL_DEFINITIONS } from "../../src/mcp/tools";
import { dockerHelper } from "../../src/util/docker-helper";

describe("MCP Server Integration", () => {
  let server: any;
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Skip if Docker not available
    if (!dockerHelper.isAvailable()) {
      console.warn("Skipping MCP integration tests - Docker not available");
      return;
    }

    // Skip if database not initialized
    const { DatabaseManager } = require("../../src/database");
    try {
      const db = DatabaseManager.getInstance();
      if (!db || !db.getClient()) {
        console.warn(
          "Skipping MCP integration tests - Database not initialized",
        );
        return;
      }
    } catch (error) {
      console.warn(
        "Skipping MCP integration tests - Database not initialized",
        { error },
      );
      return;
    }

    server = MCPServerEnhanced.getInstance();
    await server.initialize();
    await server.start();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  afterEach(async () => {
    // Clean up tasks created during each test to ensure test isolation
    if (server && createdTaskIds.length > 0) {
      const deleteTool = TOOL_DEFINITIONS.find((t) => t.name === "delete_task");
      if (deleteTool) {
        for (const taskId of createdTaskIds) {
          try {
            await deleteTool.execute({ taskId });
            console.log(`Cleaned up task: ${taskId}`);
          } catch (error: unknown) {
            // Ignore cleanup errors - task might not exist or already deleted
            console.log(`Task cleanup skipped: ${taskId}`);
          }
        }
      }
      createdTaskIds.length = 0;
    }
  });

  describe("Tool Registration", () => {
    test("should register all 8 tools", () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const tools = server.getAllTools();
      expect(Object.keys(tools).length).toBeGreaterThanOrEqual(8);
    });

    test("should have create_task_sandbox tool", () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const tool = server.getTool("create_task_sandbox");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("create_task_sandbox");
    });

    test("should have attach_agent_to_task tool", () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const tool = server.getTool("attach_agent_to_task");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("attach_agent_to_task");
    });

    test("should have execute_in_task tool", () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const tool = server.getTool("execute_in_task");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("execute_in_task");
    });
  });

  describe("Tool Execution", () => {
    test("should execute create_task_sandbox tool", async () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const createTool = TOOL_DEFINITIONS.find(
        (t) => t.name === "create_task_sandbox",
      );

      const taskId = "test-task-1";
      const result = await createTool!.execute({
        taskId,
        name: "Test Task",
        owner: "test-agent",
      });

      createdTaskIds.push(taskId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect((result as any).taskId).toBe(taskId);
    });

    test("should execute attach_agent_to_task tool", async () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const attachTool = TOOL_DEFINITIONS.find(
        (t) => t.name === "attach_agent_to_task",
      );

      const taskId = "test-task-2";
      const result = await attachTool!.execute({
        taskId,
        agentId: "test-agent",
      });

      createdTaskIds.push(taskId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect((result as any).attached).toBe(true);
    });

    test("should execute execute_in_task tool", async () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const executeTool = TOOL_DEFINITIONS.find(
        (t) => t.name === "execute_in_task",
      );

      const taskId = "test-task-3";
      const result = await executeTool!.execute({
        taskId,
        command: 'echo "hello world"',
        timeout: 30000,
      });

      createdTaskIds.push(taskId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect((result as any).exitCode).toBe(0);
      expect((result as any).stdout).toContain("hello world");
    });

    test("should handle errors in tool execution", async () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const createTool = TOOL_DEFINITIONS.find(
        (t) => t.name === "create_task_sandbox",
      );

      await expect(
        createTool!.execute({
          taskId: "test-task-4",
          // Missing 'name' parameter
        }),
      ).rejects.toThrow();
      // Don't add test-task-4 to cleanup array since it wasn't created
    });
  });

  describe("Error Cases", () => {
    test("should handle invalid task ID", async () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const statusTool = TOOL_DEFINITIONS.find(
        (t) => t.name === "get_task_status",
      );

      await expect(
        statusTool!.execute({
          taskId: "non-existent-task",
        }),
      ).rejects.toThrow();
    });

    test("should handle tool not found", async () => {
      if (!server) {
        console.warn("Skipping test - MCP server not initialized");
        return;
      }
      const result = await server.processRequest({
        id: "test-request-1",
        method: "non_existent_tool",
        timestamp: new Date(),
      });

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(404);
      expect(result.error?.message).toContain("Tool not found");
    });
  });
});
