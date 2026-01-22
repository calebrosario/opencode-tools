# State Machine Diagrams: Docker Task Management System

**Created**: 2026-01-21
**Status**: Complete

---

## Overview

This document provides state machine diagrams for the major systems in the Docker Task Management architecture. Each diagram visualizes the lifecycle, states, transitions, and decision points for that system.

---

## State Machine 1: Task Lifecycle

**Description**: Complete lifecycle of a task from creation to completion/archival

**States**:
- `pending` - Task created but not yet attached to any agent
- `in_progress` - Task is currently being worked on
- `paused` - Task is temporarily paused
- `completed` - Task has been successfully completed
- `failed` - Task failed with error
- `archived` - Task has been archived (read-only)

**Transitions**:
- `create` → `in_progress`: Task assigned to agent
- `in_progress` → `paused`: Agent paused work on task
- `paused` → `in_progress`: Agent resumed work
- `in_progress` → `completed`: Agent finished task
- `in_progress` → `failed`: Task encountered unrecoverable error
- `completed` → `archived`: Task archived after completion
- `in_progress` → `pending`: Task reassigned to different agent

**Events**:
- `task:created` - New task created
- `task:assigned` - Agent assigned to task
- `task:resumed` - Agent resumed task
- `task:paused` - Agent paused task
- `task:updated` - Task data updated
- `task:completed` - Task completed
- `task:failed` - Task failed
- `task:archived` - Task archived

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Task Lifecycle State Machine                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   pending    │
                              └──────────────┘
                                     │
                                     │
                                     │
                              ┌─────────────┐     ┌──────────────┐
                              │ in_progress │     │    paused    │
                              └───────┬─────┘     └──────────────┘
                 ┌────────────────────+────────────────────┐
                 │                    |                    |
          ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
          │  completed  │     │     failed   │     │   pending    │
          └─────────────┘     └──────────────┘     └──────────────┘
                 │               
          ┌─────────────┐                    
          │   archived  │
          └─────────────┘
```

**Decision Points**:
1. Can task be paused? (if checkpoint exists)
2. Can task be resumed? (if not in `failed` state)
3. Should task be archived? (on successful completion)

---

## State Machine 2: Container Lifecycle

**Description**: Lifecycle of a Docker container associated with a task

**States**:
- `created` - Container configuration defined but not yet created
- `running` - Container is executing
- `stopped` - Container has been stopped gracefully
- `exited` - Container has stopped (exit code available)
- `removing` - Container is being removed
- `removed` - Container no longer exists

**Transitions**:
- `created` → `running`: Container started
- `running` → `stopped`: Graceful stop signal received
- `running` → `exited`: Container process exited
- `stopped` → `removing`: Cleanup initiated
- `removing` → `removed`: Container removed
- `exited` → `removing`: Cleanup after exit
- `removed` → `created`: Container recreated (if task restarted)
- Any → `failed`: Error during any operation

**Events**:
- `container:created` - Container created successfully
- `container:started` - Container started
- `container:stopped` - Container stopped
- `container:exited` - Container process exited
- `container:removed` - Container removed
- `container:failed` - Container operation failed

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Container Lifecycle State Machine                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                ┌──────────────┐
                │   created    │
                └───────┬──────┘
                        │
                        │
               ┌──────────────┐     ┌──────────────┐
               │    running   │     │   stopped    │
               └──────────────┘     └──────────────┘
                        │                  │
               ┌──────────────┐     ┌──────────────┐
               │   exited     │     │  removing    │
               └──────────────┘     └──────────────┘
                        │
               ┌──────────────┐
               │   removed    │
               └──────────────┘
                        │
                    ┌──────────────┐
                    │   failed     │
                    └──────────────┘
```

**Decision Points**:
1. Can container be stopped? (if not in critical operation)
2. Should container be removed? (on task completion)
3. Should container be recreated? (on task resume)

**Error Handling**:
- Exit code non-zero: mark task as `failed`
- Container crash: mark task as `failed` and preserve logs
- Docker API error: retry operation or mark task as `failed`

---

## State Machine 3: Agent Session Lifecycle

**Description**: Lifecycle of an agent session attached to a task

**States**:
- `attaching` - Agent is being attached to task container
- `attached` - Agent is actively working in task container
- `detaching` - Agent is being detached from task container
- `detached` - Agent session has ended

