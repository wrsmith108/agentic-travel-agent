const fs = require('fs');
const path = require('path');

// Utility functions
function createBackup(filePath) {
  const backupPath = filePath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
}

function findTSFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
      files.push(...findTSFiles(fullPath));
    } else if (item.endsWith('.ts') && !item.endsWith('.test.ts') && !item.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Get all TypeScript files
const srcDir = path.join(__dirname, '..', 'src');
const files = findTSFiles(srcDir);

let totalChanges = 0;

console.log('Fixing date type mismatches...');

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let changes = 0;
    
    // Fix 1: new Date() assignments to createdAt/updatedAt properties
    const dateAssignmentPattern = /(\w+\.(createdAt|updatedAt))\s*=\s*new Date\(\)/g;
    const dateAssignmentMatches = content.match(dateAssignmentPattern);
    if (dateAssignmentMatches) {
      createBackup(file);
      content = content.replace(dateAssignmentPattern, '$1 = new Date().toISOString()');
      changes += dateAssignmentMatches.length;
    }
    
    // Fix 2: Object literals with Date objects
    const objectDatePattern = /(createdAt|updatedAt):\s*new Date\(\)/g;
    const objectDateMatches = content.match(objectDatePattern);
    if (objectDateMatches) {
      if (changes === 0) createBackup(file);
      content = content.replace(objectDatePattern, '$1: new Date().toISOString()');
      changes += objectDateMatches.length;
    }
    
    // Fix 3: timestamp: new Date() in objects
    const timestampPattern = /timestamp:\s*new Date\(\)/g;
    const timestampMatches = content.match(timestampPattern);
    if (timestampMatches) {
      if (changes === 0) createBackup(file);
      content = content.replace(timestampPattern, 'timestamp: new Date().toISOString()');
      changes += timestampMatches.length;
    }
    
    // Fix 4: Date type in interface/type definitions should be string
    const interfaceDatePattern = /(createdAt|updatedAt|timestamp):\s*Date(\s*[;,}])/g;
    const interfaceDateMatches = content.match(interfaceDatePattern);
    if (interfaceDateMatches && !file.includes('types/brands.ts')) {
      if (changes === 0) createBackup(file);
      content = content.replace(interfaceDatePattern, '$1: string$2');
      changes += interfaceDateMatches.length;
    }
    
    // Fix 5: Add date utility imports where needed
    if (changes > 0 && !content.includes('dateUtils') && !content.includes('toISOString')) {
      // Add import at the top after other imports
      const importPattern = /(import.*?from.*?['"];?\s*)(\n\n|\n(?=export|interface|type|const|class|function))/;
      if (importPattern.test(content)) {
        content = content.replace(importPattern, '$1\nimport { dateUtils } from \'@/utils/types/dates\';\n$2');
      }
    }
    
    if (changes > 0) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Fixed ${changes} date issues in ${path.relative(srcDir, file)}`);
      totalChanges += changes;
    }
    
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal changes made: ${totalChanges}`);
console.log('Backup files created with .bak extension');