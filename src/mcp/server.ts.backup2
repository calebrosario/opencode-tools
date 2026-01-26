// MCP Server - Phase 1: Critical Edge Cases
// Enhanced server with crash recovery capabilities

import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { logger } from '../util/logger';
import { MCP_PORT, MCP_HOST, MCP_MAX_CONNECTIONS, MCP_REQUEST_TIMEOUT_MS } from '../config';
import { stateValidator } from '../util/state-validator';
import { OpenCodeError } from '../types';

export interface MCPRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
  timestamp: Date;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  timestamp: Date;
}

export interface ServerState {
  tools: Record<string, any>;
  activeRequests: Map<string, MCPRequest>;
  startTime: Date;
  lastHealthCheck: Date;
  crashCount: number;
}

export class MCPServerEnhanced {
  private static instance: MCPServerEnhanced;
  private server: HttpServer | null = null;
  private state: ServerState;
  private healthCheckInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  private constructor() {
    this.state = {
      tools: {},
      activeRequests: new Map(),
      startTime: new Date(),
      lastHealthCheck: new Date(),
      crashCount: 0,
    };
  }

  public static getInstance(): MCPServerEnhanced {
    if (!MCPServerEnhanced.instance) {
      MCPServerEnhanced.instance = new MCPServerEnhanced();
    }
    return MCPServerEnhanced.instance;
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Starting Enhanced MCP Server with crash recovery...');
      
      // Load previous state for crash detection
      await this.loadState();
      
      // Create HTTP server
      this.server = createServer(this.handleRequest.bind(this));
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      logger.info('✅ Enhanced MCP Server initialized');
    } catch (error) {
      logger.error('Failed to initialize Enhanced MCP Server', { error });
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (!this.server) {
      throw new OpenCodeError('SERVER_NOT_INITIALIZED', 'MCP Server not initialized');
    }

    return new Promise<void>((resolve, reject) => {
      this.server!.listen(MCP_PORT, MCP_HOST, () => {
        logger.info('✅ Enhanced MCP Server started', { port: MCP_PORT });
        resolve();
      });

      this.server!.on('error', (error: any) => {
        logger.error('Server error', { error: error.message });
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    await this.saveState();
    
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          logger.info('✅ Enhanced MCP Server stopped');
          resolve();
        });
      });
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (this.isShuttingDown) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server shutting down' }));
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const request: MCPRequest = JSON.parse(body);
        request.timestamp = new Date();
        
        this.state.activeRequests.set(request.id, request);
        
        const response = await this.processRequest(request);
        this.state.activeRequests.delete(request.id);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        logger.error('Request processing failed', { error });
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Request processing failed' }));
      }
    });
  }

  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise<MCPResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new OpenCodeError('REQUEST_TIMEOUT', 'Request timed out'));
      }, MCP_REQUEST_TIMEOUT_MS);

      // Simple mock response for now
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({
          id: request.id,
          result: { status: 'ok', method: request.method },
          timestamp: new Date(),
        });
      }, 100);
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  private performHealthCheck(): void {
    try {
      this.state.lastHealthCheck = new Date();
      
      // Check for hanging requests
      const now = Date.now();
      for (const [requestId, request] of this.state.activeRequests) {
        const age = now - request.timestamp.getTime();
        if (age > MCP_REQUEST_TIMEOUT_MS * 2) {
          logger.warn('Hanging request detected', { requestId, age });
          this.state.activeRequests.delete(requestId);
        }
      }
      
      // Save state periodically
      this.saveState().catch(error => {
        logger.warn('Failed to save state during health check', { error });
      });
    } catch (error) {
      logger.error('Health check failed', { error });
    }
  }

  private async loadState(): Promise<void> {
    try {
      const stateData = stateValidator.loadState('./data/mcp-server-state.json');
      if (stateData) {
        this.state = {
          ...this.state,
          ...stateData,
          startTime: new Date(stateData.startTime),
          lastHealthCheck: new Date(stateData.lastHealthCheck),
          activeRequests: new Map(),
        };
        
        // Detect crash recovery
        if (stateData.crashCount >= 0) {
          this.state.crashCount = stateData.crashCount + 1;
          logger.warn('MCP Server crash recovery detected', {
            crashCount: this.state.crashCount,
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to load MCP server state', { error });
    }
  }

  private async saveState(): Promise<void> {
    try {
      const stateToSave = {
        tools: this.state.tools,
        startTime: this.state.startTime,
        lastHealthCheck: this.state.lastHealthCheck,
        crashCount: this.state.crashCount,
      };
      
      stateValidator.saveState('./data/mcp-server-state.json', stateToSave, 1);
    } catch (error) {
      logger.warn('Failed to save MCP server state', { error });
    }
  }

  public async handleCrash(): Promise<void> {
    logger.error('🚨 MCP Server crash detected - initiating recovery');
    
    try {
      this.state.crashCount++;
      await this.saveState();
      
      // Create crash report
      const crashReport = {
        timestamp: new Date(),
        crashCount: this.state.crashCount,
        uptime: Date.now() - this.state.startTime.getTime(),
        activeRequests: Array.from(this.state.activeRequests.entries()),
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      };
      
      require('fs').writeFileSync(
        `./logs/crash-report-${Date.now()}.json`,
        JSON.stringify(crashReport, null, 2)
      );
      
      logger.info('Crash report saved');
    } catch (error) {
      logger.error('Failed to handle crash', { error });
    }
  }

  public async restart(): Promise<void> {
    logger.warn('🔄 Restarting MCP Server');
    
    try {
      await this.saveState();
      await this.stop();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isShuttingDown = false;
      await this.initialize();
      await this.start();
      
      logger.info('✅ MCP Server restarted successfully');
    } catch (error) {
      logger.error('Failed to restart MCP Server', { error });
      throw error;
    }
  }
}

// Initialize with crash recovery
MCPServerEnhanced.getInstance().initialize().catch((error) => {
  logger.error('Failed to initialize Enhanced MCP Server', { error });
  
  // Attempt crash recovery
  setTimeout(async () => {
    logger.warn('Attempting crash recovery restart...');
    try {
      await MCPServerEnhanced.getInstance().restart();
    } catch (restartError) {
      logger.error('Crash recovery failed', { error: restartError });
    }
  }, 5000);
});
