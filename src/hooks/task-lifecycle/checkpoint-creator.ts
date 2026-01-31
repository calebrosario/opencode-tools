// Checkpoint Creator Hook - Phase 2: MVP Core
// Week 12, Task 12.2: Checkpoint Creation Hook

import { multiLayerPersistence } from '../../persistence/multi-layer';
import { logger } from '../../util/logger';
import { BeforeTaskCompleteHook } from '../task-lifecycle';
import type { TaskResult } from '../../types/lifecycle';

/**
 * Create a checkpoint before task completion
 *
 * This hook automatically creates a checkpoint containing:
 * - Current task state (state.json)
 * - All JSONL logs (logs.jsonl)
 * - Checkpoint manifest with metadata
 *
 * Checkpoints are saved to: data/tasks/{taskId}/checkpoints/{checkpointId}/
 */
export function createCheckpointBeforeCompleteHook(): BeforeTaskCompleteHook {
  return async (taskId: string, result: TaskResult) => {
    try {
      const description = `Checkpoint before completion: ${result.success ? 'success' : 'failed'}`;

      const checkpointId = await multiLayerPersistence.createCheckpoint(
        taskId,
        description
      );

      logger.info('Checkpoint created before task completion', {
        taskId,
        checkpointId,
        success: result.success,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create checkpoint before task completion', {
        taskId,
        error: errorMessage,
      });

      // Re-throw to ensure task lifecycle is aware of the failure
      throw error;
    }
  };
}
