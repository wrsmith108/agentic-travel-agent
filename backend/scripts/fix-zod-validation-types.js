#!/usr/bin/env node

/**
 * Script to fix Zod SafeParseReturnType usage with Result pattern
 * Converts safeParse results to use zodToResult helper
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern 1: Direct isErr/isOk usage on safeParse result
  // Before: if (isErr(schema.safeParse(data))) { ... }
  // After: const result = zodToResult(schema.safeParse(data)); if (isErr(result)) { ... }
  const safeParsePattern = /isErr\(([^)]+)\.safeParse\(([^)]+)\)\)/g;
  if (safeParsePattern.test(content)) {
    content = content.replace(safeParsePattern, (match, schema, data) => {
      return `isErr(zodToResult(${schema}.safeParse(${data})))`;
    });
    modified = true;
  }
  
  // Pattern 2: Storing safeParse result and checking success
  // Before: const result = schema.safeParse(data); if (!result.success) { ... }
  // After: const result = zodToResult(schema.safeParse(data)); if (isErr(result)) { ... }
  const resultPattern = /const\s+(\w+)\s*=\s*([^;]+)\.safeParse\(([^)]+)\);[\s\n]*if\s*\(!\1\.success\)/g;
  if (resultPattern.test(content)) {
    content = content.replace(resultPattern, (match, varName, schema, data) => {
      return `const ${varName} = zodToResult(${schema}.safeParse(${data}));\n    if (isErr(${varName}))`;
    });
    modified = true;
  }
  
  // Pattern 3: Direct success check
  // Before: if (!schema.safeParse(data).success) { ... }
  // After: if (isErr(zodToResult(schema.safeParse(data)))) { ... }
  const directSuccessPattern = /if\s*\(\s*!([^)]+)\.safeParse\(([^)]+)\)\.success\s*\)/g;
  if (directSuccessPattern.test(content)) {
    content = content.replace(directSuccessPattern, (match, schema, data) => {
      return `if (isErr(zodToResult(${schema}.safeParse(${data}))))`;
    });
    modified = true;
  }
  
  // Pattern 4: Accessing .data property
  // Before: result.data
  // After: result.value (only if result was converted)
  if (modified && content.includes('.data')) {
    // Only replace .data if it's after a variable that was converted
    content = content.replace(/(\w+)\.data\b/g, (match, varName) => {
      // Check if this variable was part of a zodToResult conversion
      if (content.includes(`zodToResult`) && content.includes(varName)) {
        return `${varName}.value`;
      }
      return match;
    });
  }
  
  // Add imports if needed
  if (modified) {
    // Check if zodToResult is imported
    if (!content.includes('zodToResult')) {
      console.log(`⚠️  Skipping ${filePath} - manual review needed`);
      return 0;
    }
    
    if (!content.includes("from '@/utils/zodToResult'")) {
      // Add import after other imports
      const importRegex = /^import\s+.*$/gm;
      const imports = content.match(importRegex);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;
        
        const newImport = `\nimport { zodToResult } from '@/utils/zodToResult';`;
        content = content.slice(0, insertPosition) + newImport + content.slice(insertPosition);
      }
    }
    
    // Ensure isErr is imported if used
    if (content.includes('isErr(') && !content.includes('isErr') && content.includes("from '@/utils/result'")) {
      content = content.replace(
        /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@\/utils\/result['"]/,
        (match, imports) => {
          const importList = imports.split(',').map(i => i.trim());
          if (!importList.includes('isErr')) {
            importList.push('isErr');
          }
          return `import { ${importList.join(', ')} } from '@/utils/result'`;
        }
      );
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed Zod validation in: ${filePath}`);
    return 1;
  }
  
  return 0;
}

// Find all TypeScript files that might use Zod
const files = glob.sync('src/**/*.ts', { 
  cwd: path.join(__dirname, '..'),
  absolute: true,
  ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts']
});

// Filter to files that likely use Zod
const zodFiles = files.filter(file => {
  const content = fs.readFileSync(file, 'utf8');
  return content.includes('safeParse') || content.includes('z.') || content.includes('SafeParseReturnType');
});

console.log(`Found ${zodFiles.length} files potentially using Zod validation...`);

let totalFixed = 0;
zodFiles.forEach(file => {
  totalFixed += processFile(file);
});

console.log(`\n✨ Fixed ${totalFixed} files with Zod validation type issues`);