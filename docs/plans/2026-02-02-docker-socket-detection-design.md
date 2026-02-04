# Docker Socket Detection & Test Remediation Design

**Week**: 16 (PostgreSQL Integration & Test Remediation)
**Focus**: Test Infrastructure Fixes
**Date**: 2026-02-02
**Branch**: sisyphus_GLM-4.7/week-16-postgresql-integration

---

## Overview

This design fixes the primary infrastructure issue causing test failures: hardcoded Docker socket path incompatible with macOS Docker Desktop. The solution implements dynamic socket detection with graceful test skipping.

---

## Problem Statement

**Root Cause**: Docker tests hardcode \`/var/run/docker.sock\`, which doesn't exist on macOS Docker Desktop (uses \`/Users/calebrosario/.docker/run/docker.sock\` or \`~/Library/Containers/com.docker.docker/Data/docker.sock\`).

**Impact**:
- 9 out of 14 failing test suites (Docker-dependent)
- Tests fail hard instead of skipping gracefully
- Local development blocked (tests can't run without real Docker)
- CI may have different socket paths than macOS

---

## Architecture

### DockerHelper Utility Class

**Location**: \`src/util/docker-helper.ts\`

**Pattern**: Singleton (similar to \`DatabaseManager\`)

**Responsibilities**:
1. Detect Docker socket path dynamically
2. Validate Docker availability
3. Provide configured Dockerode client

### Key Components

#### \`detectSocket()\`
- Checks socket paths in priority order
- Platform-aware (Darwin, Linux, Windows)
- Throws \`OpenCodeError\` if none found

**Detection Priority**:
1. \`DOCKER_SOCKET\` environment variable (override)
2. macOS Docker Desktop locations:
   - \`~/.docker/run/docker.sock\`
   - \`~/Library/Containers/com.docker.docker/Data/docker.sock\`
3. Standard Linux location: \`/var/run/docker.sock\`
4. \`dockerode\` auto-detection as fallback

#### \`isAvailable()\`
- Attempts to connect with detected socket
- Caches result (lazy initialization)
- Returns \`false\` instead of throwing for graceful skipping

#### \`createClient()\`
- Returns configured \`Dockerode\` instance
- Validates Docker is responsive (\`docker.info()\`)
- Caches client instance

### Error Handling

**OpenCodeError Codes**:
- \`DOCKER_SOCKET_NOT_FOUND\` - No socket at expected paths
- \`DOCKER_CONNECTION_FAILED\` - Socket exists but connection failed
- \`DOCKER_NOT_RESPONDING\` - Connected but Docker unresponsive

**Logging Levels**:
- \`info\`: Socket path detected, client created
- \`warn\`: Docker unavailable (expected when not running)
- \`debug\`: All checked paths (troubleshooting)

---

## Test Modifications

### High Priority (Docker-dependent)

1. **tests/util/network-isolator.test.ts** - 7 failing tests
2. **tests/docker/volume-manager.test.ts** - ~10 failing tests
3. **tests/docker/network-manager.test.ts** - Multiple failing tests
4. **tests/integration/e2e-workflows.test.ts** - Docker integration
5. **tests/integration/component-integration.test.ts** - Docker integration

**Change Pattern**:
\`\`\`typescript
// Before
import Docker from 'dockerode';
const docker = new Docker();

// After
import { dockerHelper } from '../../util/docker-helper';
const docker = dockerHelper.createClient();

// Add to describe block
if (!dockerHelper.isAvailable()) {
  return; // Skip entire suite
}
\`\`\`

### Moderate Priority (Logic Bugs)

1. **tests/util/resource-monitor.test.ts** - 2 failing tests
   - Fix: \`checkResourceLimits\` logic (compute buffer correctly)

2. **tests/util/process-supervisor.test.ts** - 1 failing test
   - Fix: Ensure \`startProcess\` throws on invalid config

3. **tests/util/state-validator.test.ts** - 4 failing tests
   - Fix: Update regex expectations to match actual error messages

---

## Implementation Order

### Phase 1: Infrastructure (Days 1-2)
- Create \`src/util/docker-helper.ts\`
- Add \`DOCKER_SOCKET\` to \`src/config/index.ts\`
- Write unit tests for \`DockerHelper\`

### Phase 2: Docker Test Updates (Days 2-3)
- Update network-isolator, volume-manager, network-manager tests
- Update integration tests (e2e-workflows, component-integration)
- Add skip logic to all Docker-dependent suites

### Phase 3: Logic Bug Fixes (Days 3-4)
- Fix resource-monitor logic
- Fix process-supervisor validation
- Update state-validator test expectations

### Phase 4: Verification (Day 5)
- Run full test suite
- Verify Docker tests skip gracefully
- Run on CI for Linux compatibility
- Update documentation

---

## Success Criteria

- All Docker tests pass or skip with clear messages
- No test failures due to socket path
- Logic bugs in resource checks fixed
- CI runs green (pre-existing failures documented)
- Local test run passes on macOS

---

## Verification Command

\`\`\`bash
npm test 2>&1 | grep -E "(Test Suites|PASS|FAIL)" | tail -5
\`\`\`

**Expected Output**:
\`\`\`
Test Suites: 10 passed, 0 failed, 14 skipped
\`\`\`

(14 skipped = Docker tests when Docker unavailable)

---

**Status**: ✅ Design Complete
**Next**: Create detailed implementation plan
