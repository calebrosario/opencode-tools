// Docker Manager - Full Lifecycle Implementation
// Week 11, Task 11.1: Complete Docker Manager with Dockerode SDK

import Dockerode from 'dockerode';
import { logger } from '../util/logger';
import {
  DOCKER_SOCKET_PATH,
  DOCKER_CONTAINER_PREFIX,
  CONTAINER_MEMORY_MB,
  CONTAINER_CPU_SHARES,
  CONTAINER_PIDS_LIMIT,
} from '../config';
import {
  OpenCodeError,
  ContainerStatus,
} from '../types';
import type {
  ContainerConfig as DockerContainerConfig,
  ContainerInfo as DockerContainerInfo,
  ContainerStats as DockerContainerStats,
  LogStream,
  PruneResult,
} from './container-config';
import Docker from 'dockerode';

// Map our types to Dockerode types
interface DockerodeContainerInfo {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Created: number;
  Status: string;
  Ports: any[];
  NetworkSettings?: {
    Networks?: Record<string, { NetworkID: string }>;
  };
  Labels?: Record<string, string>;
  Config?: {
    Hostname: string;
    WorkingDir: string;
    Labels?: Record<string, string>;
  };
  HostConfig?: {
    Memory?: number;
    NanoCpus?: number;
    PidsLimit?: number;
  };
}

interface DockerodeContainerStats {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage?: number[] | null;
    };
    system_cpu_usage: number;
    online_cpus: number;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage?: number;
    limit?: number;
    stats?: {
      cache?: number;
    };
  };
  networks?: Record<string, {
    rx_bytes: number;
    tx_bytes: number;
  }>;
  blkio_stats?: {
    io_service_bytes_recursive?: Array<{
      op: string;
      value: number;
    }>;
  };
  pids_stats: {
    current: number;
  };
}

/**
 * Docker Manager - Complete lifecycle implementation
 */
export class DockerManager {
  private docker: Dockerode;
  private static instance: DockerManager;
  private initialized: boolean = false;

  private constructor() {
    this.docker = new Dockerode({
      socketPath: DOCKER_SOCKET_PATH,
    });
  }

  public static getInstance(): DockerManager {
    if (!DockerManager.instance) {
      DockerManager.instance = new DockerManager();
    }
    return DockerManager.instance;
  }

