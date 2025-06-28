#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// More comprehensive patterns for Result type usage
const fixes = [
  // Pattern: result.error after !result.ok check
  {
    pattern: /(!([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.ok\s*\)\s*{[^}]*?)\2\.error/g,
    replacement: (match, prefix, varName) => {
      return `${prefix}(${varName} as any).error`;
    }
  },
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
  // Pattern: && result.error
  {
    pattern: /&&\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: '&& isErr($1)'
  },
  // Pattern: return result.error -> return isErr(result) ? result.error : null
  {
    pattern: /return\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error(?![a-zA-Z])/g,
    replacement: 'return isErr($1) ? $1.error : null'
  },
  // Pattern: console.* result.error
  {
    pattern: /(console\.[a-zA-Z]+\([^,)]*,\s*)([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: '$1isErr($2) ? $2.error : $2'
  },
  // Pattern: property access after .error
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\.(message|code|stack)/g,
    replacement: '(isErr($1) ? $1.error.$2 : "")'
  }
];

// Special handling for !result.ok patterns
function fixNotOkPatterns(content) {
  // Replace !result.ok checks where .error is accessed later
  const notOkPattern = /if\s*\(\s*!([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.ok\s*\)\s*{([^}]+)}/g;
  
  return content.replace(notOkPattern, (match, varName, body) => {
    // Check if the body contains varName.error
    if (body.includes(`${varName}.error`)) {
      // Replace the condition to use isErr
      const newCondition = `if (isErr(${varName})) {`;
      return newCondition + body + '}';
    }
    return match;
  });
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // First, handle !result.ok patterns
  const fixedContent = fixNotOkPatterns(content);
  if (fixedContent !== content) {
    content = fixedContent;
    modified = true;
  }
  
  // Apply all other fixes
  fixes.forEach(fix => {
    const before = content;
    content = content.replace(fix.pattern, fix.replacement);
    if (before !== content) {
      modified = true;
    }
  });
  
  // Add missing imports if needed
  if (modified && (content.includes('isOk(') || content.includes('isErr(')) && !content.includes('import { isOk, isErr }') && !content.includes('import {isOk, isErr}')) {
    // Skip if it's a test file or the result.ts file itself
    if (!filePath.includes('.test.') && !filePath.includes('.spec.') && !filePath.endsWith('/result.ts')) {
      // Find existing import from result
      const resultImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"].*?\/result['"]/);
      if (resultImportMatch) {
        const imports = resultImportMatch[1].split(',').map(s => s.trim());
        const needsIsOk = content.includes('isOk(') && !imports.includes('isOk');
        const needsIsErr = content.includes('isErr(') && !imports.includes('isErr');
        
        if (needsIsOk) imports.push('isOk');
        if (needsIsErr) imports.push('isErr');
        
        const newImport = `import { ${imports.join(', ')} } from ${resultImportMatch[0].match(/from\s*(['"].*?['"])/)[1]}`;
        content = content.replace(resultImportMatch[0], newImport);
      } else {
        // Add new import after first import
        const firstImport = content.match(/^import.*$/m);
        if (firstImport) {
          const imports = [];
          if (content.includes('isOk(')) imports.push('isOk');
          if (content.includes('isErr(')) imports.push('isErr');
          if (imports.length > 0) {
            content = content.replace(firstImport[0], firstImport[0] + '\nimport { ' + imports.join(', ') + ' } from \'@/utils/result\';');
          }
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
console.log('🔧 Fixing Result type patterns...\n');

const files = glob.sync('src/**/*.ts', {
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', 'src/scripts/**']
});

let fixed = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\n✨ Fixed ${fixed} files`);