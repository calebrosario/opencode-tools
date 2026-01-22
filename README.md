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

**✅ Solution**: Docker Engine API (v1.47+)
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

**Optimistic Locking** (implemented in `concurrency-prototype.ts`)

| Mode | Success Rate | Recommendation |
|------|--------------|----------------|
| **Collaborative** | 100% | Use for multi-agent scenarios |
| **Exclusive** | 1-10% | Needs FCFS queue |

**Performance**:
- Lock acquisition: <1ms
- Lock throughput: 742K ops/sec
- Conflict detection: <5ms

### State Persistence Architecture

**4-Layer Persistence** (designed in `state-persistence-benchmark.md`)

```
┌─────────────────────────────────────────────────┐
│  Layer 1: state.json                        │  Current task state
│  Layer 2: JSONL logs                        │  Immutable audit trail
│  Layer 3: decisions.md                       │  Agent decisions
│  Layer 4: checkpoints                        │  Filesystem snapshots
└─────────────────────────────────────────────────┘
```

**Benefits**:
- Clear separation of concerns
- Fast in-memory access (Layer 1)
- Complete audit trail (Layer 2)
- Human-readable decisions (Layer 3)
- Point-in-time recovery (Layer 4)

### JSONL Logging Performance

**Benchmarks** (1M entries):

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

**SQLite for MVP** (tested with 100K+ tasks)

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
