// @ts-nocheck
// Docker Manager Tests - MVP Core
// Updated for Bun test compatibility

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { PassThrough } from "stream";

// Helper to create Docker stream format
function createDockerHeader(streamType: number, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt8(streamType, 0);
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}

// Mock functions store - accessible in tests
const mockFns = {
  createNetwork: mock(() => Promise.resolve({ id: "net-id", name: "test" })),
  getNetwork: mock(() => ({
    connect: mock(() => Promise.resolve(undefined)),
    disconnect: mock(() => Promise.resolve(undefined)),
    remove: mock(() => Promise.resolve(undefined)),
    inspect: mock(() =>
      Promise.resolve({ Id: "net-id", Name: "test", Internal: true }),
    ),
  })),
  listNetworks: mock(() => Promise.resolve([])),
  removeNetwork: mock(() => Promise.resolve(undefined)),
  createVolume: mock(() => Promise.resolve({ Name: "vol", Driver: "local" })),
  getVolume: mock(() => ({
    inspect: mock(() => Promise.resolve({ Name: "vol", Driver: "local" })),
    remove: mock(() => Promise.resolve(undefined)),
  })),
  listVolumes: mock(() => Promise.resolve([])),
  removeVolume: mock(() => Promise.resolve(undefined)),
  createContainer: mock(() => Promise.resolve({ id: "test-container-id" })),
  getContainer: mock(() => ({
    id: "test-container-id",
    inspect: mock(() =>
      Promise.resolve({
        Id: "test-container-id",
        State: { Running: true, Status: "running" },
        Name: "/test-container",
        Config: { Hostname: "test", WorkingDir: "/app" },
        NetworkSettings: { Networks: {} },
      }),
    ),
    start: mock(() => Promise.resolve(undefined)),
    stop: mock(() => Promise.resolve(undefined)),
    restart: mock(() => Promise.resolve(undefined)),
    remove: mock(() => Promise.resolve(undefined)),
    pause: mock(() => Promise.resolve(undefined)),
    unpause: mock(() => Promise.resolve(undefined)),
    kill: mock(() => Promise.resolve(undefined)),
    logs: mock(() => new PassThrough()),
    exec: mock(() =>
      Promise.resolve({
        start: mock((_opts: any, callback: any) => {
          const stream = new PassThrough();
          setTimeout(() => {
            stream.end();
            callback(null, stream);
          }, 0);
        }),
        inspect: mock(() => Promise.resolve({ ExitCode: 0 })),
      }),
    ),
    stats: mock(() =>
      Promise.resolve({
        cpu_stats: {
          cpu_usage: { total_usage: 1000000 },
          system_cpu_usage: 10000000,
          online_cpus: 1,
        },
        precpu_stats: { cpu_usage: { total_usage: 0 }, system_cpu_usage: 0 },
        memory_stats: {
          usage: 1000000,
          limit: 10000000,
          stats: { cache: 100000 },
        },
        pids_stats: { current: 5 },
        networks: {},
      }),
    ),
  })),
  listContainers: mock(() => Promise.resolve([])),
  info: mock(() =>
    Promise.resolve({
      ServerVersion: "29.1.5",
      APIVersion: "1.45",
      OperatingSystem: "Alpine Linux",
      Containers: 5,
      Images: 10,
      Architecture: "x86_64",
    }),
  ),
  pull: mock((_image: string, callback: any) => {
    const stream = new PassThrough();
    callback(null, stream);
    stream.write(Buffer.from('{"status":"pulling"}'));
    stream.write(Buffer.from('{"digest":"sha256:abc"}'));
    stream.end();
  }),
  getImage: mock(() => ({
    inspect: mock(() => Promise.resolve({ Id: "sha256:img", Size: 100 })),
  })),
  pruneContainers: mock(() =>
    Promise.resolve({
      ContainersDeleted: ["container-1"],
      SpaceReclaimed: 1000000,
    }),
  ),
  modem: {
    demuxStream: mock((stream: any, stdout: any, stderr: any) => {
      stream.on("data", (chunk: Buffer) => {
        if (chunk.length < 8) return;
        const type = chunk.readUInt8(0);
        const size = chunk.readUInt32BE(4);
        const data = chunk.slice(8, 8 + size);
        if (type === 1) stdout.write(data);
        else if (type === 2) stderr.write(data);
      });
    }),
  },
};

// Mock Dockerode BEFORE importing DockerManager
mock.module("dockerode", () => {
  return {
    default: class MockDockerode {
      createNetwork = mockFns.createNetwork;
      getNetwork = mockFns.getNetwork;
      listNetworks = mockFns.listNetworks;
      removeNetwork = mockFns.removeNetwork;
      createVolume = mockFns.createVolume;
      getVolume = mockFns.getVolume;
      listVolumes = mockFns.listVolumes;
      removeVolume = mockFns.removeVolume;
      createContainer = mockFns.createContainer;
      getContainer = mockFns.getContainer;
      listContainers = mockFns.listContainers;
      info = mockFns.info;
      pull = mockFns.pull;
      getImage = mockFns.getImage;
      pruneContainers = mockFns.pruneContainers;
      modem = mockFns.modem;
    },
  };
});

// Import AFTER mock
import { DockerManager } from "../../src/docker/manager";
import { OpenCodeError } from "../../src/types";

