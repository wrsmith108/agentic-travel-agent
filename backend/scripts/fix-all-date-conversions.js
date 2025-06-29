#!/usr/bin/env node
const fs = require('fs');
const glob = require('glob');
const path = require('path');

function fixDateConversions(content) {
  let changeCount = 0;
  let fixed = content;
  
  // Fix pattern: variable as string where variable is a Date
  fixed = fixed.replace(/(\w+) as string/g, (match, varName, offset) => {
    // Look back to see if this variable was assigned a Date
    const before = content.substring(Math.max(0, offset - 200), offset);
    if (before.includes(`const ${varName} = new Date()`) || 
        before.includes(`let ${varName} = new Date()`) ||
        before.includes(`const ${varName} = createTimestamp()`) ||
        varName === 'now' || varName === 'expiresAt' || varName === 'createdAt') {
      changeCount++;
      return `${varName}.toISOString()`;
    }
    return match;
  });
  
  // Fix direct Date assignments to string fields in object literals
  fixed = fixed.replace(/: new Date\(\),?$/gm, (match) => {
    changeCount++;
    return match.endsWith(',') ? ': new Date().toISOString(),' : ': new Date().toISOString()';
  });
  
  // Fix specific property patterns
  const dateProperties = ['createdAt', 'updatedAt', 'alertedAt', 'expiresAt', 'lastCheckedAt'];
  dateProperties.forEach(prop => {
    // Pattern: property: variable as string
    const pattern1 = new RegExp(`${prop}: (\\w+) as string`, 'g');
    fixed = fixed.replace(pattern1, (match, varName) => {
      changeCount++;
      return `${prop}: ${varName}.toISOString()`;
    });
    
    // Pattern: property: new Date() as string
    const pattern2 = new RegExp(`${prop}: new Date\\((.*?)\\) as string`, 'g');
    fixed = fixed.replace(pattern2, (match, args) => {
      changeCount++;
      return `${prop}: new Date(${args}).toISOString()`;
    });
  });
  
  // Fix test file patterns
  fixed = fixed.replace(/expect\(.*?\)\.toBe\(.*? as string\)/g, (match) => {
    if (match.includes('Date')) {
      changeCount++;
      return match.replace(' as string', '.toISOString()');
    }
    return match;
  });
  
  // Fix testFlightSearch Date() calls
  fixed = fixed.replace(/Date\(\)\.substring/g, (match) => {
    changeCount++;
    return 'new Date().toISOString().substring';
  });
  
  return { fixed, changeCount };
}

// Process all relevant files
const patterns = [
  'src/models/**/*.ts',
  'src/services/**/*.ts',
  'src/utils/**/*.ts',
  'src/routes/**/*.ts'
];

let totalChanges = 0;
let filesChanged = 0;

patterns.forEach(pattern => {
  const files = glob.sync(pattern);
  
  files.forEach(file => {
    // Skip test files for now unless they have specific patterns
    if (file.includes('__tests__') && !file.includes('authTestUtils') && !file.includes('testHelpers')) {
      return;
    }
    
    const content = fs.readFileSync(file, 'utf8');
    const { fixed, changeCount } = fixDateConversions(content);
    
    if (changeCount > 0) {
      fs.writeFileSync(file, fixed, 'utf8');
      console.log(`✅ Fixed ${changeCount} date conversions in ${path.basename(file)}`);
      totalChanges += changeCount;
      filesChanged++;
    }
  });
});

console.log(`\n✨ Total: ${totalChanges} date conversions fixed across ${filesChanged} files`);