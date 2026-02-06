// Manual mock for Dockerode library
// Public API for type-safe Jest mocks using jest.mocked() pattern

import { jest } from "@jest/globals";

// Mock Dockerode constructor
jest.mock("dockerode");

// Type-safe mock interface for tests
// jest.fn() returns 'never' type in strict TypeScript - documented Jest limitation
export interface MockedDockerode {
  createNetwork: any;
  getNetwork: any;
  listNetworks: any;
  removeNetwork: any;
  createVolume: any;
  getVolume: any;
  listVolumes: any;
  removeVolume: any;
  createContainer: any;
  getContainer: any;
  listContainers: any;
  info: any;
}

// Factory function for creating mocked Dockerode instances
export function createMockDockerode(): MockedDockerode {
  const mockStream = createMockStream();

  return {
    createNetwork: jest.fn().mockResolvedValue({
      id: "test-network-id",
      name: "test-network",
    }),
    getNetwork: jest.fn().mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      inspect: jest.fn().mockResolvedValue({
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
    listNetworks: jest.fn().mockResolvedValue([]),
    removeNetwork: jest.fn().mockResolvedValue(undefined),
    createVolume: jest.fn().mockResolvedValue({
      Name: "test-volume",
      Driver: "local",
    }),
    getVolume: jest.fn().mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Name: "test-volume",
        Driver: "local",
      }),
      remove: jest.fn().mockResolvedValue(undefined),
    }),
    listVolumes: jest.fn().mockResolvedValue([]),
    removeVolume: jest.fn().mockResolvedValue(undefined),
    createContainer: jest.fn().mockResolvedValue({
      id: "test-container-id",
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      logs: jest.fn().mockReturnValue(mockStream),
    }),
    getContainer: jest.fn().mockReturnValue({
      inspect: jest.fn().mockResolvedValue({
        Id: "test-container-id",
        State: { Running: false },
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      logs: jest.fn().mockReturnValue(mockStream),
    }),
    listContainers: jest.fn().mockResolvedValue([]),
    info: jest.fn().mockResolvedValue({
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
