import { logger } from "../util/logger";
import {
  DatabaseAdapter,
  createDatabaseAdapter,
} from "../persistence/database-adapter";

export interface DatabaseConfig {
  type: "postgresql" | "sqlite";
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  pool?: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  file?: string;
  readonly?: boolean;
}

const DEFAULT_POOL_CONFIG = {
  min: 1,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export function loadDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DB_TYPE ||
    process.env.DATABASE_TYPE ||
    "postgresql") as "postgresql" | "sqlite";

  if (dbType === "postgresql") {
    return loadPostgreSQLConfig();
  } else if (dbType === "sqlite") {
    return loadSQLiteConfig();
  }

  throw new Error(`Unsupported database type: ${dbType}`);
}

function loadPostgreSQLConfig(): DatabaseConfig {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      type: "postgresql",
      connectionString,
      pool: loadPoolConfig(),
    };
  }

  return {
    type: "postgresql",
    host: process.env.DB_HOST || process.env.PGHOST || "localhost",
    port: parseInt(process.env.DB_PORT || process.env.PGPORT || "5432", 10),
    database: process.env.DB_NAME || process.env.PGDATABASE || "opencode",
    username: process.env.DB_USER || process.env.PGUSER || "postgres",
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "",
    pool: loadPoolConfig(),
  };
}

function loadSQLiteConfig(): DatabaseConfig {
  const dbFile =
    process.env.DB_FILE || process.env.SQLITE_DB_FILE || "./data/opencode.db";

  return {
    type: "sqlite",
    file: dbFile,
    readonly:
      process.env.DB_READONLY === "true" ||
      process.env.SQLITE_READONLY === "true",
  };
}

function loadPoolConfig(): Required<Pick<DatabaseConfig, "pool">>["pool"] {
  return {
    min: parseInt(
      process.env.DB_POOL_MIN || DEFAULT_POOL_CONFIG.min.toString(),
      10,
    ),
    max: parseInt(
      process.env.DB_POOL_MAX || DEFAULT_POOL_CONFIG.max.toString(),
      10,
    ),
    idleTimeoutMillis: parseInt(
      process.env.DB_IDLE_TIMEOUT ||
        DEFAULT_POOL_CONFIG.idleTimeoutMillis.toString(),
      10,
    ),
    connectionTimeoutMillis: parseInt(
      process.env.DB_CONNECTION_TIMEOUT ||
        DEFAULT_POOL_CONFIG.connectionTimeoutMillis.toString(),
      10,
    ),
  };
}

export function createAdapterFromEnv(): DatabaseAdapter {
  const config = loadDatabaseConfig();

  logger.info("Creating database adapter from environment", {
    type: config.type,
    host: config.host,
    database: config.database,
    poolSize: config.pool?.max,
  });

  return createDatabaseAdapter(config);
}

export function validateDatabaseConfig(config: DatabaseConfig): boolean {
  if (!config.type || !["postgresql", "sqlite"].includes(config.type)) {
    throw new Error(
      `Invalid database type: ${config.type}. Must be 'postgresql' or 'sqlite'`,
    );
  }

  if (config.type === "postgresql") {
    if (
      !config.connectionString &&
      (!config.host || !config.port || !config.database)
    ) {
      throw new Error(
        "PostgreSQL configuration requires either connectionString or host/port/database",
      );
    }

    if (config.pool) {
      if (config.pool.min < 0 || config.pool.max < config.pool.min) {
        throw new Error(
          "Pool min must be >= 0 and pool max must be > pool min",
        );
      }
    }
  }

  if (config.type === "sqlite" && !config.file) {
    throw new Error("SQLite configuration requires file path");
  }

  return true;
}
