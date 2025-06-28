#!/usr/bin/env ts-node

/**
 * Script to fix Result type usage errors
 * Replaces direct .error property access with proper isOk/isErr checks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

function fixResultUsage(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;

  // Pattern 1: if (isErr(result)) -> if (isErr(result))
  const errorCheckPattern = /if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\)/g;
  if (errorCheckPattern.test(newContent)) {
    newContent = newContent.replace(errorCheckPattern, 'if (isErr($1))');
    modified = true;
  }

  // Pattern 2: if (isOk(result)) -> if (isOk(result))
  const noErrorCheckPattern = /if\s*\(\s*!\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\)/g;
  if (noErrorCheckPattern.test(newContent)) {
    newContent = newContent.replace(noErrorCheckPattern, 'if (isOk($1))');
    modified = true;
  }

  // Pattern 3: (isErr(result) ? result.error : -> isErr(result) ? result.error :
  const orPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\|\|/g;
  if (orPattern.test(newContent)) {
    newContent = newContent.replace(orPattern, 'isErr($1) ? $1.error :');
    modified = true;
  }

  // Pattern 4: return result.error -> return isErr(result) ? result.error : null
  const returnErrorPattern = /return\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error(?![\w])/g;
  if (returnErrorPattern.test(newContent)) {
    newContent = newContent.replace(returnErrorPattern, 'return isErr($1) ? $1.error : null');
    modified = true;
  }

  // Pattern 5: Handle .value access after error check
  const valueAfterErrorPattern = /if\s*\(isErr\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\)[\s\S]*?\}\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.value/g;
  if (valueAfterErrorPattern.test(newContent)) {
    // This is more complex, we'll handle it separately
  }

  // Ensure imports are correct
  if (modified && !content.includes('import { isOk, isErr }')) {
    // Check if there's already a Result import
    const resultImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"].*\/result['"]/);
    if (resultImportMatch) {
      const imports = resultImportMatch[1].split(',').map(s => s.trim());
      if (!imports.includes('isOk')) imports.push('isOk');
      if (!imports.includes('isErr')) imports.push('isErr');
      const newImport = `import { ${imports.join(', ')} } from '${resultImportMatch[0].match(/from\s*['"]([^'"]+)['"]/)?.[1]}'`;
      newContent = newContent.replace(resultImportMatch[0], newImport);
    } else {
      // Add new import
      const firstImportMatch = content.match(/^import\s+.*$/m);
      if (firstImportMatch) {
        newContent = newContent.replace(
          firstImportMatch[0],
          `${firstImportMatch[0]}\nimport { isOk, isErr } from '@/utils/result';`
        );
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
  }

  return modified;
}

function main() {
  console.log('🔧 Fixing Result type usage errors...\n');

  const files = glob.sync('src/**/*.ts', {
    ignore: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'src/**/test/**',
      'src/**/__tests__/**',
      'src/scripts/**'
    ]
  });

  let fixedCount = 0;
  let totalFiles = 0;

  for (const file of files) {
    totalFiles++;
    if (fixResultUsage(file)) {
      fixedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files fixed: ${fixedCount}`);
  console.log(`\n✨ Done!`);
}

main();