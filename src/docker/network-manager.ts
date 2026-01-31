// Network Manager - Task-specific network isolation
// Week 11, Task 11.8: Network isolation with custom bridge networks

import Dockerode from 'dockerode';
import { logger } from '../util/logger';
import { NetworkIsolator } from '../util/network-isolator';
import { OpenCodeError } from '../types';

// ErrorCode constants
const ErrorCode = {
  NETWORK_INITIALIZATION_FAILED: "NETWORK_INITIALIZATION_FAILED",
  NETWORK_CREATION_FAILED: "NETWORK_CREATION_FAILED",
  NETWORK_DELETION_FAILED: "NETWORK_DELETION_FAILED",
  NETWORK_CONNECTION_FAILED: "NETWORK_CONNECTION_FAILED",
  NETWORK_DISCONNECTION_FAILED: "NETWORK_DISCONNECTION_FAILED",
  NETWORK_LIST_FAILED: "NETWORK_LIST_FAILED",
  NETWORK_INFO_FAILED: "NETWORK_INFO_FAILED",
  NETWORK_MONITORING_FAILED: "NETWORK_MONITORING_FAILED",
  NETWORK_DNS_CONFIGURATION_FAILED: "NETWORK_DNS_CONFIGURATION_FAILED",
  NETWORK_REMOVAL_FAILED: "NETWORK_REMOVAL_FAILED",
  NETWORK_NOT_FOUND: "NETWORK_NOT_FOUND",
  NETWORK_CREATE_FAILED: "NETWORK_CREATE_FAILED",
  NETWORK_DELETE_FAILED: "NETWORK_DELETE_FAILED",
  NETWORK_CONNECT_FAILED: "NETWORK_CONNECT_FAILED",
  NETWORK_DISCONNECT_FAILED: "NETWORK_DISCONNECT_FAILED",
  NETWORK_ISOLATION_FAILED: "NETWORK_ISOLATION_FAILED",
  NETWORK_ALREADY_ISOLATED: "NETWORK_ALREADY_ISOLATED",
  NETWORK_NOT_ISOLATED: "NETWORK_NOT_ISOLATED",
};
import Docker from 'dockerode';

/**
 * Network information interface
 */
export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  labels?: Record<string, string>;
  created: Date;
  containers: string[];
}

/**
 * Network configuration options
 */
export interface NetworkConfig {
  name: string;
  driver?: string;
  internal?: boolean;
  labels?: Record<string, string>;
  disableDNS?: boolean;
  enableIPv6?: boolean;
  ipam?: {
    driver?: string;
    config?: Array<{
      subnet?: string;
      ipRange?: string;
      gateway?: string;
    }>;
  };
}

/**
 * DNS configuration
 */
export interface DNSConfig {
  servers?: string[];
  searchDomains?: string[];
  options?: string[];
}

/**
 * Network Manager - Task-specific network isolation
 *
 * Provides:
 * - Custom bridge network creation per task
 * - Network isolation (block external access)
 * - DNS configuration management
 * - Network policy enforcement
 * - Network monitoring
 * - Network cleanup on task deletion
 *
 * Integration:
 * - Uses NetworkIsolator from Phase 1 for whitelist-based access control
 * - Integrates with Docker Manager for container lifecycle
 */
export class NetworkManager {
  private docker: Dockerode;
  private static instance: NetworkManager;
  private initialized: boolean = false;
  private taskNetworks: Map<string, string> = new Map(); // taskId -> networkId
  private networkIsolator: NetworkIsolator;

  private constructor() {
    this.docker = new Dockerode({
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
    });
    this.networkIsolator = NetworkIsolator.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Initialize Network Manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('NetworkManager already initialized');
      return;
    }

