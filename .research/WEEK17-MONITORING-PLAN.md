# Monitoring & Metrics System

## Week 17 Implementation Plan

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring & Metrics                      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌─────────▼────────┐  ┌──────▼──────┐
│   Metrics    │  │  Health Checks   │  │ Performance │
│  Collection  │  │                  │  │  Tracking   │
└──────────────┘  └──────────────────┘  └─────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │    Dashboard   │
                    │    Provider    │
                    └────────────────┘
```

### Components

1. **Metrics Collection Service** (`src/monitoring/metrics.ts`)
   - Counters (tasks created, completed, failed)
   - Timers (operation duration)
   - Gauges (current state)
   - Labels for categorization

2. **Health Check System** (`src/monitoring/health.ts`)
   - Database connectivity
   - Docker daemon status
   - Disk space
   - Memory usage

3. **Performance Tracking** (`src/monitoring/performance.ts`)
   - CPU usage
   - Memory usage
   - Disk I/O
   - Response times

4. **Dashboard Provider** (`src/monitoring/dashboard.ts`)
   - Aggregates all metrics
   - Provides data for CLI display
   - JSON export for external tools

5. **CLI Integration** (`src/cli/commands/metrics.ts`)
   - `opencode metrics` - Display current metrics
   - `opencode health` - Check system health
   - `opencode stats` - Show performance stats

### Metrics to Track

**Operation Metrics:**

- tasks_created_total
- tasks_completed_total
- tasks_failed_total
- tasks_cancelled_total
- task_duration_seconds
- hooks_executed_total
- locks_acquired_total
- locks_released_total

**System Metrics:**

- cpu_usage_percent
- memory_usage_bytes
- disk_usage_bytes
- database_connections_active
- docker_containers_running

**Health Checks:**

- database_status (healthy/unhealthy)
- docker_status (healthy/unhealthy)
- disk_space_status (healthy/warning/critical)

### Acceptance Criteria

- [ ] Metrics can be collected from all core services
- [ ] Health checks provide clear status indicators
- [ ] CLI commands display formatted metrics
- [ ] No performance impact on core operations (< 1ms overhead)
- [ ] Tests verify metrics accuracy
- [ ] Documentation explains monitoring system

### Implementation Order

1. Design and implement Metrics class
2. Add health check endpoints
3. Implement performance tracking
4. Create dashboard data provider
5. Add CLI commands
6. Write tests
7. Update documentation
