import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSQLAdapter } from "../../src/persistence/postgresql-adapter";
import { Task, TaskStatus } from "../../src/types";

describe("PostgreSQLAdapter", () => {
  let adapter: PostgreSQLAdapter;
  const TEST_DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://localhost:5432/opencode_test";

  beforeAll(async () => {
    adapter = new PostgreSQLAdapter({
      type: "postgresql",
      connectionString: TEST_DATABASE_URL,
      pool: {
        min: 1,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
    });

    await adapter.initialize();
  });

  afterAll(async () => {
    await adapter.close();
  });

  describe("initialize", () => {
    it("should initialize successfully", async () => {
      expect(adapter).toBeDefined();
    });

    it("should pass health check", async () => {
      const isHealthy = await adapter.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe("create", () => {
    it("should create a task successfully", async () => {
      const task: Task = {
        id: "test-task-1",
        name: "Test Task 1",
        status: "pending" as TaskStatus,
        owner: "test-agent",
        metadata: { key: "value" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await adapter.create(task);

      expect(created).toBeDefined();
      expect(created.id).toBe(task.id);
      expect(created.name).toBe(task.name);
      expect(created.status).toBe(task.status);
      expect(created.owner).toBe(task.owner);
    });

    it("should throw error if adapter not initialized", async () => {
      const uninitializedAdapter = new PostgreSQLAdapter({
        type: "postgresql",
        connectionString: TEST_DATABASE_URL,
      });

      const task: Task = {
        id: "test-task-2",
        name: "Test Task 2",
        status: "pending" as TaskStatus,
        owner: "test-agent",
        metadata: { key: "value" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(uninitializedAdapter.create(task)).rejects.toThrow(
        "DATABASE_NOT_INITIALIZED",
      );
    });
  });

  describe("getById", () => {
    it("should return task by ID", async () => {
      const task: Task = {
        id: "test-task-by-id-1",
        name: "Test Task By ID 1",
        status: "pending" as TaskStatus,
        owner: "test-agent",
        metadata: { key: "value" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await adapter.create(task);

      const found = await adapter.getById(task.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(task.id);
      expect(found?.name).toBe(task.name);
    });

    it("should return null for non-existent task", async () => {
      const found = await adapter.getById("non-existent-task-id");

      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    beforeAll(async () => {
      const tasks: Task[] = [
        {
          id: "list-test-1",
          name: "List Test 1",
          status: "pending" as TaskStatus,
          owner: "agent-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "list-test-2",
          name: "List Test 2",
          status: "running" as TaskStatus,
          owner: "agent-2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await adapter.bulkCreate(tasks);
    });

    it("should return all tasks", async () => {
      const tasks = await adapter.list();

      expect(tasks).toBeInstanceOf(Array);
      expect(tasks.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter tasks by status", async () => {
      const pendingTasks = await adapter.list({
        status: "pending" as TaskStatus,
      });

      expect(pendingTasks.every((t) => t.status === "pending")).toBe(true);
    });

    it("should filter tasks by owner", async () => {
      const agent1Tasks = await adapter.list({ owner: "agent-1" });

      expect(agent1Tasks.every((t) => t.owner === "agent-1")).toBe(true);
    });

    it("should limit results", async () => {
      const limitedTasks = await adapter.list({ limit: 1 });

      expect(limitedTasks.length).toBeLessThanOrEqual(1);
    });

    it("should support offset for pagination", async () => {
      const firstPage = await adapter.list({ limit: 1, offset: 0 });
      const secondPage = await adapter.list({ limit: 1, offset: 1 });

      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(firstPage[0].id).not.toBe(secondPage[0].id);
      }
    });
  });

  describe("update", () => {
    it("should update task successfully", async () => {
      const task: Task = {
        id: "update-test-1",
        name: "Original Name",
        status: "pending" as TaskStatus,
        owner: "test-agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await adapter.create(task);

      const updated = await adapter.update(task.id, {
        name: "Updated Name",
        status: "running" as TaskStatus,
      });

      expect(updated).toBeDefined();
      expect(updated?.id).toBe(task.id);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.status).toBe("running");
    });

    it("should return null for non-existent task", async () => {
      const result = await adapter.update("non-existent-task", {
        name: "New Name",
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete task successfully", async () => {
      const task: Task = {
        id: "delete-test-1",
        name: "To Be Deleted",
        status: "pending" as TaskStatus,
        owner: "test-agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await adapter.create(task);

      const deleted = await adapter.delete(task.id);

      expect(deleted).toBe(true);

      const found = await adapter.getById(task.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent task", async () => {
      const deleted = await adapter.delete("non-existent-task-id");

      expect(deleted).toBe(false);
    });
  });

  describe("bulkCreate", () => {
    it("should create multiple tasks", async () => {
      const tasks: Task[] = [
        {
          id: "bulk-1",
          name: "Bulk Task 1",
          status: "pending" as TaskStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "bulk-2",
          name: "Bulk Task 2",
          status: "running" as TaskStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "bulk-3",
          name: "Bulk Task 3",
          status: "completed" as TaskStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const created = await adapter.bulkCreate(tasks);

      expect(created).toHaveLength(3);
      expect(created.every((t) => t.id)).toBe(true);
    });

    it("should handle empty array", async () => {
      const created = await adapter.bulkCreate([]);

      expect(created).toEqual([]);
    });
  });

  describe("count", () => {
    beforeAll(async () => {
      const tasks: Task[] = [
        {
          id: "count-test-1",
          name: "Count Test 1",
          status: "pending" as TaskStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "count-test-2",
          name: "Count Test 2",
          status: "pending" as TaskStatus,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await adapter.bulkCreate(tasks);
    });

    it("should count all tasks", async () => {
      const count = await adapter.count();

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("should count tasks by status", async () => {
      const pendingCount = await adapter.count({
        status: "pending" as TaskStatus,
      });

      expect(pendingCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("executeRaw", () => {
    it("should execute raw SQL query", async () => {
      const result = await adapter.executeRaw<{ count: string }>(
        "SELECT COUNT(*) as count FROM tasks",
      );

      expect(result).toBeDefined();
      expect(parseInt(result.count, 10)).toBeGreaterThanOrEqual(0);
    });

    it("should execute query with parameters", async () => {
      const taskId = "raw-query-test-1";
      const task: Task = {
        id: taskId,
        name: "Raw Query Test",
        status: "pending" as TaskStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await adapter.create(task);

      const result = await adapter.executeRaw<{ id: string }>(
        "SELECT id FROM tasks WHERE id = $1",
        [taskId],
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(taskId);
    });
  });

  describe("close", () => {
    it("should close connection successfully", async () => {
      const testAdapter = new PostgreSQLAdapter({
        type: "postgresql",
        connectionString: TEST_DATABASE_URL,
      });

      await testAdapter.initialize();
      await testAdapter.close();

      await expect(testAdapter.healthCheck()).rejects.toThrow();
    });
  });
});
