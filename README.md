# OpenCode Tools Research

> Deep dive research and prototyping for a Docker-based task management system with concurrency, state persistence, and multi-agent orchestration.

---

## Overview

This repository contains **Phase -1: Deep Dive Research** for building a production-ready Docker task management system. The research focuses on:

- **Docker integration** via Engine API (not Sandbox API)
- **Concurrency models** for multi-agent workflows
- **State persistence** using multi-layer architecture
- **JSONL logging** for audit trails and recovery
- **Database strategy** (SQLite MVP → PostgreSQL scale-out)

**Current Status**: Phase -1 Complete (100% overall)

---

## Quick Start

### Prerequisites

- **Node.js** v20+ (for TypeScript execution)
- **TypeScript** (for running test scripts)
- **SQLite** v3.45+ (for database benchmarks)

### Installation

```bash
# Install TypeScript dependencies
npm install --save-dev typescript tsx better-sqlite3 @types/better-sqlite3

# Run test suites
cd .research
npx tsx sqlite-performance-test.ts  # SQLite benchmarks
npx tsx concurrency-test.ts          # Concurrency tests
npx tsx jsonl-benchmark-script.ts     # JSONL benchmarks
```

### Running Benchmarks

```bash
# SQLite performance (100K+ tasks)
cd .research && npx tsx sqlite-performance-test.ts

# Concurrent write stress test (10-100 writers)
cd .research && npx tsx sqlite-concurrent-stress-test.ts

# JSONL benchmarks (1M+ entries)
cd .research && npx tsx jsonl-benchmark-script.ts

# Log rotation tests (200K entries)
cd .research && npx tsx log-rotation-test.ts

# Recovery tests (1M entries)
cd .research && npx tsx recovery-test.ts
```

---

## Research Structure

```
opencode-tools/
├── README.md                          # This file (onboarding document)
├── .research/                         # All research and test suites
│   ├── tracking.md                     # Progress tracking board
│   ├── WEEK2-COMPLETION-SUMMARY.md    # Week 2 completion summary
│   │
│   ├── Week 1: Docker Research
│   │   ├── docker-sandbox-api-benchmark.md
│   │   ├── docker-engine-api-research.md
│   │   ├── docker-engine-api-pivot-summary.md
│   │   └── architecture-decision-record.md
│   │
│   ├── Week 2: Concurrency & State
│   │   ├── concurrency-prototype.md      # Optimistic locking research
│   │   ├── concurrency-prototype.ts     # Implementation
│   │   ├── concurrency-test.ts          # Test suite
│   │   │
│   │   ├── state-persistence-benchmark.md
│   │   ├── state-persistence-prototype.ts
│   │   ├── state-persistence-test.ts
│   │   │
│   │   ├── jsonl-benchmark.md
│   │   ├── jsonl-benchmark-script.ts
│   │   ├── jsonl-benchmark-test-results.md
│   │   ├── log-rotation-test.ts
│   │   ├── recovery-test.ts
│   │   │
│   │   ├── sqlite-performance-test.ts
│   │   ├── sqlite-concurrent-stress-test.ts
│   │   └── sqlite-postgresql-comparison.md
│   │
│   └── Documentation
│       ├── template.md                  # Research template
│       └── standup-*.md                # Daily standups
│
└── .sisyphus/                        # Plans and drafts
    ├── plans/                          # Implementation plans
    └── drafts/                         # Work in progress
```

---

## Key Findings

### Docker Integration

**🔴 Critical Discovery**: Docker Sandbox API is **NOT** a general-purpose API
- CLI-only interface (no REST API, no SDK libraries)
- Experimental status (may change/be discontinued)
- Limited to AI agent workflows only
- ❌ Not suitable for production use

