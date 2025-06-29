#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fix files with broken import statements
 */

const fixes = [
  {
    file: './src/services/ai/travelAgentService.ts',
    line: 17,
    remove: 2,  // Remove lines 17-18
    description: 'Remove broken import statement'
  },
  {
    file: './src/services/flights/flightSearchService.ts', 
    line: 21,
    remove: 2,  // Remove lines 21-22
    description: 'Remove broken import statement'
  }
];

function fixFile(fix) {
  const filePath = path.join(__dirname, '..', fix.file);
  console.log(`\nProcessing: ${fix.file}`);
  console.log(`  Action: ${fix.description}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ❌ File not found: ${filePath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Remove the specified lines (0-indexed)
    lines.splice(fix.line - 1, fix.remove);
    
    const newContent = lines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`  ✅ Fixed broken import statement`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

// Run fixes
console.log('Fixing broken import statements...');
let fixedCount = 0;

for (const fix of fixes) {
  if (fixFile(fix)) {
    fixedCount++;
  }
}

console.log(`\n✅ Fixed ${fixedCount} out of ${fixes.length} files`);
console.log('\nNext step: Run npm run typecheck to see remaining errors');