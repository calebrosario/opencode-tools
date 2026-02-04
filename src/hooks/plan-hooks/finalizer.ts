import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from '../../util/logger';
import { AfterTaskCompleteHook } from '../task-lifecycle';
import type { TaskResult } from '../../types/lifecycle';

/**
 * Finalize Plan.md on task completion
 *
 * This hook:
 * 1. Ensures plan directory exists
 * 2. Reads existing Plan.md
 * 3. Adds finalization notes
 * 4. Saves updated Plan.md
 */
export function createPlanFinalizerHook(): AfterTaskCompleteHook {
  return async (taskId: string, result: TaskResult) => {
    try {
      const planPath = join(process.cwd(), 'data', 'tasks', taskId, 'Plan.md');
      
      // Ensure plan directory exists
      const planDir = join(process.cwd(), 'data', 'tasks', taskId);
      await fs.mkdir(planDir, { recursive: true });
      
      // Read existing plan or create default if missing
      let existingPlan: string;
      try {
        existingPlan = await fs.readFile(planPath, 'utf-8');
      } catch (readError) {
        // File doesn't exist yet, create default structure
        existingPlan = "# Plan: New Task\n**Task ID**: " + taskId + "\n**Status**: pending\n\n## Task Description\n\n## Metadata\n\n\`\`json\n{}\`\`\n## Implementation Notes\n\n*Plan created at task start*\n\n---\n*Last Updated: " + new Date().toISOString() + "*\n";
      }
      
      // Append finalization notes
      const finalizedPlan = appendFinalizationNotes(existingPlan, result);
      
      // Save updated plan
      await fs.writeFile(planPath, finalizedPlan, 'utf-8');
      
      logger.info('Plan finalized', { taskId, result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to finalize plan', {
        taskId,
        error: errorMessage,
      });
      
      throw new Error("Failed to finalize Plan.md: " + errorMessage);
    }
  };
  }

function appendExecutionNotes(planContent: string, result: TaskResult): string {
  const timestamp = new Date().toISOString();
  const statusEmoji = result.success ? '✅' : '❌';
  
  const executionNotes = `
## Execution Summary

**Status**: ${statusEmoji} ${result.success ? 'Success' : 'Failed'}
**Completed At**: ${timestamp}

${result.data ? `**Result Data**:
\`\`\`json
${JSON.stringify(result.data, null, 2)}
\`\`\`\`
` : ''}

${result.error ? `**Error**: ${result.error}
` : ''}

---

`;

  return planContent + executionNotes;
}

function appendFinalizationNotes(planContent: string, result: TaskResult): string {
  const timestamp = new Date().toISOString();
  const statusEmoji = result.success ? '✅' : '❌';
  
  const finalizationNotes = `
## Finalization Summary

**Status**: ${statusEmoji} ${result.success ? 'Success' : 'Failed'}
**Completed At**: ${timestamp}

${result.data ? `**Final Result**:
\`\`\`json
${JSON.stringify(result.data, null, 2)}
\`\`\`\`
` : ''}

${result.error ? `**Error**: ${result.error}
` : ''}

---

`;

  return planContent + finalizationNotes;
}
