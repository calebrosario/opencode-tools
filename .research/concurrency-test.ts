/**
 * Concurrency Prototype Test Suite
 *
 * Tests for:
 * - Lock contention scenarios (10, 25, 50, 100 concurrent agents)
 * - Benchmark lock acquisition/release times
 * - Collaborative mode conflict detection
 * - Performance degradation analysis
 */

import {
  OptimisticLockEngine,
  ConflictDetector,
  LockMode,
  LockStatus,
  type LockResult,
} from './concurrency-prototype';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface BenchmarkResult {
  testName: string;
  concurrency: number;
  totalTime: number; // milliseconds
  avgTime: number; // milliseconds
  minTime: number; // milliseconds
  maxTime: number; // milliseconds
  successCount: number;
  failCount: number;
  conflictCount: number;
  timeoutCount: number;
  throughput: number; // operations per second
}

interface PerformanceMetrics {
  concurrencyLevels: number[];
  benchmarks: BenchmarkResult[];
  performanceCurve: Array<{ concurrency: number; avgTime: number; }>;
}

// ============================================================================
// LOCK CONTENTION TESTS
// ============================================================================

class ConcurrencyTester {
  private engine: OptimisticLockEngine;
  private conflictDetector: ConflictDetector;

  constructor() {
    this.engine = new OptimisticLockEngine();
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * Test lock contention with multiple concurrent agents
   */
  async testLockContention(
    numAgents: number,
    taskIdBase: string = 'task-1',
    mode: LockMode = LockMode.EXCLUSIVE
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const results: LockResult[] = [];
    const times: number[] = [];
    let successCount = 0;
    let failCount = 0;
    let conflictCount = 0;
    let timeoutCount = 0;

    // Simulate concurrent agents
    const promises: Promise<LockResult>[] = [];

    for (let i = 0; i < numAgents; i++) {
      const agentId = `agent-${i}`;
      const taskId = `${taskIdBase}`;

      promises.push(
        this.engine.acquireLock(taskId, agentId, {
          mode,
          timeout: 5000, // 5 seconds
          retry: {
            maxAttempts: 3,
            backoffMs: 50,
          },
        })
      );
    }

    // Execute all lock acquisitions concurrently
    const lockResults = await Promise.all(promises);

    // Collect results
    for (let i = 0; i < lockResults.length; i++) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      times.push(duration);

      const result = lockResults[i];

      if (result.success) {
        successCount++;
      } else if (result.status === LockStatus.CONFLICT) {
        failCount++;
        conflictCount++;
      } else if (result.status === LockStatus.TIMEOUT) {
        failCount++;
        timeoutCount++;
      } else {
        failCount++;
      }
    }

    const totalTime = performance.now() - startTime;

    return {
      testName: `lock-contention-${numAgents}-agents-${mode}`,
      concurrency: numAgents,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successCount,
      failCount,
      conflictCount,
      timeoutCount,
      throughput: (successCount / totalTime) * 1000,
    };
  }

  /**
   * Benchmark lock acquisition/release times
   */
  async benchmarkLockOperations(
    numOperations: number = 1000
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const times: number[] = [];

    for (let i = 0; i < numOperations; i++) {
      const opStart = performance.now();

      const taskId = `task-${i % 10}`; // 10 different tasks
      const agentId = `agent-${i % 5}`; // 5 different agents

      // Acquire lock
      const acquireResult = await this.engine.acquireLock(taskId, agentId, {
        mode: LockMode.EXCLUSIVE,
        timeout: 1000,
      });

      if (acquireResult.success && acquireResult.lock) {
        // Release lock
        await this.engine.releaseLock(taskId, agentId, acquireResult.lock.version);
      }

      const opEnd = performance.now();
      times.push(opEnd - opStart);
    }

    const totalTime = performance.now() - startTime;
    const successCount = times.filter((t) => t < 1000).length; // Count operations under 1s

    return {
      testName: `lock-operations-benchmark-${numOperations}-ops`,
      concurrency: 1, // Sequential operations
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successCount,
      failCount: numOperations - successCount,
      conflictCount: 0,
      timeoutCount: 0,
      throughput: (numOperations / totalTime) * 1000,
    };
  }

