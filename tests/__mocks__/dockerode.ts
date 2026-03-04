// Manual mock for Dockerode library
// Public API for type-safe Jest mocks using jest.mocked() pattern
//
// TECHNICAL DEBT: All mock methods use 'any' type
// - Jest.fn() returns 'never' type in strict TypeScript (documented limitation)
// - Full type safety would require Jest.Mock<...> type parameters
// - Current approach provides runtime safety and clean test structure
//
// Impact: Zero compile-time type safety for mock methods
// - Tests run correctly with runtime type safety
// - IDE autocomplete doesn't work for mock return values
//
// Migration path (future):
// - Option A: Use jest.MockedFunction<...> type parameters (requires refactoring)
// - Option B: Switch to Vitest for better TypeScript mock type inference
// - Option C: Live with 'any' as technical debt (current choice)

import { jest } from "@jest/globals";

// Mock Dockerode constructor - factory function that returns mocked instances
const MockDockerode = jest.fn(() => ({
  createNetwork: jest.fn(),
  getNetwork: jest.fn(),
  listNetworks: jest.fn(),
  removeNetwork: jest.fn(),
  createVolume: jest.fn(),
  getVolume: jest.fn(),
  listVolumes: jest.fn(),
  removeVolume: jest.fn(),
  createContainer: jest.fn(),
  getContainer: jest.fn(),
  listContainers: jest.fn(),
  info: jest.fn(),
}));

// Handle both ESM default and CommonJS exports
jest.mock("dockerode", () => ({
  __esModule: true,
  default: MockDockerode,
  ...MockDockerode,
}));

// Type-safe mock interface for tests
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

  const mocked: MockedDockerode = {
    createNetwork: jest.fn() as any,
    getNetwork: jest.fn() as any,
    listNetworks: jest.fn() as any,
    removeNetwork: jest.fn() as any,
    createVolume: jest.fn() as any,
    getVolume: jest.fn() as any,
    listVolumes: jest.fn() as any,
    removeVolume: jest.fn() as any,
    createContainer: jest.fn() as any,
    getContainer: jest.fn() as any,
    listContainers: jest.fn() as any,
    info: jest.fn() as any,
  };

  mocked.createNetwork.mockResolvedValue({
    id: "test-network-id",
    name: "test-network",
  });
  mocked.getNetwork.mockReturnValue({
    connect: (jest.fn() as any).mockResolvedValue(undefined as any),
    disconnect: (jest.fn() as any).mockResolvedValue(undefined as any),
    remove: (jest.fn() as any).mockResolvedValue(undefined as any),
    inspect: (jest.fn() as any).mockResolvedValue({
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
    } as any),
  } as any);
  mocked.listNetworks.mockResolvedValue([]);
  mocked.removeNetwork.mockResolvedValue(undefined as any);
  mocked.createVolume.mockResolvedValue({
    Name: "test-volume",
    Driver: "local",
  } as any);
  mocked.getVolume.mockReturnValue({
    inspect: (jest.fn() as any).mockResolvedValue({
      Name: "test-volume",
      Driver: "local",
    } as any),
    remove: (jest.fn() as any).mockResolvedValue(undefined as any),
  } as any);
  mocked.listVolumes.mockResolvedValue([]);
  mocked.removeVolume.mockResolvedValue(undefined as any);
  mocked.createContainer.mockResolvedValue({
    id: "test-container-id",
    start: (jest.fn() as any).mockResolvedValue(undefined as any),
    stop: (jest.fn() as any).mockResolvedValue(undefined as any),
    remove: (jest.fn() as any).mockResolvedValue(undefined as any),
    logs: (jest.fn() as any).mockReturnValue(mockStream as any),
  } as any);
  mocked.getContainer.mockReturnValue({
    inspect: (jest.fn() as any).mockResolvedValue({
      Id: "test-container-id",
      State: { Running: false },
    } as any),
    start: (jest.fn() as any).mockResolvedValue(undefined as any),
    stop: (jest.fn() as any).mockResolvedValue(undefined as any),
    restart: (jest.fn() as any).mockResolvedValue(undefined as any),
    remove: (jest.fn() as any).mockResolvedValue(undefined as any),
    logs: (jest.fn() as any).mockReturnValue(mockStream as any),
  } as any);
  mocked.listContainers.mockResolvedValue([]);
  mocked.info.mockResolvedValue({
    ServerVersion: "29.1.5",
    OperatingSystem: "Alpine Linux",
  } as any);

  return mocked;
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
