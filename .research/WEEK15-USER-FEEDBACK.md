# Week 15: User Feedback & Bug Fixes

**Date**: 2026-02-02
**Phase**: 3 - Stability & Beta (Week 1 of 5)
**Branch**: sisyphus_GLM-4.7/week-15-user-feedback
**Status**: Planning Complete

---

## Executive Summary

Week 15 focuses on collecting user feedback from Alpha v0.1.0 release and fixing critical bugs that block development and testing. This is the first week of Phase 3 (Stability & Beta, Weeks 15-19).

**Key Goals**:
1. Collect and analyze Alpha user feedback
2. Fix all critical bugs that block tests
3. Setup lightweight feedback collection infrastructure
4. Begin stability improvements
5. Verify integration test suite works

**Success Criteria**:
- All critical bugs resolved
- All tests passing
- Feedback collection mechanisms in place
- Build passes with 0 errors
- Week 15 tasks completed and committed

---

## Current Issues from Alpha v0.1.0

### Critical Issues (Blockers)

**1. TaskRegistry Initialization (CRITICAL)**
- **Problem**: TaskRegistry tests fail with "TaskRegistry not initialized" error
- **Root Cause**: `initialize()` must be called explicitly before CRUD operations
- **Files Affected**: tests/registry/registry.test.ts (9 failing tests)
- **Solution**: Implement auto-initialization in getInstance()
- **Priority**: HIGH (blocks tests)
- **Effort**: 1-2 hours

### Medium Priority Issues

**2. Docker Manager Port Parsing (MEDIUM)**
- **Problem**: Comment indicates incomplete implementation
- **Location**: src/docker/manager.ts (line 878)
- **Code**: `ports: [], // TODO: Parse ports from info`
- **Impact**: Container info doesn't include port bindings
- **Solution**: Parse port bindings from Dockerode ContainerInspectInfo
- **Priority**: MEDIUM
- **Effort**: 2-3 hours

**3. Test File Locations (MEDIUM)**
- **Problem**: Test files in non-standard location `src/util/__tests__/`
- **Files Affected**:
  - src/util/__tests__/resource-monitor.test.ts
  - src/util/__tests__/process-supervisor.test.ts
  - src/util/__tests__/state-validator.test.ts
- **Impact**: Test discovery issues
- **Solution**: Move files to standard location `tests/util/`
- **Priority**: MEDIUM
- **Effort**: 1 hour

**4. Plan Hooks Test Failures (MEDIUM)**
- **Problem**: 3 plan hook tests failing with unclear errors
- **File**: tests/hooks/plan-hooks.test.ts
- **Impact**: Hook system testing unclear
- **Solution**: Investigate and fix test failures
- **Priority**: MEDIUM
- **Effort**: 1-2 hours

**5. Integration Test Verification (HIGH)**
- **Problem**: Integration tests created but not verified
- **Files**:
  - tests/integration/component-integration.test.ts (680 lines)
  - tests/integration/e2e-workflows.test.ts (547 lines)
- **Impact**: Unknown if integration tests pass
- **Solution**: Run full integration test suite
- **Priority**: HIGH
- **Effort**: 1 hour

---

## Task Breakdown

### Task 15.1: Fix TaskRegistry Auto-Initialization (CRITICAL)

**Priority**: HIGH
**Effort**: 1-2 hours
**Status**: PENDING

#### Implementation

Modify `src/task-registry/registry.ts`:

public static getInstance(): TaskRegistry {
  if (!TaskRegistry.instance) {
    TaskRegistry.instance = new TaskRegistry();
  }
  // Auto-initialize if not done
  if (!TaskRegistry.instance.db) {
    TaskRegistry.instance.initialize().catch(err => {
      logger.error('Failed to auto-initialize TaskRegistry', { err });
    });
  }
  return TaskRegistry.instance;
}

#### Acceptance Criteria
- [ ] TaskRegistry.getInstance() auto-initializes on first call
- [ ] All TaskRegistry tests passing
- [ ] No manual initialize() calls needed in tests
- [ ] Error handling for initialization failures

---

### Task 15.2: Fix Test File Locations (MEDIUM)

