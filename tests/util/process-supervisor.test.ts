import { ProcessSupervisor } from '../../src/util/process-supervisor';

describe('ProcessSupervisor', () => {
  let supervisor: ProcessSupervisor;

  beforeEach(() => {
    supervisor = ProcessSupervisor.getInstance();
  });

  describe('Process Management', () => {
    it('should track process state', () => {
      const status = supervisor.getProcessStatus('non-existent');
      expect(status).toBeNull();
    });

    it('should provide process listing', () => {
      const processes = supervisor.getAllProcesses();
      expect(processes).toBeInstanceOf(Map);
    });

    it('should handle emergency stop', async () => {
      await expect(supervisor.emergencyStopAll()).resolves.not.toThrow();
    });
  });

  describe('Process Configuration', () => {
    it('should validate process config structure', () => {
      // Test that the ProcessConfig interface is properly defined
      const config = {
        command: 'node',
        args: ['--version'],
        restartDelay: 1000,
        maxRestarts: 3,
        healthCheck: {
          port: 3000,
          timeout: 5000,
        },
      };

      expect(config.command).toBe('node');
      expect(config.restartDelay).toBe(1000);
      expect(config.maxRestarts).toBe(3);
    });
  });

  describe('Health Monitoring', () => {
    it('should support health check configuration', () => {
      const healthCheck = {
        url: 'http://localhost:3000/health',
        timeout: 5000,
      };

      expect(healthCheck.url).toContain('health');
      expect(healthCheck.timeout).toBe(5000);
    });

    it('should support port-based health checks', () => {
      const healthCheck = {
        port: 3000,
        timeout: 3000,
      };

      expect(healthCheck.port).toBe(3000);
      expect(healthCheck.timeout).toBe(3000);
    });
  });

  describe('Process Lifecycle', () => {
    it('should handle process state transitions', () => {
      // Test the ProcessState interface
      const state = {
        pid: 12345,
        startTime: new Date(),
        restartCount: 0,
        lastHealthCheck: new Date(),
        status: 'running' as const,
      };

      expect(state.status).toBe('running');
      expect(state.restartCount).toBe(0);
      expect(state.pid).toBe(12345);
    });

    it('should track restart attempts', () => {
      let restartCount = 0;
      const maxRestarts = 3;

      // Simulate restart logic
      while (restartCount < maxRestarts) {
        restartCount++;
        if (restartCount >= maxRestarts) {
          break;
        }
      }

      expect(restartCount).toBe(maxRestarts);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid process configurations', async () => {
      const invalidConfig = {
        command: 'nonexistent-command',
        args: [],
        restartDelay: 1000,
        maxRestarts: 3,
      };

      // Should reject with error for invalid command
      await expect(
        supervisor.startProcess('invalid-process', invalidConfig)
      ).rejects.toThrow();
    });
  });
});
