#!/usr/bin/env node

/**
 * Recovery Test Script
 *
 * Tests recovery strategies from large JSONL files
 */

import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BENCHMARK_FILE = '/tmp/jsonl-benchmark/logs.jsonl';
const TEST_DIR = '/tmp/recovery-test';
const EXPECTED_ENTRIES = 1000000;

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface RecoveryTestResult {
  name: string;
  entriesRecovered: number;
  entriesSkipped: number;
  totalTimeMs: number;
  avgTimePerEntryMs: number;
  opsPerSecond: number;
  peakMemoryMB: number;
  success: boolean;
  error?: string;
}

/**
 * Get memory usage in MB
 */
function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / 1024 / 1024;
}

/**
 * Get file size
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

// ============================================================================
// RECOVERY STRATEGIES
// ============================================================================

/**
 * Strategy 1: Full JSON.parse() Recovery
 *
 * Load entire file and parse all entries
 * Works well for smaller files, risky for large files
 */
async function testFullJsonParseRecovery(): Promise<RecoveryTestResult> {
  console.log('\n=== Strategy 1: Full JSON.parse() Recovery ===');
  console.log(`File: ${BENCHMARK_FILE}`);
  console.log(`Expected entries: ${EXPECTED_ENTRIES.toLocaleString()}`);

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;
  let entriesRecovered = 0;
  let entriesSkipped = 0;
  let peakMemoryMB = 0;

  // Take initial memory snapshot
  const initialMemory = getMemoryUsageMB();

  try {
    const content = await fs.readFile(BENCHMARK_FILE, 'utf-8');
    const fileSize = content.length;
    
    console.log(`  Read ${(fileSize / 1024 / 1024).toFixed(2)}MB from disk`);

    const lines = content.split('\n').filter((line) => line.trim());
    console.log(`  Split into ${lines.length.toLocaleString()} lines`);

    for (const line of lines) {
      try {
        JSON.parse(line);
        entriesRecovered++;

        // Track peak memory
        const currentMemory = getMemoryUsageMB();
        if (currentMemory > peakMemoryMB) {
          peakMemoryMB = currentMemory;
        }
      } catch (err) {
        entriesSkipped++;
      }
    }

    console.log(`  ✓ Recovered ${entriesRecovered.toLocaleString()} entries`);
    console.log(`  Peak memory: ${peakMemoryMB.toFixed(2)}MB`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;
  const avgTimePerEntryMs = totalTimeMs / entriesRecovered;
  const opsPerSecond = (entriesRecovered / totalTimeMs) * 1000;

  return {
    name: 'full-json-parse',
    entriesRecovered,
    entriesSkipped,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    peakMemoryMB,
    success,
    error,
  };
}

/**
 * Strategy 2: Streaming Recovery
 *
 * Read file line-by-line and parse each entry
 * Memory-efficient for large files
 */
async function testStreamingRecovery(): Promise<RecoveryTestResult> {
  console.log('\n=== Strategy 2: Streaming Recovery ===');
  console.log(`File: ${BENCHMARK_FILE}`);
  console.log(`Expected entries: ${EXPECTED_ENTRIES.toLocaleString()}`);

  const startTime = performance.now();
  let success = true;
  let error: string | undefined;
  let entriesRecovered = 0;
  let entriesSkipped = 0;
  let peakMemoryMB = 0;

  const initialMemory = getMemoryUsageMB();

  try {
    const fileStream = createReadStream(BENCHMARK_FILE, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          JSON.parse(line);
          entriesRecovered++;

          // Track peak memory
          const currentMemory = getMemoryUsageMB();
          if (currentMemory > peakMemoryMB) {
            peakMemoryMB = currentMemory;
          }
        } catch (err) {
          entriesSkipped++;
        }
      }
    }

    console.log(`  ✓ Recovered ${entriesRecovered.toLocaleString()} entries`);
    console.log(`  Peak memory: ${peakMemoryMB.toFixed(2)}MB`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;
  const avgTimePerEntryMs = totalTimeMs / entriesRecovered;
  const opsPerSecond = (entriesRecovered / totalTimeMs) * 1000;

  return {
    name: 'streaming-recovery',
    entriesRecovered,
    entriesSkipped,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    peakMemoryMB,
    success,
    error,
  };
}

/**
 * Strategy 3: Partial Recovery (First 100K entries)
 *
 * Recover only first N entries (useful for recent history)
 */
async function testPartialRecovery(): Promise<RecoveryTestResult> {
  console.log('\n=== Strategy 3: Partial Recovery (First 100K) ===');
  console.log(`File: ${BENCHMARK_FILE}`);
  console.log(`Target entries: 100,000`);

  const TARGET_ENTRIES = 100000;
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;
  let entriesRecovered = 0;
  let entriesSkipped = 0;
  let peakMemoryMB = 0;

  const initialMemory = getMemoryUsageMB();

  try {
    const fileStream = createReadStream(BENCHMARK_FILE, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (entriesRecovered >= TARGET_ENTRIES) {
        break;
      }

      if (line.trim()) {
        try {
          JSON.parse(line);
          entriesRecovered++;

          const currentMemory = getMemoryUsageMB();
          if (currentMemory > peakMemoryMB) {
            peakMemoryMB = currentMemory;
          }
        } catch (err) {
          entriesSkipped++;
        }
      }
    }

    console.log(`  ✓ Recovered ${entriesRecovered.toLocaleString()} entries`);
    console.log(`  Peak memory: ${peakMemoryMB.toFixed(2)}MB`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;
  const avgTimePerEntryMs = totalTimeMs / entriesRecovered;
  const opsPerSecond = (entriesRecovered / totalTimeMs) * 1000;

  return {
    name: 'partial-recovery-first-100k',
    entriesRecovered,
    entriesSkipped,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    peakMemoryMB,
    success,
    error,
  };
}

/**
 * Strategy 4: Range Recovery (Entries 400K-500K)
 *
 * Recover a specific range of entries
 */
async function testRangeRecovery(): Promise<RecoveryTestResult> {
  console.log('\n=== Strategy 4: Range Recovery (400K-500K) ===');
  console.log(`File: ${BENCHMARK_FILE}`);
  console.log(`Target range: 400,000 - 500,000 entries`);

  const START_INDEX = 400000;
  const END_INDEX = 500000;
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;
  let entriesRecovered = 0;
  let entriesSkipped = 0;
  let peakMemoryMB = 0;

  const initialMemory = getMemoryUsageMB();

  try {
    const fileStream = createReadStream(BENCHMARK_FILE, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let currentIndex = 0;

    for await (const line of rl) {
      if (currentIndex >= END_INDEX) {
        break;
      }

      if (line.trim()) {
        // Only parse entries in our target range
        if (currentIndex >= START_INDEX) {
          try {
            JSON.parse(line);
            entriesRecovered++;
          } catch (err) {
            entriesSkipped++;
          }
        }

        currentIndex++;

        // Track memory only for entries in range
        if (currentIndex >= START_INDEX) {
          const currentMemory = getMemoryUsageMB();
          if (currentMemory > peakMemoryMB) {
            peakMemoryMB = currentMemory;
          }
        }
      }
    }

    console.log(`  ✓ Recovered ${entriesRecovered.toLocaleString()} entries from range`);
    console.log(`  Peak memory: ${peakMemoryMB.toFixed(2)}MB`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();
  const totalTimeMs = endTime - startTime;
  const avgTimePerEntryMs = totalTimeMs / entriesRecovered;
  const opsPerSecond = (entriesRecovered / totalTimeMs) * 1000;

  return {
    name: 'range-recovery-400k-500k',
    entriesRecovered,
    entriesSkipped,
    totalTimeMs,
    avgTimePerEntryMs,
    opsPerSecond,
    peakMemoryMB,
    success,
    error,
  };
}

// ============================================================================
// RESULTS PRINTING
// ============================================================================

function printResults(results: RecoveryTestResult[]): void {
  console.log('\n=== Recovery Test Results ===\n');
  console.log(
    'Strategy                   | Recovered  | Skipped | Total Time (ms) | Avg/Entry (ms) | Ops/sec | Peak Mem (MB) | Status'
  );
  console.log(
    '---------------------------|------------|---------|-----------------|----------------|---------|----------------|--------'
  );

  for (const result of results) {
    const name = result.name.padEnd(27);
    const recovered = result.entriesRecovered.toLocaleString().padStart(11);
    const skipped = result.entriesSkipped.toLocaleString().padStart(8);
    const totalTime = result.totalTimeMs.toFixed(2).padStart(16);
    const avgTime = result.avgTimePerEntryMs.toFixed(4).padStart(15);
    const ops = Math.round(result.opsPerSecond).toLocaleString().padStart(8);
    const mem = result.peakMemoryMB.toFixed(2).padStart(13);
    const status = (result.success ? 'PASS' : 'FAIL').padStart(6);

    console.log(`${name} | ${recovered} | ${skipped} | ${totalTime} | ${avgTime} | ${ops} | ${mem} | ${status}`);

    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('=== Recovery Test Suite ===\n');
  console.log(`Benchmark File: ${BENCHMARK_FILE}`);
  
  const fileSize = await getFileSize(BENCHMARK_FILE);
  console.log(`File Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Expected Entries: ${EXPECTED_ENTRIES.toLocaleString()}\n`);

  const results: RecoveryTestResult[] = [];

  // Test Strategy 1: Full JSON.parse()
  const result1 = await testFullJsonParseRecovery();
  results.push(result1);

  // Test Strategy 2: Streaming Recovery (always run for comparison)
  const result2 = await testStreamingRecovery();
  results.push(result2);

  // Test Strategy 3: Partial Recovery
  if (result2.success) {
    const result3 = await testPartialRecovery();
    results.push(result3);
  }

  // Test Strategy 4: Range Recovery
  if (result2.success) {
    const result4 = await testRangeRecovery();
    results.push(result4);
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

  // Memory comparison
  console.log('=== Memory Comparison ===\n');
  console.log('Full JSON.parse():  ', results[0].peakMemoryMB.toFixed(2), 'MB');
  console.log('Streaming:           ', results[1].peakMemoryMB.toFixed(2), 'MB');
  console.log(`Memory Savings:       ${((1 - results[1].peakMemoryMB / results[0].peakMemoryMB) * 100).toFixed(1)}%\n`);

  console.log('=== Test Complete ===\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, RecoveryTestResult };
