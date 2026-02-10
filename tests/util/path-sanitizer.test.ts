// Path Sanitization Tests - Phase 2: Edge Cases
// Week 15, Day 4: Testing & Validation

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  validatePath,
  sanitizePath,
  containsReservedName,
  isPathTraversal,
  PathValidationResult,
} from "../../../src/util/path-sanitizer";
import * as fs from "fs/promises";
import * as path from "path";

describe("Path Sanitizer (Edge Case 7)", () => {
  describe("Path Validation", () => {
    it("should validate clean paths", () => {
      const cleanPath = "/tmp/workspace/task-123";
      const result = validatePath(cleanPath);

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(cleanPath);
    });

    it("should reject path traversal attempts", () => {
      const traversalPaths = [
        "../../../etc/passwd", // Parent directory traversal
        "../../workspace/../../etc/passwd", // Multiple parent directory
        "~/.ssh/authorized_keys", // Home directory traversal
        "/var/www/html/index.php", // Absolute path bypass attempt
        "....//etc/passwd", // Encoded traversal
        "%2e%2e%2e%2e%2f%2e%2f/", // Encoded null byte
      ];

      traversalPaths.forEach((traversalPath) => {
        const result = validatePath(traversalPath);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Path traversal detected");
      });
    });

    it("should reject paths with reserved names on Windows", () => {
      const platform = process.platform;

      // Skip on non-Windows platforms
      if (platform !== "win32") {
        return;
      }

      const windowsReserved = ["CON", "PRN", "AUX", "NUL", "COM1"];
      windowsReserved.forEach((reserved) => {
        const reservedPath = `C:/reserved/${reserved}`;
        const result = validatePath(reservedPath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Path contains reserved name");
      });
    });

    it("should reject paths with reserved names on Unix", () => {
      const platform = process.platform;

      // Skip on Windows
      if (platform === "win32") {
        return;
      }

      const unixReserved = ["/dev", "/proc", "/sys", "/root", "/etc"];
      unixReserved.forEach((reserved) => {
        const reservedPath = `/reserved/${reserved}`;
        const result = validatePath(reservedPath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Path contains reserved name");
      });
    });

    it("should reject paths exceeding max length", () => {
      const longPath = "a".repeat(5000);
      const result = validatePath(longPath, { maxPathLength: 100 });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds max length");
    });

    it("should reject paths with invalid characters", () => {
      const invalidCharsPath = "/path/to/invalid@#%*.txt";
      const result = validatePath(invalidCharsPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Path contains invalid characters");
    });

    it("should reject paths matching reject patterns", () => {
      const rejectPatterns = [
        "/workspace/../../etc/passwd", // Parent dir escape
        "....//etc/passwd", // Multiple parent escape
      ];

      rejectPatterns.forEach((rejectPattern) => {
        const result = validatePath(rejectPattern);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Path matches reject pattern");
      });
    });
  });

  describe("Path Sanitization", () => {
    it("should normalize path separators", () => {
      const mixedPath = "/tmp/workspace\\subdir/file.txt";
      const sanitized = sanitizePath(mixedPath);

      expect(sanitized).toBe("/tmp/workspace/subdir/file.txt");
    });

    it("should remove redundant parent directory references", () => {
      const redundantPath = "/tmp/workspace/../task/data/file.txt";
      const sanitized = sanitizePath(redundantPath);

      expect(sanitized).toBe("/tmp/task-data/file.txt");
    });

    it("should handle special characters in paths", () => {
      const specialPath = "/tmp/workspace/@special/data/file.txt";
      const sanitized = sanitizePath(specialPath);

      expect(sanitized).toBe("/tmp/workspace/@special/data/file.txt");
    });

    it("should enforce max path length", () => {
      const longPath = "/tmp/workspace/".repeat(50);
      const sanitized = sanitizePath(longPath, { maxPathLength: 50 });

      expect(sanitized).toBe("/tmp/workspace/".repeat(50));
    });
  });

  describe("Security Checks", () => {
    it("should reject absolute paths when not allowed", () => {
      const absolutePath = "/absolute/path/to/file.txt";
      const result = validatePath(absolutePath, { allowAbsolutePaths: false });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Absolute paths not allowed");
    });

    it("should handle encoded null bytes", () => {
      const encodedPath = "/path/\0\0file.txt";
      const result = validatePath(encodedPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Encoded null byte detected");
    });

    it("should handle encoded slash", () => {
      const encodedPath = "/path/%2e%2f%2e%2f/";
      const result = validatePath(encodedPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Encoded slash detected");
    });

    it("should handle encoded backslash", () => {
      const encodedPath = "/path/%252f%252f/";
      const result = validatePath(encodedPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Encoded backslash detected");
    });
  });

  describe("Utility Functions", () => {
    it("getTaskWorkspacePath should generate valid paths", () => {
      const taskId = "test-task-abc-123";
      const workspacePath = validatePath.getTaskWorkspacePath(taskId);

      expect(workspacePath.valid).toBe(true);
      expect(workspacePath.sanitized).toContain(taskId);
    });

    it("normalizePath should handle cross-platform paths", () => {
      if (process.platform === "win32") {
        const winPath = "C:\\Users\\user\\workspace\\file.txt";
        const normalized = validatePath.normalizePath(winPath);

        expect(normalized).toBe("C:\\Users\\user\\workspace\\file.txt");
      }

      if (process.platform === "linux" || process.platform === "darwin") {
        const unixPath = "/home/user/workspace/file.txt";
        const normalized = validatePath.normalizePath(unixPath);

        expect(normalized).toBe("/home/user/workspace/file.txt");
      }
    });

    it("safeResolvePath should resolve within workspace", () => {
      const basePath = "/tmp/workspace";
      const relativePath = "../etc/passwd";

      const resolved = validatePath.safeResolvePath(basePath, relativePath);

      expect(resolved.valid).toBe(true);
    });
  });
});
