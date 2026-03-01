import { logger } from "./logger";
import {
  CONTAINER_MEMORY_MB,
  CONTAINER_CPU_SHARES,
  CONTAINER_PIDS_LIMIT,
  WEBHOOK_URL,
  WEBHOOK_TIMEOUT_MS,
  ALERT_WEBHOOK_ENABLED,
} from "../config";
import { OpenCodeError } from "../types";

export interface ResourceUsage {
  memory: {
    used: number; // MB
    limit: number; // MB
    percentage: number;
  };
  cpu: {
    used: number; // percentage (0-100)
    limit: number; // shares
  };
  pids: {
    used: number;
    limit: number;
    percentage: number;
  };
  disk: {
    used: number; // MB
    limit: number; // MB
    percentage: number;
  };
}

export interface ResourceLimits {
  memoryMB: number;
  cpuShares: number;
  pidsLimit: number;
  diskMB?: number;
}

export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private monitoringInterval?: NodeJS.Timeout;
  private resourceUsage = new Map<string, ResourceUsage>();
  private alertsTriggered = new Set<string>();

  private constructor() {}

  public static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  /**
   * Initialize resource monitoring
   */
  public async initialize(): Promise<void> {
    logger.info("Initializing Resource Monitor", {
      memoryLimit: CONTAINER_MEMORY_MB,
      cpuShares: CONTAINER_CPU_SHARES,
      pidsLimit: CONTAINER_PIDS_LIMIT,
    });

    // Start periodic monitoring
    this.startMonitoring();

    logger.info("✅ Resource Monitor initialized");
  }

  /**
   * Check if requested resources are within limits
   * @param requested - Requested resource limits
   * @returns true if within limits
   */
  public async checkResourceLimits(
    requested: Partial<ResourceLimits>,
  ): Promise<boolean> {
    const currentUsage = await this.getSystemResourceUsage();
    const totalContainers = this.resourceUsage.size;

    // Calculate projected usage if this container is added
    // Use reserved resources (sum of container limits) instead of current usage
    let totalReservedMemory = 0;
    for (const usage of this.resourceUsage.values()) {
      totalReservedMemory += usage.memory.limit;
    }
    const projectedMemory =
      totalReservedMemory + (requested.memoryMB || CONTAINER_MEMORY_MB);

    let totalReservedPids = 0;
    for (const usage of this.resourceUsage.values()) {
      totalReservedPids += usage.pids.limit;
    }
    const projectedPids =
      totalReservedPids + (requested.pidsLimit || CONTAINER_PIDS_LIMIT);

    // Check memory limits (leave 20% buffer)
    const buffer = currentUsage.memory.limit * 0.8;
    if (projectedMemory > buffer) {
      logger.warn("Resource limit exceeded: memory", {
        requested: requested.memoryMB,
        projected: projectedMemory,
        buffer: buffer,
        current: currentUsage.memory.used,
      });
      return false;
    }

    // Check PID limits (leave 10% buffer)
    const pidLimit = currentUsage.pids.limit * 0.9;
    if (projectedPids > pidLimit) {
      logger.warn("Resource limit exceeded: PIDs", {
        requested: requested.pidsLimit,
        projected: projectedPids,
        buffer: pidLimit - totalReservedPids,
        limit: pidLimit,
        current: currentUsage.pids.used,
      });
      return false;
    }

    return true;
  }

  /**
   * Register a container for resource monitoring
   * @param containerId - Container ID
   * @param limits - Resource limits
   */
  public registerContainer(containerId: string, limits: ResourceLimits): void {
    const initialUsage: ResourceUsage = {
      memory: {
        used: 0,
        limit: limits.memoryMB,
        percentage: 0,
      },
      cpu: {
        used: 0,
        limit: limits.cpuShares,
      },
      pids: {
        used: 0,
        limit: limits.pidsLimit,
        percentage: 0,
      },
      disk: {
        used: 0,
        limit: limits.diskMB || 1024, // Default 1GB
        percentage: 0,
      },
    };

    this.resourceUsage.set(containerId, initialUsage);
    logger.info("Container registered for resource monitoring", {
      containerId,
      limits,
      totalContainers: this.resourceUsage.size,
    });
  }

  /**
   * Unregister a container from monitoring
   * @param containerId - Container ID
   */
  public unregisterContainer(containerId: string): void {
    const removed = this.resourceUsage.delete(containerId);
    if (removed) {
      logger.info("Container unregistered from resource monitoring", {
        containerId,
        totalContainers: this.resourceUsage.size,
      });
    }
  }

  /**
   * Update resource usage for a container
   * @param containerId - Container ID
   * @param usage - Current usage
   */
  public updateContainerUsage(
    containerId: string,
    usage: Partial<ResourceUsage>,
  ): void {
    const currentUsage = this.resourceUsage.get(containerId);
    if (!currentUsage) {
      logger.warn("Attempted to update usage for unregistered container", {
        containerId,
      });
      return;
    }

    // Update usage data
    if (usage.memory) {
      currentUsage.memory.used = usage.memory.used;
      if (currentUsage.memory.limit > 0) {
        currentUsage.memory.percentage =
          (usage.memory.used / currentUsage.memory.limit) * 100;
      } else {
        currentUsage.memory.percentage = 0;
        logger.warn("Container has zero memory limit", {
          containerId,
          used: usage.memory.used,
        });
      }
    }

    if (usage.cpu) {
      currentUsage.cpu.used = usage.cpu.used;
    }

    if (usage.pids) {
      currentUsage.pids.used = usage.pids.used;
      if (currentUsage.pids.limit > 0) {
        currentUsage.pids.percentage =
          (usage.pids.used / currentUsage.pids.limit) * 100;
      } else {
        currentUsage.pids.percentage = 0;
        logger.warn("Container has zero PID limit", {
          containerId,
          used: usage.pids.used,
        });
      }
    }

    if (usage.disk) {
      currentUsage.disk.used = usage.disk.used;
      if (currentUsage.disk.limit > 0) {
        currentUsage.disk.percentage =
          (usage.disk.used / currentUsage.disk.limit) * 100;
      } else {
        currentUsage.disk.percentage = 0;
        logger.warn("Container has zero disk limit", {
          containerId,
          used: usage.disk.used,
        });
      }
    }

    // Check for alerts
    this.checkAlerts(containerId, currentUsage);
  }

  /**
   * Get resource usage for a specific container
   * @param containerId - Container ID
   * @returns Resource usage or null if not registered
   */
  public getContainerUsage(containerId: string): ResourceUsage | null {
    return this.resourceUsage.get(containerId) || null;
  }

  /**
   * Get aggregate system resource usage
   * @returns Total system resource usage
   */
  public async getSystemResourceUsage(): Promise<ResourceUsage> {
    // In a real implementation, this would query system metrics
    // For now, we'll aggregate container usage

    let totalMemoryUsed = 0;
    let totalPidsUsed = 0;
    let avgCpuUsed = 0;

    for (const usage of this.resourceUsage.values()) {
      totalMemoryUsed += usage.memory.used;
      totalPidsUsed += usage.pids.used;
      avgCpuUsed += usage.cpu.used;
    }

    const containerCount = this.resourceUsage.size;
    avgCpuUsed = containerCount > 0 ? avgCpuUsed / containerCount : 0;

    // Get system limits (in a real implementation, query system)
    const systemMemoryLimit = 8192; // 8GB default
    const systemPidsLimit = 1024; // Default PID limit

    return {
      memory: {
        used: totalMemoryUsed,
        limit: systemMemoryLimit, // Always use system limit
        percentage:
          systemMemoryLimit > 0
            ? (totalMemoryUsed / systemMemoryLimit) * 100
            : 0,
      },
      cpu: {
        used: avgCpuUsed,
        limit: CONTAINER_CPU_SHARES * Math.max(containerCount, 1), // At least 1
      },
      pids: {
        used: totalPidsUsed,
        limit: systemPidsLimit, // Always use system limit
        percentage:
          systemPidsLimit > 0 ? (totalPidsUsed / systemPidsLimit) * 100 : 0,
      },
      disk: {
        used: 0, // Not implemented yet
        limit: 10240, // 10GB default
        percentage: 0,
      },
    };
  }

  /**
   * Get default resource limits
   * @returns Default resource limits
   */
  public getDefaultLimits(): ResourceLimits {
    return {
      memoryMB: CONTAINER_MEMORY_MB,
      cpuShares: CONTAINER_CPU_SHARES,
      pidsLimit: CONTAINER_PIDS_LIMIT,
      diskMB: 1024, // 1GB
    };
  }

  /**
   * Get number of tracked containers
   * @returns Container count
   */
  public getContainerCount(): number {
    return this.resourceUsage.size;
  }

  /**
   * Force cleanup of resource monitoring data
   */
  public emergencyCleanup(): number {
    const cleaned = this.resourceUsage.size;
    this.resourceUsage.clear();
    this.alertsTriggered.clear();
    logger.warn("Emergency resource monitoring cleanup performed", { cleaned });
    return cleaned;
  }

  /**
   * Send webhook notification for alerts
   */
  private async sendWebhookNotification(
    alertType: string,
    containerId: string,
    usage: ResourceUsage,
  ): Promise<void> {
    if (!ALERT_WEBHOOK_ENABLED || !WEBHOOK_URL) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      alert: alertType,
      containerId,
      usage: {
        memory: usage.memory.percentage.toFixed(1) + "%",
        pids: usage.pids.percentage.toFixed(1) + "%",
      },
      source: "opencode-tools",
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn("Webhook notification failed", {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      logger.error("Failed to send webhook notification", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check for resource alerts and trigger them
   * @param containerId - Container ID
   * @param usage - Current usage
   */
  private checkAlerts(containerId: string, usage: ResourceUsage): void {
    const alertKey = `${containerId}-memory`;
    if (usage.memory.percentage > 85 && !this.alertsTriggered.has(alertKey)) {
      logger.error("CRITICAL: Container memory usage >90%", {
        containerId,
        memoryUsed: usage.memory.used,
        memoryLimit: usage.memory.limit,
        percentage: usage.memory.percentage,
      });
      this.alertsTriggered.add(alertKey);
      this.sendWebhookNotification("memory", containerId, usage);
    } else if (usage.memory.percentage < 80) {
      this.alertsTriggered.delete(alertKey);
    }

    const pidAlertKey = `${containerId}-pids`;
    if (usage.pids.percentage >= 80 && !this.alertsTriggered.has(pidAlertKey)) {
      logger.error("CRITICAL: Container PID usage >80%", {
        containerId,
        pidsUsed: usage.pids.used,
        pidsLimit: usage.pids.limit,
        percentage: usage.pids.percentage,
      });
      this.alertsTriggered.add(pidAlertKey);
      this.sendWebhookNotification("pids", containerId, usage);
    } else if (usage.pids.percentage < 70) {
      this.alertsTriggered.delete(pidAlertKey);
    }
  }

  /**
   * Start periodic resource monitoring
   */
  private startMonitoring(): void {
    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        const systemUsage = await this.getSystemResourceUsage();

        // Log system-wide resource usage
        if (
          systemUsage.memory.percentage > 80 ||
          systemUsage.pids.percentage > 70
        ) {
          logger.warn("High system resource usage detected", {
            memoryPercentage: systemUsage.memory.percentage,
            pidsPercentage: systemUsage.pids.percentage,
            containers: this.resourceUsage.size,
          });
        }

        // Clean up any containers that may have been removed externally
        // (This would be enhanced with Docker API integration)
      } catch (error: unknown) {
        logger.error("Error during resource monitoring", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 30000);
  }

  /**
   * Stop resource monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance();
