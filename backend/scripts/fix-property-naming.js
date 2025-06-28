#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing Property Naming Inconsistencies');
console.log('========================================\n');

// Property name mappings (old -> new)
const propertyMappings = [
  // Boolean properties that should have 'is' prefix
  { pattern: /\.emailVerified/g, replacement: '.isEmailVerified' },
  { pattern: /\.accountLocked/g, replacement: '.isAccountLocked' },
  { pattern: /\.accountSuspended/g, replacement: '.isAccountSuspended' },
  { pattern: /emailVerified:/g, replacement: 'isEmailVerified:' },
  { pattern: /accountLocked:/g, replacement: 'isAccountLocked:' },
  { pattern: /accountSuspended:/g, replacement: 'isAccountSuspended:' },
  
  // Type property fixes
  { pattern: /type AccountStatus = \{([^}]*?)emailVerified/g, replacement: 'type AccountStatus = {$1isEmailVerified' },
  { pattern: /type AccountStatus = \{([^}]*?)accountLocked/g, replacement: 'type AccountStatus = {$1isAccountLocked' },
  { pattern: /type AccountStatus = \{([^}]*?)accountSuspended/g, replacement: 'type AccountStatus = {$1isAccountSuspended' },
  
  // Interface property fixes
  { pattern: /interface AccountStatus \{([^}]*?)emailVerified/g, replacement: 'interface AccountStatus {$1isEmailVerified' },
  { pattern: /interface AccountStatus \{([^}]*?)accountLocked/g, replacement: 'interface AccountStatus {$1isAccountLocked' },
  { pattern: /interface AccountStatus \{([^}]*?)accountSuspended/g, replacement: 'interface AccountStatus {$1isAccountSuspended' },
];

// Timestamp method fixes
const timestampFixes = [
  { pattern: /\.toISOString\(\)/g, replacement: ' as string' },
  { pattern: /timestamp\.toISOString/g, replacement: 'timestamp as string' },
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const appliedFixes = [];
  
  // Apply property mappings
  propertyMappings.forEach(({ pattern, replacement }) => {
    const before = content;
    content = content.replace(pattern, replacement);
    if (before !== content) {
      modified = true;
      appliedFixes.push(`Property: ${pattern.source}`);
    }
  });
  
  // Apply timestamp fixes
  timestampFixes.forEach(({ pattern, replacement }) => {
    const before = content;
    content = content.replace(pattern, replacement);
    if (before !== content) {
      modified = true;
      appliedFixes.push(`Timestamp: ${pattern.source}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    appliedFixes.forEach(fix => console.log(`   - ${fix}`));
    return true;
  }
  
  return false;
}

// Main
const files = glob.sync('src/**/*.ts', {
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
});

let fixed = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\n✨ Fixed ${fixed} files`);