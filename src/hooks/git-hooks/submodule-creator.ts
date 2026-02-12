// Submodule Creator Hook - Phase 2: Edge Cases
// Week 15, Day 3: Git Submodule Conflict Detection

import { exec } from "child_process";
import { logger } from "../../util/logger";
import { AfterTaskStartHook } from "../task-lifecycle";
import {
  getWorkspacePath,
  getSubmoduleStatus,
  resolveSubmoduleConflict,
} from "../../util/git-operations";

/**
 * Create Git submodule for task memory with conflict detection
 *
 * Edge Case 9: Git Submodule Conflict Detection
 *
 * This hook:
 * 1. Creates a submodule pointing to task memory directory
 * 2. Checks submodule status (clean, dirty, diverged)
 * 3. Detects conflicts before creating
 * 4. Resolves conflicts with selected strategy (merge, rebase, skip)
 * 5. Initializes submodule
 * 6. Adds submodule to parent repo
 */
export function createSubmoduleCreatorHook(): AfterTaskStartHook {
  return async (taskId: string, agentId: string) => {
    const taskMemoryPath = ".task-memory";
    const wsPath = getWorkspacePath(taskId);

    logger.info("Creating task memory submodule with conflict detection", {
      taskId,
      taskMemoryPath,
      agentId,
    });

    try {
      // Check submodule status before creating
      const status = await getSubmoduleStatus(wsPath, taskMemoryPath);

      logger.info("Submodule status", {
        taskId,
        taskMemoryPath,
        status,
      });

      // If submodule already exists and has conflicts
      if (status !== "clean" && status !== "error") {
        logger.warn("Submodule has conflicts, resolving", {
          taskId,
          status,
        });

        // Try to resolve conflict (default: rebase)
        const resolution = await resolveSubmoduleConflict(
          wsPath,
          taskMemoryPath,
          "rebase",
        );

        if (resolution.success) {
          logger.info("Submodule conflict resolved", {
            taskId,
            resolution: resolution.resolution,
            status: resolution.status,
          });
        } else {
          logger.error("Failed to resolve submodule conflict", {
            taskId,
            error: resolution.error,
          });

          throw new Error(
            `Submodule conflict resolution failed: ${resolution.error}`,
          );
        }
      }

      // Add or update submodule
      try {
        await exec(`git submodule add ${taskMemoryPath} ${taskMemoryPath}`, {
          cwd: wsPath,
          timeout: 10000,
        });
      } catch (error: any) {
        // If submodule already exists, git add will fail
        if (!error.message?.includes("already exists in the index")) {
          logger.debug("Submodule already exists, updating", {
            taskId,
            taskMemoryPath,
          });
        } else {
          throw error;
        }
      }

      // Initialize and update submodule
      await exec("git submodule update --init --recursive", {
        cwd: wsPath,
        timeout: 60000,
      });

      logger.info("Task memory submodule created", {
        taskId,
        taskMemoryPath,
        agentId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to create task memory submodule", {
        taskId,
        taskMemoryPath,
        error: errorMessage,
      });

      throw new Error(`Failed to create submodule: ${errorMessage}`);
    }
  };
}
