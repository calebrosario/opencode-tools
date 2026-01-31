// Multi-Layer Persistence - Phase 2: MVP Core
// Week 9, Day 3: 4-Layer Persistence Architecture

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../util/logger';
import { stateValidator } from '../util/state-validator';

export interface TaskState {
  taskId: string;
  status: string;
  data: Record<string, any>;
  lastUpdated: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: Record<string, any>;
}

export interface AgentDecision {
  timestamp: string;
  agentId: string;
  decision: string;
  reasoning: string;
  metadata?: Record<string, any>;
}

export interface Checkpoint {
  id: string;
  taskId: string;
  timestamp: string;
  description: string;
  files: string[];
  manifest: Record<string, any>;
}

export interface LogOptions {
  limit?: number;
  offset?: number;
  level?: string;
  startDate?: string;
  endDate?: string;
}

export class MultiLayerPersistence {
  private static instance: MultiLayerPersistence;
  private basePath: string;

  private constructor() {
    this.basePath = join(process.cwd(), 'data', 'tasks');
  }

  public static getInstance(): MultiLayerPersistence {
    if (!MultiLayerPersistence.instance) {
      MultiLayerPersistence.instance = new MultiLayerPersistence();
    }
    return MultiLayerPersistence.instance;
  }

  // Layer 1: state.json - Current task state (fast access)

  public async saveState(taskId: string, state: TaskState): Promise<void> {
    const statePath = this.getTaskPath(taskId, 'state.json');
    const tempPath = statePath + '.tmp';

    try {
      // Add checksum
      const stateWithMeta = {
        ...state,
        checksum: stateValidator.generateChecksum(JSON.stringify(state)),
      };

      // Write to temp file first (atomic write)
      await fs.writeFile(tempPath, JSON.stringify(stateWithMeta, null, 2), 'utf-8');

      // Atomic rename
      await fs.rename(tempPath, statePath);

      logger.info('State saved', { taskId });
    } catch (error) {
      logger.error('Failed to save state', { taskId, error });
      throw error;
    }
  }

  public async loadState(taskId: string): Promise<TaskState | null> {
    const statePath = this.getTaskPath(taskId, 'state.json');

    try {
      const data = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(data) as TaskState;

      // Validate checksum
      const validation = stateValidator.validateSnapshot(data as any);
      if (!validation.isValid) {
        throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
      }

      return state;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to load state', { taskId, error });
      throw error;
    }
  }

  // Layer 2: JSONL logs - Audit trail (append-only)

