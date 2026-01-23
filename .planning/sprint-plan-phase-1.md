# Sprint Plan: Phase 1 (Critical Edge Cases)

**Sprint Goal**: Implement and verify 5 critical edge cases to establish a secure, robust foundation for the MVP.
**Duration**: 2 weeks (Weeks 6-8)
**Team**: 3 Developers (1 Lead, 2 Support)

---

## 1. Scope & Deliverables

### Critical Edge Cases (The "Big 5")
1.  **Concurrency & Locking** (Prevent race conditions)
2.  **Resource Exhaustion** (Prevent OOM/CPU starvation)
3.  **State Corruption Recovery** (Self-healing data)
4.  **Network Isolation** (Security boundaries)
5.  **MCP Server Crash Recovery** (Resilience)

### Acceptance Criteria
- [ ] All 5 edge cases implemented with test coverage >90%
- [ ] Load tests pass with 10+ concurrent agents
- [ ] Automated recovery proven in CI environment
- [ ] Zero manual intervention required for recovery

---

## 2. Task Breakdown

### Feature 1.1: Concurrency & Locking
**Owner**: [Backend 2]
- [ ] Implement `OptimisticLock` class with versioning
- [ ] Implement `LockManager` with timeout support
- [ ] Add collaborative mode conflict detection
- [ ] Test: 10 concurrent writers (Expect 100% success in collab mode)

### Feature 1.2: Resource Exhaustion
**Owner**: [DevOps]
- [ ] Implement `ResourceMonitor` service
- [ ] Add Docker resource limits (CPU, Memory, PIDs)
- [ ] Implement graceful shutdown on threshold warning
- [ ] Test: Simulate OOM condition (Expect controlled shutdown)

### Feature 1.3: State Corruption Recovery
**Owner**: [Backend 1]
- [ ] Implement SHA256 checksums for state files
- [ ] Create `StateValidator` run on startup
- [ ] Implement auto-restore from JSONL logs
- [ ] Test: Manually corrupt state.json (Expect auto-recovery <5s)

### Feature 1.4: Network Isolation
**Owner**: [DevOps]
- [ ] Create custom Docker bridge networks per task
- [ ] Implement allow-list for external access
- [ ] Block container-to-container traffic by default
- [ ] Test: Attempt cross-container ping (Expect failure)

### Feature 1.5: MCP Server Crash Recovery
**Owner**: [Backend 2]
- [ ] Implement supervisor process for MCP server
- [ ] Persist active tool state to disk
- [ ] Implement tool-resume capability
- [ ] Test: `kill -9` MCP server (Expect restart + state resume)

---

## 3. Timeline & Milestones

| Day | Milestone |
|-----|-----------|
| **Day 1-3** | Concurrency & Locking implementation |
| **Day 4-5** | Resource limits & Network isolation |
| **Day 6-7** | State corruption recovery logic |
| **Day 8** | MCP Crash recovery |
| **Day 9** | Integration testing & Stress testing |
| **Day 10** | Sprint Review & Demo |

---

## 4. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Locking overhead too high** | Use Redis for lock state if SQLite too slow |
| **Recovery takes too long** | Implement snapshot-based recovery points |
| **Docker networking flakes** | Use host networking fallback for dev, bridge for prod |

