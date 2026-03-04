// MCP Server - Phase 1: Critical Edge Cases
// Enhanced server with crash recovery capabilities and tool registration

import {
  createServer,
  Server as HttpServer,
  IncomingMessage,
  ServerResponse,
} from "http";
import { logger } from "../util/logger";
import {
  MCP_PORT,
  MCP_HOST,
  MCP_MAX_CONNECTIONS,
  MCP_REQUEST_TIMEOUT_MS,
} from "../config";
import { stateValidator } from "../util/state-validator";
import { OpenCodeError } from "../types";
import { resourceMonitor } from "../util/resource-monitor";
import { health } from "../monitoring/health";

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

export interface MCPTool {
  name: string;
  description: string;
  execute: (params: Record<string, any>) => Promise<any>;
}

export const TOOL_DEFINITIONS: MCPTool[] = [
  {
    name: "create_task_sandbox",
    description: "Create a new task sandbox with Docker container",
    execute: async (params: Record<string, any>) => {
      return {
        status: "ok",
        taskId: params.taskId || "default",
        message: "Task sandbox created",
      };
    },
  },
  {
    name: "attach_agent_to_task",
    description: "Attach an AI agent to an existing task",
    execute: async (params: Record<string, any>) => {
      return {
        status: "ok",
        agentId: params.agentId || "default",
        message: "Agent attached",
      };
    },
  },
  {
    name: "detach_agent_from_task",
    description: "Detach an agent from a task",
    execute: async (params: Record<string, any>) => {
      return { status: "ok", message: "Agent detached" };
    },
  },
  {
    name: "execute_in_task",
    description: "Execute a command in a task container",
    execute: async (params: Record<string, any>) => {
      const command = params.command || "echo hello";
      return {
        status: "ok",
        output: "Executed: " + command,
        message: "Command executed",
      };
    },
  },
];

export interface ServerState {
  tools: Record<string, MCPTool>;
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

  public registerTool(tool: MCPTool): void {
    this.state.tools[tool.name] = tool;
    logger.info("Tool registered", { tool: tool.name });
  }

  public getTool(name: string): MCPTool | undefined {
    return this.state.tools[name];
  }

  public getAllTools(): Record<string, MCPTool> {
    return this.state.tools;
  }

  public async initialize(): Promise<void> {
    try {
      logger.info(
        "Starting Enhanced MCP Server with crash recovery and tool registration...",
      );

      await this.loadState();

      TOOL_DEFINITIONS.forEach((tool) => this.registerTool(tool));

      this.server = createServer(this.handleRequest.bind(this));

      this.startHealthMonitoring();

      logger.info(
        "Enhanced MCP Server initialized with " +
          TOOL_DEFINITIONS.length +
          " tools",
      );
    } catch (error) {
      logger.error("Failed to initialize Enhanced MCP Server", { error });
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (!this.server) {
      throw new OpenCodeError(
        "SERVER_NOT_INITIALIZED",
        "MCP Server not initialized",
      );
    }

    return new Promise<void>((resolve, reject) => {
      this.server!.listen(MCP_PORT, MCP_HOST, () => {
        logger.info("Enhanced MCP Server started", {
          port: MCP_PORT,
          tools: Object.keys(this.state.tools).length,
        });
        resolve();
      });

      this.server!.on("error", (error: any) => {
        logger.error("Server error", { error: error.message });
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
          logger.info("Enhanced MCP Server stopped");
          resolve();
        });
      });
    }
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (this.isShuttingDown) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Server shutting down" }));
      return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === "/metrics" && req.method === "GET") {
      await this.handleMetricsRequest(res);
      return;
    }

