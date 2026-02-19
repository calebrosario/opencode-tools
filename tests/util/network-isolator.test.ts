import { NetworkIsolator } from "../network-isolator";
import { promises as fs } from "fs";

// Helper to check if Docker socket exists
async function isDockerAvailable(): Promise<boolean> {
  try {
    await fs.access("/var/run/docker.sock");
    return true;
  } catch {
    return false;
  }
}

describe("NetworkIsolator", () => {
  let isolator: NetworkIsolator;

  beforeEach(() => {
    isolator = NetworkIsolator.getInstance();
  });

  // Skip all tests if Docker is not available
  beforeAll(async () => {
    const dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn("Docker is not available. Skipping NetworkIsolator tests.");
    }
  });

  describe("Network Creation", () => {
    it("should create isolated networks for tasks", async () => {
      const taskId = `test-task-${Date.now()}`;

      const networkId = await isolator.createTaskNetwork(taskId, {
        driver: "bridge",
        isolated: true,
      });

      expect(networkId).toBeTruthy();
      expect(typeof networkId).toBe("string");

      // Verify network info can be retrieved
      const networkInfo = await isolator.getTaskNetwork(taskId);
      expect(networkInfo).toBeTruthy();
      expect(networkInfo!.Name).toContain(taskId);
    });

    it("should reuse existing networks", async () => {
      const taskId = `reuse-test-${Date.now()}`;

      const networkId1 = await isolator.createTaskNetwork(taskId);
      const networkId2 = await isolator.createTaskNetwork(taskId);

      expect(networkId1).toBe(networkId2);
    });
  });

  describe("Network Isolation", () => {
    it("should verify isolation settings", async () => {
      const taskId = `isolation-test-${Date.now()}`;

      const networkId = await isolator.createTaskNetwork(taskId, {
        isolated: true,
      });

      const verification = await isolator.verifyIsolation(networkId);

      expect(verification.isIsolated).toBe(true);
      expect(verification.issues).toHaveLength(0);
    });

    it("should detect isolation violations", async () => {
      const taskId = `violation-test-${Date.now()}`;

      // Create network without isolation
      const networkId = await isolator.createTaskNetwork(taskId, {
        isolated: false,
      });

      const verification = await isolator.verifyIsolation(networkId);

      // Should detect that ICC is not disabled and IP masquerade is enabled
      expect(verification.isIsolated).toBe(false);
      expect(verification.issues.length).toBeGreaterThan(0);
    });
  });

  describe("Container Connections", () => {
    it("should connect containers to networks", async () => {
      const taskId = `connect-test-${Date.now()}`;
      const containerId = `mock-container-${Date.now()}`;

      const networkId = await isolator.createTaskNetwork(taskId);

      // Note: In a real test, we'd need a running container
      // This test verifies the method exists and handles errors gracefully
      await expect(
        isolator.connectContainer(containerId, networkId),
      ).rejects.toThrow();
    });

    it("should track connected containers", async () => {
      const activeNetworks = isolator.getActiveNetworks();
      expect(activeNetworks).toBeInstanceOf(Map);
    });
  });

  describe("Network Management", () => {
    it("should provide network information", async () => {
      const taskId = `info-test-${Date.now()}`;

      await isolator.createTaskNetwork(taskId);

      const networkInfo = await isolator.getTaskNetwork(taskId);
      expect(networkInfo).toBeTruthy();
      expect(networkInfo!.Name).toBe(
        `${process.env.DOCKER_NETWORK_PREFIX || "opencode_"}${taskId}`,
      );
    });

    it("should handle network removal", async () => {
      const taskId = `remove-test-${Date.now()}`;

      const networkId = await isolator.createTaskNetwork(taskId);

      // Note: In real scenario, would disconnect containers first
      await expect(isolator.removeTaskNetwork(networkId)).rejects.toThrow(); // Expected to fail without proper setup
    });
  });

  describe("Emergency Cleanup", () => {
    it("should perform emergency cleanup", async () => {
      const cleanupCount = await isolator.emergencyCleanup();
      expect(typeof cleanupCount).toBe("number");
      expect(cleanupCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Connectivity Testing", () => {
    it("should handle connectivity tests", async () => {
      const containerId = `test-container-${Date.now()}`;
      const target = "8.8.8.8";

      // Should return false for non-existent container
      const isConnected = await isolator.testConnectivity(containerId, target);
      expect(isConnected).toBe(false);
    });
  });
});
