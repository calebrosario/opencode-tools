// Task Executions Command - Phase2: MVP Core
// Week 13, Task 13.10: Implement /task-executions Command

import { Command } from "commander";
import { taskRegistry } from "../../task-registry/registry";

/**
 * Display task execution statistics and details
 */
export const taskExecutionsCommand = new Command("task-executions")
  .description("Show task execution details")
  .argument("<taskId>", "Task ID")
  .action(async (taskId: string) => {
    try {
      const task = await taskRegistry.getById(taskId);
      if (!task) {
        console.error("❌ Task not found");
        process.exit(1);
      }

      displayTaskDetails(task);

      // Note: Container info would require DockerManager integration
      // For now, we show task-level execution details
      displayExecutionInfo(task);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to get task executions:", errorMessage);
      process.exit(1);
    }
  });

function displayTaskDetails(task: any): void {
  console.log(`\nTask Details:\n`);
  console.log(`   ID: ${task.id}`);
  console.log(`   Name: ${task.name}`);
  console.log(`   Status: ${task.status}`);
  console.log(`   Owner: ${task.owner}`);
  console.log(`   Created: ${task.createdAt.toISOString()}`);
  console.log(`   Updated: ${task.updatedAt.toISOString()}`);

  if (task.description) {
    console.log(`   Description: ${task.description}`);
  }

  if (Object.keys(task.metadata || {}).length > 0) {
    console.log(`   Metadata: ${JSON.stringify(task.metadata, null, 2)}`);
  }
}

function displayExecutionInfo(task: any): void {
  console.log(`\nExecution Info:\n`);

  const duration = new Date().getTime() - new Date(task.createdAt).getTime();
  const durationSeconds = Math.floor(duration / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);

  if (task.status === "running") {
    console.log(`   Running for: ${durationMinutes} minutes`);
  } else if (task.status === "completed") {
    console.log(`   Total execution time: ${durationMinutes} minutes`);
  }

  // Container info (placeholder - would use DockerManager in real implementation)
  if (task.metadata?.containerId) {
    console.log(`   Container ID: ${task.metadata.containerId}`);
    console.log(
      `   Container Status: ${task.status === "running" ? "Running" : "Stopped"}`,
    );
  }
}
