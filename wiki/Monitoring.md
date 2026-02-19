# Monitoring

## Overview

OpenCode Tools provides monitoring capabilities through:

- Task statistics and metrics
- Lock manager statistics
- Database performance tracking
- Log aggregation
- Resource monitoring

## Task Statistics

### Viewing Statistics

```bash
# View overall statistics
npm run cli -- task-stats
```

**Output Example:**

```
Task Statistics
===============
Total Tasks: 1,234
Status Distribution:
  - pending: 45
  - running: 12
  - completed: 1,100
  - failed: 56
  - cancelled: 21

Owner Distribution:
  - agent-1: 456
  - agent-2: 321
  - agent-3: 457

Recent Tasks (Last 5):
  1. task_1234567890 (completed) - 2026-02-19T10:00:00Z
  2. task_0987654321 (running) - 2026-02-19T09:55:00Z
  3. task_1122334455 (completed) - 2026-02-19T09:50:00Z
  4. task_5544332211 (failed) - 2026-02-19T09:45:00Z
  5. task_6655443322 (pending) - 2026-02-19T09:40:00Z
```

### Custom Monitoring Hooks

```typescript
// Register hook to monitor task starts
taskLifecycleHooks.registerAfterTaskStart(async (taskId, agentId) => {
  // Send to monitoring system
  sendMonitoringEvent({
    event: "task_started",
    taskId,
    agentId,
    timestamp: new Date().toISOString(),
  });
});

// Register hook to monitor task completions
taskLifecycleHooks.registerAfterTaskComplete(async (taskId, result) => {
  sendMonitoringEvent({
    event: "task_completed",
    taskId,
    result,
    duration: calculateDuration(taskId),
    timestamp: new Date().toISOString(),
  });
});

// Register hook to monitor failures
taskLifecycleHooks.registerAfterTaskFail(async (taskId, error) => {
  sendMonitoringEvent({
    event: "task_failed",
    taskId,
    error,
    timestamp: new Date().toISOString(),
  });
});
```

## Lock Manager Statistics

### Viewing Lock Statistics

```typescript
// Get lock statistics
const stats = lockManager.getLockStatistics();

console.log("Lock Statistics:", {
  totalLocks: stats.totalLocks,
  activeLocks: stats.activeLocks,
  expiredLocks: stats.expiredLocks,
  conflictsDetected: stats.conflictsDetected,
  averageHoldTime: stats.averageHoldTime,
});
```

**Output Example:**

```json
{
  "totalLocks": 1234,
  "activeLocks": 45,
  "expiredLocks": 123,
  "conflictsDetected": 67,
  "averageHoldTime": 1234
}
```

### Monitoring Lock Health

```typescript
// Periodic lock health check
setInterval(() => {
  const stats = lockManager.getLockStatistics();

  // Alert if too many conflicts
  if (stats.conflictsDetected > 100) {
    logger.warn("High conflict rate detected", {
      conflicts: stats.conflictsDetected,
      rate: stats.conflictsDetected / stats.totalLocks,
    });
  }

  // Alert if locks held too long
  if (stats.averageHoldTime > 30000) {
    // > 30 seconds
    logger.warn("Locks held too long", {
      averageHoldTime: stats.averageHoldTime,
      activeLocks: stats.activeLocks,
    });
  }
}, 60000); // Every minute
```

## Database Monitoring

### SQLite Performance

```typescript
// Monitor SQLite performance
import Database from "better-sqlite3";

const db = new Database("data/opencode.db");

// Enable performance logging
db.pragma("profiling_mode = ON");

// Check database stats
const stats = {
  pageCacheHits: db.pragma("cache_hits", { simple: true }),
  pageCacheMisses: db.pragma("cache_miss", { simple: true }),
  databaseSize:
    db.pragma("page_count", { simple: true }) *
    db.pragma("page_size", { simple: true }),
};

console.log("Database Stats:", stats);
```

### Monitoring Slow Queries

```typescript
// Track slow queries
const SLOW_QUERY_THRESHOLD = 1000; // 1 second

db.function("logSlowQuery", (durationMs, query) => {
  if (durationMs > SLOW_QUERY_THRESHOLD) {
    logger.warn("Slow query detected", {
      query,
      duration: durationMs,
    });
  }
});

// Wrap queries with logging
function executeQuery(query: string, params: any[]) {
  const start = Date.now();
  const result = db.prepare(query).all(params);
  const duration = Date.now() - start;

  db.pragma("select logSlowQuery(?, ?);", [duration, query]);

  return result;
}
```

