// Create Task Command - Phase 2: MVP Core
// Week 13, Task 13.1: Implement /create-task Command

import { Command } from "commander";
import { taskLifecycle } from "../../task/lifecycle";
import type { TaskConfig } from "../../types/lifecycle";

/**
 * Create a new task with specified configuration
 */
export const createTaskCommand = new Command("create-task")
  .description("Create a new task")
  .argument("<name>", "Task name")
  .option("-d, --description <string>", "Task description")
  .option("-o, --owner <string>", "Task owner")
  .option("-m, --metadata <JSON>", "Task metadata as JSON")
  .action(
    async (
      name: string,
      options: {
        description?: string;
        owner?: string;
        metadata?: string;
      },
    ) => {
      try {
        const config: TaskConfig = {
          name,
          description: options.description,
          owner: options.owner,
          metadata: options.metadata ? JSON.parse(options.metadata) : undefined,
        };

        const task = await taskLifecycle.createTask(config);

        console.log("✅ Task created successfully");
        console.log(`   Task ID: ${task.id}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Owner: ${task.owner}`);
        console.log(`   Created At: ${task.createdAt.toISOString()}`);
        if (task.description) {
          console.log(`   Description: ${task.description}`);
        }

        console.log("\n💡 Found a bug or have feedback?");
        console.log(
          "   Report issues: https://github.com/calebrosario/agent-armor/issues/new",
        );
        console.log(
          "   Feature requests: https://github.com/calebrosario/agent-armor/issues/new?template=feature_request.md\n",
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("❌ Failed to create task:", errorMessage);
        process.exit(1);
      }
    },
  );
