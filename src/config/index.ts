import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables
config();

// Configuration schema
const configSchema = z.object({
  // Docker Configuration
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  DOCKER_NETWORK_PREFIX: z.string().default('opencode_'),
  DOCKER_CONTAINER_PREFIX: z.string().default('opencode_'),

  // Database Configuration
  DATABASE_PATH: z.string().default('./data/opencode.db'),
  DATABASE_MIGRATIONS_PATH: z.string().default('./migrations'),

  // MCP Server Configuration
  MCP_PORT: z.number().default(3000),
  MCP_HOST: z.string().default('localhost'),
  MCP_MAX_CONNECTIONS: z.number().default(50),
  MCP_REQUEST_TIMEOUT_MS: z.number().default(30000),

  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/opencode.log'),
  LOG_MAX_SIZE: z.string().default('50m'),
  LOG_MAX_FILES: z.number().default(7),

  // Resource Limits
  CONTAINER_MEMORY_MB: z.number().default(512),
  CONTAINER_CPU_SHARES: z.number().default(1024),
  CONTAINER_PIDS_LIMIT: z.number().default(100),

  // Security Configuration
  ALLOW_PRIVILEGED_CONTAINERS: z.boolean().default(false),
  ALLOW_HOST_NETWORK: z.boolean().default(false),
  ALLOWED_IMAGE_REGISTRIES: z.string().default('docker.io,ghcr.io'),

  // Development Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEBUG: z.boolean().default(false),
});

// Parse and validate configuration
export const CONFIG = configSchema.parse({
  DOCKER_SOCKET: process.env.DOCKER_SOCKET,
  DOCKER_NETWORK_PREFIX: process.env.DOCKER_NETWORK_PREFIX,
  DOCKER_CONTAINER_PREFIX: process.env.DOCKER_CONTAINER_PREFIX,
  DATABASE_PATH: process.env.DATABASE_PATH,
  DATABASE_MIGRATIONS_PATH: process.env.DATABASE_MIGRATIONS_PATH,
  MCP_PORT: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : undefined,
  MCP_HOST: process.env.MCP_HOST,
  MCP_MAX_CONNECTIONS: process.env.MCP_MAX_CONNECTIONS ? parseInt(process.env.MCP_MAX_CONNECTIONS) : undefined,
  MCP_REQUEST_TIMEOUT_MS: process.env.MCP_REQUEST_TIMEOUT_MS ? parseInt(process.env.MCP_REQUEST_TIMEOUT_MS) : undefined,
  LOG_LEVEL: process.env.LOG_LEVEL as any,
  LOG_FILE: process.env.LOG_FILE,
  LOG_MAX_SIZE: process.env.LOG_MAX_SIZE,
  LOG_MAX_FILES: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES) : undefined,
  CONTAINER_MEMORY_MB: process.env.CONTAINER_MEMORY_MB ? parseInt(process.env.CONTAINER_MEMORY_MB) : undefined,
  CONTAINER_CPU_SHARES: process.env.CONTAINER_CPU_SHARES ? parseInt(process.env.CONTAINER_CPU_SHARES) : undefined,
  CONTAINER_PIDS_LIMIT: process.env.CONTAINER_PIDS_LIMIT ? parseInt(process.env.CONTAINER_PIDS_LIMIT) : undefined,
  ALLOW_PRIVILEGED_CONTAINERS: process.env.ALLOW_PRIVILEGED_CONTAINERS === 'true',
  ALLOW_HOST_NETWORK: process.env.ALLOW_HOST_NETWORK === 'true',
  ALLOWED_IMAGE_REGISTRIES: process.env.ALLOWED_IMAGE_REGISTRIES,
  NODE_ENV: process.env.NODE_ENV as any,
  DEBUG: process.env.DEBUG === 'true',
});

// Export individual config values for convenience
export const {
  DOCKER_SOCKET,
  DOCKER_NETWORK_PREFIX,
  DOCKER_CONTAINER_PREFIX,
  DATABASE_PATH,
  DATABASE_MIGRATIONS_PATH,
  MCP_PORT,
  MCP_HOST,
  MCP_MAX_CONNECTIONS,
  MCP_REQUEST_TIMEOUT_MS,
  LOG_LEVEL,
  LOG_FILE,
  LOG_MAX_SIZE,
  LOG_MAX_FILES,
  CONTAINER_MEMORY_MB,
  CONTAINER_CPU_SHARES,
  CONTAINER_PIDS_LIMIT,
  ALLOW_PRIVILEGED_CONTAINERS,
  ALLOW_HOST_NETWORK,
  ALLOWED_IMAGE_REGISTRIES,
  NODE_ENV,
  DEBUG,
} = CONFIG;
