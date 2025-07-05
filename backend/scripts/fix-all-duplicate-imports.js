#!/usr/bin/env node
const fs = require('fs');
const glob = require('glob');
const path = require('path');

function fixDuplicateImports(content, fileName) {
  const lines = content.split('\n');
  const importMap = new Map();
  const otherLines = [];
  let changeCount = 0;
  
  // Collect all imports and their line numbers
  lines.forEach((line, index) => {
    if (line.includes('import') && line.includes('from')) {
      // Extract the module being imported from
      const fromMatch = line.match(/from\s+['"](.+)['"]/);
      if (fromMatch) {
        const module = fromMatch[1];
        
        // Check if this is a Result-related import
        if ((line.includes('Result') || line.includes('ok') || line.includes('err') || 
             line.includes('isOk') || line.includes('isErr')) && 
            (module.includes('result') || module.includes('@/utils/result'))) {
          
          if (!importMap.has('result')) {
            importMap.set('result', []);
          }
          importMap.get('result').push({ line, index, module });
        } else {
          otherLines.push({ line, index });
        }
      } else {
        otherLines.push({ line, index });
      }
    } else {
      otherLines.push({ line, index });
    }
  });
  
  // Fix duplicate Result imports
  const resultImports = importMap.get('result') || [];
  if (resultImports.length > 1) {
    console.log(`  Found ${resultImports.length} Result imports`);
    changeCount += resultImports.length - 1;
    
    // Combine all Result imports into one
    const allImports = new Set();
    resultImports.forEach(imp => {
      const match = imp.line.match(/import\s*{([^}]+)}/);
      if (match) {
        const items = match[1].split(',').map(s => s.trim());
        items.forEach(item => allImports.add(item));
      }
    });
    
    // Determine the best import path
    let importPath = '@/utils/result';
    // If the file is in utils directory, use relative import
    if (fileName.includes('/utils/') && !fileName.includes('/utils/result.ts')) {
      importPath = './result';
    }
    
    // Create combined import
    const combinedImport = `import { ${Array.from(allImports).join(', ')} } from '${importPath}';`;
    
    // Keep only the first import location, replace with combined
    const firstImportIndex = resultImports[0].index;
    
    // Build new content
    const newLines = [];
    let skipIndices = new Set(resultImports.slice(1).map(imp => imp.index));
    
    lines.forEach((line, index) => {
      if (index === firstImportIndex) {
        newLines.push(combinedImport);
      } else if (!skipIndices.has(index)) {
        newLines.push(line);
      }
    });
    
    return { content: newLines.join('\n'), changeCount };
  }
  
  return { content, changeCount: 0 };
}

// Process all TypeScript files
const patterns = [
  'src/**/*.ts',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts'
];

let totalChanges = 0;
let filesFixed = 0;

console.log('Fixing duplicate imports across all files...\n');

patterns.forEach(pattern => {
  const files = glob.sync(pattern);
  
  files.forEach(file => {
    // Skip the result.ts file itself
    if (file.endsWith('/result.ts')) return;
    
    const content = fs.readFileSync(file, 'utf8');
    const { content: fixed, changeCount } = fixDuplicateImports(content, file);
    
    if (changeCount > 0) {
      fs.writeFileSync(file, fixed, 'utf8');
      console.log(`✅ Fixed ${changeCount} duplicate imports in ${path.basename(file)}`);
      totalChanges += changeCount;
      filesFixed++;
    }
  });
});

console.log(`\n✨ Total: Fixed ${totalChanges} duplicate imports across ${filesFixed} files`);