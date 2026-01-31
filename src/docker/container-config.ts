// Container Configuration Types for Docker Manager

export interface ContainerConfig {
  name: string;
  image: string;
  command?: string[];
  entrypoint?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  mounts?: Mount[];
  ports?: PortConfig[];
  network?: string;
  networkAliases?: string[];
  dns?: string[];
  extraHosts?: string[];
  resourceLimits?: ResourceLimits;
  security?: SecurityOptions;
  restartPolicy?: RestartPolicy;
  hostname?: string;
  labels?: Record<string, string>;
  logOptions?: LogOptions;
  autoRemove?: boolean;
}

export interface ContainerInfo {
  id: string;
  shortId: string;
  name: string;
  image: string;
  status: ContainerStatus;
  createdAt: Date;
  ports?: PortConfig[];
  networks?: string[];
  resources?: ResourceLimits;
  labels?: Record<string, string>;
  hostname?: string;
  workingDir?: string;
}

export interface ContainerStats {
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

export interface LogStream {
  stdout: string[];
  stderr: string[];
}

export interface PruneResult {
  containersDeleted: string[];
  spaceReclaimed: number;
}

export interface Mount {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readOnly?: boolean;
}

export interface PortConfig {
  containerPort: number;
  hostPort?: number;
  hostIp?: string;
  protocol: 'tcp' | 'udp';
}

export interface ResourceLimits {
  memory?: number;
  memoryReservation?: number;
  memorySwap?: number;
  nanoCpus?: number;
  cpuShares?: number;
  cpuQuota?: number;
  cpuPeriod?: number;
  pidsLimit?: number;
  blkioWeight?: number;
}

export interface SecurityOptions {
  user?: string;
  capAdd?: string[];
  capDrop?: string[];
  seccompProfile?: string;
  appArmorProfile?: string;
  noNewPrivileges?: boolean;
  readonlyRootfs?: boolean;
  usernsMode?: string;
}

export interface RestartPolicy {
  name: 'no' | 'on-failure' | 'always' | 'unless-stopped';
  maximumRetryCount?: number;
}

export interface LogOptions {
  driver?: string;
  maxSize?: number;
  maxFiles?: number;
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
