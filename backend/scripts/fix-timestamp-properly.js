#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing Timestamp Usage Properly');
console.log('==================================\n');

// Fix patterns for timestamp usage
const timestampFixes = [
  // Revert bad fixes first
  { 
    pattern: /new Date\(\) as string/g, 
    replacement: 'new Date().toISOString()' 
  },
  { 
    pattern: /Date as string/g, 
    replacement: 'Date().toISOString()' 
  },
  // Fix timestamp property access
  {
    pattern: /(\w+)\? as string as Timestamp/g,
    replacement: '$1 as Timestamp'
  },
  // Fix timestamp assignments
  {
    pattern: /= new Date\(\)\.toISOString\(\)/g,
    replacement: '= createTimestamp()'
  },
  // Fix timestamp in object literals
  {
    pattern: /timestamp: new Date\(\)\.toISOString\(\)/g,
    replacement: 'timestamp: createTimestamp()'
  },
  {
    pattern: /createdAt: new Date\(\)\.toISOString\(\)/g,
    replacement: 'createdAt: createTimestamp()'
  },
  {
    pattern: /updatedAt: new Date\(\)\.toISOString\(\)/g,
    replacement: 'updatedAt: createTimestamp()'
  },
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const appliedFixes = [];
  
  // Apply timestamp fixes
  timestampFixes.forEach(({ pattern, replacement }) => {
    const before = content;
    content = content.replace(pattern, replacement);
    if (before !== content) {
      modified = true;
      appliedFixes.push(`Pattern: ${pattern.source}`);
    }
  });
  
  // Add createTimestamp import if needed
  if (modified && content.includes('createTimestamp()') && !content.includes('import { createTimestamp')) {
    // Check if there's already an import from types
    const typesImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]\.(\.)?\/.*?types['"]/);
    if (typesImportMatch) {
      const imports = typesImportMatch[1].split(',').map(s => s.trim());
      if (!imports.includes('createTimestamp')) {
        imports.push('createTimestamp');
        const newImport = `import { ${imports.join(', ')} } from ${typesImportMatch[0].match(/from\s*(['"]\.(\.)?\/.*?types['"])/)[1]}`;
        content = content.replace(typesImportMatch[0], newImport);
      }
    } else {
      // Add new import
      const firstImport = content.match(/^import.*$/m);
      if (firstImport) {
        content = content.replace(firstImport[0], firstImport[0] + '\nimport { createTimestamp } from \'@/services/auth/functional/types\';');
      }
    }
  }
  
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