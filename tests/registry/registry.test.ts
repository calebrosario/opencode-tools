// Task Registry Tests - Phase 2: MVP Core
// Week 9, Day 5: Task Registry Unit Tests

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { taskRegistry } from "../../src/task-registry/registry";
import { Task, TaskStatus } from "../../src/types";

describe("TaskRegistry", () => {
  beforeAll(async () => {
    // TaskRegistry auto-initializes on first getInstance() call
    await taskRegistry.initialize();
  });

  beforeEach(async () => {
    // Clear all tasks before each test to avoid duplicate ID errors
    const tasks = await taskRegistry.list();
    for (const task of tasks) {
      await taskRegistry.delete(task.id);
    }
  });

  afterAll(async () => {
    // Cleanup - clear all test tasks
    const tasks = await taskRegistry.list();
    for (const task of tasks) {
      await taskRegistry.delete(task.id);
    }
  });

  test("should create a valid task", async () => {
    const task: Task = {
      id: "test-task-1",
      name: "Test Task",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: "test-user",
      metadata: { description: "Test task" },
    };

    const created = await taskRegistry.create(task);
    expect(created.id).toBe(task.id);
    expect(created.name).toBe(task.name);
    expect(created.status).toBe(task.status);
  });

  test("should get task by ID", async () => {
    const task: Task = {
      id: "test-task-2",
      name: "Get Task Test",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const retrieved = await taskRegistry.getById("test-task-2");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(task.id);
  });

  test("should update a task", async () => {
    const task: Task = {
      id: "test-task-3",
      name: "Update Task Test",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const updated = await taskRegistry.update("test-task-3", {
      status: "running",
    });

    expect(updated?.status).toBe("running");
    expect(updated?.name).toBe(task.name);
  });

  test("should delete a task", async () => {
    const task: Task = {
      id: "test-task-4",
      name: "Delete Task Test",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    await taskRegistry.delete("test-task-4");

    const retrieved = await taskRegistry.getById("test-task-4");
    expect(retrieved).toBeNull();
  });

  test("should list tasks with filters", async () => {
    // Create tasks with different statuses
    await taskRegistry.create({
      id: "task-1",
      name: "Task 1",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await taskRegistry.create({
      id: "task-2",
      name: "Task 2",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await taskRegistry.create({
      id: "task-3",
      name: "Task 3",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pendingTasks = await taskRegistry.list({ status: "pending" });
    expect(pendingTasks.length).toBeGreaterThan(0);

    const allTasks = await taskRegistry.list();
    expect(allTasks.length).toBeGreaterThanOrEqual(3);
  });

  test("should get tasks by status", async () => {
    const runningTasks = await taskRegistry.list({ status: "running" });
    expect(Array.isArray(runningTasks)).toBe(true);
  });

  test("should mark task as running", async () => {
    const task: Task = {
      id: "test-task-5",
      name: "Mark Running Test",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const running = await taskRegistry.update("test-task-5", {
      status: "running",
    });

    expect(running?.status).toBe("running");
  });

  test("should mark task as completed", async () => {
    const task: Task = {
      id: "test-task-6",
      name: "Mark Completed Test",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const completed = await taskRegistry.update("test-task-6", {
      status: "completed",
    });

    expect(completed?.status).toBe("completed");
  });

  test("should mark task as failed", async () => {
    const task: Task = {
      id: "test-task-7",
      name: "Mark Failed Test",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const failed = await taskRegistry.update("test-task-7", {
      status: "failed",
      metadata: { error: "Test error" },
    });

    expect(failed?.status).toBe("failed");
    expect(failed?.metadata?.error).toBe("Test error");
  });

  test("should bulk insert tasks", async () => {
    const tasks: Task[] = Array.from({ length: 10 }, (_, i) => ({
      id: `bulk-task-${i}`,
      name: `Bulk Task ${i}`,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const inserted = await taskRegistry.bulkCreate(tasks);
    expect(inserted.length).toBe(10);
  });

  // Skip test due to transient database connection issue with concurrent operations
  test("should handle concurrent operations", async () => {
    await taskRegistry.initialize();
    const task = await taskRegistry.create({
      id: "test-task-4",
      name: "Concurrent Test",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: "test-user",
    });

    // Try to read task multiple times concurrently
    const promises: Promise<Task | null>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(taskRegistry.getById("test-task-4"));
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    expect(results.every((r) => r !== null && r.id === "test-task-4")).toBe(
      true,
    );
  });

  // Try to read the task multiple times concurrently
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(taskRegistry.getById("test-task-4"));
  }

  const results = await Promise.all(promises);
  expect(results.length).toBe(10);
  expect(results.every((r) => r !== null && r.id === "test-task-4")).toBe(true);
});

afterAll(async () => {
  // Cleanup test tasks
  try {
    await taskRegistry.delete("test-task-4");
  } catch {
    // Ignore cleanup errors
  }
});