    try {
      // Clean up any orphaned networks from previous sessions
      await this.cleanupOrphanedNetworks();

      // Initialize network isolator
      await this.networkIsolator.initialize();

      this.initialized = true;
      logger.info('NetworkManager initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize NetworkManager', { error: error.message });
      throw new OpenCodeError(
        ErrorCode.NETWORK_INITIALIZATION_FAILED,
        'Failed to initialize Network Manager',
        { originalError: error.message }
      );
    }
  }

  /**
   * Create task-specific bridge network
   *
   * @param taskId - Task ID
   * @returns Network ID
   */
  async createTaskNetwork(taskId: string): Promise<string> {
    try {
      const networkName = `${process.env.DOCKER_NETWORK_PREFIX || 'opencode'}-${taskId}`;

      logger.info('Creating task network', { taskId, networkName });

      const networkConfig: NetworkConfig = {
        name: networkName,
        driver: 'bridge',
        internal: true, // Block external network access
        labels: {
          'opencode.taskId': taskId,
          'opencode.managed': 'true',
          'opencode.created': new Date().toISOString(),
        },
        disableDNS: false,
        ipam: {
          driver: 'default',
          config: [
            {
              subnet: `172.28.${this.getSubnetOctet(taskId)}.0/24`,
              gateway: `172.28.${this.getSubnetOctet(taskId)}.1`,
            },
          ],
        },
      };

      const network = await this.docker.createNetwork(networkConfig as any);
      const networkId = network.id;

      // Track network for this task
      this.taskNetworks.set(taskId, networkId);

      // Initialize network isolator for this network
      await this.networkIsolator.isolateNetwork(networkId, taskId);

      logger.info('Task network created successfully', {
        taskId,
        networkId,
        networkName,
      });

      return networkId;
    } catch (error: any) {
      logger.error('Failed to create task network', {
        taskId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_CREATION_FAILED,
        `Failed to create network for task ${taskId}`,
        { taskId, originalError: error.message }
      );
    }
  }

  /**
   * Connect container to network
   *
   * @param containerId - Container ID
   * @param networkId - Network ID
   * @param endpointConfig - Optional endpoint configuration
   */
  async connectContainerToNetwork(
    containerId: string,
    networkId: string,
    endpointConfig?: any
  ): Promise<void> {
    try {
      logger.info('Connecting container to network', { containerId, networkId });

      await this.docker.getNetwork(networkId).connect({
        Container: containerId,
        EndpointConfig: endpointConfig || {},
      });

      logger.info('Container connected to network successfully', {
        containerId,
        networkId,
      });
    } catch (error: any) {
      logger.error('Failed to connect container to network', {
        containerId,
        networkId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_CONNECTION_FAILED,
        `Failed to connect container ${containerId} to network ${networkId}`,
        { containerId, networkId, originalError: error.message }
      );
    }
  }

  /**
   * Disconnect container from network
   *
   * @param containerId - Container ID
   * @param networkId - Network ID
   */
  async disconnectContainerFromNetwork(
    containerId: string,
    networkId: string
  ): Promise<void> {
    try {
      logger.info('Disconnecting container from network', {
        containerId,
        networkId,
      });

      await this.docker.getNetwork(networkId).disconnect({
        Container: containerId,
        Force: false,
      });

      logger.info('Container disconnected from network successfully', {
        containerId,
        networkId,
      });
    } catch (error: any) {
      // Ignore 404 errors (container or network not found)
      if (error.statusCode === 404) {
        logger.warn('Container or network not found during disconnect', {
          containerId,
          networkId,
        });
        return;
      }

      logger.error('Failed to disconnect container from network', {
        containerId,
        networkId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_DISCONNECTION_FAILED,
        `Failed to disconnect container ${containerId} from network ${networkId}`,
        { containerId, networkId, originalError: error.message }
      );
    }
  }

  /**
   * Remove task network
   *
   * @param taskId - Task ID
   */
  async removeTaskNetwork(taskId: string): Promise<void> {
    try {
      const networkId = this.taskNetworks.get(taskId);

      if (!networkId) {
        logger.warn('No network found for task', { taskId });
        return;
      }

      logger.info('Removing task network', { taskId, networkId });

      // Disconnect all containers from network first
      await this.disconnectAllContainers(networkId);

      // Remove network isolator rules
      await this.networkIsolator.removeNetworkIsolation(networkId);

      // Remove network
      await this.docker.getNetwork(networkId).remove();

      // Remove from tracking
      this.taskNetworks.delete(taskId);

      logger.info('Task network removed successfully', { taskId, networkId });
    } catch (error: any) {
      // Ignore 404 errors (network not found)
      if (error.statusCode === 404) {
        logger.warn('Network not found during removal', { taskId });
        this.taskNetworks.delete(taskId);
        return;
      }

      logger.error('Failed to remove task network', {
        taskId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_REMOVAL_FAILED,
        `Failed to remove network for task ${taskId}`,
        { taskId, originalError: error.message }
      );
    }
  }

  /**
   * List networks for a task
   *
   * @param taskId - Task ID
   * @returns Array of network info
   */
  async listTaskNetworks(taskId: string): Promise<NetworkInfo[]> {
    try {
      const networks = await this.docker.listNetworks();

      // Filter networks belonging to this task
      const taskNetworks = networks
        .filter((net: any) => net.Labels?.['opencode.taskId'] === taskId)
        .map((net: any) => ({
          id: net.Id || '',
          name: net.Name || '',
          driver: net.Driver || '',
          scope: net.Scope || '',
          internal: net.Internal || false,
          labels: net.Labels,
          created: new Date((net.Created || 0) * 1000),
          containers: Object.keys(net.Containers || {}),
        }));

      logger.info('Listed task networks', { taskId, count: taskNetworks.length });

      return taskNetworks;
    } catch (error: any) {
      logger.error('Failed to list task networks', {
        taskId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_LIST_FAILED,
        `Failed to list networks for task ${taskId}`,
        { taskId, originalError: error.message }
      );
    }
  }

  /**
   * Isolate network from external access
   *
   * Uses NetworkIsolator to enforce whitelist-based access control
   *
   * @param networkId - Network ID
   */
  async isolateNetwork(networkId: string, taskId?: string): Promise<void> {
    try {
      logger.info('Isolating network', { networkId });

      await this.networkIsolator.isolateNetwork(networkId, taskId || networkId);

      logger.info('Network isolated successfully', { networkId });
    } catch (error: any) {
      logger.error('Failed to isolate network', {
        networkId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_ISOLATION_FAILED,
        `Failed to isolate network ${networkId}`,
        { networkId, originalError: error.message }
      );
    }
  }

  /**
   * Configure DNS for network/container
   *
   * @param networkId - Network ID
   * @param dnsConfig - DNS configuration
   */
  async configureDNS(networkId: string, dnsConfig: DNSConfig): Promise<void> {
    try {
      logger.info('Configuring DNS for network', { networkId, dnsConfig });

      // DNS is configured per container via endpoint config
      // This method is for documentation/verification
      logger.info('DNS configuration prepared', { networkId, dnsConfig });
    } catch (error: any) {
      logger.error('Failed to configure DNS', {
        networkId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_DNS_CONFIGURATION_FAILED,
        `Failed to configure DNS for network ${networkId}`,
        { networkId, originalError: error.message }
      );
    }
  }

  /**
   * Monitor network activity
   *
   * @param networkId - Network ID
   * @returns Network statistics
   */
  async monitorNetwork(networkId: string): Promise<any> {
    try {
      const network = await this.docker.getNetwork(networkId).inspect();

      const stats = {
        id: network.Id,
        name: network.Name,
        driver: network.Driver,
        internal: network.Internal,
        containers: Object.keys(network.Containers || {}),
        created: new Date((typeof network.Created === 'number' ? network.Created : 0) * 1000),
      };

      logger.debug('Network monitoring stats', { networkId, stats });

      return stats;
    } catch (error: any) {
      logger.error('Failed to monitor network', {
        networkId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_MONITORING_FAILED,
        `Failed to monitor network ${networkId}`,
        { networkId, originalError: error.message }
      );
    }
  }

  /**
   * Get network info
   *
   * @param networkId - Network ID
   * @returns Network information
   */
  async getNetworkInfo(networkId: string): Promise<NetworkInfo> {
    try {
      const network = await this.docker.getNetwork(networkId).inspect();

      return {
        id: network.Id || '',
        name: network.Name || '',
        driver: network.Driver || '',
        scope: network.Scope || '',
        internal: network.Internal || false,
        labels: network.Labels,
        created: new Date(typeof network.Created === "number" ? network.Created * 1000 : Date.now()),
        containers: Object.keys(network.Containers || {}),
      };
    } catch (error: any) {
      logger.error('Failed to get network info', {
        networkId,
        error: error.message,
      });
      throw new OpenCodeError(
        ErrorCode.NETWORK_INFO_FAILED,
        `Failed to get info for network ${networkId}`,
        { networkId, originalError: error.message }
      );
    }
  }

  /**
   * Disconnect all containers from a network
   *
   * @param networkId - Network ID
   */
  private async disconnectAllContainers(networkId: string): Promise<void> {
    try {
      const network = await this.docker.getNetwork(networkId).inspect();
      const containers = Object.keys(network.Containers || {});

      for (const containerId of containers) {
        await this.disconnectContainerFromNetwork(containerId, networkId);
      }

      logger.info('Disconnected all containers from network', {
        networkId,
        count: containers.length,
      });
    } catch (error: any) {
      logger.warn('Failed to disconnect all containers', {
        networkId,
        error: error.message,
      });
    }
  }

  /**
   * Clean up orphaned networks
   *
   * Removes networks with 'opencode.managed' label but no active tasks
   */
  private async cleanupOrphanedNetworks(): Promise<void> {
    try {
      const networks = await this.docker.listNetworks();

      for (const network of networks as any[]) {
        // Check if it's a managed network
        if (!network.Labels?.['opencode.managed']) {
          continue;
        }

        const taskId = network.Labels?.['opencode.taskId'];
        if (!taskId) {
          continue;
        }

        // Check if task still exists (you'd query TaskRegistry here)
        // For now, we'll just remove networks with no containers
        const containerCount = Object.keys(network.Containers || {}).length;

        if (containerCount === 0) {
          logger.info('Removing orphaned network', {
            networkId: network.Id,
            networkName: network.Name,
            taskId,
          });

          try {
            await this.docker.getNetwork(network.Id || '').remove();
          } catch (error: any) {
            // Ignore errors during cleanup
            logger.warn('Failed to remove orphaned network', {
              networkId: network.Id,
              error: error.message,
            });
          }
        }
      }

      logger.info('Orphaned network cleanup completed');
    } catch (error: any) {
      logger.error('Failed to cleanup orphaned networks', {
        error: error.message,
      });
    }
  }

  /**
   * Get subnet octet for task (deterministic)
   *
   * @param taskId - Task ID
   * @returns Subnet octet (0-255)
   */
  private getSubnetOctet(taskId: string): number {
    // Use hash of taskId to get deterministic subnet octet
    let hash = 0;
    for (let i = 0; i < taskId.length; i++) {
      hash = ((hash << 5) - hash) + taskId.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash) % 254 + 2; // 2-255 to avoid 0,1 (reserved)
  }

  /**
   * Get statistics for all managed networks
   *
   * @returns Network statistics
   */
  async getStatistics(): Promise<any> {
    return {
      managedNetworks: this.taskNetworks.size,
      networks: Array.from(this.taskNetworks.entries()),
    };
  }

  /**
   * Shutdown Network Manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down NetworkManager');

    // Cleanup all managed networks
    for (const [taskId] of this.taskNetworks.entries()) {
      try {
        await this.removeTaskNetwork(taskId);
      } catch (error) {
        logger.error('Failed to remove network during shutdown', {
          taskId,
          error,
        });
      }
    }

    this.initialized = false;
    logger.info('NetworkManager shutdown complete');
  }
}
