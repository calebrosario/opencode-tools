# Hooks Module

16 TypeScript files implementing extensible hook system with 4 categories.

## STRUCTURE

```
src/hooks/
├── index.ts               # Re-exports all hooks
├── task-lifecycle.ts      # Core lifecycle hook manager
├── task-lifecycle/        # Task lifecycle hooks (checkpoint, resume)
├── git-hooks/             # Git integration (branch, submodule, conflicts)
├── plan-hooks/            # Plan file management (create, update, finalize)
└── safety-hooks/          # Safety enforcement (container, resource, isolation)
```

## WHERE TO LOOK

| Task                | File                                                              | Notes                                                                                                 |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Register hook       | `task-lifecycle.ts`                                               | `TaskLifecycleHooks.register()`                                                                       |
| Lifecycle events    | `task-lifecycle.ts`                                               | BeforeTaskStart, AfterTaskStart, BeforeTaskComplete, AfterTaskComplete, BeforeTaskFail, AfterTaskFail |
| Checkpoint creation | `task-lifecycle/checkpoint-creator.ts`                            | Auto-checkpoint before complete                                                                       |
| Task resume         | `task-lifecycle/task-resumer.ts`                                  | Restore from checkpoint                                                                               |
| Branch management   | `git-hooks/branch-creator.ts`, `branch-validator.ts`              | Create/validate git branches                                                                          |
| Submodule handling  | `git-hooks/submodule-creator.ts`                                  | Create submodules for isolation                                                                       |
| Conflict detection  | `git-hooks/git-branch-conflicts.ts`, `git-submodule-conflicts.ts` | Detect git conflicts                                                                                  |
| Plan tracking       | `plan-hooks/file-creator.ts`, `updater.ts`, `finalizer.ts`        | Plan file lifecycle                                                                                   |
| Container safety    | `safety-hooks/container-enforcer.ts`                              | Enforce container rules                                                                               |
| Resource limits     | `safety-hooks/resource-monitor.ts`                                | Monitor memory/PIDs                                                                                   |
| Isolation check     | `safety-hooks/isolation-checker.ts`                               | Verify task isolation                                                                                 |

## CONVENTIONS

- Hooks are factory functions: `createXxxHook()` returns hook function
- Register via `taskLifecycleHooks.register(event, hook, priority)`
- Priority ordering: lower = runs first
- Hooks continue on failure (error resilience)
- All hooks re-exported via `index.ts`

## HOOK TYPES

| Category       | Hooks                                                                                                 | Purpose                 |
| -------------- | ----------------------------------------------------------------------------------------------------- | ----------------------- |
| Task Lifecycle | beforeTaskStart, afterTaskStart, beforeTaskComplete, afterTaskComplete, beforeTaskFail, afterTaskFail | Task state transitions  |
| Git            | branch-creator, branch-validator, submodule-creator, conflict detection                               | Git workflow automation |
| Plan           | file-creator, updater, finalizer                                                                      | Plan file lifecycle     |
| Safety         | container-enforcer, resource-monitor, isolation-checker                                               | Safety guarantees       |

## ANTI-PATTERNS

- Do NOT throw in hooks → log and continue (error resilience)
- Do NOT block in hooks → use async patterns
- Do NOT import from subdirs directly → use `index.ts`
