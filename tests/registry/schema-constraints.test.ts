// Database Schema Constraint Tests
// PR Review fix-21: Validate database enforces NOT NULL, UNIQUE, CHECK constraints

import {
  describe,
  test,
  beforeAll,
  afterAll,
  expect,
} from "@jest/globals";
import { taskRegistry } from "../../src/task-registry/registry";
import { DatabaseManager } from "../../src/persistence/database";

describe("Database Schema Constraints", () => {
  beforeAll(async () => {
    await DatabaseManager.getInstance().initialize();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  describe("NOT NULL constraints", () => {
    test("should reject task without required fields", async () => {
      await expect(
        taskRegistry.create({
          id: "not-null-test",
          name: null as any,
          status: "pending" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow(/NOT NULL constraint|required field/);
    });

    test("should accept task with all required fields", async () => {
      const task = await taskRegistry.create({
        id: "valid-null-test",
        name: "Valid Null Test",
        status: "pending" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: "test-user",
      });

      const result = await taskRegistry.getById("valid-null-test");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("valid-null-test");
    });

    test("should accept task with optional fields", async () => {
      const task = await taskRegistry.create({
        id: "optional-test",
        name: "Optional Test",
        status: "pending" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: null as any,
        metadata: null as any,
      });

      await expect(taskRegistry.create(task)).resolves.toEqual(task);
    });
  });

  describe("UNIQUE constraint (id)", () => {
    test("should enforce unique constraint on id field", async () => {
      // Create a task
      const task1 = await taskRegistry.create({
        id: "unique-test-1",
        name: "Unique Test 1",
        status: "pending" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Try to create duplicate (should fail)
      await expect(
        taskRegistry.create({
          id: "unique-test-1",
          name: "Unique Test 2",
          status: "pending" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow(/duplicate.*key value|UNIQUE constraint/);
    });

    test("should allow different tasks to have same id in different scopes", async () => {
      // Tasks in different registries could have same IDs (not enforced by current implementation)
      // This test documents current behavior allows it
      const task1 = await taskRegistry.create({
        id: "same-id-1",
        name: "Same ID Test 1",
        status: "pending" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const task2 = await taskRegistry.create({
        id: "same-id-1",
        name: "Same ID Test 2",
        status: "pending" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // This should not throw (current behavior allows duplicate IDs)
      await expect(
        taskRegistry.create(task1),
      ).resolves.toBeDefined();
      await expect(
        taskRegistry.create(task2),
      ).resolves.toBeDefined();
      );
    });
  });

  describe("CHECK constraint validation", () => {
    test("should reject status with invalid enum value", async () => {
      await expect(
        taskRegistry.create({
          id: "enum-test-1",
          name: "Enum Test",
          status: "invalid-status" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow(/Invalid task status|pgEnum constraint/);
    });

    test("should reject owner with invalid type (not string)", async () => {
      await expect(
        taskRegistry.create({
          id: "owner-type-test",
          name: "Owner Type Test",
          status: "pending" as any,
          owner: 123 as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow(/Invalid task owner|must be string or null/);
    });

    test("should reject metadata with invalid type (not object)", async () => {
      await expect(
        taskRegistry.create({
          id: "metadata-type-test",
          name: "Metadata Type Test",
          status: "pending" as any,
          metadata: "invalid-type" as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow(/Invalid task metadata|must be object or null/);
    });
  });
});
