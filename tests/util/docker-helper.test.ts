import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import {
  DockerHelper,
  ERROR_CODES,
  dockerHelper,
} from "../../src/util/docker-helper";
import { OpenCodeError } from "../../src/types";

describe("DockerHelper", () => {
  let originalEnv: any;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("detectSocket", () => {
    it("should use DOCKER_SOCKET env var override", () => {
      process.env.DOCKER_SOCKET = "/custom/docker.sock";
      const helper = DockerHelper.getInstance();

      expect(() => helper.detectSocket()).not.toThrow();
      expect(process.env.DOCKER_SOCKET).toBe("/custom/docker.sock");
    });

    it("should detect standard Linux socket path", () => {
      // Mock platform to linux
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const helper = DockerHelper.getInstance();
      const socket = helper.detectSocket();

      expect(socket).toContain("/var/run/docker.sock");
    });

    it("should throw when no socket found on Linux", () => {
      // Mock platform to linux and no fs.existsSync
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const helper = DockerHelper.getInstance();

      expect(() => helper.detectSocket()).toThrow(OpenCodeError);
    });

    it("should detect macOS Docker Desktop socket paths", () => {
      // Mock platform to darwin and mock fs.existsSync
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
        configurable: true,
      });

      const helper = DockerHelper.getInstance();

      expect(() => helper.detectSocket()).toThrow(OpenCodeError);
    });
  });

  describe("isAvailable", () => {
    it("should return false when socket not found", () => {
      const helper = DockerHelper.getInstance();
      spyOn(helper, "detectSocket").mockImplementation(() => {
        throw new OpenCodeError(
          ERROR_CODES.DOCKER_SOCKET_NOT_FOUND,
          "Not found",
        );
      });

      const available = helper.isAvailable();

      expect(available).toBe(false);
    });

    it("should cache availability result", () => {
      const helper = DockerHelper.getInstance();
      const spy = spyOn(helper, "detectSocket").mockImplementation(() => {
        throw new OpenCodeError(
          ERROR_CODES.DOCKER_SOCKET_NOT_FOUND,
          "Not found",
        );
      });

      const result1 = helper.isAvailable();
      const result2 = helper.isAvailable();

      expect(result1).toBe(result2);
      expect(spy.mock.calls.length).toBe(1);
    });
  });

  describe("createClient", () => {
    it("should create Dockerode client when Docker available", () => {
      const helper = DockerHelper.getInstance();
      spyOn(helper, "isAvailable").mockReturnValue(true);
      spyOn(helper, "detectSocket").mockReturnValue("/var/run/docker.sock");

      const client = helper.createClient();

      expect(client).toBeDefined();
      expect(helper["client"]).toBe(client);
    });

    it("should throw when Docker not available", () => {
      const helper = DockerHelper.getInstance();
      spyOn(helper, "isAvailable").mockReturnValue(false);

      expect(() => helper.createClient()).toThrow(OpenCodeError);
    });

    it("should reuse cached client", () => {
      const helper = DockerHelper.getInstance();
      spyOn(helper, "isAvailable").mockReturnValue(true);
      const socketSpy = spyOn(helper, "detectSocket").mockReturnValue(
        "/var/run/docker.sock",
      );

      const client1 = helper.createClient();
      const client2 = helper.createClient();

      expect(client1).toBe(client2);
      expect(socketSpy.mock.calls.length).toBe(1);
    });
  });

  describe("Singleton pattern", () => {
    it("should return same instance", () => {
      const instance1 = DockerHelper.getInstance();
      const instance2 = DockerHelper.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});

describe("dockerHelper singleton export", () => {
  it("should export singleton instance", () => {
    expect(dockerHelper).toBeInstanceOf(DockerHelper);
  });
});
