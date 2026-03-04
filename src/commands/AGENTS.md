# CLI Commands Module

17 TypeScript files implementing 13 CLI commands via Commander.js.

## STRUCTURE

```
src/commands/
├── cli.ts                 # Main entry, program setup
├── index.ts               # Re-exports all commands
├── task-management/       # 6 commands (create, resume, list, detach, complete, cleanup)
├── checkpoint/            # 2 commands (checkpoint, restore-checkpoint)
├── memory/                # 5 commands (history, executions, decisions, find, stats)
└── monitoring/            # 2 commands (metrics, health)
```

## WHERE TO LOOK

| Task            | File               | Notes                                                                     |
| --------------- | ------------------ | ------------------------------------------------------------------------- |
| Add new command | `cli.ts`           | Register via `program.addCommand()`                                       |
| Command index   | `index.ts`         | Re-exports all command factories                                          |
| Task CRUD       | `task-management/` | create-task, resume-task, list-tasks, detach, complete-task, cleanup-task |
| Checkpoints     | `checkpoint/`      | checkpoint.ts, restore-checkpoint.ts                                      |
| Task history    | `memory/`          | task-history, task-executions, task-decisions, find-task, task-stats      |
| Monitoring      | `monitoring/`      | metrics.ts, health.ts                                                     |

## CONVENTIONS

- Each command is a factory function returning a `Command` instance
- Commands grouped by domain (task-management, checkpoint, memory, monitoring)
- All commands re-exported via `index.ts` for clean imports
- CLI name: "agentic-armor" (legacy name, consider updating)

## USAGE

```bash
npm run cli -- <command> [options]

# Examples
npm run cli -- create-task "My Task" --owner agent-1
npm run cli -- list-tasks
npm run cli -- checkpoint --task task-123
npm run cli -- task-history --task task-123
```

## ANTI-PATTERNS

- Do NOT import commands directly from subdirs → use `index.ts` re-exports
- Do NOT hardcode version → use `packageJson.version`
