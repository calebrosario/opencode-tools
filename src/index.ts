#!/usr/bin/env node

/**
 * OpenCode Tools - Main Entry Point
 * Supports both application startup and CLI commands
 */

import { logger } from './util/logger';

// Import main application components
import './docker/docker-manager';
import './persistence/database';
import './mcp/server';

// CLI entry point check
const args = process.argv.slice(2);

// Check if running CLI commands (has subcommand argument)
if (args.length > 0 && !args[0].startsWith('-')) {
  // CLI mode - delegate to CLI
  const { program } = require('./commands/cli');
  program.parse(process.argv);
} else {
  // Application mode - start OpenCode Tools application
  startApplication();
}

async function startApplication(): Promise<void> {
  const OpenCodeTools = class {
    private static instance: any;

    private constructor() {
      this.initialize();
    }

    public static getInstance(): any {
      if (!OpenCodeTools.instance) {
        OpenCodeTools.instance = new (OpenCodeTools as any)();
      }
      return OpenCodeTools.instance;
    }

    private async initialize(): Promise<void> {
      try {
        logger.info('🚀 Starting OpenCode Tools...', {
          version: '0.1.0',
          nodeVersion: process.version,
          platform: process.platform,
        });

        logger.info('Components initialized');
        logger.info('✅ OpenCode Tools started successfully');

      } catch (error: unknown) {
        logger.error('❌ Failed to start OpenCode Tools', {
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      }
    }

    public async shutdown(): Promise<void> {
      logger.info('🛑 Shutting down OpenCode Tools...');
      logger.info('✅ OpenCode Tools shut down successfully');
    }
  };

  const app = OpenCodeTools.getInstance();

  // Handle process signals
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, initiating graceful shutdown...');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, initiating graceful shutdown...');
    await app.shutdown();
    process.exit(0);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error.stack
    });
    process.exit(1);
  });
}
