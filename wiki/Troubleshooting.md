# Troubleshooting

## Common Issues and Solutions

### Docker Connection Issues

#### Issue: Docker connection failed

**Symptom:**

```
Error: connect EACCES /var/run/docker.sock
```

**Solutions:**

1. **Check Docker is running:**

```bash
docker info
```

2. **Check socket permissions:**

```bash
ls -la /var/run/docker.sock
```

3. **Add user to docker group:**

```bash
sudo usermod -aG docker $USER

# Log out and log back in for changes to take effect
```

4. **Restart Docker service:**

```bash
sudo systemctl restart docker
# On macOS: Restart Docker Desktop
```

#### Issue: Docker not responding

**Symptom:**

```
Error: connect ETIMEDOUT /var/run/docker.sock
```

**Solutions:**

```bash
# Check Docker daemon status
sudo systemctl status docker

# Restart Docker daemon
sudo systemctl restart docker

# Check Docker logs
sudo journalctl -u docker -f
```

### Database Issues

#### Issue: Database locked

**Symptom:**

```
Error: SQLITE_BUSY: database is locked
```

**Solutions:**

1. **Check for other processes:**

```bash
lsof data/opencode.db
```

2. **Kill conflicting process (if safe):**

```bash
kill -9 <pid>
```

3. **Restart application (releases locks):**

```bash
# Locks auto-expire after timeout
# Restart application to release locks immediately
```

4. **Enable WAL mode (recommended):**

```bash
OPENCODE_DB_WAL=true npm start
```

#### Issue: Database corrupted

**Symptom:**

```
Error: SQLITE_CORRUPT: database disk image is malformed
```

**Solutions:**

1. **Backup and recreate:**

```bash
# Backup existing database
cp data/opencode.db data/opencode.db.backup

# Delete and recreate
rm data/opencode.db
npm start  # Database will be recreated
```

2. **Use SQLite integrity check:**

```bash
sqlite3 data/opencode.db "PRAGMA integrity_check;"
```

3. **Restore from backup:**

```bash
# Copy backup
cp data/opencode.db.backup data/opencode.db
```

### Lock Manager Issues

#### Issue: Lock timeout

**Symptom:**

```
Error: Lock acquisition failed after 3 attempts
```

**Solutions:**

1. **Check for stuck locks:**

```bash
npm run cli -- task-stats
# Look for long-running tasks
```

2. **Force cleanup (emergency):**

```typescript
const removed = lockManager.emergencyCleanup("agent-1");
console.log(`Removed ${removed} stuck locks`);
```

3. **Increase timeout:**

```typescript
await lockManager.acquireLockWithRetry(
  "task:123",
  "agent-1",
  "exclusive",
  3,
  120000, // 2 minute timeout
);
```

4. **Use collaborative mode:**

```typescript
await lockManager.acquireLockWithRetry(
  "task:123",
  "agent-1",
  "collaborative", // Multiple agents allowed
  10, // More retries
  60000, // Longer timeout
);
```

#### Issue: Deadlock

**Symptom:**

Multiple resources locked, system hangs.

**Solutions:**

1. **Emergency cleanup:**

```typescript
// Release all locks for an agent
const removed = lockManager.emergencyCleanup("agent-1");
```

2. **Use batch locks (sorted order prevents deadlocks):**

```typescript
const resources = ["task:1", "task:2", "task:3"];
await lockManager.acquireBatchLock(resources, "agent-1");
```

3. **Add lock timeout to all operations:**

```typescript
await lockManager.withLock(
  "task:123",
  "agent-1",
  async () => {
    // Critical section
  },
  "exclusive",
  30000, // 30 second timeout
);
```

### Hook Issues

#### Issue: Hook not executing

**Symptom:**

Hook registered but not executing.

**Solutions:**

1. **Check registration:**

```typescript
const hooks = taskLifecycleHooks.getAllHooks();
console.log("Registered hooks:", hooks);
```

2. **Verify hook doesn't throw silently:**

```typescript
taskLifecycleHooks.registerBeforeTaskStart(async (taskId, agentId) => {
  try {
    // Hook logic
  } catch (error) {
    logger.error("Hook failed", { taskId, agentId, error });
    throw error; // Propagate error (hook system continues but logs)
  }
});
```

