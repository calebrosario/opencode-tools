// Git Operations Helper - Phase 2: Edge Cases
// Week 15, Day 1-2: Git Branch Naming Conflicts

import { exec } from "child_process";
import { logger } from "./logger";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Git Operations Helper - Provides atomic Git operations with conflict handling
 */

export interface BranchResult {
  success: boolean;
  branchName?: string;
  attempts: number;
  error?: string;
  note?: string;
}

export interface GitLock {
  acquired: boolean;
  lockFile: string;
}

/**
 * Get workspace path for a task
 * Assumes standard opencode worktree structure
 */
export function getWorkspacePath(taskId: string): string {
  // In a real implementation, this would query TaskRegistry or use config
  // For now, use a standard path pattern
  const basePath = process.env.OPENCODE_WORKSPACE || "/tmp/opencode-worktrees";
  return `${basePath}/${taskId}`;
}

/**
 * Generate unique branch name with timestamp + random suffix
 */
export function generateUniqueBranchName(
  baseName: string,
  attempt: number = 0,
): string {
  if (attempt === 0) {
    return baseName;
  }

  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const suffix = `${timestamp}-${random}`;

  return `${baseName}-${suffix}`;
}

/**
 * Check if branch exists locally
 */
export async function branchExists(
  workspacePath: string,
  branchName: string,
): Promise<boolean> {
  try {
    await exec("git rev-parse --verify " + branchName, {
      cwd: workspacePath,
      timeout: 5000,
    });
    return true;
  } catch (error: any) {
    if (error.message?.includes("unknown name") || error.code === 128) {
      return false;
    }
    throw error;
  }
}

/**
 * Acquire file lock for atomic Git operations
 */
export async function acquireLock(
  lockFile: string,
  timeout: number = 30000,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const fd = await fs.open(lockFile, "wx");
      await fd.close();
      return;
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      // Lock exists, wait and retry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Failed to acquire lock after ${timeout}ms: ${lockFile}`);
}

/**
 * Release file lock
 */
export async function releaseLock(lockFile: string): Promise<void> {
  try {
    await fs.unlink(lockFile);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      logger.error("Failed to release lock", {
        lockFile,
        error: error.message,
      });
    }
  }
}

/**
 * Create task branch with conflict handling and retry logic
 *
 * @param taskId - Task ID
 * @param workspacePath - Git workspace path
 * @returns Branch result
 */
export async function createTaskBranch(
  taskId: string,
  workspacePath?: string,
): Promise<BranchResult> {
  const baseName = `task/${taskId}`;
  const maxAttempts = 10;
  let attempts = 0;

  // Use provided workspace or derive from taskId
  const wsPath = workspacePath || getWorkspacePath(taskId);

  // Lock file path for atomic operations
  const lockFile = `${wsPath}/.git/branch-creation.lock`;

  try {
    // Ensure workspace directory exists
    await fs.mkdir(wsPath, { recursive: true });

    // Initialize git repo if needed
    try {
      await exec("git init", { cwd: wsPath });
    } catch (error: any) {
      if (!error.message?.includes("reinitialized")) {
        logger.warn("Git init failed", { error: error.message });
      }
    }

    // Acquire lock for atomic branch creation
    await acquireLock(lockFile);

    try {
      while (attempts < maxAttempts) {
        attempts++;

        // Generate branch name (with unique suffix if retrying)
        const branchName = generateUniqueBranchName(baseName, attempts - 1);

        // Check if branch exists
        const exists = await branchExists(wsPath, branchName);

        if (!exists) {
          // Branch doesn't exist, create it
          try {
            await exec(`git checkout -b ${branchName}`, {
              cwd: wsPath,
              timeout: 10000,
            });

            logger.info("Task branch created", {
              taskId,
              branchName,
              attempts,
            });

            return {
              success: true,
              branchName,
              attempts,
            };
          } catch (error: any) {
            logger.error("Failed to create branch", {
              taskId,
              branchName,
              error: error.message,
            });
            throw error;
          }
        } else {
          // Branch exists, will retry with unique suffix
          logger.debug("Branch already exists", {
            taskId,
            branchName,
            attempts,
          });
        }
      }

      // Max attempts reached
      throw new Error(
        `Failed to create unique branch after ${maxAttempts} attempts. Base: ${baseName}`,
      );
    } finally {
      // Release lock
      await releaseLock(lockFile);
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Failed to create task branch", {
      taskId,
      baseName,
      error: errorMessage,
    });

    return {
      success: false,
      attempts,
      error: errorMessage,
    };
  }
}