**Priority**: MEDIUM
**Effort**: 1 hour
**Status**: PENDING

#### Implementation

Move test files to standard location:

mkdir -p tests/util
mv src/util/__tests__/*.test.ts tests/util/

# Update imports in moved files
# Change: import { ... } from '../util/__tests__/...
# To: import { ... } from '../../src/util/...'
#### Files to Move
- src/util/__tests__/resource-monitor.test.ts
- src/util/__tests__/process-supervisor.test.ts
- src/util/__tests__/state-validator.test.ts

#### Acceptance Criteria
- [ ] All test files in tests/util/
- [ ] All imports updated correctly
- [ ] npm test discovers all tests
- [ ] All util tests passing

---

### Task 15.3: Fix Docker Manager Port Parsing (MEDIUM)

**Priority**: MEDIUM
**Effort**: 2-3 hours
**Status**: PENDING

#### Implementation

Modify `src/docker/manager.ts`:

const ports: PortBinding[] = [];
if (info.NetworkSettings?.Ports) {
  for (const [containerPort, portBindings] of Object.entries(info.NetworkSettings.Ports)) {
    for (const binding of portBindings || []) {
      ports.push({
        containerPort: parseInt(containerPort.split('/')[0]),
        hostPort: binding.HostPort,
        hostIp: binding.HostIp || '0.0.0.0',
        protocol: containerPort.split('/')[1] === 'tcp' ? 'tcp' : 'udp',
      });
    }
  }
}

#### Acceptance Criteria
- [ ] Port bindings correctly parsed from Dockerode response
- [ ] ContainerInfo.ports includes port information
- [ ] Display tasks shows port mappings
- [ ] Tests added for port parsing
- [ ] TODO comment removed

---

### Task 15.4: Fix Plan Hooks Test Failures (MEDIUM)

**Priority**: MEDIUM
**Effort**: 1-2 hours
**Status**: PENDING

#### Implementation

Investigate and fix failing tests in tests/hooks/plan-hooks.test.ts:

1. Run tests with verbose output
2. Check test implementation vs hook implementation
3. Ensure proper mocking
4. Add clear error messages

#### Failing Tests to Fix
- should execute hook with taskId and agentId
- should execute hook with taskId and result
- should execute hook with taskId and result

#### Acceptance Criteria
- [ ] All plan hook tests passing
- [ ] Error messages are clear
- [ ] Tests properly mock dependencies
- [ ] Hook execution flow verified

---

### Task 15.5: Run Integration Test Suite (HIGH)

**Priority**: HIGH
**Effort**: 1 hour
**Status**: PENDING

#### Implementation

Execute full integration test suite:

npm test tests/integration/

#### Files to Verify
- tests/integration/component-integration.test.ts (680 lines)
- tests/integration/e2e-workflows.test.ts (547 lines)

#### Acceptance Criteria
- [ ] All integration tests execute
- [ ] Document any test failures
- [ ] Create bug reports for critical issues
- [ ] Test coverage verified

---

### Task 15.6: Setup GitHub Issue Templates (MEDIUM)

**Priority**: MEDIUM
**Effort**: 1 hour
**Status**: PENDING

#### Implementation

Create GitHub issue templates:

.github/ISSUE_TEMPLATE/
├── bug_report.md
├── feature_request.md
└── question.md

bug_report.md Template:
### Bug Description
- Version: [e.g., v0.1.0-alpha]
- Steps to reproduce:
- Expected behavior:
- Actual behavior:
- Environment: [OS, Node.js version, Docker version]

### Logs
- Error messages:
- Console output:

feature_request.md Template:
### Feature Description
- What problem does this solve?
- Proposed solution:
- Use case:

question.md Template:
### Question
- [Your question here]
- Context:

#### Acceptance Criteria
- [ ] GitHub issue templates created
- [ ] Templates documented in README
- [ ] Example usage provided

---

### Task 15.7: Add CLI Feedback Prompts (MEDIUM)

**Priority**: MEDIUM
**Effort**: 1-2 hours
**Status**: PENDING

#### Implementation

Add feedback prompts to key CLI commands:

create-task.ts:
console.log('\n💡 Found a bug or have feedback?');
console.log('   Report issues: https://github.com/calebrosario/opencode-tools/issues/new');
console.log('   Feature requests: https://github.com/calebrosario/opencode-tools/issues/new?template=feature_request.md\n');

list-tasks.ts:
console.log('\n💡 Found a bug or have feedback?');
console.log('   Report issues: https://github.com/calebrosario/opencode-tools/issues/new');
console.log('   Feature requests: https://github.com/calebrosario/opencode-tools/issues/new?template=feature_request.md\n');

start-task.ts: Add feedback prompt after task start
task-history.ts: Add feedback prompt after showing history

#### Commands to Update
- create-task
- list-tasks
- start-task
- task-history

#### Acceptance Criteria
- [ ] Feedback prompts added to 4+ CLI commands
- [ ] Prompts show after command execution
- [ ] Links to GitHub issues page
- [ ] Not intrusive for normal usage

---

### Task 15.8: Create Weekly Feedback Summary (LOW)

**Priority**: LOW
**Effort**: 1 hour
**Status**: PENDING

#### Implementation

Create feedback collection and review process:

1. Monitor GitHub issues daily
2. Triage issues by severity (critical, high, medium, low)
3. Weekly review meeting
4. Prioritize for upcoming weeks
5. Document decisions

#### Feedback Process Document

Create .research/FEEDBACK-PROCESS.md:

# User Feedback Collection Process

## Triage Criteria

### Critical
- Bugs blocking development or testing
- Security vulnerabilities
- Data corruption or loss

### High
- Bugs affecting core functionality
- Performance issues
- Feature requests with high user demand

### Medium
- Minor bugs or UX issues
- Feature requests with medium demand
- Documentation improvements

### Low
- Nice-to-have features
- Minor improvements
- Documentation typos

## Weekly Review Process

### When
- Every Friday at 2:00 PM UTC
- Or after completing weekly tasks

### Who
- Lead developer
- Product manager (optional)

### Agenda
1. Review all new issues from past week
2. Review progress on critical issues
3. Discuss new feature requests
4. Prioritize for upcoming week
5. Make decisions on deferred items

### Output
1. Prioritized task list for next week
2. Decision log
3. Assigned owners

#### Acceptance Criteria
- [ ] Feedback collection process documented
- [ ] Review schedule established
- [ ] Triage criteria defined
- [ ] Prioritization framework created

---

## Success Criteria for Week 15

- [ ] Task 15.1: All TaskRegistry tests passing
- [ ] Task 15.2: All test files in standard locations
- [ ] Task 15.3: Docker port parsing implemented
- [ ] Task 15.4: All plan hook tests passing
- [ ] Task 15.5: Integration tests verified
- [ ] Task 15.6: GitHub issue templates created
- [ ] Task 15.7: CLI feedback prompts added
- [ ] Task 15.8: Feedback process documented
- [ ] Build passes with 0 errors
- [ ] All tasks committed

---

## Risk Assessment

### Medium Risks

1. **TaskRegistry auto-init may have side effects**
   - **Mitigation**: Test thoroughly, consider lazy initialization
   - **Fallback**: Add explicit opt-out flag

2. **Port parsing may be complex with Dockerode**
   - **Mitigation**: Start with basic parsing, iterate
   - **Fallback**: Document incomplete parsing, add to backlog

3. **User feedback volume unknown**
   - **Mitigation**: Start with lightweight approach, scale if needed
   - **Fallback**: Use GitHub issues and discussions as primary channels

---

## Resource Requirements

**Team Size**: 1-2 developers
**Timeline**: 1 week
**Dependencies**: None (Alpha release done)

---

## Next Steps

1. **Task 15.1** - Start with CRITICAL fix for TaskRegistry
2. **Task 15.2** - Move test files to standard locations
3. **Task 15.3** - Implement Docker port parsing
4. **Task 15.4** - Fix plan hooks tests
5. **Task 15.5-7** - Complete medium priority tasks
6. **Week 16 Planning** - Begin PostgreSQL integration planning

---

**Status**: Planning Complete ✅
**Ready for**: Week 15 implementation kickoff
**Next Session**: Begin Week 15 tasks starting with Task 15.1
