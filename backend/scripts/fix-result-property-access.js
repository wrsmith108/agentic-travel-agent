#!/usr/bin/env node

/**
 * Script to fix direct property access on Result types
 * Addresses TS2339: Property 'error'/'value' does not exist on type 'Result'
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to find and fix
const patterns = [
  {
    // Fix direct .error access without type guard
    pattern: /(\w+)\.error(?![a-zA-Z])/g,
    replacement: (match, varName, offset, fullString) => {
      // Check if this is inside an if statement with proper guard
      const beforeMatch = fullString.substring(Math.max(0, offset - 100), offset);
      if (beforeMatch.includes(`isErr(${varName})`) || beforeMatch.includes(`!${varName}.ok`)) {
        return match; // Already guarded
      }
      // Check if it's a Result variable name
      if (varName.endsWith('Result') || varName.endsWith('Response')) {
        return `(isErr(${varName}) ? ${varName}.error : undefined)`;
      }
      return match;
    }
  },
  {
    // Fix direct .value access without type guard
    pattern: /(\w+)\.value(?![a-zA-Z])/g,
    replacement: (match, varName, offset, fullString) => {
      // Check if this is inside an if statement with proper guard
      const beforeMatch = fullString.substring(Math.max(0, offset - 100), offset);
      if (beforeMatch.includes(`isOk(${varName})`) || beforeMatch.includes(`${varName}.ok`)) {
        return match; // Already guarded
      }
      // Check if it's a Result variable name
      if (varName.endsWith('Result') || varName.endsWith('Response')) {
        return `(isOk(${varName}) ? ${varName}.value : undefined)`;
      }
      return match;
    }
  },
  {
    // Fix searchResults property on cache result
    pattern: /const cached = await[^;]+;[\s\n]+return cached\.searchResults/g,
    replacement: (match) => {
      return match.replace('return cached.searchResults', 'return isOk(cached) ? cached.value : []');
    }
  },
  {
    // Fix .entries() on Promise<Map>
    pattern: /(\w+)\.entries\(\)/g,
    replacement: (match, varName, offset, fullString) => {
      // Check if it's being awaited
      const beforeMatch = fullString.substring(Math.max(0, offset - 50), offset);
      if (beforeMatch.includes('await') && !beforeMatch.includes('(await')) {
        return `(await ${varName}).entries()`;
      }
      return match;
    }
  }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file imports isOk/isErr
  let hasIsOk = content.includes('isOk');
  let hasIsErr = content.includes('isErr');
  
  patterns.forEach(({ pattern, replacement }) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
      
      // Check if we need to add imports
      if (content.includes('isOk(') && !hasIsOk) {
        content = content.replace(
          /import\s*{\s*Result(?:,\s*ok)?(?:,\s*err)?\s*}\s*from\s*['"]@\/utils\/result['"]/,
          (match) => {
            const imports = ['Result'];
            if (match.includes('ok')) imports.push('ok');
            if (match.includes('err')) imports.push('err');
            imports.push('isOk');
            return `import { ${imports.join(', ')} } from '@/utils/result'`;
          }
        );
        hasIsOk = true;
      }
      
      if (content.includes('isErr(') && !hasIsErr) {
        content = content.replace(
          /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@\/utils\/result['"]/,
          (match, imports) => {
            const importList = imports.split(',').map(i => i.trim());
            if (!importList.includes('isErr')) {
              importList.push('isErr');
            }
            return `import { ${importList.join(', ')} } from '@/utils/result'`;
          }
        );
        hasIsErr = true;
      }
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

console.log(`\n✨ Fixed ${totalFixed} files with Result property access issues`);