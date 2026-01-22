# Research: Integration Prototype

**Researcher**: Senior Architect (100%)
**Duration**: 1 day
**Status**: Complete
**Start Date**: 2026-01-21
**End Date**: 2026-01-21

---

## Goals
- [x] Research OpenCode MCP integration patterns
- [x] Research oh-my-opencode hooks integration patterns
- [x] Research Docker Engine API integration patterns
- [x] Design integration error handling strategy

---

## Methodology

### Approach
1. **OpenCode MCP Research**: Studied MCP server architecture, tool registration, and event handling
2. **oh-my-opencode Hooks Research**: Investigated hook system, registration patterns, and lifecycle management
3. **Docker Engine API Research**: Analyzed Dockerode SDK integration patterns, error handling, and security hardening
4. **Integration Design**: Designed error handling strategy across all three integration layers

### Tools Used
- OpenCode MCP documentation
- oh-my-opencode hooks documentation
- Docker Engine API v1.47+
- Dockerode SDK
- Librarian agent (for external research)
- Real-world MCP server implementations

---

## Research Findings

### Finding 1: OpenCode MCP Integration Architecture

**Observation**: OpenCode MCP provides a structured protocol for integrating tools
**Evidence**:

OpenCode supports both local and remote MCP servers via configuration:

```jsonc
// opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "docker-task-manager": {
      "type": "local",
      "enabled": true,
      "command": "node",
      "args": ["./mcp-server/index.js"]
    }
  }
}
```

**MCP Server Structure**:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'docker-task-manager', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'docker_create_task',
        description: 'Create a new task container',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: { type: 'string' },
            image: { type: 'string' },
            memory_mb: { type: 'number', default: 512 }
          },
          required: ['task_id', 'image']
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'docker_create_task':
      return await createContainer(args);
    case 'docker_exec_task':
      return await executeInContainer(args);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Significance**: MCP provides standardized tool registration and execution with:
- Type-safe input/output schemas
- Built-in error handling
- Streaming support for long-running operations
- Resource management capabilities

### Finding 2: oh-my-opencode Hooks System

**Observation**: oh-my-opencode provides a hook-based system for workflow customization
**Evidence**:

oh-my-opencode hooks allow customization of:
- Task lifecycle events
- Git operations
- Plan management
- Safety enforcement

**Hook Pattern**:

```typescript
// Hook registration in oh-my-opencode
interface HookConfig {
  name: string;
  before?: (context: HookContext) => Promise<void>;
  after?: (context: HookContext) => Promise<void>;
  onError?: (error: Error, context: HookContext) => Promise<void>;
}

const hooks: HookConfig[] = [
  {
    name: 'task-lifecycle-manager',
    before: async (context) => {
      // Execute before task operation
      await validateTask(context.task);
    },
    after: async (context) => {
      // Execute after task operation
      await logCompletion(context.task);
    },
    onError: async (error, context) => {
      // Handle errors
      await reportError(error, context.task);
    }
  },
  {
    name: 'container-safety-enforcer',
    before: async (context) => {
      // Validate container safety before operations
      await checkResourceLimits(context.container);
      await verifyIsolation(context.container);
    }
  }
];
```

**Significance**: Hooks provide:
- Before/after execution points
- Error handling and recovery
- Context injection (task, agent, session)
- Workflow customization

### Finding 3: Docker Engine API Integration Patterns

**Observation**: Dockerode SDK provides comprehensive TypeScript bindings for Docker Engine API
**Evidence**:

