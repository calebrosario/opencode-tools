/**
 * State Persistence Prototype
 *
 * Multi-layer persistence architecture for Docker task management
 *
 * Layers (4 total):
 * Layer 1: state.json - Current task state (in-memory, fast access)
 * Layer 2: JSONL logs - Immutable audit trail (append-only)
 * Layer 3: decisions.md - Agent decisions (versioned, human-readable)
 * Layer 4: checkpoints - Filesystem snapshots (full/incremental)
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export enum TaskStatus {
  CREATED = 'created',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABORTED = 'aborted',
}

export enum Layer {
  STATE_JSON = 'state.json',
  JSONL_LOGS = 'jsonl_logs',
  DECISIONS_MD = 'decisions.md',
  CHECKPOINTS = 'checkpoints',
}

export interface TaskState {
  taskId: string;
  status: TaskStatus;
  metadata: Record<string, unknown>;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
  parentTaskId?: string;
  subtasks: string[];
  checkpointId?: string;
}

export interface JsonlEntry {
  taskId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  operation: string;
  version: number;
  data: Record<string, unknown>;
}

export interface Decision {
  taskId: string;
  version: number;
  timestamp: Date;
  decision: string;
  reasoning: string;
  alternatives: string[];
  outcome: string;
}

export interface Checkpoint {
  checkpointId: string;
  taskId: string;
  version: number;
  timestamp: Date;
  type: 'full' | 'incremental';
  files: string[];
  sizeBytes: number;
  compressed: boolean;
}

export interface PersistenceMetrics {
  layer1Size: number; // state.json size in bytes
  layer2Entries: number; // JSONL log entries
  layer2Size: number; // JSONL total size in bytes
  layer3Entries: number; // decisions.md entries
  layer4Checkpoints: number; // number of checkpoints
  layer4Size: number; // total checkpoint size in bytes
  totalSize: number; // total persistence size in bytes
}

// ============================================================================
// STATE PERSISTENCE ENGINE
// ============================================================================

export class StatePersistenceEngine {
  private taskBasePath: string;
  
  constructor(taskBasePath: string) {
    this.taskBasePath = taskBasePath;
  }

  /**
   * Create new task
   */
  async createTask(taskId: string, initialMetadata: Record<string, unknown> = {}): Promise<TaskState> {
    const now = new Date();
    const state: TaskState = {
      taskId,
      status: TaskStatus.CREATED,
      metadata: initialMetadata,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
      subtasks: [],
    };

    // Layer 1: Write state.json
    await this.writeStateJson(taskId, state);

    // Layer 2: Append creation log
    await this.appendJsonl(taskId, {
      taskId,
      timestamp: now,
      level: 'info',
      operation: 'create_task',
      version: state.currentVersion,
      data: state,
    });

    return state;
  }

  /**
   * Update task state
   */
  async updateTask(
    taskId: string,
    updates: Partial<Pick<TaskState, 'taskId' | 'createdAt'>>,
    incrementVersion: boolean = true
  ): Promise<TaskState> {
    // Layer 1: Read current state
    const currentState = await this.readStateJson(taskId);
    
    if (!currentState) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Create new version
    const newVersion = incrementVersion ? currentState.currentVersion + 1 : currentState.currentVersion;
    
    const updatedState: TaskState = {
      ...currentState,
      ...updates,
      currentVersion: newVersion,
      updatedAt: new Date(),
    };

    // Layer 1: Write updated state.json
    await this.writeStateJson(taskId, updatedState);

    // Layer 2: Append update log
    await this.appendJsonl(taskId, {
      taskId,
      timestamp: new Date(),
      level: 'info',
      operation: 'update_task',
      version: newVersion,
      data: updates,
    });

    return updatedState;
  }

  /**
   * Record agent decision
   */
  async recordDecision(
    taskId: string,
    decision: string,
    reasoning: string,
    alternatives: string[] = [],
    outcome: string = 'pending'
  ): Promise<Decision> {
    // Layer 1: Get current state
    const currentState = await this.readStateJson(taskId);
    
    if (!currentState) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const decisionRecord: Decision = {
      taskId,
      version: currentState.currentVersion,
      timestamp: new Date(),
      decision,
      reasoning,
      alternatives,
      outcome,
    };

    // Layer 3: Append to decisions.md
    await this.appendDecisionMd(taskId, decisionRecord);

    return decisionRecord;
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(
    taskId: string,
    type: 'full' | 'incremental' = 'full',
    files: string[] = []
  ): Promise<Checkpoint> {
    // Layer 1: Get current state
    const currentState = await this.readStateJson(taskId);
    
    if (!currentState) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const checkpointId = `${currentState.currentVersion}_${Date.now()}`;
    const timestamp = new Date();
    
    // Layer 4: Calculate checkpoint size (simplified)
    const sizeBytes = files.reduce((total, file) => total + file.length, 0);

    const checkpoint: Checkpoint = {
      checkpointId,
      taskId,
      version: currentState.currentVersion,
      timestamp,
      type,
      files,
      sizeBytes,
      compressed: false,
    };

    // Layer 4: Write checkpoint manifest
    await this.writeCheckpointManifest(taskId, checkpoint);

    // Layer 2: Log checkpoint creation
    await this.appendJsonl(taskId, {
      taskId,
      timestamp,
      level: 'info',
      operation: 'create_checkpoint',
      version: currentState.currentVersion,
      data: { checkpointId, type, files },
    });

    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(taskId: string, checkpointId: string): Promise<TaskState> {
    // Layer 4: Read checkpoint manifest
    const checkpoint = await this.readCheckpointManifest(taskId, checkpointId);
    
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Layer 1: Restore state (simplified - normally would restore files)
    const restoredState: TaskState = {
      taskId,
      status: TaskStatus.RUNNING,
      metadata: {},
      currentVersion: checkpoint.version + 1,
      createdAt: checkpoint.timestamp,
      updatedAt: new Date(),
      checkpointId,
    };

    await this.writeStateJson(taskId, restoredState);

    // Layer 2: Log checkpoint restore
    await this.appendJsonl(taskId, {
      taskId,
      timestamp: new Date(),
      level: 'info',
      operation: 'restore_checkpoint',
      version: restoredState.currentVersion,
      data: { checkpointId },
    });

    return restoredState;
  }

  /**
   * Detect state corruption
   */
  async detectCorruption(taskId: string): Promise<{ corrupted: boolean; details?: string }> {
    try {
      // Layer 1: Validate state.json schema
      const state = await this.readStateJson(taskId);
      
      if (!state) {
        return { corrupted: true, details: 'State file not found' };
      }

      // Validate required fields
      const requiredFields = ['taskId', 'status', 'currentVersion', 'createdAt', 'updatedAt'];
      for (const field of requiredFields) {
        if (!(field in state)) {
          return { corrupted: true, details: `Missing field: ${field}` };
        }
      }

      // Validate enum values
      if (!Object.values(TaskStatus).includes(state.status)) {
        return { corrupted: true, details: `Invalid status: ${state.status}` };
      }

      // Validate timestamps
      if (state.updatedAt < state.createdAt) {
        return { corrupted: true, details: 'Updated before created' };
      }

      // Layer 2: Validate JSONL integrity
      const jsonlPath = this.getTaskPath(taskId, Layer.JSONL_LOGS);
      const jsonlContent = await fs.readFile(jsonlPath, 'utf-8');
      const jsonlLines = jsonlContent.split('\n').filter((line) => line.trim());
      
      for (const line of jsonlLines) {
        try {
          JSON.parse(line);
        } catch {
          return { corrupted: true, details: 'Invalid JSON in JSONL log' };
        }
      }

      // Layer 3: Validate decisions.md
      const decisionsPath = this.getTaskPath(taskId, Layer.DECISIONS_MD);
      const decisionsContent = await fs.readFile(decisionsPath, 'utf-8');
      
      if (!decisionsContent.includes('# Task Decisions')) {
        return { corrupted: true, details: 'Decisions.md header missing' };
      }

      return { corrupted: false };
    } catch (error) {
      return { corrupted: true, details: (error as Error).message };
    }
  }

  /**
   * Recover from JSONL logs
   */
  async recoverFromJsonl(taskId: string, targetVersion?: number): Promise<TaskState | null> {
    // Layer 2: Read JSONL logs
    const jsonlPath = this.getTaskPath(taskId, Layer.JSONL_LOGS);
    const jsonlContent = await fs.readFile(jsonlPath, 'utf-8');
    const jsonlLines = jsonlContent.split('\n').filter((line) => line.trim());

    if (jsonlLines.length === 0) {
      return null;
    }

    // Find target version or last version
    const targetLineIndex = targetVersion 
      ? jsonlLines.length - 1  // Last line
      : Math.min(targetVersion - 1, jsonlLines.length - 1);

    const line = jsonlLines[targetLineIndex];
    const entry: JsonlEntry = JSON.parse(line);

    // Recover from JSONL entry
    if (entry.data && typeof entry.data === 'object') {
      return entry.data as TaskState;
    }

    return null;
  }

  /**
   * Get persistence metrics
   */
  async getMetrics(taskId: string): Promise<PersistenceMetrics> {
    const layer1Path = this.getTaskPath(taskId, Layer.STATE_JSON);
    const layer2Path = this.getTaskPath(taskId, Layer.JSONL_LOGS);
    const layer3Path = this.getTaskPath(taskId, Layer.DECISIONS_MD);
    const layer4Path = this.getTaskPath(taskId, Layer.CHECKPOINTS);

    const [layer1Size, layer2Size, layer3Size, layer4Size] = await Promise.all([
      fs.stat(layer1Path).then((stat) => stat.size).catch(() => 0),
      fs.stat(layer2Path).then((stat) => stat.size).catch(() => 0),
      fs.stat(layer3Path).then((stat) => stat.size).catch(() => 0),
      fs.stat(layer4Path).then((stat) => stat.size).catch(() => 0),
    ]);

    const layer2Content = await fs.readFile(layer2Path, 'utf-8');
    const layer2Entries = layer2Content.split('\n').filter((line) => line.trim()).length;

    const layer3Content = await fs.readFile(layer3Path, 'utf-8');
    const layer3Entries = (layer3Content.match(/^- /g) || []).length;

    const layer4Content = await fs.readFile(layer4Path, 'utf-8');
    const layer4Checkpoints = (layer4Content.match(/checkpointId:/g) || []).length;

    return {
      layer1Size,
      layer2Entries,
      layer2Size,
      layer3Entries,
      layer4Checkpoints,
      layer4Size,
      totalSize: layer1Size + layer2Size + layer3Size + layer4Size,
    };
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getTaskPath(taskId: string, layer: Layer): string {
    const taskPath = join(this.taskBasePath, taskId);
    switch (layer) {
      case Layer.STATE_JSON:
        return join(taskPath, 'state.json');
      case Layer.JSONL_LOGS:
        return join(taskPath, 'task_memory.jsonl');
      case Layer.DECISIONS_MD:
        return join(taskPath, 'decisions.md');
      case Layer.CHECKPOINTS:
        return join(taskPath, 'checkpoints.json');
      default:
        throw new Error(`Unknown layer: ${layer}`);
    }
  }

  private async readStateJson(taskId: string): Promise<TaskState | null> {
    try {
      const path = this.getTaskPath(taskId, Layer.STATE_JSON);
      const content = await fs.readFile(path, 'utf-8');
      return JSON.parse(content) as TaskState;
    } catch {
      return null;
    }
  }

  private async writeStateJson(taskId: string, state: TaskState): Promise<void> {
    const path = this.getTaskPath(taskId, Layer.STATE_JSON);
    const dir = join(this.taskBasePath, taskId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path, JSON.stringify(state, null, 2), 'utf-8');
  }

  private async appendJsonl(taskId: string, entry: JsonlEntry): Promise<void> {
    const path = this.getTaskPath(taskId, Layer.JSONL_LOGS);
    const dir = join(this.taskBasePath, taskId);
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(path, line, 'utf-8');
  }

  private async appendDecisionMd(taskId: string, decision: Decision): Promise<void> {
    const path = this.getTaskPath(taskId, Layer.DECISIONS_MD);
    const dir = join(this.taskBasePath, taskId);
    await fs.mkdir(dir, { recursive: true });
    
    const content = `## Decision v${decision.version}: ${decision.timestamp.toISOString()}
${decision.decision}

### Reasoning
${decision.reasoning}

${decision.alternatives.length > 0 ? '### Alternatives\n' + decision.alternatives.map((alt, i) => `${i + 1}. ${alt}`).join('\n') : ''}

### Outcome
${decision.outcome}

---
`;
    await fs.appendFile(path, content, 'utf-8');
  }

  private async writeCheckpointManifest(taskId: string, checkpoint: Checkpoint): Promise<void> {
    const path = this.getTaskPath(taskId, Layer.CHECKPOINTS);
    const dir = join(this.taskBasePath, taskId);
    await fs.mkdir(dir, { recursive: true });
    
    const content = `checkpointId: ${checkpoint.checkpointId}
taskId: ${checkpoint.taskId}
version: ${checkpoint.version}
timestamp: ${checkpoint.timestamp.toISOString()}
type: ${checkpoint.type}
files: ${checkpoint.files.join(',')}
sizeBytes: ${checkpoint.sizeBytes}
compressed: ${checkpoint.compressed}

`;
    await fs.appendFile(path, content + '\n', 'utf-8');
  }

  private async readCheckpointManifest(taskId: string, checkpointId: string): Promise<Checkpoint | null> {
    try {
      const path = this.getTaskPath(taskId, Layer.CHECKPOINTS);
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].startsWith(`checkpointId: ${checkpointId}`)) {
          const checkpointData: Partial<Checkpoint> = {};
          for (let j = i; j < i + 8; j++) {
            const [key, value] = lines[j].split(':').map((s) => s.trim());
            checkpointData[key as keyof Checkpoint] = value as any;
          }
          return checkpointData as Checkpoint;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================
