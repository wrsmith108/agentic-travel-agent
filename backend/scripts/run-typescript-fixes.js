#!/usr/bin/env node

/**
 * Coordinator script to run TypeScript fixes in order
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting TypeScript Error Resolution\n');

const scripts = [
  {
    name: 'Fix Missing Result Imports',
    file: 'fix-missing-result-imports.js',
    description: 'Adding missing isErr/isOk imports'
  },
  {
    name: 'Fix Zod Validation Types',
    file: 'fix-zod-validation-types.js',
    description: 'Converting Zod SafeParseReturnType to Result pattern'
  },
  {
    name: 'Fix Redis Buffer Types',
    file: 'fix-redis-buffer-types.js',
    description: 'Handling Buffer to string conversions'
  }
];

function runScript(script) {
  console.log(`\n📋 ${script.name}`);
  console.log(`   ${script.description}...`);
  
  try {
    const scriptPath = path.join(__dirname, script.file);
    const output = execSync(`node ${scriptPath}`, { encoding: 'utf8' });
    console.log(output);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${script.name}:`, error.message);
    return false;
  }
}

function checkTypeScriptErrors() {
  console.log('\n🔍 Checking TypeScript errors...');
  try {
    execSync('npm run typecheck', { 
      encoding: 'utf8',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ No TypeScript errors!');
    return 0;
  } catch (error) {
    // Extract error count from output
    const output = error.stdout || '';
    const errorMatches = output.match(/error TS/g);
    const errorCount = errorMatches ? errorMatches.length : 'unknown';
    console.log(`📊 Current errors: ${errorCount}`);
    return errorCount;
  }
}

// Check initial error count
console.log('📊 Initial TypeScript Error Count:');
const initialErrors = checkTypeScriptErrors();

// Run each script
let allSuccess = true;
scripts.forEach((script, index) => {
  const success = runScript(script);
  allSuccess = allSuccess && success;
  
  // Check error count after each script
  if (success) {
    const currentErrors = checkTypeScriptErrors();
    const reduction = typeof initialErrors === 'number' && typeof currentErrors === 'number' 
      ? initialErrors - currentErrors 
      : 'N/A';
    console.log(`   Errors reduced by: ${reduction}`);
  }
});

// Final summary
console.log('\n' + '='.repeat(50));
console.log('📊 Final TypeScript Error Count:');
const finalErrors = checkTypeScriptErrors();

if (typeof initialErrors === 'number' && typeof finalErrors === 'number') {
  const totalReduction = initialErrors - finalErrors;
  const percentReduction = ((totalReduction / initialErrors) * 100).toFixed(1);
  
  console.log(`\n✨ Summary:`);
  console.log(`   Initial errors: ${initialErrors}`);
  console.log(`   Final errors: ${finalErrors}`);
  console.log(`   Total reduced: ${totalReduction} (${percentReduction}%)`);
}

if (finalErrors === 0) {
  console.log('\n🎉 All TypeScript errors resolved!');
} else {
  console.log('\n⚠️  Some errors remain. Manual intervention may be required.');
  console.log('   Check TYPESCRIPT_ERROR_RESOLUTION_PLAN.md for next steps.');
}

process.exit(finalErrors === 0 ? 0 : 1);