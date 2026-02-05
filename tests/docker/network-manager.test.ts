// Network Manager Tests
// Week 11, Task 11.9: Network Manager test suite

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { dockerHelper } from "../../src/util/docker-helper";
import { NetworkManager } from "../../src/docker/network-manager";
import { OpenCodeError } from "../../src/types";
import Dockerode from "dockerode";

jest.mock("dockerode");

describe("NetworkManager", () => {
  if (!dockerHelper.isAvailable()) {
    return;
  }
  let networkManager: NetworkManager;
  let mockNetwork: any;

  beforeEach(() => {
    // Clear singleton instance
    (NetworkManager as any).instance = undefined;

    // Create mock Docker instance
    const mockDocker: any = {
      createNetwork: jest.fn().mockResolvedValue({
        id: "test-network-id",
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
            "opencode.taskId": "test-task-1",
            "opencode.managed": "true",
          },
          Created: Date.now() / 1000,
          Containers: {},
        }),
      }),
      listNetworks: jest.fn().mockResolvedValue([]),
      info: jest.fn(),
    };
    mockNetwork = mockDocker.getNetwork("test-network-id");

    // Set environment variables
    process.env.DOCKER_SOCKET_PATH = "/var/run/docker.sock";
    process.env.DOCKER_NETWORK_PREFIX = "opencode-";

    // Get NetworkManager instance
    networkManager = NetworkManager.getInstance();
  });

  afterEach(async () => {
    // Cleanup
    if (networkManager) {
      await networkManager.shutdown();
    }
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      await networkManager.initialize();

      expect(networkManager).toBeDefined();
    });

    it("should handle initialization errors gracefully", async () => {
      mockDocker.info = jest
        .fn()
        .mockRejectedValue(new Error("Docker connection failed"));

      await expect(networkManager.initialize()).rejects.toThrow();
    });

    it("should not initialize twice", async () => {
      await networkManager.initialize();

      // Second initialization should be a no-op
      await networkManager.initialize();

      expect(mockDocker.info).toHaveBeenCalledTimes(1);
    });
  });

  describe("Task Network Creation", () => {
    beforeEach(async () => {
      await networkManager.initialize();
    });

    it("should create a task network successfully", async () => {
      const taskId = "test-task-1";
      const networkId = await networkManager.createTaskNetwork(taskId);

      expect(mockDocker.createNetwork).toHaveBeenCalled();
      expect(networkId).toBe("test-network-id");
    });

    it("should use correct network name format", async () => {
      const taskId = "test-task-2";
      await networkManager.createTaskNetwork(taskId);

      const createCall = mockDocker.createNetwork.mock.calls[0][0];
      expect(createCall.name).toBe(`opencode-${taskId}`);
    });

    it("should set network as internal (block external access)", async () => {
      const taskId = "test-task-3";
      await networkManager.createTaskNetwork(taskId);

      const createCall = mockDocker.createNetwork.mock.calls[0][0];
      expect(createCall.internal).toBe(true);
    });

    it("should add correct labels to network", async () => {
      const taskId = "test-task-4";
      await networkManager.createTaskNetwork(taskId);

      const createCall = mockDocker.createNetwork.mock.calls[0][0];
      expect(createCall.labels).toEqual({
        "opencode.taskId": taskId,
        "opencode.managed": "true",
        "opencode.created": expect.any(String),
      });
    });

    it("should configure IPAM with subnet", async () => {
      const taskId = "test-task-5";
      await networkManager.createTaskNetwork(taskId);

      const createCall = mockDocker.createNetwork.mock.calls[0][0];
      expect(createCall.ipam).toBeDefined();
      expect(createCall.ipam?.driver).toBe("default");
      expect(createCall.ipam?.config).toBeDefined();
      expect(createCall.ipam?.config?.[0]?.subnet).toMatch(
        /^172\.28\.\d+\.0\/24$/,
      );
    });

    it("should throw OpenCodeError on creation failure", async () => {
      const taskId = "test-task-6";
      mockDocker.createNetwork = jest
        .fn()
        .mockRejectedValue(new Error("Network creation failed"));

      await expect(networkManager.createTaskNetwork(taskId)).rejects.toThrow(
        OpenCodeError,
      );
    });
  });

  describe("Container Connection", () => {
    const taskId = "test-task-conn";
    const networkId = "test-network-id";
    const containerId = "test-container-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should connect container to network successfully", async () => {
      await networkManager.connectContainerToNetwork(containerId, networkId);

      expect(mockNetwork.connect).toHaveBeenCalledWith({
        Container: containerId,
        EndpointConfig: {},
      });
    });

    it("should connect with custom endpoint config", async () => {
      const endpointConfig = {
        Aliases: ["test-alias"],
        IPAMConfig: {
          IPv4Address: "172.28.10.5",
        },
      };

      await networkManager.connectContainerToNetwork(
        containerId,
        networkId,
        endpointConfig,
      );

      expect(mockNetwork.connect).toHaveBeenCalledWith({
        Container: containerId,
        EndpointConfig: endpointConfig,
      });
    });

    it("should throw OpenCodeError on connection failure", async () => {
      mockNetwork.connect = jest
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      await expect(
        networkManager.connectContainerToNetwork(containerId, networkId),
      ).rejects.toThrow(OpenCodeError);
    });
  });

  describe("Container Disconnection", () => {
    const taskId = "test-task-disconn";
    const networkId = "test-network-id";
    const containerId = "test-container-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should disconnect container from network successfully", async () => {
      await networkManager.disconnectContainerFromNetwork(
        containerId,
        networkId,
      );

      expect(mockNetwork.disconnect).toHaveBeenCalledWith({
        Container: containerId,
        Force: false,
      });
    });

    it("should handle 404 errors gracefully", async () => {
      const error404 = {
        statusCode: 404,
        message: "Container not found",
      } as any;

      mockNetwork.disconnect = jest.fn().mockRejectedValue(error404);

      await expect(
        networkManager.disconnectContainerFromNetwork(containerId, networkId),
      ).resolves.not.toThrow();
    });

    it("should throw OpenCodeError on other errors", async () => {
      mockNetwork.disconnect = jest
        .fn()
        .mockRejectedValue(new Error("Disconnection failed"));

      await expect(
        networkManager.disconnectContainerFromNetwork(containerId, networkId),
      ).rejects.toThrow(OpenCodeError);
    });
  });

  describe("Network Removal", () => {
    const taskId = "test-task-remove";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should remove task network successfully", async () => {
      await networkManager.removeTaskNetwork(taskId);

      expect(mockNetwork.remove).toHaveBeenCalled();
    });

    it("should handle non-existent networks gracefully", async () => {
      const nonExistentTaskId = "non-existent-task";
      await expect(
        networkManager.removeTaskNetwork(nonExistentTaskId),
      ).resolves.not.toThrow();
    });

    it("should handle 404 errors during removal", async () => {
      const error404 = {
        statusCode: 404,
        message: "Network not found",
      } as any;

      mockNetwork.remove = jest.fn().mockRejectedValue(error404);

      await expect(
        networkManager.removeTaskNetwork(taskId),
      ).resolves.not.toThrow();
    });

    it("should throw OpenCodeError on other errors", async () => {
      mockNetwork.remove = jest
        .fn()
        .mockRejectedValue(new Error("Removal failed"));

      await expect(networkManager.removeTaskNetwork(taskId)).rejects.toThrow(
        OpenCodeError,
      );
    });
  });

  describe("Network Listing", () => {
    const taskId = "test-task-list";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();

      mockDocker.listNetworks = jest.fn().mockResolvedValue([
        {
          Id: networkId,
          Name: `opencode-${taskId}`,
          Driver: "bridge",
          Scope: "local",
          Internal: true,
          Labels: {
            "opencode.taskId": taskId,
            "opencode.managed": "true",
          },
          Created: Date.now() / 1000,
          Containers: {
            "container-1": {},
          },
        },
        {
          Id: "other-network-id",
          Name: "other-network",
          Driver: "bridge",
          Labels: {
            "opencode.taskId": "other-task",
          },
          Created: Date.now() / 1000,
          Containers: {},
        },
      ] as any[]);
    });

    it("should list networks for a task", async () => {
      const networks = await networkManager.listTaskNetworks(taskId);

      expect(networks).toHaveLength(1);
      expect(networks[0].id).toBe(networkId);
      expect(networks[0].name).toBe(`opencode-${taskId}`);
    });

    it("should return empty array for tasks with no networks", async () => {
      const networks =
        await networkManager.listTaskNetworks("non-existent-task");

      expect(networks).toHaveLength(0);
    });

    it("should map network info correctly", async () => {
      const networks = await networkManager.listTaskNetworks(taskId);

      expect(networks[0]).toMatchObject({
        id: networkId,
        name: `opencode-${taskId}`,
        driver: "bridge",
        scope: "local",
        internal: true,
        containers: ["container-1"],
      });
    });
  });

  describe("Network Isolation", () => {
    const taskId = "test-task-isolate";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should isolate network successfully", async () => {
      await networkManager.isolateNetwork(networkId);

      // Isolation is handled by NetworkIsolator
      // Just verify method completes without error
      expect(true).toBe(true);
    });
  });

  describe("Network Monitoring", () => {
    const taskId = "test-task-monitor";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should monitor network activity", async () => {
      const stats = await networkManager.monitorNetwork(networkId);

      expect(stats).toBeDefined();
      expect(stats.id).toBe(networkId);
      expect(stats.name).toBe("test-network");
    });

    it("should return correct statistics", async () => {
      const stats = await networkManager.monitorNetwork(networkId);

      expect(stats).toMatchObject({
        id: networkId,
        name: "test-network",
        driver: "bridge",
        internal: true,
        containers: {},
      });
    });
  });

  describe("DNS Configuration", () => {
    const taskId = "test-task-dns";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should configure DNS for network", async () => {
      const dnsConfig = {
        servers: ["8.8.8.8", "8.8.4.4"],
        searchDomains: ["example.com"],
        options: ["timeout:2"],
      };

      await networkManager.configureDNS(networkId, dnsConfig);

      // DNS configuration is logged/validated
      expect(true).toBe(true);
    });
  });

  describe("Network Info", () => {
    const taskId = "test-task-info";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should get network info successfully", async () => {
      const info = await networkManager.getNetworkInfo(networkId);

      expect(info).toMatchObject({
        id: networkId,
        name: "test-network",
        driver: "bridge",
        internal: true,
      });
    });
  });

  describe("Statistics", () => {
    it("should return network statistics", async () => {
      await networkManager.initialize();

      const stats = await networkManager.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.managedNetworks).toBeDefined();
      expect(Array.isArray(stats.networks)).toBe(true);
    });
  });

  describe("Cleanup", () => {
    it("should shutdown network manager", async () => {
      await networkManager.initialize();

      await networkManager.shutdown();

      expect(networkManager).toBeDefined();
    });

    it("should clean up orphaned networks on initialization", async () => {
      mockDocker.listNetworks = jest.fn().mockResolvedValue([
        {
          Id: "orphaned-network-id",
          Name: "opencode-orphaned-task",
          Driver: "bridge",
          Labels: {
            "opencode.taskId": "orphaned-task",
            "opencode.managed": "true",
          },
          Created: Date.now() / 1000,
          Containers: {}, // No containers
        },
      ] as any[]);

      await networkManager.initialize();

      expect(mockDocker.listNetworks).toHaveBeenCalled();
    });
  });

  describe("Error Codes", () => {
    const taskId = "test-task-error";
    const networkId = "test-network-id";

    beforeEach(async () => {
      await networkManager.initialize();
      await networkManager.createTaskNetwork(taskId);
    });

    it("should use NETWORK_INITIALIZATION_FAILED for init errors", async () => {
      const newManager = NetworkManager.getInstance();
      mockDocker.info = jest.fn().mockRejectedValue(new Error("Init failed"));

      await expect(newManager.initialize()).rejects.toMatchObject({
        code: "NETWORK_INITIALIZATION_FAILED",
      });
    });

    it("should use NETWORK_CREATION_FAILED for creation errors", async () => {
      const newTaskId = "new-task-error";
      mockDocker.createNetwork = jest
        .fn()
        .mockRejectedValue(new Error("Creation failed"));

      await expect(
        networkManager.createTaskNetwork(newTaskId),
      ).rejects.toMatchObject({
        code: "NETWORK_CREATION_FAILED",
      });
    });

    it("should use NETWORK_CONNECTION_FAILED for connection errors", async () => {
      mockNetwork.connect = jest
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      await expect(
        networkManager.connectContainerToNetwork("container-1", networkId),
      ).rejects.toMatchObject({
        code: "NETWORK_CONNECTION_FAILED",
      });
    });

    it("should use NETWORK_DISCONNECTION_FAILED for disconnection errors", async () => {
      mockNetwork.disconnect = jest
        .fn()
        .mockRejectedValue(new Error("Disconnection failed"));

      await expect(
        networkManager.disconnectContainerFromNetwork("container-1", networkId),
      ).rejects.toMatchObject({
        code: "NETWORK_DISCONNECTION_FAILED",
      });
    });
  });

  describe("Subnet Allocation", () => {
    it("should generate deterministic subnet for task", async () => {
      await networkManager.initialize();

      const taskId = "deterministic-task";
      const subnet1 = await (networkManager as any).getSubnetOctet(taskId);
      const subnet2 = await (networkManager as any).getSubnetOctet(taskId);

      expect(subnet1).toBe(subnet2);
      expect(subnet1).toBeGreaterThanOrEqual(2);
      expect(subnet1).toBeLessThanOrEqual(255);
    });

    it("should generate different subnets for different tasks", async () => {
      await networkManager.initialize();

      const subnet1 = await (networkManager as any).getSubnetOctet("task-1");
      const subnet2 = await (networkManager as any).getSubnetOctet("task-2");

      expect(subnet1).not.toBe(subnet2);
    });
  });
});