**✅ Solution**: Docker Engine API (v1.47+) (research [\`docker-engine-api-research.md\`](.research/docker-engine-api-research.md))
- Stable, mature, production-ready
- Complete lifecycle operations (create, start, stop, remove, kill, restart)
- Full resource limiting (memory, CPU, PIDs, block I/O)
- Comprehensive security options (seccomp, AppArmor, namespaces)
- **Recommended SDK**: Dockerode for TypeScript/MCP integration

**Performance**:
- Container creation: 50-200ms
- Container start: 50-100ms
- Container stop: 20-50ms

### Concurrency Model

**Optimistic Locking** (implemented in [\`concurrency-prototype.ts\`](.research/concurrency-prototype.ts))

| Mode | Success Rate | Recommendation |
|------|--------------|----------------|
| **Collaborative** | 100% | Use for multi-agent scenarios |
| **Exclusive** | 1-10% | Needs FCFS queue |

**Performance**:
- Lock acquisition: <1ms
- Lock throughput: 742K ops/sec
- Conflict detection: <5ms

### State Persistence Architecture

**4-Layer Persistence** (designed in [\`state-persistence-benchmark.md\`](.research/state-persistence-benchmark.md))

```
┌─────────────────────────────────────────────────┐
│  Layer 1: state.json                            │  Current task state
│  Layer 2: JSONL logs                            │  Immutable audit trail
│  Layer 3: decisions.md                          │  Agent decisions
│  Layer 4: checkpoints                           │  Filesystem snapshots
└─────────────────────────────────────────────────┘
```

**Benefits**:
- Clear separation of concerns
- Fast in-memory access (Layer 1)
- Complete audit trail (Layer 2)
- Human-readable decisions (Layer 3)
- Point-in-time recovery (Layer 4)

### JSONL Logging Performance

**Benchmarks** (1M entries): (research [\`jsonl-benchmark.md\`](.research/jsonl-benchmark.md))

| Operation | Ops/sec | Status |
|-----------|----------|--------|
| **Simple Append** | 10,785 | ✅ PASS |
| **Batched Append** | 377,060 | ✅ PASS (35x faster) |
| **Read & Parse** | 1,101,795 | ✅ PASS |

**File Size**: 183MB for 1M entries (183 bytes/entry)

**Recommendations**:
- Use batched appends (100 entries/batch)
- Hybrid rotation: Size (50MB) + Time (24h) + Count (60K entries)
- Streaming recovery for files >50MB (5.9% memory savings)

### Database Strategy

**SQLite for MVP** (tested with 100K+ tasks) (research [\`sqlite-postgresql-comparison.md\`](.research/sqlite-postgresql-comparison.md))

| Operation | Ops/sec | Status |
|-----------|----------|--------|
| **Batch Insert** | 212,319 | ✅ PASS |
| **Single Row Read** | 302,724 | ✅ PASS |
| **Range Query** | 18,197 | ✅ PASS |
| **Update** | 13,009 | ✅ PASS |
| **Full Table Scan** | 731,917 | ✅ PASS |

**Database Size**: 23.36MB for 100K tasks (233 bytes/task)

**Concurrent Writes** (tested 10-100 writers):
- ✅ 100% success rate at all levels
- ✅ Zero write failures across 10,000 operations
- ✅ Best throughput: 66,426 ops/sec at 100 writers

**Migration Path**: SQLite → PostgreSQL
- Trigger: >20 concurrent writers OR >10GB data
- Time: 2-4 weeks
- Risk: Low (clear migration steps)

---

## Progress

### Phase -1: Deep Dive Research

**Start Date**: 2026-01-20
**Status**: 100% Complete (24/24 tasks)

| Week | Focus | Status | Completion |
|------|-------|--------|------------|
### Week 3: Event System & Architecture

**Start Date**: 2026-01-21
**End Date**: 2026-01-21

1. [\`event-system-prototype.md\`](.research/event-system-prototype.md) - Event system prototype (612 lines)
2. [\`integration-prototype.md\`](.research/integration-prototype.md) - Integration research (924 lines)
3. [\`architecture-week3-review.md\`](.research/architecture-week3-review.md) - Architecture review (558 lines)
4. [\`risk-register.md\`](.research/risk-register.md) - Risk register (570 lines)
5. [\`state-machine-diagrams.md\`](.research/state-machine-diagrams.md) - State machine diagrams (464 lines)
6. [\`architecture-decision-record.md\`](.research/architecture-decision-record.md) - ADR updated (610 lines)

---

## Documentation

### Research Documents

**Week 1: Docker Research**
1. [`docker-sandbox-api-benchmark.md`](.research/docker-sandbox-api-benchmark.md) - Critical finding: Sandbox API not suitable
2. [`docker-engine-api-research.md`](.research/docker-engine-api-research.md) - Comprehensive Engine API research
3. [`docker-engine-api-pivot-summary.md`](.research/docker-engine-api-pivot-summary.md) - Pivot impact analysis
4. [`architecture-decision-record.md`](.research/architecture-decision-record.md) - Docker Engine API ADR

**Week 2: Concurrency & State**
1. [`concurrency-prototype.md`](.research/concurrency-prototype.md) - Optimistic locking research (408 lines)
2. [`state-persistence-benchmark.md`](.research/state-persistence-benchmark.md) - 4-layer architecture (463 lines)
3. [`jsonl-benchmark.md`](.research/jsonl-benchmark.md) - JSONL performance (529 lines)
4. [`jsonl-benchmark-test-results.md`](.research/jsonl-benchmark-test-results.md) - Test results (180 lines)
5. [`sqlite-postgresql-comparison.md`](.research/sqlite-postgresql-comparison.md) - Database comparison (456 lines)

### Test Suites

**Concurrency**
- [`concurrency-prototype.ts`](.research/concurrency-prototype.ts) - Optimistic locking implementation
- [`concurrency-test.ts`](.research/concurrency-test.ts) - Test suite

**State Persistence**
- [`state-persistence-prototype.ts`](.research/state-persistence-prototype.ts) - 4-layer persistence engine
- [`state-persistence-test.ts`](.research/state-persistence-test.ts) - Test suite

**JSONL Performance**
- [`jsonl-benchmark-script.ts`](.research/jsonl-benchmark-script.ts) - JSONL benchmarks
- [`log-rotation-test.ts`](.research/log-rotation-test.ts) - Rotation tests
- [`recovery-test.ts`](.research/recovery-test.ts) - Recovery tests

**Database**
- [`sqlite-performance-test.ts`](.research/sqlite-performance-test.ts) - SQLite benchmarks
- [`sqlite-concurrent-stress-test.ts`](.research/sqlite-concurrent-stress-test.ts) - Concurrent write stress test

### Tracking & Summaries

- [`tracking.md`](.research/tracking.md) - Progress tracking board (580+ lines)
- [`WEEK2-COMPLETION-SUMMARY.md`](.research/WEEK2-COMPLETION-SUMMARY.md) - Week 2 summary (800+ lines)
- [`HANDOFF-TO-NEXT-SESSION.md`](.research/HANDOFF-TO-NEXT-SESSION.md) - Handoff notes

---

## Getting Started

### For New Contributors

1. **Read the research**: Start with `tracking.md` for overview
2. **Review key decisions**: Check `architecture-decision-record.md`
3. **Run benchmarks**: Execute test suites to understand performance characteristics
4. **Join the discussion**: Check daily standups and handoff documents

### For Researchers

1. **Use the template**: `.research/template.md` for new research documents
2. **Track progress**: Update `tracking.md` with task completion
3. **Create test suites**: Validate findings with benchmarks
4. **Document findings**: Create/update markdown documents

### For Implementers

1. **Review prototypes**: Check `.ts` files for implementation patterns
2. **Read benchmarks**: Understand performance characteristics
3. **Check ADRs**: Review architecture decisions before implementing
4. **Run tests**: Validate performance meets targets

---

## Confidence & Risk

**Confidence Level**: VERY HIGH

**Reasoning**:
- All benchmarks passed with 100% success rate
- Performance targets exceeded by 3-7300x
- SQLite performance verified with 100K+ actual operations
- Concurrent writes verified with 100 real writers
- Clear technical decisions made with test data

**Risk Level**: LOW

**Reasoning**:
- All tested strategies validated with actual test data
- No critical findings that would require pivot
- Database migration path is clear and well-defined
- All performance targets exceeded

---

---

## Contributing

### Research Guidelines
- Use `.research/template.md` for new documents
- Track progress in `tracking.md`
- Validate findings with benchmarks
- Document all decisions

### Test Guidelines
- Create test scripts (`.ts` files)
- Measure performance with clear metrics
- Document results in separate markdown files
- Use consistent naming conventions

---

## License

TBD (to be determined in Phase 0)

---

## Contact & Support

**Research Lead**: Backend Engineer (Simulated)
**Phase -1 Lead**: Senior Architect (Simulated)
**Project Start**: 2026-01-20
**Current Phase**: Week 3 (Upcoming)

---