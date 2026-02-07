// Metrics Collection Service - Week 17 Implementation
// Provides counters, timers, and gauges for system monitoring

import { logger } from "./logger";

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface CounterMetric {
  name: string;
  description: string;
  values: MetricValue[];
  total: number;
}

export interface TimerMetric {
  name: string;
  description: string;
  values: MetricValue[];
  durations: number[];
}

export interface GaugeMetric {
  name: string;
  description: string;
  currentValue: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private counters: Map<string, CounterMetric> = new Map();
  private timers: Map<string, TimerMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();

  private constructor() {}

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Increment a counter metric
   * @param name - Metric name
   * @param value - Amount to increment (default: 1)
   * @param labels - Optional labels for categorization
   */
  public incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
  ): void {
    const key = this.getMetricKey(name, labels);

    if (!this.counters.has(key)) {
      this.counters.set(key, {
        name,
        description: `${name} counter`,
        values: [],
        total: 0,
      });
    }

    const counter = this.counters.get(key)!;
    counter.total += value;
    counter.values.push({
      value,
      timestamp: Date.now(),
      labels,
    });

    // Keep only last 1000 values to prevent memory issues
    if (counter.values.length > 1000) {
      counter.values.shift();
    }

    logger.debug(`Counter incremented: ${name}=${counter.total}`, { labels });
  }

  /**
   * Start a timer and return a function to stop it
   * @param name - Timer metric name
   * @param labels - Optional labels
   * @returns Function to stop timer and record duration
   */
  public startTimer(
    name: string,
    labels?: Record<string, string>,
  ): () => number {
    const startTime = process.hrtime.bigint();
    const key = this.getMetricKey(name, labels);

    return () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      if (!this.timers.has(key)) {
        this.timers.set(key, {
          name,
          description: `${name} timer`,
          values: [],
          durations: [],
        });
      }

      const timer = this.timers.get(key)!;
      timer.durations.push(durationMs);
      timer.values.push({
        value: durationMs,
        timestamp: Date.now(),
        labels,
      });

      // Keep only last 1000 values
      if (timer.values.length > 1000) {
        timer.values.shift();
        timer.durations.shift();
      }

      logger.debug(`Timer recorded: ${name}=${durationMs.toFixed(2)}ms`, {
        labels,
      });
      return durationMs;
    };
  }

  /**
   * Record a duration directly (for async operations)
   * @param name - Timer metric name
   * @param durationMs - Duration in milliseconds
   * @param labels - Optional labels
   */
  public recordDuration(
    name: string,
    durationMs: number,
    labels?: Record<string, string>,
  ): void {
    const key = this.getMetricKey(name, labels);

    if (!this.timers.has(key)) {
      this.timers.set(key, {
        name,
        description: `${name} timer`,
        values: [],
        durations: [],
      });
    }

    const timer = this.timers.get(key)!;
    timer.durations.push(durationMs);
    timer.values.push({
      value: durationMs,
      timestamp: Date.now(),
      labels,
    });

    // Keep only last 1000 values
    if (timer.values.length > 1000) {
      timer.values.shift();
      timer.durations.shift();
    }

    logger.debug(`Duration recorded: ${name}=${durationMs.toFixed(2)}ms`, {
      labels,
    });
  }

  /**
   * Set a gauge metric value
   * @param name - Gauge metric name
   * @param value - Current value
   * @param labels - Optional labels
   */
  public setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const key = this.getMetricKey(name, labels);

    this.gauges.set(key, {
      name,
      description: `${name} gauge`,
      currentValue: value,
      timestamp: Date.now(),
      labels,
    });

    logger.debug(`Gauge set: ${name}=${value}`, { labels });
  }

  /**
   * Get counter metric statistics
   */
  public getCounterStats(
    name: string,
    labels?: Record<string, string>,
  ): {
    total: number;
    count: number;
    lastValue: number;
    lastTimestamp: number;
  } | null {
    const key = this.getMetricKey(name, labels);
    const counter = this.counters.get(key);

    if (!counter || counter.values.length === 0) {
      return null;
    }

    const lastValue = counter.values[counter.values.length - 1];
    return {
      total: counter.total,
      count: counter.values.length,
      lastValue: lastValue.value,
      lastTimestamp: lastValue.timestamp,
    };
  }

  /**
   * Get timer metric statistics
   */
  public getTimerStats(
    name: string,
    labels?: Record<string, string>,
  ): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
    lastValue: number;
  } | null {
    const key = this.getMetricKey(name, labels);
    const timer = this.timers.get(key);

    if (!timer || timer.durations.length === 0) {
      return null;
    }

    const durations = timer.durations;
    const sorted = [...durations].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      count: durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p95: sorted[p95Index] || sorted[sorted.length - 1],
      lastValue: durations[durations.length - 1],
    };
  }

  /**
   * Get gauge metric value
   */
  public getGaugeValue(
    name: string,
    labels?: Record<string, string>,
  ): GaugeMetric | null {
    const key = this.getMetricKey(name, labels);
    return this.gauges.get(key) || null;
  }

  /**
   * Get all metrics summary
   */
  public getAllMetrics(): {
    counters: Array<{
      name: string;
      labels?: Record<string, string>;
      stats: ReturnType<typeof this.getCounterStats>;
    }>;
    timers: Array<{
      name: string;
      labels?: Record<string, string>;
      stats: ReturnType<typeof this.getTimerStats>;
    }>;
    gauges: Array<{
      name: string;
      labels?: Record<string, string>;
      value: GaugeMetric;
    }>;
  } {
    const counters: Array<{
      name: string;
      labels?: Record<string, string>;
      stats: ReturnType<typeof this.getCounterStats>;
    }> = [];
    const timers: Array<{
      name: string;
      labels?: Record<string, string>;
      stats: ReturnType<typeof this.getTimerStats>;
    }> = [];
    const gauges: Array<{
      name: string;
      labels?: Record<string, string>;
      value: GaugeMetric;
    }> = [];

    // Collect counters
    for (const [key, counter] of this.counters.entries()) {
      const labels = counter.values[counter.values.length - 1]?.labels;
      counters.push({
        name: counter.name,
        labels,
        stats: this.getCounterStats(counter.name, labels),
      });
    }

    // Collect timers
    for (const [key, timer] of this.timers.entries()) {
      const labels = timer.values[timer.values.length - 1]?.labels;
      timers.push({
        name: timer.name,
        labels,
        stats: this.getTimerStats(timer.name, labels),
      });
    }

    // Collect gauges
    for (const [key, gauge] of this.gauges.entries()) {
      gauges.push({
        name: gauge.name,
        labels: gauge.labels,
        value: gauge,
      });
    }

    return { counters, timers, gauges };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public resetAll(): void {
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

    // Export counters
    for (const [key, counter] of this.counters.entries()) {
      lines.push(`# HELP ${counter.name} ${counter.description}`);
      lines.push(`# TYPE ${counter.name} counter`);
      const labels = this.formatLabels(
        counter.values[counter.values.length - 1]?.labels,
      );
      lines.push(`${counter.name}${labels} ${counter.total}`);
    }

    // Export gauges
    for (const [key, gauge] of this.gauges.entries()) {
      lines.push(`# HELP ${gauge.name} ${gauge.description}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      const labels = this.formatLabels(gauge.labels);
      lines.push(`${gauge.name}${labels} ${gauge.currentValue}`);
    }

    // Export timers (as summaries)
    for (const [key, timer] of this.timers.entries()) {
      const stats = this.getTimerStats(
        timer.name,
        timer.values[timer.values.length - 1]?.labels,
      );
      if (stats) {
        lines.push(`# HELP ${timer.name} ${timer.description}`);
        lines.push(`# TYPE ${timer.name} summary`);
        const labels = this.formatLabels(
          timer.values[timer.values.length - 1]?.labels,
        );
        lines.push(`${timer.name}_count${labels} ${stats.count}`);
        lines.push(`${timer.name}_sum${labels} ${stats.avg * stats.count}`);
      }
    }

    return lines.join("\n");
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}{${labelStr}}`;
  }

  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "";
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return `{${labelStr}}`;
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();
