#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fix files with orphaned import items
 */

function fixTravelAgentService() {
  const filePath = path.join(__dirname, '../src/services/ai/travelAgentService.ts');
  console.log('\nFixing travelAgentService.ts...');
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find the orphaned import items (lines 17-20)
  // They should be part of an import statement
  const newLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line contains orphaned import items
    if (line.includes('FlightSearchQuery,') && !line.includes('import')) {
      // Add the missing import statement
      newLines.push('import {');
      newLines.push(line); // FlightSearchQuery,
      newLines.push(lines[i + 1]); // FlightOffer,
      newLines.push(lines[i + 2]); // validateFlightSearchQuery
      
      // Skip the processed lines
      i += 3;
    } else {
      newLines.push(line);
      i++;
    }
  }
  
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  console.log('  ✅ Fixed orphaned import statement');
}

function fixFlightSearchService() {
  const filePath = path.join(__dirname, '../src/services/flights/flightSearchService.ts');
  console.log('\nFixing flightSearchService.ts...');
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Find the orphaned import items (around line 21)
  const newLines = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line contains orphaned import items
    if (line.includes('CreateSavedSearchData,') && !line.includes('import')) {
      // Add the missing import statement
      newLines.push('import {');
      
      // Collect all the orphaned import items
      let j = i;
      while (j < lines.length && !lines[j].includes('from')) {
        newLines.push(lines[j]);
        j++;
        if (lines[j] && lines[j].includes('} from')) {
          newLines.push(lines[j]);
          i = j;
          break;
        }
      }
    } else {
      newLines.push(line);
    }
    i++;
  }
  
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  console.log('  ✅ Fixed orphaned import statement');
}

// Run fixes
console.log('Fixing orphaned import statements...');

try {
  fixTravelAgentService();
  fixFlightSearchService();
  console.log('\n✅ All files fixed successfully');
} catch (error) {
  console.error('\n❌ Error fixing files:', error.message);
}

console.log('\nNext step: Run npm run typecheck to verify all TypeScript errors are resolved');