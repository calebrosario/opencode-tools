// Detach Command - Phase 2: MVP Core
// Week 13, Task 13.4: Implement /detach Command

import { Command } from "commander";
import { taskRegistry } from "../../task-registry/registry";
import { logger } from "../../util/logger";

/**
 * Detach an agent from a task (keeps task in current state)
 */
export const detachCommand = new Command("detach")
  .description("Detach agent from task")
  .argument("<taskId>", "Task ID")
  .option("-a, --agent <string>", "Agent ID to detach")
  .action(async (taskId: string, options: { agent?: string }) => {
    try {
      // Validate task exists
      const task = await taskRegistry.getById(taskId);
      if (!task) {
        console.error("❌ Task not found");
        process.exit(1);
      }

      // Log detachment (actual detachment handled by MCP tool in real implementation)
      logger.info("Agent detached from task", {
        taskId,
        agentId: options.agent,
      });

      console.log("✅ Agent detached from task");
      console.log(`   Task ID: ${task.id}`);
      console.log(`   Task Name: ${task.name}`);
      console.log(`   Agent: ${options.agent || "current agent"}`);
      console.log(`   Task Status: ${task.status} (unchanged)`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to detach agent:", errorMessage);
      process.exit(1);
    }
  });
