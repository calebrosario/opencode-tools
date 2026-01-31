# OpenCode Tools

> Docker-based task management system with concurrency, state persistence, and multi-agent orchestration.

## Quick Links

- **Documentation**: [docs/](./docs/) - Complete API reference, user guide, and state machine diagrams
- **API Reference**: [docs/API.md](./docs/API.md) - Complete API documentation
- **User Guide**: [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) - Tutorials and best practices
- **State Machines**: [docs/diagrams/](./docs/diagrams/) - Complete system state machine diagrams

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
- Complete documentation (README, API, User Guide, State Machines)

## Quick Start

### Start the MCP Server

```bash
npm start
```

### Use CLI Commands

```bash
# List all tasks
npm run cli -- list-tasks

# Create a new task
npm run cli -- create-task "My Task" --owner agent-1

# View task history
npm run cli -- task-history --task task-123
```

## Key Features

### 1. Task Lifecycle

Complete state machine with transitions:
- pending → running (agent attaches)
- running → completed (task finishes)
- running → failed (error occurs)
- pending → cancelled (user/system cancels)
- any → deleted (cleanup)

### 2. Concurrency Control

Optimistic locking with two modes:
- Exclusive: Single agent only
- Collaborative: Multiple agents with conflict resolution

### 3. Multi-Layer Persistence

4 storage layers:
- Layer 1: state.json (current state, fast access)
- Layer 2: logs.jsonl (audit trail, append-only)
- Layer 3: decisions.md (agent decisions, human-readable)
- Layer 4: checkpoints/ (snapshots, point-in-time recovery)

### 4. Hook System

6 hook types for extensibility:
- beforeTaskStart / afterTaskStart
- beforeTaskComplete / afterTaskComplete
- beforeTaskFail / afterTaskFail

### 5. MCP Tools

8 tools for task management:
- create_task_sandbox, attach_agent_to_task
- detach_agent_from_task, execute_in_task
- list_tasks, get_task_status, cancel_task, delete_task

### 6. CLI Commands

13 commands organized by category:
- 6 task management commands
- 2 checkpoint commands
- 5 memory commands

## Documentation

For detailed documentation, see:

- **[docs/README.md](./docs/README.md)** - Complete project documentation
  - Installation instructions
  - Architecture overview
  - Configuration guide
  - Common use cases
  - Troubleshooting guide

- **[docs/API.md](./docs/API.md)** - Complete API reference
  - All 8 MCP tools documented
  - TaskLifecycle, TaskRegistry, MultiLayerPersistence APIs
  - LockManager and Hook System APIs
  - All data models and type definitions
  - Request/response formats
  - Error codes

- **[docs/USER_GUIDE.md](./docs/USER_GUIDE.md)** - Complete user guide
  - Step-by-step tutorials
  - All 13 CLI commands with examples
  - Best practices and advanced patterns
  - Troubleshooting guide
  - FAQ section

- **[docs/diagrams/](./docs/diagrams/)** - Complete state machine diagrams
  - Task Lifecycle state machine
  - Lock Manager state machine
  - Multi-Layer Persistence state machine
  - Integration points and error recovery patterns

## Performance

**SQLite (100K Tasks)**:
- Batch Insert: 212,319 ops/sec
- Single Row Read: 302,724 ops/sec
- Database Size: 23.36MB

**JSONL (1M Entries)**:
- Simple Append: 10,785 ops/sec
- Batch Append: 377,060 ops/sec (35x faster)
- File Size: 183MB

**Lock Manager**:
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
```

---

**Version**: 0.1.0-alpha
**Last Updated**: 2026-01-31
