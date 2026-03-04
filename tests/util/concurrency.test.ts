import { describe, it, expect, beforeEach } from "@jest/globals";
import { OptimisticLock } from "../../src/util/optimistic-lock";
import { LockManager } from "../../src/util/lock-manager";
import { LockMode } from "../../src/types";

describe("Concurrency System", () => {
  let lock: OptimisticLock;
  let lockManager: LockManager;

  beforeEach(() => {
    lock = OptimisticLock.getInstance();
    lockManager = LockManager.getInstance();
    // Clear all locks between tests
    lock["locks"].clear();
    lockManager.stopCleanup();
  });

  describe("OptimisticLock", () => {
    it("should acquire exclusive lock successfully", async () => {
      const lockInfo = await lock.acquireLock(
        "resource1",
        "user1",
        "exclusive",
      );

      expect(lockInfo.resource).toBe("resource1");
      expect(lockInfo.owner).toBe("user1");
      expect(lockInfo.version).toBe(1);
    });

    it("should prevent exclusive lock conflicts", async () => {
      await lock.acquireLock("resource1", "user1", "exclusive");

      await expect(
        lock.acquireLock("resource1", "user2", "exclusive"),
      ).rejects.toThrow("Resource 'resource1' is already locked");
    });

    it("should allow same owner to re-acquire lock", async () => {
      const lock1 = await lock.acquireLock("resource1", "user1", "exclusive");
      const lock2 = await lock.acquireLock("resource1", "user1", "exclusive");

      expect(lock2.version).toBe(2);
      expect(lock2.owner).toBe("user1");
    });

    it("should handle collaborative mode", async () => {
      await lock.acquireLock("resource1", "user1", "collaborative");

      // In collaborative mode, we allow access but may detect conflicts
      // The actual conflict detection is probabilistic in our implementation
      const lockInfo = await lock.acquireLock(
        "resource1",
        "user2",
        "collaborative",
      );
      expect(lockInfo.owner).toBe("user2");
    });

    it("should release locks correctly", async () => {
      await lock.acquireLock("resource1", "user1", "exclusive");
      const released = await lock.releaseLock("resource1", "user1");

      expect(released).toBe(true);
      expect(lock.isLocked("resource1")).toBeNull();
    });

    it("should prevent unauthorized lock release", async () => {
      await lock.acquireLock("resource1", "user1", "exclusive");

      await expect(lock.releaseLock("resource1", "user2")).rejects.toThrow(
        "Cannot release lock owned by 'user1'",
      );
    });

    it("should clean up expired locks", async () => {
      await lock.acquireLock("resource1", "user1", "exclusive", 100); // 100ms timeout

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleaned = lock.cleanupExpiredLocks();
      expect(cleaned).toBe(1);
      expect(lock.isLocked("resource1")).toBeNull();
    });
  });

  describe("LockManager", () => {
    it("should acquire lock with retry", async () => {
      const lockInfo = await lockManager.acquireLockWithRetry(
        "resource1",
        "user1",
      );
      expect(lockInfo.owner).toBe("user1");
    });

    it("should execute function with lock", async () => {
      let executed = false;

      const result = await lockManager.withLock(
        "resource1",
        "user1",
        async () => {
          executed = true;
          return "success";
        },
      );

      expect(executed).toBe(true);
      expect(result).toBe("success");
      expect(lock.isLocked("resource1")).toBeNull(); // Lock should be released
    });

    it("should release lock even if function throws", async () => {
      await expect(
        lockManager.withLock("resource1", "user1", async () => {
          throw new Error("Function failed");
        }),
      ).rejects.toThrow("Function failed");

      expect(lock.isLocked("resource1")).toBeNull(); // Lock should still be released
    });

    it("should handle batch locks", async () => {
      const acquired = await lockManager.acquireBatchLock(
        ["resource1", "resource2", "resource3"],
        "user1",
      );

      expect(acquired).toEqual(["resource1", "resource2", "resource3"]);
      expect(lock.isLocked("resource1")).not.toBeNull();
      expect(lock.isLocked("resource2")).not.toBeNull();
      expect(lock.isLocked("resource3")).not.toBeNull();
    });

    it("should rollback batch locks on failure", async () => {
      // First acquire one resource
      await lock.acquireLock("resource2", "user2", "exclusive");

      // Try to acquire batch including the locked resource
      await expect(
        lockManager.acquireBatchLock(["resource1", "resource2"], "user1"),
      ).rejects.toThrow();

      // resource1 should not be locked (rolled back)
      expect(lock.isLocked("resource1")).toBeNull();
      // resource2 should still be locked by user2
      expect(lock.isLocked("resource2")?.owner).toBe("user2");
    });

    it("should provide lock statistics", () => {
      const stats = lock.getStatistics();
      expect(stats).toHaveProperty("totalLocks");
      expect(stats).toHaveProperty("locksByOwner");
    });
  });

  describe("Integration Test", () => {
    it("should handle concurrent access patterns", async () => {
      // Simulate multiple users trying to access resources
      const promises = [
        lockManager.withLock("shared-resource", "user1", async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "user1-result";
        }),
        lockManager.withLock(
          "shared-resource",
          "user2",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return "user2-result";
          },
          "collaborative",
        ),
        lockManager.withLock("exclusive-resource", "user3", async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "user3-result";
        }),
      ];

      const results = await Promise.all(promises);
      expect(results).toContain("user1-result");
      expect(results).toContain("user2-result");
      expect(results).toContain("user3-result");
    });
  });
});
