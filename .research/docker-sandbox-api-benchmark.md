# Research: Docker Sandbox API Benchmark & Viability Assessment

**Researcher**: Librarian Agent (External Research)
**Duration**: 1 day (accelerated due to discovery)
**Status**: Complete - CRITICAL FINDING
**Start Date**: 2026-01-20
**End Date**: 2026-01-20

---

## Goals
- [x] Determine if Docker Sandbox API is available as a programmatic API
- [x] Assess viability for production use case (task-based isolated containers)
- [x] Identify capabilities and limitations
- [x] Evaluate alternatives if Sandbox API is not suitable

---

## Methodology

### Approach
Conducted external research using Librarian agent to investigate:
- Official Docker documentation
- Docker Desktop release notes
- Docker blog announcements
- Alternative containerization APIs

### Tools Used
- Librarian Agent (external research)
- Docker CLI verification (local testing)
- Official documentation review

### Test Scenarios
1. Verify Docker Sandbox CLI availability (local testing)
2. Analyze official documentation for API capabilities
3. Compare with Docker Engine API features
4. Evaluate production readiness

---

## Research Findings

### Finding 1: Docker Sandbox is NOT a General-Purpose API
**Observation**: Docker Sandbox is NOT a general-purpose containerization API. It is a specialized CLI feature specifically designed for running AI coding agents (like Claude Code) in isolated containers.

**Evidence**:
- Docker Documentation: "Docker Sandboxes is an experimental feature"
- Docker Desktop 4.50.0 Release Notes (November 6, 2025) - Introduced as AI agent feature
- Docker Blog: "introducing Docker Sandboxes as a new approach for coding agent safety"
- Local testing: `docker sandbox` command exists, but no REST API endpoints available

**Significance**: This is a CRITICAL FINDING. Our original plan assumed Docker Sandbox API would provide programmatic container management, but this assumption was incorrect. Docker Sandbox is CLI-only, experimental, and not designed for production use.

### Finding 2: Docker Sandbox Lacks Required Capabilities
**Observation**: Docker Sandbox provides limited capabilities focused on AI agent workflows, not general-purpose containerization.

**Evidence**:
- Only CLI commands available: `docker sandbox run`, `ls`, `rm`, `inspect`, `version`
- No REST API endpoints for programmatic control
- No fine-grained resource control (CPU, memory, PIDs)
- No network isolation configuration options
- No lifecycle management API
- No multi-container orchestration capabilities

**Significance**: Docker Sandbox lacks the features we need for our production system:
- Task-based container lifecycle management
- Programmatic resource limiting
- Network isolation enforcement
- Multi-container coordination

### Finding 3: Docker Sandbox is Experimental
**Observation**: Docker Sandbox is an experimental feature with potential for breaking changes.

**Evidence**:
- Official docs state: "Experimental features may have potentially significant limitations...may change at any time without notice"
- Introduced in Docker Desktop 4.50.0 (November 6, 2025) - very recent
- No long-term stability track record
- Experimental policy: features may be discontinued

**Significance**: Using experimental features for production systems is high-risk. Breaking changes could cause system failures and require significant rework.

### Finding 4: No Programmatic API Available
**Observation**: Docker Sandbox has NO programmatic API - only CLI interface.

**Evidence**:
- CLI reference lists only CLI commands (run, ls, rm, inspect, version)
- No REST API documentation
- No SDK libraries for programmatic access
- Local testing confirms only CLI interface available

**Significance**: Our system requires programmatic container management through MCP server. Without API support, we cannot implement core functionality.

### Finding 5: Docker Engine API is the Correct Alternative
**Observation**: Docker Engine API (v1.47+) provides stable, mature, fully-programmatic container management.

**Evidence**:
- Official REST API documentation available
- Multi-language SDK support (Go, Python, JavaScript, .NET)
- Complete container lifecycle management
- Full resource limiting capabilities
- Network isolation configuration
- Security options (seccomp, AppArmor, user namespaces)
- Stable, production-ready API

**Significance**: Docker Engine API meets all our requirements and is production-ready. This should be our chosen approach.

---

## Benchmark Results

### Docker Sandbox Availability Test

| Test | Result | Details |
|------|---------|---------|
| Docker CLI Available | ✅ PASS | `docker sandbox --help` shows usage |
| Sandbox Commands | ✅ PASS | run, ls, rm, inspect, version available |
| REST API | ❌ FAIL | No API endpoints found |
| SDK Libraries | ❌ FAIL | No SDKs available |
| Programmatic Control | ❌ FAIL | CLI-only interface |

### Docker Engine API Availability Test

