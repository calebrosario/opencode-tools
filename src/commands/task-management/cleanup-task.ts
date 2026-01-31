// Cleanup Task Command - Phase 2: MVP Core
// Week 13, Task 13.6: Implement /cleanup-task Command

import { Command } from 'commander';
import { taskLifecycle } from '../../task/lifecycle';
import { taskRegistry } from '../../task-registry/registry';
import { logger } from '../../util/logger';

/**
 * Cleanup a task and all its resources
 */
export const cleanupTaskCommand = new Command('cleanup-task')
  .description('Cleanup a task and all its resources')
  .argument('<taskId>', 'Task ID')
  .option('--force', 'Force cleanup without confirmation', false)
  .action(async (taskId: string, options: { force?: boolean }) => {
    try {
      const task = await taskRegistry.getById(taskId);
      if (!task) {
        console.error('❌ Task not found');
        process.exit(1);
      }

      if (!options.force) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(`Are you sure you want to cleanup task ${taskId} (${task.name})? [y/N] `, resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y') {
          console.log('Cleanup cancelled');
          process.exit(0);
        }
      }

      logger.info('Cleaning up task', { taskId, name: task.name });

      // Delete task (cleanup persistence, stop container if running)
      await taskLifecycle.deleteTask(taskId);

      console.log('✅ Task cleaned up successfully');
      console.log(`   Task ID: ${taskId}`);
      console.log(`   Task Name: ${task.name}`);
      console.log(`   All resources have been removed`);
    } catch (error: any) {
      console.error('❌ Failed to cleanup task:', error.message);
      process.exit(1);
    }
  });
