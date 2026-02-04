// Docker Helper - Week 16: Docker Socket Detection & Test Infrastructure
// Provides dynamic Docker socket detection with graceful test skipping

import Docker from 'dockerode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { OpenCodeError } from '../types/index';

export const ERROR_CODES = {
  DOCKER_SOCKET_NOT_FOUND: 'DOCKER_SOCKET_NOT_FOUND',
  DOCKER_CONNECTION_FAILED: 'DOCKER_CONNECTION_FAILED',
  DOCKER_NOT_RESPONDING: 'DOCKER_NOT_RESPONDING',
} as const;

export class DockerHelper {
  private static instance: DockerHelper;
  private client: Docker | null = null;
  private available: boolean | null = null;

  private constructor() {}

  public static getInstance(): DockerHelper {
    if (!DockerHelper.instance) {
      DockerHelper.instance = new DockerHelper();
    }
    return DockerHelper.instance;
  }

  /**
   * Detect Docker socket path based on platform and environment
   * @returns Socket path string
   * @throws OpenCodeError if no socket found
   */
  public detectSocket(): string {
    // 1. Environment variable override
    if (process.env.DOCKER_SOCKET) {
      logger.debug('Using DOCKER_SOCKET override', { path: process.env.DOCKER_SOCKET });
      return process.env.DOCKER_SOCKET;
    }

    const platform = os.platform();
    const homeDir = os.homedir();

    // 2. macOS Docker Desktop locations
    if (platform === 'darwin') {
      const macosPaths = [
        path.join(homeDir, '.docker', 'run', 'docker.sock'),
        path.join(homeDir, 'Library', 'Containers', 'com.docker.docker', 'Data', 'docker.sock'),
        '/var/run/docker.sock', // Fallback to standard location
      ];

      logger.debug('Checking macOS Docker Desktop paths', { paths: macosPaths });

      for (const socketPath of macosPaths) {
        try {
          if (fs.existsSync(socketPath)) {
            logger.info('Docker socket found', { path: socketPath });
            return socketPath;
          }
        } catch (error) {
          // Filesystem errors - continue to next path
          continue;
        }
      }
    }

    // 3. Standard Linux location
    if (platform === 'linux') {
      const linuxPath = '/var/run/docker.sock';
      logger.debug('Checking Linux socket path', { path: linuxPath });
      
      try {
        if (fs.existsSync(linuxPath)) {
          logger.info('Docker socket found', { path: linuxPath });
          return linuxPath;
        }
      } catch (error) {
        // Filesystem error - continue
      }
    }

    // 4. Windows named pipe (for completeness, though dockerode handles)
    if (platform === 'win32') {
      logger.debug('Windows detected - named pipes handled by dockerode');
      // dockerode handles Windows named pipes automatically
      // Return empty to let dockerode auto-detect
      return '';
    }

    // 5. No socket found - throw error
    throw new OpenCodeError(
      ERROR_CODES.DOCKER_SOCKET_NOT_FOUND,
      'Docker socket not found. Checked paths:\n' +
        '- macOS Docker Desktop: ~/.docker/run/docker.sock, ~/Library/Containers/com.docker.docker/Data/docker.sock\n' +
        '- Linux: /var/run/docker.sock\n' +
        '- Windows: Named pipes (auto-detected by dockerode)\n\n' +
        'Set DOCKER_SOCKET environment variable to override, or ensure Docker is running.',
      { platform, homeDir }
    );
  }

  /**
   * Check if Docker is available (socket exists and can connect)
   * Caches result for performance
   * @returns true if Docker available, false otherwise
   */
  public isAvailable(): boolean {
    // Return cached result
    if (this.available !== null) {
      return this.available;
    }

    try {
      // Attempt to create client
      const socketPath = this.detectSocket();
      this.client = new Docker({ socketPath });
      
      // Test connection with docker.info()
      this.client.info((err, info) => {
        if (err) {
          logger.warn('Docker connection failed', { error: err.message });
          this.available = false;
        } else {
          logger.info('Docker is available', { version: info.ServerVersion });
          this.available = true;
        }
      });

      // For synchronous check, return optimistic result
      // Async validation happens in background
      this.available = true;
      return this.available;
    } catch (error: any) {
      // Socket not found or connection failed
      if (error.code === ERROR_CODES.DOCKER_SOCKET_NOT_FOUND ||
          error.code === 'ENOENT' ||
          error.code === 'ECONNREFUSED') {
        logger.warn('Docker not available', { error: error.message });
        this.available = false;
        return false;
      }

      // Unexpected error - log and assume unavailable
      logger.error('Unexpected Docker check error', { error });
      this.available = false;
      return false;
    }
  }

  /**
   * Create or return cached Dockerode client
   * @returns Dockerode client instance
   * @throws OpenCodeError if Docker not available
   */
  public createClient(): Docker {
    if (!this.isAvailable()) {
      throw new OpenCodeError(
        ERROR_CODES.DOCKER_CONNECTION_FAILED,
        'Docker is not available. Ensure Docker is running or set DOCKER_SOCKET environment variable.'
      );
    }

    if (!this.client) {
      const socketPath = this.detectSocket();
      this.client = new Docker({ socketPath });
      logger.info('Docker client created', { socketPath });
    }

    return this.client;
  }
}

// Export singleton instance
export const dockerHelper = DockerHelper.getInstance();
