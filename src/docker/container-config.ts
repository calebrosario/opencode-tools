// Container Configuration Types for Docker Manager
// Defines interfaces for container creation, resource limits, and security options

/**
 * Mount configuration for volumes
 */
export interface Mount {
  /** Host path or volume name */
  source: string;
  /** Container path */
  target: string;
  /** Mount type: bind, volume, or tmpfs */
  type: 'bind' | 'volume' | 'tmpfs';
  /** Read-only flag */
  readOnly?: boolean;
  /** Propagation mode for bind mounts */
  propagation?: 'private' | 'rprivate' | 'shared' | 'rshared' | 'slave' | 'rslave';
}

/**
 * Container resource limits
 */
export interface ResourceLimits {
  /** Memory limit in bytes (default: 512MB) */
  memory?: number;
  /** Memory soft limit (reservation) in bytes */
  memoryReservation?: number;
  /** Total memory + swap limit in bytes (default: memory * 2) */
  memorySwap?: number;
  /** CPU shares (relative weight, default: 1024) */
  cpuShares?: number;
  /** CPU quota in microseconds (e.g., 50000 for 0.5 CPU) */
  cpuQuota?: number;
  /** CPU period in microseconds (default: 100000) */
  cpuPeriod?: number;
  /** Nano CPUs (e.g., 500000000 for 0.5 CPU) */
  nanoCpus?: number;
  /** Maximum number of processes (PIDs) */
  pidsLimit?: number;
  /** Block I/O weight (10-1000, default: 500) */
  blkioWeight?: number;
  /** Block I/O read rate limit in bytes per second */
  blkioDeviceReadBps?: { path: string; rate: number }[];
  /** Block I/O write rate limit in bytes per second */
  blkioDeviceWriteBps?: { path: string; rate: number }[];
}

/**
 * Container security options
 */
export interface SecurityOptions {
  /** Drop all Linux capabilities except those listed */
  capDrop?: string[];
  /** Add specific Linux capabilities */
  capAdd?: string[];
  /** Seccomp profile path */
  seccompProfile?: string;
  /** AppArmor profile name */
  appArmorProfile?: string;
  /** User namespace mode */
  usernsMode?: string;
  /** Read-only root filesystem */
  readonlyRootfs?: boolean;
  /** No new privileges flag */
  noNewPrivileges?: boolean;
  /** User to run container as (UID or username) */
  user?: string;
}

/**
 * Container port binding
 */
export interface PortBinding {
  /** Container port */
  containerPort: number;
  /** Host port (optional, auto-assigned if not specified) */
  hostPort?: number;
  /** Protocol */
  protocol: 'tcp' | 'udp';
  /** Host IP to bind to (optional) */
  hostIp?: string;
}

/**
 * Container log options
 */
export interface LogOptions {
  /** Log driver (default: json-file) */
  driver?: 'json-file' | 'syslog' | 'journald' | 'none';
  /** Maximum log file size in bytes */
  maxSize?: number;
  /** Maximum number of log files */
  maxFiles?: number;
}

/**
 * Container restart policy
 */
export type RestartPolicy = 'no' | 'on-failure' | 'always' | 'unless-stopped';

/**
 * Container restart policy configuration
 */
export interface RestartPolicyConfig {
  /** Policy type */
  name: RestartPolicy;
  /** Maximum retry count (for 'on-failure') */
  maximumRetryCount?: number;
}

/**
 * Complete container configuration
 */
export interface ContainerConfig {
  /** Container name */
  name: string;
  /** Docker image to use */
  image: string;
  /** Command to run (overrides image CMD) */
  command?: string[];
  /** Entry point (overrides image ENTRYPOINT) */
  entrypoint?: string[];
  /** Working directory */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Volume mounts */
  mounts?: Mount[];
  /** Port bindings */
  ports?: PortBinding[];
  /** Network mode or network name */
  network?: string;
  /** Network aliases (for custom networks) */
  networkAliases?: string[];
  /** DNS servers */
  dns?: string[];
  /** Extra hosts (hostname:ip) */
  extraHosts?: string[];
  /** Resource limits */
  resourceLimits?: ResourceLimits;
  /** Security options */
  security?: SecurityOptions;
  /** Restart policy */
  restartPolicy?: RestartPolicyConfig;
  /** Hostname */
  hostname?: string;
  /** Labels (metadata) */
  labels?: Record<string, string>;
  /** Log options */
  logOptions?: LogOptions;
  /** Detached mode (run in background) */
  detached?: boolean;
  /** Remove container on exit */
  autoRemove?: boolean;
}

/**
 * Container information
 */
export interface ContainerInfo {
  /** Container ID */
  id: string;
  /** Container name */
  name: string;
  /** Docker image */
  image: string;
  /** Container ID (short) */
  shortId: string;
  /** Container status */
  status: ContainerStatus;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp (if running) */
  startedAt?: Date;
  /** Exit code (if exited) */
  exitCode?: number;
  /** Port bindings */
  ports?: PortBinding[];
  /** Network names */
  networks?: string[];
  /** Resource limits */
  resources?: ResourceLimits;
  /** Labels */
  labels?: Record<string, string>;
  /** Hostname */
  hostname?: string;
  /** Working directory */
  workingDir?: string;
}

/**
 * Container statistics (live metrics)
 */
export interface ContainerStats {
  /** CPU usage percentage */
  cpuPercent: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Memory usage percentage */
  memoryPercent: number;
  /** Network RX (receive) bytes */
  networkRxBytes: number;
  /** Network TX (transmit) bytes */
  networkTxBytes: number;
  /** Block I/O read bytes */
  blockReadBytes: number;
  /** Block I/O write bytes */
  blockWriteBytes: number;
  /** PIDs count */
  pids: number;
}

/**
 * Prune result
 */
export interface PruneResult {
  /** Containers deleted */
  containersDeleted: string[];
  /** Space reclaimed in bytes */
  spaceReclaimed: number;
}

/**
 * Log stream
 */
export interface LogStream {
  /** Standard output lines */
  stdout?: string[];
  /** Standard error lines */
  stderr?: string[];
}
