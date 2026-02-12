import type { ResourceLimits, ContainerStatus, ContainerInfo } from "../types";

// Port configuration for container
export interface PortConfig {
  containerPort: number;
  hostPort?: number;
  hostIp?: string;
  protocol: "tcp" | "udp";
}

// Volume mount configuration
export interface Mount {
  source: string; // Host path or volume name
  target: string; // Container path
  type: "bind" | "volume" | "tmpfs";
  readOnly?: boolean;
}

// Security configuration
export interface SecurityConfig {
  user?: string;
  capDrop?: string[];
  capAdd?: string[];
  readonlyRootfs?: boolean;
  usernsMode?: string;
  seccompProfile?: string;
  appArmorProfile?: string;
  noNewPrivileges?: boolean;
  privileged?: boolean;
}

// Docker volume configuration
export interface VolumeConfig {
  source?: string; // Volume name or host path
  target: string; // Container path
  type?: "volume" | "bind" | "tmpfs";
  readOnly?: boolean;
  consistency?: "default" | "consistent" | "cached" | "delegated";
}

// Health check configuration
export interface HealthCheckConfig {
  test?: string[] | string; // Command to run
  interval?: number; // Nanoseconds between checks
  timeout?: number; // Nanoseconds before timeout
  retries?: number; // Number of retries before unhealthy
  startPeriod?: number; // Nanoseconds to wait before starting checks
}

// Docker container log configuration (driver-level settings)
export interface ContainerLogConfig {
  driver?:
    | "json-file"
    | "syslog"
    | "journald"
    | "gelf"
    | "fluentd"
    | "awslogs"
    | "splunk"
    | "etwlogs"
    | "none";
  config?: Record<string, string | number>;
}

// Log configuration
export interface LogConfig {
  driver?: string;
  maxSize?: number; // bytes
  maxFiles?: number;
}

// Restart policy configuration
export interface RestartPolicyConfig {
  name: "no" | "on-failure" | "always";
  maximumRetryCount?: number;
}

// Extended resource limits (beyond basic ResourceLimits)
export interface ExtendedResourceLimits extends ResourceLimits {
  memoryReservation?: number; // bytes
  memorySwap?: number; // bytes
  nanoCpus?: number; // 10^9 CPU shares (1e9 = 1 CPU)
  cpuQuota?: number; // microseconds per period
  cpuPeriod?: number; // microseconds (100000 = 100ms)
  blkioWeight?: number; // 10-1000
}

// Container configuration
export interface ContainerConfig {
  name: string;
  image: string;
  command?: string[];
  entrypoint?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  mounts?: Mount[];
  volumes?: VolumeConfig[];
  ports?: PortConfig[];
  network?: string;
  networkAliases?: string[];
  dns?: string[];
  extraHosts?: string[];
  networkMode?: "bridge" | "host" | "none";
  resourceLimits?: ExtendedResourceLimits;
  security?: SecurityConfig;
  hostname?: string;
  logOptions?: LogConfig;
  autoRemove?: boolean;
  labels?: Record<string, string>;
  restartPolicy?: RestartPolicyConfig;
  healthCheck?: HealthCheckConfig;
  logConfig?: ContainerLogConfig;
}

// Container statistics (from Docker stats API)
export interface ContainerStats {
  id: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  pids: number;
}

// Log stream options and callback
export interface LogOptions {
  stdout?: boolean;
  stderr?: boolean;
  timestamps?: boolean;
  since?: number;
  until?: number;
  tail?: number;
}

// Log stream result with separated stdout/stderr
export interface LogStream {
  stdout: string[];
  stderr: string[];
}

// Container prune result
export interface PruneResult {
  containersDeleted: string[];
  spaceReclaimed: number;
}

// Re-export ContainerInfo from types
export type { ContainerInfo, ContainerStatus } from "../types";
