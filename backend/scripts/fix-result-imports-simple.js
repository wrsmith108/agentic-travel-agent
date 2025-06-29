#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file imports ok, err, isOk, or isErr from ./types
  const typeImportRegex = /import\s*{([^}]+)}\s*from\s*['"](\.\.?\/types)['"]/g;
  
  const newContent = content.replace(typeImportRegex, (match, imports, importPath) => {
    const importItems = imports.split(',').map(i => i.trim());
    const resultItems = ['ok', 'err', 'isOk', 'isErr'];
    
    const resultImports = importItems.filter(item => resultItems.includes(item));
    const otherImports = importItems.filter(item => !resultItems.includes(item));
    
    if (resultImports.length === 0) {
      return match; // No Result imports, keep as is
    }
    
    modified = true;
    
    let replacement = '';
    if (resultImports.length > 0) {
      replacement += `import { ${resultImports.join(', ')} } from '@/utils/result';\n`;
    }
    if (otherImports.length > 0) {
      replacement += `import { ${otherImports.join(', ')} } from '${importPath}'`;
    }
    
    return replacement.trim();
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
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