// Resume Task Command - Phase 2: MVP Core
// Week 13, Task 13.2: Implement /resume-task Command

import { Command } from "commander";
import { taskLifecycle } from "../../task/lifecycle";
import { multiLayerPersistence } from "../../persistence/multi-layer";

/**
 * Resume a pending task and attach an agent
 */
export const resumeTaskCommand = new Command("resume-task")
  .description("Resume a pending task")
  .argument("<taskId>", "Task ID to resume")
  .option("-a, --agent <string>", "Agent ID", "system")
  .option("-c, --checkpoint <string>", "Checkpoint ID to restore")
  .action(
    async (
      taskId: string,
      options: {
        agent?: string;
        checkpoint?: string;
      },
    ) => {
      try {
        // If checkpoint specified, restore it first
        if (options.checkpoint) {
          await multiLayerPersistence.restoreCheckpoint(
            taskId,
            options.checkpoint,
          );
          console.log(`   Checkpoint ${options.checkpoint} restored`);
        }

        const task = await taskLifecycle.startTask(
          taskId,
          options.agent || "system",
        );

        console.log("✅ Task resumed successfully");
        console.log(`   Task ID: ${task.id}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Agent: ${options.agent || "system"}`);

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
        console.error("❌ Failed to resume task:", errorMessage);
        process.exit(1);
      }
    },
  );
