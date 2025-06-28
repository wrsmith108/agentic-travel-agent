#!/usr/bin/env node

/**
 * Test Runner Script
 * Runs tests individually to avoid timeout issues
 */

const { execSync } = require('child_process');
const path = require('path');

// Load test environment
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

const testFiles = [
  'health.test.ts',
  'auth.test.ts',
  'preferences.test.ts',
  'flights.test.ts',
  'ai-conversation.test.ts',
  'price-monitoring.test.ts'
];

const testResults = {
  passed: [],
  failed: [],
  errors: []
};

console.log('🧪 Running AI Travel Agent Integration Tests\n');
console.log('Environment: TEST (Demo Mode)\n');

testFiles.forEach((file, index) => {
  console.log(`\n[${index + 1}/${testFiles.length}] Running ${file}...`);
  console.log('─'.repeat(50));
  
  try {
    const result = execSync(
      `npm test -- tests/integration/${file} --forceExit --detectOpenHandles`,
      {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        env: process.env
      }
    );
    
    console.log('✅ PASSED');
    testResults.passed.push(file);
    
    // Extract test summary
    const output = result.toString();
    const summaryMatch = output.match(/Tests:\s+(.+)/);
    if (summaryMatch) {
      console.log(`   ${summaryMatch[1]}`);
    }
  } catch (error) {
    console.log('❌ FAILED');
    testResults.failed.push(file);
    
    if (error.stdout) {
      const output = error.stdout.toString();
      // Extract failure summary
      const failureMatch = output.match(/Tests:\s+(.+)/);
      if (failureMatch) {
        console.log(`   ${failureMatch[1]}`);
      }
      
      // Extract specific failures
      const failures = output.match(/✕ .+/g);
      if (failures) {
        console.log('\n   Failed tests:');
        failures.forEach(f => console.log(`   ${f}`));
      }
    }
    
    if (error.message) {
      testResults.errors.push({ file, error: error.message });
    }
  }
});

// Print summary
console.log('\n' + '═'.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('═'.repeat(60));
console.log(`✅ Passed: ${testResults.passed.length}/${testFiles.length}`);
console.log(`❌ Failed: ${testResults.failed.length}/${testFiles.length}`);

if (testResults.passed.length > 0) {
  console.log('\nPassed tests:');
  testResults.passed.forEach(f => console.log(`  ✓ ${f}`));
}

if (testResults.failed.length > 0) {
  console.log('\nFailed tests:');
  testResults.failed.forEach(f => console.log(`  ✗ ${f}`));
}

if (testResults.errors.length > 0) {
  console.log('\nErrors:');
  testResults.errors.forEach(({ file, error }) => {
    console.log(`  ${file}: ${error}`);
  });
}

console.log('\n' + '─'.repeat(60));
console.log('Test run complete!');

// Exit with appropriate code
process.exit(testResults.failed.length > 0 ? 1 : 0);