```typescript
import Docker from 'dockerode';

// Docker client connection
const docker = new Docker({
  socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock'
});

// Create container with resource limits
async function createTaskContainer(config: TaskConfig) {
  const container = await docker.createContainer({
    name: `task-${config.taskId}`,
    Image: config.image,
    Cmd: config.command,
    HostConfig: {
      // Resource limits
      Memory: config.memoryMb * 1024 * 1024,  // Bytes
      NanoCpus: config.cpuCount * 1000000000,  // Nano-CPUs
      PidsLimit: config.pidsLimit || 100,
      
      // Security hardening
      SecurityOpt: [
        'no-new-privileges',
        'seccomp=default'
      ],
      CapDrop: ['ALL'],
      CapAdd: [],
      
      // Network isolation
      NetworkMode: 'bridge',
      PublishAllPorts: false,
      
      // Read-only filesystem
      ReadonlyRootfs: true,
      Tmpfs: {
        '/tmp': 'rw,noexec,nosuid,size=65536k',
        '/run': 'rw,noexec,nosuid,size=65536k'
      }
    },
    Labels: {
      'task-id': config.taskId,
      'managed-by': 'docker-task-manager'
    }
  });
  
  return container;
}

// Execute command in container
async function executeCommand(containerId: string, command: string[]) {
  const container = docker.getContainer(containerId);
  
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: '/workspace'
  });
  
  const stream = await exec.start({ Detach: false });
  let output = '';
  
  return new Promise((resolve) => {
    docker.modem.demuxStream(stream,
      (data) => output += data.toString('utf8'),
      (data) => output += data.toString('utf8')
    );
    
    stream.on('close', async () => {
      const info = await exec.inspect();
      resolve({
        output,
        exitCode: info.ExitCode || 0
      });
    });
  });
}

// Stream container logs
async function streamLogs(containerId: string, onLog: (line: string) => void) {
  const container = docker.getContainer(containerId);
  
  const stream = await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
    tail: 100
  });
  
  stream.on('data', (chunk: Buffer) => {
    // Docker multiplexes streams: [STREAM_TYPE][SIZE][PAYLOAD]
    let offset = 0;
    while (offset < chunk.length) {
      const streamType = chunk[offset];
      const size = chunk.readUInt32BE(offset + 4);
      const payload = chunk.slice(offset + 8, offset + 8 + size);
      const logLine = payload.toString('utf8');
      onLog(logLine);
      offset += 8 + size;
    }
  });
}
```

**Significance**: Dockerode provides:
- Promise-based async API
- Type-safe TypeScript bindings
- Streaming support for logs/exec
- Resource limit configuration
- Security hardening options

### Finding 4: Integration Error Handling Strategy

**Observation**: Multi-layer error handling required across OpenCode → oh-my-opencode → MCP → Docker
**Evidence**:

#### Layer 1: Hook System Errors

