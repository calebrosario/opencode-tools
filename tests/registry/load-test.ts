// Task Registry Load Test - Phase 2: MVP Core
// Week 9, Day 5: Performance testing with 100K+ tasks

import { taskRegistry } from '../../src/task-registry/registry';
import { Task, TaskStatus } from '../../src/types';

export async function runLoadTests(): Promise<void> {
  console.log('Starting Task Registry Load Tests...\n');

  // Test 1: Create 10K tasks sequentially
  await testSequentialCreate(10000);
  
  // Test 2: Create 100K tasks sequentially
  await testSequentialCreate(100000);
  
  // Test 3: Create 1K tasks concurrently
  await testConcurrentCreate(1000);
  
  // Test 4: Query performance on 100K tasks
  await testQueryPerformance();
  
  // Test 5: Update performance on 100K tasks
  await testUpdatePerformance();
  
  // Test 6: Delete performance
  await testDeletePerformance();
  
  console.log('\nAll load tests completed!');
}

async function testSequentialCreate(count: number): Promise<void> {
  console.log(`\n--- Test: Create ${count} tasks sequentially ---`);
  
  const startTime = Date.now();
  const tasks: Task[] = [];
  
  for (let i = 0; i < count; i++) {
    const task: Task = {
      id: `load-test-task-${i}`,
      name: `Load Test Task ${i}`,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: 'load-test',
      metadata: { index: i },
    };
    
    tasks.push(task);
    
    // Batch insert every 1000 tasks for performance
    if (tasks.length >= 1000 || i === count - 1) {
      await taskRegistry.bulkInsert(tasks);
      tasks.length = 0;
    }
  }
  
  const duration = Date.now() - startTime;
  const avgTime = duration / count;
  
  console.log(`Created ${count} tasks in ${duration}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per task`);
  console.log(`Throughput: ${(count / (duration / 1000)).toFixed(2)} tasks/sec`);
  
  // Validate target
  if (avgTime < 1) {
    console.log('✅ PASS: Average time <1ms');
  } else {
    console.log('❌ FAIL: Average time >1ms');
  }
}

async function testConcurrentCreate(count: number): Promise<void> {
  console.log(`\n--- Test: Create ${count} tasks concurrently ---`);
  
  const startTime = Date.now();
  const batchSize = 100; // 10 parallel batches of 100
  const tasks: Task[] = [];
  
  for (let i = 0; i < count; i++) {
    const task: Task = {
      id: `concurrent-test-task-${i}`,
      name: `Concurrent Test Task ${i}`,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: 'concurrent-test',
    };
    
    tasks.push(task);
  }
  
  // Create in batches of 100
  const batches: Task[][] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    batches.push(tasks.slice(i, i + batchSize));
  }
  
  // Create batches concurrently
  const results = await Promise.all(
    batches.map(batch => taskRegistry.bulkInsert(batch))
  );
  
  const duration = Date.now() - startTime;
  const avgTime = duration / count;
  
  console.log(`Created ${count} tasks concurrently in ${duration}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per task`);
  console.log(`Batches: ${batches.length}, Batch size: ${batchSize}`);
}

async function testQueryPerformance(): Promise<void> {
  console.log('\n--- Test: Query performance on 100K tasks ---');
  
  // Test 1: Query by ID
  const idStart = Date.now();
  const byId = await taskRegistry.getById('load-test-task-50000');
  const idDuration = Date.now() - idStart;
  console.log(`Query by ID: ${idDuration}ms`);
  
  // Test 2: Query by status
  const statusStart = Date.now();
  const byStatus = await taskRegistry.getByStatus('pending');
  const statusDuration = Date.now() - statusStart;
  console.log(`Query by status: ${statusDuration}ms (${byStatus.length} results)`);
  
  // Test 3: List all with limit
  const listStart = Date.now();
  const listed = await taskRegistry.list({ limit: 100 });
  const listDuration = Date.now() - listStart;
  console.log(`List with limit: ${listDuration}ms`);
  
  // Validate targets
  if (idDuration < 1) {
    console.log('✅ PASS: Query by ID <1ms');
  }
  if (statusDuration < 5) {
    console.log('✅ PASS: Query by status <5ms');
  }
}

async function testUpdatePerformance(): Promise<void> {
  console.log('\n--- Test: Update performance ---');
  
  const updates = Array.from({ length: 1000 }, (_, i) => ({
    id: `load-test-task-${i}`,
    changes: { status: 'running' as TaskStatus },
  }));
  
  const startTime = Date.now();
  await taskRegistry.bulkUpdate(updates);
  const duration = Date.now() - startTime;
  const avgTime = duration / updates.length;
  
  console.log(`Updated ${updates.length} tasks in ${duration}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per update`);
  
  if (avgTime < 5) {
    console.log('✅ PASS: Average update time <5ms');
  } else {
    console.log('❌ FAIL: Average update time >5ms');
  }
}

async function testDeletePerformance(): Promise<void> {
  console.log('\n--- Test: Delete performance ---');
  
  const deleteCount = 100;
  const startTime = Date.now();
  
  for (let i = 0; i < deleteCount; i++) {
    await taskRegistry.delete(`load-test-task-${i}`);
  }
  
  const duration = Date.now() - startTime;
  const avgTime = duration / deleteCount;
  
  console.log(`Deleted ${deleteCount} tasks in ${duration}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per delete`);
  
  if (avgTime < 5) {
    console.log('✅ PASS: Average delete time <5ms');
  } else {
    console.log('❌ FAIL: Average delete time >5ms');
  }
}

// Run tests if executed directly
if (require.main === module) {
  runLoadTests()
    .then(() => {
      console.log('\n✅ All load tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Load tests failed:', error);
      process.exit(1);
    });
}

export { runLoadTests };
