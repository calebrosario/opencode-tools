// CLI Entry Point - Phase 2: MVP Core
// Week 13: User Commands - Main CLI

import { Command } from 'commander';
import packageJson from '../../package.json';
import {
  createTaskCommand,
  resumeTaskCommand,
  listTasksCommand,
  detachCommand,
  completeTaskCommand,
  cleanupTaskCommand,
  checkpointCommand,
  restoreCheckpointCommand,
  taskHistoryCommand,
  taskExecutionsCommand,
  taskDecisionsCommand,
  findTaskCommand,
  taskStatsCommand,
} from './index';

// Main CLI program
const program = new Command();
program
  .name('opencode-tools')
  .description('OpenCode Tools - Task Management with Docker Sandboxes')
  .version(packageJson.version || '0.1.0');

// Add task management commands
program.addCommand(createTaskCommand);
program.addCommand(resumeTaskCommand);
program.addCommand(listTasksCommand);
program.addCommand(detachCommand);
program.addCommand(completeTaskCommand);
program.addCommand(cleanupTaskCommand);

// Add checkpoint commands
program.addCommand(checkpointCommand);
program.addCommand(restoreCheckpointCommand);

// Add memory commands
program.addCommand(taskHistoryCommand);
program.addCommand(taskExecutionsCommand);
program.addCommand(taskDecisionsCommand);
program.addCommand(findTaskCommand);
program.addCommand(taskStatsCommand);

// Parse CLI arguments
program.parse(process.argv);

export { program };
