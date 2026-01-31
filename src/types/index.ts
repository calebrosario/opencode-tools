// Core TypeScript interfaces and types for OpenCode Tools

// Re-export lifecycle types
export type { TaskConfig, TaskResult } from './lifecycle';

// Task-related types
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  owner?: string;
  metadata?: Record<string, any>;
}

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Container-related types
export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  createdAt: Date;
  ports?: ContainerPort[];
  networks?: string[];
  resources?: ResourceLimits;
}

export type ContainerStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'exited'
  | 'dead'
  | 'restarting'
  | 'removing';

export interface ContainerPort {
  containerPort: number;
  hostPort?: number;
  protocol: 'tcp' | 'udp';
}

export interface ResourceLimits {
  memory?: number; // MB
  cpuShares?: number;
  pidsLimit?: number;
  diskSpace?: number; // MB
}

// Network-related types
export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: 'local' | 'global';
  createdAt: Date;
}

// MCP-related types
export interface MCPTool {
  name: string;
  description: string;
  parameters: MCPParameter[];
  handler: MCPToolHandler;
}

export interface MCPParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
}

export type MCPToolHandler = (params: Record<string, any>) => Promise<any>;

export interface MCPRequest {
  id: string;
  tool: string;
  parameters: Record<string, any>;
  timestamp: Date;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: MCPError;
  timestamp: Date;
}

export interface MCPError {
  code: string;
  message: string;
  details?: any;
}

// Event system types
export interface SystemEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: Record<string, any>;
  source?: string;
}

// Concurrency and locking types (Phase 1)
export interface LockInfo {
  resource: string;
  owner: string;
  acquiredAt: Date;
  timeout?: number | undefined; // milliseconds
  version: number; // for optimistic locking
}

export type LockMode = 'exclusive' | 'collaborative';

// State persistence types (Phase 1)
export interface StateSnapshot {
  id: string;
  timestamp: Date;
  data: Record<string, any>;
  checksum: string; // SHA256
  version: number;
}

// Error types
export class OpenCodeError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'OpenCodeError';
  }
}

// Configuration types
export interface DatabaseConfig {
  path: string;
  migrationsPath: string;
  enableWAL: boolean;
  cacheSize: number;
}

export interface DockerConfig {
  socketPath: string;
  networkPrefix: string;
  containerPrefix: string;
  defaultResourceLimits: ResourceLimits;
}

export interface MCPConfig {
  port: number;
  host: string;
  maxConnections: number;
  requestTimeout: number;
}