3. **Check priority order:**

```typescript
// Lower priority = executes first
const hookId1 = taskLifecycleHooks.registerBeforeTaskStart(fn1, 5);
const hookId2 = taskLifecycleHooks.registerBeforeTaskStart(fn2, 10);
const hookId3 = taskLifecycleHooks.registerBeforeTaskStart(fn3, 15);
// Execution order: hookId3, hookId1, hookId2
```

#### Issue: Hook blocking lifecycle

**Symptom:**

Task lifecycle hangs when hook is registered.

**Solutions:**

1. **Add timeout to hooks:**

```typescript
taskLifecycleHooks.registerBeforeTaskStart(async (taskId, agentId) => {
  const timeout = setTimeout(() => {
    throw new Error("Hook timeout");
  }, 5000);

  try {
    // Hook logic
    clearTimeout(timeout);
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
});
```

2. **Use non-blocking operations:**

```typescript
// Bad: Blocking synchronous operation
taskLifecycleHooks.registerBeforeTaskStart(async (taskId) => {
  const result = heavyComputation(); // Blocks
});

// Good: Async non-blocking
taskLifecycleHooks.registerBeforeTaskStart(async (taskId) => {
  const result = await heavyComputationAsync(); // Non-blocking
});
```

### Checkpoint Issues

#### Issue: Checkpoint restoration failed

**Symptom:**

```
Error: Checkpoint restoration failed
```

**Solutions:**

1. **List available checkpoints:**

```bash
npm run cli -- restore-checkpoint --task task_123 --list
```

2. **Verify checkpoint exists:**

```typescript
const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
console.log("Available checkpoints:", checkpoints);
```

3. **Restore from earlier checkpoint:**

```bash
npm run cli -- restore-checkpoint --task task_123 \
  --checkpoint checkpoint_prev_abc123
```

4. **Manual recovery from logs:**

```typescript
const logs = await multiLayerPersistence.loadLogs(taskId, {
  limit: 100,
});
console.log("Recent activity:", logs);
```

#### Issue: Checkpoint too large

**Symptom:**

Checkpoints consuming excessive disk space.

**Solutions:**

1. **Clean up old checkpoints:**

```bash
# Delete checkpoints older than 7 days
find data/tasks/*/checkpoints -type d -mtime +7 -exec rm -rf {} \;
```

2. **Create checkpoints strategically:**

```typescript
// Good: Create checkpoints at milestones
await multiLayerPersistence.createCheckpoint(taskId, "Before deployment");

// Bad: Create checkpoints too frequently
for (let i = 0; i < 100; i++) {
  await multiLayerPersistence.createCheckpoint(taskId, `Step ${i}`);
}
```

3. **Use compression (future):**

Compress old checkpoints to save space.

### Task Issues

#### Issue: Task not found

**Symptom:**

```
Error: Task not found: task_123
```

**Solutions:**

1. **Verify task ID:**

```bash
npm run cli -- list-tasks | grep task_123
```

2. **Check task status (might be deleted):**

```bash
npm run cli -- task-history --task task_123
```

3. **Recreate if needed:**

```bash
npm run cli -- create-task "New Task" --task-id task_123
```

#### Issue: Task stuck in intermediate state

**Symptom:**

Task stuck in 'pending' or 'running' state.

**Solutions:**

1. **Check task history:**

```bash
npm run cli -- task-history --task task_123 --level error
```

2. **Check execution details:**

```bash
npm run cli -- task-executions --task task_123
```

3. **Resume from checkpoint:**

```bash
npm run cli -- resume-task --task task_123 \
  --agent recovery-agent \
  --checkpoint checkpoint_last_good
```

4. **Cancel and recreate (last resort):**

```bash
npm run cli -- cancel-task --task task_123
npm run cli -- create-task "New Task" --task-id task_123
```

### Performance Issues

#### Issue: Slow performance

**Symptom:**

System responding slowly.

**Solutions:**

1. **Check lock statistics:**

```bash
npm run cli -- task-stats
```

2. **Enable WAL mode for SQLite:**

```bash
OPENCODE_DB_WAL=true npm start
```

3. **Clean up old checkpoints:**

```bash
find data/tasks/*/checkpoints -type d -mtime +7 -exec rm -rf {} \;
```

