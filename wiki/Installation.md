# Installation

## Prerequisites

### System Requirements

- **Node.js** v20+ ([Download](https://nodejs.org/))
- **TypeScript** v5.3+ (installed with npm)
- **SQLite** v3.45+ (included via better-sqlite3)
- **Docker** (for container operations) - [Download](https://www.docker.com/products/docker-desktop)

### Docker Setup

1. **Install Docker Desktop**
   - Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Follow installation instructions for your OS
   - Start Docker Desktop after installation

2. **Verify Docker Installation**

```bash
docker --version
docker info
```

3. **Check Docker Socket Permissions**

```bash
ls -la /var/run/docker.sock
```

If permissions are incorrect:

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in for changes to take effect
```

## Quick Install

### Clone Repository

```bash
# Clone the repository
git clone https://github.com/calebrosario/opencode-tools.git

# Navigate to project directory
cd opencode-tools
```

### Install Dependencies

Using `bun` (recommended):

```bash
bun install
```

Using `npm`:

```bash
npm install
```

### Build Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Run Tests

```bash
npm test
```

All tests should pass.

## Development Setup

### Development Mode

```bash
# Watch mode for development
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

### Start MCP Server

```bash
npm start
```

The MCP server starts on the configured port (default: 3000).

**Verify Server Running:**

```bash
curl http://localhost:3000/health
```

### Configure Environment

Create a `.env` file in the project root:

```bash
# Database configuration
OPENCODE_DB_PATH=./data/opencode.db

# MCP server configuration
OPENCODE_MCP_PORT=3000
OPENCODE_MCP_HOST=localhost

# Docker configuration
OPENCODE_DOCKER_SOCKET=/var/run/docker.sock
OPENCODE_DOCKER_NETWORK_PREFIX=opencode
```

### Configuration File

Create `config.json` in project root:

```json
{
  "database": {
    "path": "./data/opencode.db",
    "enableWAL": true,
    "cacheSize": 10000
  },
  "mcp": {
    "port": 3000,
    "host": "localhost",
    "maxConnections": 100,
    "requestTimeout": 30000
  },
  "docker": {
    "socketPath": "/var/run/docker.sock",
    "networkPrefix": "opencode",
    "defaultResourceLimits": {
      "memory": 512,
      "cpuShares": 512,
      "pidsLimit": 100
    }
  }
}
```

## Database Setup

### SQLite Database

The system uses SQLite with better-sqlite3 driver:

```bash
# Database is created automatically on first run
# Location: ./data/opencode.db
```

### Enable WAL Mode (Recommended)

WAL (Write-Ahead Logging) improves performance:

```bash
# Enable WAL mode via environment variable
OPENCODE_DB_WAL=true npm start
```

Or enable in `config.json`:

```json
{
  "database": {
    "path": "./data/opencode.db",
    "enableWAL": true
  }
}
```

### Database Migration (Future)

PostgreSQL migration planned for Phase 4:

- Use for >20 concurrent writers
- Better for distributed deployments
- Supports advanced features (replication, sharding)

## Docker Setup

### Verify Docker Socket

```bash
# Check socket exists
ls -la /var/run/docker.sock

# Test Docker connection
docker ps
```

### Create Docker Network (Optional)

```bash
# Create dedicated network for OpenCode
docker network create opencode-network
```

## IDE Setup

### VS Code

Install recommended extensions:

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - TypeScript support
- **Mermaid Preview** - Diagram rendering

**Configure VS Code:**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### JetBrains IDEs (WebStorm, IntelliJ)

- Install TypeScript plugin
- Enable ESLint plugin
- Configure Node.js runtime

## Common Installation Issues

### Issue: Permission Denied (Docker Socket)

**Symptom:**

```
Error: EACCES: permission denied, connect '/var/run/docker.sock'
```

**Solution:**

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and log back in
```

### Issue: Node.js Version Too Old

**Symptom:**

```
Error: This version of OpenCode Tools requires Node.js v20+
```

**Solution:**

```bash
# Upgrade Node.js using nvm
nvm install 20
nvm use 20
```

### Issue: Database Locked

**Symptom:**

```
Error: SQLITE_BUSY: database is locked
```

**Solution:**

```bash
# Check for other processes
lsof data/opencode.db

# Kill conflicting process (if safe)
kill -9 <pid>

# Or restart application (releases locks)
```

### Issue: Port Already in Use

**Symptom:**

```
Error: Port 3000 is already in use
```

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill process (if safe)
kill -9 <pid>

# Or use different port
OPENCODE_MCP_PORT=3001 npm start
```

## Production Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/opencode.service`:

```ini
[Unit]
Description=OpenCode Tools MCP Server
After=network.target docker.service

[Service]
Type=simple
User=opencode
WorkingDirectory=/opt/opencode-tools
ExecStart=/usr/bin/node /opt/opencode-tools/dist/index.js
Restart=always
RestartSec=10
Environment=OPENCODE_DB_PATH=/var/lib/opencode/opencode.db
Environment=OPENCODE_MCP_PORT=3000

[Install]
WantedBy=multi-user.target
```

Enable and start service:

```bash
sudo systemctl enable opencode
sudo systemctl start opencode
sudo systemctl status opencode
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
# Build image
docker build -t opencode-tools .

# Run container
docker run -d \
  --name opencode \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/opencode/data:/app/data \
  opencode
```

### PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/index.js --name opencode

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

## Verification

After installation, verify everything works:

```bash
# 1. Check Node.js version
node --version  # Should be v20+

# 2. Check TypeScript
tsc --version  # Should be v5.3+

# 3. Check Docker
docker --version
docker ps

# 4. Run tests
npm test

# 5. Start MCP server
npm start

# 6. Test MCP endpoint
curl http://localhost:3000/health

# 7. Run CLI command
npm run cli -- list-tasks
```

All checks should pass.

## Next Steps

- **[User Guide](User-Guide.md)** - Learn how to use the system
- **[API Reference](API-Reference.md)** - Complete API documentation
- **[Architecture](Architecture.md)** - System architecture

---

**Last Updated**: 2026-02-19
**Version**: 0.1.0-alpha