| Test | Result | Details |
|------|---------|---------|
| REST API | ✅ PASS | Docker Engine API v1.47+ documented |
| SDK Libraries | ✅ PASS | Go, Python, JavaScript, .NET available |
| Container Lifecycle | ✅ PASS | create, start, stop, remove, restart, kill |
| Resource Limits | ✅ PASS | memory, CPU, PIDs, blkio |
| Network Isolation | ✅ PASS | bridge, host, none, custom networks |
| Security Options | ✅ PASS | seccomp, AppArmor, user namespaces, capabilities |

### Feature Comparison

| Feature | Docker Sandbox | Docker Engine API | Requirement Met |
|---------|----------------|-------------------|-----------------|
| Programmatic Control | ❌ No | ✅ Yes | ✅ Engine API |
| Resource Limits | ❌ Limited | ✅ Full | ✅ Engine API |
| Network Isolation | ❌ Limited | ✅ Full | ✅ Engine API |
| Multi-language SDKs | ❌ No | ✅ Yes | ✅ Engine API |
| Production Ready | ❌ Experimental | ✅ Stable | ✅ Engine API |
| Official Documentation | ⚠️ Basic | ✅ Comprehensive | ✅ Engine API |
| Community Support | ⚠️ New | ✅ Mature | ✅ Engine API |

---

## Limitations

### Docker Sandbox Limitations
1. **CLI-only interface** - No programmatic API
2. **Experimental status** - May change or be discontinued
3. **AI agent-specific** - Designed for specific use case, not general-purpose
4. **Limited features** - No fine-grained control
5. **No production guarantee** - Experimental policy applies

### Docker Engine API Limitations
1. **Requires Docker daemon access** - Socket/HTTP connection needed
2. **Security considerations** - Socket mounting poses risks (CVE-2025-9074)
3. **Complexity** - More complex than CLI-based tools
4. **Version dependency** - Requires compatible Engine version

---

## Recommendations

### Recommendation 1: Use Docker Engine API (v1.47+)

**Reason**: Docker Engine API provides stable, mature, fully-programmatic container management with all required features for production use.

**Implementation**:
```yaml
Implementation Strategy:

1. REST API over Unix Socket:
   - Connect to Docker daemon via /var/run/docker.sock
   - Use HTTP/JSON API for all operations
   - Implement authentication (TLS if needed)

2. Multi-language SDK Support:
   - Use Go SDK (best performance, official)
   - Or use Python/JavaScript SDKs (if preferred)

3. Container Lifecycle Management:
   - POST /containers/create - Create container
   - POST /containers/{id}/start - Start container
   - POST /containers/{id}/stop - Stop container
   - DELETE /containers/{id} - Remove container

4. Resource Limits:
   - POST /containers/create with:
     - HostConfig.Memory: 512MB
     - HostConfig.MemorySwap: 512MB
     - HostConfig.CpuShares: 512
     - HostConfig.PidsLimit: 100
```

**Benefits**:
- ✅ Stable, production-ready API
- ✅ Full programmatic control
- ✅ Complete resource limiting
- ✅ Network isolation capabilities
- ✅ Security options (seccomp, AppArmor, user namespaces)
- ✅ Multi-language SDKs
- ✅ Comprehensive documentation
- ✅ Mature community support

**Risks**:
- ⚠️ Socket access security (mitigate with TLS, permissions)
- ⚠️ Higher complexity than CLI tools
- ⚠️ Requires Engine v1.47+ (current: v28.1.1 ✅)

---

### Recommendation 2: Implement Strong Security Hardening

**Reason**: Docker Engine API provides many security options. We should implement defense-in-depth strategy.

**Implementation**:
```yaml
Security Hardening Layers:

1. User Namespaces:
   - --userns=host or custom remap
   - Maps container root to unprivileged host user
   - Prevents privilege escalation

2. Seccomp Profiles:
   - --security-opt seccomp=profile.json
   - Restricts available syscalls
   - Limits kernel attack surface

3. AppArmor Profiles:
   - --security-opt apparmor=profile
   - Enforces system-level policies
   - Confines file access

4. Capability Dropping:
   - --cap-drop ALL
   - --cap-add specific capabilities only
   - Least privilege principle

5. Read-only Root:
   - --read-only
   - Prevents accidental modifications
   - Forces use of volumes for data

6. Network Isolation:
   - Custom bridge networks per workspace
   - No host network access
   - Explicit port mapping only
```

**Benefits**:
- ✅ Strong security boundary
- ✅ Prevents kernel exploits
- ✅ Limits privilege escalation
- ✅ Meets production security standards

---

### Recommendation 3: Consider Docker Compose v5 SDK (if using Go)

**Reason**: Docker Compose v5 introduces official Go SDK for declarative multi-container orchestration.

**Implementation**:
```go
// Example using Compose v5 SDK
package main

import (
    "github.com/docker/compose/v5/pkg/api"
)

func main() {
    compose, err := api.NewDefault()
    if err != nil {
        panic(err)
    }

    project, err := compose.LoadFromFile("docker-compose.yaml")
    if err != nil {
        panic(err)
    }

    err = compose.Up(project, api.UpOptions{})
    if err != nil {
        panic(err)
    }
}
```

