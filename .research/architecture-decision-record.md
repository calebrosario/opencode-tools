# Architecture Decision Record: Docker Engine API vs Docker Sandbox API

**Status**: Accepted  
**Date**: 2026-01-20  
**Decision**: Use Docker Engine API (v1.47+) for container management  
**Context**: Phase -1 Research discovery

---

## Context

### Original Assumptions (INCORRECT)
Our original planning (docker-sandboxes-opencode-integration.md v2.0 and v2.1) assumed:
- Docker Sandbox API would provide a programmatic REST API for container management
- Sandbox API would offer fine-grained resource control (CPU, memory, PIDs)
- Sandbox API would support network isolation configuration
- Sandbox API would be production-ready for task-based isolated containers

### Research Discovery
On Day 1 of Phase -1 research, we discovered that these assumptions were INCORRECT:

**Docker Sandbox API Reality**:
- Introduced in Docker Desktop 4.50.0 (November 6, 2025) - very recent
- Status: **EXPERIMENTAL** feature
- Purpose: Specialized CLI tool for running AI coding agents securely
- Available Commands: `docker sandbox run`, `ls`, `rm`, `inspect`, `version` only
- **NO REST API endpoints** for programmatic control
- **NO SDK libraries** for application integration
- Limited to AI agent workflows, not general-purpose containerization
- Experimental policy: "may change at any time without notice"

### Our Requirements
Our system requires:
1. **Programmatic container management** (via MCP server)
2. **Fine-grained resource limiting** (memory, CPU, PIDs)
3. **Network isolation configuration** (custom bridge networks, port mapping)
4. **Multi-container orchestration** (task lifecycle, concurrent tasks)
5. **Production-ready stability** (long-term support, no breaking changes)
6. **Comprehensive security options** (seccomp, AppArmor, user namespaces)

---

## Decision

**We hereby DECIDE to use Docker Engine API (v1.47+) as the foundational technology for container management, rejecting Docker Sandbox API as unsuitable for production use.**

### Chosen Alternative: Docker Engine API (v1.47+)

**Why Docker Engine API?**
1. ✅ **Stable, mature API** - Well-established, battle-tested
2. ✅ **Complete programmatic control** - Full REST API over Unix socket/HTTP
3. ✅ **Multi-language SDK support** - Official Go, Python, JavaScript, .NET SDKs
4. ✅ **All required capabilities**:
   - Container lifecycle (create, start, stop, remove, restart, kill)
   - Resource limits (memory, CPU, PIDs, blkio)
   - Network isolation (bridge, host, none, custom networks)
   - Security options (seccomp, AppArmor, user namespaces, capabilities)
5. ✅ **Production-ready** - No experimental status, long-term support guarantee
6. ✅ **Comprehensive documentation** - Full API reference and examples
7. ✅ **Mature community support** - Extensive examples and troubleshooting

### Technical Implementation Plan

```yaml
Architecture Overview:
  
  1. REST API Layer:
     - Connect to Docker daemon via /var/run/docker.sock
     - Use HTTP/JSON protocol for all operations
     - Implement authentication (TLS if needed)
  
  2. SDK Choice:
     - Primary: Go SDK (docker/client) - best performance, official
     - Alternatives: Python SDK, JavaScript SDK (if preferred)
  
  3. Container Lifecycle:
     - POST /containers/create - Create task container
     - POST /containers/{id}/start - Start task
     - POST /containers/{id}/stop - Stop task (graceful)
     - POST /containers/{id}/kill - Kill task (force)
     - DELETE /containers/{id} - Remove task container
  
  4. Resource Limits (Per Container):
     POST /containers/create with HostConfig:
       - Memory: 512MB (minimum)
       - MemorySwap: 512MB
       - MemoryReservation: 256MB
       - CpuShares: 512 (0.5 CPU)
       - PidsLimit: 100 (prevent fork bomb)
  
  5. Network Isolation:
     - Create custom bridge network per workspace
     - Attach containers to workspace network
     - Block host network access (--network=none or custom)
     - Explicit port mapping (--publish) only when needed
  
  6. Security Hardening:
     - User namespaces (--userns=host or custom remap)
     - Seccomp profiles (--security-opt seccomp=profile.json)
     - AppArmor profiles (--security-opt apparmor=profile)
     - Capability dropping (--cap-drop ALL, --cap-add specific)
     - Read-only root (--read-only)
```

---

## Rejected Alternative: Docker Sandbox API

### Why Rejected

| Requirement | Docker Sandbox API | Docker Engine API | Decision |
|-------------|-------------------|-------------------|----------|
| Programmatic Control | ❌ CLI-only | ✅ REST API | Engine API ✅ |
| SDK Libraries | ❌ None | ✅ Go, Py, JS, .NET | Engine API ✅ |
| Resource Limits | ❌ Limited | ✅ Full | Engine API ✅ |
| Network Isolation | ❌ Limited | ✅ Full | Engine API ✅ |
| Production Ready | ❌ Experimental | ✅ Stable | Engine API ✅ |
| Documentation | ⚠️ Basic | ✅ Comprehensive | Engine API ✅ |
| Long-term Support | ⚠️ May be discontinued | ✅ Guaranteed | Engine API ✅ |

### Risks of Docker Sandbox API
1. 🔴 **No programmatic API** - BLOCKING: Cannot implement MCP server
2. 🔴 **Experimental status** - High risk of breaking changes
3. 🔴 **Limited capabilities** - Cannot implement required features
4. 🔴 **No production guarantee** - Experimental features may be discontinued
5. 🟠 **New and unproven** - No long-term track record

