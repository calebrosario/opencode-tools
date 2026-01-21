/**
 * State Persistence Prototype Test Suite
 *
 * Tests multi-layer persistence architecture
 */

import {
  StatePersistenceEngine,
  TaskStatus,
  type TaskState,
} from './state-persistence-prototype';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
  testName: string;
  success: boolean;
  time: number; // milliseconds
  operations: number;
  opsPerSecond: number;
  error?: string;
}

class PersistenceTester {
  private engine: StatePersistenceEngine;
  private testDir: string;

  constructor(testDir: string = '/tmp/persistence-test') {
    this.testDir = testDir;
    this.engine = new StatePersistenceEngine(testDir);
  }

  async cleanup() {
    const { exec } = require('child_process');
    await new Promise<void>((resolve) => {
      exec(`rm -rf ${this.testDir}`, resolve);
    });
  }

  /**
   * Test task creation and retrieval
   */
  async testTaskCreation(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const task = await this.engine.createTask('test-task-1', {
        test: 'data',
        nested: { value: 42 },
      });

      const retrieved = await this.engine.readStateJson('test-task-1');

      const endTime = performance.now();
      const time = endTime - startTime;

      return {
        testName: 'task-creation-retrieval',
        success: task.taskId === retrieved?.taskId,
        time,
        operations: 2, // create + retrieve
        opsPerSecond: (2 / time) * 1000,
      };
    } catch (error) {
      return {
        testName: 'task-creation-retrieval',
        success: false,
        time: performance.now() - startTime,
        operations: 0,
        opsPerSecond: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test task updates
   */
  async testTaskUpdates(): Promise<TestResult> {
    const startTime = performance.now();
    const operations = 100; // 100 updates

    try {
      const task = await this.engine.createTask('test-task-2', {
        initial: 'value',
      });

      // Perform 100 updates
      for (let i = 0; i < operations; i++) {
        await this.engine.updateTask('test-task-2', {
          metadata: { updateCount: i },
        });
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      return {
        testName: 'task-updates',
        success: true,
        time,
        operations,
        opsPerSecond: (operations / time) * 1000,
      };
    } catch (error) {
      return {
        testName: 'task-updates',
        success: false,
        time: performance.now() - startTime,
        operations: 0,
        opsPerSecond: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test JSONL log writes
   */
  async testJsonlWrites(): Promise<TestResult> {
    const startTime = performance.now();
    const operations = 1000; // 1000 log entries

    try {
      const task = await this.engine.createTask('test-task-3', {
        initial: 'value',
      });

      // Write 1000 JSONL entries
      for (let i = 0; i < operations; i++) {
        await this.engine.appendJsonl('test-task-3', {
          taskId: 'test-task-3',
          timestamp: new Date(),
          level: 'info',
          operation: `log-entry-${i}`,
          version: 1,
          data: { index: i, value: Math.random() },
        });
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      return {
        testName: 'jsonl-writes',
        success: true,
        time,
        operations,
        opsPerSecond: (operations / time) * 1000,
      };
    } catch (error) {
      return {
        testName: 'jsonl-writes',
        success: false,
        time: performance.now() - startTime,
        operations: 0,
        opsPerSecond: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test checkpoint creation
   */
  async testCheckpointCreation(): Promise<TestResult> {
    const startTime = performance.now();
    const operations = 10; // 10 checkpoints

    try {
      const task = await this.engine.createTask('test-task-4', {
        initial: 'value',
      });

      // Create 10 checkpoints
      for (let i = 0; i < operations; i++) {
        await this.engine.createCheckpoint('test-task-4', 'full', [
          'file1.txt',
          'file2.txt',
          'file3.txt',
        ]);

        await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate work
      }

      const endTime = performance.now();
      const time = endTime - startTime;

      return {
        testName: 'checkpoint-creation',
        success: true,
        time,
        operations,
        opsPerSecond: (operations / time) * 1000,
      };
    } catch (error) {
      return {
        testName: 'checkpoint-creation',
        success: false,
        time: performance.now() - startTime,
        operations: 0,
        opsPerSecond: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test corruption detection
   */
  async testCorruptionDetection(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const task = await this.engine.createTask('test-task-5', {
        initial: 'value',
      });

      // Detect corruption (should be no corruption)
      const result = await this.engine.detectCorruption('test-task-5');

      const endTime = performance.now();
      const time = endTime - startTime;

      return {
        testName: 'corruption-detection',
        success: !result.corrupted,
        time,
        operations: 1,
        opsPerSecond: (1 / time) * 1000,
      };
    } catch (error) {
      return {
        testName: 'corruption-detection',
        success: false,
        time: performance.now() - startTime,
        operations: 0,
        opsPerSecond: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test metrics collection
   */
  async testMetricsCollection(): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const task = await this.engine.createTask('test-task-6', {
        initial: 'value',
      });

      // Generate some data
      for (let i = 0; i < 10; i++) {
        await this.engine.appendJsonl('test-task-6', {
          taskId: 'test-task-6',
          timestamp: new Date(),
          level: 'info',
          operation: `log-entry-${i}`,
          version: 1,
          data: { index: i },
        });
      }

      const metrics = await this.engine.getMetrics('test-task-6');

      const endTime = performance.now();
      const time = endTime - startTime;

      return {
        testName: 'metrics-collection',
        success: metrics.totalSize > 0,
        time,
        operations: 1,
        opsPerSecond: (1 / time) * 1000,
      };
    } catch (error) {
      return {
        testName: 'metrics-collection',
        success: false,
        time: performance.now() - startTime,
        operations: 0,
        opsPerSecond: 0,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('=== State Persistence Prototype Test Suite ===\\n');

    const results: TestResult[] = [];

    // Test 1: Task creation and retrieval
    console.log('Running test: task-creation-retrieval...');
    const result1 = await this.testTaskCreation();
    results.push(result1);
    console.log(`  Status: ${result1.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Time: ${result1.time.toFixed(2)}ms`);
    console.log(`  Throughput: ${result1.opsPerSecond.toFixed(0)} ops/sec\\n`);

    // Test 2: Task updates
    console.log('Running test: task-updates...');
    const result2 = await this.testTaskUpdates();
    results.push(result2);
    console.log(`  Status: ${result2.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Time: ${result2.time.toFixed(2)}ms`);
    console.log(`  Throughput: ${result2.opsPerSecond.toFixed(0)} ops/sec\\n`);

    // Test 3: JSONL writes
    console.log('Running test: jsonl-writes...');
    const result3 = await this.testJsonlWrites();
    results.push(result3);
    console.log(`  Status: ${result3.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Time: ${result3.time.toFixed(2)}ms`);
    console.log(`  Throughput: ${result3.opsPerSecond.toFixed(0)} ops/sec\\n`);

    // Test 4: Checkpoint creation
    console.log('Running test: checkpoint-creation...');
    const result4 = await this.testCheckpointCreation();
    results.push(result4);
    console.log(`  Status: ${result4.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Time: ${result4.time.toFixed(2)}ms`);
    console.log(`  Throughput: ${result4.opsPerSecond.toFixed(0)} ops/sec\\n`);

    // Test 5: Corruption detection
    console.log('Running test: corruption-detection...');
    const result5 = await this.testCorruptionDetection();
    results.push(result5);
    console.log(`  Status: ${result5.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Time: ${result5.time.toFixed(2)}ms\\n`);

    // Test 6: Metrics collection
    console.log('Running test: metrics-collection...');
    const result6 = await this.testMetricsCollection();
    results.push(result6);
    console.log(`  Status: ${result6.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Time: ${result6.time.toFixed(2)}ms\\n`);

    // Print summary
    console.log('=== Test Summary ===\\n');
    console.log('Test Name                    | Status | Time (ms) | Ops/sec');
    console.log('---------------------------|--------|-----------|---------');
    for (const result of results) {
      const name = result.testName.padEnd(27);
      const status = (result.success ? 'PASS' : 'FAIL').padEnd(6);
      const time = result.time.toFixed(2).padEnd(10);
      const ops = result.opsPerSecond.toFixed(0).padEnd(10);
      console.log(`${name} | ${status} | ${time} | ${ops}`);
    }

    return results;
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function main() {
  console.log('=== State Persistence Prototype Test Suite ===\\n');

  const tester = new PersistenceTester();

  // Cleanup before tests
  await tester.cleanup();

  // Run all tests
  const results = await tester.runAllTests();

  // Cleanup after tests
  await tester.cleanup();

  console.log('\\n=== Test Complete ===\\n');

  // Count passes/fails
  const passes = results.filter((r) => r.success).length;
  const fails = results.filter((r) => !r.success).length;

  console.log(`Passed: ${passes}/${results.length}`);
  console.log(`Failed: ${fails}/${results.length}`);
  console.log(`Success Rate: ${((passes / results.length) * 100).toFixed(1)}%\\n`);

  return results;
}

// Run tests if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { PersistenceTester, main };
