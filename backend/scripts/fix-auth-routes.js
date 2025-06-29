#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Auth Routes to use Result pattern');
console.log('==========================================\n');

// Map old method names to new ones
const methodMappings = {
  'registerUser': 'register',
  'loginUser': 'login',
  'logoutUser': 'logout',
  'resetPassword': 'resetPassword',
  'requestPasswordReset': 'requestPasswordReset'
};

const files = [
  'src/routes/auth.ts',
  'src/routes/authNew.ts',
  'src/routes/authWithResult.ts'
];

function fixAuthRoute(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix 1: Update method names
  Object.entries(methodMappings).forEach(([oldMethod, newMethod]) => {
    const pattern = new RegExp(`authService\\.${oldMethod}\\(`, 'g');
    if (pattern.test(content)) {
      content = content.replace(pattern, `authService.${newMethod}(`);
      modified = true;
    }
  });
  
  // Fix 2: Replace success/error pattern with Result pattern
  // Pattern: if (result.success) { ... } else { ... }
  const successPattern = /if\s*\(\s*result\.success\s*\)\s*{([^}]*(?:{[^}]*}[^}]*)*)}\s*else\s*{([^}]*(?:{[^}]*}[^}]*)*)}/g;
  
  content = content.replace(successPattern, (match, successBlock, errorBlock) => {
    // Update success block
    let newSuccessBlock = successBlock
      .replace(/const\s+successResult\s*=\s*result\s+as\s+AuthSuccessResponse;?/g, '')
      .replace(/successResult\.data\.user\./g, 'result.value.user.')
      .replace(/successResult\.data\./g, 'result.value.')
      .replace(/res\.status\((\d+)\)\.json\(result\)/g, 'res.status($1).json({ success: true, data: result.value })');
    
    // Update error block
    let newErrorBlock = errorBlock
      .replace(/const\s+errorResult\s*=\s*result\s+as\s+AuthErrorResponse;?/g, '')
      .replace(/\(isErr\(errorResult\)\s*\?\s*errorResult\.error\.type\s*:\s*""\)/g, 'result.error.type')
      .replace(/\(isErr\(errorResult\)\s*\?\s*\(isErr\(errorResult\)\s*\?\s*errorResult\.error\.message\s*:\s*""\)\s*:\s*""\)/g, 'result.error.message')
      .replace(/errorResult\.error\./g, 'result.error.')
      .replace(/res\.status\((\w+)\)\.json\(result\)/g, 'res.status($1).json({ success: false, error: result.error })');
    
    return `if (!isErr(result)) {${newSuccessBlock}} else {${newErrorBlock}}`;
  });
  
  // Fix 3: Fix requestPasswordReset special case (returns message, not full auth response)
  const resetPattern = /if\s*\(\s*response\.success\s*\)\s*{([^}]+)}\s*else\s*{([^}]+response\.message[^}]+)}/g;
  
  content = content.replace(resetPattern, (match, successBlock, errorBlock) => {
    if (match.includes('requestPasswordReset')) {
      let newSuccessBlock = successBlock
        .replace(/response\./g, 'result.value.');
      let newErrorBlock = errorBlock
        .replace(/response\./g, 'result.error.');
      return `if (!isErr(result)) {${newSuccessBlock}} else {${newErrorBlock}}`;
    }
    return match;
  });
  
  // Fix 4: Update error type checking
  content = content.replace(/\(isErr\(result\)\s*\?\s*result\.error\s*:\s*""\)/g, 'result.error');
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

// Main
let fixedCount = 0;

files.forEach(file => {
  if (fixAuthRoute(file)) {
    fixedCount++;
  }
});

console.log(`\n✨ Fixed ${fixedCount} files`);