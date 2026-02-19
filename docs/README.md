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

### DeepWiki [Opencode-Tools](https://deepwiki.com/calebrosario/opencode-tools)

## Current Status

**Version**: 0.1.0 (Alpha)
**Phase**: Phase 2 - Integration & Alpha Release
**Branch**: master

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

## Installation

### Prerequisites

- **Node.js** v20+
- **TypeScript** v5.3+
- **SQLite** v3.45+ (included via better-sqlite3)
- **Docker** (for container operations)

### Quick Install

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

### Development Mode

```bash
# Watch mode for development
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

## Quick Start

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

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                              │
│                  (REST/JSON API)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼────────────────┬──────────────┐
        │              │                │              │
┌───────▼───────┐  ┌───▼──────────┐  ┌──▼─────────┐ ┌──▼──────────┐
│ TaskLifecycle │  │ TaskRegistry │  │ Persistence│ │LockManager  │
└──────────┬────┘  └──────┬───────┘  └────┬───────┘ └──────┬──────┘
           │              │               │                │
           └──────────────┴───────────────┴────────────────┘
                          │
                    ┌─────▼────────┐
                    │ 4-Layer      │
                    │ Persistence  │
                    └──────────────┘
```

### Data Flow

1. **MCP Request** → TaskLifecycle
2. **TaskLifecycle** → LockManager (acquire lock)
3. **TaskLifecycle** → TaskRegistry (CRUD operations)
4. **TaskLifecycle** → Hooks (execute hooks)
5. **TaskLifecycle** → MultiLayerPersistence (state + logs)
6. **TaskLifecycle** → LockManager (release lock)
7. **Response** → MCP Client

### Persistence Layers

**Layer 1: state.json** - Current task state (fast access)
- Task ID, status, metadata
- SHA256 checksum for validation

**Layer 2: logs.jsonl** - Audit trail (append-only)
- JSONL format for streaming
- Filtering by level, date, offset
- Batch append support

**Layer 3: decisions.md** - Agent decisions (human-readable)
- Markdown format
- Agent ID, decision, reasoning
- Timestamp tracking

**Layer 4: checkpoints/** - Snapshots (point-in-time recovery)
- State and logs snapshots
- Manifest metadata
- Restore functionality

## Key Features

### 1. Task Lifecycle

```typescript
// Create task
const task = await taskLifecycle.createTask({
  name: 'My Task',
  owner: 'agent-1',
  metadata: { priority: 'high' }
});

// Start task
await taskLifecycle.startTask(task.id, 'agent-1');

// Complete task
await taskLifecycle.completeTask(task.id, {
  success: true,
  data: { result: 'completed' },
  message: 'Task completed successfully'
});

// Fail task
await taskLifecycle.failTask(task.id, 'Error message');

// Cancel task
await taskLifecycle.cancelTask(task.id);
```

### 2. Concurrency Control

```typescript
// Exclusive mode (single agent)
await lockManager.acquireLockWithRetry('task:123', 'agent-1', 'exclusive');

// Collaborative mode (multiple agents)
await lockManager.acquireLockWithRetry('task:123', 'agent-1', 'collaborative');

// With automatic lock management
await lockManager.withLock('task:123', 'agent-1', async () => {
  // Critical section - automatically releases lock
  await taskRegistry.update(taskId, updates);
});
```

### 3. Multi-Layer Persistence

```typescript
// Save state
await multiLayerPersistence.saveState(taskId, {
  taskId,
  status: 'running',
  data: { progress: 50 },
  lastUpdated: new Date().toISOString()
});

// Append log
await multiLayerPersistence.appendLog(taskId, {
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Processing item 5/10',
  data: { item: 5, total: 10 }
});

// Create checkpoint
const checkpointId = await multiLayerPersistence.createCheckpoint(
  taskId,
  'Before deployment'
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

## Configuration

### Environment Variables

```bash
# Database configuration
OPENCODE_DB_PATH=./data/opencode.db

# MCP server configuration
OPENCODE_MCP_PORT=3000
OPENCODE_MCP_HOST=localhost

# Docker configuration
OPENCODE_DOCKER_SOCKET=/var/run/docker.sock
OPENCODE_DOCKER_NETWORK_PREFIX=opencode
```

### Configuration File

Create `config.json` in project root:

```json
{
  "database": {
    "path": "./data/opencode.db",
    "enableWAL": true,
    "cacheSize": 10000
  },
  "mcp": {
    "port": 3000,
    "host": "localhost",
    "maxConnections": 100,
    "requestTimeout": 30000
  },
  "docker": {
    "socketPath": "/var/run/docker.sock",
    "networkPrefix": "opencode",
    "defaultResourceLimits": {
      "memory": 512,
      "cpuShares": 512,
      "pidsLimit": 100
    }
  }
}
```

## Common Use Cases

### Use Case 1: Single Agent Task

```bash
# Create task
npm run cli -- create-task "Data Processing" --owner data-agent

# Attach agent
npm run cli -- attach-agent --agent data-agent --task task-123

# Monitor progress
npm run cli -- task-history --task task-123 --level info

# Complete task
npm run cli -- complete-task --task task-123 --result '{"status": "success"}'
```

### Use Case 2: Multi-Agent Collaboration

```bash
# Agent 1: Start task
npm run cli -- create-task "Collaborative Task" --owner agent-1
npm run cli -- attach-agent --agent agent-1 --task task-456

# Agent 2: Join collaborative mode
npm run cli -- attach-agent --agent agent-2 --task task-456

# Agent 3: Join collaborative mode
npm run cli -- attach-agent --agent agent-3 --task task-456

# Monitor collaboration
npm run cli -- task-decisions --task task-456
```

### Use Case 3: Checkpoint and Resume

```bash
# Create checkpoint before risky operation
npm run cli -- checkpoint --task task-789 --description "Before migration"

# Run migration...

# If migration fails, restore checkpoint
npm run cli -- restore-checkpoint --task task-789 --checkpoint checkpoint_1234567890
```

### Use Case 4: Error Recovery

```bash
# View error logs
npm run cli -- task-history --task task-101 --level error

# View execution details
npm run cli -- task-executions --task task-101

# Resume from last good state
npm run cli -- resume-task --agent recovery-agent --checkpoint checkpoint_last_good
```

## Troubleshooting

### Issue: Docker connection failed

**Solution:**
```bash
# Check Docker is running
docker info

# Check socket permissions
ls -la /var/run/docker.sock

# Add user to docker group
sudo usermod -aG docker $USER
```

### Issue: Database locked

**Solution:**
```bash
# Check for other processes
lsof data/opencode.db

# Restart application (releases locks)
# Locks auto-expire after timeout
```

### Issue: Hooks not executing

**Solution:**
- Check hook registration order (lower priority = earlier execution)
- Verify hooks aren't throwing errors (hooks log but continue)
- Check hook function signatures match expected types

### Issue: Performance degradation

**Solution:**
```bash
# Check lock statistics
npm run cli -- task-stats

# Clean up old checkpoints
find data/tasks/*/checkpoints -type d -mtime +7 -exec rm -rf {} \;

# Enable WAL mode for SQLite
OPENCODE_DB_WAL=true npm start
```

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

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and test: `npm test`
3. Type check: `npm run type-check`
4. Lint: `npm run lint`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create Pull Request

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm test -- path/to/test.test.ts
```

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

## Support

- **Documentation**: [docs/](./)
- **API Reference**: [API.md](./API.md)
- **User Guide**: [USER_GUIDE.md](./USER_GUIDE.md)
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

---

**Last Updated**: 2026-01-31
**Version**: 0.1.0-alpha
