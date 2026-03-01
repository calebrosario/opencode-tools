// MCP Tools Implementation - Phase 2: MVP Core
// Week 10, Day 4: Actual tool implementations with TaskRegistry and TaskLifecycle

import { logger } from "../util/logger";
import { taskLifecycle } from "../task/lifecycle";
import { TaskConfig, TaskResult, TaskStatus } from "../types";

export const TOOL_DEFINITIONS = [
  {
    name: "create_task_sandbox",
    description: "Create a new task sandbox",
    execute: async (params: Record<string, any>) => {
      try {
        const config: TaskConfig = {
          id: params.taskId,
          name: params.name,
          owner: params.owner,
          metadata: params.metadata,
        };

        const task = await taskLifecycle.createTask(config);

        logger.info("Task sandbox created", {
          taskId: task.id,
          name: task.name,
        });

        return {
          success: true,
          taskId: task.id,
          status: task.status,
          createdAt: task.createdAt.toISOString(),
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to create task sandbox", { error: errorMessage });
        throw new Error(`Failed to create task: ${errorMessage}`);
      }
    },
  },
  {
    name: "attach_agent_to_task",
    description: "Attach an AI agent to an existing task",
    execute: async (params: Record<string, any>) => {
      try {
        const task = await taskLifecycle.startTask(
          params.taskId,
          params.agentId,
        );

        logger.info("Agent attached to task", {
          taskId: params.taskId,
          agentId: params.agentId,
        });

        return {
          success: true,
          taskId: task.id,
          agentId: params.agentId,
          attached: true,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to attach agent", { error: errorMessage });
        throw new Error(`Failed to attach agent: ${errorMessage}`);
      }
    },
  },
  {
    name: "detach_agent_from_task",
    description: "Detach an agent from a task",
    execute: async (params: Record<string, any>) => {
      try {
        // For now, detach just logs the action
        // In full implementation, we'd remove agent association from task metadata
        logger.info("Agent detached from task", {
          taskId: params.taskId,
          agentId: params.agentId,
        });

        return {
          success: true,
          taskId: params.taskId,
          agentId: params.agentId,
          detached: true,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to detach agent", { error: errorMessage });
        throw new Error(`Failed to detach agent: ${errorMessage}`);
      }
    },
  },
  {
    name: "execute_in_task",
    description: "Execute a command in a task",
    execute: async (params: Record<string, any>) => {
      try {
        const { DockerManager } = await import("../docker/manager");
        const dockerManager = DockerManager.getInstance();
        
        // Get container ID from task ID
        // In the full system, this would look up the container ID from the task registry
        // For now, we assume taskId is the container ID or there's a mapping
        const containerId = params.taskId;
        
        if (!containerId) {
          throw new Error("taskId is required");
        }
        
        const result = await dockerManager.execInContainer(
          containerId,
          params.command,
          {
            timeout: params.timeout || 60000,
            user: params.user,
            workingDir: params.workingDir,
            env: params.env,
          },
        );

        logger.info("Command executed in task", {
          taskId: params.taskId,
          command: params.command,
          exitCode: result.exitCode,
          duration: result.duration,
        });

        return {
          success: result.exitCode === 0,
          taskId: params.taskId,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          duration: result.duration,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to execute command", { error: errorMessage });
        throw new Error(`Failed to execute command: ${errorMessage}`);
      }
    },
  },
  {
    name: "list_tasks",
    description: "List all tasks with optional filters",
    execute: async (params: Record<string, any>) => {
      try {
        // This will be implemented with TaskRegistry.list()
        // For now, return empty array
        logger.info("Tasks listed", { filters: params });

        return {
          success: true,
          tasks: [],
          count: 0,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to list tasks", { error: errorMessage });
        throw new Error(`Failed to list tasks: ${errorMessage}`);
      }
    },
  },
  {
    name: "get_task_status",
    description: "Get task status and details",
    execute: async (params: Record<string, any>) => {
      try {
        const status = await taskLifecycle.getTaskStatus(params.taskId);

        logger.info("Task status retrieved", { taskId: params.taskId, status });

        return {
          success: true,
          taskId: params.taskId,
          status: status,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to get task status", { error: errorMessage });
        throw new Error(`Failed to get task status: ${errorMessage}`);
      }
    },
  },
  {
    name: "stop_task",
    description: "Stop a running task",
    execute: async (params: Record<string, any>) => {
      try {
        const { DockerManager } = await import("../docker/manager");
        const dockerManager = DockerManager.getInstance();
        
        const containerId = params.taskId;
        
        if (!containerId) {
          throw new Error("taskId is required");
        }

        // Stop Docker container
        try {
          await dockerManager.stopContainer(containerId, 10);
          logger.info("Docker container stopped", { containerId });
        } catch (containerError: unknown) {
          // Log but continue - container might not exist
          const errorMsg = containerError instanceof Error ? containerError.message : String(containerError);
          logger.warn("Failed to stop Docker container (may not exist)", {
            containerId,
            error: errorMsg,
          });
        }

        // Cancel task in lifecycle
        const task = await taskLifecycle.cancelTask(params.taskId);

        logger.info("Task stopped", { taskId: params.taskId });

        return {
          success: true,
          taskId: task.id,
          status: task.status,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to stop task", { error: errorMessage });
        throw new Error(`Failed to stop task: ${errorMessage}`);
      }
    },
  },
  {
    name: "delete_task",
    description: "Delete a task and cleanup",
    execute: async (params: Record<string, any>) => {
      try {
        const { DockerManager } = await import("../docker/manager");
        const dockerManager = DockerManager.getInstance();
        
        const containerId = params.taskId;
        
        if (!containerId) {
          throw new Error("taskId is required");
        }

        // Remove Docker container if it exists
        try {
          await dockerManager.removeContainer(containerId, true, true);
          logger.info("Docker container removed", { containerId });
        } catch (containerError: unknown) {
          // Log but continue - container might not exist
          const errorMsg = containerError instanceof Error ? containerError.message : String(containerError);
          logger.warn("Failed to remove Docker container (may not exist)", {
            containerId,
            error: errorMsg,
          });
        }

        // Delete task from lifecycle
        await taskLifecycle.deleteTask(params.taskId);

        logger.info("Task deleted", { taskId: params.taskId });

        return {
          success: true,
          taskId: params.taskId,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to delete task", { error: errorMessage });
        throw new Error(`Failed to delete task: ${errorMessage}`);
      }
    },
  },
];

// Export individual tools for registration
export const createTaskSandboxTool = TOOL_DEFINITIONS[0];
export const attachAgentTool = TOOL_DEFINITIONS[1];
export const detachAgentTool = TOOL_DEFINITIONS[2];
export const executeInTaskTool = TOOL_DEFINITIONS[3];
export const listTasksTool = TOOL_DEFINITIONS[4];
export const getTaskStatusTool = TOOL_DEFINITIONS[5];
export const stopTaskTool = TOOL_DEFINITIONS[6];
export const deleteTaskTool = TOOL_DEFINITIONS[7];
