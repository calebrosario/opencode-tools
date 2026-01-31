// Checkpoint Command - Phase2: MVP Core
// Week 13, Task 13.7: Implement /checkpoint Command

import { Command } from 'commander';
import { multiLayerPersistence } from '../../persistence/multi-layer';
import { taskRegistry } from '../../task-registry/registry';

/**
 * Create a checkpoint for a task
 */
export const checkpointCommand = new Command('checkpoint')
  .description('Create a checkpoint for a task')
  .argument('<taskId>', 'Task ID')
  .option('-d, --description <string>', 'Checkpoint description')
  .action(async (taskId: string, options: { description?: string }) => {
    try {
      // Validate task exists
      const task = await taskRegistry.getById(taskId);
      if (!task) {
        console.error('❌ Task not found');
        process.exit(1);
      }

      const description = options.description || `Checkpoint created at ${new Date().toISOString()}`;
      const checkpointId = await multiLayerPersistence.createCheckpoint(taskId, description);

      console.log('✅ Checkpoint created successfully');
      console.log(`   Task ID: ${taskId}`);
      console.log(`   Task Name: ${task.name}`);
      console.log(`   Checkpoint ID: ${checkpointId}`);
      console.log(`   Description: ${description}`);
    } catch (error: any) {
      console.error('❌ Failed to create checkpoint:', error.message);
      process.exit(1);
    }
  });
