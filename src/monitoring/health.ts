/**
 * Health Check System
 *
 * Provides system health monitoring with multiple check types.
 * Supports database, Docker, disk space, and memory checks.
 *
 * @module monitoring/health
 */

import * as fs from "fs";
import { logger } from "../util/logger";
import { DatabaseManager } from "../persistence/database";
import { dockerHelper } from "../util/docker-helper";
import { sql } from "drizzle-orm";

export type HealthStatus = "healthy" | "unhealthy" | "warning";

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message: string;
  timestamp: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheckResult[];
  timestamp: string;
}

/**
 * Health check configuration
 */
interface HealthCheckConfig {
  enabled: boolean;
  timeoutMs: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

/**
 * Health checker for system components
 */
class HealthChecker {
  private static instance: HealthChecker;
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private config: Map<string, HealthCheckConfig> = new Map();

  private constructor() {
    this.registerDefaultChecks();
  }

  public static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  /**
   * Register a custom health check
   */
  public registerCheck(
    name: string,
    checkFn: () => Promise<HealthCheckResult>,
    config?: Partial<HealthCheckConfig>,
  ): void {
    this.checks.set(name, checkFn);
    this.config.set(name, {
      enabled: true,
      timeoutMs: 5000,
      ...config,
    });
  }

  /**
   * Run all health checks
   */
  public async checkAll(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];
    const startTime = Date.now();

    for (const [name, checkFn] of this.checks.entries()) {
      const config = this.config.get(name);
      if (!config?.enabled) continue;

      try {
        const result = await this.runWithTimeout(checkFn, config.timeoutMs);
        checks.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        checks.push({
          name,
          status: "unhealthy",
          message: `Health check failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      }
    }

    // Determine overall status
    const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
    const hasWarning = checks.some((c) => c.status === "warning");

    return {
      overall: hasUnhealthy ? "unhealthy" : hasWarning ? "warning" : "healthy",
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run a specific health check
   */
  public async checkOne(name: string): Promise<HealthCheckResult | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) return null;

    const config = this.config.get(name);
    return this.runWithTimeout(checkFn, config?.timeoutMs || 5000);
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const dbManager = DatabaseManager.getInstance();
      const db = dbManager.getDatabase();

      // Simple query to verify connection
      await db.execute(sql`SELECT 1`);

      return {
        name: "database",
        status: "healthy",
        message: "Database connection is healthy",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        name: "database",
        status: "unhealthy",
        message: `Database connection failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check Docker daemon status
   */
  private async checkDocker(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const isAvailable = dockerHelper.isAvailable();

      if (!isAvailable) {
        return {
          name: "docker",
          status: "warning",
          message: "Docker is not available (tests will use mocks)",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          details: { usingMocks: true },
        };
      }

      return {
        name: "docker",
        status: "healthy",
        message: "Docker daemon is accessible",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        name: "docker",
        status: "warning",
        message: `Docker check failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const stats = fs.statfsSync("/");

      const totalSpace = stats.bsize * stats.blocks;
      const freeSpace = stats.bsize * stats.bfree;
      const usedSpace = totalSpace - freeSpace;
      const usagePercent = (usedSpace / totalSpace) * 100;

      const threshold = this.config.get("disk")?.warningThreshold || 90;
      const critical = this.config.get("disk")?.criticalThreshold || 95;

      let status: HealthStatus = "healthy";
      let message = `Disk usage: ${usagePercent.toFixed(1)}%`;

      if (usagePercent >= critical) {
        status = "unhealthy";
        message = `Critical disk usage: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent >= threshold) {
        status = "warning";
        message = `High disk usage: ${usagePercent.toFixed(1)}%`;
      }

      return {
        name: "disk",
        status,
        message,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        details: {
          totalBytes: totalSpace,
          freeBytes: freeSpace,
          usedBytes: usedSpace,
          usagePercent: Math.round(usagePercent * 100) / 100,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        name: "disk",
        status: "warning",
        message: `Disk check failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const used = process.memoryUsage();
      const usagePercent = (used.heapUsed / used.heapTotal) * 100;

      const threshold = this.config.get("memory")?.warningThreshold || 85;
      const critical = this.config.get("memory")?.criticalThreshold || 95;

      let status: HealthStatus = "healthy";
      let message = `Memory usage: ${usagePercent.toFixed(1)}%`;

      if (usagePercent >= critical) {
        status = "unhealthy";
        message = `Critical memory usage: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent >= threshold) {
        status = "warning";
        message = `High memory usage: ${usagePercent.toFixed(1)}%`;
      }

      return {
        name: "memory",
        status,
        message,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        details: {
          heapUsed: used.heapUsed,
          heapTotal: used.heapTotal,
          external: used.external,
          usagePercent: Math.round(usagePercent * 100) / 100,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        name: "memory",
        status: "warning",
        message: `Memory check failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Register default health checks
   */
  private registerDefaultChecks(): void {
    this.registerCheck("database", () => this.checkDatabase(), {
      enabled: true,
      timeoutMs: 5000,
    });

    this.registerCheck("docker", () => this.checkDocker(), {
      enabled: true,
      timeoutMs: 3000,
    });

    this.registerCheck("disk", () => this.checkDiskSpace(), {
      enabled: true,
      timeoutMs: 3000,
      warningThreshold: 90,
      criticalThreshold: 95,
    });

    this.registerCheck("memory", () => this.checkMemory(), {
      enabled: true,
      timeoutMs: 2000,
      warningThreshold: 85,
      criticalThreshold: 95,
    });
  }

  /**
   * Run check with timeout
   */
  private async runWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

// Export singleton
export const health = HealthChecker.getInstance();

// Convenience functions
export const checkHealth = () => health.checkAll();
export const checkDatabase = () => health.checkOne("database");
export const checkDocker = () => health.checkOne("docker");
export const checkDiskSpace = () => health.checkOne("disk");
export const checkMemory = () => health.checkOne("memory");

export default health;