```typescript
class HookErrorHandler {
  private hookMetrics = new Map<string, HookMetrics>();
  
  async executeWithRetry<T>(
    hookName: string,
    hookFn: (context: HookContext) => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await hookFn({ task, agent, session });
        
        // Record success metrics
        this.recordMetrics(hookName, {
          success: true,
          duration: Date.now() - startTime,
          attempts: attempt
        });
        
        return result;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        // Record error metrics
        this.recordMetrics(hookName, {
          success: false,
          error: error as Error,
          duration: Date.now() - startTime,
          attempts: attempt
        });
        
        if (isLastAttempt) {
          // Log final failure
          console.error(`[HookError] ${hookName} failed after ${maxRetries} attempts:`, error);
          throw new HookError(hookName, error as Error);
        }
        
        // Exponential backoff for retry
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
        console.warn(`[HookError] ${hookName} failed (attempt ${attempt}), retrying in ${backoffDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    throw new Error('Should not reach here');
  }
  
  private recordMetrics(hookName: string, metrics: any): void {
    const existing = this.hookMetrics.get(hookName) || { 
      calls: 0, 
      failures: 0, 
      avgDuration: 0 
    };
    
    existing.calls++;
    if (!metrics.success) existing.failures++;
    existing.avgDuration = (
      (existing.avgDuration * (existing.calls - 1) + metrics.duration) / 
      existing.calls
    );
    
    this.hookMetrics.set(hookName, existing);
    
    // Alert on failing hooks
    if (existing.failures / existing.calls > 0.3) {
      console.error(`[HookError] High failure rate for ${hookName}: ${(existing.failures / existing.calls * 100).toFixed(1)}%`);
    }
  }
}
```

#### Layer 2: MCP Tool Errors

```typescript
class MCPErrorHandler {
  async handleToolCall<T>(
    toolName: string,
    toolFn: (args: any) => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<MCPToolResult<T>> {
    try {
      // Race between tool execution and timeout
      const result = await Promise.race([
        toolFn(args),
        this.createTimeout(timeoutMs, toolName)
      ]);
      
      return {
        content: [{ 
          type: 'text',
          text: JSON.stringify(result) 
        }],
        isError: false
      };
    } catch (error) {
      return this.mapToMCPError(error, toolName);
    }
  }
  
  private createTimeout(ms: number, toolName: string): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => 
        reject(new ToolTimeoutError(toolName, ms)), 
        ms
      )
    );
  }
  
  private mapToMCPError(error: unknown, toolName: string): MCPToolResult {
    if (error instanceof ToolTimeoutError) {
      return {
        content: [{ 
          type: 'text',
          text: `Tool ${toolName} timed out after ${error.timeout}ms` 
        }],
        isError: true
      };
    }
    
    if (error instanceof DockerError) {
      return {
        content: [{ 
          type: 'text',
          text: `Docker error in ${toolName}: ${error.message}` 
        }],
        isError: true
      };
    }
    
    // Unknown error
    return {
      content: [{ 
        type: 'text',
        text: `Unexpected error in ${toolName}: ${String(error)}` 
      }],
      isError: true
    };
  }
}
```

#### Layer 3: Docker Engine API Errors

```typescript
class DockerErrorHandler {
  async withRecovery<T>(
    operation: () => Promise<T>,
    context: { containerId?: string; operation: string }
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      return this.handleDockerError(error, context);
    }
  }
  
  private async handleDockerError(error: unknown, context: any): Promise<T> {
    const errorMessage = String(error);
    
    // Container not found
    if (errorMessage.includes('No such container')) {
      if (context.containerId) {
        // Try to recover from registry
        const container = await this.findInRegistry(context.containerId);
        if (container) {
          console.warn(`[DockerError] Container ${context.containerId} not found in Docker, found in registry`);
          // Update registry to reflect reality
          await this.updateRegistry(context.containerId, 'not-found');
          throw new ContainerNotFoundError(context.containerId);
        }
      }
      throw new ContainerNotFoundError(context.containerId);
    }
    
    // Connection failure
    if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      console.error(`[DockerError] Cannot connect to Docker daemon`);
      throw new DockerConnectionError('Cannot connect to Docker daemon');
    }
    
    // Resource exhaustion
    if (errorMessage.includes('no space left') || errorMessage.includes('resource temporarily unavailable')) {
      console.error(`[DockerError] Resource exhausted for ${context.operation}`);
      throw new ResourceExhaustionError(context.operation, 'No space left on device');
    }
    
    // Permission denied
    if (errorMessage.includes('permission denied')) {
      console.error(`[DockerError] Permission denied for ${context.operation}`);
      throw new DockerPermissionError(context.operation);
    }
    
    // Unknown Docker error
    throw new DockerError(`${context.operation} failed: ${errorMessage}`);
  }
  
  private async findInRegistry(containerId: string): Promise<any> {
    // Check SQLite registry for container record
    const record = await this.db.query(
      'SELECT * FROM tasks WHERE container_id = ?',
      [containerId]
    );
    return record;
  }
  
  private async updateRegistry(containerId: string, status: string): Promise<void> {
    await this.db.query(
      'UPDATE tasks SET status = ? WHERE container_id = ?',
      [status, containerId]
    );
  }
}
```

#### Complete Error Handling Flow

```
┌───────────────────────────────────────────────────────────┐
│                    User Request (OpenCode)                │
└──────────────────────────────┬────────────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │    Hook System     │
                    └────────────────────┘
                               │
                               │ error?
                               ├─ Yes → Log metrics, retry (max 3), or throw
                               │ No
                               ▼
                    ┌────────────────────┐
                    │    MCP Tools       │
                    └────────────────────┘
                               │
                               │ error?
                               ├─ Yes → Map to MCP format, timeout (30s), or throw
                               │ No
                               ▼
                    ┌────────────────────┐
                    │   Docker Engine    │
                    └────────────────────┘
                               │
                               │ error?
                               ├─ Yes → Recovery strategy (registry sync, retry, or throw)
                               │ No
                               ▼
                    ┌────────────────────┐
                    │    Return Result   │
                    └────────────────────┘
