#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Pattern to fix imports from ./types or ../types to @/utils/result
const patterns = [
  // Import statements with ok, err, isOk, isErr from ./types or ../types
  {
    pattern: /import\s*{\s*([^}]*(?:ok|err|isOk|isErr)[^}]*)\s*}\s*from\s*['"]\.(\.)?\/types['"]/g,
    handler: (match, imports, doubleDot) => {
      const importList = imports.split(',').map(i => i.trim());
      const resultImports = [];
      const otherImports = [];
      
      importList.forEach(imp => {
        if (['ok', 'err', 'isOk', 'isErr'].includes(imp)) {
          resultImports.push(imp);
        } else {
          otherImports.push(imp);
        }
      });
      
      let result = '';
      if (resultImports.length > 0) {
        result += `import { ${resultImports.join(', ')} } from '@/utils/result';\n`;
      }
      if (otherImports.length > 0) {
        result += `import { ${otherImports.join(', ')} } from '.${doubleDot || ''}/types'`;
      }
      
      return result.trim();
    }
  },
  // Separate import lines for Result utilities
  {
    pattern: /import\s*{\s*(ok|err|isOk|isErr)\s*}\s*from\s*['"]\.(\.)?\/types['"]/g,
    replacement: "import { $1 } from '@/utils/result'"
  }
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  patterns.forEach(({ pattern, handler, replacement }) => {
    if (handler) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const newImport = handler(match, ...match.match(pattern).slice(1));
          content = content.replace(match, newImport);
          modified = true;
        });
      }
    } else if (replacement) {
      const before = content;
      content = content.replace(pattern, replacement);
      if (before !== content) {
        modified = true;
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  
  return false;
}

// Main
console.log('🔧 Fixing Result imports...\n');

const files = glob.sync('src/services/auth/functional/**/*.ts', {
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts']
});

let fixed = 0;
files.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\n✨ Fixed ${fixed} files`);