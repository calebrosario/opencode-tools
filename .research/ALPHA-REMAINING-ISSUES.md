# Alpha v0.1.0 - Remaining Issues & Edge Cases

**Date**: 2026-02-01
**Status**: Post-Release Analysis
**Release**: v0.1.0-alpha (https://github.com/calebrosario/opencode-tools/releases/tag/v0.1.0-alpha)

---

## Executive Summary

Alpha v0.1.0 has been successfully released. This document identifies remaining issues, edge cases, and improvements needed before Beta v0.2.0.

**Total Issues Identified**: 10
**Critical Issues**: 4
**Medium Priority**: 4
**Low Priority**: 2

---

## 1. TaskRegistry Initialization Issue (CRITICAL)

### Problem
TaskRegistry tests are failing with "TaskRegistry not initialized" error because `initialize()` is not being called before CRUD operations.

### Error Message
```
throw new OpenCodeError('TASK_CREATE_FAILED', 'Failed to create task', { taskId: task.id, error });
```

### Root Cause
- `TaskRegistry.getInstance()` returns singleton instance
- `initialize()` must be called explicitly before any operations
- Tests are calling operations without initializing

### Files Affected
- tests/registry/registry.test.ts (9 failing tests)
- Possibly integration tests using TaskRegistry

### Solution Options

**Option A: Auto-initialize in getInstance()**
```typescript
public static getInstance(): TaskRegistry {
  if (!TaskRegistry.instance) {
    TaskRegistry.instance = new TaskRegistry();
  }
  // Auto-initialize if not done
  if (!TaskRegistry.instance.db) {
    TaskRegistry.instance.initialize().catch(err => {
      logger.error('Failed to auto-initialize TaskRegistry', { err });
    });
  }
  return TaskRegistry.instance;
}
```

**Option B: Initialize in test setup**
```typescript
beforeAll(async () => {
  await TaskRegistry.getInstance().initialize();
  await taskRegistry.getInstance().initialize();
});
```

**Recommended**: Option A - Auto-initialize for better UX
**Priority**: HIGH (blocks tests)
**Effort**: 1-2 hours

---

## 2. Docker Manager TODO: Port Parsing (MEDIUM)

### Problem
Comment in code indicates incomplete implementation:
```typescript
ports: [], // TODO: Parse ports from info
```

### File
- src/docker/manager.ts (line 878)

### Impact
- Container info doesn't include port bindings
- Users can't see which ports are exposed
- Affects displayTasks() CLI command output

### Solution
Parse port bindings from Dockerode ContainerInspectInfo:
```typescript
const ports: PortBinding[] = [];
if (info.NetworkSettings?.Ports) {
  for (const [containerPort, portBindings] of Object.entries(info.NetworkSettings.Ports)) {
    for (const binding of portBindings || []) {
      ports.push({
        containerPort: parseInt(containerPort.split('/')[0]),
        hostPort: binding.HostPort,
        hostIp: binding.HostIp || '0.0.0.0',
        protocol: containerPort.split('/')[1] === 'tcp' ? 'tcp' : 'udp',
      });
    }
  }
}
```

**Priority**: MEDIUM
**Effort**: 2-3 hours

---

## 3. Test File Location Issues (MEDIUM)

### Problem
Test files are in non-standard locations:
- src/util/__tests__/ instead of tests/util/

### Files Affected
- src/util/__tests__/resource-monitor.test.ts
- src/util/__tests__/process-supervisor.test.ts
- src/util/__tests__/state-validator.test.ts

### Impact
- Test discovery may not find these files
- Inconsistent project structure

### Solution
Move test files to standard location:
```bash
# Create tests/util/ directory
mkdir -p tests/util

# Move files
mv src/util/__tests__/*.test.ts tests/util/

# Update imports in moved files
# Change: import { ... } from '../util/__tests__/...
# To: import { ... } from '../../src/util/...'
```

**Priority**: MEDIUM
**Effort**: 1 hour

---

## 4. Plan Hooks Test Failures (MEDIUM)

### Problem
3 plan hook tests are failing with console errors, but error messages are unclear.

### Failing Tests
- should execute hook with taskId and agentId
- should execute hook with taskId and result
- should execute hook with taskId and result

### File
- tests/hooks/plan-hooks.test.ts

### Root Cause
Unknown - needs investigation

### Solution
1. Run tests with verbose output: `npm test -- tests/hooks/plan-hooks.test.ts --verbose`
2. Check test implementation vs hook implementation
3. Ensure proper mocking

**Priority**: MEDIUM
**Effort**: 1-2 hours

---

## 5. Database Abstraction Missing (CRITICAL - Beta Blocking)

### Problem
No abstraction layer between application and database. Hard-coded SQLite dependencies throughout codebase.

### Impact
- Cannot easily add PostgreSQL support
- Difficult to swap databases for testing
- Tight coupling to SQLite

### Files Affected
- src/task-registry/registry.ts
- src/persistence/database.ts
- Any other file using DatabaseManager

### Solution Design
Create DatabaseAdapter interface:
```typescript
export interface DatabaseAdapter {
  create(table: string, data: any): Promise<void>;
  get(table: string, id: string): Promise<any>;
  getAll(table: string, options?: any): Promise<any[]>;
  update(table: string, id: string, data: any): Promise<void>;
  delete(table: string, id: string): Promise<void>;
  run(sql: string, params?: any[]): Promise<any>;
}

export class SQLiteAdapter implements DatabaseAdapter {
  // Existing SQLite implementation
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  // New PostgreSQL implementation
}
```

**Priority**: HIGH (Beta blocker)
**Effort**: 8-12 hours (major refactoring)

---

## 6. No Monitoring/Metrics (CRITICAL - Beta Feature)

### Problem
No system monitoring, metrics collection, or health checks.

### Impact
- Cannot track system health
- No performance metrics
- Cannot detect issues proactively
- No observability for production use

### Required Features for Beta
- Health check endpoints
- Performance metrics (CPU, memory, disk)
- Operation counters (tasks created, completed, failed)
- Error rate tracking
- Logging to external service (optional)

### Solution Design
Create src/monitoring/ directory:
```
src/monitoring/
├── health-check.ts    # Health check endpoints
├── metrics.ts         # Metrics collection
├── dashboard.ts       # Simple dashboard API
└── index.ts
```

**Priority**: HIGH (Beta requirement)
**Effort**: 16-20 hours

---

## 7. No External Database Configuration (CRITICAL - Beta Feature)

### Problem
Database connection is hard-coded. No way to configure external PostgreSQL/MySQL.

### Impact
- Cannot connect to external databases
- Production deployments limited to SQLite
- No connection pooling configuration

### Required Features for Beta
- Database configuration (type, host, port, database, user, password)
- Connection pooling settings
- Multiple database support (SQLite, PostgreSQL, MySQL)
- Migration scripts

### Solution
Create config/database.ts:
```typescript
export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  pool?: {
    min: number;
    max: number;
  };
}
```

**Priority**: HIGH (Beta requirement)
**Effort**: 4-6 hours

---

## 8. Missing Web UI (LOW - Future Feature)

### Problem
No web interface for task management. CLI only.

### Impact
- Steeper learning curve
- Not suitable for non-technical users
- Limited collaboration features

### Note
This is a nice-to-have feature, not blocking Beta.

### Planned for v1.0.0

**Priority**: LOW
**Effort**: 40-60 hours (separate project phase)

---

## 9. Integration Test Coverage Unknown (MEDIUM)

### Problem
Integration tests were created but not verified to run successfully due to TypeScript errors.

### Status
- Tests created: 1,227 lines
- Build passes: 0 errors
- Test execution: Not verified

### Impact
- Unknown if integration tests actually pass
- Possible regressions introduced

### Solution
Run full integration test suite after merge:
```bash
npm test tests/integration/
```

**Priority**: MEDIUM
**Effort**: 1 hour

---

## 10. Edge Cases Not Fully Tested (MEDIUM)

### Problem
Certain edge cases identified in research but not covered by tests.

### Examples
- Concurrent lock acquisition conflicts
- State corruption recovery
- Database connection failures
- Container resource exhaustion
- Task timeout handling

### Impact
- System may fail in edge conditions
- Difficult to debug production issues

### Solution
Create edge case test suite:
```
tests/edge-cases/
├── concurrency.test.ts
├── state-corruption.test.ts
├── resource-exhaustion.test.ts
└── timeout-handling.test.ts
```

**Priority**: MEDIUM
**Effort**: 8-12 hours

---

## Priority Matrix

| Issue | Priority | Blocking | Effort | Week |
|-------|-----------|-----------|---------|-------|
| TaskRegistry Initialization | HIGH | Yes | 1-2h | 15 |
| Database Abstraction | HIGH | Yes (Beta) | 8-12h | 16 |
| Monitoring/Metrics | HIGH | Yes (Beta) | 16-20h | 17 |
| External DB Config | HIGH | Yes (Beta) | 4-6h | 16 |
| Port Parsing TODO | MEDIUM | No | 2-3h | 15 |
| Test File Locations | MEDIUM | No | 1h | 15 |
| Plan Hooks Tests | MEDIUM | No | 1-2h | 15 |
| Integration Tests | MEDIUM | No | 1h | 15 |
| Edge Case Tests | MEDIUM | No | 8-12h | 18 |
| Web UI | LOW | No | 40-60h | v1.0.0 |

---

## Week 15 Task Breakdown

### Week 15: User Feedback & Bug Fixes (Priority: HIGH)

**Task 15.1: Fix TaskRegistry Auto-Initialization**
- Implement auto-initialize in getInstance()
- Update tests to remove explicit initialize() calls
- Verify all tests pass
- **Acceptance**: All TaskRegistry tests passing

**Task 15.2: Fix Test File Locations**
- Move src/util/__tests__/ to tests/util/
- Update imports in moved test files
- Run test suite to verify
- **Acceptance**: All tests discoverable and passing

**Task 15.3: Fix Docker Port Parsing**
- Implement port parsing from ContainerInspectInfo
- Update ContainerInfo interface
- Add tests for port parsing
- **Acceptance**: Port bindings correctly parsed and displayed

**Task 15.4: Fix Plan Hooks Tests**
- Investigate test failures
- Fix issues in test or implementation
- Add error messages
- **Acceptance**: All plan hook tests passing

**Task 15.5: Run Integration Test Suite**
- Execute all integration tests
- Document any failures
- Create bug reports if needed
- **Acceptance**: All integration tests verified

**Task 15.6: Setup GitHub Issue Templates**
- Create ISSUE_TEMPLATE/bug_report.md
- Create ISSUE_TEMPLATE/feature_request.md
- Create ISSUE_TEMPLATE/question.md
- **Acceptance**: Templates in repository

**Task 15.7: Add CLI Feedback Prompts**
- Add feedback prompt to create-task command
- Add feedback prompt to list-tasks command
- Add feedback prompt to --help
- **Acceptance**: Users see feedback options in key workflows

**Task 15.8: Create Weekly Feedback Summary**
- Document Alpha feedback collection strategy
- Create feedback review schedule
- Define prioritization process
- **Acceptance**: Feedback process documented

---

## Success Criteria for Week 15

- [ ] All HIGH priority issues from Alpha resolved
- [ ] All TaskRegistry tests passing
- [ ] Integration test suite verified
- [ ] GitHub issue templates created
- [ ] Feedback prompts added to CLI
- [ ] Feedback collection process documented
- [ ] Build passes with 0 errors
- [ ] Week 15 tasks completed and committed

---

## Risk Assessment

### High Risks
1. **Database abstraction may uncover hidden SQLite dependencies**
   - **Mitigation**: Incremental refactoring, test at each step
   - **Fallback**: Keep SQLite as default if abstraction too complex

2. **Monitoring system may impact performance**
   - **Mitigation**: Async metrics collection, sampling-based
   - **Fallback**: Make monitoring optional/configurable

3. **User feedback volume unknown**
   - **Mitigation**: Start with lightweight approach, scale if needed
   - **Fallback**: Use GitHub issues and discussions as primary channels

---

## Next Steps

1. **Begin Week 15 Tasks**
   - Start with Task 15.1 (TaskRegistry auto-initialize)
   - Progress through Week 15 tasks in priority order

2. **Week 16 Planning**
   - Database abstraction design and implementation
   - Monitoring system architecture
   - External database configuration

3. **Continue Phase 3**
   - Follow Week 15-19 plan from PHASE3-OVERVIEW.md

---

**Last Updated**: 2026-02-01
**Status**: Analysis Complete ✅
**Ready for**: Week 15 Implementation
