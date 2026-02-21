# Skipped Tests Tracking

This document tracks tests that are temporarily skipped and how to re-enable them.

## How to Re-enable Tests

1. Rename `.test.ts.skip` back to `.test.ts`
2. Ensure required dependencies are available
3. Run `bun test`

## Skipped Tests by Category

### Docker Tests (Require Docker Runtime)

| File                                        | Reason                 | Re-enable When         |
| ------------------------------------------- | ---------------------- | ---------------------- |
| `tests/docker/network-manager.test.ts.skip` | Requires Docker daemon | Docker available in CI |
| `tests/docker/orphan-detector.test.ts.skip` | Requires Docker daemon | Docker available in CI |

### PostgreSQL Tests (Require Database)

| File                                                | Reason              | Re-enable When           |
| --------------------------------------------------- | ------------------- | ------------------------ |
| `tests/persistence/postgresql-adapter.test.ts.skip` | Requires PostgreSQL | Database available in CI |
| `tests/registry/registry.test.ts.skip`              | Requires PostgreSQL | Database available in CI |
| `tests/registry/type-safety.test.ts.skip`           | Requires PostgreSQL | Database available in CI |
| `tests/registry/schema-constraints.test.ts.skip`    | Requires PostgreSQL | Database available in CI |
| `tests/registry/database-failure.test.ts.skip`      | Requires PostgreSQL | Database available in CI |

### Integration Tests (Require Multiple Services)

| File                                                          | Reason                          | Re-enable When         |
| ------------------------------------------------------------- | ------------------------------- | ---------------------- |
| `tests/persistence/multi-layer.test.ts.skip`                  | Requires full persistence stack | Full stack available   |
| `tests/integration/database-adapter-integration.test.ts.skip` | Requires database adapter       | Database available     |
| `tests/mcp/integration.test.ts.skip`                          | Requires MCP server running     | Server available in CI |

### Utility Tests (Require External Services)

| File                                     | Reason                     | Re-enable When        |
| ---------------------------------------- | -------------------------- | --------------------- |
| `tests/util/crash-recovery.test.ts.skip` | Requires filesystem state  | Mock filesystem ready |
| `tests/util/integration.test.ts.skip`    | Requires external services | Services available    |
| `tests/util/path-sanitizer.test.ts.skip` | Requires filesystem access | Proper sandbox ready  |

### Git Hook Tests (Implementation Bug)

| File                                               | Reason                  | Re-enable When |
| -------------------------------------------------- | ----------------------- | -------------- |
| `tests/hooks/git-branch-conflicts.test.ts.skip`    | Bug in createTaskBranch | Bug fixed      |
| `tests/hooks/git-submodule-conflicts.test.ts.skip` | Bug in createTaskBranch | Bug fixed      |

## Statistics

- Total skipped: 14 test files
- Docker-dependent: 2
- PostgreSQL-dependent: 5
- Integration: 3
- Utility: 3
- Implementation issues: 2

## Related Issue

See GitHub issue for tracking re-enablement: [#40](https://github.com/calebrosario/agentic-armor/issues/40)