/**
 * Submodule conflict result
 */
export interface SubmoduleResult {
  success: boolean;
  status?: "clean" | "dirty" | "diverged";
  resolution?: "merge" | "rebase" | "skip" | "none";
  error?: string;
}

/**
 * Get submodule status (clean, dirty, or diverged)
 *
 * @param workspacePath - Git workspace path
 * @param submodulePath - Submodule path relative to workspace
 * @returns Submodule status
 */
export async function getSubmoduleStatus(
  workspacePath: string,
  submodulePath: string,
): Promise<"clean" | "dirty" | "diverged" | "error"> {
  try {
    const submoduleDir = path.join(workspacePath, submodulePath);

    // Check if submodule directory exists
    try {
      await fs.access(submoduleDir);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return "error";
      }
      throw error;
    }

    // Run git submodule status
    const { stdout, stderr } = await execAsync(
      `git submodule status ${submodulePath}`,
      { cwd: workspacePath, timeout: 5000 } as any,
    );

    if (stderr) {
      logger.error("Git submodule status error", { stderr });
      return "error";
    }

    // Parse status output
    const status = stdout.toString().trim();

    if (status === "" || status.includes("not initialized")) {
      return "clean";
    }

    if (
      status.includes("+") &&
      (status.includes("M") || status.includes("D"))
    ) {
      return "dirty";
    }

    if (
      status.includes("<") &&
      (status.includes(">") || status.includes("<"))
    ) {
      return "diverged";
    }

    return "clean";
  } catch (error: any) {
    logger.error("Failed to get submodule status", {
      workspacePath,
      submodulePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return "error";
  }
}

/**
 * Resolve submodule conflict with selected strategy
 *
 * @param workspacePath - Git workspace path
 * @param submodulePath - Submodule path
 * @param resolution - Resolution strategy (merge, rebase, skip)
 * @returns Submodule result
 */
export async function resolveSubmoduleConflict(
  workspacePath: string,
  submodulePath: string,
  resolution: "merge" | "rebase" | "skip",
): Promise<SubmoduleResult> {
  try {
    logger.info("Resolving submodule conflict", {
      submodulePath,
      resolution,
    });

    switch (resolution) {
      case "merge":
        await exec(`git submodule update --merge ${submodulePath}`, {
          cwd: workspacePath,
          timeout: 10000,
        });
        break;

      case "rebase":
        await exec(`git submodule update --rebase ${submodulePath}`, {
          cwd: workspacePath,
          timeout: 10000,
        });
        break;

      case "skip":
        logger.info("Skipping submodule update", { submodulePath });
        break;
    }

    logger.info("Submodule conflict resolved", {
      submodulePath,
      resolution,
    });

    return {
      success: true,
      status: "clean",
      resolution,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Failed to resolve submodule conflict", {
      workspacePath,
      submodulePath,
      resolution,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if submodule has conflicts
 */
export async function hasSubmoduleConflicts(
  workspacePath: string,
  submodulePath: string,
): Promise<boolean> {
  try {
    const status = await getSubmoduleStatus(workspacePath, submodulePath);
    return status === "dirty" || status === "diverged";
  } catch (error: any) {
    logger.error("Failed to check submodule conflicts", {
      workspacePath,
      submodulePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Initialize submodule if not initialized
 */
export async function initSubmodule(
  workspacePath: string,
  submodulePath: string,
): Promise<boolean> {
  try {
    await exec(`git submodule update --init ${submodulePath}`, {
      cwd: workspacePath,
      timeout: 30000,
    });
    return true;
  } catch (error: any) {
    logger.error("Failed to initialize submodule", {
      workspacePath,
      submodulePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