**Benefits**:
- ✅ Official Go SDK (released January 2026)
- ✅ Declarative multi-container definitions
- ✅ Built-in networking
- ✅ Easier for complex orchestration

**Risks**:
- ⚠️ Requires Go language
- ⚠️ Less granular control than direct Engine API
- ⚠️ Primarily for multi-service applications

---

## Risks & Mitigations

### Risk 1: Docker Engine API Socket Security
**Description**: Accessing Docker daemon socket can be dangerous if not properly secured.

**Probability**: Medium
**Impact**: High
**Mitigation**:
- Use TLS-authenticated Docker socket
- Restrict socket file permissions (chmod 600)
- Never mount Docker socket into containers unless absolutely necessary
- Use Enhanced Container Isolation (Docker Desktop feature)

**Owner**: Backend Engineer

### Risk 2: CVE-2025-9074 - Container Isolation Bypass
**Description**: Containers can access Docker Engine API via default subnet.

**Probability**: Medium
**Impact**: High
**Mitigation**:
- Keep Docker Engine updated (v29.1.3+)
- Do not mount Docker socket into containers
- Use network isolation (custom bridge networks)
- Enable Enhanced Container Isolation

**Owner**: Security Engineer

### Risk 3: Resource Exhaustion Without Limits
**Description**: Without proper resource limits, containers can exhaust system resources.

**Probability**: High
**Impact**: Medium
**Mitigation**:
- Enforce memory limits (--memory)
- Enforce CPU limits (--cpus)
- Enforce PIDs limits (--pids-limit)
- Monitor resource usage continuously

**Owner**: Backend Engineer

### Risk 4: Using Experimental Features in Production
**Description**: Experimental features may break or be discontinued.

