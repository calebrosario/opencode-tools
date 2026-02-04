import { ResourceMonitor, ResourceLimits } from '../../src/util/resource-monitor';

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    monitor = ResourceMonitor.getInstance();
    monitor.stopMonitoring();
    // Clear any existing registrations
    monitor['resourceUsage'].clear();
    monitor['alertsTriggered'].clear();
  });

  describe('Resource Limit Checking', () => {
    it('should allow requests within limits', async () => {
      const request: Partial<ResourceLimits> = {
        memoryMB: 256,
        pidsLimit: 50,
      };

      const allowed = await monitor.checkResourceLimits(request);
      expect(allowed).toBe(true);
    });

    it('should reject memory requests that exceed limits', async () => {
      // Register a container using most of the memory
      monitor.registerContainer('test-container-1', {
        memoryMB: 400,
        cpuShares: 1024,
        pidsLimit: 50,
      });

      // Try to add another container that would exceed the buffer
      const request: Partial<ResourceLimits> = {
        memoryMB: 200, // This should push us over the 80% buffer limit
      };

      const allowed = await monitor.checkResourceLimits(request);
      expect(allowed).toBe(false);
    });

    it('should reject PID requests that exceed limits', async () => {
      // Register containers using most PIDs
      monitor.registerContainer('test-container-1', {
        memoryMB: 128,
        cpuShares: 1024,
        pidsLimit: 80,
      });

      const request: Partial<ResourceLimits> = {
        pidsLimit: 20, // This should push us over the 90% buffer limit
      };

      const allowed = await monitor.checkResourceLimits(request);
      expect(allowed).toBe(false);
    });
  });

  describe('Container Registration', () => {
    it('should register containers with resource limits', () => {
      const limits: ResourceLimits = {
        memoryMB: 256,
        cpuShares: 512,
        pidsLimit: 100,
        diskMB: 2048,
      };

      monitor.registerContainer('test-container', limits);

      const usage = monitor.getContainerUsage('test-container');
      expect(usage).toBeTruthy();
      expect(usage!.memory.limit).toBe(256);
      expect(usage!.cpu.limit).toBe(512);
      expect(usage!.pids.limit).toBe(100);
      expect(usage!.disk.limit).toBe(2048);
    });

    it('should unregister containers', () => {
      monitor.registerContainer('test-container', {
        memoryMB: 128,
        cpuShares: 512,
        pidsLimit: 50,
      });

      monitor.unregisterContainer('test-container');
      expect(monitor.getContainerUsage('test-container')).toBeNull();
    });
  });

  describe('Resource Usage Updates', () => {
    it('should update container resource usage', () => {
      monitor.registerContainer('test-container', {
        memoryMB: 512,
        cpuShares: 1024,
        pidsLimit: 100,
      });

      monitor.updateContainerUsage('test-container', {
        memory: { used: 256, limit: 512, percentage: 50 },
        cpu: { used: 75, limit: 1024 },
        pids: { used: 25, limit: 100, percentage: 25 },
      });

      const usage = monitor.getContainerUsage('test-container');
      expect(usage!.memory.used).toBe(256);
      expect(usage!.memory.percentage).toBe(50);
      expect(usage!.cpu.used).toBe(75);
      expect(usage!.pids.used).toBe(25);
    });

    it('should trigger alerts for high resource usage', () => {
      monitor.registerContainer('test-container', {
        memoryMB: 512,
        cpuShares: 1024,
        pidsLimit: 100,
      });

      // Update with high memory usage (>90%)
      monitor.updateContainerUsage('test-container', {
        memory: { used: 460, limit: 512, percentage: 90 },
        pids: { used: 85, limit: 100, percentage: 85 },
      });

      // Alerts should be triggered (we can't easily test the logging, but the logic runs)
      const alertsTriggered = monitor['alertsTriggered'];
      expect(alertsTriggered.has('test-container-memory')).toBe(true);
      expect(alertsTriggered.has('test-container-pids')).toBe(true);
    });

    it('should clear alerts when usage drops', () => {
      monitor.registerContainer('test-container', {
        memoryMB: 512,
        cpuShares: 1024,
        pidsLimit: 100,
      });

      // High usage triggers alerts
      monitor.updateContainerUsage('test-container', {
        memory: { used: 460, limit: 512, percentage: 90 },
      });

      // Lower usage clears alerts
      monitor.updateContainerUsage('test-container', {
        memory: { used: 256, limit: 512, percentage: 50 },
      });

      const alertsTriggered = monitor['alertsTriggered'];
      expect(alertsTriggered.has('test-container-memory')).toBe(false);
    });
  });

  describe('System Resource Aggregation', () => {
    it('should aggregate resource usage across containers', async () => {
      monitor.registerContainer('container-1', {
        memoryMB: 256,
        cpuShares: 512,
        pidsLimit: 50,
      });

      monitor.registerContainer('container-2', {
        memoryMB: 128,
        cpuShares: 512,
        pidsLimit: 30,
      });

      const systemUsage = await monitor.getSystemResourceUsage();

      expect(systemUsage.memory.used).toBe(0); // No actual usage recorded
      expect(systemUsage.memory.limit).toBe(8192); // System memory limit
      expect(systemUsage.pids.limit).toBe(1024); // System PID limit
    });
  });

  describe('Default Limits', () => {
    it('should provide default resource limits', () => {
      const defaults = monitor.getDefaultLimits();

      expect(defaults.memoryMB).toBeGreaterThan(0);
      expect(defaults.cpuShares).toBeGreaterThan(0);
      expect(defaults.pidsLimit).toBeGreaterThan(0);
    });
  });

  describe('Emergency Cleanup', () => {
    it('should perform emergency cleanup', () => {
      monitor.registerContainer('container-1', {
        memoryMB: 128,
        cpuShares: 512,
        pidsLimit: 50,
      });

      monitor.registerContainer('container-2', {
        memoryMB: 128,
        cpuShares: 512,
        pidsLimit: 50,
      });

      const cleaned = monitor.emergencyCleanup();
      expect(cleaned).toBe(2);
      expect(monitor.getContainerUsage('container-1')).toBeNull();
      expect(monitor.getContainerUsage('container-2')).toBeNull();
    });
  });
});