### Database Size Monitoring

```typescript
// Monitor database size
import { statSync } from "fs";

function checkDatabaseSize() {
  const stats = statSync("data/opencode.db");
  const sizeMB = stats.size / (1024 * 1024);

  logger.info("Database size", {
    sizeMB: sizeMB.toFixed(2),
    sizeBytes: stats.size,
  });

  // Alert if database is too large
  if (sizeMB > 100) {
    logger.warn("Database size exceeded threshold", {
      sizeMB: sizeMB.toFixed(2),
      threshold: "100MB",
    });
  }
}

setInterval(checkDatabaseSize, 3600000); // Every hour
```

## Performance Metrics

### System Performance

```typescript
// Monitor system performance
function monitorPerformance() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  logger.info("System performance", {
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
  });
}

setInterval(monitorPerformance, 60000); // Every minute
```

### API Response Times

```typescript
// Track API response times
const responseTimes = new Map<string, number[]>();

function recordResponseTime(operation: string, durationMs: number) {
  if (!responseTimes.has(operation)) {
    responseTimes.set(operation, []);
  }

  responseTimes.get(operation)!.push(durationMs);

  // Keep only last 1000 measurements
  const times = responseTimes.get(operation)!;
  if (times.length > 1000) {
    times.shift();
  }
}

function calculateResponseTimeStats(operation: string) {
  const times = responseTimes.get(operation) || [];
  if (times.length === 0) return null;

  const sorted = [...times].sort((a, b) => a - b);

  return {
    operation,
    count: times.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: times.reduce((sum, t) => sum + t, 0) / times.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// Wrap MCP tools with timing
async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - start;
    recordResponseTime(operation, duration);

    // Log if slow
    if (duration > 1000) {
      logger.warn("Slow API response", {
        operation,
        duration,
      });
    }
  }
}
```

## Log Aggregation

### Centralized Logging

```typescript
// Send logs to centralized system
async function sendToLogAggregator(entry: LogEntry) {
  // Example: Send to Elasticsearch, Splunk, or DataDog
  await fetch("https://logs.example.com/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

// Register hook to aggregate logs
taskLifecycleHooks.registerAfterTaskStart(async (taskId) => {
  const logs = await multiLayerPersistence.loadLogs(taskId, {
    level: "info",
    limit: 100,
  });

  for (const log of logs) {
    await sendToLogAggregator(log);
  }
});
```

### Log Analysis

```typescript
// Analyze logs for patterns
async function analyzeLogs(taskId: string) {
  const logs = await multiLayerPersistence.loadLogs(taskId);

  const levelCounts = logs.reduce(
    (acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const errorLogs = logs.filter((log) => log.level === "error");
  const errorRate = (errorLogs.length / logs.length) * 100;

  logger.info("Log analysis", {
    taskId,
    totalLogs: logs.length,
    levelCounts,
    errorCount: errorLogs.length,
    errorRate: `${errorRate.toFixed(2)}%`,
  });
}
```

## Alerting

### Alert Conditions

```typescript
interface AlertCondition {
  name: string;
  check: () => boolean;
  severity: "low" | "medium" | "high" | "critical";
  action: () => void;
}

const alertConditions: AlertCondition[] = [
  {
    name: "High Failure Rate",
    check: () => {
      const stats = getTaskStats();
      const failureRate = stats.failed / stats.total;
      return failureRate > 0.1; // > 10% failure rate
    },
    severity: "high",
    action: () => {
      sendAlert({
        title: "High Task Failure Rate",
        message: "Task failure rate exceeded 10%",
        severity: "high",
      });
    },
  },
  {
    name: "Database Size",
    check: () => {
      const sizeMB = getDatabaseSizeMB();
      return sizeMB > 100;
    },
    severity: "medium",
    action: () => {
      sendAlert({
        title: "Database Size Warning",
        message: `Database size is ${sizeMB.toFixed(2)} MB`,
        severity: "medium",
      });
    },
  },
  {
    name: "Lock Conflicts",
    check: () => {
      const stats = lockManager.getLockStatistics();
      const conflictRate = stats.conflictsDetected / stats.totalLocks;
      return conflictRate > 0.2; // > 20% conflict rate
    },
    severity: "medium",
    action: () => {
      sendAlert({
        title: "High Lock Conflict Rate",
        message: `Lock conflict rate is ${(conflictRate * 100).toFixed(2)}%`,
        severity: "medium",
      });
    },
  },
];

// Check alert conditions periodically
function checkAlerts() {
  for (const condition of alertConditions) {
    if (condition.check()) {
      logger.warn(`Alert triggered: ${condition.name}`, {
        severity: condition.severity,
      });
      condition.action();
    }
  }
}

setInterval(checkAlerts, 60000); // Every minute
```