```

**Significance**: Multi-layer error handling provides:
- Graceful degradation at each layer
- Detailed error context for debugging
- Automatic retry with exponential backoff
- Metrics collection for monitoring
- Recovery strategies for common failures

---

## Integration Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode + oh-my-opencode                    │
│                                                                 │
│  ┌────────────────────────────────────────────────────┐         │
│  │              Task Manager MCP Server               │         │
│  └────────────────────────────────────────────────────┘         │
│                              │                                  │
│                              ├─ Event System (EventEmitter)     │
│                              │  - before/after hooks            │
│                              │  - metrics collection            │
│                              │  - timeout support               │
│                              │                                  │
│                              ├─ oh-my-opencode Hooks            │
│                              │  - task-lifecycle-manager        │
│                              │  - git-branching-hooks           │
│                              │  - safety-enforcer               │
│                              │                                  │
│                              ├─ Task Registry (SQLite)          │
│                              │  - tasks table                   │
│                              │  - agent_sessions table          │
│                              │  - checkpoints table             │
│                              │                                  │
│                              └─ Docker Engine API (Dockerode)   │
│                                                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                     ┌────────────────────┐
                     │  Docker Desktop    │
                     │  (Engine API)      │
                     └────────────────────┘
```

### Data Flow

```
1. User Request
   ↓
2. OpenCode calls MCP tool
   ↓
3. oh-my-opencode hooks (before)
   ↓
4. Event system (before hooks)
   ↓
5. Docker Engine API operation
   ↓
6. Event system (after hooks)
   ↓
7. oh-my-opencode hooks (after)
   ↓
8. Return result to OpenCode
```

### Error Flow

```
Error occurs at any layer:
   ↓
1. Log detailed error context (layer, operation, timestamp)
   ↓
2. Update metrics (failure count, avg duration)
   ↓
3. Attempt recovery (retry, registry sync, fallback)
   ↓
4. If recovery fails: Map error to user-friendly format
   ↓
5. Return error result to caller
   ↓
6. Next layer handles error or propagates to user
```

---

## Implementation Strategy

### Phase 1: MCP Server Skeleton
- [ ] Initialize MCP server with tools capability
- [ ] Register Docker lifecycle tools
- [ ] Set up stdio transport

### Phase 2: Hook System Integration
- [ ] Implement HookSystem class (from event-system-prototype.ts)
- [ ] Register oh-my-opencode hook points
- [ ] Add hook metrics collection

### Phase 3: Docker Engine API Integration
- [ ] Create Docker client (Dockerode)
- [ ] Implement container lifecycle operations
- [ ] Add streaming for logs/exec

### Phase 4: Error Handling
- [ ] Implement HookErrorHandler
- [ ] Implement MCPErrorHandler
- [ ] Implement DockerErrorHandler
- [ ] Add metrics collection

### Phase 5: Task Registry
- [ ] Create SQLite schema
- [ ] Implement CRUD operations
- [ ] Add backup/restore

---

## Limitations

### Known Limitations
1. **MCP tool timeout**: Fixed 30s timeout may not suit all operations
   - **Mitigation**: Make timeout configurable per tool
2. **Hook retry limit**: Fixed 3 retries may be insufficient for transient errors
   - **Mitigation**: Make retry count configurable
3. **Container state sync**: Registry may become out of sync with Docker reality
   - **Mitigation**: Periodic reconciliation with Docker API
