# Architecture

## Core Components

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

## Data Flow

1. **MCP Request** → TaskLifecycle
2. **TaskLifecycle** → LockManager (acquire lock)
3. **TaskLifecycle** → TaskRegistry (CRUD operations)
4. **TaskLifecycle** → Hooks (execute hooks)
5. **TaskLifecycle** → MultiLayerPersistence (state + logs)
6. **TaskLifecycle** → LockManager (release lock)
7. **Response** → MCP Client

## Persistence Layers

### Layer 1: state.json - Current task state (fast access)

- Task ID, status, metadata
- SHA256 checksum for validation

### Layer 2: logs.jsonl - Audit trail (append-only)

- JSONL format for streaming
- Filtering by level, date, offset
- Batch append support

### Layer 3: decisions.md - Agent decisions (human-readable)

- Markdown format
- Agent ID, decision, reasoning
- Timestamp tracking

### Layer 4: checkpoints/\*\* - Snapshots (point-in-time recovery)

- State and logs snapshots
- Manifest metadata
- Restore functionality

## Concurrency Model

### Optimistic Locking

The system uses optimistic locking with version control to handle concurrent access:

1. **Read Phase**: Agent reads current state with version number
2. **Modify Phase**: Agent makes changes locally
3. **Write Phase**: Agent writes back with version check
4. **Conflict Detection**: Version mismatch → retry or fail

### Lock Modes

**Exclusive Mode:**

- Single agent holds lock
- Immediate failure on conflict
- Use for: Tasks requiring consistency

**Collaborative Mode:**

- Multiple agents can hold lock
- Optimistic versioning for conflict detection
- Automatic retry with exponential backoff
- Use for: Independent task parts

## Hook System

### Hook Types

1. **beforeTaskStart** - Before task starts
2. **afterTaskStart** - After task starts
3. **beforeTaskComplete** - Before task completes
4. **afterTaskComplete** - After task completes
5. **beforeTaskFail** - Before task fails
6. **afterTaskFail** - After task fails

### Hook Execution

```typescript
// Hooks execute in priority order (lower = earlier)
taskLifecycleHooks.registerBeforeTaskStart(hookFn, priority: 10);
```

### Error Handling

- Hooks continue on error (isolated)
- All errors logged with duration
- Hook errors don't block other hooks

## Error Recovery

### Crash Recovery

The system automatically recovers from crashes:

1. **State Validation**: Checksum verification on load
2. **Automatic Recovery**:
   - Reconstruct from JSONL logs
   - Use last known good state
   - Reconstruct from operation logs
3. **Checkpoint Restore**: Manual recovery from checkpoints

### Checkpoint Strategy

Create checkpoints at strategic points:

- Before risky operations (migrations, data transformations)
- After completing major milestones
- Before external API calls
- When task will be paused for extended period

## Performance Optimization

### Database (SQLite)

- **Index Optimization**: Create indexes on common queries
- **Batch Operations**: Use transactions for bulk inserts
- **Connection Pooling**: Reuse database connections
- **WAL Mode**: Enable Write-Ahead Logging

### Persistence

- **Batch Appends**: Group 100 logs at a time (35x faster)
- **Streaming**: Load logs in chunks (reduce memory)
- **Atomic Writes**: Write to .tmp, rename to final (safe)
- **Checksum Validation**: SHA256 for data integrity

### Lock Manager

- **Fast Path**: Lock is free? Acquire immediately
- **Slow Path**: Lock is held? Wait or retry
- **Batch Locks**: Sort resources, acquire in order
- **Cleanup**: Remove expired locks periodically (5 min)

## Filesystem Structure

```
opencode-tools/
├── src/
│   ├── docker/           # Docker management
│   ├── task/            # Task lifecycle
│   ├── task-registry/    # SQLite backend
│   ├── persistence/      # Multi-layer persistence
│   ├── util/            # Lock manager, utilities
│   └── hooks/          # Hook system
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/            # End-to-end tests
├── data/
│   ├── opencode.db      # SQLite database
│   └── tasks/          # Task data
│       └── {taskId}/
│           ├── state.json
│           ├── logs.jsonl
│           ├── decisions.md
│           └── checkpoints/
├── docs/               # Documentation
└── wiki/               # GitHub Wiki
```

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

## Security Considerations

### Agent Authentication

Implement agent authentication for task access:

```typescript
function authenticateAgent(agentId: string, apiKey: string): boolean {
  const agent = await agentRegistry.getAgent(agentId);
  return agent && agent.apiKey === apiKey;
}
```

### Task Access Control

Restrict task access:

```typescript
async function canAccessTask(
  taskId: string,
  agentId: string,
): Promise<boolean> {
  const task = await taskRegistry.getById(taskId);

  // Owner can access
  if (task.owner === agentId) return true;

  // Check collaborative mode
  const collaborators = task.metadata?.collaborators || [];
  return collaborators.includes(agentId);
}
```

### Input Validation

Always validate inputs:

```typescript
import { z } from "zod";

const TaskConfigSchema = z.object({
  name: z.string().min(1).max(255),
  owner: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

function validateTaskConfig(config: any): TaskConfig {
  return TaskConfigSchema.parse(config);
}
```

---

**Last Updated**: 2026-02-19
**Version**: 0.1.0-alpha
