#!/usr/bin/env node

/**
 * Script to fix Redis Buffer type issues
 * Handles Buffer to string conversions for Redis responses
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern 1: Direct Redis get() results that need string conversion
  // Look for patterns where we're assigning Redis results to string variables
  const redisGetPattern = /const\s+(\w+)\s*=\s*await\s+(?:this\.)?redisClient\.get\(([^)]+)\);/g;
  const matches = [...content.matchAll(redisGetPattern)];
  
  matches.forEach(match => {
    const [fullMatch, varName] = match;
    const nextUsage = content.indexOf(varName, match.index + fullMatch.length);
    
    if (nextUsage !== -1) {
      // Check if the variable is used in a context expecting a string
      const usageContext = content.substring(nextUsage - 20, nextUsage + 50);
      
      // If it's used where a string is expected, we need to handle the conversion
      if (usageContext.includes('JSON.parse') || 
          usageContext.includes('.toString()') ||
          usageContext.includes('=== varName') ||
          usageContext.includes(`${varName}.value`)) {
        
        // Replace the get() call to handle Buffer conversion
        const replacement = `const ${varName} = await this.redisClient.get(${match[2]});
    const ${varName}String = ${varName}.value ? ${varName}.value.toString() : null`;
        
        content = content.replace(fullMatch, replacement);
        
        // Update usages of the variable
        const varRegex = new RegExp(`\\b${varName}\\b(?!\\.value)`, 'g');
        content = content.replace(varRegex, (match, offset) => {
          // Don't replace the declaration itself
          if (offset > fullMatch.index && offset < fullMatch.index + replacement.length) {
            return match;
          }
          return `${varName}String`;
        });
        
        modified = true;
      }
    }
  });
  
  // Pattern 2: Redis keys() results - returns string[] or Buffer[]
  const keysPattern = /const\s+(\w+)\s*=\s*await\s+(?:this\.)?redisClient\.keys\(([^)]+)\);/g;
  if (keysPattern.test(content)) {
    content = content.replace(keysPattern, (match, varName, pattern) => {
      return `const ${varName}Result = await this.redisClient.keys(${pattern});
    const ${varName} = isOk(${varName}Result) ? ${varName}Result.value.map(k => k.toString()) : []`;
    });
    modified = true;
  }
  
  // Pattern 3: Fix Result<string, AppError> to Result<string | Buffer, AppError> where needed
  if (content.includes('Result<string[], AppError>') && content.includes('.keys(')) {
    content = content.replace(
      /:\s*Result<string\[\],\s*AppError>/g,
      ': Result<(string | Buffer)[], AppError>'
    );
    modified = true;
  }
  
  // Pattern 4: Handle isOk/isErr checks on Redis results
  const redisResultPattern = /if\s*\(isOk\((\w+)\)\)\s*{\s*return\s+ok\(\1\.value\)/g;
  if (content.includes('redisClient') && redisResultPattern.test(content)) {
    content = content.replace(redisResultPattern, (match, varName) => {
      return `if (isOk(${varName})) {\n      const value = ${varName}.value ? ${varName}.value.toString() : null;\n      return ok(value)`;
    });
    modified = true;
  }
  
  // Add necessary imports if modified
  if (modified) {
    // Ensure isOk and isErr are imported if used
    if ((content.includes('isOk(') || content.includes('isErr(')) && 
        !content.includes('isOk') && content.includes("from '@/utils/result'")) {
      content = content.replace(
        /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@\/utils\/result['"]/,
        (match, imports) => {
          const importList = imports.split(',').map(i => i.trim());
          if (content.includes('isOk(') && !importList.includes('isOk')) {
            importList.push('isOk');
          }
          if (content.includes('isErr(') && !importList.includes('isErr')) {
            importList.push('isErr');
          }
          return `import { ${importList.join(', ')} } from '@/utils/result'`;
        }
      );
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed Redis Buffer types in: ${filePath}`);
    return 1;
  }
  
  return 0;
}

// Find all TypeScript files that might use Redis
const files = glob.sync('src/**/*.ts', { 
  cwd: path.join(__dirname, '..'),
  absolute: true,
  ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts']
});

// Filter to files that likely use Redis
const redisFiles = files.filter(file => {
  const content = fs.readFileSync(file, 'utf8');
  return content.includes('redisClient') || content.includes('redis') || content.includes('Redis');
});

console.log(`Found ${redisFiles.length} files potentially using Redis...`);

let totalFixed = 0;
redisFiles.forEach(file => {
  totalFixed += processFile(file);
});

console.log(`\n✨ Fixed ${totalFixed} files with Redis Buffer type issues`);