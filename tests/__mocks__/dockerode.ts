// Manual mock for Dockerode library
// Public API for type-safe Jest mocks using jest.mocked() pattern

import { jest } from "@jest/globals";

// Mock Dockerode constructor
jest.mock("dockerode");

// Type-safe mock interface for tests
// Using jest.Mock types instead of 'any' for better type safety
// Note: This provides partial type safety matching the mock implementation
// Full API fidelity would require importing Dockerode types, which may cause circular dependencies
export interface MockedDockerode {
  createNetwork: jest.Mock<() => Promise<{ id: string; name: string }>>;
  getNetwork: jest.Mock<
    (id: string) => {
      connect: jest.Mock<() => Promise<void>>;
      disconnect: jest.Mock<() => Promise<void>>;
      remove: jest.Mock<() => Promise<void>>;
      inspect: jest.Mock<() => Promise<any>>;
    }
  >;
  listNetworks: jest.Mock<() => Promise<any[]>>;
  removeNetwork: jest.Mock<() => Promise<void>>;
  createVolume: jest.Mock<() => Promise<{ Name: string; Driver: string }>>;
  getVolume: jest.Mock<
    (id: string) => {
      inspect: jest.Mock<() => Promise<any>>;
      remove: jest.Mock<() => Promise<void>>;
    }
  >;
  listVolumes: jest.Mock<() => Promise<{ Volumes: any[]; Warnings: string[] }>>;
  removeVolume: jest.Mock<() => Promise<void>>;
  createContainer: jest.Mock<
    () => Promise<{
      id: string;
      start: jest.Mock<() => Promise<void>>;
      stop: jest.Mock<() => Promise<void>>;
      remove: jest.Mock<() => Promise<void>>;
      logs: jest.Mock<() => any>;
    }>
  >;
  getContainer: jest.Mock<
    (id: string) => {
      inspect: jest.Mock<() => Promise<any>>;
      start: jest.Mock<() => Promise<void>>;
      stop: jest.Mock<() => Promise<void>>;
      restart: jest.Mock<() => Promise<void>>;
      remove: jest.Mock<() => Promise<void>>;
      logs: jest.Mock<() => any>;
    }
  >;
  listContainers: jest.Mock<() => Promise<any[]>>;
  info: jest.Mock<
    () => Promise<{ ServerVersion: string; OperatingSystem: string }>
  >;
}

// Factory function for creating mocked Dockerode instances
export function createMockDockerode(): MockedDockerode {
  const mockStream = createMockStream();

  return {
    createNetwork: jest
      .fn<() => Promise<{ id: string; name: string }>>()
      .mockResolvedValue({
        id: "test-network-id",
        name: "test-network",
      }),
    getNetwork: jest.fn<any>().mockReturnValue({
      connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      remove: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      inspect: jest.fn<() => Promise<any>>().mockResolvedValue({
        Id: "test-network-id",
        Name: "test-network",
        Driver: "bridge",
        Scope: "local",
        Internal: true,
        Labels: {
          "opencode.taskId": "test-task",
          "opencode.managed": "true",
        },
        Created: Date.now() / 1000,
        Containers: {},
      }),
    }),
    listNetworks: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    removeNetwork: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    createVolume: jest
      .fn<() => Promise<{ Name: string; Driver: string }>>()
      .mockResolvedValue({
        Name: "test-volume",
        Driver: "local",
      }),
    getVolume: jest.fn<any>().mockReturnValue({
      inspect: jest.fn<() => Promise<any>>().mockResolvedValue({
        Name: "test-volume",
        Driver: "local",
      }),
      remove: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    }),
    listVolumes: jest
      .fn<() => Promise<{ Volumes: any[]; Warnings: string[] }>>()
      .mockResolvedValue({
        Volumes: [],
        Warnings: [],
      }),
    removeVolume: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    createContainer: jest.fn<() => Promise<any>>().mockResolvedValue({
      id: "test-container-id",
      start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      remove: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      logs: jest.fn<any>().mockReturnValue(mockStream),
    }),
    getContainer: jest.fn<any>().mockReturnValue({
      inspect: jest.fn<() => Promise<any>>().mockResolvedValue({
        Id: "test-container-id",
        State: { Running: false },
      }),
      start: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      restart: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      remove: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      logs: jest.fn<any>().mockReturnValue(mockStream),
    }),
    listContainers: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
    info: jest.fn<() => Promise<any>>().mockResolvedValue({
      ServerVersion: "29.1.5",
      OperatingSystem: "Alpine Linux",
    }),
  };
}

// Helper to create mock PassThrough streams
function createMockStream() {
  const { PassThrough } = require("stream");
  return new PassThrough();
}

// Reset all Dockerode mocks between tests
export function resetDockerodeMocks(): void {
  jest.clearAllMocks();
}
