#!/usr/bin/env node

/**
 * SQLite Performance Test Script
 *
 * Tests SQLite performance with 100K+ tasks
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_PATH = '/tmp/sqlite-perf-test.db';
const TASKS_TO_CREATE = 100000; // 100K tasks
const BATCH_SIZE = 1000;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Task {
  taskId: string;
  status: string;
  metadata: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface PerformanceResult {
  name: string;
  operations: number;
  totalTimeMs: number;
  avgTimePerOpMs: number;
  opsPerSecond: number;
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
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = memory');

  // Create tasks table
  db.exec(`
    CREATE TABLE tasks (
      taskId TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      metadata TEXT NOT NULL,
      currentVersion INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX idx_status ON tasks(status);
    CREATE INDEX idx_updatedAt ON tasks(updatedAt);
  `);

  console.log('✓ Database setup complete');
  return db;
}

function generateTask(index: number): Task {
  return {
    taskId: `task-${index}`,
    status: ['created', 'running', 'paused', 'completed', 'failed'][index % 5],
    metadata: JSON.stringify({
      value: Math.random(),
      nested: { data: `test-${index}` },
      array: [1, 2, 3, 4, 5],
    }),
    currentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// TEST 1: Batch Insert Performance
// ============================================================================

function testBatchInsert(db: Database.Database): PerformanceResult {
  console.log('\n=== Test 1: Batch Insert (100K tasks) ===');

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const insert = db.prepare(`
      INSERT INTO tasks (taskId, status, metadata, currentVersion, createdAt, updatedAt)
      VALUES (@taskId, @status, @metadata, @currentVersion, @createdAt, @updatedAt)
    `);

    const insertMany = db.transaction((tasks: Task[]) => {
      for (const task of tasks) {
        insert.run(task);
      }
    });

    // Insert in batches of 1000
    for (let i = 0; i < TASKS_TO_CREATE; i += BATCH_SIZE) {
      const batch: Task[] = [];
      const endIndex = Math.min(i + BATCH_SIZE, TASKS_TO_CREATE);

      for (let j = i; j < endIndex; j++) {
        batch.push(generateTask(j));
      }

      insertMany(batch);

      if (i % 10000 === 0) {
        const progress = ((i / TASKS_TO_CREATE) * 100).toFixed(1);
        const elapsed = performance.now() - startTime;
        console.log(`  Progress: ${progress}% (${i.toLocaleString()} tasks) - ${elapsed.toFixed(0)}ms`);
      }
    }

    console.log('✓ Batch insert complete');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  return {
    name: 'batch-insert-100k',
    operations: TASKS_TO_CREATE,
    totalTimeMs,
    avgTimePerOpMs: totalTimeMs / TASKS_TO_CREATE,
    opsPerSecond: (TASKS_TO_CREATE / totalTimeMs) * 1000,
    success,
    error,
  };
}

// ============================================================================
// TEST 2: Single Row Read Performance
// ============================================================================

function testSingleRowRead(db: Database.Database): PerformanceResult {
  console.log('\n=== Test 2: Single Row Read (10K reads) ===');

  const READ_COUNT = 10000;
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const select = db.prepare('SELECT * FROM tasks WHERE taskId = ?');

    for (let i = 0; i < READ_COUNT; i++) {
      const taskId = `task-${Math.floor(Math.random() * TASKS_TO_CREATE)}`;
      select.get(taskId);
    }

    console.log('✓ Single row reads complete');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  return {
    name: 'single-row-read-10k',
    operations: READ_COUNT,
    totalTimeMs,
    avgTimePerOpMs: totalTimeMs / READ_COUNT,
    opsPerSecond: (READ_COUNT / totalTimeMs) * 1000,
    success,
    error,
  };
}

// ============================================================================
// TEST 3: Range Query Performance
// ============================================================================

function testRangeQuery(db: Database.Database): PerformanceResult {
  console.log('\n=== Test 3: Range Query (1K queries) ===');

  const QUERY_COUNT = 1000;
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const select = db.prepare('SELECT * FROM tasks WHERE status = ? LIMIT 100');

    for (let i = 0; i < QUERY_COUNT; i++) {
      const status = ['created', 'running', 'paused', 'completed', 'failed'][i % 5];
      select.all(status);
    }

    console.log('✓ Range queries complete');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  return {
    name: 'range-query-1k',
    operations: QUERY_COUNT,
    totalTimeMs,
    avgTimePerOpMs: totalTimeMs / QUERY_COUNT,
    opsPerSecond: (QUERY_COUNT / totalTimeMs) * 1000,
    success,
    error,
  };
}

// ============================================================================
// TEST 4: Update Performance
// ============================================================================

function testUpdate(db: Database.Database): PerformanceResult {
  console.log('\n=== Test 4: Update (10K updates) ===');

  const UPDATE_COUNT = 10000;
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const update = db.prepare(`
      UPDATE tasks
      SET status = ?, currentVersion = ?, updatedAt = ?
      WHERE taskId = ?
    `);

    for (let i = 0; i < UPDATE_COUNT; i++) {
      const taskId = `task-${Math.floor(Math.random() * TASKS_TO_CREATE)}`;
      update.run(
        'completed',
        2,
        new Date().toISOString(),
        taskId
      );
    }

    console.log('✓ Updates complete');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  return {
    name: 'update-10k',
    operations: UPDATE_COUNT,
    totalTimeMs,
    avgTimePerOpMs: totalTimeMs / UPDATE_COUNT,
    opsPerSecond: (UPDATE_COUNT / totalTimeMs) * 1000,
    success,
    error,
  };
}

// ============================================================================
// TEST 5: Full Table Scan (Worst Case)
// ============================================================================

function testFullTableScan(db: Database.Database): PerformanceResult {
  console.log('\n=== Test 5: Full Table Scan (100K rows) ===');

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;
  let count = 0;

  try {
    const select = db.prepare('SELECT * FROM tasks');
    const rows = select.all();
    count = rows.length;

    console.log('✓ Full table scan complete');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  return {
    name: 'full-table-scan-100k',
    operations: count,
    totalTimeMs,
    avgTimePerOpMs: totalTimeMs / count,
    opsPerSecond: (count / totalTimeMs) * 1000,
    success,
    error,
  };
}

// ============================================================================
// RESULTS PRINTING
// ============================================================================

function printResults(results: PerformanceResult[]): void {
  console.log('\n=== SQLite Performance Results ===\n');
  console.log(
    'Test Name                 | Operations | Total Time (ms) | Avg/Op (ms) | Ops/sec  | Status'
  );
  console.log(
    '--------------------------|------------|------------------|--------------|----------|--------'
  );

  for (const result of results) {
    const name = result.name.padEnd(26);
    const ops = result.operations.toLocaleString().padStart(11);
    const totalTime = result.totalTimeMs.toFixed(2).padStart(16);
    const avgOp = result.avgTimePerOpMs.toFixed(4).padStart(13);
    const opsPerSec = Math.round(result.opsPerSecond).toLocaleString().padStart(9);
    const status = (result.success ? 'PASS' : 'FAIL').padStart(6);

    console.log(`${name} | ${ops} | ${totalTime} | ${avgOp} | ${opsPerSec} | ${status}`);

    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('=== SQLite Performance Test Suite ===\n');
  console.log(`Database: ${DB_PATH}`);
  console.log(`Tasks to Create: ${TASKS_TO_CREATE.toLocaleString()}`);
  console.log(`Batch Size: ${BATCH_SIZE}\n`);

  let db: Database.Database | null = null;

  try {
    // Setup database
    db = setupDatabase();

    const results: PerformanceResult[] = [];

    // Test 1: Batch Insert
    const result1 = testBatchInsert(db);
    results.push(result1);

    if (result1.success) {
      // Test 2: Single Row Read
      const result2 = testSingleRowRead(db);
      results.push(result2);

      // Test 3: Range Query
      if (result2.success) {
        const result3 = testRangeQuery(db);
        results.push(result3);

        // Test 4: Update
        if (result3.success) {
          const result4 = testUpdate(db);
          results.push(result4);

          // Test 5: Full Table Scan
          if (result4.success) {
            const result5 = testFullTableScan(db);
            results.push(result5);
          }
        }
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

    // Database file size
    try {
      const { statSync } = await import('fs');
      const stats = statSync(DB_PATH);
      console.log(`Database file size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    } catch {
      // Ignore stat errors
    }

    console.log('\n=== Test Complete ===\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, PerformanceResult };
