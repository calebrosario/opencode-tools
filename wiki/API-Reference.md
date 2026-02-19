# OpenCode Tools API Documentation

Complete reference for all OpenCode Tools APIs, tools, and data models.

## Table of Contents

- [MCP Tools](#mcp-tools)
- [TaskLifecycle API](#tasklifecycle-api)
- [TaskRegistry API](#taskregistry-api)
- [MultiLayerPersistence API](#multilayerpersistence-api)
- [LockManager API](#lockmanager-api)
- [Hook System](#hook-system)
- [Data Models](#data-models)
- [Error Codes](#error-codes)

---

## MCP Tools

The MCP (Model Context Protocol) server provides 8 tools for task management.

### Tool: create_task_sandbox

**Description**: Create a new task sandbox

**Parameters**:
```typescript
{
  taskId: string;      // Optional: Auto-generated if not provided
  name: string;       // Required: Task name
  owner: string;      // Optional: Agent ID or 'system'
  metadata: object;   // Optional: Custom metadata
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;  // ISO 8601 timestamp
}
```

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_task_sandbox",
    "arguments": {
      "name": "Data Processing Task",
      "owner": "agent-1",
      "metadata": {
        "priority": "high",
        "dataset": "sales_2026"
      }
    }
  }
}
```

---

### Tool: attach_agent_to_task

**Description**: Attach an AI agent to an existing task

**Parameters**:
```typescript
{
  taskId: string;  // Required: Task ID
  agentId: string; // Required: Agent ID to attach
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  agentId: string;
  attached: boolean;
}
```

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "attach_agent_to_task",
    "arguments": {
      "taskId": "task_1234567890",
      "agentId": "data-processor"
    }
  }
}
```

---

### Tool: detach_agent_from_task

**Description**: Detach an agent from a task

**Parameters**:
```typescript
{
  taskId: string;  // Required: Task ID
  agentId: string; // Required: Agent ID to detach
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  agentId: string;
  detached: boolean;
}
```

**Note**: In the current implementation, detach only logs the action. Full agent association removal is planned for Phase 3.

---

### Tool: execute_in_task

**Description**: Execute a command in a task

**Parameters**:
```typescript
{
  taskId: string;    // Required: Task ID
  command: string;   // Required: Command to execute
  timeout: number;   // Optional: Timeout in ms (default: 30000)
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;  // Execution time in ms
}
```

**Note**: In the current implementation, command execution is simulated. Full Docker command execution is planned for Phase 3.

---

### Tool: list_tasks

**Description**: List all tasks with optional filters

**Parameters**:
```typescript
{
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  owner?: string;   // Filter by owner
  limit?: number;    // Maximum results to return
  offset?: number;   // Pagination offset
}
```

**Returns**:
```typescript
{
  success: boolean;
  tasks: Task[];    // Array of Task objects
  count: number;     // Total count
}
```

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "list_tasks",
    "arguments": {
      "status": "running",
      "owner": "agent-1",
      "limit": 10
    }
  }
}
```

---

### Tool: get_task_status

**Description**: Get task status and details

**Parameters**:
```typescript
{
  taskId: string;  // Required: Task ID
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  task: Task;  // Full task object
}
```

---

### Tool: cancel_task

**Description**: Cancel a task

**Parameters**:
```typescript
{
  taskId: string;  // Required: Task ID
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  status: 'cancelled';
  task: Task;  // Updated task object
}
```

---

### Tool: delete_task

**Description**: Delete a task and cleanup all resources

**Parameters**:
```typescript
{
  taskId: string;  // Required: Task ID
}
```

**Returns**:
```typescript
{
  success: boolean;
  taskId: string;
  message: string;
}
```

---

## TaskLifecycle API

TaskLifecycle manages the complete lifecycle of tasks.

### Instance

```typescript
import { taskLifecycle } from './task/lifecycle';
```

### Methods

#### createTask

```typescript
createTask(config: TaskConfig): Promise<Task>
```

Create a new task.

**Parameters**:
```typescript
interface TaskConfig {
  id?: string;              // Auto-generated if not provided
  name: string;             // Required: Task name
  owner?: string;            // Default: 'system'
  metadata?: Record<string, any>;
}
```

**Returns**: `Promise<Task>`

**Example**:
```typescript
const task = await taskLifecycle.createTask({
  name: 'Data Processing',
  owner: 'agent-1',
  metadata: { priority: 'high' }
});
```

---

#### startTask

```typescript
startTask(taskId: string, agentId: string): Promise<Task>
```

Start a task (transition: pending → running).

Executes:
1. `beforeTaskStart` hooks
2. Task state update
3. Logging
4. `afterTaskStart` hooks

**Parameters**:
- `taskId`: Task ID to start
- `agentId`: Agent ID starting the task

**Returns**: `Promise<Task>` with status `'running'`

**Throws**: If task not found or status is not `'pending'`

---

#### completeTask

```typescript
completeTask(taskId: string, result: TaskResult): Promise<Task>
```

Complete a task (transition: running → completed).

Executes:
1. `beforeTaskComplete` hooks
2. Task state update
3. Result logging
4. `afterTaskComplete` hooks

**Parameters**:
- `taskId`: Task ID to complete
- `result`: Task result object

**Returns**: `Promise<Task>` with status `'completed'`

**Throws**: If task not found or status is not `'running'`

---

#### failTask

```typescript
failTask(taskId: string, error: string): Promise<Task>
```

Fail a task (transition: running → failed).

Executes:
1. `beforeTaskFail` hooks
2. Task state update
3. Error logging
4. `afterTaskFail` hooks

**Parameters**:
- `taskId`: Task ID to fail
- `error`: Error message

**Returns**: `Promise<Task>` with status `'failed'`

**Throws**: If task not found or status is not `'running'`

---

#### cancelTask

```typescript
cancelTask(taskId: string): Promise<Task>
```

Cancel a task (transition: pending → cancelled or running → cancelled).

**Parameters**:
- `taskId`: Task ID to cancel

**Returns**: `Promise<Task>` with status `'cancelled'`

**Throws**: If task not found or status is invalid

---

#### deleteTask

```typescript
deleteTask(taskId: string): Promise<void>
```

Delete a task and cleanup all persistence layers.

**Parameters**:
- `taskId`: Task ID to delete

**Returns**: `Promise<void>`

**Throws**: If task not found

---

#### getTaskStatus

```typescript
getTaskStatus(taskId: string): Promise<TaskStatus>
```

Get current task status.

**Parameters**:
- `taskId`: Task ID

**Returns**: `Promise<TaskStatus>`

---

## TaskRegistry API

TaskRegistry provides CRUD operations for tasks stored in SQLite.

### Instance

```typescript
import { taskRegistry } from './task-registry/registry';
await taskRegistry.initialize();
```

### Methods

#### create

```typescript
create(task: Task): Promise<Task>
```

Create a new task in the registry.

**Parameters**: Full `Task` object

**Returns**: `Promise<Task>`

**Throws**: `OpenCodeError` with code `'TASK_CREATE_FAILED'`

---

#### getById

```typescript
getById(id: string): Promise<Task | null>
```

Get task by ID.

**Parameters**: Task ID

**Returns**: `Promise<Task | null>`

---

#### update

```typescript
update(id: string, updates: Partial<Task>): Promise<Task>
```

Update task fields.

**Parameters**:
- `id`: Task ID
- `updates`: Partial task object

**Returns**: `Promise<Task>`

**Throws**: `OpenCodeError` with code `'TASK_NOT_FOUND'` or `'TASK_UPDATE_FAILED'`

---

#### delete

```typescript
delete(id: string): Promise<void>
```

Delete task from registry.

**Parameters**: Task ID

**Returns**: `Promise<void>`

**Throws**: `OpenCodeError` with code `'TASK_NOT_FOUND'` or `'TASK_DELETE_FAILED'`

---

#### list

```typescript
list(filters?: TaskFilters): Promise<Task[]>
```

List tasks with optional filters.

**Parameters**:
```typescript
interface TaskFilters {
  status?: TaskStatus;
  owner?: string;
  limit?: number;
  offset?: number;
}
```

**Returns**: `Promise<Task[]>`

---

#### markRunning

```typescript
markRunning(id: string): Promise<Task>
```

Mark task as running.

**Returns**: `Promise<Task>`

---

#### markCompleted

```typescript
markCompleted(id: string): Promise<Task>
```

Mark task as completed.

**Returns**: `Promise<Task>`

---

#### markFailed

```typescript
markFailed(id: string, error: string): Promise<Task>
```

Mark task as failed and store error in metadata.

**Parameters**:
- `id`: Task ID
- `error`: Error message

**Returns**: `Promise<Task>`

---

#### bulkInsert

```typescript
bulkInsert(tasks: Task[]): Promise<Task[]>
```

Insert multiple tasks in a single transaction.

**Parameters**: Array of `Task` objects

**Returns**: `Promise<Task[]>`

---

#### getByStatus

```typescript
getByStatus(status: TaskStatus): Promise<Task[]>
```

Get all tasks with a specific status.

**Returns**: `Promise<Task[]>`

---

#### getByOwner

```typescript
getByOwner(owner: string): Promise<Task[]>
```

Get all tasks owned by a specific agent.

**Returns**: `Promise<Task[]>`

---

## MultiLayerPersistence API

Multi-layer persistence system with 4 storage layers.

### Instance

```typescript
import { multiLayerPersistence } from './persistence/multi-layer';
```

### Layer 1: State (state.json)

#### saveState

```typescript
saveState(taskId: string, state: TaskState): Promise<void>
```

Save task state with checksum validation.

**Parameters**:
```typescript
interface TaskState {
  taskId: string;
  status: string;
  data: Record<string, any>;
  lastUpdated: string;
}
```

**Returns**: `Promise<void>`

---

#### loadState

```typescript
loadState(taskId: string): Promise<TaskState | null>
```

Load and validate task state.

**Returns**: `Promise<TaskState | null>` (null if task doesn't exist)

**Throws**: If state validation fails (checksum mismatch)

---

### Layer 2: Logs (logs.jsonl)

#### appendLog

```typescript
appendLog(taskId: string, entry: LogEntry): Promise<void>
```

Append a single log entry.

**Parameters**:
```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, any>;
}
```

**Returns**: `Promise<void>`

---

#### batchAppendLogs

```typescript
batchAppendLogs(taskId: string, entries: LogEntry[]): Promise<void>
```

Append multiple log entries (35x faster than individual appends).

**Returns**: `Promise<void>`

---

#### loadLogs

```typescript
loadLogs(taskId: string, options?: LogOptions): Promise<LogEntry[]>
```

Load logs with filtering.

**Parameters**:
```typescript
interface LogOptions {
  limit?: number;
  offset?: number;
  level?: string;
  startDate?: string;
  endDate?: string;
}
```

**Returns**: `Promise<LogEntry[]>`

---

### Layer 3: Decisions (decisions.md)

#### appendDecision

```typescript
appendDecision(taskId: string, decision: AgentDecision): Promise<void>
```

Append an agent decision.

**Parameters**:
```typescript
interface AgentDecision {
  timestamp: string;
  agentId: string;
  decision: string;
  reasoning: string;
  metadata?: Record<string, any>;
}
```

**Returns**: `Promise<void>`

---

#### loadDecisions

```typescript
loadDecisions(taskId: string): Promise<AgentDecision[]>
```

Load all agent decisions.

**Returns**: `Promise<AgentDecision[]>`

---

### Layer 4: Checkpoints (checkpoints/)

#### createCheckpoint

```typescript
createCheckpoint(taskId: string, description?: string): Promise<string>
```

Create a checkpoint (snapshot) of task state and logs.

**Parameters**:
- `taskId`: Task ID
- `description`: Optional checkpoint description

**Returns**: `Promise<string>` (checkpoint ID)

---

#### restoreCheckpoint

```typescript
restoreCheckpoint(taskId: string, checkpointId: string): Promise<void>
```

Restore task state from checkpoint.

**Parameters**:
- `taskId`: Task ID
- `checkpointId`: Checkpoint ID to restore

**Returns**: `Promise<void>`

---

#### listCheckpoints

```typescript
listCheckpoints(taskId: string): Promise<Checkpoint[]>
```

List all checkpoints for a task.

**Returns**: `Promise<Checkpoint[]>` sorted by timestamp (newest first)

---

#### cleanup

```typescript
cleanup(taskId: string): Promise<void>
```

Cleanup all persistence layers for a task.

**Returns**: `Promise<void>`

---

## LockManager API

Optimistic locking for concurrency control.

### Instance

```typescript
import { lockManager } from './util/lock-manager';
```

### Methods

#### acquireLockWithRetry

```typescript
acquireLockWithRetry(
  resource: string,
  owner: string,
  mode?: LockMode,
  maxRetries?: number,
  timeout?: number
): Promise<LockInfo>
```

Acquire a lock with automatic retry for collaborative mode.

**Parameters**:
- `resource`: Resource identifier (e.g., `'task:123'`)
- `owner`: Lock owner (e.g., `'agent-1'`)
- `mode`: `'exclusive'` (default) or `'collaborative'`
- `maxRetries`: Maximum retry attempts (default: 3)
- `timeout`: Lock timeout in milliseconds

**Returns**: `Promise<LockInfo>`

**Example**:
```typescript
// Exclusive lock (single agent)
const lock = await lockManager.acquireLockWithRetry(
  'task:123',
  'agent-1',
  'exclusive',
  3,
  30000
);

// Collaborative lock (multiple agents)
const lock = await lockManager.acquireLockWithRetry(
  'task:123',
  'agent-1',
  'collaborative',
  10,
  60000
);
```

---

#### withLock

```typescript
withLock<T>(
  resource: string,
  owner: string,
  fn: () => Promise<T>,
  mode?: LockMode,
  timeout?: number
): Promise<T>
```

Execute a function with automatic lock management (acquire and release).

**Parameters**:
- `resource`: Resource identifier
- `owner`: Lock owner
- `fn`: Function to execute while holding lock
- `mode`: Lock mode (default: `'exclusive'`)
- `timeout`: Lock timeout

**Returns**: `Promise<T>` (function result)

**Example**:
```typescript
await lockManager.withLock('task:123', 'agent-1', async () => {
  // Critical section - automatically releases lock
  await taskRegistry.update(taskId, { metadata: newMetadata });
});
```

---

#### acquireBatchLock

```typescript
acquireBatchLock(
  resources: string[],
  owner: string,
  mode?: LockMode,
  timeout?: number
): Promise<string[]>
```

Acquire locks on multiple resources (sorts to prevent deadlocks).

**Parameters**:
- `resources`: Array of resource identifiers
- `owner`: Lock owner
- `mode`: Lock mode
- `timeout`: Lock timeout

**Returns**: `Promise<string[]>` (acquired resource list)

---

#### releaseBatchLock

```typescript
releaseBatchLock(resources: string[], owner: string): Promise<void>
```

Release multiple locks.

**Returns**: `Promise<void>`

---

#### getLockStatus

```typescript
getLockStatus(resource?: string): LockInfo | Map<string, LockInfo>
```

Get lock status for a specific resource or all resources.

**Returns**: `LockInfo` or `Map<string, LockInfo>`

---

#### getLockStatistics

```typescript
getLockStatistics(): object
```

Get lock statistics from OptimisticLock.

**Returns**: Object with statistics

---

#### emergencyCleanup

```typescript
emergencyCleanup(owner: string): number
```

Force cleanup of all locks for a specific owner (emergency use only).

**Parameters**: `owner` to clean up

**Returns**: `number` (count of locks removed)

---

## Hook System

Task lifecycle hooks allow custom logic execution at specific transition points.

### Instance

```typescript
import { taskLifecycleHooks } from './hooks/task-lifecycle';
```

### Hook Types

#### BeforeTaskStartHook

```typescript
type BeforeTaskStartHook = (taskId: string, agentId: string) => Promise<void>;
```

Executes before a task starts.

---

#### AfterTaskStartHook

```typescript
type AfterTaskStartHook = (taskId: string, agentId: string) => Promise<void>;
```

Executes after a task starts.

---

#### BeforeTaskCompleteHook

```typescript
type BeforeTaskCompleteHook = (taskId: string, result: TaskResult) => Promise<void>;
```

Executes before a task completes.

---

#### AfterTaskCompleteHook

```typescript
type AfterTaskCompleteHook = (taskId: string, result: TaskResult) => Promise<void>;
```

Executes after a task completes.

---

#### BeforeTaskFailHook

```typescript
type BeforeTaskFailHook = (taskId: string, error: string) => Promise<void>;
```

Executes before a task fails.

---

#### AfterTaskFailHook

```typescript
type AfterTaskFailHook = (taskId: string, error: string) => Promise<void>;
```

Executes after a task fails.

---

### Registration Methods

#### registerBeforeTaskStart

```typescript
registerBeforeTaskStart(hook: BeforeTaskStartHook, priority?: number): string
```

Register a hook to execute before task starts.

**Parameters**:
- `hook`: Hook function
- `priority`: Lower numbers execute first (default: 10)

**Returns**: Hook ID (for unregistering)

---

#### registerAfterTaskStart

```typescript
registerAfterTaskStart(hook: AfterTaskStartHook, priority?: number): string
```

Register a hook to execute after task starts.

**Parameters**:
- `hook`: Hook function
- `priority`: Lower numbers execute first (default: 10)

**Returns**: Hook ID

---

#### registerBeforeTaskComplete

```typescript
registerBeforeTaskComplete(hook: BeforeTaskCompleteHook, priority?: number): string
```

Register a hook to execute before task completes.

**Returns**: Hook ID

---

#### registerAfterTaskComplete

```typescript
registerAfterTaskComplete(hook: AfterTaskCompleteHook, priority?: number): string
```

Register a hook to execute after task completes.

**Returns**: Hook ID

---

#### registerBeforeTaskFail

```typescript
registerBeforeTaskFail(hook: BeforeTaskFailHook, priority?: number): string
```

Register a hook to execute before task fails.

**Returns**: Hook ID

---

#### registerAfterTaskFail

```typescript
registerAfterTaskFail(hook: AfterTaskFailHook, priority?: number): string
```

Register a hook to execute after task fails.

**Returns**: Hook ID

---

### Management Methods

#### unregisterHook

```typescript
unregisterHook(hookId: string): void
```

Unregister a hook by ID.

**Parameters**: `hookId` to unregister

---

#### getAllHooks

```typescript
getAllHooks(): Hook[]
```

Get all registered hooks.

**Returns**: Array of `Hook` objects

---

#### getHooksByType

```typescript
getHooksByType(type: string): Hook[]
```

Get all hooks of a specific type.

**Parameters**: Hook type (e.g., `'beforeTaskStart'`, `'afterTaskComplete'`)

**Returns**: Array of `Hook` objects

---

## Data Models

### Task

```typescript
interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  owner?: string;
  metadata?: Record<string, any>;
}
```

---

### TaskStatus

```typescript
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
```

---

### TaskConfig

```typescript
interface TaskConfig {
  id?: string;
  name: string;
  owner?: string;
  metadata?: Record<string, any>;
}
```

---

### TaskResult

```typescript
interface TaskResult {
  success: boolean;
  status?: 'success' | 'error';
  data?: any;
  error?: string;
  message?: string;
}
```

---

### LockInfo

```typescript
interface LockInfo {
  resource: string;
  owner: string;
  acquiredAt: Date;
  timeout?: number;
  version: number;  // for optimistic locking
}
```

---

### LockMode

```typescript
type LockMode = 'exclusive' | 'collaborative';
```

---

### LogEntry

```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, any>;
}
```

---

### AgentDecision

```typescript
interface AgentDecision {
  timestamp: string;
  agentId: string;
  decision: string;
  reasoning: string;
  metadata?: Record<string, any>;
}
```

---

### Checkpoint

```typescript
interface Checkpoint {
  id: string;
  taskId: string;
  timestamp: string;
  description: string;
  files: string[];
  manifest: Record<string, any>;
}
```

---

### Hook

```typescript
interface Hook {
  id: string;
  type: string;
  fn: (...args: any[]) => Promise<void>;
  priority: number;
  registeredAt: Date;
}
```

---

## Error Codes

### OpenCodeError

All errors extend `OpenCodeError`:

```typescript
class OpenCodeError extends Error {
  public readonly code: string;
  public readonly details?: any;
}
```

### Registry Error Codes

| Code | Description |
|------|-------------|
| `REGISTRY_NOT_INITIALIZED` | TaskRegistry not initialized |
| `TASK_NOT_FOUND` | Task not found in registry |
| `TASK_CREATE_FAILED` | Failed to create task |
| `TASK_UPDATE_FAILED` | Failed to update task |
| `TASK_DELETE_FAILED` | Failed to delete task |
| `TASK_BULK_INSERT_FAILED` | Failed to bulk insert tasks |

### State Persistence Error Codes

| Code | Description |
|------|-------------|
| `STATE_SAVE_FAILED` | Failed to save state |
| `STATE_LOAD_FAILED` | Failed to load state |
| `STATE_VALIDATION_FAILED` | State checksum validation failed |

### MCP Server Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TOOL_NOT_FOUND` | 404 | Requested tool does not exist |
| `INVALID_REQUEST` | 400 | Invalid request format |
| `EXECUTION_FAILED` | 500 | Tool execution failed |

---

## Request/Response Formats

### MCP Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_task_sandbox",
    "arguments": {
      "name": "My Task",
      "owner": "agent-1"
    }
  }
}
```

### MCP Response (Success)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "taskId": "task_1234567890",
    "status": "pending",
    "createdAt": "2026-01-31T12:00:00.000Z"
  }
}
```

### MCP Response (Error)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'unknown_tool' not found",
    "details": {
      "requested": "unknown_tool",
      "available": ["create_task_sandbox", "attach_agent_to_task", ...]
    }
  }
}
```

---

## Performance Considerations

### Lock Manager
- Lock acquisition: <1ms
- Lock throughput: 742K ops/sec
- Conflict detection: <5ms

### Persistence
- State save: <10ms
- Log append (single): <1ms
- Log append (batch 100): <10ms (35x faster)
- Checkpoint creation: ~50ms

### TaskRegistry (SQLite)
- Single insert: <1ms
- Single read: <1ms
- Range query: <5ms
- Batch insert (100): <20ms

---

**Last Updated**: 2026-01-31
**Version**: 0.1.0-alpha