  /**
   * Initialize Docker Manager and test connection
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Test Docker connection
      const info = await this.docker.info();
      this.initialized = true;

      logger.info('✅ Connected to Docker Engine API', {
        version: info.ServerVersion,
        apiVersion: info.APIVersion,
        containers: info.Containers,
        images: info.Images,
        os: info.OperatingSystem,
        architecture: info.Architecture,
      });
    } catch (error: unknown) {
      logger.error('❌ Failed to connect to Docker Engine API', {
        error: error instanceof Error ? error.message : String(error),
        socketPath: DOCKER_SOCKET_PATH,
      });
      throw new OpenCodeError(
        'DOCKER_CONNECTION_FAILED',
        'Failed to connect to Docker Engine API',
        { socketPath: DOCKER_SOCKET_PATH, error }
      );
    }
  }

  // =========================================================================
  // Container Lifecycle Methods
  // =========================================================================

  /**
   * Create a new container
   * @param config Container configuration
   * @returns Container ID
   */
  public async createContainer(config: DockerContainerConfig): Promise<string> {
    try {
      await this.ensureInitialized();

      // Build Dockerode create options
      const createOptions = this.buildCreateOptions(config);

      logger.info('Creating container', {
        name: config.name,
        image: config.image,
        memory: config.resourceLimits?.memory,
        cpu: config.resourceLimits?.nanoCpus,
      });

      const container = await this.docker.createContainer(createOptions);
      const containerId = container.id;

      logger.info('✅ Container created', {
        containerId,
        name: config.name,
      });

      return containerId;
    } catch (error: unknown) {
      logger.error('Failed to create container', {
        name: config.name,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_CREATE_FAILED',
        `Failed to create container: ${config.name}`,
        { name: config.name, error }
      );
    }
  }

  /**
   * Start a container
   * @param containerId Container ID
   */
  public async startContainer(containerId: string): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Starting container', { containerId });

      await container.start();

      logger.info('✅ Container started', { containerId });
    } catch (error: unknown) {
      logger.error('Failed to start container', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_START_FAILED',
        `Failed to start container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Stop a container gracefully
   * @param containerId Container ID
   * @param timeout Timeout in seconds (default: 10)
   */
  public async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Stopping container', { containerId, timeout });

      await container.stop({ t: timeout });

      logger.info('✅ Container stopped', { containerId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Ignore "container not running" errors
      if (errorMessage.includes('is not running') || errorMessage.includes('No such container')) {
        logger.warn('Container already stopped or does not exist', { containerId });
        return;
      }

      logger.error('Failed to stop container', {
        containerId,
        error: errorMessage,
      });

      throw new OpenCodeError(
        'CONTAINER_STOP_FAILED',
        `Failed to stop container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Restart a container
   * @param containerId Container ID
   * @param timeout Timeout in seconds (default: 10)
   */
  public async restartContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Restarting container', { containerId, timeout });

      await container.restart({ t: timeout });

      logger.info('✅ Container restarted', { containerId });
    } catch (error: unknown) {
      logger.error('Failed to restart container', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_RESTART_FAILED',
        `Failed to restart container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Pause a container
   * @param containerId Container ID
   */
  public async pauseContainer(containerId: string): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Pausing container', { containerId });

      await container.pause();

      logger.info('✅ Container paused', { containerId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Ignore "already paused" errors
      if (errorMessage.includes('is already paused')) {
        logger.warn('Container already paused', { containerId });
        return;
      }

      logger.error('Failed to pause container', {
        containerId,
        error: errorMessage,
      });

      throw new OpenCodeError(
        'CONTAINER_PAUSE_FAILED',
        `Failed to pause container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Unpause a container
   * @param containerId Container ID
   */
  public async unpauseContainer(containerId: string): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Unpausing container', { containerId });

      await container.unpause();

      logger.info('✅ Container unpaused', { containerId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Ignore "not paused" errors
      if (errorMessage.includes('is not paused')) {
        logger.warn('Container not paused', { containerId });
        return;
      }

      logger.error('Failed to unpause container', {
        containerId,
        error: errorMessage,
      });

      throw new OpenCodeError(
        'CONTAINER_UNPAUSE_FAILED',
        `Failed to unpause container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Kill a container forcefully
   * @param containerId Container ID
   * @param signal Signal to send (default: SIGKILL)
   */
  public async killContainer(containerId: string, signal: string = 'SIGKILL'): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Killing container', { containerId, signal });

      await container.kill({ signal });

      logger.info('✅ Container killed', { containerId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Ignore "already stopped" errors
      if (errorMessage.includes('is not running') || errorMessage.includes('No such container')) {
        logger.warn('Container already stopped or does not exist', { containerId });
        return;
      }

      logger.error('Failed to kill container', {
        containerId,
        error: errorMessage,
      });

      throw new OpenCodeError(
        'CONTAINER_KILL_FAILED',
        `Failed to kill container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Remove a container
   * @param containerId Container ID
   * @param force Force removal even if running
   * @param removeVolumes Remove associated volumes
   */
  public async removeContainer(
    containerId: string,
    force: boolean = false,
    removeVolumes: boolean = false
  ): Promise<void> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);

      logger.info('Removing container', { containerId, force, removeVolumes });

      await container.remove({ v: removeVolumes, force });

      logger.info('✅ Container removed', { containerId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Ignore "already removed" errors
      if (errorMessage.includes('No such container')) {
        logger.warn('Container already removed', { containerId });
        return;
      }

      logger.error('Failed to remove container', {
        containerId,
        error: errorMessage,
      });

      throw new OpenCodeError(
        'CONTAINER_REMOVE_FAILED',
        `Failed to remove container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  // =========================================================================
  // Container Info Methods
  // =========================================================================

  /**
   * Inspect container details
   * @param containerId Container ID
   * @returns Container information
   */
  public async inspectContainer(containerId: string): Promise<DockerContainerInfo> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);
      const info = await container.inspect() as any;

      return this.mapContainerInfo(info);
    } catch (error: unknown) {
      logger.error('Failed to inspect container', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_INSPECT_FAILED',
        `Failed to inspect container: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Get container status
   * @param containerId Container ID
   * @returns Container status
   */
  public async getContainerStatus(containerId: string): Promise<ContainerStatus> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);
      const info = await container.inspect() as any;

      return this.mapContainerStatus(info.State || "unknown");
    } catch (error: unknown) {
      logger.error('Failed to get container status', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_STATUS_FAILED',
        `Failed to get container status: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Get container logs
   * @param containerId Container ID
   * @param options Log options
   * @returns Log stream
   */
  public async getContainerLogs(
    containerId: string,
    options: {
      stdout?: boolean;
      stderr?: boolean;
      tail?: number;
      since?: number;
      timestamps?: boolean;
    } = {}
  ): Promise<LogStream> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);


      const logOptions = {
        stdout: options.stdout !== false,
        stderr: options.stderr !== false,
        tail: options.tail || 100,
        since: options.since,
        timestamps: options.timestamps || false,
        follow: false,
      } as Docker.ContainerLogsOptions;


      const logs = await (container.logs as any)(logOptions);

      const logString = logs.toString();

      // Parse demuxed logs (stdout/stderr separation)
      const result: LogStream = { stdout: [], stderr: [] };

      if (logOptions.stdout) {
        result.stdout = logString
          .split('\n')
          .filter((line: string) => line && !line.startsWith("└─"))
          .map((line: string) => line.replace(/^\d+ /, ""));
      }

      if (logOptions.stderr) {
        result.stderr = logString
          .split('\n')
          .filter((line: string) => line && line.startsWith("└─"))
          .map((line: string) => line.replace(/^└─\d+ /, ""));
      }

      return result;
    } catch (error: unknown) {
      logger.error('Failed to get container logs', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_LOGS_FAILED',
        `Failed to get container logs: ${containerId}`,
        { containerId, error }
      );
    }
  }

  /**
   * Get container statistics
   * @param containerId Container ID
   * @returns Container statistics
   */
  public async getContainerStats(containerId: string): Promise<DockerContainerStats> {
    try {
      await this.ensureInitialized();

      const container = this.docker.getContainer(containerId);
      const stats = (await container.stats({ stream: false })) as DockerodeContainerStats;

      return this.mapContainerStats(stats);
    } catch (error: unknown) {
      logger.error('Failed to get container stats', {
        containerId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_STATS_FAILED',
        `Failed to get container stats: ${containerId}`,
        { containerId, error }
      );
    }
  }

  // =========================================================================
  // Batch Operations
  // =========================================================================

  /**
   * List all containers
   * @param all Include stopped containers
   * @returns List of container information
   */
  public async listContainers(all: boolean = false): Promise<DockerContainerInfo[]> {
    try {
      await this.ensureInitialized();

      const containers = await this.docker.listContainers({ all });

      return containers.map(container => this.mapListedContainerInfo(container as unknown as DockerodeContainerInfo));
    } catch (error: unknown) {
      logger.error('Failed to list containers', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_LIST_FAILED',
        'Failed to list containers',
        { error }
      );
    }
  }

  /**
   * Prune stopped containers
   * @returns Prune result
   */
  public async pruneContainers(): Promise<PruneResult> {
    try {
      await this.ensureInitialized();

      logger.info('Pruning stopped containers');

      const result = await this.docker.pruneContainers();

      logger.info('✅ Containers pruned', {
        containersDeleted: result.ContainersDeleted?.length || 0,
        spaceReclaimed: result.SpaceReclaimed || 0,
      });

      return {
        containersDeleted: result.ContainersDeleted || [],
        spaceReclaimed: result.SpaceReclaimed || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to prune containers', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'CONTAINER_PRUNE_FAILED',
        'Failed to prune containers',
        { error }
      );
    }
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Ensure Docker Manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Build Dockerode create options from ContainerConfig
   */
  private buildCreateOptions(config: DockerContainerConfig): Docker.ContainerCreateOptions {
    const { name, image, command, entrypoint, workingDir, env, mounts, ports, network, networkAliases, dns, extraHosts, resourceLimits, security, restartPolicy, hostname, labels, logOptions, autoRemove } = config;

    // Default resource limits from config
    const defaultMemory = CONTAINER_MEMORY_MB * 1024 * 1024;
    const defaultCpuShares = CONTAINER_CPU_SHARES;
    const defaultPidsLimit = CONTAINER_PIDS_LIMIT;

    // Build environment array
    const envArray = env
      ? Object.entries(env).map(([key, value]) => `${key}=${value}`)
      : [];

    // Build port bindings
    const portBindings: Record<string, Array<{ HostPort: string; HostIp?: string }>> = {};
    const exposedPorts: Record<string, {}> = {};

    if (ports) {
      for (const port of ports) {
        const portKey = `${port.containerPort}/${port.protocol}`;
        exposedPorts[portKey] = {};

        if (portBindings[portKey]) {
          portBindings[portKey].push({
            HostPort: port.hostPort?.toString() || '',
            HostIp: port.hostIp || '',
          });
        } else {
          portBindings[portKey] = [
            {
              HostPort: port.hostPort?.toString() || '',
              HostIp: port.hostIp || '',
            },
          ];
        }
      }
    }

    // Build volume bindings (bind mounts and volumes)
    const binds: string[] = [];
    if (mounts) {
      for (const mount of mounts) {
        if (mount.type === 'bind' || mount.type === 'volume') {
          const readOnly = mount.readOnly ? ':ro' : '';
          binds.push(`${mount.source}:${mount.target}${readOnly}`);
        }
      }
    }

    // Build HostConfig
    const hostConfig: Docker.HostConfig = {
      Binds: binds,
      PortBindings: portBindings,
      AutoRemove: autoRemove || false,
      RestartPolicy: restartPolicy
        ? {
            Name: restartPolicy.name,
            MaximumRetryCount: restartPolicy.maximumRetryCount,
          }
        : { Name: 'no' },
      LogConfig: logOptions
        ? {
            Type: logOptions.driver || 'json-file',
            Config: {
              'max-size': logOptions.maxSize ? `${logOptions.maxSize}b` : '10m',
              'max-file': (logOptions.maxFiles || 3).toString(),
            },
          }
        : undefined,
      Dns: dns,
      ExtraHosts: extraHosts,
    };

    // Apply resource limits
    if (resourceLimits) {
      hostConfig.Memory = resourceLimits.memory || defaultMemory;
      hostConfig.MemoryReservation = resourceLimits.memoryReservation;
      hostConfig.MemorySwap = resourceLimits.memorySwap;
      hostConfig.NanoCpus = resourceLimits.nanoCpus;
      hostConfig.CpuShares = resourceLimits.cpuShares || defaultCpuShares;
      hostConfig.CpuQuota = resourceLimits.cpuQuota;
      hostConfig.CpuPeriod = resourceLimits.cpuPeriod;
      hostConfig.PidsLimit = resourceLimits.pidsLimit || defaultPidsLimit;
      hostConfig.BlkioWeight = resourceLimits.blkioWeight;
    }

    // Apply security options
    if (security) {
      if (security.capDrop) {
        hostConfig.CapDrop = security.capDrop;
      }
      if (security.capAdd) {
        hostConfig.CapAdd = security.capAdd;
      }
      if (security.readonlyRootfs) {
        hostConfig.ReadonlyRootfs = true;
      }
      if (security.usernsMode) {
        hostConfig.UsernsMode = security.usernsMode;
      }
    }

    // Build create options
    const createOptions: Docker.ContainerCreateOptions = {
      name,
      Image: image,
      Cmd: command,
      Entrypoint: entrypoint,
      WorkingDir: workingDir,
      Env: envArray,
      ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
      HostConfig: hostConfig,
      Labels: labels,
      Hostname: hostname,
      NetworkingConfig: (network || networkAliases)
        ? {
            EndpointsConfig: {
              [(network || 'bridge')]: {
                Aliases: networkAliases,
              },
            },
          }
        : undefined,
    };

    // Apply user and security options
    if (security?.user) {
      createOptions.User = security.user;
    }

    if (security?.seccompProfile) {
      hostConfig.SecurityOpt = hostConfig.SecurityOpt || [];
      hostConfig.SecurityOpt.push(`seccomp=${security.seccompProfile}`);
    }

    if (security?.appArmorProfile) {
      hostConfig.SecurityOpt = hostConfig.SecurityOpt || [];
      hostConfig.SecurityOpt.push(`apparmor=${security.appArmorProfile}`);
    }

    if (security?.noNewPrivileges) {
      hostConfig.SecurityOpt = hostConfig.SecurityOpt || [];
      hostConfig.SecurityOpt.push('no-new-privileges');
    }

    return createOptions;
  }
  /**
   * Map Dockerode container info to our ContainerInfo type
   */
  private mapContainerInfo(info: DockerodeContainerInfo): DockerContainerInfo {
    const containerId = info.Id;
    const shortId = containerId.substring(0, 12);

    return {
      id: containerId,
      shortId,
      name: info.Names && info.Names[0] ? info.Names[0].replace(/^\//, "") : "",
      image: info.Image,
      status: this.mapContainerStatus(info.State),
      createdAt: new Date(info.Created * 1000),
      ports: [], // TODO: Parse ports from info
      networks: Object.keys(info.NetworkSettings?.Networks || {}),
      resources: info.HostConfig
        ? {
            memory: info.HostConfig.Memory,
            nanoCpus: info.HostConfig.NanoCpus,
            pidsLimit: info.HostConfig.PidsLimit,
          }
        : undefined,
      labels: info.Config?.Labels || info.Labels || {},
      hostname: info.Config?.Hostname,
      workingDir: info.Config?.WorkingDir,
    };
  }

  /**
   * Map listed container info to our ContainerInfo type
   */
  private mapListedContainerInfo(info: DockerodeContainerInfo): DockerContainerInfo {
    return this.mapContainerInfo(info);
  }

  /**
   * Map Dockerode container status to our ContainerStatus type
   */
  private mapContainerStatus(state: string): ContainerStatus {
    const statusMap: Record<string, ContainerStatus> = {
      created: 'created',
      running: 'running',
      paused: 'paused',
      restarting: 'restarting',
      removing: 'removing',
      exited: 'exited',
      dead: 'dead',
    };

    return statusMap[state.toLowerCase()] || 'dead';
  }

  /**
   * Map Dockerode stats to our ContainerStats type
   */
  private mapContainerStats(stats: DockerodeContainerStats): DockerContainerStats {
    // Calculate CPU percentage
    const cpuDelta = stats.precpu_stats?.cpu_usage?.total_usage !== undefined
      ? stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
      : 0;
    const systemDelta = stats.precpu_stats?.system_cpu_usage !== undefined
      ? stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
      : 0;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 * stats.cpu_stats.online_cpus : 0;

    // Calculate memory usage
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const memoryCache = stats.memory_stats.stats?.cache || 0;
    const actualMemoryUsage = memoryUsage - memoryCache;
    const memoryPercent = memoryLimit > 0 ? (actualMemoryUsage / memoryLimit) * 100 : 0;

    // Calculate network stats
    let networkRxBytes = 0;
    let networkTxBytes = 0;
    if (stats.networks) {
      for (const network of Object.values(stats.networks)) {
        networkRxBytes += network.rx_bytes;
        networkTxBytes += network.tx_bytes;
      }
    }

    // Calculate block I/O stats
    let blockReadBytes = 0;
    let blockWriteBytes = 0;
    if (stats.blkio_stats?.io_service_bytes_recursive) {
      for (const io of stats.blkio_stats.io_service_bytes_recursive) {
        if (io.op === 'read' || io.op === 'Read') {
          blockReadBytes += io.value;
        } else if (io.op === 'write' || io.op === 'Write') {
          blockWriteBytes += io.value;
        }
      }
    }

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsage: actualMemoryUsage,
      memoryLimit,
      memoryPercent: Math.round(memoryPercent * 100) / 100,
      networkRxBytes,
      networkTxBytes,
      blockReadBytes,
      blockWriteBytes,
      pids: stats.pids_stats.current,
    };
  }
}

// Initialize Docker Manager
DockerManager.getInstance().initialize().catch((error) => {
  logger.error('Failed to initialize Docker Manager', { error: error instanceof Error ? error.message : String(error) });
});
