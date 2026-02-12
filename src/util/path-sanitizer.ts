// Path Sanitizer - Phase 2: Edge Cases
// Week 15, Day 4: Workspace Path Sanitization
//
// Edge Case 7: Workspace Path Sanitization
// - Problem: Invalid/malicious paths can cause security vulnerabilities or data loss
// - Solution: Validate and sanitize paths to prevent traversal and ensure valid characters

import * as path from "path";
import { logger } from "./logger";

/**
 * Validation result
 */
export interface PathValidationResult {
  valid: boolean;
  sanitized?: string;
  original?: string;
  error?: string;
}

/**
 * Sanitization configuration
 */
export interface SanitizationConfig {
  allowAbsolutePaths?: boolean;
  maxPathLength?: number;
  allowedChars?: RegExp;
  rejectPatterns?: RegExp[];
  osSpecific?: {
    windows?: {
      driveLetters?: RegExp;
      reservedNames?: string[];
    };
    unix?: {
      reservedNames?: string[];
    };
  };
}

const DEFAULT_CONFIG: SanitizationConfig = {
  allowAbsolutePaths: false,
  maxPathLength: 4096,
  allowedChars: /^[a-zA-Z0-9._-]+$/,
  rejectPatterns: [/\.\.[^.]/, /\.git\//i],
  osSpecific: {
    windows: {
      driveLetters: /^[A-Za-z]:$/,
      reservedNames: [
        "CON",
        "PRN",
        "AUX",
        "NUL",
        "COM1-9",
        "LPT1-9",
        "COM2-9",
        "LPT2-9",
        "CLOCK$",
        "CONIN$",
        "OUT$",
      ],
    },
    unix: {
      reservedNames: [
        "/dev",
        "/proc",
        "/sys",
        "/root",
        "/home",
        "/etc",
        "tmp",
        "var",
        "run",
        "usr",
        "bin",
        "sbin",
        "opt",
        "mnt",
        "media",
        "srv",
        "boot",
        "lib",
        "lost+found",
        ".lock",
        ".git",
        ".env",
        ".vscode",
      ],
    },
  },
};

/**
 * Check if path contains reserved names
 */
export function containsReservedName(
  filePath: string,
  config: SanitizationConfig = DEFAULT_CONFIG,
): boolean {
  const basename = path.basename(filePath);

  const platform = process.platform;
  if (platform === "win32" && config.osSpecific?.windows) {
    const winConfig = config.osSpecific.windows;
    const driveLetters = winConfig.driveLetters;
    const reservedNames = winConfig.reservedNames || [];

    if (driveLetters) {
      const drive = basename.match(driveLetters)?.[0];
      if (drive && reservedNames.includes(drive.toUpperCase())) {
        return true;
      }
    }
    return reservedNames.includes(basename.toUpperCase());
  }

  if (
    (platform === "linux" || platform === "darwin" || platform === "freebsd") &&
    config.osSpecific?.unix
  ) {
    const reservedNames = config.osSpecific.unix.reservedNames || [];
    return reservedNames.includes(basename);
  }

  return false;
}

/**
 * Detect path traversal attempts
 */
export function isPathTraversal(filePath: string): boolean {
  // Check for common path traversal patterns
  // Normalize path separators to forward slashes
  const normalized = filePath.replace(/\\+/g, "/");

  const traversalPatterns = [
    /\.\.\//, // Relative parent directory
    /\.\.\.\./, // Multiple parent directories
    /~\.\.\.\./, // User home traversal
    /\/\.\.\.\//, // Root directory traversal
    /%2e%2e%2f%2e%2e%2e%2f/, // Encoded null byte
    /%2e%2e%2f%2e%2e%2f/, // Encoded slash
    /%252e%252f%252f/, // Encoded backslash
  ];

  return traversalPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Sanitize path string
 */
export function sanitizePath(
  filePath: string,
  config: SanitizationConfig = DEFAULT_CONFIG,
): string {
  let sanitized = filePath.trim();

  const platform = process.platform;
  if (platform === "win32" && config.osSpecific?.windows) {
    const winConfig = config.osSpecific.windows;
    const allowedChars = winConfig.driveLetters;
    const reservedNames = winConfig.reservedNames || [];

    if (allowedChars) {
      const driveLetter = sanitized.match(allowedChars)?.[0];
      if (driveLetter) {
        const charSource = config.allowedChars?.source || "a-zA-Z0-9._-";
        sanitized =
          driveLetter +
          sanitized.slice(1).replace(new RegExp(`[^${charSource}]`, "g"), "");
      }
    }

    const normalized = path.normalize(sanitized);
    const parts = normalized.split(path.sep);
    const filteredParts = parts.filter(
      (part) => !reservedNames.includes(part.toUpperCase()) && part !== "",
    );

    sanitized = filteredParts.join(path.sep);
  }

  if (config.maxPathLength && sanitized.length > config.maxPathLength) {
    sanitized = sanitized.substring(0, config.maxPathLength);
    logger.warn("Path truncated to max length", {
      original: filePath,
      max: config.maxPathLength,
      truncated: sanitized,
    });
  }

  return sanitized;
}

/**
 * Validate path against security constraints
 */
export function validatePath(
  filePath: string,
  config: SanitizationConfig = DEFAULT_CONFIG,
): PathValidationResult {
  const result: PathValidationResult = {
    valid: false,
    sanitized: undefined,
    original: filePath,
    error: undefined,
  };

  try {
    // Check for empty path
    if (!filePath || filePath.trim().length === 0) {
      result.error = "Path is empty";
      return result;
    }

    // Check for path traversal
    if (isPathTraversal(filePath)) {
      result.error = "Path traversal detected";
      return result;
    }

    // Check for reserved names
    if (containsReservedName(filePath, config)) {
      result.error = "Path contains reserved name";
      return result;
    }

    // Check absolute path restrictions
    if (!config.allowAbsolutePaths && path.isAbsolute(filePath)) {
      result.error = "Absolute paths not allowed";
      return result;
    }

    // Check path length
    if (config.maxPathLength && filePath.length > config.maxPathLength) {
      result.error = `Path exceeds max length of ${config.maxPathLength} characters`;
      return result;
    }

    // Check for invalid characters
    if (config.allowedChars && !config.allowedChars.test(filePath)) {
      result.error = "Path contains invalid characters";
      return result;
    }

    // Check for reject patterns
    for (const pattern of config.rejectPatterns || []) {
      if (pattern.test(filePath)) {
        result.error = "Path matches reject pattern";
        return result;
      }
    }

    // All checks passed
    result.valid = true;
    return result;
  } catch (error: any) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error("Path validation failed", {
      path: filePath,
      error: result.error,
    });
    return result;
  }
}

/**
 * Get task workspace path
 * Combines base path with task ID
 */
export function getTaskWorkspacePath(
  taskId: string,
  basePath?: string,
): string {
  const workspaceBase =
    basePath || process.env.OPENCODE_WORKSPACE || "/tmp/opencode-worktrees";
  return path.join(workspaceBase, taskId);
}

/**
 * Normalize path for cross-platform compatibility
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath.replace(/\\/g, "/"));
}

/**
 * Resolve path safely (resolves symlinks and parent directory references)
 */
export function safeResolvePath(
  basePath: string,
  relativePath: string,
): string {
  const resolved = path.resolve(basePath, relativePath);
  const normalized = normalizePath(resolved);

  // Ensure resolved path is within allowed scope
  const workspaceBase =
    process.env.OPENCODE_WORKSPACE || "/tmp/opencode-worktrees";
  if (
    !path.normalize(normalized).startsWith(workspaceBase) &&
    !path.isAbsolute(relativePath)
  ) {
    logger.warn("Resolved path outside workspace", {
      basePath,
      relativePath,
      resolved: normalized,
    });
  }

  return normalized;
}

/**
 * Check if path is within task workspace
 */
export function isInTaskWorkspace(filePath: string, taskId: string): boolean {
  const workspaceBase =
    process.env.OPENCODE_WORKSPACE || "/tmp/opencode-worktrees";
  const taskWorkspace = path.join(workspaceBase, taskId);
  const resolved = path.resolve(filePath);

  return resolved.startsWith(taskWorkspace);
}
