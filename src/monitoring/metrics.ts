/**
 * Metrics Collection Service
 *
 * Provides counters, timers, and gauges for monitoring system performance
 * and operation statistics. Designed for minimal overhead (< 1ms per operation).
 *
 * @module monitoring/metrics
 */

import { logger } from "../util/logger";

export interface MetricLabels {
  [key: string]: string;
}

export interface CounterMetric {
  name: string;
  help: string;
  value: number;
  labels: MetricLabels;
}

export interface TimerMetric {
  id: string;
  name: string;
  help: string;
  durationMs: number;
  labels: MetricLabels;
  startTime: number;
}

export interface GaugeMetric {
  name: string;
  help: string;
  value: number;
  labels: MetricLabels;
}

/**
 * Metrics collection singleton
 * Thread-safe, minimal overhead design
 */
class MetricsCollector {
  private static instance: MetricsCollector;
  private counters: Map<string, CounterMetric> = new Map();
  private timers: Map<string, TimerMetric[]> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private enabled: boolean = true;

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Enable or disable metrics collection
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Metrics collection ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Increment a counter metric
   * @param name - Metric name
   * @param labels - Metric labels for categorization
   * @param value - Amount to increment (default: 1)
   */
  public increment(
    name: string,
    labels: MetricLabels = {},
    value: number = 1,
  ): void {
    if (!this.enabled) return;

    const key = this.getMetricKey(name, labels);
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, {
        name,
        help: this.getMetricHelp(name),
        value,
        labels,
      });
    }
  }

  /**
   * Start a timer for measuring operation duration
   * @param name - Timer name
   * @param labels - Timer labels
   * @returns Timer ID for stopping the timer
   */
  public startTimer(name: string, labels: MetricLabels = {}): string {
    if (!this.enabled) return "";

    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timer: TimerMetric = {
      id: timerId,
      name,
      help: this.getMetricHelp(name),
      durationMs: 0,
      labels,
      startTime: performance.now(),
    };

    const existing = this.timers.get(name) || [];
    existing.push(timer);
    this.timers.set(name, existing);

    return timerId;
  }

  /**
   * Stop a timer and record the duration
   * @param timerId - Timer ID from startTimer
   * @returns Duration in milliseconds, or null if timer not found
   */
  public stopTimer(timerId: string): number | null {
    if (!this.enabled || !timerId) return null;

    for (const timers of this.timers.values()) {
      const timer = timers.find((t) => t.id === timerId);
      if (timer) {
        timer.durationMs = performance.now() - timer.startTime;
        return timer.durationMs;
      }
    }

    return null;
  }

  /**
   * Set a gauge metric value
   * @param name - Gauge name
   * @param value - Gauge value
   * @param labels - Gauge labels
   */
  public setGauge(
    name: string,
    value: number,
    labels: MetricLabels = {},
  ): void {
    if (!this.enabled) return;

    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, {
      name,
      help: this.getMetricHelp(name),
      value,
      labels,
    });
  }

  /**
   * Get all counter metrics
   */
  public getCounters(): CounterMetric[] {
    return Array.from(this.counters.values());
  }

  /**
   * Get all timer metrics
   */
  public getTimers(): TimerMetric[] {
    const allTimers: TimerMetric[] = [];
    for (const timers of this.timers.values()) {
      allTimers.push(...timers);
    }
    return allTimers;
  }

  /**
   * Get all gauge metrics
   */
  public getGauges(): GaugeMetric[] {
    return Array.from(this.gauges.values());
  }

  /**
   * Get timer statistics (count, sum, avg, min, max)
   */
  public getTimerStats(name: string): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const timers = this.timers.get(name);
    if (!timers || timers.length === 0) return null;

    const durations = timers.map((t) => t.durationMs);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      sum,
      avg: sum / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.counters.clear();
    this.timers.clear();
    this.gauges.clear();
    logger.info("All metrics reset");
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      const labelStr = this.formatLabels(counter.labels);
      lines.push(`${counter.name}${labelStr} ${counter.value}`);
    }

    // Gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      const labelStr = this.formatLabels(gauge.labels);
      lines.push(`${gauge.name}${labelStr} ${gauge.value}`);
    }

    // Timer summaries
    for (const [name, timers] of this.timers.entries()) {
      if (timers.length === 0) continue;
      const stats = this.getTimerStats(name);
      if (!stats) continue;

      lines.push(`# HELP ${name} ${(timers[0] as TimerMetric).help}`);
      lines.push(`# TYPE ${name} summary`);
      lines.push(`${name}_count ${stats.count}`);
      lines.push(`${name}_sum ${stats.sum}`);
    }

    return lines.join("\n");
  }

  /**
   * Export metrics as JSON
   */
  public exportJSON(): object {
    const timerStats: Record<
      string,
      ReturnType<typeof this.getTimerStats>
    > = {};
    for (const name of this.timers.keys()) {
      timerStats[name] = this.getTimerStats(name);
    }

    return {
      counters: this.getCounters(),
      gauges: this.getGauges(),
      timerStats,
      timestamp: new Date().toISOString(),
    };
  }

  private getMetricKey(name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private formatLabels(labels: MetricLabels): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "";
    const labelStr = entries.map(([k, v]) => `${k}="${v}"`).join(",");
    return `{${labelStr}}`;
  }

  private getMetricHelp(name: string): string {
    // Default help text based on metric name
    const helpMap: Record<string, string> = {
      tasks_created_total: "Total number of tasks created",
      tasks_completed_total: "Total number of tasks completed",
      tasks_failed_total: "Total number of tasks failed",
      tasks_cancelled_total: "Total number of tasks cancelled",
      task_duration_seconds: "Task operation duration in seconds",
      hooks_executed_total: "Total number of hooks executed",
      locks_acquired_total: "Total number of locks acquired",
      locks_released_total: "Total number of locks released",
      cpu_usage_percent: "CPU usage percentage",
      memory_usage_bytes: "Memory usage in bytes",
      disk_usage_bytes: "Disk usage in bytes",
      database_connections_active: "Number of active database connections",
      docker_containers_running: "Number of running Docker containers",
    };
    return helpMap[name] || `${name} metric`;
  }
}

// Export singleton instance
export const metrics = MetricsCollector.getInstance();

// Convenience functions for common use cases
export const taskMetrics = {
  created: (labels?: MetricLabels) =>
    metrics.increment("tasks_created_total", labels),
  completed: (labels?: MetricLabels) =>
    metrics.increment("tasks_completed_total", labels),
  failed: (labels?: MetricLabels) =>
    metrics.increment("tasks_failed_total", labels),
  cancelled: (labels?: MetricLabels) =>
    metrics.increment("tasks_cancelled_total", labels),
  startTimer: (labels?: MetricLabels) =>
    metrics.startTimer("task_duration_seconds", labels),
  stopTimer: (timerId: string) => metrics.stopTimer(timerId),
};

export const hookMetrics = {
  executed: (hookType: string) =>
    metrics.increment("hooks_executed_total", { type: hookType }),
};

export const lockMetrics = {
  acquired: (lockType: string) =>
    metrics.increment("locks_acquired_total", { type: lockType }),
  released: (lockType: string) =>
    metrics.increment("locks_released_total", { type: lockType }),
};

export default metrics;
