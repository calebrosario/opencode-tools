// Task Decisions Command - Phase2: MVP Core
// Week 13, Task 13.11: Implement /task-decisions Command

import { Command } from "commander";
import { multiLayerPersistence } from "../../persistence/multi-layer";
import { taskRegistry } from "../../task-registry/registry";

/**
 * Display agent decisions for a task
 */
export const taskDecisionsCommand = new Command("task-decisions")
  .description("Show agent decisions for a task")
  .argument("<taskId>", "Task ID")
  .option("-a, --agent <string>", "Filter by agent ID")
  .option("--limit <number>", "Limit number of decisions", "20")
  .action(
    async (
      taskId: string,
      options: {
        agent?: string;
        limit?: number;
      },
    ) => {
      try {
        // Validate task exists
        const task = await taskRegistry.getById(taskId);
        if (!task) {
          console.error("❌ Task not found");
          process.exit(1);
        }

        const decisions = await multiLayerPersistence.loadDecisions(taskId);

        let filtered = decisions;
        if (options.agent) {
          filtered = decisions.filter((d) => d.agentId === options.agent);
        }

        const limit = options.limit ? Number(options.limit) : 20;
        const limited = filtered.slice(0, limit);

        displayDecisions(limited, taskId, filtered.length, limit);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("❌ Failed to load task decisions:", errorMessage);
        process.exit(1);
      }
    },
  );

function displayDecisions(
  decisions: any[],
  taskId: string,
  total: number,
  limit: number,
): void {
  if (decisions.length === 0) {
    console.log(`\nNo decisions found for task ${taskId}`);
    return;
  }

  console.log(`\nAgent Decisions for ${taskId}\n`);
  console.log(`Showing ${decisions.length} of ${total} decisions\n`);

  decisions.forEach((decision: any, index: number) => {
    const timestamp = new Date(decision.timestamp).toISOString();

    console.log(`${index + 1}. Agent: ${decision.agentId}`);
    console.log(`   Timestamp: ${timestamp}`);

    if (decision.context) {
      console.log(`   Context: ${decision.context}`);
    }

    if (decision.decision) {
      console.log(`   Decision: ${decision.decision}`);
    }

    if (decision.reasoning) {
      console.log(`   Reasoning: ${decision.reasoning}`);
    }

    console.log("");
  });

  if (total > limit) {
    console.log(
      `   ... and ${total - limit} more decisions (use --limit to show more)`,
    );
  }
}
