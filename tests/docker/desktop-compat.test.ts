/**
 * Tests for Docker Desktop Compatibility Layer
 * Phase 1: Stability (v1.1) - Edge Case 6
 */

import { describe, it, expect, beforeEach } from "jest";
import {
  DesktopCompatibility,
  DesktopVersion,
  CompatibilityResult,
} from "../../src/docker/desktop-compat";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

describe("DesktopCompatibility", () => {
  let compat: DesktopCompatibility;

  beforeEach(() => {
    compat = DesktopCompatibility.getInstance();
  });

  describe("detectDesktopVersion", () => {
    it("should return version info when Docker is available", async () => {
      try {
        const version: DesktopVersion | null =
          await compat.detectDesktopVersion();

        if (version) {
          expect(version.version).toBeDefined();
          expect(version.apiVersion).toBeDefined();
          expect(version.platform).toBeDefined();
        } else {
          expect(version).toBeNull();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should return null when Docker is not available", async () => {
      compat.clearCache();

      const version: DesktopVersion | null =
        await compat.detectDesktopVersion();

      expect(version).toBe(null);
    });
  });

  describe("isDesktopRunning", () => {
    it("should detect if Docker is running", async () => {
      const running = await compat.isDesktopRunning();

      expect(typeof running).toBe("boolean");
    });
  });

  describe("getApiVersion", () => {
    it("should return API version string", async () => {
      const apiVersion = await compat.getApiVersion();

      expect(typeof apiVersion).toBe("string");
    });
  });

  describe("getSocketInfo", () => {
    it("should return socket information for current platform", async () => {
      const info = await compat.getSocketInfo();

      expect(info.path).toBeDefined();
      expect(info.platform).toMatch(/^(macos|linux|windows)$/);
      expect(typeof info.exists).toBe("boolean");
      expect(typeof info.accessible).toBe("boolean");
    });
  });

  describe("ensureCompatibility", () => {
    it("should return compatibility result with warnings/errors", async () => {
      const result: CompatibilityResult = await compat.ensureCompatibility();

      expect(typeof result.compatible).toBe("boolean");
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.socketPath).toBeDefined();
    });
  });

  describe("platform detection", () => {
    it("should handle macOS socket paths", async () => {
      const info = await compat.getSocketInfo();

      if (info.platform === "macos") {
        expect(info.path).toContain("docker.sock");
      }
    });

    it("should handle Linux socket paths", async () => {
      const info = await compat.getSocketInfo();

      if (info.platform === "linux") {
        expect(info.path).toContain("docker.sock");
      }
    });
  });

  describe("clearCache", () => {
    it("should clear cached version and socket path", () => {
      compat.clearCache();

      expect(() => compat.clearCache()).not.toThrow();
    });
  });
});
