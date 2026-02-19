# Layered Agent Sandbox Architecture (Containers + MicroVMs + WASM)

This document outlines a **production‑grade sandboxing architecture for AI/LLM agents** that may execute untrusted or partially trusted code.  
It uses **defense in depth** by stacking multiple isolation layers instead of relying on a single sandbox.

---

## Mental Model

Each layer enforces isolation at a different boundary:

App Code  
↓  
WASM runtime sandbox  
↓  
OS sandbox policies  
↓  
Container namespaces  
↓  
Hypervisor boundary (MicroVM)  
↓  
Host kernel/hardware  

Lower = stronger isolation  
Higher = faster/lighter

---

## High-Level Architecture

Host
└─ MicroVM (Firecracker/Kata)  ← HARD security boundary
   └─ Docker container        ← packaging + workflow boundary
      └─ Agent runtime        ← orchestration only
         └─ WASM tools        ← safest execution surface

---

## Responsibilities by Layer

### 1) MicroVM (Firecracker / Kata)
Role: **Hard security boundary**

Protects against:
- Container escapes
- Kernel exploits
- Malicious dependencies
- Crypto miners / arbitrary payloads

Why:
- Separate kernel + memory space
- Hardware‑enforced isolation

Suggested config:
- 1 VM per task/job
- 256–1024MB RAM
- Read‑only rootfs
- No host mounts
- Restricted networking

---

### 2) Docker (inside VM)
Role: **Packaging + ergonomics**

Provides:
- Images
- Dependency isolation
- Reproducibility
- Logs/volumes
- Task lifecycle management

Note:
Containers are **not the security boundary anymore** — they are convenience.

---

### 3) Agent Runtime
Role: **Control plane only**

Responsibilities:
- Talks to the LLM
- Plans steps
- Chooses tools
- Manages files

Should NOT:
- Execute arbitrary code directly

Think:
Control plane, not compute plane.

---

### 4) WASM Tools
Role: **Safest execution environment**

Advantages:
- No syscalls by default
- Memory safe
- Capability-based permissions
- Very small attack surface
- Extremely fast startup
- Deterministic

Great for:
- Formatters
- Linters
- AST transforms
- Code analysis
- Diff/patch
- Data transforms

Not good for:
- Arbitrary bash
- Full Linux tools
- Complex system software

---

## Execution Flow

1. Scheduler spawns microVM
2. VM starts container image
3. Agent plans actions
4. Tools routed by risk level:

| Tool type | Execution |
|-----------|-----------|
| Pure compute | WASM |
| File ops | Container |
| Build/test | Container |
| Untrusted scripts | Separate microVM |

---

## Security Properties

If something breaks:

- WASM compromised → still inside container
- Container escape → still inside VM
- VM compromise → requires hypervisor exploit (rare)

Attacker must break:
WASM → container → kernel → hypervisor

This is extremely difficult in practice.

---

## Technology Stack Suggestions

### Simple
- Firecracker
- containerd
- Wasmtime
- Python agent

### Kubernetes
- Kata Containers
- k8s Jobs
- Wasmtime
- Network proxy

### Local dev
- Docker only
- WASM tools
- Add microVM in production

---

## Risk-Based Recommendations

Low risk (personal/dev)
→ OS sandbox or Docker

Medium risk (CI/team)
→ Docker + seccomp/AppArmor

High risk (LLM executes arbitrary code)
→ Docker + WASM

Very high risk (multi-tenant SaaS)
→ MicroVM + Docker + WASM

---

## Summary

Goal | Best Option
-----|-------------
Maximum safety | MicroVM
Maximum speed | WASM
Maximum compatibility | Docker
Maximum convenience | OS sandbox
Best overall | MicroVM + Docker + WASM

This layered design provides:
- Strong isolation
- High performance
- Practical developer ergonomics
- Defense in depth

It is currently the most robust architecture for running autonomous agents safely.