4. **Batch operations:**

```typescript
// Bad: Individual inserts
for (const task of tasks) {
  await taskLifecycle.createTask(task);
}

// Good: Batch insert
await taskRegistry.bulkInsert(tasks);
```

5. **Use database indexes:**

```sql
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_owner ON tasks(owner);
CREATE INDEX idx_tasks_created ON tasks(created_at);
```

### Memory Issues

#### Issue: High memory usage

**Symptom:**

Process consuming excessive memory.

**Solutions:**

1. **Process logs in chunks:**

```typescript
// Bad: Load all logs into memory
const allLogs = await multiLayerPersistence.loadLogs(taskId);

// Good: Process in chunks
const CHUNK_SIZE = 1000;
for (let offset = 0; ; offset += CHUNK_SIZE) {
  const logs = await multiLayerPersistence.loadLogs(taskId, {
    limit: CHUNK_SIZE,
    offset,
  });

  if (logs.length === 0) break;

  processLogs(logs);
}
```

2. **Clean up old data:**

```bash
# Delete old checkpoints
find data/tasks/*/checkpoints -type d -mtime +30 -exec rm -rf {} \;

# Rotate logs
# Implement log rotation in application
```

3. **Monitor memory usage:**

```typescript
setInterval(() => {
  const memUsage = process.memoryUsage();
  logger.info("Memory usage", {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
  });
}, 60000); // Every minute
```

### Network Issues

#### Issue: MCP server unreachable

**Symptom:**

```
Error: connect ECONNREFUSED localhost:3000
```

**Solutions:**

1. **Check if server is running:**

```bash
ps aux | grep "node.*opencode"
```

2. **Check port is listening:**

```bash
lsof -i :3000
```

3. **Start server:**

```bash
npm start
```

4. **Check firewall settings:**

```bash
# Linux
sudo ufw allow 3000/tcp

# macOS
sudo pfctl -d  # Disable firewall temporarily
```

### Logging Issues

#### Issue: Too many logs

**Symptom:**

Log files growing excessively.

**Solutions:**

1. **Set up log rotation:**

```typescript
import { createWriteStream } from "fs";
import { rotate } from "logrotate";

// Rotate logs daily
rotate("logs/app.log", {
  count: 7, // Keep 7 days
  size: "100M", // Rotate at 100MB
  compress: true, // Compress old logs
});
```

2. **Filter logs by level:**

```bash
# Only view error logs
npm run cli -- task-history --task task_123 --level error
```

3. **Use log aggregation (production):**

- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- DataDog

### TypeScript Errors

#### Issue: Type errors

**Symptom:**

```
Error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
```

**Solutions:**

1. **Run type checker:**

```bash
npm run type-check
```

2. **Fix type errors:**

```typescript
// Bad: Suppress error
const task = getTask() as any;

// Good: Fix types
const task: Task = getTask();
```

3. **Use type assertions carefully:**

```typescript
// Good: Use type guards
function isTask(value: unknown): value is Task {
  return typeof value === "object" && value !== null && "id" in value;
}

if (isTask(unknownValue)) {
  // TypeScript knows it's a Task here
}
```

### Testing Issues

#### Issue: Tests failing

**Symptom:**

Tests failing after changes.

**Solutions:**

1. **Run specific test:**

```bash
npm test -- path/to/test.test.ts
```

2. **Run tests in watch mode:**

```bash
npm run test:watch
```

3. **Debug failing test:**

```typescript
it("should do something", async () => {
  const result = await doSomething();
  console.log("Result:", result); // Debug output
  expect(result).toBeDefined();
});
```

4. **Clear test cache:**

```bash
# Delete cache files
rm -rf .cache dist

# Rebuild
npm run build
npm test
```

## Getting Help

### Check Logs

```bash
# View application logs
npm run cli -- task-history --task task_123

# View MCP server logs
journalctl -u opencode -f

# View Docker logs
docker logs <container-id>
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm start
```

### Report Issues

1. **Check existing issues:** GitHub Issues
2. **Search documentation:** Wiki pages
3. **Create new issue:** GitHub Issues with:
   - Error message
   - Steps to reproduce
   - System information (Node.js version, OS)
   - Logs

---

**Last Updated**: 2026-02-19
**Version**: 0.1.0-alpha
