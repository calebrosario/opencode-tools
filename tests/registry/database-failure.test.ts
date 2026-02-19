// Database Connection Failure Tests - PR Review fix-12

import { describe, test, beforeAll, afterAll, expect } from "@jest/globals";
import { taskRegistry } from "../../src/task-registry/registry";
import { DatabaseManager } from "../../src/persistence/database";

describe("Database Connection Failure Tests", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("database initialization failures", () => {
    test("should throw error when DATABASE_URL is invalid", async () => {
      const originalDatabaseUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgresql://invalid:5432/db";

      const dbManager = DatabaseManager.getInstance();
      await expect(dbManager.initialize()).rejects.toThrow(
        /Failed to initialize PostgreSQL database/,
      );
    });

    test("should handle connection pool exhaustion gracefully", async () => {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.initialize();

      const createPromises = Array.from({ length: 21 }, (_, i) =>
        taskRegistry.create({
          id: `pool-exhaust-test-${i}`,
          name: `Test Task ${i}`,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      await expect(Promise.all(createPromises)).rejects.toThrow(
        /Too many connections|pool|exhausted/,
      );
    });

    test("should handle connection timeout", async () => {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.initialize();

      jest
        .spyOn(DatabaseManager.prototype as any, "getDatabase")
        .mockImplementation(() => {
          throw new Error("Connection timeout after 2000ms");
        });

      await expect(
        taskRegistry.create({
          id: "timeout-test",
          name: "Timeout Test",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).rejects.toThrow(/Connection timeout/);
    });
  });
});