  /**
   * Test collaborative mode conflict detection
   */
  async testCollaborativeMode(
    numAgents: number = 10,
    taskId: string = 'shared-task'
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const results: LockResult[] = [];
    const operations: Array<{ agentId: string; taskId: string; timestamp: Date }> = [];
    let successCount = 0;
    let failCount = 0;
    let conflictCount = 0;

    // Simulate collaborative mode
    const promises: Promise<LockResult>[] = [];

    for (let i = 0; i < numAgents; i++) {
      const agentId = `agent-${i}`;

      promises.push(
        this.engine.acquireLock(taskId, agentId, {
          mode: LockMode.COLLABORATIVE,
          timeout: 5000,
        })
      );

      operations.push({
        agentId,
        taskId,
        timestamp: new Date(),
      });
    }

    const lockResults = await Promise.all(promises);

    // Detect collaborative conflicts
    const collaborativeConflicts = this.conflictDetector.detectCollaborativeConflicts(operations);

    for (const result of lockResults) {
      if (result.success) {
        successCount++;
      } else if (result.status === LockStatus.CONFLICT) {
        failCount++;
        conflictCount++;
      } else {
        failCount++;
      }
    }

    const totalTime = performance.now() - startTime;

    return {
      testName: `collaborative-mode-${numAgents}-agents`,
      concurrency: numAgents,
      totalTime,
      avgTime: totalTime / numAgents,
      minTime: 0,
      maxTime: totalTime,
      successCount,
      failCount,
      conflictCount: conflictCount + collaborativeConflicts.length,
      timeoutCount: 0,
      throughput: (successCount / totalTime) * 1000,
    };
  }

  /**
   * Comprehensive performance test with multiple concurrency levels
   */
  async runPerformanceBenchmark(): Promise<PerformanceMetrics> {
    const concurrencyLevels = [10, 25, 50, 100];
    const benchmarks: BenchmarkResult[] = [];

    console.log('\\n=== Performance Benchmark Starting ===\\n');

    for (const concurrency of concurrencyLevels) {
      console.log(`Testing ${concurrency} concurrent agents...`);

      // Test exclusive mode
      const exclusiveResult = await this.testLockContention(
        concurrency,
        `exclusive-task-${concurrency}`,
        LockMode.EXCLUSIVE
      );
      benchmarks.push(exclusiveResult);

      console.log(`  EXCLUSIVE: ${exclusiveResult.successCount}/${concurrency} successful`);
      console.log(`    Avg time: ${exclusiveResult.avgTime.toFixed(2)}ms`);
      console.log(`    Conflicts: ${exclusiveResult.conflictCount}`);

      // Test collaborative mode
      const collaborativeResult = await this.testCollaborativeMode(concurrency);
      benchmarks.push(collaborativeResult);

      console.log(`  COLLABORATIVE: ${collaborativeResult.successCount}/${concurrency} successful`);
      console.log(`    Avg time: ${collaborativeResult.avgTime.toFixed(2)}ms`);
      console.log(`    Conflicts: ${collaborativeResult.conflictCount}`);
    }

    // Benchmark sequential operations
    console.log(`\\nBenchmarking sequential operations...`);
    const sequentialBenchmark = await this.benchmarkLockOperations(1000);
    benchmarks.push(sequentialBenchmark);

    console.log(`  1000 operations: ${sequentialBenchmark.totalTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${sequentialBenchmark.throughput.toFixed(0)} ops/sec`);

    // Build performance curve
    const performanceCurve = benchmarks
      .filter((b) => b.concurrency > 1)
      .map((b) => ({
        concurrency: b.concurrency,
        avgTime: b.avgTime,
      }))
      .sort((a, b) => a.concurrency - b.concurrency);

    return {
      concurrencyLevels,
      benchmarks,
      performanceCurve,
    };
  }

  /**
   * Get statistics from engine
   */
  getEngineStats() {
    return this.engine.getStats();
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function main() {
  console.log('=== Concurrency Prototype Test Suite ===\\n');

  const tester = new ConcurrencyTester();

  // Run comprehensive performance benchmark
  const metrics = await tester.runPerformanceBenchmark();

  console.log('\\n=== Performance Summary ===\\n');

  for (const benchmark of metrics.benchmarks) {
    console.log(`\\n${benchmark.testName}:`);
    console.log(`  Concurrency: ${benchmark.concurrency}`);
    console.log(`  Total Time: ${benchmark.totalTime.toFixed(2)}ms`);
    console.log(`  Avg Time: ${benchmark.avgTime.toFixed(2)}ms`);
    console.log(`  Min Time: ${benchmark.minTime.toFixed(2)}ms`);
    console.log(`  Max Time: ${benchmark.maxTime.toFixed(2)}ms`);
    console.log(`  Success: ${benchmark.successCount}`);
    console.log(`  Fail: ${benchmark.failCount}`);
    console.log(`  Conflicts: ${benchmark.conflictCount}`);
    console.log(`  Timeouts: ${benchmark.timeoutCount}`);
    console.log(`  Throughput: ${benchmark.throughput.toFixed(0)} ops/sec`);
  }

  console.log('\\n=== Performance Curve ===\\n');
  console.log('Concurrency | Avg Time (ms)');
  console.log('-----------|---------------');
  for (const point of metrics.performanceCurve) {
    console.log(` ${point.concurrency.toString().padStart(9)} | ${point.avgTime.toFixed(2)}`);
  }

  console.log('\\n=== Engine Statistics ===\\n');
  const stats = tester.getEngineStats();
  console.log(JSON.stringify(stats, null, 2));

  console.log('\\n=== Test Complete ===\\n');

  return metrics;
}

// Run tests if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ConcurrencyTester, main };
