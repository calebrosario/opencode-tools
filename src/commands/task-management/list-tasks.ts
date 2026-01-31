// List Tasks Command - Phase 2: MVP Core
// Week 13, Task 13.3: Implement /list-tasks Command

import { Command } from 'commander';
import { taskRegistry } from '../../task-registry/registry';
import type { TaskStatus } from '../../types';

/**
 * Display tasks with optional filtering and pagination
 */
export const listTasksCommand = new Command('list-tasks')
  .description('List all tasks')
  .option('-s, --status <status>', 'Filter by status (pending, running, completed, failed)')
  .option('-o, --owner <string>', 'Filter by owner')
  .option('-l, --limit <number>', 'Limit results', '100')
  .option('--offset <number>', 'Offset for pagination', '0')
  .option('-v, --verbose', 'Show detailed information', false)
  .action(async (options: {
    status?: string;
    owner?: string;
    limit?: number;
    offset?: number;
    verbose?: boolean;
  }) => {
    try {
      const tasks = await taskRegistry.list({
        status: options.status as TaskStatus,
        owner: options.owner,
        limit: options.limit ? Number(options.limit) : undefined,
        offset: options.offset ? Number(options.offset) : undefined,
      });

      displayTasks(tasks, options.verbose ?? false);
    } catch (error: any) {
      console.error('❌ Failed to list tasks:', error.message);
      process.exit(1);
    }
  });

function displayTasks(tasks: any[], verbose: boolean): void {
  if (tasks.length === 0) {
    console.log('No tasks found');
    return;
  }

  console.log(`\nFound ${tasks.length} task(s):\n`);

  tasks.forEach((task, index) => {
    const prefix = `${index + 1}.`;
    console.log(`${prefix} ${task.name} (${task.id})`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Owner: ${task.owner || 'N/A'}`);
    console.log(`   Created: ${new Date(task.createdAt as string | Date).toISOString()}`);
    console.log(`   Updated: ${new Date(task.updatedAt as string | Date).toISOString()}`);
    
    if (verbose) {
      if (task.description) {
        console.log(`   Description: ${task.description}`);
      }
      if (Object.keys(task.metadata || {}).length > 0) {
        console.log(`   Metadata: ${JSON.stringify(task.metadata)}`);
      }
    }
    console.log('');
  });
}
