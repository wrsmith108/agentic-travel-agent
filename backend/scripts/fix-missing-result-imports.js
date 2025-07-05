#!/usr/bin/env node

/**
 * Script to add missing isErr/isOk imports
 * Fixes TS2304: Cannot find name 'isErr'/'isOk'
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file uses isErr or isOk without importing them
  const usesIsErr = content.includes('isErr(');
  const usesIsOk = content.includes('isOk(');
  
  if (!usesIsErr && !usesIsOk) {
    return 0; // File doesn't use these functions
  }
  
  // Check current imports
  const hasIsErrImport = content.includes('isErr') && content.includes("from '@/utils/result'");
  const hasIsOkImport = content.includes('isOk') && content.includes("from '@/utils/result'");
  
  // Find existing Result import
  const resultImportMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]@\/utils\/result['"]/);
  
  if (resultImportMatch) {
    // Parse existing imports
    const imports = resultImportMatch[1].split(',').map(i => i.trim());
    const needsIsErr = usesIsErr && !imports.includes('isErr');
    const needsIsOk = usesIsOk && !imports.includes('isOk');
    
    if (needsIsErr || needsIsOk) {
      // Add missing imports
      if (needsIsErr && !imports.includes('isErr')) imports.push('isErr');
      if (needsIsOk && !imports.includes('isOk')) imports.push('isOk');
      
      // Ensure standard order: Result, ok, err, isOk, isErr
      const orderedImports = [];
      if (imports.includes('Result')) orderedImports.push('Result');
      if (imports.includes('ok')) orderedImports.push('ok');
      if (imports.includes('err')) orderedImports.push('err');
      if (imports.includes('isOk')) orderedImports.push('isOk');
      if (imports.includes('isErr')) orderedImports.push('isErr');
      
      // Add any other imports that might exist
      imports.forEach(imp => {
        if (!orderedImports.includes(imp)) {
          orderedImports.push(imp);
        }
      });
      
      const newImport = `import { ${orderedImports.join(', ')} } from '@/utils/result'`;
      content = content.replace(resultImportMatch[0], newImport);
      modified = true;
    }
  } else if (usesIsErr || usesIsOk) {
    // No Result import exists, need to add one
    const importsNeeded = [];
    if (content.includes('Result<')) importsNeeded.push('Result');
    if (content.includes('ok(')) importsNeeded.push('ok');
    if (content.includes('err(')) importsNeeded.push('err');
    if (usesIsOk) importsNeeded.push('isOk');
    if (usesIsErr) importsNeeded.push('isErr');
    
    if (importsNeeded.length > 0) {
      // Find a good place to add the import (after other imports)
      const importRegex = /^import\s+.*$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;
        
        const newImport = `\nimport { ${importsNeeded.join(', ')} } from '@/utils/result';`;
        content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
        modified = true;
      } else {
        // No imports found, add at the beginning
        content = `import { ${importsNeeded.join(', ')} } from '@/utils/result';\n\n` + content;
        modified = true;
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed imports in: ${filePath}`);
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

console.log(`\n✨ Fixed ${totalFixed} files with missing Result imports`);