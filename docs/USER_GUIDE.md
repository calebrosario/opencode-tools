# OpenCode Tools User Guide

Complete guide for using OpenCode Tools for task management and multi-agent orchestration.

## Table of Contents

- [Getting Started](#getting-started)
- [Tutorial: Your First Task](#tutorial-your-first-task)
- [Tutorial: Multi-Agent Collaboration](#tutorial-multi-agent-collaboration)
- [Tutorial: Checkpoints and Recovery](#tutorial-checkpoints-and-recovery)
- [Tutorial: Working with CLI Commands](#tutorial-working-with-cli-commands)
- [Best Practices](#best-practices)
- [Advanced Patterns](#advanced-patterns)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Getting Started

### Prerequisites

Before using OpenCode Tools, ensure you have:

1. **Node.js 20+** installed
2. **Docker** installed and running
3. **Access to task management system**

### Installation

```bash
# Clone the repository
git clone https://github.com/calebrosario/opencode-tools.git
cd opencode-tools

# Install dependencies
npm install

# Build the project
npm run build
```

### Quick Verification

```bash
# Start the MCP server
npm start

# In another terminal, verify it's running
curl http://localhost:3000/health
```

---

## Tutorial: Your First Task

This tutorial walks you through creating and managing your first task.

### Step 1: Create a Task

**Using MCP API:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_task_sandbox",
    "arguments": {
      "name": "My First Task",
      "owner": "my-agent",
      "metadata": {
        "priority": "high",
        "project": "tutorial"
      }
    }
  }
}
```

**Using CLI:**

```bash
npm run cli -- create-task "My First Task" --owner my-agent
```

**Expected Response:**

```json
{
  "success": true,
  "taskId": "task_1234567890",
  "status": "pending",
  "createdAt": "2026-01-31T12:00:00.000Z"
}
```

### Step 2: Start the Task

**Using MCP API:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "attach_agent_to_task",
    "arguments": {
      "taskId": "task_1234567890",
      "agentId": "my-agent"
    }
  }
}
```

**Using CLI:**

```bash
npm run cli -- attach-agent --agent my-agent --task task_1234567890
```

**Expected Response:**

```json
{
  "success": true,
  "taskId": "task_1234567890",
  "agentId": "my-agent",
  "attached": true
}
```

### Step 3: Check Task Status

```bash
npm run cli -- list-tasks --task task_1234567890
```

### Step 4: Complete the Task

```bash
npm run cli -- complete-task --task task_1234567890 \
  --result '{"success": true, "data": {"output": "Completed"}}'
```

### Step 5: View Task History

```bash
npm run cli -- task-history --task task_1234567890 --level info
```

---

## Tutorial: Multi-Agent Collaboration

This tutorial shows how multiple agents can work together on a task.

### Scenario: Three-Agent Data Pipeline

1. **Agent 1 (Data Collector)**: Collects raw data
2. **Agent 2 (Data Processor)**: Processes the data
3. **Agent 3 (Data Analyzer)**: Analyzes results

### Step 1: Create Collaborative Task

```bash
npm run cli -- create-task "Data Pipeline" \
  --owner agent-1 \
  --metadata '{"collaborative": true, "agents": ["agent-1", "agent-2", "agent-3"]}'
```

### Step 2: Agent 1 Starts and Collects Data

```bash
# Agent 1 starts task in collaborative mode
npm run cli -- attach-agent --agent agent-1 --task task_pipeline_1

# Agent 1 completes data collection
npm run cli -- complete-task --task task_pipeline_1 \
  --result '{"success": true, "data": {"collected": 1000}}'
```

### Step 3: Agent 2 Joins and Processes Data

```bash
# Agent 2 joins collaborative mode
npm run cli -- attach-agent --agent agent-2 --task task_pipeline_1

# Agent 2 processes the data
npm run cli -- complete-task --task task_pipeline_1 \
  --result '{"success": true, "data": {"processed": 900}}'
```

### Step 4: Agent 3 Joins and Analyzes

```bash
# Agent 3 joins collaborative mode
npm run cli -- attach-agent --agent agent-3 --task task_pipeline_1

# Agent 3 performs analysis
npm run cli -- complete-task --task task_pipeline_1 \
  --result '{"success": true, "data": {"analyzed": 850, "insights": ["insight-1", "insight-2"]}}'
```

### Step 5: View All Agent Decisions

```bash
npm run cli -- task-decisions --task task_pipeline_1
```

**Expected Output:**
```markdown
## 2026-01-31T12:05:00.000Z
**Agent**: agent-1
**Decision**: Collect data from source API

## 2026-01-31T12:10:00.000Z
**Agent**: agent-2
**Decision**: Process collected data with validation rules

## 2026-01-31T12:15:00.000Z
**Agent**: agent-3
**Decision**: Generate analysis report and insights
```

---

## Tutorial: Checkpoints and Recovery

This tutorial demonstrates creating and restoring task checkpoints.

### Step 1: Create Task with Progress Tracking

```bash
npm run cli -- create-task "Long Running Task" \
  --owner worker-agent \
  --metadata '{"total_steps": 10, "current_step": 0}'
```

### Step 2: Start Task and Work on Step 1

```bash
npm run cli -- attach-agent --agent worker-agent --task task_long_1

# Agent completes step 1
npm run cli -- complete-task --task task_long_1 \
  --result '{"success": true, "data": {"step": 1, "status": "complete"}}'
```

### Step 3: Create Checkpoint Before Step 2

```bash
npm run cli -- checkpoint --task task_long_1 \
  --description "Checkpoint after completing step 1 of 10"
```

### Step 4: Work Through Steps 2-5

```bash
# Agent works on steps 2-5...

# Create another checkpoint after step 5
npm run cli -- checkpoint --task task_long_1 \
  --description "Checkpoint after completing step 5 of 10"
```

### Step 5: Simulate Failure and Restore

```bash
# Task fails on step 7
npm run cli -- complete-task --task task_long_1 \
  --result '{"success": false, "error": "System error on step 7"}'

# Restore from last good checkpoint
npm run cli -- restore-checkpoint --task task_long_1 \
  --checkpoint checkpoint_last_good
```

### Step 6: List All Checkpoints

```bash
npm run cli -- task-history --task task_long_1

# Or use the list-checkpoints command (when implemented)
```

---

## Tutorial: Working with CLI Commands

This tutorial covers all 13 CLI commands.

### Task Management Commands

#### 1. create-task

```bash
# Basic usage
npm run cli -- create-task "Task Name"

# With owner
npm run cli -- create-task "Task Name" --owner agent-1

# With metadata
npm run cli -- create-task "Task Name" \
  --owner agent-1 \
  --metadata '{"priority": "high", "project": "alpha"}'

# With custom task ID
npm run cli -- create-task "Task Name" \
  --task-id custom_task_123
```

#### 2. resume-task

```bash
# Basic resume
npm run cli -- resume-task --task task_123 --agent agent-1

# Resume from checkpoint
npm run cli -- resume-task --task task_123 \
  --agent agent-1 \
  --checkpoint checkpoint_abc123
```

#### 3. list-tasks

```bash
# List all tasks
npm run cli -- list-tasks

# Filter by status
npm run cli -- list-tasks --status running

# Filter by owner
npm run cli -- list-tasks --owner agent-1

# Pagination
npm run cli -- list-tasks --limit 10 --offset 0

# Verbose output
npm run cli -- list-tasks --status completed --verbose
```

#### 4. detach

```bash
# Detach agent from task
npm run cli -- detach --agent agent-1 --task task_123
```

#### 5. complete-task

```bash
# Complete with simple result
npm run cli -- complete-task --task task_123 \
  --result '{"success": true}'

# Complete with data
npm run cli -- complete-task --task task_123 \
  --result '{"success": true, "data": {"output": "1234"}}'

# Complete with message
npm run cli -- complete-task --task task_123 \
  --result '{"success": true, "message": "Task completed successfully"}'
```

#### 6. cleanup-task

```bash
# Cleanup task (prompts for confirmation)
npm run cli -- cleanup-task --task task_123

# Force cleanup (no confirmation)
npm run cli -- cleanup-task --task task_123 --force
```

### Checkpoint Commands

#### 7. checkpoint

```bash
# Basic checkpoint
npm run cli -- checkpoint --task task_123

# With description
npm run cli -- checkpoint --task task_123 \
  --description "Checkpoint before deployment"
```

#### 8. restore-checkpoint

```bash
# List available checkpoints
npm run cli -- restore-checkpoint --task task_123 --list

# Restore specific checkpoint
npm run cli -- restore-checkpoint --task task_123 \
  --checkpoint checkpoint_abc123
```

### Memory Commands

#### 9. task-history

```bash
# View all history
npm run cli -- task-history --task task_123

# Filter by log level
npm run cli -- task-history --task task_123 --level info

# Limit entries
npm run cli -- task-history --task task_123 --limit 50

# Date range
npm run cli -- task-history --task task_123 \
  --start "2026-01-01" \
  --end "2026-01-31"
```

#### 10. task-executions

```bash
# View execution details
npm run cli -- task-executions --task task_123
```

#### 11. task-decisions

```bash
# View all decisions
npm run cli -- task-decisions --task task_123

# Filter by agent
npm run cli -- task-decisions --task task_123 --agent agent-1

# Limit decisions
npm run cli -- task-decisions --task task_123 --limit 20
```

#### 12. find-task

```bash
# Find by name pattern
npm run cli -- find-task --name "data.*task"

# Find by status
npm run cli -- find-task --status running

# Find by owner
npm run cli -- find-task --owner agent-1

# Find by metadata
npm run cli -- find-task \
  --metadata '{"project": "alpha", "priority": "high"}'
```

#### 13. task-stats

```bash
# View overall statistics
npm run cli -- task-stats

# Shows:
# - Status distribution
# - Owner distribution
# - Recent tasks (5 most recent)
```

---

## Best Practices

### 1. Task Naming Conventions

Use descriptive, searchable task names:

**Good:**
- "Extract customer data from API v2"
- "Process 10K records with validation"
- "Generate monthly sales report"

**Bad:**
- "Task 1"
- "Do work"
- "Fix bug"

### 2. Metadata Structure

Organize metadata consistently:

```json
{
  "priority": "high",
  "estimatedDuration": "2h",
  "dependencies": ["task_123", "task_456"],
  "tags": ["data", "processing", "validation"],
  "source": "customer_api_v2",
  "deadline": "2026-02-15T23:59:59Z"
}
```

### 3. Checkpoint Strategy

Create checkpoints at strategic points:

**When to Create Checkpoints:**
- Before risky operations (migrations, data transformations)
- After completing major milestones
- Before external API calls
- When task will be paused for extended period

**Checkpoint Naming:**
- Use descriptive names: "Before database migration"
- Include step numbers: "Checkpoint step 3/10"
- Note completion status: "Checkpoint - 50% complete"

### 4. Error Handling

**For MCP Clients:**
```javascript
try {
  const result = await mcpClient.callTool('create_task_sandbox', params);
  if (!result.success) {
    // Handle specific error codes
    switch (result.error.code) {
      case 'TASK_CREATE_FAILED':
        // Retry with different parameters
        break;
      case 'REGISTRY_NOT_INITIALIZED':
        // Initialize and retry
        break;
      default:
        // Log and report
        break;
    }
  }
} catch (error) {
  // Handle network errors, timeouts
}
```

**For CLI Usage:**
```bash
# Check command exit codes
npm run cli -- create-task "Task" || echo "Task creation failed: $?"
```

### 5. Concurrency Control

**Exclusive Mode (Single Agent):**
- Use when task requires consistency
- Prevents race conditions
- Simpler locking semantics

**Collaborative Mode (Multiple Agents):**
- Use when agents work on independent parts
- Allows parallel work
- Requires conflict resolution strategy

```typescript
// Exclusive mode
await lockManager.acquireLockWithRetry('task:123', 'agent-1', 'exclusive');

// Collaborative mode
await lockManager.acquireLockWithRetry('task:123', 'agent-1', 'collaborative', 10);
```

### 6. Resource Management

**Memory:**
- Use checkpoints for long-running tasks
- Clean up old checkpoints regularly
- Monitor memory usage with `task-stats`

**Database:**
- Enable WAL mode for SQLite
- Use batch operations when possible
- Regular vacuum of old data

**Disk Space:**
- Set rotation policies for logs
- Archive old checkpoints
- Monitor disk usage

### 7. Logging Practices

**Log Levels:**
- `info`: Normal operations, state transitions
- `warn`: Recoverable issues, warnings
- `error`: Failures requiring intervention
- `debug`: Detailed diagnostic info

**Log Content:**
```json
{
  "timestamp": "2026-01-31T12:00:00.000Z",
  "level": "info",
  "message": "Task started",
  "data": {
    "taskId": "task_123",
    "agentId": "agent-1",
    "fromStatus": "pending",
    "toStatus": "running"
  }
}
```

---

## Advanced Patterns

### Pattern 1: Task Templates

Create reusable task templates:

```typescript
interface TaskTemplate {
  name: string;
  config: TaskConfig;
  hooks: HookRegistration[];
}

const dataProcessingTemplate: TaskTemplate = {
  name: 'Data Processing Template',
  config: {
    name: 'Data Processing Task',
    metadata: {
      type: 'data_processing',
      priority: 'medium'
    }
  },
  hooks: [
    { type: 'beforeTaskStart', fn: validateInputs },
    { type: 'afterTaskComplete', fn: generateReport }
  ]
};
```

### Pattern 2: Retry with Backoff

```typescript
async function executeWithRetry(
  taskId: string,
  maxRetries: number = 3
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeTask(taskId);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Pattern 3: Chained Tasks

```typescript
async function executeTaskChain(
  tasks: TaskConfig[]
): Promise<void> {
  for (const taskConfig of tasks) {
    const task = await taskLifecycle.createTask(taskConfig);
    await taskLifecycle.startTask(task.id, 'workflow-agent');
    
    const result = await processTask(task);
    await taskLifecycle.completeTask(task.id, result);
    
    // Pass data to next task
    taskConfig.metadata = {
      ...taskConfig.metadata,
      previousTask: task.id,
      previousResult: result
    };
  }
}
```

### Pattern 4: Parallel Task Execution

```typescript
async function executeParallelTasks(
  tasks: TaskConfig[],
  maxConcurrency: number = 3
): Promise<void> {
  // Process in batches
  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    const batch = tasks.slice(i, i + maxConcurrency);
    await Promise.all(
      batch.map(config => 
        taskLifecycle.createTask(config)
          .then(task => 
            taskLifecycle.startTask(task.id, config.owner)
          )
      )
    );
  }
}
```

### Pattern 5: Hook Composition

```typescript
// Create composite hooks
function createValidationHook(requiredFields: string[]) {
  return {
    type: 'beforeTaskStart',
    fn: async (taskId, agentId) => {
      const task = await taskRegistry.getById(taskId);
      const metadata = task?.metadata || {};
      
      for (const field of requiredFields) {
        if (!metadata[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
  };
}

function createLoggingHook(context: string) {
  return {
    type: 'afterTaskStart',
    fn: async (taskId, agentId) => {
      logger.info('Task started', { taskId, agentId, context });
    }
  };
}

// Register composite hooks
taskLifecycleHooks.registerBeforeTaskStart(
  createValidationHook(['dataset', 'model']).fn
);

taskLifecycleHooks.registerAfterTaskStart(
  createLoggingHook('data_pipeline').fn
);
```

---

## Troubleshooting

### Issue: Task Not Found

**Symptom:**
```
Error: Task not found: task_123
```

**Solutions:**

1. Verify task ID:
```bash
npm run cli -- list-tasks | grep task_123
```

2. Check task status (might be deleted):
```bash
npm run cli -- task-history --task task_123
```

3. Recreate if needed:
```bash
npm run cli -- create-task "New Task" --task-id task_123
```

### Issue: Lock Timeout

**Symptom:**
```
Error: Lock acquisition failed after 3 attempts
```

**Solutions:**

1. Check for stuck locks:
```bash
npm run cli -- task-stats
# Look for long-running tasks
```

2. Force cleanup (emergency):
```typescript
const removed = lockManager.emergencyCleanup('agent-1');
console.log(`Removed ${removed} stuck locks`);
```

3. Increase timeout:
```typescript
await lockManager.acquireLockWithRetry(
  'task:123',
  'agent-1',
  'exclusive',
  3,
  120000 // 2 minute timeout
);
```

### Issue: Database Locked

**Symptom:**
```
Error: SQLITE_BUSY: database is locked
```

**Solutions:**

1. Check for other processes:
```bash
lsof data/opencode.db
```

2. Ensure WAL mode is enabled:
```bash
OPENCODE_DB_WAL=true npm start
```

3. Increase busy timeout:
```typescript
const db = new Database(path, { 
  fileMustExist: false,
  timeout: 30000 // 30 second timeout
});
```

### Issue: Hook Not Executing

**Symptom:**
Hook registered but not executing.

**Solutions:**

1. Check registration:
```typescript
const hooks = taskLifecycleHooks.getAllHooks();
console.log('Registered hooks:', hooks);
```

2. Verify hook doesn't throw silently:
```typescript
taskLifecycleHooks.registerBeforeTaskStart(async (taskId, agentId) => {
  try {
    // Hook logic
  } catch (error) {
    logger.error('Hook failed', { taskId, agentId, error });
    throw error; // Propagate error (hook system continues but logs)
  }
});
```

3. Check priority order:
```typescript
// Lower priority = executes first
const hookId1 = taskLifecycleHooks.registerBeforeTaskStart(fn1, 5);
const hookId2 = taskLifecycleHooks.registerBeforeTaskStart(fn2, 10);
const hookId3 = taskLifecycleHooks.registerBeforeTaskStart(fn3, 15);
// Execution order: hookId3, hookId1, hookId2
```

### Issue: Checkpoint Restoration Failed

**Symptom:**
```
Error: Checkpoint restoration failed
```

**Solutions:**

1. List available checkpoints:
```bash
npm run cli -- restore-checkpoint --task task_123 --list
```

2. Verify checkpoint exists:
```typescript
const checkpoints = await multiLayerPersistence.listCheckpoints(taskId);
console.log('Available checkpoints:', checkpoints);
```

3. Restore from earlier checkpoint:
```bash
npm run cli -- restore-checkpoint --task task_123 \
  --checkpoint checkpoint_prev_abc123
```

4. Manual recovery from logs:
```typescript
const logs = await multiLayerPersistence.loadLogs(taskId, {
  limit: 100
});
console.log('Recent activity:', logs);
```

---

## FAQ

### Q: Can multiple agents work on the same task?

**A:** Yes! Use **collaborative mode** for the lock:

```typescript
await lockManager.acquireLockWithRetry('task:123', 'agent-1', 'collaborative');
```

However, you must implement conflict resolution logic.

### Q: How do I undo a task completion?

**A:** You can't directly "undo" but you can:

1. Restore from a pre-completion checkpoint
2. Create a new task with the same configuration
3. Modify task metadata to track undo history

### Q: What happens if a task fails?

**A:** The task status changes to 'failed' and:
- Error is logged to `logs.jsonl`
- Error is stored in task metadata
- `afterTaskFail` hooks are executed
- Agent is detached

### Q: Can I cancel a running task?

**A:** Yes, use the cancel operation:

```bash
npm run cli -- cancel-task --task task_123
```

This transitions the task from 'running' to 'cancelled'.

### Q: How do I monitor task progress?

**A:** Multiple approaches:

1. **Check task status:**
```bash
npm run cli -- list-tasks --task task_123
```

2. **View execution history:**
```bash
npm run cli -- task-history --task task_123 --level info
```

3. **View agent decisions:**
```bash
npm run cli -- task-decisions --task task_123
```

4. **Use hooks for real-time monitoring:**
```typescript
taskLifecycleHooks.registerAfterTaskStart(async (taskId, agentId) => {
  sendMonitoringEvent({ event: 'task_started', taskId, agentId });
});
```

### Q: What is the maximum number of tasks I can create?

**A:** Technically unlimited, but consider:

1. **Database limits**: SQLite handles 100K+ tasks efficiently
2. **Memory limits**: Keep active tasks < 1000 for optimal performance
3. **Disk space**: Old checkpoints and logs accumulate over time

### Q: Can I delete a task in progress?

**A:** Yes, but it's not recommended. The system will:
1. Cancel the task if running
2. Delete all persistence layers
3. Release any held locks
4. Execute cleanup hooks

### Q: How do I recover from a corrupted task state?

**A:** The system provides automatic recovery:

1. **Checksum validation** detects corruption
2. **Automatic recovery** attempts:
   - Restore from JSONL logs
   - Use last known good state
   - Reconstruct from operation logs
3. **Manual recovery**: Restore from checkpoint

### Q: Can I export task data?

**A:** Yes, through multiple channels:

1. **Task registry**:
```bash
npm run cli -- list-tasks > tasks_export.json
```

2. **Task history**:
```bash
npm run cli -- task-history --task task_123 > task_123_history.jsonl
```

3. **Agent decisions**:
```bash
npm run cli -- task-decisions --task task_123 > task_123_decisions.md
```

### Q: How do I migrate tasks from one system to another?

**A:** Migration strategy:

1. **Export from source:**
```bash
npm run cli -- list-tasks --limit 10000 > export.json
```

2. **Import to target:**
```typescript
import { readFileSync } from 'fs';

const tasks = JSON.parse(readFileSync('export.json', 'utf8'));

for (const task of tasks) {
  await taskLifecycle.createTask(task.config);
}
```

3. **Verify integrity:**
```bash
npm run cli -- task-stats
# Compare counts between systems
```

---

## Performance Tips

### 1. Batch Operations

```typescript
// Bad: Individual inserts
for (const task of tasks) {
  await taskLifecycle.createTask(task);
}

// Good: Batch insert
await taskRegistry.bulkInsert(tasks);
```

### 2. Index Optimization

For large datasets, create database indexes:

```sql
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_owner ON tasks(owner);
CREATE INDEX idx_tasks_created ON tasks(created_at);
```

### 3. Connection Pooling

```typescript
import { Database } from 'better-sqlite3';

const db = new Database(path, {
  fileMustExist: false,
  verbose: process.env.DEBUG === 'true',
  connectionPool: {
    maxSize: 10,
    idleTimeout: 60000
  }
});
```

### 4. Memory Management

```typescript
// Process logs in chunks instead of loading all
const CHUNK_SIZE = 1000;
for (let offset = 0; ; offset += CHUNK_SIZE) {
  const logs = await multiLayerPersistence.loadLogs(taskId, {
    limit: CHUNK_SIZE,
    offset
  });
  
  if (logs.length === 0) break;
  
  processLogs(logs);
}
```

---

## Security Considerations

### 1. Agent Authentication

Implement agent authentication:

```typescript
function authenticateAgent(agentId: string, apiKey: string): boolean {
  // Verify agent credentials
  const agent = await agentRegistry.getAgent(agentId);
  return agent && agent.apiKey === apiKey;
}
```

### 2. Task Access Control

Restrict task access:

```typescript
async function canAccessTask(taskId: string, agentId: string): Promise<boolean> {
  const task = await taskRegistry.getById(taskId);
  
  // Owner can access
  if (task.owner === agentId) return true;
  
  // Check collaborative mode
  const collaborators = task.metadata?.collaborators || [];
  return collaborators.includes(agentId);
}
```

### 3. Input Validation

Always validate inputs:

```typescript
import { z } from 'zod';

const TaskConfigSchema = z.object({
  name: z.string().min(1).max(255),
  owner: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

function validateTaskConfig(config: any): TaskConfig {
  return TaskConfigSchema.parse(config);
}
```

### 4. Secret Management

Never log sensitive data:

```typescript
// Bad
logger.info('Task created', { 
  taskId,
  apiKey: user.apiKey // SECURITY ISSUE!
});

// Good
logger.info('Task created', { 
  taskId,
  apiKey: '***' + user.apiKey.slice(-4) // Last 4 chars only
});
```

---

## Next Steps

After completing these tutorials, explore:

1. **[README.md](./README.md)** - Project overview
2. **[API.md](./API.md)** - Complete API reference
3. **Integration Tests** - See `tests/integration/`
4. **Advanced Hooks** - Explore custom hook implementations

---

**Last Updated**: 2026-01-31
**Version**: 0.1.0-alpha
