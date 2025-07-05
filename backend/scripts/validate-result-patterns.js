#!/usr/bin/env node

/**
 * Result Pattern Validation Script
 * Detects and prevents Result pattern violations that lead to TypeScript errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Pattern violations to detect
const VIOLATIONS = [
  {
    name: 'Direct value access',
    pattern: /\\.value(?!\\s*\\?)/g,
    message: 'Direct .value access detected. Use isOk() guard first.'
  },
  {
    name: 'Direct error access',
    pattern: /\\.error(?!\\s*\\?)/g,
    message: 'Direct .error access detected. Use isErr() guard first.'
  },
  {
    name: 'Success property usage',
    pattern: /\\.success/g,
    message: 'Legacy .success property detected. Use isOk() instead.'
  },
  {
    name: 'Data property usage',
    pattern: /\\.data(?!\\s*\\?)/g,
    message: 'Legacy .data property detected. Use .value with isOk() guard.'
  }
];

// Files to check
const SOURCE_DIRS = [
  'backend/src/services',
  'backend/src/routes',
  'backend/src/middleware',
  'backend/src/utils'
];

function findFiles(dir, extensions = ['.ts', '.js']) {
  const files = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\\n');
  const violations = [];
  
  for (const violation of VIOLATIONS) {
    let match;
    while ((match = violation.pattern.exec(content)) !== null) {
      const lineIndex = content.substring(0, match.index).split('\\n').length - 1;
      const line = lines[lineIndex];
      
      // Skip if within proper guard block
      if (isWithinGuardBlock(content, match.index)) {
        continue;
      }
      
      violations.push({
        type: violation.name,
        message: violation.message,
        line: lineIndex + 1,
        content: line.trim(),
        file: filePath
      });
    }
    
    // Reset regex for next iteration
    violation.pattern.lastIndex = 0;
  }
  
  return violations;
}

function isWithinGuardBlock(content, index) {
  // Look backwards for isOk() or isErr() guards
  const beforeIndex = content.substring(0, index);
  const lines = beforeIndex.split('\\n');
  
  // Check last 5 lines for guard patterns
  const checkLines = lines.slice(-5);
  const guardPattern = /if\\s*\\(\\s*is(Ok|Err)\\s*\\(/;
  
  return checkLines.some(line => guardPattern.test(line));
}

function main() {
  console.log('🔍 Validating Result pattern usage...');
  
  let totalViolations = 0;
  const allFiles = [];
  
  // Collect all files to check
  for (const dir of SOURCE_DIRS) {
    allFiles.push(...findFiles(dir));
  }
  
  console.log(`📁 Checking ${allFiles.length} files...`);
  
  for (const file of allFiles) {
    const violations = validateFile(file);
    
    if (violations.length > 0) {
      console.log(`\\n❌ ${file}:`);
      
      for (const violation of violations) {
        console.log(`  Line ${violation.line}: ${violation.message}`);
        console.log(`    ${violation.content}`);
      }
      
      totalViolations += violations.length;
    }
  }
  
  if (totalViolations > 0) {
    console.log(`\\n🚨 Found ${totalViolations} Result pattern violations!`);
    console.log(`📋 Please fix these violations before committing.`);
    console.log(`📖 Refer to /backend/docs/TYPESCRIPT_ERROR_PREVENTION.md for patterns.`);
    process.exit(1);
  }
  
  console.log('✅ All Result pattern validations passed!');
  process.exit(0);
}

if (require.main === module) {
  main();
}