---

## Consequences

### Positive Consequences
1. ✅ **Clear technical foundation** - Stable, mature API with all required capabilities
2. ✅ **Production-ready** - No experimental risks, long-term support
3. ✅ **Better community support** - Extensive examples and troubleshooting
4. ✅ **More flexibility** - Full control over all container aspects
5. ✅ **Simplifies approach** - No experimental feature uncertainty

### Negative Consequences
1. ⚠️ **Increased complexity** - Requires more security configuration than Sandbox CLI
2. ⚠️ **Security considerations** - Docker socket access needs protection (CVE-2025-9074)
3. ⚠️ **Higher learning curve** - REST API more complex than CLI
4. ⚠️ **Manual orchestration** - Need to implement lifecycle management

### Mitigation Strategies

#### Complexity Mitigation
- Use official Docker SDKs (abstract away low-level API details)
- Create wrapper libraries for common operations
- Document all configuration patterns

#### Security Mitigation
```yaml
CVE-2025-9074 Mitigation:
  1. Never mount Docker socket into containers
  2. Use TLS-authenticated Docker socket (if remote access needed)
  3. Restrict socket file permissions (chmod 600)
  4. Use network isolation (custom bridge networks)
  5. Enable Enhanced Container Isolation (Docker Desktop feature)

Defense in Depth:
  1. User namespaces (--userns=host or remap)
  2. Seccomp profiles (--security-opt seccomp=profile.json)
  3. AppArmor profiles (--security-opt apparmor=profile)
  4. Capability dropping (--cap-drop ALL, --cap-add specific)
  5. Read-only root (--read-only)
  6. Resource limits (--memory, --cpus, --pids-limit)
```

#### Learning Curve Mitigation
- Provide comprehensive API documentation
- Create example code for all operations
- Provide testing utilities
- Document best practices and patterns

---

## Implementation Timeline

### Phase -1: Docker Engine API Research (Days 2-3)
- [x] Day 1: Docker Sandbox API discovery (completed)
- [ ] Day 2: Docker Engine API capabilities research
- [ ] Day 2: SDK evaluation (Go vs Python vs JavaScript)
- [ ] Day 3: Security hardening research
- [ ] Day 3: Resource limiting research
- [ ] Day 3: Network isolation research

### Phase 0: Planning (Weeks 4-5)
- Update all planning documents to reflect Docker Engine API approach
- Design Docker Engine API integration layer
- Define security hardening requirements
- Create development environment templates

### Phase 1: Critical Edge Cases (Weeks 6-8)
- Implement concurrency and locking (now using Engine API)
- Implement resource exhaustion handling (now using Engine API)
- Implement state corruption recovery (unchanged)
- Implement network isolation (now using Engine API)
- Implement MCP crash handling (unchanged)

### Phase 2: MVP Core (Weeks 9-14)
- Implement Task Registry (unchanged)
- Implement Docker Engine API integration layer (NEW)
- Implement MCP Server with Engine API tools (modified from Sandbox CLI)
- Implement resource limiting via Engine API (modified)
- Implement network isolation via Engine API (modified)
- All other MVP features unchanged

---

## Related Decisions

### Future Decisions Needed
1. **SDK Language Choice**: Go vs Python vs JavaScript
   - Default recommendation: Go SDK (best performance, official)
   - Alternative: Python SDK (if team prefers)
   - Decision needed: Phase 0 (Planning)

2. **Multi-Container Orchestration**: Consider Docker Compose v5 SDK
   - Scenario: Multiple containers per task
   - Go SDK available (released January 2026)
   - Decision needed: Phase 3 (Stability)

3. **Enhanced Container Isolation**: Evaluate for stronger security
   - Requires Docker Desktop
   - Stronger user namespace isolation
   - Decision needed: Phase 1 (Critical Edge Cases)

---

## References

### Docker Documentation
- Docker Engine API v1.47: https://docs.docker.com/reference/api/engine/version/v1.47/
- Resource Constraints: https://docs.docker.com/engine/containers/resource_constraints
- Security Options: https://docs.docker.com/engine/security/
- User Namespace Isolation: https://docs.docker.com/engine/security/userns-remap/

### Docker Blog & Release Notes
- Docker Sandboxes Announcement: https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/
- Docker Desktop 4.50.0: https://docs.docker.com/desktop/release-notes/#4500

### CVE References
- CVE-2025-9074: https://nvd.nist.gov/vuln/detail/CVE-2025-9074

### Internal Documents
- Docker Sandbox API Research: .research/docker-sandbox-api-benchmark.md
- Full Cycle Implementation Plan: .sisyphus/plans/full-cycle-implementation-plan.md
- Main Planning Document: .sisyphus/plans/docker-sandboxes-opencode-integration.md

---

## Approval

**Status**: ✅ ACCEPTED

**Approved By**: Architecture Team (pending formal review)  
**Approved Date**: 2026-01-20  
**Implementation Start**: Immediately

**Reviewers**:
- [ ] Senior Architect - Pending
- [ ] Backend Tech Lead - Pending
- [ ] Security Engineer - Pending

---

**ADR Status**: ACCEPTED - Ready for Implementation  
**Impact**: MAJOR PIVOT - Foundation technology changed  
**Timeline Impact**: +2-3 days (research adjustment), overall plan still viable  
**Confidence**: VERY HIGH - Docker Engine API is production-ready solution

---

**Last Updated**: 2026-01-20  
**Next Review**: Phase 0 (Planning)  
**Review Frequency**: Monthly during Phase -1, quarterly after Phase 0
