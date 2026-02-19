# OpenCode Tools

> A Docker-based task management system with concurrency, state persistence, and multi-agent orchestration.

## Overview

OpenCode Tools is a production-ready system for managing AI agent tasks with:

- **Docker Integration**: Full lifecycle management for Docker containers
- **Concurrency Control**: Optimistic locking for multi-agent workflows
- **State Persistence**: 4-layer architecture (state, logs, decisions, checkpoints)
- **Multi-Agent Orchestration**: Support for collaborative and exclusive task modes
- **MCP Integration**: Model Context Protocol server for agent communication
- **CLI Tools**: 13 command-line utilities for task management

## Current Status

**Version**: 0.1.0 (Alpha)
**Phase**: Phase 2 - Integration & Alpha Release

### Completed Features

✅ Phase 0: Deep Dive Research (100%)

- Docker Engine API integration
- Concurrency models with optimistic locking
- Multi-layer persistence architecture
- JSONL logging benchmarks

✅ Phase 1: Core Infrastructure (100%)

- TaskRegistry with SQLite backend
- LockManager with optimistic locking
- MultiLayerPersistence with 4 layers
- NetworkManager and VolumeManager
- Resource monitoring and isolation
- Crash recovery system

✅ Phase 2: MVP Core (100%)

- TaskLifecycle with state transitions
- MCP Server with 8 tools
- Hook system (6 hook types)
- 13 CLI commands (task management, checkpoints, memory)
- Integration and E2E tests

## Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/calebrosario/opencode-tools.git
cd opencode-tools

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Start the MCP Server

```bash
npm start
```

The MCP server starts on the configured port (default: 3000).

### Use CLI Commands

```bash
# List all tasks
npm run cli -- list-tasks

# Create a new task
npm run cli -- create-task "My Task" --owner agent-1

# Attach an agent to a task
npm run cli -- attach-agent --agent agent-1 --task task-123

# View task history
npm run cli -- task-history --task task-123

# Create a checkpoint
npm run cli -- checkpoint --task task-123 --description "Before deployment"
```

## Key Features

### 1. Task Lifecycle

```typescript
// Create task
const task = await taskLifecycle.createTask({
  name: "My Task",
  owner: "agent-1",
  metadata: { priority: "high" },
});

// Start task
await taskLifecycle.startTask(task.id, "agent-1");

// Complete task
await taskLifecycle.completeTask(task.id, {
  success: true,
  data: { result: "completed" },
  message: "Task completed successfully",
});

// Fail task
await taskLifecycle.failTask(task.id, "Error message");

// Cancel task
await taskLifecycle.cancelTask(task.id);
```

### 2. Concurrency Control

```typescript
// Exclusive mode (single agent)
await lockManager.acquireLockWithRetry("task:123", "agent-1", "exclusive");

// Collaborative mode (multiple agents)
await lockManager.acquireLockWithRetry("task:123", "agent-1", "collaborative");

// With automatic lock management
await lockManager.withLock("task:123", "agent-1", async () => {
  // Critical section - automatically releases lock
  await taskRegistry.update(taskId, updates);
});
```

### 3. Multi-Layer Persistence

```typescript
// Save state
await multiLayerPersistence.saveState(taskId, {
  taskId,
  status: "running",
  data: { progress: 50 },
  lastUpdated: new Date().toISOString(),
});

// Append log
await multiLayerPersistence.appendLog(taskId, {
  timestamp: new Date().toISOString(),
  level: "info",
  message: "Processing item 5/10",
  data: { item: 5, total: 10 },
});

// Create checkpoint
const checkpointId = await multiLayerPersistence.createCheckpoint(
  taskId,
  "Before deployment",
);

// Restore checkpoint
await multiLayerPersistence.restoreCheckpoint(taskId, checkpointId);
```

### 4. Hook System

```typescript
// Register beforeTaskStart hook
taskLifecycleHooks.registerBeforeTaskStart(async (taskId, agentId) => {
  console.log(`Task ${taskId} starting with agent ${agentId}`);
}, priority: 10); // Lower = executes first

// Register afterTaskComplete hook
taskLifecycleHooks.registerAfterTaskComplete(async (taskId, result) => {
  console.log(`Task ${taskId} completed: ${JSON.stringify(result)}`);
}, priority: 5);
```

### 5. MCP Tools

**Available Tools:**

- `create_task_sandbox` - Create new task
- `attach_agent_to_task` - Attach agent to task
- `detach_agent_from_task` - Detach agent from task
- `execute_in_task` - Execute command in task
- `get_task_status` - Get task status
- `cancel_task` - Cancel task
- `delete_task` - Delete task
- `list_tasks` - List all tasks

### 6. CLI Commands

**Task Management:**

- `create-task` - Create new task
- `resume-task` - Resume pending task
- `list-tasks` - List tasks with filters
- `detach` - Detach agent from task
- `complete-task` - Mark task complete
- `cleanup-task` - Cleanup task and resources

**Checkpoints:**

- `checkpoint` - Create checkpoint
- `restore-checkpoint` - Restore from checkpoint

**Memory:**

- `task-history` - View task execution history
- `task-executions` - View execution details
- `task-decisions` - View agent decisions
- `find-task` - Search tasks
- `task-stats` - View task statistics

## Documentation

- **[API Reference](API-Reference.md)** - Complete API documentation
- **[User Guide](User-Guide.md)** - Tutorials and best practices
- **[Architecture](Architecture.md)** - System architecture and components
- **[Installation](Installation.md)** - Detailed installation instructions
- **[Troubleshooting](Troubleshooting.md)** - Common issues and solutions
- **[State Machines](State-Machines.md)** - State machine diagrams

## Performance Benchmarks

### SQLite (100K Tasks)

- Batch Insert: 212,319 ops/sec
- Single Row Read: 302,724 ops/sec
- Range Query: 18,197 ops/sec
- Database Size: 23.36MB

### JSONL (1M Entries)

- Simple Append: 10,785 ops/sec
- Batch Append: 377,060 ops/sec (35x faster)
- File Size: 183MB

### Lock Manager

- Lock Acquisition: <1ms
- Lock Throughput: 742K ops/sec
- Conflict Detection: <5ms

## Roadmap

### Phase 3: Production Features (Planned)

- Docker Manager with full lifecycle
- Resource monitoring with alerts
- Agent sandboxing with network isolation
- Advanced error recovery
- Performance monitoring dashboard

### Phase 4: Scaling (Future)

- PostgreSQL migration for >20 concurrent writers
- Distributed task queues
- Multi-region deployment
- Advanced analytics and reporting

## License

MIT License - See LICENSE file for details

---

**Last Updated**: 2026-02-19
**Version**: 0.1.0-alpha