**Transitions**:
- `attaching` → `attached`: Connection established
- `attached` → `detaching`: Agent finished work or switching
- `detaching` → `detached`: Disconnection successful
- `detaching` → `attached`: Re-attach (new session)

**Events**:
- `agent:attaching` - Agent connecting to container
- `agent:attached` - Agent successfully attached
- `agent:detaching` - Agent disconnecting
- `agent:detached` - Agent disconnected

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Agent Session Lifecycle State Machine                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │  attaching   │
                    └───┬──────────┘
                        │
                        │
               ┌──────────────┐
               │   attached   │
               └──────────────┘
                        │
                        │
                    ┌──────────────┐
                    │  detaching   │
                    └───┬──────────┘
                        │
                        │
               ┌──────────────┐
               │   detached   │
               └──────────────┘

```

**Decision Points**:
1. Should agent attach? (if task is `in_progress`)
2. Should agent detach? (when finished or switching)
3. Should agent reattach? (if resuming task)

---

## State Machine 4: Hook System Event Flow

**Description**: Event flow through hook system and event bus

**States**:
- `idle` - No events being processed
- `emitting` - Event is being emitted
- `processing_hooks` - Before/after hooks are executing
- `error_handling` - Error is being handled
- `completed` - Event processing complete

**Transitions**:
- `idle` → `emitting`: Event triggered
- `emitting` → `processing_hooks`: Hook execution started
- `processing_hooks` → `error_handling`: Hook failed
- `error_handling` → `completed`: Error handled, continuing
- `error_handling` → `processing_hooks`: Retry on next hook
- `processing_hooks` → `completed`: All hooks executed
- `completed` → `idle`: Ready for next event

**Events**:
- `event:emitted` - Event emitted to event bus
- `event:hook_before` - Before hook executing
- `event:hook_after` - After hook executing
- `event:hook_failed` - Hook failed
- `event:handled` - Error handled

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Hook System Event Flow State Machine                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   idle      │
                    └───┬─────────┘
                        │
                        │
               ┌──────────────┐
               │  emitting    │
               └────────┬─────┘
                        │
                        │
                        │
               ┌────────────────────┐
               │  processing_hooks  │
               └──────┬──────────┬──┘
                      │          │
                      |          |
                      │          │
│         ┌──────────────┐     ┌──────────────┐
│         │   completed  │     │error_handling│
          └──────────────┘     └──────────────┘

```

**Event Types**:
- `task:*` - Task lifecycle events
- `container:*` - Container lifecycle events
- `git:*` - Git operation events
- `plan:*` - Plan management events

---

## State Machine 5: Integration Flow

**Description**: End-to-end integration flow from OpenCode → oh-my-opencode hooks → MCP tools → Docker Engine API

**States**:
- `idle` - No integration request in progress
- `hook_processing` - oh-my-opencode hooks executing
- `mcp_invocation` - MCP tool being called
- `docker_operation` - Docker Engine API executing
- `error_handling` - Error being handled
- `returning` - Result being returned to OpenCode

**Transitions**:
- `idle` → `hook_processing`: Integration request received
- `hook_processing` → `mcp_invocation`: Hooks complete
- `mcp_invocation` → `docker_operation`: MCP tool validated
- `docker_operation` → `error_handling`: Docker error occurred
- `error_handling` → `docker_operation`: Retry initiated
- `docker_operation` → `returning`: Operation complete
- `returning` → `idle`: Ready for next request

**Events**:
- `integration:request` - Integration request from OpenCode
- `hook:before` - Before hook executing
- `hook:after` - After hook executing
- `mcp:invoking` - MCP tool invocation started
- `mcp:result` - MCP tool returned result
- `mcp:error` - MCP tool error
- `docker:started` - Docker operation started
- `docker:completed` - Docker operation completed
- `integration:complete` - Integration flow complete

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   Integration Flow State Machine                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                          OpenCode Request
                                  │
                                  ▼
                ┌────────────────────────────────────┐
                │   Hook Processing (oh-my-opencode) │
                └────────────────────────────────────┘
                                  │
                ┌───────────────────────────────┐
                │   MCP Server Invocation       │
                └───────────────────────────────┘
                                  │
                ┌───────────────────────────────┐
                │   Docker Engine API Operation │
                └───────────────────────────────┘
                                  │
                          Result to OpenCode