**Probability**: Low (since we're NOT using Sandbox)
**Impact**: High
**Mitigation**:
- Do NOT use Docker Sandbox in production
- Use only stable Docker Engine API features
- Pin specific Docker Engine versions
- Test all features thoroughly

**Owner**: Senior Architect

---

## Alternatives Considered

### Alternative 1: Docker Sandbox API (ORIGINAL PLAN)
**Pros**:
- Designed for AI agent workflows
- CLI interface is simple to use
- Built-in workspace mounting

**Cons**:
- ❌ No programmatic API (BLOCKING)
- ❌ Experimental feature (HIGH RISK)
- ❌ Limited capabilities
- ❌ Not designed for production
- ❌ May change without notice

**Why Rejected**: Cannot implement core functionality without programmatic API. Experimental status makes it unsuitable for production.

### Alternative 2: Docker Engine API (RECOMMENDED)
**Pros**:
- ✅ Stable, mature API
- ✅ Full programmatic control
- ✅ Complete resource limiting
- ✅ Network isolation capabilities
- ✅ Security options
- ✅ Multi-language SDKs
- ✅ Production-ready

**Cons**:
- ⚠️ Requires careful security configuration
- ⚠️ Higher complexity than CLI
- ⚠️ Socket access needs protection

**Why Chosen**: Meets all requirements and is production-ready.

### Alternative 3: Docker Compose v5 SDK
**Pros**:
- ✅ Official Go SDK (new, January 2026)
- ✅ Declarative multi-container
- ✅ Built-in networking

**Cons**:
- ⚠️ Requires Go language
- ⚠️ Less granular control than Engine API
- ⚠️ Primarily for multi-service apps

**Why Considered**: Good alternative if using Go and need multi-container orchestration.

### Alternative 4: Enhanced Container Isolation (ECI)
**Pros**:
- ✅ Stronger isolation via user namespaces
- ✅ Maps container root to unprivileged host user

**Cons**:
- ⚠️ Docker Desktop / Enterprise feature only
- ⚠️ Complex file permission handling
- ⚠️ Cannot share namespaces with host

**Why Considered**: Option for stronger security boundaries if using Docker Desktop.

---

## Next Steps

### Immediate (This Week)
- [x] Research Docker Sandbox API availability - COMPLETE (NOT AVAILABLE)
- [ ] Document Docker Engine API integration approach
- [ ] Create Docker Engine API prototype
- [ ] Update architecture decision record
- [ ] Update planning documents to reflect Engine API approach

### Short Term (Next 2-4 Weeks)
- [ ] Implement Docker Engine API integration
- [ ] Implement security hardening (seccomp, AppArmor, user namespaces)
- [ ] Implement resource limiting
- [ ] Implement network isolation
- [ ] Test with 10+ concurrent containers
- [ ] Performance benchmarking

### Long Term (Next 1-3 Months)
- [ ] Consider Docker Compose v5 SDK for multi-container orchestration
- [ ] Evaluate Enhanced Container Isolation
- [ ] Evaluate gVisor / Kata Containers for stronger security
- [ ] Implement comprehensive monitoring and observability

---

## Questions & Open Items

### Questions for Team
1. Should we use Go SDK or Python/JavaScript SDKs for Docker Engine API?
2. Do we need multi-container orchestration (consider Compose v5)?
3. Should we implement Enhanced Container Isolation (requires Docker Desktop)?
4. What security hardening level is required for production?

### Open Items Requiring Further Research
- [ ] Docker Engine API SDK evaluation (Go vs Python vs JavaScript)
- [ ] Enhanced Container Isolation evaluation
- [ ] gVisor / Kata Containers evaluation for stronger security

---

## Conclusion

**Summary**: Docker Sandbox API is NOT a general-purpose API. It is an experimental CLI feature specifically designed for AI coding agents, lacking programmatic control, fine-grained resource management, and production guarantees. Docker Engine API (v1.47+) is the correct choice for our production system.

**Key Takeaways**:
1. **Docker Sandbox is CLI-only, experimental, not suitable for production**
2. **Docker Engine API provides stable, mature, programmatic container management**
3. **Strong security hardening is required (seccomp, AppArmor, user namespaces)**
4. **CVE-2025-9074 mitigation is critical (don't mount Docker socket)**
5. **Resource limiting and network isolation are available via Engine API**

**Decision**: **REJECT Docker Sandbox API** - Do not use experimental CLI feature

**Follow-up Actions**:
- [x] Document this critical finding
- [ ] Update architecture decision record to recommend Docker Engine API
- [ ] Update all planning documents to reflect Docker Engine API approach
- [ ] Begin Docker Engine API prototyping
- [ ] Update risk register with new security considerations

---

## Appendix

### A. Docker Engine API v1.47 Capabilities

**Container Creation** (POST /containers/create):
- Image selection
- Command and args
- Environment variables
- Working directory
- User specification
- Labels and annotations
- Hostname and domainname
- MAC address
- Network disabled mode
- Stop signal
- HostConfig options

**HostConfig Options**:
```yaml
Resource Limits:
  - Memory: {type: "int", example: 536870912}  # 512MB
  - MemorySwap: {type: "int", example: 1073741824}  # 1GB
  - MemoryReservation: {type: "int"}
  - CpuShares: {type: "int", example: 512}
  - CpuPeriod: {type: "int"}
  - CpuQuota: {type: "int"}
  - CpusetCpus: {type: "string"}
  - CpuRealtimePeriod: {type: "int"}
  - CpuRealtimeRuntime: {type: "int"}
  - PidsLimit: {type: "int", example: 100}

Network Configuration:
  - Binds: {type: "array", example: ["/host:/container"]}
  - PortBindings: {type: "object"}
  - PublishAllPorts: {type: "boolean"}
  - NetworkMode: {type: "string", enum: ["bridge", "host", "none", "container:<name>", "custom:<name>"]}
  - Dns: {type: "array"}
  - DnsOptions: {type: "array"}
  - DnsSearch: {type: "array"}
  - ExtraHosts: {type: "array"}

Security Options:
  - Privileged: {type: "boolean", default: false}
  - ReadonlyRootfs: {type: "boolean"}
  - UsernsMode: {type: "string", enum: ["", "host"]}
  - SecurityOpt: {type: "array", example: ["seccomp=profile.json", "apparmor=profile"]}
  - CapAdd: {type: "array", example: ["NET_ADMIN"]}
  - CapDrop: {type: "array", example: ["ALL"]}
  - Ulimits: {type: "array"}
```

### B. References

**Docker Documentation**:
- Docker Sandboxes: https://docs.docker.com/ai/sandboxes/
- Docker Sandboxes Experimental: https://docs.docker.com/manuals/release-lifecycle.html
- Docker Engine API v1.47: https://docs.docker.com/reference/api/engine/version/v1.47/
- Resource Constraints: https://docs.docker.com/engine/containers/resource_constraints
- Security Options: https://docs.docker.com/engine/security/
- User Namespace Isolation: https://docs.docker.com/engine/security/userns-remap/

**Docker Blog**:
- Docker Sandboxes Announcement: https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/

**Release Notes**:
- Docker Desktop 4.50.0: https://docs.docker.com/desktop/release-notes/#4500
- Docker Desktop 4.56.0 (Compose v5): https://docs.docker.com/desktop/release-notes/#4560

**CVE References**:
- CVE-2025-9074: https://nvd.nist.gov/vuln/detail/CVE-2025-9074

---

**Last Updated**: 2026-01-20
**Reviewed By**: Sisyphus (AI Agent)
**Approved By**: [PENDING TEAM REVIEW]
