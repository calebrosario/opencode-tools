# State Machine Diagrams

Complete state machine diagrams for all major OpenCode Tools systems.

## Available Diagrams

1. **[Task Lifecycle](./task-lifecycle.md)** - Complete task state transitions
   - All states: pending, running, completed, failed, cancelled, deleted
   - Hook execution points
   - Lock manager integration
   - Error handling flows

2. **[Lock Manager](./lock-manager.md)** - Concurrency control system
   - Exclusive and collaborative modes
   - Lock acquisition/release flows
   - Retry mechanisms with backoff
   - Performance metrics

3. **[Multi-Layer Persistence](./persistence.md)** - 4-layer storage architecture
   - Layer 1: State (state.json)
   - Layer 2: Logs (logs.jsonl)
   - Layer 3: Decisions (decisions.md)
   - Layer 4: Checkpoints (checkpoints/**)
   - Filesystem structure
   - Performance characteristics

## Viewing Diagrams

All diagrams use Mermaid syntax and can be rendered in:

- **GitHub**: Automatically renders Mermaid in markdown files
- **GitLab**: Supports Mermaid in markdown
- **VS Code**: Install Mermaid preview extension
- **Online**: [Mermaid Live Editor](https://mermaid.live/)

## State Notation

| Symbol | Meaning |
|--------|---------|
| `[*]` | Initial/final state |
| `→` | Transition on success |
| `--→` | Transition on condition |
| `⭕` | Decision point |
| `⊕` | Parallel operations |
| `Ⓜ` | Fork/merge point |
| `⏭` | Termination point |

## State Machine Conventions

1. **State Names**: PascalCase (e.g., Pending, Running)
2. **Transition Labels**: Method names (e.g., startTask(), completeTask())
3. **Triggers**: Event names (e.g., agent_attached, task_completed)
4. **Guards**: Preconditions (e.g., status == 'pending')
5. **Actions**: Side effects (e.g., log_event, update_database)

## Integration Points

### Task Lifecycle ↔ Lock Manager

Task lifecycle operations are wrapped in locks:

```typescript
// Example: TaskLifecycle.startTask()
await lockManager.withLock('task:{taskId}', 'lifecycle:{agentId}', async () => {
  // Critical section - only one agent at a time
  await taskRegistry.markRunning(taskId);
  await multiLayerPersistence.appendLog(taskId, logEntry);
});
```

### Task Lifecycle ↔ Multi-Layer Persistence

Each lifecycle transition updates persistence:

```typescript
// Example: TaskLifecycle.completeTask()
await multiLayerPersistence.appendLog(taskId, {
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Task completed successfully',
  data: { result }
});
```

### Hook System ↔ Task Lifecycle

Hooks execute at specific transition points:

```typescript
// Before hooks validate and prepare
await taskLifecycleHooks.executeBeforeTaskStart(taskId, agentId);

// Lifecycle operation executes
const task = await startTaskInternal(taskId, agentId);

// After hooks react and clean up
await taskLifecycleHooks.executeAfterTaskStart(taskId, agentId);
```

## Error Recovery Patterns

### Retry Pattern (Lock Manager)

```
┌─────────────────────────────────────────┐
│  Acquire Lock Failed?              │
└──────────────┬────────────────────────┘
               │
       ┌───────┼───────┐
       │       │       │
      NO      YES     YES (retries > max)
       │       │       │
       │       │       ┌───▼───┐
       │       │       │         │
   Retry   Return   Give Up  Acquire
   │       │       │   Error    Lock     │
   │       │       │             │       │
       └───┴───┴───┴─────────▼─────────┘
               │
               ▼
          Return LockInfo
```

### Checkpoint Recovery (Persistence)

```
┌─────────────────────────────────────────┐
│  Task Failed?                      │
└──────────────┬────────────────────────┘
               │
       ┌───────┼───────┐
       │       │       │
      NO      YES     YES (has checkpoint)
       │       │       │
       │       │       ┌───▼───┐
       │       │       │         │
      Return  Check  Restore  Return Error
      │       │       │   Task    │       │
       │       │       │          │
       └───┴───┴───┴──────────┘
               │
               ▼
          Return Result/Error
```

## Performance Optimization

### Lock Manager

- **Fast Path**: Lock is free? Acquire immediately
- **Slow Path**: Lock is held? Wait or retry
- **Batch Locks**: Sort resources, acquire in order
- **Cleanup**: Remove expired locks periodically (5 min)

### Persistence

- **Batch Appends**: Group 100 logs at a time (35x faster)
- **Streaming**: Load logs in chunks (reduce memory)
- **Atomic Writes**: Write to .tmp, rename to final (safe)
- **Checksum Validation**: SHA256 for data integrity

### Task Registry

- **Index Optimization**: Create indexes on common queries
- **Batch Operations**: Use transactions for bulk inserts
- **Connection Pooling**: Reuse database connections
- **WAL Mode**: Enable Write-Ahead Logging

## State Machine Composition

Complex systems are composed of smaller, testable state machines:

```
┌─────────────────────────────────────────┐
│         TaskLifecycle               │
│  ┌───────────┬───────────┐      │
│  │             │           │      │
│  ▼             ▼           ▼      │
│ LockManager    Persistence  Hooks      │
│  └──────┬──────┴──────┬──────┘      │
│         │               │                │
│         └───────────────┴────────────────┘         │
│                                              │
└───────────────────────────────────────────┘
```

## Debugging State Machines

### Common Issues

1. **Deadlocks**: Multiple resources locked in different orders
   - **Solution**: Always acquire locks in sorted order
   - **Detection**: Lock timeout with backtrace

2. **Livelocks**: State keeps changing without progressing
   - **Solution**: Add timeout to all state transitions
   - **Detection**: Monitor state duration

3. **Orphaned States**: Task stuck in intermediate state
   - **Solution**: Periodic cleanup of stale tasks
   - **Detection**: Last update timestamp > threshold

4. **Lost Updates**: State change not persisted
   - **Solution**: Use atomic writes (temp + rename)
   - **Detection**: Compare checksums

### Logging Strategy

```typescript
// Log every state transition
logger.info('State transition', {
  system: 'TaskLifecycle',
  taskId,
  fromState,
  toState,
  trigger,
  duration: Date.now() - transitionStartTime
});

// Log lock operations
logger.debug('Lock operation', {
  resource,
  owner,
  mode,
  operation: 'acquire' | 'release',
  result: 'success' | 'failed'
});

// Log persistence operations
logger.trace('Persistence operation', {
  layer: 'state' | 'logs' | 'decisions' | 'checkpoints',
  operation: 'save' | 'load',
  taskId,
  duration
});
```

---

**Last Updated**: 2026-01-31
**Version**: 0.1.0-alpha
