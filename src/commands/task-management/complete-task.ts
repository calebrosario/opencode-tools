// Complete Task Command - Phase 2: MVP Core
// Week 13, Task 13.5: Implement /complete-task Command

import { Command } from 'commander';
import { taskLifecycle } from '../../task/lifecycle';
import type { TaskResult } from '../../types/lifecycle';

/**
 * Mark a task as completed with result data
 */
export const completeTaskCommand = new Command('complete-task')
  .description('Mark a task as completed')
  .argument('<taskId>', 'Task ID')
  .option('-r, --result <JSON>', 'Task result as JSON')
  .option('-m, --message <string>', 'Completion message')
  .action(async (taskId: string, options: {
    result?: string;
    message?: string;
  }) => {
    try {
      const result: TaskResult = {
        success: true,
        data: options.result 
          ? JSON.parse(options.result)
          : options.message
          ? { message: options.message }
          : undefined,
      };

      const task = await taskLifecycle.completeTask(taskId, result);
      
      console.log('✅ Task completed successfully');
      console.log(`   Task ID: ${task.id}`);
      console.log(`   Task Name: ${task.name}`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Completed At: ${new Date().toISOString()}`);
      
      if (options.message) {
        console.log(`   Message: ${options.message}`);
      }
    } catch (error: any) {
      console.error('❌ Failed to complete task:', error.message);
      process.exit(1);
    }
  });