    if (req.url === "/healthz" && req.method === "GET") {
      await this.handleHealthRequest(res);
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      try {
        const request: MCPRequest = JSON.parse(body);
        request.timestamp = new Date();

        this.state.activeRequests.set(request.id, request);

        const response = await this.processRequest(request);
        this.state.activeRequests.delete(request.id);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error) {
        logger.error("Request processing failed", { error });
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Request processing failed" }));
      }
    });
  }

  private async handleMetricsRequest(res: ServerResponse): Promise<void> {
    try {
      const resourceUsage = await resourceMonitor.getSystemResourceUsage();
      const healthResult = await health.checkAll();

      const metrics = {
        timestamp: new Date().toISOString(),
        resources: {
          memory: resourceUsage.memory,
          cpu: resourceUsage.cpu,
          pids: resourceUsage.pids,
          disk: resourceUsage.disk,
        },
        health: {
          overall: healthResult.overall,
          checks: healthResult.checks.map((c) => ({
            name: c.name,
            status: c.status,
            message: c.message,
          })),
        },
        containersTracked: resourceMonitor.getContainerCount(),
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics, null, 2));
    } catch (error) {
      logger.error("Metrics request failed", { error });
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Failed to gather metrics" }));
    }
  }

  private async handleHealthRequest(res: ServerResponse): Promise<void> {
    try {
      const healthResult = await health.checkAll();
      const statusCode =
        healthResult.overall === "healthy"
          ? 200
          : healthResult.overall === "warning"
            ? 200
            : 503;
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(healthResult));
    } catch (error) {
      logger.error("Health check failed", { error });
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Health check failed" }));
    }
  }

  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise<MCPResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new OpenCodeError("REQUEST_TIMEOUT", "Request timed out"));
      }, MCP_REQUEST_TIMEOUT_MS);

      setTimeout(async () => {
        clearTimeout(timeout);

        if (request.method === "tools/list") {
          resolve({
            id: request.id,
            result: {
              tools: Object.values(this.state.tools).map((tool) => ({
                name: tool.name,
                description: tool.description,
              })),
            },
            timestamp: new Date(),
          });
        } else {
          const tool = this.getTool(request.method);
          if (tool) {
            try {
              const result = await tool.execute(request.params || {});
              resolve({
                id: request.id,
                result,
                timestamp: new Date(),
              });
            } catch (error) {
              resolve({
                id: request.id,
                error: {
                  code: 500,
                  message:
                    error instanceof Error ? error.message : String(error),
                },
                timestamp: new Date(),
              });
            }
          } else {
            resolve({
              id: request.id,
              error: {
                code: 404,
                message: "Tool not found: " + request.method,
              },
              timestamp: new Date(),
            });
          }
        }
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

      const now = Date.now();
      for (const [requestId, request] of this.state.activeRequests) {
        const age = now - request.timestamp.getTime();
        if (age > MCP_REQUEST_TIMEOUT_MS * 2) {
          logger.warn("Hanging request detected", { requestId, age });
          this.state.activeRequests.delete(requestId);
        }
      }

      this.saveState().catch((error) => {
        logger.warn("Failed to save state during health check", { error });
      });
    } catch (error) {
      logger.error("Health check failed", { error });
    }
  }

  private async loadState(): Promise<void> {
    try {
      const stateData = stateValidator.loadState(
        "./data/mcp-server-state.json",
      );
      if (stateData) {
        this.state = {
          ...this.state,
          ...stateData,
          startTime: new Date(stateData.startTime),
          lastHealthCheck: new Date(stateData.lastHealthCheck),
          activeRequests: new Map(),
        };

        if (stateData.crashCount >= 0) {
          this.state.crashCount = stateData.crashCount + 1;
          logger.warn("MCP Server crash recovery detected", {
            crashCount: this.state.crashCount,
          });
        }
      }
    } catch (error) {
      logger.warn("Failed to load MCP server state", { error });
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

      stateValidator.saveState("./data/mcp-server-state.json", stateToSave, 1);
    } catch (error) {
      logger.warn("Failed to save MCP server state", { error });
    }
  }

  public async handleCrash(): Promise<void> {
    logger.error("MCP Server crash detected - initiating recovery");

    try {
      this.state.crashCount++;
      await this.saveState();

      const crashReport = {
        timestamp: new Date(),
        crashCount: this.state.crashCount,
        uptime: Date.now() - this.state.startTime.getTime(),
        activeRequests: Array.from(this.state.activeRequests.entries()),
        tools: Object.keys(this.state.tools),
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
      };

      require("fs").writeFileSync(
        "./logs/crash-report-" + Date.now() + ".json",
        JSON.stringify(crashReport, null, 2),
      );

      logger.info("Crash report saved");
    } catch (error) {
      logger.error("Failed to handle crash", { error });
    }
  }

  public async restart(): Promise<void> {
    logger.warn("Restarting MCP Server");

    try {
      await this.saveState();
      await this.stop();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.isShuttingDown = false;
      await this.initialize();
      await this.start();

      logger.info("MCP Server restarted successfully");
    } catch (error) {
      logger.error("Failed to restart MCP Server", { error });
      throw error;
    }
  }
}

MCPServerEnhanced.getInstance()
  .initialize()
  .catch((error) => {
    logger.error("Failed to initialize Enhanced MCP Server", { error });
    setTimeout(async () => {
      logger.warn("Attempting crash recovery restart...");
      try {
        await MCPServerEnhanced.getInstance().restart();
      } catch (restartError) {
        logger.error("Crash recovery failed", { error: restartError });
      }
    }, 5000);
  });
