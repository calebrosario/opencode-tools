import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { logger } from "../util/logger";

const execAsync = promisify(exec);

export interface DesktopVersion {
  version: string;
  apiVersion: string;
  platform: string;
  buildTime?: string;
  components?: {
    engine: string;
    compose: string;
    kubernetes?: string;
  };
}

export interface CompatibilityResult {
  compatible: boolean;
  version: DesktopVersion | null;
  socketPath: string;
  warnings: string[];
  errors: string[];
}

export interface SocketInfo {
  path: string;
  exists: boolean;
  accessible: boolean;
  platform: "macos" | "linux" | "windows";
}

const SOCKET_PATHS = {
  macos: [
    "~/.docker/run/docker.sock",
    "~/Library/Containers/com.docker.docker/Data/docker.sock",
    "/var/run/docker.sock",
  ],
  linux: ["/var/run/docker.sock", "/run/docker.sock"],
  windows: ["//./pipe/docker_engine", "//./pipe/dockerDesktopLinuxEngine"],
};

export class DesktopCompatibility {
  private static instance: DesktopCompatibility;
  private cachedVersion: DesktopVersion | null = null;
  private cachedSocketPath: string | null = null;

  private constructor() {}

  public static getInstance(): DesktopCompatibility {
    if (!DesktopCompatibility.instance) {
      DesktopCompatibility.instance = new DesktopCompatibility();
    }
    return DesktopCompatibility.instance;
  }

  public async detectDesktopVersion(): Promise<DesktopVersion | null> {
    if (this.cachedVersion) {
      return this.cachedVersion;
    }

    try {
      const { stdout: versionOutput } = await execAsync(
        "docker version --format '{{json .}}'",
        { timeout: 10000 },
      );

      const versionData = JSON.parse(versionOutput);

      const version: DesktopVersion = {
        version:
          versionData.Server?.Version ||
          versionData.Client?.Version ||
          "unknown",
        apiVersion:
          versionData.Server?.ApiVersion ||
          versionData.Client?.ApiVersion ||
          "unknown",
        platform: versionData.Server?.Os || process.platform,
        buildTime: versionData.Server?.BuildTime,
        components: {
          engine: versionData.Server?.Engine || "unknown",
          compose: versionData.Client?.Plugins?.compose || "unknown",
          kubernetes: versionData.Client?.Plugins?.kubernetes,
        },
      };

      this.cachedVersion = version;
      logger.info("Docker Desktop version detected", { version });
      return version;
    } catch (error: any) {
      logger.warn("Failed to detect Docker Desktop version", {
        error: error.message,
      });
      return null;
    }
  }

  public async getSocketPath(): Promise<string> {
    if (this.cachedSocketPath) {
      return this.cachedSocketPath;
    }

    const envSocket = process.env.DOCKER_SOCKET || process.env.DOCKER_HOST;
    if (envSocket) {
      const socketPath = envSocket
        .replace(/^unix:\/\//, "")
        .replace(/^tcp:\/\//, "");
      this.cachedSocketPath = socketPath;
      return socketPath;
    }

    const platform = this.getPlatform();
    const socketPaths = SOCKET_PATHS[platform];

    for (const socketPath of socketPaths) {
      const expandedPath = this.expandPath(socketPath);
      try {
        await fs.access(expandedPath);
        this.cachedSocketPath = expandedPath;
        logger.info("Docker socket found", { path: expandedPath, platform });
        return expandedPath;
      } catch {
        continue;
      }
    }

    const defaultPath = "/var/run/docker.sock";
    logger.warn("No Docker socket found, using default", { path: defaultPath });
    return defaultPath;
  }

  public async isDesktopRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        "docker info --format '{{.ServerVersion}}'",
        {
          timeout: 5000,
        },
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  public async getApiVersion(): Promise<string> {
    const version = await this.detectDesktopVersion();
    return version?.apiVersion || "1.41";
  }

  public async getSocketInfo(): Promise<SocketInfo> {
    const platform = this.getPlatform();
    const socketPath = await this.getSocketPath();

    let exists = false;
    let accessible = false;

    try {
      await fs.access(socketPath, fs.constants.F_OK);
      exists = true;
      await fs.access(socketPath, fs.constants.R_OK | fs.constants.W_OK);
      accessible = true;
    } catch {}

    return {
      path: socketPath,
      exists,
      accessible,
      platform,
    };
  }

  public async ensureCompatibility(): Promise<CompatibilityResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    const version = await this.detectDesktopVersion();
    const socketInfo = await this.getSocketInfo();

    if (!version) {
      errors.push("Could not detect Docker Desktop version");
    }

    if (!socketInfo.exists) {
      errors.push(`Docker socket not found at ${socketInfo.path}`);
    } else if (!socketInfo.accessible) {
      errors.push(`Docker socket not accessible at ${socketInfo.path}`);
    }

    if (version && version.apiVersion) {
      const apiNum = parseFloat(version.apiVersion);
      if (apiNum < 1.35) {
        warnings.push(
          `Docker API version ${version.apiVersion} is old. Some features may not work.`,
        );
      }
    }

    if (version?.platform === "windows" && socketInfo.platform !== "windows") {
      warnings.push("Docker platform mismatch detected");
    }

    const compatible = errors.length === 0;

    return {
      compatible,
      version,
      socketPath: socketInfo.path,
      warnings,
      errors,
    };
  }

  public async createCompatibleClient(): Promise<any> {
    const socketPath = await this.getSocketPath();
    const compat = await this.ensureCompatibility();

    if (!compat.compatible) {
      throw new Error(
        `Docker Desktop not compatible: ${compat.errors.join(", ")}`,
      );
    }

    try {
      const Docker = require("dockerode");
      return new Docker({ socketPath });
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error("dockerode module not installed");
      }
      throw error;
    }
  }

  public clearCache(): void {
    this.cachedVersion = null;
    this.cachedSocketPath = null;
  }

  private getPlatform(): "macos" | "linux" | "windows" {
    const platform = process.platform;
    if (platform === "darwin") return "macos";
    if (platform === "win32") return "windows";
    return "linux";
  }

  private expandPath(filePath: string): string {
    if (filePath.startsWith("~")) {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
  }
}

export const desktopCompatibility = DesktopCompatibility.getInstance();
