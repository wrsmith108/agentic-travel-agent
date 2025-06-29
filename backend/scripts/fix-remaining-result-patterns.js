#!/usr/bin/env node

/**
 * Script to fix remaining Result type patterns
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to find and fix
const patterns = [
  {
    // Fix .ok property checks to use isErr() function
    pattern: /if\s*\(\s*!(\w+)\.ok\s*\)\s*\{/g,
    replacement: (match, varName) => `if (isErr(${varName})) {`
  },
  {
    // Fix return statements that return whole Result when they should return error
    pattern: /return\s+(\w+Result)\s*;(\s*\/\/.*)?$/gm,
    replacement: (match, varName, comment) => {
      // Only replace if it looks like an error return in an if block
      if (match.includes('Result')) {
        return `return err(${varName}.error);${comment || ''}`;
      }
      return match;
    }
  },
  {
    // Fix expiresAt casting issues
    pattern: /expiresAt:\s*expiresAt\s*as\s*string/g,
    replacement: 'expiresAt: expiresAt'
  },
  {
    // Fix timestamp property casting
    pattern: /(\w+):\s*(\w+)\s*as\s*string,?\s*\/\/\s*timestamp/g,
    replacement: '$1: $2'
  }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Only process TypeScript files in specific directories
  if (!filePath.includes('/services/') && !filePath.includes('/routes/')) {
    return 0;
  }

  // Check if file imports isErr
  const hasIsErr = content.includes('isErr');
  
  patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      // For patterns that need isErr, ensure import exists
      if (pattern.toString().includes('isErr') && !hasIsErr) {
        // Add isErr to existing Result import if possible
        content = content.replace(
          /import\s*{\s*Result,\s*ok,\s*err\s*}\s*from\s*['"]@\/utils\/result['"]/,
          "import { Result, ok, err, isErr } from '@/utils/result'"
        );
      }
      
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
    return 1;
  }
  return 0;
}

// Find all TypeScript files
const files = glob.sync('src/**/*.ts', { 
  cwd: path.join(__dirname, '..'),
  absolute: true,
  ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts']
});

console.log(`Found ${files.length} TypeScript files to check...`);

let totalFixed = 0;
files.forEach(file => {
  totalFixed += processFile(file);
});

console.log(`\n✨ Fixed ${totalFixed} files with Result pattern issues`);