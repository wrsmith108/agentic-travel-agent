#!/usr/bin/env node

/**
 * Script to fix Date to string conversion errors by using createTimestamp()
 * Addresses TypeScript error TS2352: Conversion of type 'Date' to type 'string' may be a mistake
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to find and replace
const patterns = [
  {
    // Direct Date cast to string: new Date() as string
    pattern: /new\s+Date\(\)\s+as\s+string/g,
    replacement: 'createTimestamp()'
  },
  {
    // Date cast in property: createdAt: new Date() as string
    pattern: /:\s*new\s+Date\(\)\s+as\s+string/g,
    replacement: ': createTimestamp()'
  },
  {
    // Timestamp properties with Date cast
    pattern: /(createdAt|updatedAt|lastAccessedAt|expiresAt|timestamp):\s*new\s+Date\(\)\s+as\s+string/g,
    replacement: '$1: createTimestamp()'
  },
  {
    // Variable assignment with Date cast
    pattern: /=\s*new\s+Date\(\)\s+as\s+string/g,
    replacement: '= createTimestamp()'
  },
  {
    // Date with specific value cast to string
    pattern: /new\s+Date\(([^)]+)\)\s+as\s+string/g,
    replacement: (match, dateValue) => {
      // For complex date expressions, use toISOString()
      return `new Date(${dateValue}).toISOString()`;
    }
  },
  {
    // Property access cast to string: value.createdAt as string
    pattern: /(\w+\.\w+\.(createdAt|updatedAt|lastAccessedAt|expiresAt|timestamp|lastLoginAt|tokenExpiry))\s+as\s+string/g,
    replacement: '$1'
  },
  {
    // Simple property cast to string: createdAt as string
    pattern: /\b(createdAt|updatedAt|lastAccessedAt|expiresAt|timestamp|lastLoginAt|tokenExpiry)\s+as\s+string/g,
    replacement: '$1'
  }
];

// Import statement to add if not present
const importStatement = `import { createTimestamp } from '@/services/auth/functional/types';`;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let needsImport = false;

  // Apply all patterns
  patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      modified = true;
      // Check if we're using createTimestamp and need import
      const replacementStr = typeof replacement === 'function' ? 
        replacement(matches[0], matches[1] || '') : replacement;
      if (replacementStr.includes('createTimestamp')) {
        needsImport = true;
      }
    }
  });

  // Add import if needed and not already present
  if (needsImport && !content.includes("from '@/services/auth/functional/types'")) {
    // Find the right place to add import (after other imports)
    const importMatch = content.match(/^(import[\s\S]*?)\n\n/m);
    if (importMatch) {
      content = content.replace(importMatch[0], importMatch[0].trimEnd() + '\n' + importStatement + '\n\n');
    } else {
      // Add at the beginning if no imports found
      content = importStatement + '\n\n' + content;
    }
    modified = true;
  }

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

console.log(`\n✨ Fixed ${totalFixed} files with Date to string conversion issues`);