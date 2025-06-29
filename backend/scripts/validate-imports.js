#!/usr/bin/env node

/**
 * Import Consistency Validation Script
 * Prevents import conflicts that lead to TypeScript errors
 */

const fs = require('fs');
const path = require('path');

// Standard import sources
const STANDARD_IMPORTS = {
  'Result': '@/utils/result',
  'ok': '@/utils/result',
  'err': '@/utils/result',
  'isOk': '@/utils/result',
  'isErr': '@/utils/result'
};

// Files to check
const SOURCE_DIRS = [
  'backend/src/services',
  'backend/src/routes',
  'backend/src/middleware',
  'backend/src/utils'
];

function findFiles(dir, extensions = ['.ts', '.js']) {
  const files = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function validateImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  
  // Track imports for each Result utility
  const imports = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const importMatch = line.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
    
    if (importMatch) {
      const importedItems = importMatch[1].split(',').map(item => item.trim());
      const source = importMatch[2];
      
      for (const item of importedItems) {
        const cleanItem = item.replace(/\s+as\s+\w+/, '').trim();
        
        if (STANDARD_IMPORTS[cleanItem]) {
          if (!imports[cleanItem]) {
            imports[cleanItem] = [];
          }
          
          imports[cleanItem].push({
            line: i + 1,
            source: source,
            standardSource: STANDARD_IMPORTS[cleanItem]
          });
        }
      }
    }
  }
  
  // Check for violations
  for (const [item, importList] of Object.entries(imports)) {
    // Multiple imports of same item
    if (importList.length > 1) {
      violations.push({
        type: 'Duplicate import',
        message: `${item} imported multiple times`,
        items: importList,
        file: filePath
      });
    }
    
    // Import from non-standard source
    for (const importInfo of importList) {
      if (importInfo.source !== importInfo.standardSource) {
        violations.push({
          type: 'Non-standard import',
          message: `${item} should be imported from ${importInfo.standardSource}`,
          line: importInfo.line,
          actualSource: importInfo.source,
          file: filePath
        });
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 Validating import consistency...');
  
  let totalViolations = 0;
  const allFiles = [];
  
  // Collect all files to check
  for (const dir of SOURCE_DIRS) {
    allFiles.push(...findFiles(dir));
  }
  
  console.log(`📁 Checking ${allFiles.length} files...`);
  
  for (const file of allFiles) {
    const violations = validateImports(file);
    
    if (violations.length > 0) {
      console.log(`\n❌ ${file}:`);
      
      for (const violation of violations) {
        if (violation.type === 'Duplicate import') {
          console.log(`  ${violation.message}:`);
          for (const item of violation.items) {
            console.log(`    Line ${item.line}: from '${item.source}'`);
          }
        } else {
          console.log(`  Line ${violation.line}: ${violation.message}`);
          console.log(`    Currently: from '${violation.actualSource}'`);
        }
      }
      
      totalViolations += violations.length;
    }
  }
  
  if (totalViolations > 0) {
    console.log(`\n🚨 Found ${totalViolations} import violations!`);
    console.log(`📋 Please fix these violations before committing.`);
    console.log(`📖 Use single source of truth: import from '@/utils/result'`);
    process.exit(1);
  }
  
  console.log('✅ All import validations passed!');
  process.exit(0);
}

if (require.main === module) {
  main();
}