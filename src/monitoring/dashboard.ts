/**
 * Monitoring Dashboard Data Provider
 *
 * Aggregates metrics, health checks, and performance data for display.
 * Provides formatted output for CLI and other consumers.
 *
 * @module monitoring/dashboard
 */

import { metrics } from "./metrics";
import { health, SystemHealth, HealthStatus } from "./health";
import { performance, PerformanceSnapshot } from "./performance";

export interface DashboardData {
  timestamp: string;
  overall: {
    status: HealthStatus;
    uptime: number;
    version: string;
  };
  metrics: {
    tasks: {
      created: number;
      completed: number;
      failed: number;
      cancelled: number;
      successRate: number;
    };
    operations: Array<{
      name: string;
      count: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
    }>;
  };
  health: SystemHealth;
  performance: {
    current: PerformanceSnapshot | null;
    averages: {
      cpu: number;
      memory: number;
      disk?: number;
    } | null;
    peaks: {
      cpu: number;
      memory: number;
      disk?: number;
    } | null;
  };
}

export interface FormattedDashboard {
  summary: string[];
  tasks: string[];
  operations: string[];
  health: string[];
  performance: string[];
  recommendations: string[];
}

/**
 * Dashboard data provider
 * Aggregates and formats monitoring data
 */
class DashboardProvider {
  private static instance: DashboardProvider;

  private constructor() {}

  public static getInstance(): DashboardProvider {
    if (!DashboardProvider.instance) {
      DashboardProvider.instance = new DashboardProvider();
    }
    return DashboardProvider.instance;
  }

  /**
   * Get comprehensive dashboard data
   */
  public async getDashboardData(): Promise<DashboardData> {
    const [healthData, performanceData] = await Promise.all([
      health.checkAll(),
      Promise.resolve({
        current: performance.getLatestSnapshot(),
        averages: performance.getAverages(),
        peaks: performance.getPeaks(),
      }),
    ]);

    const taskMetrics = this.getTaskMetrics();
    const operationMetrics = this.getOperationMetrics();

    return {
      timestamp: new Date().toISOString(),
      overall: {
        status: healthData.overall,
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || "0.0.0",
      },
      metrics: {
        tasks: taskMetrics,
        operations: operationMetrics,
      },
      health: healthData,
      performance: performanceData,
    };
  }

  /**
   * Get formatted dashboard for CLI display
   */
  public async getFormattedDashboard(): Promise<FormattedDashboard> {
    const data = await this.getDashboardData();
    return this.formatForDisplay(data);
  }

