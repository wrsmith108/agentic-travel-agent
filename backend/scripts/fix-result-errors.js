#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Fix patterns for Result type usage
const fixes = [
  // Pattern: if (result.error) -> if (isErr(result))
  {
    pattern: /if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\)/g,
    replacement: 'if (isErr($1))'
  },
  // Pattern: if (!result.error) -> if (isOk(result))
  {
    pattern: /if\s*\(\s*!\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\)/g,
    replacement: 'if (isOk($1))'
  },
  // Pattern: result.error || -> isErr(result) ? result.error :
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\|\|/g,
    replacement: '(isErr($1) ? $1.error :'
  },
  // Pattern: handle && in conditions
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*&&/g,
    replacement: 'isErr($1) &&'
  },
  // Pattern: return result.error ? -> return isErr(result) ?
  {
    pattern: /return\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\?/g,
    replacement: 'return isErr($1) ?'
  },
  // Pattern: const/let/var x = result.error -> const/let/var x = isErr(result) ? result.error : null
  {
    pattern: /(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error(?![a-zA-Z])/g,
    replacement: '$1 $2 = isErr($3) ? $3.error : null'
  },
  // Pattern: throw result.error -> if (isErr(result)) throw result.error
  {
    pattern: /throw\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: 'if (isErr($1)) throw $1.error; throw new Error("Unexpected ok result")'
  }
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply all fixes
  fixes.forEach(fix => {
    if (fix.pattern.test(content)) {
      content = content.replace(fix.pattern, fix.replacement);
      modified = true;
    }
  });
  
  // Add missing imports if needed
  if (modified && !content.includes('isOk') && !content.includes('isErr')) {
    // Skip if it's a test file or the result.ts file itself
    if (!filePath.includes('.test.') && !filePath.endsWith('/result.ts')) {
      // Find existing import from result
      const resultImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"].*?\/result['"]/);
      if (resultImportMatch) {
        const imports = resultImportMatch[1].split(',').map(s => s.trim());
        if (!imports.includes('isOk')) imports.push('isOk');
        if (!imports.includes('isErr')) imports.push('isErr');
        const newImport = `import { ${imports.join(', ')} } from ${resultImportMatch[0].match(/from\s*(['"].*?['"])/)[1]}`;
        content = content.replace(resultImportMatch[0], newImport);
      } else {
        // Add new import after first import
        const firstImport = content.match(/^import.*$/m);
        if (firstImport) {
          content = content.replace(firstImport[0], firstImport[0] + '\nimport { isOk, isErr } from \'@/utils/result\';');
        }
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

// Main
console.log('🔧 Fixing Result type errors...\n');

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