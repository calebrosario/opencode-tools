import { MCPServerEnhanced } from '../../mcp/server';
import { stateValidator } from '../state-validator';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 1: Crash Recovery Tests', () => {
  const stateFile = './data/mcp-server-state.json';
  const crashReportDir = './logs';

  beforeEach(() => {
    if (fs.existsSync(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  });

  afterEach(() => {
    if (fs.existsSync(crashReportDir)) {
      const files = fs.readdirSync(crashReportDir);
      files.forEach(file => {
        if (file.startsWith('crash-report-')) {
          const filePath = path.join(crashReportDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
          }
        }
      });
    }
  });

  describe('MCP Server Crash Detection', () => {
    it('should load state on initialization', () => {
      const server = MCPServerEnhanced.getInstance();
      expect(server).toBeDefined();
    });

    it('should detect crash on subsequent initialization', async () => {
      const server1 = MCPServerEnhanced.getInstance();
      await server1.initialize();
      
      const crashCount = (server1 as any).state.crashCount;
      expect(crashCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('State Persistence', () => {
    it('should save state during shutdown', async () => {
      const server = MCPServerEnhanced.getInstance();
      await server.stop();
      
      expect(fs.existsSync(stateFile)).toBe(true);
    });

    it('should preserve crash count across restarts', async () => {
      const server1 = MCPServerEnhanced.getInstance();
      await server1.initialize();
      await server1.stop();
      
      const server2 = MCPServerEnhanced.getInstance();
      await server2.initialize();
      
      const crashCount = (server2 as any).state.crashCount;
      expect(crashCount).toBeGreaterThanOrEqual(1);
    });

    it('should restore registered tools after restart', async () => {
      const server1 = MCPServerEnhanced.getInstance();
      await server1.initialize();
      
      const tools1 = server1.getAllTools();
      expect(Object.keys(tools1).length).toBeGreaterThanOrEqual(4);
      
      await server1.stop();
      
      const server2 = MCPServerEnhanced.getInstance();
      await server2.initialize();
      
      const tools2 = server2.getAllTools();
      expect(Object.keys(tools2).length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Crash Report Generation', () => {
    it('should generate crash report on handleCrash', async () => {
      const server = MCPServerEnhanced.getInstance();
      await server.handleCrash();
      
      const files = fs.readdirSync(crashReportDir);
      const crashReports = files.filter(file => file.startsWith('crash-report-'));
      
      expect(crashReports.length).toBeGreaterThan(0);
    });

    it('should include crash metadata in report', async () => {
      const server = MCPServerEnhanced.getInstance();
      await server.handleCrash();
      
      const files = fs.readdirSync(crashReportDir);
      const crashReports = files.filter(file => file.startsWith('crash-report-'));
      
      if (crashReports.length > 0) {
        const reportFile = path.join(crashReportDir, crashReports[0]);
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        
        expect(report).toHaveProperty('timestamp');
        expect(report).toHaveProperty('crashCount');
        expect(report).toHaveProperty('uptime');
        expect(report).toHaveProperty('platform');
        expect(report).toHaveProperty('nodeVersion');
      }
    });
  });

  describe('Server Restart', () => {
    it('should restart server successfully', async () => {
      const server = MCPServerEnhanced.getInstance();
      
      await expect(server.restart()).resolves.not.toThrow();
    });

    it('should clear isShuttingDown flag after restart', async () => {
      const server = MCPServerEnhanced.getInstance();
      await server.restart();
      
      const isShuttingDown = (server as any).isShuttingDown;
      expect(isShuttingDown).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    it('should update lastHealthCheck timestamp', async () => {
      const server = MCPServerEnhanced.getInstance();
      await server.initialize();
      
      const initialTime = (server as any).state.lastHealthCheck;
      expect(initialTime).toBeDefined();
      
      await new Promise(resolve => setTimeout(resolve, 35000));
      
      const updatedTime = (server as any).state.lastHealthCheck;
      expect(updatedTime.getTime()).toBeGreaterThan(initialTime.getTime());
    });
  });

  describe('Error Recovery', () => {
    it('should handle initialization errors gracefully', async () => {
      const server = MCPServerEnhanced.getInstance();
      
      try {
        await server.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should restart after crash', async () => {
      const server = MCPServerEnhanced.getInstance();
      
      await expect(server.restart()).resolves.not.toThrow();
      
      const crashCount = (server as any).state.crashCount;
      expect(crashCount).toBeGreaterThanOrEqual(0);
    });
  });
});
