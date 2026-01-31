// Component Integration Tests - Phase 2: MVP Core
// Week 14, Task 14.1: Component Integration Testing

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { taskLifecycle } from '../../src/task/lifecycle';
import { taskRegistry } from '../../src/task-registry/registry';
import { multiLayerPersistence } from '../../src/persistence/multi-layer';
import { lockManager } from '../../src/util/lock-manager';
import { taskLifecycleHooks } from '../../src/hooks/task-lifecycle';
import { TOOL_DEFINITIONS } from '../../src/mcp/tools';

describe('Component Integration Tests', () => {
  const testTaskId = 'integration-test-task';
  const testAgentId = 'integration-test-agent';

  beforeAll(async () => {
    await taskRegistry.initialize();
  });

  beforeEach(async () => {
    try {
      await taskRegistry.getById(testTaskId);
      await taskLifecycle.deleteTask(testTaskId);
    } catch {
      // Task doesn't exist, that's fine
    }
  });

  afterAll(async () => {
    try {
      await taskLifecycle.deleteTask(testTaskId);
    } catch {
      // Ignore
    }
  });

  describe('Integration 1: TaskLifecycle + TaskRegistry', () => {
    test('should create task and persist to registry', async () => {
      const task = await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Integration Test Task',
        owner: testAgentId,
        metadata: { test: 'data' },
      });

      expect(task).toBeDefined();
      expect(task.id).toBe(testTaskId);
      expect(task.status).toBe('pending');

      const retrieved = await taskRegistry.getById(testTaskId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(testTaskId);
      expect(retrieved?.name).toBe('Integration Test Task');
    });

    test('should update task status in registry through lifecycle', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Status Test Task',
        owner: testAgentId,
      });

      const started = await taskLifecycle.startTask(testTaskId, testAgentId);
      expect(started.status).toBe('running');

      const completed = await taskLifecycle.completeTask(testTaskId, {
        success: true,
        status: 'success' as const,
        data: { result: 'completed' },
        message: 'Task completed successfully',
      } as any);
      expect(completed.status).toBe('completed');

      const retrieved = await taskRegistry.getById(testTaskId);
      expect(retrieved?.status).toBe('completed');
    });

    test('should delete task from registry through lifecycle', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Delete Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.deleteTask(testTaskId);

      const retrieved = await taskRegistry.getById(testTaskId);
      expect(retrieved).toBeNull();
    });

    test('should list tasks with filters', async () => {
      const taskId1 = `${testTaskId}-1`;
      const taskId2 = `${testTaskId}-2`;

      await taskLifecycle.createTask({
        id: taskId1,
        name: 'Pending Task',
        owner: testAgentId,
      });

      await taskLifecycle.createTask({
        id: taskId2,
        name: 'Running Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(taskId2, testAgentId);

      const pendingTasks = await taskRegistry.list({ status: 'pending' });
      const runningTasks = await taskRegistry.list({ status: 'running' });

      expect(pendingTasks.some(t => t.id === taskId1)).toBe(true);
      expect(runningTasks.some(t => t.id === taskId2)).toBe(true);

      await taskLifecycle.deleteTask(taskId1);
      await taskLifecycle.deleteTask(taskId2);
    });
  });

  describe('Integration 2: TaskLifecycle + MultiLayerPersistence', () => {
    test('should persist task state to multi-layer storage', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Persistence Test Task',
        owner: testAgentId,
      });

      const state = await multiLayerPersistence.loadState(testTaskId);
      expect(state).not.toBeNull();
      expect(state?.taskId).toBe(testTaskId);
      expect(state?.status).toBe('pending');
    });

    test('should log task transitions to JSONL', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Log Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      const logs = await multiLayerPersistence.loadLogs(testTaskId);
      expect(logs.length).toBeGreaterThan(0);

      const startLog = logs.find(log => log.message.includes('started'));
      expect(startLog).toBeDefined();
      expect(startLog?.level).toBe('info');
    });

    test('should persist error on task failure', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Failure Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      await taskLifecycle.failTask(testTaskId, 'Test error message');

      const logs = await multiLayerPersistence.loadLogs(testTaskId, { level: 'error' });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]?.message).toContain('failed');
    });

    test('should create checkpoints', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Checkpoint Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      const checkpointId = await multiLayerPersistence.createCheckpoint(
        testTaskId,
        'Test checkpoint'
      );

      expect(checkpointId).toBeDefined();
      expect(checkpointId).toContain('checkpoint_');

      const checkpoints = await multiLayerPersistence.listCheckpoints(testTaskId);
      expect(checkpoints.length).toBe(1);
      expect(checkpoints[0]?.id).toBe(checkpointId);
    });

    test('should cleanup all persistence layers on delete', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Cleanup Test Task',
        owner: testAgentId,
      });

      await multiLayerPersistence.createCheckpoint(testTaskId, 'Test checkpoint');

      await taskLifecycle.deleteTask(testTaskId);

      const state = await multiLayerPersistence.loadState(testTaskId);
      expect(state).toBeNull();

      const logs = await multiLayerPersistence.loadLogs(testTaskId);
      expect(logs.length).toBe(0);
    });
  });

  describe('Integration 3: TaskLifecycle + LockManager', () => {
    test('should acquire locks during lifecycle operations', async () => {
      let lockAcquired = false;

      taskLifecycleHooks.registerBeforeTaskStart(async (taskId, agentId) => {
        const lockStatus = lockManager.getLockStatus(`task:${taskId}`);
        lockAcquired = lockStatus !== undefined;
      });

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Lock Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      expect(lockAcquired).toBe(true);
    });

    test('should prevent concurrent mutations', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Concurrency Test Task',
        owner: testAgentId,
      });

      const start1 = taskLifecycle.startTask(testTaskId, testAgentId);
      const start2 = taskLifecycle.startTask(testTaskId, testAgentId);

      await expect(start1).resolves.toBeDefined();

      try {
        await start2;
      } catch (error) {
        expect(error).toBeDefined();
      }

      const task = await taskRegistry.getById(testTaskId);
      expect(task?.status).toBe('running');
    });

    test('should release lock even on error', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Lock Release Test Task',
        owner: testAgentId,
      });

      const hookId = taskLifecycleHooks.registerBeforeTaskStart(async () => {
        throw new Error('Hook error');
      });

      await expect(
        taskLifecycle.startTask(testTaskId, testAgentId)
      ).rejects.toThrow('Hook error');

      await taskLifecycle.startTask(testTaskId, testAgentId);

      const task = await taskRegistry.getById(testTaskId);
      expect(task?.status).toBe('running');

      taskLifecycleHooks.unregisterHook(hookId);
    });
  });

  describe('Integration 4: MCP Tools + TaskLifecycle', () => {
    test('should create task through MCP tool', async () => {
      const createTool = TOOL_DEFINITIONS.find(
        t => t.name === 'create_task_sandbox'
      );

      const result = await createTool!.execute({
        taskId: testTaskId,
        name: 'MCP Test Task',
        owner: testAgentId,
      });

      expect(result.success).toBe(true);
      expect((result as any).taskId).toBe(testTaskId);

      const task = await taskRegistry.getById(testTaskId);
      expect(task).not.toBeNull();
      expect(task?.name).toBe('MCP Test Task');
    });

    test('should attach agent through MCP tool', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Attach Test Task',
        owner: 'system',
      });

      const attachTool = TOOL_DEFINITIONS.find(
        t => t.name === 'attach_agent_to_task'
      );

      const result = await attachTool!.execute({
        taskId: testTaskId,
        agentId: testAgentId,
      });

      expect(result.success).toBe(true);
      expect((result as any).agentId).toBe(testAgentId);

      const task = await taskRegistry.getById(testTaskId);
      expect(task?.status).toBe('running');
    });

    test('should get task status through MCP tool', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Status Test Task',
        owner: testAgentId,
      });

      const statusTool = TOOL_DEFINITIONS.find(t => t.name === 'get_task_status');

      const result = await statusTool!.execute({
        taskId: testTaskId,
      });

      expect(result).toBeDefined();
      expect((result as any).taskId).toBe(testTaskId);
    });

    test('should cancel task through MCP tool', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Cancel Test Task',
        owner: testAgentId,
      });

      const cancelTool = TOOL_DEFINITIONS.find(t => t.name === 'cancel_task');

      const result = await cancelTool!.execute({
        taskId: testTaskId,
      });

      expect(result.success).toBe(true);

      const task = await taskRegistry.getById(testTaskId);
      expect(task?.status).toBe('cancelled');
    });

    test('should delete task through MCP tool', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Delete MCP Test Task',
        owner: testAgentId,
      });

      const deleteTool = TOOL_DEFINITIONS.find(t => t.name === 'delete_task');

      const result = await deleteTool!.execute({
        taskId: testTaskId,
      });

      expect(result.success).toBe(true);

      const task = await taskRegistry.getById(testTaskId);
      expect(task).toBeNull();
    });
  });

  describe('Integration 5: Hooks + TaskLifecycle', () => {
    test('should execute beforeTaskStart hooks', async () => {
      let hookExecuted = false;

      const hookId = taskLifecycleHooks.registerBeforeTaskStart(
        async (taskId, agentId) => {
          hookExecuted = true;
          expect(taskId).toBe(testTaskId);
          expect(agentId).toBe(testAgentId);
        }
      );

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Hook Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      expect(hookExecuted).toBe(true);

      taskLifecycleHooks.unregisterHook(hookId);
    });

    test('should execute afterTaskStart hooks', async () => {
      let hookExecuted = false;

      const hookId = taskLifecycleHooks.registerAfterTaskStart(
        async (taskId, agentId) => {
          hookExecuted = true;
          expect(taskId).toBe(testTaskId);
          expect(agentId).toBe(testAgentId);
        }
      );

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'After Hook Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      expect(hookExecuted).toBe(true);

      taskLifecycleHooks.unregisterHook(hookId);
    });

    test('should execute beforeTaskComplete hooks', async () => {
      let hookExecuted = false;
      const result: any = {
        success: true,
        status: 'success' as const,
        data: { test: 'result' },
        message: 'Test completed',
      };

      const hookId = taskLifecycleHooks.registerBeforeTaskComplete(
        async (taskId, taskResult) => {
          hookExecuted = true;
          expect(taskId).toBe(testTaskId);
          expect(taskResult).toEqual(result);
        }
      );

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Complete Hook Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);
      await taskLifecycle.completeTask(testTaskId, result);

      expect(hookExecuted).toBe(true);

      taskLifecycleHooks.unregisterHook(hookId);
    });

    test('should execute hooks in priority order', async () => {
      const executionOrder: number[] = [];

      const hook1 = taskLifecycleHooks.registerBeforeTaskStart(
        async () => {
          executionOrder.push(1);
        },
        10
      );

      const hook2 = taskLifecycleHooks.registerBeforeTaskStart(
        async () => {
          executionOrder.push(2);
        },
        20
      );

      const hook3 = taskLifecycleHooks.registerBeforeTaskStart(
        async () => {
          executionOrder.push(3);
        },
        5
      );

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Priority Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      expect(executionOrder).toEqual([3, 1, 2]);

      taskLifecycleHooks.unregisterHook(hook1);
      taskLifecycleHooks.unregisterHook(hook2);
      taskLifecycleHooks.unregisterHook(hook3);
    });

    test('should continue executing hooks even if one fails', async () => {
      let hook2Executed = false;

      const hook1 = taskLifecycleHooks.registerBeforeTaskStart(async () => {
        throw new Error('Hook 1 failed');
      });

      const hook2 = taskLifecycleHooks.registerBeforeTaskStart(async () => {
        hook2Executed = true;
      });

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Failure Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      expect(hook2Executed).toBe(true);

      taskLifecycleHooks.unregisterHook(hook1);
      taskLifecycleHooks.unregisterHook(hook2);
    });

    test('should execute fail hooks on task failure', async () => {
      let beforeFailExecuted = false;
      let afterFailExecuted = false;

      const hook1 = taskLifecycleHooks.registerBeforeTaskFail(
        async (taskId, error) => {
          beforeFailExecuted = true;
          expect(taskId).toBe(testTaskId);
          expect(error).toBe('Test failure');
        }
      );

      const hook2 = taskLifecycleHooks.registerAfterTaskFail(
        async (taskId, error) => {
          afterFailExecuted = true;
          expect(taskId).toBe(testTaskId);
          expect(error).toBe('Test failure');
        }
      );

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Fail Hook Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);
      await taskLifecycle.failTask(testTaskId, 'Test failure');

      expect(beforeFailExecuted).toBe(true);
      expect(afterFailExecuted).toBe(true);

      taskLifecycleHooks.unregisterHook(hook1);
      taskLifecycleHooks.unregisterHook(hook2);
    });
  });

  describe('Integration 6: End-to-End Component Flow', () => {
    test('should handle complete task lifecycle with all integrations', async () => {
      const events: string[] = [];

      taskLifecycleHooks.registerBeforeTaskStart(async () => {
        events.push('before_start');
        void 0; // Fix return type
      });
      taskLifecycleHooks.registerAfterTaskStart(async () => {
        events.push('after_start');
        void 0; // Fix return type
      });
      taskLifecycleHooks.registerBeforeTaskComplete(async () => {
        events.push('before_complete');
        void 0; // Fix return type
      });
      taskLifecycleHooks.registerAfterTaskComplete(async () => {
        events.push('after_complete');
        void 0; // Fix return type
      });

      const task = await taskLifecycle.createTask({
        id: testTaskId,
        name: 'E2E Test Task',
        owner: testAgentId,
        metadata: { initial: 'data' },
      });

      expect(task.status).toBe('pending');

      const started = await taskLifecycle.startTask(testTaskId, testAgentId);
      expect(started.status).toBe('running');

      const lockStatus = lockManager.getLockStatus(`task:${testTaskId}`);
      expect(lockStatus).toBeDefined();

      const state = await multiLayerPersistence.loadState(testTaskId);
      expect(state?.status).toBe('running');

      const logs = await multiLayerPersistence.loadLogs(testTaskId);
      expect(logs.length).toBeGreaterThan(0);

      const checkpointId = await multiLayerPersistence.createCheckpoint(
        testTaskId,
        'Before completion'
      );
      expect(checkpointId).toBeDefined();

      const result: any = {
        success: true,
        status: 'success' as const,
        data: { output: 'test' },
        message: 'E2E test completed',
      };
      const completed = await taskLifecycle.completeTask(testTaskId, result);
      expect(completed.status).toBe('completed');

      expect(events).toEqual([
        'before_start',
        'after_start',
        'before_complete',
        'after_complete',
      ]);

      const finalState = await multiLayerPersistence.loadState(testTaskId);
      expect(finalState?.status).toBe('completed');

      const allLogs = await multiLayerPersistence.loadLogs(testTaskId);
      const completeLog = allLogs.find(log => log.message.includes('completed'));
      expect(completeLog).toBeDefined();

      const checkpoints = await multiLayerPersistence.listCheckpoints(testTaskId);
      expect(checkpoints.length).toBe(1);
    });

    test('should handle error flow with all integrations', async () => {
      const events: string[] = [];

      taskLifecycleHooks.registerBeforeTaskFail(async () => {
        events.push('before_fail');
        void 0; // Fix return type
      });
      taskLifecycleHooks.registerAfterTaskFail(async () => {
        events.push('after_fail');
        void 0; // Fix return type
      });

      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Error Flow Test Task',
        owner: testAgentId,
      });

      await taskLifecycle.startTask(testTaskId, testAgentId);

      await taskLifecycle.failTask(testTaskId, 'Simulated failure');

      expect(events).toEqual(['before_fail', 'after_fail']);

      const errorLogs = await multiLayerPersistence.loadLogs(testTaskId, {
        level: 'error',
      });
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0]?.message).toContain('failed');

      const task = await taskRegistry.getById(testTaskId);
      expect(task?.metadata?.error).toBe('Simulated failure');
    });

    test('should handle cancel flow with all integrations', async () => {
      await taskLifecycle.createTask({
        id: testTaskId,
        name: 'Cancel Flow Test Task',
        owner: testAgentId,
      });

      const cancelled = await taskLifecycle.cancelTask(testTaskId);
      expect(cancelled.status).toBe('cancelled');

      const logs = await multiLayerPersistence.loadLogs(testTaskId, {
        level: 'warning',
      });
      const cancelLog = logs.find(log => log.message.includes('cancelled'));
      expect(cancelLog).toBeDefined();
    });
  });
});
