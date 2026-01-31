// Task History Command - Phase2: MVP Core
// Week 13, Task 13.9: Implement /task-history Command

import { Command } from 'commander';
import { multiLayerPersistence } from '../../persistence/multi-layer';
import { taskRegistry } from '../../task-registry/registry';

/**
 * Display task execution history from JSONL logs
 */
export const taskHistoryCommand = new Command('task-history')
  .description('Show task execution history')
  .argument('<taskId>', 'Task ID')
  .option('-l, --level <string>', 'Filter by log level (error, warn, info, debug)')
  .option('--limit <number>', 'Limit number of entries', '50')
  .option('--start <date>', 'Start date filter (ISO 8601)')
  .option('--end <date>', 'End date filter (ISO 8601)')
  .action(async (taskId: string, options: {
    level?: string;
    limit?: number;
    start?: string;
    end?: string;
  }) => {
    try {
      // Validate task exists
      const task = await taskRegistry.getById(taskId);
      if (!task) {
        console.error('❌ Task not found');
        process.exit(1);
      }

      const logs = await multiLayerPersistence.loadLogs(taskId, {
        level: options.level,
        limit: options.limit ? Number(options.limit) : 50,
        startDate: options.start ? options.start : undefined,
        endDate: options.end ? options.end : undefined,
      });

      displayLogs(logs, taskId);
    } catch (error: any) {
      console.error('❌ Failed to load task history:', error.message);
      process.exit(1);
    }
  });

function displayLogs(logs: any[], taskId: string): void {
  if (logs.length === 0) {
    console.log(`\nNo logs found for task ${taskId}`);
    return;
  }

  console.log(`\nTask History for ${taskId} (${logs.length} entries):\n`);

  logs.forEach((log: any, index: number) => {
    const timestamp = new Date(log.timestamp as string | Date).toISOString();
    const level = log.level?.toUpperCase?.().padEnd(5) || 'INFO'.padEnd(5);
    const prefix = `${index + 1}. [${level}] ${timestamp}`;
    
    console.log(prefix);
    console.log(`   ${log.message}`);
    
    if (Object.keys(log.context || {}).length > 0) {
      console.log(`   Context: ${JSON.stringify(log.context)}`);
    }
    console.log('');
  });
}
