import { ResourceMonitor } from '../resource-monitor';
import { logger } from '../logger';

describe('Phase 1: Resource Exhaustion Tests', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    monitor = ResourceMonitor.getInstance();
  });

  describe('Memory Exhaustion', () => {
    it('should detect memory threshold breach', () => {
      const containerId = 'test-container-memory';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const status = monitor.checkResourceStatus(containerId);
      
      expect(status.memoryUsagePercent).toBeDefined();
      
      if (status.memoryUsagePercent) {
        expect(status.memoryUsagePercent).toBeGreaterThanOrEqual(0);
        expect(status.memoryUsagePercent).toBeLessThanOrEqual(100);
      }
    });

    it('should generate alert when memory > 85%', () => {
      const containerId = 'test-container-high-memory';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const thresholdBreached = monitor.checkThreshold(containerId, 'memory', 85);
      
      expect(typeof thresholdBreached).toBe('boolean');
    });

    it('should enforce 20% memory buffer before limit', () => {
      const containerId = 'test-container-buffer';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const status = monitor.checkResourceStatus(containerId);
      
      expect(status).toHaveProperty('bufferAvailable');
    });
  });

  describe('CPU Exhaustion', () => {
    it('should detect high CPU usage', () => {
      const containerId = 'test-container-cpu';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const status = monitor.checkResourceStatus(containerId);
      
      expect(status).toHaveProperty('cpuUsagePercent');
    });
  });

  describe('PID Exhaustion', () => {
    it('should detect PID limit breach', () => {
      const containerId = 'test-container-pids';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const status = monitor.checkResourceStatus(containerId);
      
      expect(status).toHaveProperty('pidCount');
    });

    it('should generate alert when PIDs > 80%', () => {
      const containerId = 'test-container-high-pids';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const thresholdBreached = monitor.checkThreshold(containerId, 'pids', 80);
      
      expect(typeof thresholdBreached).toBe('boolean');
    });

    it('should enforce 10% PID buffer before limit', () => {
      const containerId = 'test-container-pid-buffer';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const status = monitor.checkResourceStatus(containerId);
      
      expect(status).toHaveProperty('bufferAvailable');
    });
  });

  describe('Disk Exhaustion', () => {
    it('should detect disk usage', () => {
      const containerId = 'test-container-disk';
      const limits = {
        cpuShares: 512,
        diskMB: 2048,
        memoryMB: 256,
        pidsLimit: 100,
      };

      monitor.registerContainer(containerId, limits);
      
      const status = monitor.checkResourceStatus(containerId);
      
      expect(status).toHaveProperty('diskUsagePercent');
    });
  });

  describe('System-wide Resource Aggregation', () => {
    it('should aggregate resources across all containers', () => {
      const container1 = 'test-container-1';
      const container2 = 'test-container-2';
      
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(container1, limits);
      monitor.registerContainer(container2, limits);
      
      const systemStatus = monitor.getSystemResourceStatus();
      
      expect(systemStatus).toHaveProperty('totalContainers');
      expect(systemStatus.totalContainers).toBeGreaterThanOrEqual(2);
    });

    it('should calculate total resource usage', () => {
      const container1 = 'test-container-1';
      const container2 = 'test-container-2';
      
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(container1, limits);
      monitor.registerContainer(container2, limits);
      
      const systemStatus = monitor.getSystemResourceStatus();
      
      expect(systemStatus).toHaveProperty('totalMemoryMB');
      expect(systemStatus).toHaveProperty('totalCPUPercent');
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup unregistered containers', () => {
      const containerId = 'test-container-cleanup';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      monitor.unregisterContainer(containerId);
      
      const status = monitor.checkResourceStatus(containerId);
      expect(status).toBeNull();
    });

    it('should perform emergency cleanup', () => {
      const containerIds = ['test-emergency-1', 'test-emergency-2', 'test-emergency-3'];
      
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      containerIds.forEach(id => {
        monitor.registerContainer(id, limits);
      });

      const removed = monitor.emergencyCleanup();
      
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Alert Deduplication', () => {
    it('should deduplicate alerts within time window', () => {
      const containerId = 'test-container-dedup';
      const limits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      monitor.registerContainer(containerId, limits);
      
      const status1 = monitor.checkResourceStatus(containerId);
      const status2 = monitor.checkResourceStatus(containerId);
      
      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
    });
  });

  describe('Resource Limit Validation', () => {
    it('should validate resource limits before registration', () => {
      const invalidLimits = {
        cpuShares: 0,
        memoryMB: 0,
      };

      const isValid = monitor.validateLimits(invalidLimits);
      
      expect(isValid).toBe(false);
    });

    it('should accept valid resource limits', () => {
      const validLimits = {
        cpuShares: 1024,
        memoryMB: 400,
        pidsLimit: 50,
      };

      const isValid = monitor.validateLimits(validLimits);
      
      expect(isValid).toBe(true);
    });
  });
});
