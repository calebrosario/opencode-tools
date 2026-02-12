import { logger } from "../util/logger";
import { promises as fs } from "fs";
import { join } from "path";

export type ConflictType =
  | "FILE_WRITE"
  | "RESOURCE_LOCK"
  | "DEPENDENCY"
  | "WORKSPACE_OVERLAP";
export type ResolutionStrategy =
  | "WAIT"
  | "MERGE"
  | "SKIP"
  | "ABORT"
  | "RETRY_LATER";

export interface Operation {
  agentId: string;
  taskId: string;
  type: string;
  target: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConflictInfo {
  conflictId: string;
  type: ConflictType;
  agents: string[];
  operation: Operation;
  conflictingOperation: Operation;
  detected: Date;
  resolution?: ResolutionStrategy;
}

export interface ResolutionResult {
  conflictId: string;
  strategy: ResolutionStrategy;
  success: boolean;
  resolvedAt: Date;
  details?: string;
}

export interface AgentResult {
  agentId: string;
  taskId: string;
  status: "success" | "partial" | "failed";
  outputs: Record<string, unknown>;
  filesModified: string[];
  errors: string[];
  completedAt: Date;
}

export interface MergedResult {
  taskId: string;
  mergedOutputs: Record<string, unknown>;
  allFilesModified: string[];
  successCount: number;
  failureCount: number;
  mergeConflicts: string[];
  mergedAt: Date;
}

export interface WorkspaceInfo {
  agentId: string;
  taskId: string;
  workspacePath: string;
  isolated: boolean;
  createdAt: Date;
  resources: string[];
}

export interface AgentStatus {
  agentId: string;
  taskId: string;
  workspace: string;
  active: boolean;
  operationsCount: number;
  conflictsCount: number;
  registeredAt: Date;
  lastActivity: Date;
}

interface RegisteredAgent {
  agentId: string;
  taskId: string;
  workspace: string;
  active: boolean;
  operationsCount: number;
  conflictsCount: number;
  registeredAt: Date;
  lastActivity: Date;
  resources: Set<string>;
  pendingOperations: Operation[];
}

export class ParallelCoordinator {
  private static instance: ParallelCoordinator;
  private agents: Map<string, RegisteredAgent> = new Map();
  private resourceLocks: Map<string, string> = new Map();
  private activeConflicts: Map<string, ConflictInfo> = new Map();
  private conflictHistory: ConflictInfo[] = [];
  private basePath: string;

  private constructor() {
    this.basePath = process.env.OPENCODE_WORKSPACE || "/tmp/opencode-worktrees";
  }

  public static getInstance(): ParallelCoordinator {
    if (!ParallelCoordinator.instance) {
      ParallelCoordinator.instance = new ParallelCoordinator();
    }
    return ParallelCoordinator.instance;
  }

  public async registerAgent(
    agentId: string,
    taskId: string,
    workspace: string,
  ): Promise<void> {
    const existingAgent = this.agents.get(agentId);
    if (existingAgent) {
      logger.warn("Agent already registered, updating", { agentId, taskId });
      existingAgent.workspace = workspace;
      existingAgent.lastActivity = new Date();
      return;
    }

    const agent: RegisteredAgent = {
      agentId,
      taskId,
      workspace,
      active: true,
      operationsCount: 0,
      conflictsCount: 0,
      registeredAt: new Date(),
      lastActivity: new Date(),
      resources: new Set(),
      pendingOperations: [],
    };

    this.agents.set(agentId, agent);

    await this.ensureWorkspaceIsolation(agentId);

    logger.info("Agent registered", { agentId, taskId, workspace });
  }

  public async detectConflict(
    agentId: string,
    operation: Operation,
  ): Promise<ConflictInfo | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn("Agent not registered", { agentId });
      return null;
    }

    for (const [otherId, otherAgent] of this.agents) {
      if (otherId === agentId) continue;
      if (otherAgent.taskId !== agent.taskId) continue;

      const conflict = this.checkOperationConflict(
        agentId,
        operation,
        otherId,
        otherAgent.pendingOperations,
      );

      if (conflict) {
        const conflictInfo: ConflictInfo = {
          conflictId: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: conflict.type,
          agents: [agentId, otherId],
          operation,
          conflictingOperation: conflict.conflictingOp,
          detected: new Date(),
        };

        this.activeConflicts.set(conflictInfo.conflictId, conflictInfo);
        agent.conflictsCount++;
        otherAgent.conflictsCount++;

        logger.warn("Conflict detected", {
          conflictId: conflictInfo.conflictId,
          type: conflictInfo.type,
          agents: conflictInfo.agents,
        });

        return conflictInfo;
      }
    }

    agent.pendingOperations.push(operation);
    agent.operationsCount++;
    agent.lastActivity = new Date();

