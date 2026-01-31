// Find Task Command - Phase2: MVP Core
// Week 13, Task 13.12: Implement /find-task Command

import { Command } from 'commander';
import { taskRegistry } from '../../task-registry/registry';

/**
 * Search tasks by name or metadata with filters
 */
export const findTaskCommand = new Command('find-task')
  .description('Find tasks by name or metadata')
  .argument('<query>', 'Search query')
  .option('-s, --status <status>', 'Filter by status (pending, running, completed, failed)')
  .option('-o, --owner <string>', 'Filter by owner')
  .option('-m, --metadata <JSON>', 'Filter by metadata (JSON)')
  .action(async (query: string, options: {
    status?: string;
    owner?: string;
    metadata?: string;
  }) => {
    try {
      const allTasks = await taskRegistry.list();
      
      const matches = allTasks.filter(task => {
        const nameMatch = task.name.toLowerCase().includes(query.toLowerCase());
        const metaMatch = task.metadata 
          ? JSON.stringify(task.metadata).toLowerCase().includes(query.toLowerCase())
          : false;
        
        let statusMatch = true;
        if (options.status && task.status !== options.status) {
          statusMatch = false;
        }
        
        let ownerMatch = true;
        if (options.owner && task.owner !== options.owner) {
          ownerMatch = false;
        }
        
        let exactMetaMatch = true;
        if (options.metadata) {
          try {
            const meta = JSON.parse(options.metadata);
            const taskMeta = task.metadata || {};
            exactMetaMatch = Object.keys(meta).every(key => 
              taskMeta[key] === meta[key]
            );
          } catch (e) {
            console.error('❌ Invalid metadata JSON:', options.metadata);
            process.exit(1);
          }
        }
        
        return (nameMatch || metaMatch) && statusMatch && ownerMatch && exactMetaMatch;
      });

      displaySearchResults(matches, query, options);
    } catch (error: any) {
      console.error('❌ Failed to find tasks:', error.message);
      process.exit(1);
    }
  });

function displaySearchResults(matches: any[], query: string, options: any): void {
  if (matches.length === 0) {
    console.log(`\nNo tasks found matching "${query}"`);
    
    if (options.status) {
      console.log(`   Filtered by status: ${options.status}`);
    }
    if (options.owner) {
      console.log(`   Filtered by owner: ${options.owner}`);
    }
    if (options.metadata) {
      console.log(`   Filtered by metadata: ${options.metadata}`);
    }
    return;
  }

  console.log(`\nFound ${matches.length} task(s) matching "${query}":\n`);

  matches.forEach((task, index) => {
    console.log(`${index + 1}. ${task.name} (${task.id})`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Owner: ${task.owner}`);
    console.log(`   Created: ${task.createdAt.toISOString()}`);
    
    if (task.description) {
      console.log(`   Description: ${task.description}`);
    }
    
    if (Object.keys(task.metadata || {}).length > 0) {
      console.log(`   Metadata: ${JSON.stringify(task.metadata)}`);
    }
    console.log('');
  });
}
