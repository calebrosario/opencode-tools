#!/usr/bin/env node

/**
 * Log Rotation Test Script
 *
 * Tests different log rotation strategies for JSONL files
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TEST_DIR = '/tmp/log-rotation-test';
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB (smaller for testing)
const MAX_FILES = 5;
const ENTRIES_TO_WRITE = 200000; // 200K entries to trigger rotation

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface RotationTestResult {
  name: string;
  entriesWritten: number;
  filesCreated: number;
  totalSizeBytes: number;
  avgFileSizeBytes: number;
  rotationCount: number;
  success: boolean;
  error?: string;
  details?: string;
}

/**
 * Create test directory
 */
async function setupTestDir(): Promise<void> {
  try {
    await fs.mkdir(TEST_DIR, { recursive: true });
    console.log(`✓ Created test directory: ${TEST_DIR}`);
  } catch (error) {
    console.error(`✗ Failed to create directory: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Cleanup test directory
 */
async function cleanupTestDir(): Promise<void> {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    console.log(`✓ Cleaned up test directory: ${TEST_DIR}`);
  } catch (error) {
    console.error(`✗ Failed to cleanup: ${(error as Error).message}`);
  }
}

/**
 * Generate JSONL entry
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
      payload: 'x'.repeat(200), // Add some payload to increase file size
    },
  };
  return JSON.stringify(entry) + '\n';
}

/**
 * Get all log files sorted by name
 */
async function getLogFiles(): Promise<string[]> {
  const files = await fs.readdir(TEST_DIR);
  const logFiles = files.filter((f) => f.endsWith('.jsonl'));
  return logFiles.sort();
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
// ROTATION STRATEGIES
// ============================================================================

/**
 * Strategy 1: Size-Based Rotation
 *
 * Rotate when file reaches MAX_SIZE_BYTES
 */
async function testSizeBasedRotation(): Promise<RotationTestResult> {
  console.log('\n=== Strategy 1: Size-Based Rotation ===');
  console.log(`Max file size: ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Entries to write: ${ENTRIES_TO_WRITE.toLocaleString()}`);

  const startTime = performance.now();
  let rotationCount = 0;
  let entriesWritten = 0;
  let success = true;
  let error: string | undefined;
  let currentLogFile = join(TEST_DIR, 'log-0.jsonl');

  try {
    // Ensure directory is clean
    await cleanupTestDir();
    await setupTestDir();

    for (let i = 0; i < ENTRIES_TO_WRITE; i++) {
      const entry = generateEntry(i);
      
      // Check if we need to rotate
      const currentSize = await getFileSize(currentLogFile);
      if (currentSize >= MAX_SIZE_BYTES) {
        // Rotate
        rotationCount++;
        const files = await getLogFiles();
        const nextIndex = files.length;
        currentLogFile = join(TEST_DIR, `log-${nextIndex}.jsonl`);
        console.log(`  Rotation #${rotationCount}: Created ${nextIndex}.jsonl (size: ${(currentSize / 1024 / 1024).toFixed(2)}MB)`);
      }

      await fs.appendFile(currentLogFile, entry, 'utf-8');
      entriesWritten++;

      // Progress indicator
      if (i > 0 && i % 50000 === 0) {
        const elapsed = performance.now() - startTime;
        const progress = ((i / ENTRIES_TO_WRITE) * 100).toFixed(1);
        console.log(`  Progress: ${progress}% (${i.toLocaleString()} entries, ${rotationCount} rotations)`);
      }
    }

    console.log(`  ✓ Completed: ${entriesWritten.toLocaleString()} entries, ${rotationCount} rotations`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();

  // Collect statistics
  const files = await getLogFiles();
  const filesCreated = files.length;
  let totalSize = 0;
  for (const file of files) {
    totalSize += await getFileSize(join(TEST_DIR, file));
  }
  const avgFileSize = filesCreated > 0 ? totalSize / filesCreated : 0;

  return {
    name: 'size-based-rotation',
    entriesWritten,
    filesCreated,
    totalSizeBytes: totalSize,
    avgFileSizeBytes: avgFileSize,
    rotationCount,
    success,
    error,
    details: `Max size: ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB`,
  };
}

/**
 * Strategy 2: Time-Based Rotation
 *
 * Rotate every N seconds (simulated with entry count for testing)
 */
async function testTimeBasedRotation(): Promise<RotationTestResult> {
  console.log('\n=== Strategy 2: Time-Based Rotation (Simulated) ===');
  console.log(`Rotate every: 50000 entries (simulating time)`);
  console.log(`Entries to write: ${ENTRIES_TO_WRITE.toLocaleString()}`);

  const ROTATION_INTERVAL = 50000; // Rotate every 50K entries
  const startTime = performance.now();
  let rotationCount = 0;
  let entriesWritten = 0;
  let success = true;
  let error: string | undefined;
  let currentLogFile = join(TEST_DIR, 'log-0.jsonl');

  try {
    // Ensure directory is clean
    await cleanupTestDir();
    await setupTestDir();

    for (let i = 0; i < ENTRIES_TO_WRITE; i++) {
      const entry = generateEntry(i);
      
      // Rotate based on "time" (simulated with entry count)
      if (i > 0 && i % ROTATION_INTERVAL === 0) {
        rotationCount++;
        const files = await getLogFiles();
        const nextIndex = files.length;
        currentLogFile = join(TEST_DIR, `log-${nextIndex}.jsonl`);
        
        const currentSize = await getFileSize(join(TEST_DIR, files[files.length - 1]));
        console.log(`  Rotation #${rotationCount}: Created ${nextIndex}.jsonl (size: ${(currentSize / 1024 / 1024).toFixed(2)}MB)`);
      }

      await fs.appendFile(currentLogFile, entry, 'utf-8');
      entriesWritten++;

      // Progress indicator
      if (i > 0 && i % 50000 === 0) {
        const elapsed = performance.now() - startTime;
        const progress = ((i / ENTRIES_TO_WRITE) * 100).toFixed(1);
        console.log(`  Progress: ${progress}% (${i.toLocaleString()} entries, ${rotationCount} rotations)`);
      }
    }

    console.log(`  ✓ Completed: ${entriesWritten.toLocaleString()} entries, ${rotationCount} rotations`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();

  // Collect statistics
  const files = await getLogFiles();
  const filesCreated = files.length;
  let totalSize = 0;
  for (const file of files) {
    totalSize += await getFileSize(join(TEST_DIR, file));
  }
  const avgFileSize = filesCreated > 0 ? totalSize / filesCreated : 0;

  return {
    name: 'time-based-rotation',
    entriesWritten,
    filesCreated,
    totalSizeBytes: totalSize,
    avgFileSizeBytes: avgFileSize,
    rotationCount,
    success,
    error,
    details: `Rotation interval: ${ROTATION_INTERVAL} entries`,
  };
}

/**
 * Strategy 3: Hybrid Rotation (Size + Time)
 *
 * Rotate when file reaches MAX_SIZE_BYTES OR every N entries
 */
async function testHybridRotation(): Promise<RotationTestResult> {
  console.log('\n=== Strategy 3: Hybrid Rotation (Size + Time) ===');
  console.log(`Max file size: ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Max entries per file: 60000`);
  console.log(`Entries to write: ${ENTRIES_TO_WRITE.toLocaleString()}`);

  const MAX_ENTRIES_PER_FILE = 60000;
  const startTime = performance.now();
  let rotationCount = 0;
  let entriesWritten = 0;
  let success = true;
  let error: string | undefined;
  let currentLogFile = join(TEST_DIR, 'log-0.jsonl');
  let entriesInCurrentFile = 0;

  try {
    // Ensure directory is clean
    await cleanupTestDir();
    await setupTestDir();

    for (let i = 0; i < ENTRIES_TO_WRITE; i++) {
      const entry = generateEntry(i);
      
      // Check rotation conditions
      const currentSize = await getFileSize(currentLogFile);
      const sizeRotationTriggered = currentSize >= MAX_SIZE_BYTES;
      const countRotationTriggered = entriesInCurrentFile >= MAX_ENTRIES_PER_FILE;

      if (sizeRotationTriggered || countRotationTriggered) {
        rotationCount++;
        const files = await getLogFiles();
        const nextIndex = files.length;
        currentLogFile = join(TEST_DIR, `log-${nextIndex}.jsonl`);
        entriesInCurrentFile = 0;
        
        const reason = sizeRotationTriggered ? 'size' : 'count';
        console.log(`  Rotation #${rotationCount}: Created ${nextIndex}.jsonl (trigger: ${reason}, size: ${(currentSize / 1024 / 1024).toFixed(2)}MB)`);
      }

      await fs.appendFile(currentLogFile, entry, 'utf-8');
      entriesWritten++;
      entriesInCurrentFile++;

      // Progress indicator
      if (i > 0 && i % 50000 === 0) {
        const elapsed = performance.now() - startTime;
        const progress = ((i / ENTRIES_TO_WRITE) * 100).toFixed(1);
        console.log(`  Progress: ${progress}% (${i.toLocaleString()} entries, ${rotationCount} rotations)`);
      }
    }

    console.log(`  ✓ Completed: ${entriesWritten.toLocaleString()} entries, ${rotationCount} rotations`);
  } catch (err) {
    success = false;
    error = (err as Error).message;
    console.error(`  ✗ Failed: ${error}`);
  }

  const endTime = performance.now();

  // Collect statistics
  const files = await getLogFiles();
  const filesCreated = files.length;
  let totalSize = 0;
  for (const file of files) {
    totalSize += await getFileSize(join(TEST_DIR, file));
  }
  const avgFileSize = filesCreated > 0 ? totalSize / filesCreated : 0;

  return {
    name: 'hybrid-rotation',
    entriesWritten,
    filesCreated,
    totalSizeBytes: totalSize,
    avgFileSizeBytes: avgFileSize,
    rotationCount,
    success,
    error,
    details: `Max size: ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(2)}MB, Max entries: ${MAX_ENTRIES_PER_FILE}`,
  };
}

// ============================================================================
// RESULTS PRINTING
// ============================================================================

function printResults(results: RotationTestResult[]): void {
  console.log('\n=== Log Rotation Test Results ===\n');
  console.log(
    'Strategy               | Entries | Files | Rotations | Total Size (MB) | Avg Size (MB) | Status'
  );
  console.log(
    '-----------------------|---------|-------|-----------|----------------|----------------|--------'
  );

  for (const result of results) {
    const name = result.name.padEnd(23);
    const entries = result.entriesWritten.toLocaleString().padStart(8);
    const files = result.filesCreated.toString().padStart(6);
    const rotations = result.rotationCount.toString().padStart(10);
    const totalSize = (result.totalSizeBytes / 1024 / 1024).toFixed(2).padStart(15);
    const avgSize = (result.avgFileSizeBytes / 1024 / 1024).toFixed(2).padStart(13);
    const status = (result.success ? 'PASS' : 'FAIL').padStart(6);

    console.log(`${name} | ${entries} | ${files} | ${rotations} | ${totalSize} | ${avgSize} | ${status}`);

    if (!result.success && result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`  Details: ${result.details}`);
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('=== Log Rotation Test Suite ===\n');
  console.log(`Test Directory: ${TEST_DIR}`);
  console.log(`Entries to Write: ${ENTRIES_TO_WRITE.toLocaleString()}\n`);

  const results: RotationTestResult[] = [];

  // Test Strategy 1: Size-Based Rotation
  const result1 = await testSizeBasedRotation();
  results.push(result1);

  // Test Strategy 2: Time-Based Rotation
  if (result1.success) {
    const result2 = await testTimeBasedRotation();
    results.push(result2);
  }

  // Test Strategy 3: Hybrid Rotation
  if (result1.success) {
    const result3 = await testHybridRotation();
    results.push(result3);
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

  // Cleanup
  console.log('=== Cleanup ===\n');
  await cleanupTestDir();

  console.log('=== Test Complete ===\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, RotationTestResult };
