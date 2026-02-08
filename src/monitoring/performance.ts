/**
 * Performance Tracking Module
 *
 * Tracks system performance metrics: CPU, memory, and disk usage.
 * Provides real-time and historical performance data.
 *
 * @module monitoring/performance
 */

import { logger } from "../util/logger";
import { metrics } from "./metrics";
import { EventEmitter } from "events";

export interface PerformanceSnapshot {
  timestamp: string;
  cpu: {
    usagePercent: number;
    userTime: number;
    systemTime: number;
  };
  memory: {
    usedBytes: number;
    totalBytes: number;
    freeBytes: number;
    usagePercent: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  disk?: {
    usedBytes: number;
    totalBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
}

export interface PerformanceConfig {
  enabled: boolean;
  intervalMs: number;
  maxSnapshots: number;
  thresholds: {
    cpuWarning: number;
    cpuCritical: number;
    memoryWarning: number;
    memoryCritical: number;
    diskWarning: number;
    diskCritical: number;
  };
}

/**
 * Performance tracker for system resources
 */
class PerformanceTracker extends EventEmitter {
  private static instance: PerformanceTracker;
  private config: PerformanceConfig;
  private snapshots: PerformanceSnapshot[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;

  private constructor() {
    super();
    this.config = {
      enabled: true,
      intervalMs: 60000, // 1 minute
      maxSnapshots: 1440, // 24 hours at 1-minute intervals
      thresholds: {
        cpuWarning: 70,
        cpuCritical: 90,
        memoryWarning: 80,
        memoryCritical: 95,
        diskWarning: 85,
        diskCritical: 95,
      },
    };
  }

  public static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  /**
   * Configure performance tracking
   */
  public configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("Performance tracking configured", { config: this.config });

    // Restart if already running
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  /**
   * Start performance tracking
   */
  public start(): void {
    if (!this.config.enabled) {
      logger.info("Performance tracking disabled");
      return;
    }

    if (this.intervalId) {
      logger.warn("Performance tracking already running");
      return;
    }

    // Take initial snapshot
    this.takeSnapshot();

    // Start interval
    this.intervalId = setInterval(() => {
      this.takeSnapshot();
    }, this.config.intervalMs);

    logger.info(
      `Performance tracking started (interval: ${this.config.intervalMs}ms)`,
    );
  }

  /**
   * Stop performance tracking
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Performance tracking stopped");
    }
  }

  public clearHistory(): void {
    this.snapshots = [];
    logger.info("Performance history cleared");
  }

  public getHistory(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Take a performance snapshot
   */
  public takeSnapshot(): PerformanceSnapshot {
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date().toISOString(),
      cpu: this.getCpuUsage(),
      memory: this.getMemoryUsage(),
      disk: this.getDiskUsage(),
    };

    // Add to history
    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    // Update metrics
    this.updateMetrics(snapshot);

    // Check thresholds
    this.checkThresholds(snapshot);

    // Emit event
    this.emit("snapshot", snapshot);

    return snapshot;
  }

  /**
   * Get current CPU usage
   */
  private getCpuUsage(): PerformanceSnapshot["cpu"] {
    const currentUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = currentUsage;

    // Calculate percentage (approximate)
    const totalTime = (currentUsage.user + currentUsage.system) / 1000; // Convert to ms
    const elapsedTime = this.config.intervalMs;
    const usagePercent = Math.min((totalTime / elapsedTime) * 100, 100);

    return {
      usagePercent: Math.round(usagePercent * 100) / 100,
      userTime: currentUsage.user,
      systemTime: currentUsage.system,
    };
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): PerformanceSnapshot["memory"] {
    const used = process.memoryUsage();
    const total = used.heapTotal;
    const free = total - used.heapUsed;

    return {
      usedBytes: used.heapUsed,
      totalBytes: total,
      freeBytes: free,
      usagePercent: Math.round((used.heapUsed / total) * 100 * 100) / 100,
      heapUsed: used.heapUsed,
      heapTotal: used.heapTotal,
      external: used.external,
    };
  }

  /**
   * Get current disk usage
   */
  private getDiskUsage(): PerformanceSnapshot["disk"] | undefined {
    try {
      const fs = require("fs");
      const stats = fs.statfsSync("/");

      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      const used = total - free;

      return {
        usedBytes: used,
        totalBytes: total,
        freeBytes: free,
        usagePercent: Math.round((used / total) * 100 * 100) / 100,
      };
    } catch (error) {
      logger.warn("Failed to get disk usage", { error });
      return undefined;
    }
  }

  /**
   * Update metrics from snapshot
   */
  private updateMetrics(snapshot: PerformanceSnapshot): void {
    metrics.setGauge("cpu_usage_percent", snapshot.cpu.usagePercent);
    metrics.setGauge("memory_usage_bytes", snapshot.memory.usedBytes);
    metrics.setGauge("memory_usage_percent", snapshot.memory.usagePercent);

    if (snapshot.disk) {
      metrics.setGauge("disk_usage_bytes", snapshot.disk.usedBytes);
      metrics.setGauge("disk_usage_percent", snapshot.disk.usagePercent);
    }
  }

  /**
   * Check thresholds and emit warnings
   */
  private checkThresholds(snapshot: PerformanceSnapshot): void {
    // CPU threshold
    if (snapshot.cpu.usagePercent >= this.config.thresholds.cpuCritical) {
      this.emit("threshold-exceeded", {
        metric: "cpu",
        severity: "critical",
        value: snapshot.cpu.usagePercent,
        threshold: this.config.thresholds.cpuCritical,
      });
    } else if (snapshot.cpu.usagePercent >= this.config.thresholds.cpuWarning) {
      this.emit("threshold-exceeded", {
        metric: "cpu",
        severity: "warning",
        value: snapshot.cpu.usagePercent,
        threshold: this.config.thresholds.cpuWarning,
      });
    }

    // Memory threshold
    if (snapshot.memory.usagePercent >= this.config.thresholds.memoryCritical) {
      this.emit("threshold-exceeded", {
        metric: "memory",
        severity: "critical",
        value: snapshot.memory.usagePercent,
        threshold: this.config.thresholds.memoryCritical,
      });
    } else if (
      snapshot.memory.usagePercent >= this.config.thresholds.memoryWarning
    ) {
      this.emit("threshold-exceeded", {
        metric: "memory",
        severity: "warning",
        value: snapshot.memory.usagePercent,
        threshold: this.config.thresholds.memoryWarning,
      });
    }

    // Disk threshold
    if (snapshot.disk) {
      if (snapshot.disk.usagePercent >= this.config.thresholds.diskCritical) {
        this.emit("threshold-exceeded", {
          metric: "disk",
          severity: "critical",
          value: snapshot.disk.usagePercent,
          threshold: this.config.thresholds.diskCritical,
        });
      } else if (
        snapshot.disk.usagePercent >= this.config.thresholds.diskWarning
      ) {
        this.emit("threshold-exceeded", {
          metric: "disk",
          severity: "warning",
          value: snapshot.disk.usagePercent,
          threshold: this.config.thresholds.diskWarning,
        });
      }
    }
  }

  /**
   * Get all snapshots
   */
  public getSnapshots(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get latest snapshot
   */
  public getLatestSnapshot(): PerformanceSnapshot | null {
    if (this.snapshots.length === 0) {
      return null;
    }
    const lastIndex = this.snapshots.length - 1;
    const snapshot = this.snapshots[lastIndex];
    return snapshot ?? null;
  }

  /**
   * Get snapshots within time range
   */
  public getSnapshotsInRange(
    startTime: Date,
    endTime: Date,
  ): PerformanceSnapshot[] {
    return this.snapshots.filter((s) => {
      const ts = new Date(s.timestamp);
      return ts >= startTime && ts <= endTime;
    });
  }

  /**
   * Calculate average values over all snapshots
   */
  public getAverages(): {
    cpu: number;
    memory: number;
    disk?: number;
  } | null {
    if (this.snapshots.length === 0) return null;

    const avgCpu =
      this.snapshots.reduce((sum, s) => sum + s.cpu.usagePercent, 0) /
      this.snapshots.length;
    const avgMemory =
      this.snapshots.reduce((sum, s) => sum + s.memory.usagePercent, 0) /
      this.snapshots.length;

    const diskSnapshots = this.snapshots.filter((s) => s.disk);
    const avgDisk =
      diskSnapshots.length > 0
        ? diskSnapshots.reduce(
            (sum, s) => sum + (s.disk?.usagePercent || 0),
            0,
          ) / diskSnapshots.length
        : undefined;

    return {
      cpu: Math.round(avgCpu * 100) / 100,
      memory: Math.round(avgMemory * 100) / 100,
      disk: avgDisk !== undefined ? Math.round(avgDisk * 100) / 100 : undefined,
    };
  }

  /**
   * Get peak values
   */
  public getPeaks(): {
    cpu: number;
    memory: number;
    disk?: number;
  } | null {
    if (this.snapshots.length === 0) return null;

    return {
      cpu: Math.max(...this.snapshots.map((s) => s.cpu.usagePercent)),
      memory: Math.max(...this.snapshots.map((s) => s.memory.usagePercent)),
      disk: this.snapshots.some((s) => s.disk)
        ? Math.max(
            ...this.snapshots
              .filter((s) => s.disk)
              .map((s) => s.disk?.usagePercent || 0),
          )
        : undefined,
    };
  }

  /**
   * Export performance data
   */
  public export(): {
    snapshots: PerformanceSnapshot[];
    averages: { cpu: number; memory: number; disk?: number } | null;
    peaks: { cpu: number; memory: number; disk?: number } | null;
    config: PerformanceConfig;
  } {
    return {
      snapshots: this.getSnapshots(),
      averages: this.getAverages(),
      peaks: this.getPeaks(),
      config: this.config,
    };
  }
}

// Export singleton
export const performance = PerformanceTracker.getInstance();

// Convenience functions
export const startTracking = () => performance.start();
export const stopTracking = () => performance.stop();
export const clearHistory = () => performance.clearHistory();
export const takeSnapshot = () => performance.takeSnapshot();
export const getSnapshots = () => performance.getSnapshots();
export const getLatestSnapshot = () => performance.getLatestSnapshot();
export const getAverages = () => performance.getAverages();
export const getPeaks = () => performance.getPeaks();

export default performance;
