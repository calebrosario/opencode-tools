# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-21T20:08:25Z
**Commit:** d8cc2a9
**Branch:** master

## OVERVIEW

Docker-based task management system with concurrency control, state persistence, and multi-agent orchestration. TypeScript/Node.js + PostgreSQL (Drizzle ORM) + Docker Engine API.

## STRUCTURE

```
opencode-tools/
├── src/                    # Source code (main entry + modules)
│   ├── commands/           # 13 CLI commands (task-mgmt, checkpoints, memory, monitoring)
│   ├── hooks/              # 6 hook types for extensibility
│   ├── persistence/        # Multi-layer persistence (state, logs, decisions, checkpoints)
│   ├── docker/             # Docker Engine API integration
│   ├── mcp/                # MCP server (8 tools for agents)
│   ├── monitoring/         # Resource monitoring
│   ├── task-registry/      # PostgreSQL task registry
│   └── index.ts            # Entry point (CLI + app bootstrap)
├── tests/                  # Jest tests by module
├── migrations/             # Drizzle migrations
├── docs/                   # API reference, user guide, diagrams
├── wiki/                   # Additional docs (MkDocs style)
└── .github/workflows/      # CI (postgres tests, lint, type-check, build)
```

## WHERE TO LOOK

| Task           | Location                          | Notes                                    |
| -------------- | --------------------------------- | ---------------------------------------- |
| Entry points   | `src/index.ts`                    | Dual-mode: CLI dispatch or app bootstrap |
| CLI commands   | `src/commands/cli.ts`             | 13 commands via Commander.js             |
| MCP server     | `src/mcp/server.ts`               | Auto-starts on import, 8 agent tools     |
| Task lifecycle | `src/task/`, `src/task-registry/` | State machine + PostgreSQL backend       |
| Concurrency    | `src/persistence/lock-manager.ts` | Optimistic locking                       |
| Hooks          | `src/hooks/`                      | 6 hook types (before/after task events)  |
| Docker ops     | `src/docker/docker-manager.ts`    | Container lifecycle                      |
| Tests          | `tests/`                          | Jest, organized by module                |
| Config         | `src/config/`, `tsconfig.json`    | Runtime + build config                   |

## CONVENTIONS

**TypeScript (Strict Mode)**

- Target: ES2022, Module: CommonJS
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`
- Test strictness relaxed in `tsconfig.test.json`

**Imports**

- Avoid circular deps; use dynamic imports or direct paths (e.g., `types/lifecycle`)
- Re-exports via `index.ts` in each module

**Database**

- Drizzle ORM with PostgreSQL
- Migrations: `npm run db:generate` + `npm run db:migrate`
- NEVER use `db:push` in production

**Testing**

- Jest with 90% coverage threshold
- Mocks in `tests/__mocks__/` (especially `dockerode.ts`)
- Singleton reset via `clearCache()` in `beforeEach`

## ANTI-PATTERNS (THIS PROJECT)

1. **Migrations**: Never `db:push` in prod → shadows schema changes
2. **Circular deps**: Import from direct paths, not re-exports
3. **Init order**: DatabaseManager before TaskRegistry
4. **Null safety**: Always use `?.` for potential undefined
5. **Locks**: Acquire in sorted order (deadlock prevention)
6. **Logging**: Never log sensitive data
7. **Perf**: Avoid individual DB inserts (use batch); avoid loading all logs to memory
8. **Errors**: Never suppress silently; always propagate
9. **Deprecated packages**: Avoid eslint<9, rimraf<4, glob<9

## UNIQUE STYLES

- Unified entry point: single `src/index.ts` handles both CLI and server bootstrap
- MCP server auto-starts on import (no explicit start call)
- 4-layer persistence: state.json, logs.jsonl, decisions.md, checkpoints/
- Dot-dirs for AI workflows: `.sisyphus/`, `.beads/`, `.claude/`, `.research/`

## COMMANDS

```bash
# Development
npm run dev              # tsx watch src/index.ts
npm start                # node dist/index.js

# Build
npm run build            # tsc
npm run type-check       # tsc --noEmit

# Testing
npm test                 # jest (SQLite)
npm run test:pg          # jest with PostgreSQL (.env.test)
npm run test:coverage    # jest --coverage

# Linting
npm run lint             # eslint src/**/*.ts
npm run lint:fix         # eslint --fix

# Database
npm run db:generate      # drizzle-kit generate
npm run db:migrate       # drizzle-kit migrate
npm run db:studio        # drizzle-kit studio

# Docker
npm run check-docker     # verify Docker Engine connection

# CLI Usage
npm run cli -- list-tasks
npm run cli -- create-task "Task Name" --owner agent-1
```

## NOTES

- **Node >=20 required**
- **PostgreSQL required** for tests/prod; start via `docker compose -f docker-compose.test.yml up -d`
- **Docker Engine access** required (dockerode)
- Many tests skipped (`.skip`, `.broken`) pending implementation
- CI enforces: npm ci → db:migrate → test:pg --coverage → lint → type-check → build