  public async appendLog(taskId: string, entry: LogEntry): Promise<void> {
    const logsPath = this.getTaskPath(taskId, 'logs.jsonl');

    try {
      const logLine = JSON.stringify({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
      await fs.appendFile(logsPath, logLine + '\n', 'utf-8');
    } catch (error) {
      logger.error('Failed to append log', { taskId, error });
      throw error;
    }
  }

  public async batchAppendLogs(taskId: string, entries: LogEntry[]): Promise<void> {
    const logsPath = this.getTaskPath(taskId, 'logs.jsonl');

    try {
      const logLines = entries.map(entry => {
        return JSON.stringify({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
      }).join('\n');

      await fs.appendFile(logsPath, logLines + '\n', 'utf-8');

      logger.info('Batch logs appended', { taskId, count: entries.length });
    } catch (error) {
      logger.error('Failed to batch append logs', { taskId, count: entries.length, error });
      throw error;
    }
  }

  public async loadLogs(taskId: string, options: LogOptions = {}): Promise<LogEntry[]> {
    const logsPath = this.getTaskPath(taskId, 'logs.jsonl');

    try {
      const data = await fs.readFile(logsPath, 'utf-8');
      const lines = data.trim().split('\n').filter(line => line.length > 0);

      let entries: LogEntry[] = lines.map(line => JSON.parse(line));

      // Filter by level
      if (options.level) {
        entries = entries.filter(e => e.level === options.level);
      }

      // Filter by date range
      if (options.startDate) {
        entries = entries.filter(e => e.timestamp >= options.startDate!);
      }
      if (options.endDate) {
        entries = entries.filter(e => e.timestamp <= options.endDate!);
      }

      // Apply limit and offset
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;

      entries = entries.slice(start, end);

      return entries;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to load logs', { taskId, error });
      throw error;
    }
  }

  // Layer 3: decisions.md - Agent decisions (append-only, human-readable)

  public async appendDecision(taskId: string, decision: AgentDecision): Promise<void> {
    const decisionsPath = this.getTaskPath(taskId, 'decisions.md');

    try {
      const decisionEntry = this.formatDecision(decision);
      await fs.appendFile(decisionsPath, decisionEntry + '\n\n', 'utf-8');
    } catch (error) {
      logger.error('Failed to append decision', { taskId, error });
      throw error;
    }
  }

  public async loadDecisions(taskId: string): Promise<AgentDecision[]> {
    const decisionsPath = this.getTaskPath(taskId, 'decisions.md');

    try {
      const data = await fs.readFile(decisionsPath, 'utf-8');
      const entries = data.split('\n\n').filter(entry => entry.trim().length > 0);

      return entries.map(entry => this.parseDecision(entry));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to load decisions', { taskId, error });
      throw error;
    }
  }

  // Layer 4: checkpoints - Filesystem snapshots (rare reads)

  public async createCheckpoint(taskId: string, description: string = ''): Promise<string> {
    const checkpointsPath = this.getCheckpointsPath(taskId);

    try {
      // Ensure checkpoints directory exists
      await fs.mkdir(checkpointsPath, { recursive: true });

      // Generate checkpoint ID
      const checkpointId = `checkpoint_${Date.now()}`;
      const checkpointPath = join(checkpointsPath, checkpointId);

      // Create checkpoint directory
      await fs.mkdir(checkpointPath, { recursive: true });

      // Save state snapshot
      const state = await this.loadState(taskId);
      if (state) {
        await fs.writeFile(
          join(checkpointPath, 'state.json'),
          JSON.stringify(state, null, 2),
          'utf-8'
        );
      }

      // Save logs snapshot
      const logs = await this.loadLogs(taskId);
      if (logs.length > 0) {
        await fs.writeFile(
          join(checkpointPath, 'logs.jsonl'),
          logs.map(l => JSON.stringify(l)).join('\n'),
          'utf-8'
        );
      }

      // Create manifest
      const manifest = {
        id: checkpointId,
        taskId,
        timestamp: new Date().toISOString(),
        description: description || 'Checkpoint created at ' + new Date().toISOString(),
        files: ['state.json', 'logs.jsonl'],
      };

      await fs.writeFile(
        join(checkpointPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8'
      );

      logger.info('Checkpoint created', { taskId, checkpointId });

      return checkpointId;
    } catch (error) {
      logger.error('Failed to create checkpoint', { taskId, error });
      throw error;
    }
  }

  public async restoreCheckpoint(taskId: string, checkpointId: string): Promise<void> {
    const checkpointPath = join(this.getCheckpointsPath(taskId), checkpointId);

    try {
      // Verify checkpoint exists
      await fs.access(checkpointPath);

      // Restore state
      const statePath = join(checkpointPath, 'state.json');
      const stateData = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateData) as TaskState;

      await this.saveState(taskId, state);

      // Restore logs (optional - append to current logs)
      const logsPath = join(checkpointPath, 'logs.jsonl');
      try {
        const logsData = await fs.readFile(logsPath, 'utf-8');
        const logs = logsData.trim().split('\n').filter(line => line.length > 0);

        const logEntries: LogEntry[] = logs.map(line => JSON.parse(line));
        await this.batchAppendLogs(taskId, logEntries);
      } catch (logError) {
        // Logs might not exist in checkpoint, that's OK
        if ((logError as any).code !== 'ENOENT') {
          throw logError;
        }
      }

      logger.info('Checkpoint restored', { taskId, checkpointId });
    } catch (error) {
      logger.error('Failed to restore checkpoint', { taskId, checkpointId, error });
      throw error;
    }
  }

  public async listCheckpoints(taskId: string): Promise<Checkpoint[]> {
    const checkpointsPath = this.getCheckpointsPath(taskId);

    try {
      const dirs = await fs.readdir(checkpointsPath);
      const checkpoints: Checkpoint[] = [];

      for (const dir of dirs) {
        try {
          const manifestPath = join(checkpointsPath, dir, 'manifest.json');
          const manifestData = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestData);

          checkpoints.push({
            id: manifest.id,
            taskId: manifest.taskId,
            timestamp: manifest.timestamp,
            description: manifest.description,
            files: manifest.files,
            manifest,
          });
        } catch (error) {
          logger.warn('Failed to read checkpoint manifest', { taskId, checkpointId: dir });
        }
      }

      return checkpoints.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to list checkpoints', { taskId, error });
      throw error;
    }
  }

  // Cleanup - Remove all layers

  public async cleanup(taskId: string): Promise<void> {
    const taskPath = this.getTaskPath(taskId);

    try {
      await fs.rm(taskPath, { recursive: true, force: true });
      logger.info('Task cleaned up', { taskId });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error('Failed to cleanup task', { taskId, error });
        throw error;
      }
    }
  }

  // Helper Methods

  private getTaskPath(taskId: string, filename?: string): string {
    const taskDir = join(this.basePath, taskId);
    return filename ? join(taskDir, filename) : taskDir;
  }

  private getCheckpointsPath(taskId: string): string {
    return this.getTaskPath(taskId, 'checkpoints');
  }

  private formatDecision(decision: AgentDecision): string {
    const timestamp = decision.timestamp || new Date().toISOString();
    return `## ${timestamp}
**Agent**: ${decision.agentId}
**Decision**: ${decision.decision}

${decision.reasoning}

${decision.metadata ? `**Metadata**: \`${JSON.stringify(decision.metadata)}\`` : ''}`;
  }

  private parseDecision(text: string): AgentDecision {
    // Simple parsing - in production, use proper markdown parser
    const lines = text.split('\n');
    const agentMatch = lines.find(l => l.startsWith('**Agent**:'));
    const decisionMatch = lines.find(l => l.startsWith('**Decision**:'));

    return {
      timestamp: (lines[0] || '').replace('## ', '') || new Date().toISOString(),
      agentId: agentMatch?.split(':** ')[1] || '',
      decision: decisionMatch?.split(':** ')[1] || '',
      reasoning: lines.slice(4, lines.length - 2).join('\n'),
    };
  }
}

// Export singleton instance
export const multiLayerPersistence = MultiLayerPersistence.getInstance();
