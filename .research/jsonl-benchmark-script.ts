#!/usr/bin/env node

/**
 * JSONL Benchmark Script
 *
 * Tests JSONL append operations with 1M+ entries
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BENCHMARK_DIR = '/tmp/jsonl-benchmark';
const LOG_FILE = join(BENCHMARK_DIR, 'logs.jsonl');
const ENTRIES = 1000000; // 1M entries
const BATCH_SIZE = 100; // Batch size for writes

// ============================================================================
// BENCHMARK UTILITIES
// ============================================================================

interface BenchmarkResult {
  name: string;
  entries: number;
  totalTimeMs: number;
  avgTimePerEntryMs: number;
  opsPerSecond: number;
  fileSizeBytes: number;
  success: boolean;
  error?: string;
}

/**
 * Create benchmark directory
 */
async function setupBenchmark(): Promise<void> {
  try {
    await fs.mkdir(BENCHMARK_DIR, { recursive: true });
    console.log(`✓ Created benchmark directory: ${BENCHMARK_DIR}`);
  } catch (error) {
    console.error(`✗ Failed to create directory: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Generate a single JSONL entry
 */
function generateEntry(index: number): string {
  const entry = {
    taskId: `task-${index}`,
    timestamp: new Date().toISOString(),
    level: 'info',
    operation: 'log-entry',
    version: 1,
    data: {
      index,
      value: Math.random(),
      timestamp: Date.now(),
    },
  };
  return JSON.stringify(entry) + '\n';
}

/**
 * Benchmark 1: Simple append (1M entries)
 */
async function benchmarkSimpleAppend(): Promise<BenchmarkResult> {
  console.log('\n=== Benchmark 1: Simple Append (1M entries) ===');

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    // Clear existing file
    try {
      await fs.unlink(LOG_FILE);
    } catch {
      // File doesn't exist, which is fine
    }

    // Append 1M entries
    for (let i = 0; i < ENTRIES; i++) {
      const entry = generateEntry(i);
      await fs.appendFile(LOG_FILE, entry, 'utf-8');

      // Progress indicator (every 100K entries)
      if (i > 0 && i % 100000 === 0) {
        const elapsed = performance.now() - startTime;
        const progress = ((i / ENTRIES) * 100).toFixed(1);
        console.log(`  Progress: ${progress}% (${i.toLocaleString()} entries) - ${elapsed.toFixed(0)}ms`);
      }
    }

    console.log('  ✓ Completed all writes');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  // Get file size
  let fileSizeBytes = 0;
  if (success) {
    try {
      const stats = await fs.stat(LOG_FILE);
      fileSizeBytes = stats.size;
    } catch {
      // Ignore stat errors
    }
  }

  const avgTimePerEntryMs = totalTimeMs / ENTRIES;
  const opsPerSecond = (ENTRIES / totalTimeMs) * 1000;

  return {
    name: 'simple-append-1m',
    entries: ENTRIES,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    fileSizeBytes,
    success,
    error,
  };
}

/**
 * Benchmark 2: Batched append (1M entries, 100 per batch)
 */
async function benchmarkBatchedAppend(): Promise<BenchmarkResult> {
  console.log('\n=== Benchmark 2: Batched Append (1M entries, 100 per batch) ===');

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    // Clear existing file
    try {
      await fs.unlink(LOG_FILE);
    } catch {
      // File doesn't exist, which is fine
    }

    // Generate and append in batches
    for (let i = 0; i < ENTRIES; i += BATCH_SIZE) {
      const batch: string[] = [];
      const endIndex = Math.min(i + BATCH_SIZE, ENTRIES);

      for (let j = i; j < endIndex; j++) {
        batch.push(generateEntry(j));
      }

      await fs.appendFile(LOG_FILE, batch.join(''), 'utf-8');

      // Progress indicator (every 100K entries)
      if (i > 0 && i % 100000 === 0) {
        const elapsed = performance.now() - startTime;
        const progress = ((i / ENTRIES) * 100).toFixed(1);
        console.log(`  Progress: ${progress}% (${i.toLocaleString()} entries) - ${elapsed.toFixed(0)}ms`);
      }
    }

    console.log('  ✓ Completed all writes');
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  // Get file size
  let fileSizeBytes = 0;
  if (success) {
    try {
      const stats = await fs.stat(LOG_FILE);
      fileSizeBytes = stats.size;
    } catch {
      // Ignore stat errors
    }
  }

  const avgTimePerEntryMs = totalTimeMs / ENTRIES;
  const opsPerSecond = (ENTRIES / totalTimeMs) * 1000;

  return {
    name: 'batched-append-1m',
    entries: ENTRIES,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    fileSizeBytes,
    success,
    error,
  };
}

/**
 * Benchmark 3: Read and parse 1M entries
 */
async function benchmarkReadParse(): Promise<BenchmarkResult> {
  console.log('\n=== Benchmark 3: Read and Parse 1M entries ===');

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    console.log(`  Read ${lines.length.toLocaleString()} lines`);

    // Parse all entries
    let parsedCount = 0;
    for (const line of lines) {
      try {
        JSON.parse(line);
        parsedCount++;
      } catch {
        // Skip invalid lines
      }
    }

    console.log(`  Parsed ${parsedCount.toLocaleString()} entries`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;

  // Get file size
  let fileSizeBytes = 0;
  if (success) {
    try {
      const stats = await fs.stat(LOG_FILE);
      fileSizeBytes = stats.size;
    } catch {
      // Ignore stat errors
    }
  }

  const entries = ENTRIES;
  const avgTimePerEntryMs = totalTimeMs / entries;
  const opsPerSecond = (entries / totalTimeMs) * 1000;

  return {
    name: 'read-parse-1m',
    entries,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    fileSizeBytes,
    success,
    error,
  };
}

/**
 * Print benchmark results
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('\n=== Benchmark Results ===\n');
  console.log(
    'Benchmark Name               | Entries   | Total Time (ms) | Avg Time/Entry (ms) | Ops/sec | File Size (MB) | Status'
  );
  console.log(
    '-----------------------------|-----------|-----------------|---------------------|---------|----------------|--------'
  );

  for (const result of results) {
    const name = result.name.padEnd(29);
    const entries = result.entries.toLocaleString().padStart(10);
    const totalTime = result.totalTimeMs.toFixed(2).padStart(16);
    const avgTime = result.avgTimePerEntryMs.toFixed(4).padStart(20);
    const ops = Math.round(result.opsPerSecond).toLocaleString().padStart(8);
    const size = (result.fileSizeBytes / 1024 / 1024).toFixed(2).padStart(14);
    const status = (result.success ? 'PASS' : 'FAIL').padStart(6);

    console.log(`${name} | ${entries} | ${totalTime} | ${avgTime} | ${ops} | ${size} | ${status}`);

    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
}

/**
 * Main benchmark runner
 */
async function main(): Promise<void> {
  console.log('=== JSONL Benchmark Suite ===\n');
  console.log(`Entries: ${ENTRIES.toLocaleString()}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Output: ${LOG_FILE}\n`);

  // Setup
  await setupBenchmark();

  // Run benchmarks
  const results: BenchmarkResult[] = [];

  // Benchmark 1: Simple append
  const result1 = await benchmarkSimpleAppend();
  results.push(result1);

  // Benchmark 2: Batched append (only if simple append succeeded)
  if (result1.success) {
    const result2 = await benchmarkBatchedAppend();
    results.push(result2);

    // Benchmark 3: Read and parse (only if batched append succeeded)
    if (result2.success) {
      const result3 = await benchmarkReadParse();
      results.push(result3);
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

  console.log('=== Benchmark Complete ===\n');
}

// Run benchmarks if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, BenchmarkResult };
