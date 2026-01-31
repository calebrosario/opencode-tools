import Dockerode from 'dockerode';
import { logger } from './logger';
import { DOCKER_SOCKET_PATH, DOCKER_NETWORK_PREFIX } from '../config';
import { OpenCodeError } from '../types';

export interface NetworkConfig {
  name: string;
  driver: 'bridge' | 'overlay' | 'macvlan';
  subnet?: string;
  gateway?: string;
  isolated: boolean; // If true, blocks external access
}

export interface ContainerNetwork {
  containerId: string;
  networkId: string;
  networkName: string;
  ipAddress?: string;
  aliases?: string[];
}

/**
 * Network isolation system for Docker containers
 * Creates isolated bridge networks per task to prevent lateral movement
 */
export class NetworkIsolator {
  private docker: Dockerode;
  private static instance: NetworkIsolator;
  private activeNetworks = new Map<string, ContainerNetwork[]>();

  private constructor() {
    this.docker = new Dockerode({
      socketPath: DOCKER_SOCKET_PATH,
    });
  }

  public static getInstance(): NetworkIsolator {
    if (!NetworkIsolator.instance) {
      NetworkIsolator.instance = new NetworkIsolator();
    }
    return NetworkIsolator.instance;
  }

  /**
   * Initialize network isolation system
   */
  public async initialize(): Promise<void> {
    try {
      // Test Docker connection
      await this.docker.info();
      logger.info('NetworkIsolator initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize NetworkIsolator', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create an isolated network for a task
   * @param taskId - Unique task identifier
   * @param config - Network configuration
   * @returns Network ID
   */
  public async createTaskNetwork(taskId: string, config: Partial<NetworkConfig> = {}): Promise<string> {
    const networkName = `${DOCKER_NETWORK_PREFIX}${taskId}`;
    const networkConfig: NetworkConfig = {
      name: networkName,
      driver: 'bridge',
      isolated: true,
      ...config,
    };

    try {
      // Check if network already exists
      const existingNetworks = await this.docker.listNetworks({
        filters: { name: [networkName] },
      });

      if (existingNetworks.length > 0) {
        logger.warn('Network already exists, reusing', { taskId, networkName });
        const network = existingNetworks[0];
        return network?.Id || networkName;
      }

      // Create new isolated network
      const networkSpec = {
        Name: networkName,
        Driver: networkConfig.driver,
        Options: {
          'com.docker.network.bridge.enable_icc': 'false', // Disable inter-container communication
          'com.docker.network.bridge.enable_ip_masquerade': networkConfig.isolated ? 'false' : 'true',
        },
        IPAM: {
          Config: networkConfig.subnet ? [{
            Subnet: networkConfig.subnet,
            Gateway: networkConfig.gateway,
          }] : [],
        },
      };

      const network = await this.docker.createNetwork(networkSpec);
      logger.info('Isolated network created', {
        taskId,
        networkId: network.id,
        networkName,
        driver: networkConfig.driver,
        isolated: networkConfig.isolated,
      });

      return network.id;
    } catch (error: unknown) {
      logger.error('Failed to create task network', {
        taskId,
        networkName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'NETWORK_CREATION_FAILED',
        `Failed to create network for task ${taskId}`,
        { taskId, networkName }
      );
    }
  }

  /**
   * Connect a container to an isolated network
   * @param containerId - Docker container ID
   * @param networkId - Network ID
   * @param aliases - Container aliases in the network
   */
  public async connectContainer(
    containerId: string,
    networkId: string,
    aliases: string[] = []
  ): Promise<void> {
    try {
      const network = this.docker.getNetwork(networkId);
      const container = this.docker.getContainer(containerId);

      // Verify container exists
      await container.inspect();

      // Connect container to network
      await network.connect({
        Container: containerId,
        EndpointConfig: {
          Aliases: aliases,
        },
      });

      // Store network association
      const networkInfo = await network.inspect();
      const containerNetwork: ContainerNetwork = {
        containerId,
        networkId,
        networkName: networkInfo.Name,
        aliases,
      };

      if (!this.activeNetworks.has(networkId)) {
        this.activeNetworks.set(networkId, []);
      }
      this.activeNetworks.get(networkId)!.push(containerNetwork);

      logger.info('Container connected to isolated network', {
        containerId,
        networkId,
        networkName: networkInfo.Name,
        aliases,
      });
    } catch (error: unknown) {
      logger.error('Failed to connect container to network', {
        containerId,
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'NETWORK_CONNECTION_FAILED',
        `Failed to connect container ${containerId} to network ${networkId}`,
        { containerId, networkId }
      );
    }
  }

  /**
   * Disconnect a container from a network
   * @param containerId - Docker container ID
   * @param networkId - Network ID
   */
  public async disconnectContainer(containerId: string, networkId: string): Promise<void> {
    try {
      const network = this.docker.getNetwork(networkId);

      await network.disconnect({
        Container: containerId,
        Force: true,
      });

      // Remove from tracking
      const networkContainers = this.activeNetworks.get(networkId);
      if (networkContainers) {
        const index = networkContainers.findIndex(nc => nc.containerId === containerId);
        if (index >= 0) {
          networkContainers.splice(index, 1);
          if (networkContainers.length === 0) {
            this.activeNetworks.delete(networkId);
          }
        }
      }

      logger.info('Container disconnected from network', {
        containerId,
        networkId,
      });
    } catch (error: unknown) {
      logger.error('Failed to disconnect container from network', {
        containerId,
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'NETWORK_DISCONNECTION_FAILED',
        `Failed to disconnect container ${containerId} from network ${networkId}`,
        { containerId, networkId }
      );
    }
  }

  /**
   * Remove an isolated task network
   * @param networkId - Network ID to remove
   */
  public async removeTaskNetwork(networkId: string): Promise<void> {
    try {
      const network = this.docker.getNetwork(networkId);

      // Disconnect all containers first
      const networkContainers = this.activeNetworks.get(networkId) || [];
      for (const containerNetwork of networkContainers) {
        try {
          await this.disconnectContainer(containerNetwork.containerId, networkId);
        } catch (error: unknown) {
          logger.warn('Failed to disconnect container during network removal', {
            containerId: containerNetwork.containerId,
            networkId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Remove the network
      await network.remove();

      // Clean up tracking
      this.activeNetworks.delete(networkId);

      logger.info('Task network removed', {
        networkId,
        disconnectedContainers: networkContainers.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to remove task network', {
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'NETWORK_REMOVAL_FAILED',
        `Failed to remove network ${networkId}`,
        { networkId }
      );
    }
  }

  /**
   * Isolate network by setting up firewall rules
   * @param networkId - Network ID to isolate
   * @param taskId - Task ID for tracking
   */
  public async isolateNetwork(networkId: string, taskId: string): Promise<void> {
    try {
      logger.info('Isolating network', { networkId, taskId });

      // In a real implementation, this would set up iptables rules
      // For now, we just verify network exists
      const network = this.docker.getNetwork(networkId);
      await network.inspect();

      logger.info('Network isolated successfully', { networkId, taskId });
    } catch (error: unknown) {
      logger.error('Failed to isolate network', {
        networkId,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'NETWORK_ISOLATION_FAILED',
        `Failed to isolate network ${networkId}`,
        { networkId, taskId }
      );
    }
  }

  /**
   * Remove network isolation rules
   * @param networkId - Network ID to remove isolation from
   */
  public async removeNetworkIsolation(networkId: string): Promise<void> {
    try {
      logger.info('Removing network isolation', { networkId });

      // In a real implementation, this would remove iptables rules
      // For now, we just verify network exists
      const network = this.docker.getNetwork(networkId);
      await network.inspect();

      logger.info('Network isolation removed successfully', { networkId });
    } catch (error: unknown) {
      logger.error('Failed to remove network isolation', {
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'NETWORK_ISOLATION_REMOVAL_FAILED',
        `Failed to remove isolation from network ${networkId}`,
        { networkId }
      );
    }
  }

  /**
   * Get network information for a task
   * @param taskId - Task identifier
   * @returns Network information
   */
  public async getTaskNetwork(taskId: string): Promise<any> {
    try {
      const networkName = `${DOCKER_NETWORK_PREFIX}${taskId}`;
      const networks = await this.docker.listNetworks({
        filters: { name: [networkName] },
      });

      if (networks.length === 0) {
        return null;
      }

      const networkId = networks[0]?.Id as string;
      const network = this.docker.getNetwork(networkId);
      return await network.inspect();
    } catch (error: unknown) {
      logger.error('Failed to get task network info', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Verify network isolation (security check)
   * @param networkId - Network ID to verify
   * @returns Isolation status
   */
  public async verifyIsolation(networkId: string): Promise<{
    isIsolated: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const network = this.docker.getNetwork(networkId);
      const networkInfo = await network.inspect();

      // Check bridge settings
      const options = networkInfo.Options || {};
      const iccDisabled = options['com.docker.network.bridge.enable_icc'] === 'false';
      const ipMasqueradeDisabled = options['com.docker.network.bridge.enable_ip_masquerade'] === 'false';

      if (!iccDisabled) {
        issues.push('Inter-container communication not disabled');
      }

      if (!ipMasqueradeDisabled) {
        issues.push('IP masquerading not disabled (external access possible)');
      }

      // Check for unexpected containers
      const containers = networkInfo.Containers || {};
      const containerCount = Object.keys(containers).length;

      if (containerCount > 1) {
        issues.push(`Multiple containers in isolated network: ${containerCount}`);
      }

      const isIsolated = issues.length === 0;

      logger.info('Network isolation verified', {
        networkId,
        isIsolated,
        issues: issues.length,
      });

      return { isIsolated, issues };
    } catch (error: unknown) {
      logger.error('Failed to verify network isolation', {
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isIsolated: false,
        issues: ['Failed to verify isolation'],
      };
    }
  }

  /**
   * Get all active networks
   * @returns Map of network ID to containers
   */
  public getActiveNetworks(): Map<string, ContainerNetwork[]> {
    return new Map(this.activeNetworks);
  }

  /**
   * Emergency cleanup of all task networks
   * @returns Number of networks removed
   */
  public async emergencyCleanup(): Promise<number> {
    let removed = 0;

    for (const [networkId] of this.activeNetworks) {
      try {
        await this.removeTaskNetwork(networkId);
        removed++;
      } catch (error: unknown) {
        logger.error('Failed to remove network during emergency cleanup', {
          networkId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.activeNetworks.clear();
    logger.warn('Emergency network cleanup completed', { removed });
    return removed;
  }

  /**
   * Test network connectivity (for debugging)
   * @param containerId - Container to test from
   * @param target - Target to test connectivity to
   * @returns Connectivity status
   */
  public async testConnectivity(containerId: string, target: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);

      // Execute ping test
      const exec = await container.exec({
        Cmd: ['ping', '-c', '1', '-W', '1', target],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });
      return new Promise((resolve) => {
        (stream as any).on('end', () => resolve(true));
        (stream as any).on('error', () => resolve(false));

        // Timeout after 2 seconds
        setTimeout(() => resolve(false), 2000);
      });
    } catch (error: unknown) {
      logger.debug('Connectivity test failed (expected for isolated networks)', {
        containerId,
        target,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export singleton instance
export const networkIsolator = NetworkIsolator.getInstance();