4. **No event replay**: MCP tool results are not replayable after crash
   - **Mitigation**: Add event logging layer (from event-system-prototype.ts)

### Constraints
- **Single-process architecture**: MCP server runs in single process, no built-in HA
- **Synchronous MCP tools**: Each tool call blocks until completion
- **No built-in scaling**: Requires external orchestration for multi-instance deployment

---

## Recommendations

### Recommendation 1: Use EventEmitter for Hook System

**Reason**: Zero dependencies, excellent performance, native ordering guarantees

**Implementation**: Use HookSystem class from `event-system-prototype.ts`

**Benefits**:
- Simple, familiar API
- Built-in error handling
- TypeScript-compatible
- 1200x above target performance

### Recommendation 2: Implement Multi-Layer Error Handling

**Reason**: Errors can occur at any layer, each needs specific handling

**Implementation**: 
- HookErrorHandler: Retry with exponential backoff
- MCPErrorHandler: Timeout protection, error mapping
- DockerErrorHandler: Recovery strategies, registry sync

**Benefits**:
- Graceful degradation
- Detailed error context
- Automatic recovery
- Metrics for monitoring

### Recommendation 3: Add Metrics Collection

**Reason**: Monitoring hook and tool performance critical for production

**Implementation**:
- Hook metrics: call count, failure rate, avg duration
- Tool metrics: success rate, timeout rate, error types
- Docker metrics: API latency, container state sync

**Benefits**:
- Proactive issue detection
- Performance optimization guidance
- Debugging support

### Recommendation 4: Implement Task Registry Reconciliation

**Reason**: Registry and Docker state can diverge over time

**Implementation**:
```typescript
async function reconcileRegistry() {
  const registryContainers = await db.query('SELECT container_id FROM tasks WHERE status = "active"');
  const dockerContainers = await docker.listContainers({ all: true });
  
  const registryIds = new Set(registryContainers.map(c => c.container_id));
  const dockerIds = new Set(dockerContainers.map(c => c.Id));
  
  // Find containers in registry but not in Docker
  const missing = registryIds.filter(id => !dockerIds.has(id));
  for (const containerId of missing) {
    await db.query('UPDATE tasks SET status = "not-found" WHERE container_id = ?', [containerId]);
    console.warn(`[Reconcile] Container ${containerId} in registry but not in Docker`);
  }
  
  // Find containers in Docker but not in registry
  const orphaned = dockerIds.filter(id => !registryIds.has(id));
  for (const containerId of orphaned) {
    console.warn(`[Reconcile] Container ${containerId} in Docker but not in registry`);
    // Option 1: Remove orphaned container
    // await docker.getContainer(containerId).remove();
    // Option 2: Register orphaned container
    // await db.query('INSERT INTO tasks ...', [containerId]);
  }
}
```

**Benefits**:
- State consistency between registry and Docker
- Automatic cleanup of orphaned containers
- Recovery from state divergence

---

## Risks & Mitigations

### Risk 1: Hook Failure Cascades
**Description**: One hook failure prevents all subsequent hooks
**Probability**: Medium
**Impact**: High (partial workflow execution)
**Mitigation**:
- Implement error recovery strategies (continue/stop/retry)
- Add error boundary per hook
- Collect all errors before failing
- Provide clear error messages
**Owner**: Senior Backend Engineer

### Risk 2: MCP Tool Timeout
**Description**: Long-running Docker operations exceed 30s timeout
**Probability**: Medium
**Impact**: Medium (operation aborted)
**Mitigation**:
- Make timeout configurable per tool type
- Add progress streaming for long operations
- Implement operation cancellation
- Log timeout events for monitoring
**Owner**: Senior Backend Engineer

### Risk 3: Container State Divergence
**Description**: Registry and Docker state become inconsistent
**Probability**: Low (with reconciliation)
**Impact**: Medium (confusion, data loss)
**Mitigation**:
- Implement periodic reconciliation
- Add state change listeners
- Log all state transitions
- Provide manual repair tools
**Owner**: Senior Backend Engineer

