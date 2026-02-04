// Task Registry Tests - Phase 2: MVP Core
// Week 9, Day 5: Task Registry Unit Tests

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { taskRegistry } from '../../src/task-registry/registry';
import { Task, TaskStatus } from '../../src/types';

describe('TaskRegistry', () => {
  beforeAll(async () => {
    // Auto-initialization happens on first getInstance() call
    // No manual initialize() needed
  });

  beforeEach(async () => {
    // Clear database before each test to avoid duplicate ID errors
    const dbManager = await import('../../src/persistence/database').then(m => m.DatabaseManager.getInstance());
    const db = dbManager.getDatabase();
    db.exec('DELETE FROM tasks');
  });

  afterAll(async () => {
    // Cleanup
    // await taskRegistry.cleanup();
  });

  test('should create a valid task', async () => {
    const task: Task = {
      id: 'test-task-1',
      name: 'Test Task',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: 'test-user',
      metadata: { description: 'Test task' },
    };

    const created = await taskRegistry.create(task);
    expect(created.id).toBe(task.id);
    expect(created.name).toBe(task.name);
    expect(created.status).toBe(task.status);
  });

  test('should get task by ID', async () => {
    const task: Task = {
      id: 'test-task-2',
      name: 'Get Task Test',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const retrieved = await taskRegistry.getById('test-task-2');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(task.id);
  });

  test('should update a task', async () => {
    const task: Task = {
      id: 'test-task-3',
      name: 'Update Task Test',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const updated = await taskRegistry.update('test-task-3', { status: 'running' });

    expect(updated.status).toBe('running');
    expect(updated.name).toBe(task.name);
  });

  test('should delete a task', async () => {
    const task: Task = {
      id: 'test-task-4',
      name: 'Delete Task Test',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    await taskRegistry.delete('test-task-4');

    const retrieved = await taskRegistry.getById('test-task-4');
    expect(retrieved).toBeNull();
  });

  test('should list tasks with filters', async () => {
    // Create tasks with different statuses
    await taskRegistry.create({
      id: 'task-1',
      name: 'Task 1',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await taskRegistry.create({
      id: 'task-2',
      name: 'Task 2',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await taskRegistry.create({
      id: 'task-3',
      name: 'Task 3',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const pendingTasks = await taskRegistry.list({ status: 'pending' });
    expect(pendingTasks.length).toBeGreaterThan(0);

    const allTasks = await taskRegistry.list();
    expect(allTasks.length).toBeGreaterThanOrEqual(3);
  });

  test('should get tasks by status', async () => {
    const runningTasks = await taskRegistry.getByStatus('running');
    expect(Array.isArray(runningTasks)).toBe(true);
  });

  test('should mark task as running', async () => {
    const task: Task = {
      id: 'test-task-5',
      name: 'Mark Running Test',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const running = await taskRegistry.markRunning('test-task-5');

    expect(running.status).toBe('running');
  });

  test('should mark task as completed', async () => {
    const task: Task = {
      id: 'test-task-6',
      name: 'Mark Completed Test',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const completed = await taskRegistry.markCompleted('test-task-6');

    expect(completed.status).toBe('completed');
  });

  test('should mark task as failed', async () => {
    const task: Task = {
      id: 'test-task-7',
      name: 'Mark Failed Test',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await taskRegistry.create(task);
    const failed = await taskRegistry.markFailed('test-task-7', 'Test error');

    expect(failed.status).toBe('failed');
    expect(failed.metadata?.error).toBe('Test error');
  });

  test('should bulk insert tasks', async () => {
    const tasks: Task[] = Array.from({ length: 10 }, (_, i) => ({
      id: `bulk-task-${i}`,
      name: `Bulk Task ${i}`,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const inserted = await taskRegistry.bulkInsert(tasks);
    expect(inserted.length).toBe(10);
  });

  test('should handle concurrent operations', async () => {
    const taskIds = Array.from({ length: 10 }, (_, i) => `concurrent-task-${i}`);

    const promises = taskIds.map(async (id, i) => {
      const task: Task = {
        id,
        name: `Concurrent Task ${i}`,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return taskRegistry.create(task);
    });

    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    expect(results.every(r => r.id)).toBe(true);
  });
});
