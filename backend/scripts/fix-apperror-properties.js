#!/usr/bin/env node
const fs = require('fs');
const glob = require('glob');
const path = require('path');

function fixAppErrorProperties(content) {
  let changeCount = 0;
  let fixed = content;
  
  // Fix errorCode -> code
  fixed = fixed.replace(/\.errorCode/g, (match, offset) => {
    const before = content.substring(Math.max(0, offset - 50), offset);
    // Check if this is in the context of AppError
    if (before.includes('error') || before.includes('result')) {
      changeCount++;
      return '.code';
    }
    return match;
  });
  
  // Fix specific patterns where we access error.errorCode
  fixed = fixed.replace(/error\.errorCode/g, (match) => {
    changeCount++;
    return 'error.code';
  });
  
  // Fix patterns like result.error.errorCode
  fixed = fixed.replace(/result\.error\.errorCode/g, (match) => {
    changeCount++;
    return 'result.error.code';
  });
  
  // Fix validationResult.error.errorCode
  fixed = fixed.replace(/validationResult\.error\.errorCode/g, (match) => {
    changeCount++;
    return 'validationResult.error.code';
  });
  
  // Fix the pattern (result.error as any).errorCode
  fixed = fixed.replace(/\(result\.error as any\)\.errorCode/g, (match) => {
    changeCount++;
    return '(result.error as any).code';
  });
  
  // Fix the pattern (validationResult.error as any).errorCode
  fixed = fixed.replace(/\(validationResult\.error as any\)\.errorCode/g, (match) => {
    changeCount++;
    return '(validationResult.error as any).code';
  });
  
  // Fix AppError construction that uses errorCode parameter
  // Convert new AppError(status, message, errorCode) to new AppError(status, message, code)
  fixed = fixed.replace(/new AppError\(([^,]+),([^,]+),\s*ErrorCodes\.([A-Z_]+)\)/g, (match, status, message, errorCode) => {
    changeCount++;
    return `new AppError(${status},${message}, ErrorCodes.${errorCode})`;
  });
  
  return { fixed, changeCount };
}

// Process all TypeScript files
const patterns = [
  'src/**/*.ts',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts'
];

let totalChanges = 0;
let filesFixed = 0;

console.log('Fixing AppError property access...\n');

patterns.forEach(pattern => {
  const files = glob.sync(pattern);
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const { fixed, changeCount } = fixAppErrorProperties(content);
    
    if (changeCount > 0) {
      fs.writeFileSync(file, fixed, 'utf8');
      console.log(`✅ Fixed ${changeCount} AppError property access in ${path.basename(file)}`);
      totalChanges += changeCount;
      filesFixed++;
    }
  });
});

console.log(`\n✨ Total: Fixed ${totalChanges} AppError properties across ${filesFixed} files`);