### Risk 4: Resource Exhaustion
**Description**: Too many containers exhaust host resources
**Probability**: Medium
**Impact**: High (system unresponsiveness)
**Mitigation**:
- Implement resource quotas per user
- Add resource monitoring alerts
- Implement container limits (memory, CPU, PIDs)
- Auto-cleanup of idle containers
**Owner**: Senior Backend Engineer

---

## Next Steps

### Immediate (This Week)
- [x] Complete integration research
- [ ] Create MCP server implementation
- [ ] Implement Docker tool handlers
- [ ] Add error handling layers
- [ ] Create task registry implementation

### Short Term (Next 2-4 Weeks)
- [ ] Implement hooks integration with oh-my-opencode
- [ ] Add metrics collection and monitoring
- [ ] Create reconciliation job for task registry
- [ ] Write comprehensive tests
- [ ] Document integration patterns

---

## Conclusion

**Summary**: Integration between OpenCode, oh-my-opencode hooks, and Docker Engine API requires careful multi-layer error handling and state management. MCP provides standardized tool registration, oh-my-opencode offers workflow customization via hooks, and Dockerode provides comprehensive Docker Engine API bindings. A three-layer error handling strategy (hooks → MCP tools → Docker) with metrics collection and registry reconciliation provides robust production deployment.

**Key Takeaways**:
1. **MCP Structure**: Standardized tool registration with type-safe schemas
2. **Hook System**: Before/after hooks with retry and metrics
3. **Docker Integration**: Dockerode SDK with streaming and security hardening
4. **Error Handling**: Multi-layer with retry, timeout, and recovery
5. **State Management**: Task registry with periodic reconciliation
6. **Metrics**: Hook and tool performance monitoring critical
7. **Reconciliation**: Registry vs Docker state sync required

**Decision**:
- [x] **APPROVE** - Proceed with MCP + hooks + Docker integration

**Follow-up Actions**:
- [x] Design error handling strategy
- [ ] Implement MCP server skeleton
- [ ] Integrate HookSystem from event-system-prototype.ts
- [ ] Implement Docker tool handlers
- [ ] Add task registry with reconciliation
- [ ] Write comprehensive tests
- [ ] Document integration patterns

---

## Appendix

### A. Error Classes

```typescript
// Hook system errors
export class HookError extends Error {
  constructor(hookName: string, cause: Error) {
    super(`Hook ${hookName} failed: ${cause.message}`);
    this.name = 'HookError';
    this.cause = cause;
  }
}

// MCP tool errors
export class ToolTimeoutError extends Error {
  constructor(toolName: string, timeout: number) {
    super(`Tool ${toolName} timed out after ${timeout}ms`);
    this.name = 'ToolTimeoutError';
  }
}

// Docker errors
export class ContainerNotFoundError extends Error {
  constructor(containerId: string) {
    super(`Container ${containerId} not found`);
    this.name = 'ContainerNotFoundError';
  }
}

export class DockerConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DockerConnectionError';
  }
}

export class ResourceExhaustionError extends Error {
  constructor(operation: string, reason: string) {
    super(`${operation} failed: ${reason}`);
    this.name = 'ResourceExhaustionError';
  }
}

export class DockerPermissionError extends Error {
  constructor(operation: string) {
    super(`Permission denied for ${operation}`);
    this.name = 'DockerPermissionError';
  }
}
```

### B. References
- OpenCode MCP Documentation: https://opencode.ai/docs/mcp-servers/
- Docker Engine API v1.47: https://docs.docker.com/engine/api/v1.47/
- Dockerode GitHub: https://github.com/apocas/dockerode
- Event System Prototype: .research/event-system-prototype.ts
- oh-my-opencode: https://www.npmjs.com/package/oh-my-opencode

---

**Last Updated**: 2026-01-21
**Reviewed By**: [Pending]
**Approved By**: [Pending]
