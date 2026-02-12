import { logger } from "../util/logger";
import { multiLayerPersistence } from "./multi-layer";
import { checkpointOptimizer } from "./checkpoint-optimizer";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskContext {
  operationCount: number;
  filesChanged: number;
  dependencies: number;
  duration: number;
  previousFailures: number;
  complexity?: number;
}

export interface ScheduleResult {
  taskId: string;
  riskLevel: RiskLevel;
  intervalMinutes: number;
  nextCheckpoint: Date;
  active: boolean;
}

export interface MonitoringState {
  taskId: string;
  startTime: Date;
  riskLevel: RiskLevel;
  intervalMs: number;
  lastCheckpoint: Date | null;
  checkpointCount: number;
  timer: NodeJS.Timeout | null;
}

export interface CheckpointEvent {
  taskId: string;
  timestamp: Date;
  riskLevel: RiskLevel;
  reason: "scheduled" | "forced" | "risk_change" | "completion";
  checkpointId: string;
}

const RISK_INTERVALS: Record<RiskLevel, number> = {
  LOW: 30,
  MEDIUM: 15,
  HIGH: 5,
  CRITICAL: 1,
};

const RISK_THRESHOLDS = {
  operationCount: { medium: 10, high: 50, critical: 100 },
  filesChanged: { medium: 20, high: 100, critical: 500 },
  duration: { medium: 600000, high: 1800000, critical: 3600000 },
  previousFailures: { medium: 1, high: 3, critical: 5 },
};

export class CheckpointScheduler {
  private static instance: CheckpointScheduler;
  private monitoringTasks: Map<string, MonitoringState> = new Map();
  private checkpointHistory: CheckpointEvent[] = [];

  private constructor() {}

  public static getInstance(): CheckpointScheduler {
    if (!CheckpointScheduler.instance) {
      CheckpointScheduler.instance = new CheckpointScheduler();
    }
    return CheckpointScheduler.instance;
  }

  public assessRisk(taskId: string, context: RiskContext): RiskLevel {
    let score = 0;

    const { operationCount, filesChanged, duration, previousFailures } =
      context;

    if (operationCount >= RISK_THRESHOLDS.operationCount.critical) score += 4;
    else if (operationCount >= RISK_THRESHOLDS.operationCount.high) score += 3;
    else if (operationCount >= RISK_THRESHOLDS.operationCount.medium)
      score += 2;

    if (filesChanged >= RISK_THRESHOLDS.filesChanged.critical) score += 4;
    else if (filesChanged >= RISK_THRESHOLDS.filesChanged.high) score += 3;
    else if (filesChanged >= RISK_THRESHOLDS.filesChanged.medium) score += 2;

    if (duration >= RISK_THRESHOLDS.duration.critical) score += 4;
    else if (duration >= RISK_THRESHOLDS.duration.high) score += 3;
    else if (duration >= RISK_THRESHOLDS.duration.medium) score += 2;

    if (previousFailures >= RISK_THRESHOLDS.previousFailures.critical)
      score += 4;
    else if (previousFailures >= RISK_THRESHOLDS.previousFailures.high)
      score += 3;
    else if (previousFailures >= RISK_THRESHOLDS.previousFailures.medium)
      score += 2;

    if (context.complexity && context.complexity > 0.7) score += 2;

    if (score >= 12) return "CRITICAL";
    if (score >= 8) return "HIGH";
    if (score >= 4) return "MEDIUM";
    return "LOW";
  }

  public getRecommendedInterval(riskLevel: RiskLevel): number {
    return RISK_INTERVALS[riskLevel];
  }

  public async scheduleCheckpoint(
    taskId: string,
    riskLevel: RiskLevel,
  ): Promise<ScheduleResult> {
    const intervalMinutes = this.getRecommendedInterval(riskLevel);
    const nextCheckpoint = new Date(Date.now() + intervalMinutes * 60 * 1000);

    const existing = this.monitoringTasks.get(taskId);
    if (existing && existing.timer) {
      clearInterval(existing.timer);
    }

    const state: MonitoringState = {
      taskId,
      startTime: existing?.startTime || new Date(),
      riskLevel,
      intervalMs: intervalMinutes * 60 * 1000,
      lastCheckpoint: existing?.lastCheckpoint || null,
      checkpointCount: existing?.checkpointCount || 0,
      timer: null,
    };

    state.timer = setInterval(async () => {
      await this.createScheduledCheckpoint(taskId);
    }, state.intervalMs);

    this.monitoringTasks.set(taskId, state);

    logger.info("Checkpoint scheduled", {
      taskId,
      riskLevel,
      intervalMinutes,
      nextCheckpoint,
    });

    return {
      taskId,
      riskLevel,
      intervalMinutes,
      nextCheckpoint,
      active: true,
    };
  }

