// Restore Checkpoint Command - Phase2: MVP Core
// Week 13, Task 13.8: Implement /restore-checkpoint Command

import { Command } from 'commander';
import { multiLayerPersistence } from '../../persistence/multi-layer';
import { taskRegistry } from '../../task-registry/registry';

/**
 * Restore a task from a checkpoint
 */
export const restoreCheckpointCommand = new Command('restore-checkpoint')
  .description('Restore a task from a checkpoint')
  .argument('<taskId>', 'Task ID')
  .option('-c, --checkpoint <string>', 'Checkpoint ID to restore')
  .option('-l, --list', 'List available checkpoints', false)
  .action(async (taskId: string, options: {
    checkpoint?: string;
    list?: boolean;
  }) => {
    try {
      if (options.list) {
        const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
        
        console.log(`\nAvailable checkpoints for task ${taskId}:\n`);
        if (checkpoints.length === 0) {
          console.log('  No checkpoints found');
        } else {
          checkpoints.forEach((cp, index) => {
            console.log(`  ${index + 1}. ${cp.id}`);
            console.log(`     Description: ${cp.description}`);
            console.log(`     Created: ${cp.timestamp}`);
            console.log('');
          });
        }
        return;
      }

      if (!options.checkpoint) {
        console.error('❌ Checkpoint ID required (or use --list)');
        process.exit(1);
      }

      // Validate task exists
      const task = await taskRegistry.getById(taskId);
      if (!task) {
        console.error('❌ Task not found');
        process.exit(1);
      }

      // Restore checkpoint
      await multiLayerPersistence.restoreCheckpoint(taskId, options.checkpoint);
      
      // Set task to pending state
      await taskRegistry.update(taskId, { status: 'pending' });
      
      console.log('✅ Checkpoint restored successfully');
      console.log(`   Task ID: ${taskId}`);
      console.log(`   Task Name: ${task.name}`);
      console.log(`   Checkpoint ID: ${options.checkpoint}`);
      console.log(`   Task Status: pending`);
      console.log(`   Task is ready to be resumed`);
    } catch (error: any) {
      console.error('❌ Failed to restore checkpoint:', error.message);
      process.exit(1);
    }
  });
