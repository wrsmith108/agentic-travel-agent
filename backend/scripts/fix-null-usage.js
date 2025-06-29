#!/usr/bin/env node

/**
 * Script to fix 'null cannot be used here' errors (TS18050)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to find and fix
const patterns = [
  {
    // Fix null.map() patterns
    pattern: /:\s*null\.map\(/g,
    replacement: ': [].map('
  },
  {
    // Fix null.filter() patterns
    pattern: /:\s*null\.filter\(/g,
    replacement: ': [].filter('
  },
  {
    // Fix ternary with null that should be []
    pattern: /\?\s*(\w+\.value)\s*:\s*null\.map\(/g,
    replacement: '? $1 : [].map('
  },
  {
    // Fix (condition) ? value : null where null is being used inappropriately
    pattern: /(\w+)\s*\?\s*(\w+\.value)\s*:\s*null(?=\s*[;,)])/g,
    replacement: (match, condition, value) => {
      // Context-specific replacement
      return `${condition} ? ${value} : undefined`;
    }
  }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  patterns.forEach(({ pattern, replacement }) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
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

console.log(`\n✨ Fixed ${totalFixed} files with null usage issues`);