    return null;
  }

  public async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy,
  ): Promise<ResolutionResult> {
    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      return {
        conflictId,
        strategy,
        success: false,
        resolvedAt: new Date(),
        details: "Conflict not found",
      };
    }

    let success = false;
    let details = "";

    switch (strategy) {
      case "WAIT":
        success = await this.resolveWithWait(conflict);
        details = "Waiting agents completed operation";
        break;

      case "MERGE":
        success = await this.resolveWithMerge(conflict);
        details = "Results merged successfully";
        break;

      case "SKIP":
        success = true;
        details = "Operation skipped";
        break;

      case "ABORT":
        success = await this.resolveWithAbort(conflict);
        details = "Conflicting operation aborted";
        break;

      case "RETRY_LATER":
        success = true;
        details = "Operation scheduled for retry";
        break;
    }

    conflict.resolution = strategy;
    this.conflictHistory.push(conflict);
    this.activeConflicts.delete(conflictId);

    logger.info("Conflict resolved", {
      conflictId,
      strategy,
      success,
    });

    return {
      conflictId,
      strategy,
      success,
      resolvedAt: new Date(),
      details,
    };
  }

  public async mergeResults(
    taskId: string,
    agentResults: AgentResult[],
  ): Promise<MergedResult> {
    const mergedOutputs: Record<string, unknown> = {};
    const allFilesModified: string[] = [];
    const mergeConflicts: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const result of agentResults) {
      if (result.status === "success") {
        successCount++;
      } else {
        failureCount++;
      }

      for (const [key, value] of Object.entries(result.outputs)) {
        if (mergedOutputs[key] !== undefined) {
          mergeConflicts.push(
            `Key conflict: ${key} from agent ${result.agentId}`,
          );
        } else {
          mergedOutputs[key] = value;
        }
      }

      for (const file of result.filesModified) {
        if (!allFilesModified.includes(file)) {
          allFilesModified.push(file);
        }
      }
    }

    const mergedResult: MergedResult = {
      taskId,
      mergedOutputs,
      allFilesModified,
      successCount,
      failureCount,
      mergeConflicts,
      mergedAt: new Date(),
    };

    logger.info("Results merged", {
      taskId,
      agentCount: agentResults.length,
      successCount,
      failureCount,
      conflictCount: mergeConflicts.length,
    });

    return mergedResult;
  }

  public async isolateWorkspace(agentId: string): Promise<WorkspaceInfo> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not registered: ${agentId}`);
    }

    const isolatedPath = join(this.basePath, agent.taskId, `agent_${agentId}`);
    await fs.mkdir(isolatedPath, { recursive: true });

    const workspaceInfo: WorkspaceInfo = {
      agentId,
      taskId: agent.taskId,
      workspacePath: isolatedPath,
      isolated: true,
      createdAt: new Date(),
      resources: Array.from(agent.resources),
    };

    logger.info("Workspace isolated", {
      agentId,
      taskId: agent.taskId,
      workspacePath: isolatedPath,
    });

    return workspaceInfo;
  }

  public async acquireResource(
    agentId: string,
    resource: string,
  ): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn("Agent not registered for resource acquisition", { agentId });
      return false;
    }

    const currentHolder = this.resourceLocks.get(resource);
    if (currentHolder && currentHolder !== agentId) {
      logger.debug("Resource already locked", {
        resource,
        holder: currentHolder,
        requester: agentId,
      });
      return false;
    }

    this.resourceLocks.set(resource, agentId);
    agent.resources.add(resource);
    agent.lastActivity = new Date();

    logger.debug("Resource acquired", { agentId, resource });
    return true;
  }

  public async releaseResource(
    agentId: string,
    resource: string,
  ): Promise<void> {
    const currentHolder = this.resourceLocks.get(resource);
    if (currentHolder === agentId) {
      this.resourceLocks.delete(resource);
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.resources.delete(resource);
      }
      logger.debug("Resource released", { agentId, resource });
    }
  }

  public async getAgentStatus(agentId: string): Promise<AgentStatus | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      agentId: agent.agentId,
      taskId: agent.taskId,
      workspace: agent.workspace,
      active: agent.active,
      operationsCount: agent.operationsCount,
      conflictsCount: agent.conflictsCount,
      registeredAt: agent.registeredAt,
      lastActivity: agent.lastActivity,
    };
  }

  public async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    for (const resource of agent.resources) {
      await this.releaseResource(agentId, resource);
    }

    agent.active = false;
    this.agents.delete(agentId);

    logger.info("Agent unregistered", { agentId });
  }

  public getActiveConflicts(): ConflictInfo[] {
    return Array.from(this.activeConflicts.values());
  }

  public getConflictHistory(limit: number = 100): ConflictInfo[] {
    return this.conflictHistory.slice(-limit);
  }

  private async ensureWorkspaceIsolation(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const isolationCheckPath = join(agent.workspace, ".isolation_marker");
    try {
      await fs.writeFile(
        isolationCheckPath,
        JSON.stringify({
          agentId,
          taskId: agent.taskId,
          isolatedAt: new Date().toISOString(),
        }),
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn("Failed to create isolation marker", {
        agentId,
        error: errorMessage,
      });
    }
  }

  private checkOperationConflict(
    agentId: string,
    operation: Operation,
    otherId: string,
    otherOperations: Operation[],
  ): { type: ConflictType; conflictingOp: Operation } | null {
    for (const otherOp of otherOperations) {
      if (operation.target === otherOp.target) {
        const type = this.determineConflictType(operation, otherOp);
        return { type, conflictingOp: otherOp };
      }
    }
    return null;
  }

  private determineConflictType(op1: Operation, op2: Operation): ConflictType {
    if (op1.target === op2.target) {
      if (op1.type.includes("WRITE") || op2.type.includes("WRITE")) {
        return "FILE_WRITE";
      }
    }

    if (
      op1.metadata?.dependency === op2.target ||
      op2.metadata?.dependency === op1.target
    ) {
      return "DEPENDENCY";
    }

    return "RESOURCE_LOCK";
  }

  private async resolveWithWait(conflict: ConflictInfo): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  }

  private async resolveWithMerge(conflict: ConflictInfo): Promise<boolean> {
    return (
      conflict.operation.type.includes("READ") ||
      conflict.conflictingOperation.type.includes("READ")
    );
  }

  private async resolveWithAbort(conflict: ConflictInfo): Promise<boolean> {
    const agentId = conflict.agents[1];
    if (!agentId) return false;

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.pendingOperations = agent.pendingOperations.filter(
        (op) => op !== conflict.conflictingOperation,
      );
    }
    return true;
  }
}

export const parallelCoordinator = ParallelCoordinator.getInstance();