describe("DockerManager", () => {
  let dockerManager: DockerManager;
  let mockDockerode: any;

  beforeEach(() => {
    // Reset singleton
    (DockerManager as any).instance = null;
    dockerManager = DockerManager.getInstance();
    mockDockerode = (dockerManager as any).docker;
    (dockerManager as any).initialized = true;
  });

  afterEach(() => {
    // Note: Don't use mock.restore() as it would restore the module mock
    // Instead, tests should override mock implementations as needed
  });

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      (DockerManager as any).instance = null;
      const instance1 = DockerManager.getInstance();
      const instance2 = DockerManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("execInContainer", () => {
    it("should execute command and return exitCode 0", async () => {
      const mockContainer = {
        inspect: mock(() =>
          Promise.resolve({
            Id: "c-123",
            State: { Running: true },
          }),
        ),
        exec: mock(() =>
          Promise.resolve({
            start: mock((_opts: any, cb: any) => {
              const stream = new PassThrough();
              const header = Buffer.alloc(8);
              header.writeUInt8(1, 0);
              header.writeUInt32BE(7, 4);
              stream.write(Buffer.concat([header, Buffer.from("success")]));
              stream.end();
              cb(null, stream);
            }),
            inspect: mock(() => Promise.resolve({ ExitCode: 0 })),
          }),
        ),
      };
      mockDockerode.getContainer = mock(() => mockContainer);

      const result = await dockerManager.execInContainer("c-123", "echo hello");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("success");
    });

    it("should throw CONTAINER_NOT_RUNNING when stopped", async () => {
      const mockContainer = {
        inspect: mock(() =>
          Promise.resolve({
            Id: "c-123",
            State: { Running: false },
          }),
        ),
      };
      mockDockerode.getContainer = mock(() => mockContainer);

      await expect(
        dockerManager.execInContainer("c-123", "echo"),
      ).rejects.toMatchObject({ code: "CONTAINER_NOT_RUNNING" });
    });

    it("should handle timeout with EXEC_TIMEOUT code", async () => {
      const mockContainer = {
        inspect: mock(() =>
          Promise.resolve({
            Id: "c-123",
            State: { Running: true },
          }),
        ),
        exec: mock(() =>
          Promise.resolve({
            // start() receives (options, callback) - never call callback to simulate timeout
            start: mock((_opts: any, _cb: any) => {
              // Intentionally never call callback - simulates timeout
            }),
            inspect: mock(() => Promise.resolve({ ExitCode: 0 })),
          }),
        ),
      };
      mockDockerode.getContainer = mock(() => mockContainer);

      await expect(
        dockerManager.execInContainer("c-123", "sleep", { timeout: 100 }),
      ).rejects.toMatchObject({ code: "EXEC_TIMEOUT" });
    }, 5000);
  });

  describe("ensureImage", () => {
    it("should return existing image without pulling", async () => {
      mockDockerode.getImage = mock(() => ({
        inspect: mock(() => Promise.resolve({ Id: "sha256:abc", Size: 100 })),
      }));

      const result = await dockerManager.ensureImage("node:20", {
        pullIfMissing: false,
      });

      expect(result.status).toBe("exists");
    });

    it("should pull missing image", async () => {
      mockDockerode.getImage = mock(() => ({
        inspect: mock(() => Promise.reject(new Error("not found"))),
      }));

      const result = await dockerManager.ensureImage("alpine:latest", {
        pullIfMissing: true,
      });

      expect(result.status).toBe("pulled");
    });

    it("should throw IMAGE_NOT_FOUND when pullIfMissing is false", async () => {
      mockDockerode.getImage = mock(() => ({
        inspect: mock(() => Promise.reject(new Error("not found"))),
      }));

      await expect(
        dockerManager.ensureImage("missing:latest", { pullIfMissing: false }),
      ).rejects.toMatchObject({ code: "IMAGE_NOT_FOUND" });
    });
  });

  describe("Container Lifecycle", () => {
    it("should create container", async () => {
      mockDockerode.createContainer = mock(() =>
        Promise.resolve({ id: "new-id" }),
      );

      const containerId = await dockerManager.createContainer({
        name: "test",
        image: "node:20",
      });

      expect(containerId).toBe("new-id");
    });

    it("should start container", async () => {
      const mockContainer = { start: mock(() => Promise.resolve(undefined)) };
      mockDockerode.getContainer = mock(() => mockContainer);

      await dockerManager.startContainer("c-123");

      expect(mockContainer.start).toHaveBeenCalled();
    });

    it("should stop container", async () => {
      const mockContainer = { stop: mock(() => Promise.resolve(undefined)) };
      mockDockerode.getContainer = mock(() => mockContainer);

      await dockerManager.stopContainer("c-123", 30);

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 30 });
    });

    it("should remove container", async () => {
      const mockContainer = { remove: mock(() => Promise.resolve(undefined)) };
      mockDockerode.getContainer = mock(() => mockContainer);

      await dockerManager.removeContainer("c-123", true, true);

      expect(mockContainer.remove).toHaveBeenCalledWith({
        v: true,
        force: true,
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw DOCKER_CONNECTION_FAILED on connection failure", async () => {
      mockDockerode.info = mock(() =>
        Promise.reject(new Error("Cannot connect")),
      );
      (dockerManager as any).initialized = false;

      await expect(dockerManager.initialize()).rejects.toMatchObject({
        code: "DOCKER_CONNECTION_FAILED",
      });
    });

    it("should throw CONTAINER_CREATE_FAILED on creation failure", async () => {
      mockDockerode.createContainer = mock(() =>
        Promise.reject(new Error("failed")),
      );

      await expect(
        dockerManager.createContainer({ name: "test", image: "node:20" }),
      ).rejects.toMatchObject({ code: "CONTAINER_CREATE_FAILED" });
    });
  });
});
