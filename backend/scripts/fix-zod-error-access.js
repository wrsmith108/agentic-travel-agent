#!/usr/bin/env node
const fs = require('fs');
const glob = require('glob');
const path = require('path');

function fixZodErrorAccess(content) {
  let changeCount = 0;
  let fixed = content;
  
  // Fix .errors access on AppError
  fixed = fixed.replace(/validationResult\.error(.*?)\.errors/g, (match) => {
    changeCount++;
    return 'validationResult.error$1.details?.errors || []';
  });
  
  fixed = fixed.replace(/\(isErr\(validationResult\) \? validationResult\.error : undefined\)\.errors/g, (match) => {
    changeCount++;
    return '(isErr(validationResult) ? validationResult.error.details?.errors : [])';
  });
  
  // Fix .code access (should be .errorCode)
  fixed = fixed.replace(/result\.error\.code/g, (match) => {
    changeCount++;
    return 'result.error.errorCode';
  });
  
  // Fix complex error code patterns
  fixed = fixed.replace(/\(isErr\(result\) \? \(isErr\(result\) \? result\.error\.code : ""\) : ""\)/g, (match) => {
    changeCount++;
    return '(isErr(result) ? result.error.errorCode : "UNKNOWN_ERROR")';
  });
  
  fixed = fixed.replace(/\(isErr\(result\) \? \(isErr\(result\) \? result\.error\.message : ""\) : ""\)/g, (match) => {
    changeCount++;
    return '(isErr(result) ? result.error.message : "An error occurred")';
  });
  
  // Fix standalone .code access patterns
  fixed = fixed.replace(/error\.code/g, (match, offset) => {
    // Check if it's in the context of error object from catch blocks
    const before = fixed.substring(Math.max(0, offset - 50), offset);
    if (before.includes('catch') || before.includes('error:')) {
      changeCount++;
      return '(error as any).code';
    }
    return match;
  });
  
  return { fixed, changeCount };
}

const files = glob.sync('src/routes/**/*.ts');
let totalChanges = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const { fixed, changeCount } = fixZodErrorAccess(content);
  
  if (changeCount > 0) {
    fs.writeFileSync(file, fixed, 'utf8');
    console.log(`✅ Fixed ${changeCount} Zod error access patterns in ${path.basename(file)}`);
    totalChanges += changeCount;
  }
});

console.log(`\n✨ Total fixes: ${totalChanges} across ${files.length} files`);