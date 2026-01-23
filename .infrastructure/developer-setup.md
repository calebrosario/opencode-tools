# Developer Setup Guide (Draft)

**Target Audience**: Developers working on OpenCode Tools
**Prerequisites**: Docker Desktop 4.30+, Node.js v20+, Git

---

## 1. Initial Setup

### 1.1 Clone Repository
```bash
git clone https://github.com/opencode/opencode-tools.git
cd opencode-tools
```

### 1.2 Install Dependencies
*(Note: package.json will be created in Phase 0 Infrastructure Week)*
```bash
npm install
```

### 1.3 Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```

**Required .env variables**:
- `DOCKER_SOCKET_PATH`: Path to Docker socket (default: `/var/run/docker.sock`)
- `LOG_LEVEL`: Logging verbosity (debug/info/warn/error)
- `MCP_PORT`: Port for MCP server (default: 3000)

---

## 2. Docker Development Environment

### 2.1 Start Dev Stack
We use Docker Compose for local development infrastructure (Redis, Postgres - optional):
```bash
docker-compose up -d
```

### 2.2 Verify Docker Connection
Run the connection check script:
```bash
npm run check-docker
```
*Output should show: "Connected to Docker Engine API v1.47+"*

---

## 3. Running the MCP Server

### 3.1 Start in Development Mode
```bash
npm run dev
```
This starts the MCP server with hot-reloading enabled.

### 3.2 Running Tests
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (requires Docker)
npm run test:integration
```

---

## 4. Project Structure

```
opencode-tools/
├── src/
│   ├── docker/       # Docker Engine API integration
│   ├── persistence/  # State management & SQLite
│   ├── mcp/          # MCP server & tools
│   └── util/         # Shared utilities
├── tests/            # Test suites
├── hooks/            # OpenCode hook definitions
├── .planning/        # Phase 0 planning documents
└── .infrastructure/  # Setup guides & configs
```

## 5. Troubleshooting

**Common Issues**:
1. **Docker Permission Denied**: Ensure your user is in the `docker` group.
2. **Port Conflicts**: Check if port 3000 is already in use.
3. **TypeScript Errors**: Run `npm run type-check` to verify types.

---