  public async startMonitoring(taskId: string): Promise<ScheduleResult> {
    const initialContext: RiskContext = {
      operationCount: 0,
      filesChanged: 0,
      dependencies: 0,
      duration: 0,
      previousFailures: 0,
    };

    const riskLevel = this.assessRisk(taskId, initialContext);
    return this.scheduleCheckpoint(taskId, riskLevel);
  }

  public stopMonitoring(taskId: string): void {
    const state = this.monitoringTasks.get(taskId);
    if (state?.timer) {
      clearInterval(state.timer);
    }
    this.monitoringTasks.delete(taskId);

    logger.info("Monitoring stopped", { taskId });
  }

  public async forceCheckpoint(
    taskId: string,
    reason: string,
  ): Promise<string> {
    const state = this.monitoringTasks.get(taskId);

    try {
      const checkpointId = await multiLayerPersistence.createCheckpoint(
        taskId,
        `Forced checkpoint: ${reason}`,
      );

      await checkpointOptimizer.compressCheckpoint(taskId, checkpointId);

      if (state) {
        state.lastCheckpoint = new Date();
        state.checkpointCount++;
      }

      const event: CheckpointEvent = {
        taskId,
        timestamp: new Date(),
        riskLevel: state?.riskLevel || "LOW",
        reason: "forced",
        checkpointId,
      };
      this.checkpointHistory.push(event);

      logger.info("Forced checkpoint created", {
        taskId,
        checkpointId,
        reason,
      });

      return checkpointId;
    } catch (error: any) {
      logger.error("Failed to create forced checkpoint", {
        taskId,
        reason,
        error: error.message,
      });
      throw error;
    }
  }

  public updateRiskLevel(taskId: string, newContext: RiskContext): void {
    const newRiskLevel = this.assessRisk(taskId, newContext);
    const state = this.monitoringTasks.get(taskId);

    if (!state) return;

    if (state.riskLevel !== newRiskLevel) {
      logger.info("Risk level changed", {
        taskId,
        oldLevel: state.riskLevel,
        newLevel: newRiskLevel,
      });

      this.scheduleCheckpoint(taskId, newRiskLevel);
    }
  }

  public getMonitoringStatus(taskId: string): MonitoringState | null {
    const state = this.monitoringTasks.get(taskId);
    if (!state) return null;

    return {
      ...state,
      timer: null,
    };
  }

  public getAllMonitoredTasks(): string[] {
    return Array.from(this.monitoringTasks.keys());
  }

  public getCheckpointHistory(
    taskId?: string,
    limit: number = 100,
  ): CheckpointEvent[] {
    let history = this.checkpointHistory;
    if (taskId) {
      history = history.filter((e) => e.taskId === taskId);
    }
    return history.slice(-limit);
  }

  public stopAllMonitoring(): void {
    for (const [taskId, state] of this.monitoringTasks) {
      if (state.timer) {
        clearInterval(state.timer);
      }
    }
    this.monitoringTasks.clear();

    logger.info("All monitoring stopped");
  }

  private async createScheduledCheckpoint(taskId: string): Promise<void> {
    const state = this.monitoringTasks.get(taskId);
    if (!state) return;

    try {
      const checkpointId = await multiLayerPersistence.createCheckpoint(
        taskId,
        `Scheduled checkpoint at ${new Date().toISOString()}`,
      );

      await checkpointOptimizer.compressCheckpoint(taskId, checkpointId);
      await checkpointOptimizer.enforceStorageLimit();

      state.lastCheckpoint = new Date();
      state.checkpointCount++;

      const event: CheckpointEvent = {
        taskId,
        timestamp: new Date(),
        riskLevel: state.riskLevel,
        reason: "scheduled",
        checkpointId,
      };
      this.checkpointHistory.push(event);

      logger.info("Scheduled checkpoint created", {
        taskId,
        checkpointId,
        checkpointCount: state.checkpointCount,
      });
    } catch (error: any) {
      logger.error("Failed to create scheduled checkpoint", {
        taskId,
        error: error.message,
      });
    }
  }
}

export const checkpointScheduler = CheckpointScheduler.getInstance();
