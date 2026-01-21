#!/usr/bin/env node

/**
 * SQLite Concurrent Write Stress Test
 *
 * Tests SQLite performance under concurrent write load
 */

import Database from 'better-sqlite3';
import { existsSync, unlinkSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_PATH = '/tmp/sqlite-concurrent-stress.db';
const CONCURRENT_WRITERS = [10, 20, 30, 50, 100]; // Test 10-100 writers
const OPERATIONS_PER_WRITER = 100;
const TIMEOUT_MS = 30000; // 30s max per test

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ConcurrentTestResult {
  name: string;
  writers: number;
  operationsAttempted: number;
  operationsSuccessful: number;
  operationsFailed: number;
  totalTimeMs: number;
  avgTimePerOpMs: number;
  opsPerSecond: number;
  successRate: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

function setupDatabase(): Database.Database {
  console.log('Setting up database...');
  
  // Remove existing database
  if (existsSync(DB_PATH)) {
    unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging for better concurrency
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000'); // 5s busy timeout
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = memory');

  // Create table
  db.exec(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL,
      status TEXT NOT NULL,
      value REAL,
      writerId INTEGER,
      createdAt TEXT NOT NULL
    )
  `);

  console.log('✓ Database setup complete');
  return db;
}

// ============================================================================
// CONCURRENT WRITE TEST
// ============================================================================

async function testConcurrentWrites(writers: number): Promise<ConcurrentTestResult> {
  console.log(`\n=== Testing ${writers} Concurrent Writers ===`);

  const db = setupDatabase();
  const insert = db.prepare(`
    INSERT INTO tasks (taskId, status, value, writerId, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);

  const startTime = performance.now();
  let operationsAttempted = 0;
  let operationsSuccessful = 0;
  let operationsFailed = 0;
  let success = true;
  let error: string | undefined;

  try {
    const promises: Promise<void>[] = [];

    for (let writerId = 0; writerId < writers; writerId++) {
      const promise = new Promise<void>((resolve) => {
        const writer = new Database(DB_PATH);
        const writerInsert = writer.prepare(`
          INSERT INTO tasks (taskId, status, value, writerId, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `);

        let opsSuccessful = 0;
        let opsFailed = 0;

        for (let op = 0; op < OPERATIONS_PER_WRITER; op++) {
          operationsAttempted++;

          try {
            writerInsert.run(
              `task-w${writerId}-o${op}`,
              'running',
              Math.random(),
              writerId,
              new Date().toISOString()
            );
            opsSuccessful++;
            operationsSuccessful++;
          } catch (err) {
            opsFailed++;
            operationsFailed++;
          }
        }

        writer.close();
        resolve();
      });

      promises.push(promise);
    }

    // Wait for all writers to complete
    await Promise.race([
      Promise.all(promises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      )
    ]);

    console.log(`✓ ${writers} writers complete`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  // Verify data integrity
  const count = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  console.log(`  Total rows in database: ${count.count}`);

  db.close();

  return {
    name: `concurrent-writes-${writers}`,
    writers,
    operationsAttempted,
    operationsSuccessful,
    operationsFailed,
    totalTimeMs,
    avgTimePerOpMs: totalTimeMs / operationsSuccessful,
    opsPerSecond: (operationsSuccessful / totalTimeMs) * 1000,
    successRate: (operationsSuccessful / operationsAttempted) * 100,
    success,
    error,
  };
}

// ============================================================================
// RESULTS PRINTING
// ============================================================================

function printResults(results: ConcurrentTestResult[]): void {
  console.log('\n=== SQLite Concurrent Write Stress Test Results ===\n');
  console.log(
    'Test Name          | Writers | Attempted | Success | Failed | Success Rate | Total Time (ms) | Ops/sec | Status'
  );
  console.log(
    '-------------------|---------|-----------|---------|--------|--------------|-----------------|---------|--------'
  );

  for (const result of results) {
    const name = result.name.padEnd(19);
    const writers = result.writers.toString().padStart(7);
    const attempted = result.operationsAttempted.toLocaleString().padStart(9);
    const success = result.operationsSuccessful.toLocaleString().padStart(7);
    const failed = result.operationsFailed.toLocaleString().padStart(6);
    const rate = `${result.successRate.toFixed(1)}%`.padStart(13);
    const time = result.totalTimeMs.toFixed(0).padStart(15);
    const ops = Math.round(result.opsPerSecond).toLocaleString().padStart(8);
    const status = (result.success ? 'PASS' : 'FAIL').padStart(6);

    console.log(`${name} | ${writers} | ${attempted} | ${success} | ${failed} | ${rate} | ${time} | ${ops} | ${status}`);

    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('=== SQLite Concurrent Write Stress Test Suite ===\n');
  console.log(`Database: ${DB_PATH}`);
  console.log(`Operations per writer: ${OPERATIONS_PER_WRITER}`);
  console.log(`Timeout per test: ${TIMEOUT_MS}ms\n`);

  const results: ConcurrentTestResult[] = [];

  for (const writers of CONCURRENT_WRITERS) {
    const result = await testConcurrentWrites(writers);
    results.push(result);

    if (!result.success) {
      console.log('\n⚠️  Test failed, stopping remaining tests');
      break;
    }
  }

  // Print results
  printResults(results);

  // Summary
  console.log('\n=== Summary ===\n');
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  // Analysis
  console.log('=== Analysis ===\n');

  if (results.length > 0) {
    const bestResult = results.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    );

    console.log(`Best performance: ${bestResult.writers} writers`);
    console.log(`Success rate: ${bestResult.successRate.toFixed(1)}%`);
    console.log(`Throughput: ${Math.round(bestResult.opsPerSecond).toLocaleString()} ops/sec\n`);

    // Find concurrency threshold
    let threshold = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i].successRate < 95.0) {
        threshold = results[i].writers;
        break;
      }
    }

    if (threshold > 0) {
      console.log(`⚠️  Concurrency threshold: ~${threshold} concurrent writers`);
      console.log(`   Success rate drops below 95% beyond this point`);
    } else {
      console.log(`✓ All tests passed (>95% success rate)`);
    }
  }

  console.log('\n=== Test Complete ===\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, ConcurrentTestResult };
