import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { taskRegistry } from "../../src/task-registry/registry";
import { DatabaseManager } from "../../src/persistence/database";
import * as schema from "../../src/persistence/schema";
import type { TaskSelect, TaskInsert } from "../../src/persistence/schema";

describe("Drizzle Type Safety Tests", () => {
  beforeEach(async () => {
    await DatabaseManager.getInstance().initialize();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe("rowToTask() Conversion", () => {
    test("should correctly map database status to TaskStatus enum", async () => {
      const task = await taskRegistry.create({
        id: "type-test-1",
        name: "Type Test",
        status: "running" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(task.status).toBe("running");
      expect(task.status).toMatch(
        /^(pending|running|completed|failed|cancelled)$/,
      );
    });

    test("should handle metadata JSONB conversion", async () => {
      const metadata = {
        key1: "value1",
        key2: 42,
        nested: {
          array: [1, 2, 3],
        },
      };

      const task = await taskRegistry.create({
        id: "metadata-test-1",
        name: "Metadata Test",
        status: "pending" as any,
        metadata: metadata as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(task.metadata).toEqual(metadata);
      expect(typeof task.metadata).toBe("object");
    });

    test("should convert PostgreSQL timestamp to Date object", async () => {
      const now = new Date();
      const task = await taskRegistry.create({
        id: "date-test-1",
        name: "Date Test",
        status: "pending" as any,
        createdAt: now,
        updatedAt: now,
      });

      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);

      const retrieved = await taskRegistry.getById("date-test-1");
      expect(retrieved?.createdAt).toEqual(now);
    });
  });

  describe("Database Schema Constraints", () => {
    test("pgEnum constraint enforces valid status values", async () => {
      await expect(
        taskRegistry.create({
          id: "enum-test-1",
          name: "Enum Test",
          status: "invalid-status" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).rejects.toThrow();
    });

    test("NOT NULL constraint enforced for required fields", async () => {
      await expect(
        taskRegistry.create({
          id: "not-null-test-1",
          name: null as any,
          status: "pending" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).rejects.toThrow();
    });

    test("can insert task with valid optional fields", async () => {
      const task = await taskRegistry.create({
        id: "optional-test-1",
        name: "Optional Test",
        status: "pending" as any,
        owner: null as any,
        metadata: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(task.name).toBe("Optional Test");
      expect(task.owner).toBeNull();
      expect(task.metadata).toBeNull();
    });
  });

  describe("Drizzle Query Result Handling", () => {
    test("getById returns null for non-existent task", async () => {
      const task = await taskRegistry.getById("non-existent-test");

      expect(task).toBeNull();
    });

    test("list returns array of tasks", async () => {
      const tasks = await taskRegistry.list();

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThanOrEqual(0);

      if (tasks.length > 0) {
        const firstTask = tasks[0];
        expect(firstTask).toHaveProperty("id");
        expect(firstTask).toHaveProperty("name");
        expect(firstTask).toHaveProperty("status");
      }
    });

    test("count returns number", async () => {
      const count = await taskRegistry.count();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