  /**
   * Get task metrics summary
   */
  private getTaskMetrics(): DashboardData["metrics"]["tasks"] {
    const counters = metrics.getCounters();

    const created =
      counters.find((c) => c.name === "tasks_created_total")?.value || 0;
    const completed =
      counters.find((c) => c.name === "tasks_completed_total")?.value || 0;
    const failed =
      counters.find((c) => c.name === "tasks_failed_total")?.value || 0;
    const cancelled =
      counters.find((c) => c.name === "tasks_cancelled_total")?.value || 0;

    const total = completed + failed + cancelled;
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      created,
      completed,
      failed,
      cancelled,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get operation timing metrics
   */
  private getOperationMetrics(): DashboardData["metrics"]["operations"] {
    const operations: DashboardData["metrics"]["operations"] = [];

    const timers = metrics.getTimers();
    const groupedByName = new Map<string, number[]>();

    for (const timer of timers) {
      const durations = groupedByName.get(timer.name) || [];
      durations.push(timer.durationMs);
      groupedByName.set(timer.name, durations);
    }

    for (const [name, durations] of groupedByName) {
      if (durations.length === 0) continue;

      const sum = durations.reduce((a, b) => a + b, 0);
      operations.push({
        name,
        count: durations.length,
        avgDuration: Math.round((sum / durations.length) * 100) / 100,
        minDuration: Math.round(Math.min(...durations) * 100) / 100,
        maxDuration: Math.round(Math.max(...durations) * 100) / 100,
      });
    }

    return operations.sort((a, b) => b.count - a.count);
  }

  /**
   * Format dashboard data for CLI display
   */
  private formatForDisplay(data: DashboardData): FormattedDashboard {
    const summary: string[] = [];
    const tasks: string[] = [];
    const operations: string[] = [];
    const health: string[] = [];
    const performance: string[] = [];
    const recommendations: string[] = [];

    // Summary section
    summary.push(`Status: ${this.formatStatus(data.overall.status)}`);
    summary.push(`Uptime: ${this.formatUptime(data.overall.uptime)}`);
    summary.push(`Version: ${data.overall.version}`);
    summary.push(`Last Updated: ${new Date(data.timestamp).toLocaleString()}`);

    // Tasks section
    tasks.push("Task Statistics:");
    tasks.push(`  Created:    ${data.metrics.tasks.created}`);
    tasks.push(`  Completed:  ${data.metrics.tasks.completed}`);
    tasks.push(`  Failed:     ${data.metrics.tasks.failed}`);
    tasks.push(`  Cancelled:  ${data.metrics.tasks.cancelled}`);
    tasks.push(`  Success Rate: ${data.metrics.tasks.successRate}%`);

    // Operations section
    if (data.metrics.operations.length > 0) {
      operations.push("Operation Performance:");
      operations.push(
        `  ${"Operation".padEnd(20)} ${"Count".padStart(8)} ${"Avg (ms)".padStart(10)} ${"Min (ms)".padStart(10)} ${"Max (ms)".padStart(10)}`,
      );
      operations.push(`  ${"-".repeat(60)}`);

      for (const op of data.metrics.operations.slice(0, 10)) {
        operations.push(
          `  ${op.name.padEnd(20)} ${op.count.toString().padStart(8)} ${op.avgDuration.toFixed(2).padStart(10)} ${op.minDuration.toFixed(2).padStart(10)} ${op.maxDuration.toFixed(2).padStart(10)}`,
        );
      }
    }

    // Health section
    health.push("Health Checks:");
    for (const check of data.health.checks) {
      const icon =
        check.status === "healthy"
          ? "[OK]"
          : check.status === "warning"
            ? "[WARN]"
            : "[FAIL]";
      health.push(
        `  ${icon} ${check.name.padEnd(15)} ${check.status.padEnd(10)} ${check.durationMs}ms`,
      );
      if (check.message && check.status !== "healthy") {
        health.push(`    ${check.message}`);
      }
    }

    // Performance section
    if (data.performance.current) {
      performance.push("Current Performance:");
      performance.push(
        `  CPU:    ${data.performance.current.cpu.usagePercent.toFixed(1)}%`,
      );
      performance.push(
        `  Memory: ${data.performance.current.memory.usagePercent.toFixed(1)}% (${this.formatBytes(data.performance.current.memory.usedBytes)})`,
      );
      if (data.performance.current.disk) {
        performance.push(
          `  Disk:   ${data.performance.current.disk.usagePercent.toFixed(1)}% (${this.formatBytes(data.performance.current.disk.usedBytes)})`,
        );
      }
    }

    if (data.performance.averages) {
      performance.push("");
      performance.push("Average Performance (24h):");
      performance.push(
        `  CPU:    ${data.performance.averages.cpu.toFixed(1)}%`,
      );
      performance.push(
        `  Memory: ${data.performance.averages.memory.toFixed(1)}%`,
      );
      if (data.performance.averages.disk) {
        performance.push(
          `  Disk:   ${data.performance.averages.disk.toFixed(1)}%`,
        );
      }
    }

    // Recommendations
    recommendations.push(...this.generateRecommendations(data));

    return {
      summary,
      tasks,
      operations,
      health,
      performance,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on dashboard data
   */
  private generateRecommendations(data: DashboardData): string[] {
    const recommendations: string[] = [];

    // Check failure rate
    const total =
      data.metrics.tasks.completed +
      data.metrics.tasks.failed +
      data.metrics.tasks.cancelled;
    if (total > 0) {
      const failureRate =
        ((data.metrics.tasks.failed + data.metrics.tasks.cancelled) / total) *
        100;
      if (failureRate > 20) {
        recommendations.push(
          `[WARN] High failure rate detected (${failureRate.toFixed(1)}%). Review error logs.`,
        );
      }
    }

    // Check health status
    const unhealthyChecks = data.health.checks.filter(
      (c) => c.status === "unhealthy",
    );
    if (unhealthyChecks.length > 0) {
      recommendations.push(
        `[FAIL] ${unhealthyChecks.length} health check(s) failing. Immediate attention required.`,
      );
    }

    const warningChecks = data.health.checks.filter(
      (c) => c.status === "warning",
    );
    if (warningChecks.length > 0) {
      recommendations.push(
        `[INFO] ${warningChecks.length} health check(s) showing warnings.`,
      );
    }

    // Check performance
    if (data.performance.current) {
      if (data.performance.current.cpu.usagePercent > 80) {
        recommendations.push(
          `[WARN] High CPU usage (${data.performance.current.cpu.usagePercent.toFixed(1)}%). Consider scaling.`,
        );
      }
      if (data.performance.current.memory.usagePercent > 85) {
        recommendations.push(
          `[WARN] High memory usage (${data.performance.current.memory.usagePercent.toFixed(1)}%). Monitor for leaks.`,
        );
      }
    }

    // Check operation performance
    for (const op of data.metrics.operations) {
      if (op.avgDuration > 1000) {
        recommendations.push(
          `[INFO] Slow operation detected: ${op.name} (avg: ${op.avgDuration.toFixed(0)}ms)`,
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("[OK] All systems operating normally.");
    }

    return recommendations;
  }

  /**
   * Format status with color indicators
   */
  private formatStatus(status: HealthStatus): string {
    const statusMap: Record<HealthStatus, string> = {
      healthy: "[OK] HEALTHY",
      warning: "[WARN] WARNING",
      unhealthy: "[FAIL] UNHEALTHY",
    };
    return statusMap[status] || status.toUpperCase();
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Export dashboard data as JSON
   */
  public async exportJSON(): Promise<string> {
    const data = await this.getDashboardData();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export dashboard data as CSV
   */
  public async exportCSV(): Promise<string> {
    const data = await this.getDashboardData();
    const lines: string[] = [];

    // Header
    lines.push("Metric,Value");

    // Tasks
    lines.push(`Tasks Created,${data.metrics.tasks.created}`);
    lines.push(`Tasks Completed,${data.metrics.tasks.completed}`);
    lines.push(`Tasks Failed,${data.metrics.tasks.failed}`);
    lines.push(`Tasks Cancelled,${data.metrics.tasks.cancelled}`);
    lines.push(`Success Rate,${data.metrics.tasks.successRate}%`);

    // Health
    for (const check of data.health.checks) {
      lines.push(`Health ${check.name},${check.status}`);
    }

    // Performance
    if (data.performance.current) {
      lines.push(`CPU Usage,${data.performance.current.cpu.usagePercent}%`);
      lines.push(
        `Memory Usage,${data.performance.current.memory.usagePercent}%`,
      );
    }

    return lines.join("\n");
  }
}

// Export singleton
export const dashboard = DashboardProvider.getInstance();

// Convenience functions
export const getDashboard = () => dashboard.getDashboardData();
export const getFormattedDashboard = () => dashboard.getFormattedDashboard();
export const exportDashboardJSON = () => dashboard.exportJSON();
export const exportDashboardCSV = () => dashboard.exportCSV();

export default dashboard;