```

**Integration Layers**:
1. **oh-my-opencode Hooks**:
   - Task lifecycle hooks (pre-create, post-complete)
   - Git branching hooks (pre-branch, post-commit)
   - Plan management hooks (pre-execute, post-finalize)
   - Safety enforcement hooks (container-limits, isolation-check)

2. **Event System**:
   - Event emission and handling
   - Before/after hook orchestration
   - Metrics collection
   - Error handling and retry

3. **MCP Server**:
   - Tool registration and discovery
   - Request validation
   - Tool execution
   - Result formatting (JSON, streaming)
   - Error mapping to MCP format

4. **Docker Engine API**:
   - Container lifecycle operations
   - Exec and log streaming
   - Resource limit enforcement
   - Security hardening (seccomp, AppArmor, capabilities)
   - State reconciliation with registry

---

## Combined System State Machine

**Description**: Overall system state combining task, container, and agent states

**System States**:
- `ready` - No tasks running, system idle
- `active` - One or more tasks running
- `degraded` - System running but with performance issues
- `maintenance` - System in maintenance mode

**Transition Rules**:
- Enter `active` when first task starts
- Enter `degraded` when >50% of tasks experiencing issues
- Enter `maintenance` when critical maintenance needed
- Return to `ready` when all tasks complete and no issues

**Health Checks**:
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    Combined System State Machine                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                     ┌──────────────┐
                     │   ready      │
                     └──────────────┘
                          │
                          │
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │   active     │     │  degraded    │     │ maintenance  │
                    └──────────────┘     └──────────────┘     └──────────────┘
```

**State Transition Triggers**:
- Health check failure → `degraded`
- Critical issue detected → `maintenance`
- Issue resolved → `active` or `ready`
- All tasks complete → `ready`

---

## Summary

**State Machine 1**: Task Lifecycle - 7 states, 8 transitions, 3 decision points
**State Machine 2**: Container Lifecycle - 7 states, 8 transitions, 3 decision points
**State Machine 3**: Agent Session Lifecycle - 4 states, 4 transitions, 3 decision points
**State Machine 4**: Hook System Event Flow - 5 states, 9 transitions
**State Machine 5**: Integration Flow - 6 states, 6 transitions
**Combined System State Machine**: 4 system states, 4 transition triggers, health checks

**Total**: 6 state machine diagrams with 29 states and 36 transitions

---

## Implementation Notes

### Tooling Considerations

1. **State Visualization**: Use Mermaid.js or similar library for interactive diagrams
2. **State Persistence**: Store state transitions in event log for crash recovery
3. **State Validation**: Add guards to prevent invalid state transitions
4. **State Metrics**: Track time spent in each state for optimization
5. **Error Recovery**: Define recovery states and transitions for each error type

### State Machine Libraries

- **XState**: Modern state machine for React/TypeScript
  - Good for complex state machines with nested states
  - Built-in visualization
  - Type-safe state definitions

- **Robot Framework**: Hierarchical state machines
  - Good for browser-based state machines
  - Built-in visualization
  - Complex transition logic

- **Custom EventEmitter**: Simple approach from `event-system-prototype.ts`
  - Good for event-driven state machines
  - No additional dependencies

### Decision Tree

For state machines with complex decision logic:

```
[Should pause task?]
├─ Yes → Check checkpoint exists
└─ No → Continue execution

[Should remove container?]
├─ Yes → Stop container gracefully
└─ No → Let container run

[Should recreate container?]
├─ Yes → Create new container
└─ No → Use existing container
```

---

## References

### Related Documents
- `.research/event-system-prototype.ts` - Event system implementation
- `.research/integration-prototype.md` - Integration patterns
- `.research/risk-register.md` - Risk register and mitigation
- `.research/architecture-decision-record.md` - Architecture decisions

### State Machine Resources
- XState Documentation: https://xstate.js.io/docs/
- Robot Documentation: https://robotframework.io/guides/state-machines/
- State Machine Patterns: https://refactoring.guru/design-patterns/state-machine/

---

**Last Updated**: 2026-01-21
**Status**: Complete
**Next Steps**: Update tracking.md, create WEEK3-COMPLETION-SUMMARY.md
