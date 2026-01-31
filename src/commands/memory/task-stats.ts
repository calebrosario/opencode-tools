// Task Stats Command - Phase2: MVP Core
// Week 13, Task 13.13: Implement /task-stats Command

import { Command } from 'commander';
import { taskRegistry } from '../../task-registry/registry';

/**
 * Display task statistics and distributions
 */
export const taskStatsCommand = new Command('task-stats')
  .description('Show task statistics')
  .action(async () => {
    try {
      const allTasks = await taskRegistry.list();
      
      if (allTasks.length === 0) {
        console.log('\nNo tasks found in the system.');
        return;
      }
      
      // Count by status
      const statusCounts = allTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Count by owner
      const ownerCounts = allTasks.reduce((acc, task) => {
        const owner = task.owner || 'none';
        acc[owner] = (acc[owner] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      displayStatistics(allTasks, statusCounts, ownerCounts);
    } catch (error: any) {
      console.error('❌ Failed to get task stats:', error.message);
      process.exit(1);
    }
  });

function displayStatistics(tasks: any[], statusCounts: Record<string, number>, ownerCounts: Record<string, number>): void {
  console.log(`\nTask Statistics\n`);
  console.log('═'.repeat(40));
  
  // Total tasks
  console.log(`\nTotal Tasks: ${tasks.length}`);
  
  // Status distribution
  console.log(`\nStatus Distribution:\n`);
  const statusLabels: Record<string, string> = {
    pending: '⏳ Pending',
    running: '🔄 Running',
    completed: '✅ Completed',
    failed: '❌ Failed',
  };
  
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    const label = statusLabels[status] || status;
    const percentage = ((count / tasks.length) * 100).toFixed(1);
    console.log(`   ${label}: ${count} (${percentage}%)`);
  });
  
  // Owner distribution
  console.log(`\nOwner Distribution:\n`);
  const sortedOwners = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1]);
  sortedOwners.forEach(([owner, count]) => {
    const percentage = ((count / tasks.length) * 100).toFixed(1);
    console.log(`   ${owner}: ${count} (${percentage}%)`);
  });
  
  // Recent tasks
  console.log(`\nMost Recent Tasks (5):\n`);
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  
  recentTasks.forEach((task, index) => {
    const statusEmoji = task.status === 'completed' ? '✅' : 
                        task.status === 'running' ? '🔄' :
                        task.status === 'failed' ? '❌' : '⏳';
    
    console.log(`${index + 1}. ${statusEmoji} ${task.name} (${task.id})`);
    console.log(`      ${task.createdAt.toISOString()}`);
  });
  
  console.log('\n' + '═'.repeat(40) + '\n');
}