### Alert Notification

```typescript
// Send alert notifications
async function sendAlert(alert: {
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
}) {
  // Email notification
  await sendEmail({
    to: "ops@example.com",
    subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
    body: alert.message,
  });

  // Slack notification
  await sendToSlack({
    channel: "#alerts",
    text: `[${alert.severity}] ${alert.title}: ${alert.message}`,
  });

  // PagerDuty (for critical alerts)
  if (alert.severity === "critical") {
    await triggerPagerDuty({
      title: alert.title,
      description: alert.message,
    });
  }
}
```

## Dashboard Integration

### Prometheus Metrics

```typescript
// Export metrics for Prometheus
import promClient from "prom-client";

// Task metrics
const taskTotal = new promClient.Counter({
  name: "opencode_tasks_total",
  help: "Total number of tasks",
});

const taskDuration = new promClient.Histogram({
  name: "opencode_task_duration_seconds",
  help: "Task duration in seconds",
  buckets: [1, 5, 10, 30, 60, 300],
});

// Lock metrics
const lockConflicts = new promClient.Counter({
  name: "opencode_lock_conflicts_total",
  help: "Total number of lock conflicts",
});

// Database metrics
const dbSize = new promClient.Gauge({
  name: "opencode_db_size_bytes",
  help: "Database size in bytes",
});

// Expose metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Grafana Dashboards

Example Grafana dashboard queries:

```
# Task completion rate over time
rate(opencode_tasks_total{status="completed"}[5m])

# Average task duration
histogram_quantile(0.95, opencode_task_duration_seconds)

# Lock conflict rate
rate(opencode_lock_conflicts_total[5m])

# Database size
opencode_db_size_bytes
```

## Performance Benchmarks

### Current Benchmarks

#### SQLite (100K Tasks)

- Batch Insert: 212,319 ops/sec
- Single Row Read: 302,724 ops/sec
- Range Query: 18,197 ops/sec
- Database Size: 23.36MB

#### JSONL (1M Entries)

- Simple Append: 10,785 ops/sec
- Batch Append: 377,060 ops/sec (35x faster)
- File Size: 183MB

#### Lock Manager

- Lock Acquisition: <1ms
- Lock Throughput: 742K ops/sec
- Conflict Detection: <5ms

### Setting Performance Goals

```typescript
// Define performance SLA
const performanceGoals = {
  lockAcquisitionMs: 10, // Max lock acquisition time
  taskCreationMs: 100, // Max task creation time
  logAppendMs: 1, // Max log append time
  checkpointCreationMs: 100, // Max checkpoint creation time
  dbQueryMs: 5, // Max database query time
};

// Monitor performance against goals
function checkPerformanceGoals() {
  const metrics = getPerformanceMetrics();

  const violations = Object.entries(performanceGoals)
    .filter(([key, goal]) => metrics[key] > goal)
    .map(([key, goal]) => ({
      metric: key,
      goal,
      actual: metrics[key],
    }));

  if (violations.length > 0) {
    logger.warn("Performance SLA violations", { violations });
  }
}

setInterval(checkPerformanceGoals, 60000); // Every minute
```

## Troubleshooting Performance Issues

### Identifying Bottlenecks

1. **Check database queries:**

   ```bash
   # Enable SQLite query logging
   sqlite3 data/opencode.db "PRAGMA profiling_mode = ON;"
   ```

2. **Check lock contention:**

   ```typescript
   const stats = lockManager.getLockStatistics();
   console.log("Conflict rate:", stats.conflictsDetected / stats.totalLocks);
   ```

3. **Check memory usage:**

   ```bash
   npm run cli -- task-stats
   ```

4. **Check disk I/O:**
   ```bash
   iostat -x 1
   ```

### Performance Optimization Checklist

- [ ] Enable WAL mode for SQLite
- [ ] Create database indexes on common queries
- [ ] Use batch operations where possible
- [ ] Clean up old checkpoints regularly
- [ ] Monitor and tune lock timeouts
- [ ] Use collaborative mode for independent operations
- [ ] Implement log rotation
- [ ] Monitor memory usage and add limits
- [ ] Profile slow queries
- [ ] Optimize file I/O (atomic writes)

---

**Last Updated**: 2026-02-19
**Version**: 0.1.0-alpha
