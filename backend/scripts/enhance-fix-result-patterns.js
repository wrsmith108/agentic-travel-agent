#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Enhanced patterns for Result type usage
const fixes = [
  // ========== BASIC PATTERNS ==========
  // Pattern: if (result.error) -> if (isErr(result))
  {
    pattern: /if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\)/g,
    replacement: 'if (isErr($1))',
    description: 'Basic error check'
  },
  // Pattern: if (!result.error) -> if (isOk(result))
  {
    pattern: /if\s*\(\s*!\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\)/g,
    replacement: 'if (isOk($1))',
    description: 'Basic success check'
  },
  
  // ========== LOGICAL OPERATORS ==========
  // Pattern: result.error || -> isErr(result) ? result.error :
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\|\|/g,
    replacement: '(isErr($1) ? $1.error :',
    description: 'OR operator with error'
  },
  // Pattern: && result.error
  {
    pattern: /&&\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: '&& isErr($1)',
    description: 'AND operator with error'
  },
  // Pattern: result.value && -> isOk(result) &&
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.value\s*&&/g,
    replacement: 'isOk($1) &&',
    description: 'AND operator with value'
  },
  
  // ========== RETURN STATEMENTS ==========
  // Pattern: return result.error -> return isErr(result) ? result.error : null
  {
    pattern: /return\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error(?![a-zA-Z])/g,
    replacement: 'return isErr($1) ? $1.error : null',
    description: 'Return error'
  },
  // Pattern: return result.value -> return isOk(result) ? result.value : null
  {
    pattern: /return\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.value(?![a-zA-Z])/g,
    replacement: 'return isOk($1) ? $1.value : null',
    description: 'Return value'
  },
  
  // ========== TERNARY OPERATORS ==========
  // Pattern: result.error ? -> isErr(result) ?
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\s*\?/g,
    replacement: 'isErr($1) ?',
    description: 'Ternary with error'
  },
  // Pattern: result.value ? -> isOk(result) ? result.value :
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.value\s*\?/g,
    replacement: 'isOk($1) ? $1.value :',
    description: 'Ternary with value'
  },
  
  // ========== ASSIGNMENTS ==========
  // Pattern: const x = result.error -> const x = isErr(result) ? result.error : null
  {
    pattern: /(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error(?![a-zA-Z])/g,
    replacement: '$1 $2 = isErr($3) ? $3.error : null',
    description: 'Variable assignment with error'
  },
  // Pattern: const x = result.value -> const x = isOk(result) ? result.value : null
  {
    pattern: /(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.value(?![a-zA-Z])/g,
    replacement: '$1 $2 = isOk($3) ? $3.value : null',
    description: 'Variable assignment with value'
  },
  
  // ========== THROW STATEMENTS ==========
  // Pattern: throw result.error -> if (isErr(result)) throw result.error
  {
    pattern: /throw\s+([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: 'if (isErr($1)) throw $1.error; throw new Error("Unexpected ok result")',
    description: 'Throw error'
  },
  
  // ========== CONSOLE STATEMENTS ==========
  // Pattern: console.log(result.error)
  {
    pattern: /(console\.[a-zA-Z]+\([^,)]*,\s*)([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: '$1isErr($2) ? $2.error : $2',
    description: 'Console with error'
  },
  // Pattern: console.log('msg', result.error.message)
  {
    pattern: /(console\.[a-zA-Z]+\([^)]*?)([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\.(message|code|stack)/g,
    replacement: '$1(isErr($2) ? $2.error.$3 : "")',
    description: 'Console with error property'
  },
  
  // ========== PROPERTY ACCESS ==========
  // Pattern: result.error.message
  {
    pattern: /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error\.(message|code|stack|type)(?![a-zA-Z])/g,
    replacement: '(isErr($1) ? $1.error.$2 : "")',
    description: 'Error property access'
  },
  
  // ========== NEGATION ==========
  // Pattern: !result.error -> isOk(result)
  {
    pattern: /!\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.error/g,
    replacement: 'isOk($1)',
    description: 'Negated error check'
  },
  // Pattern: !result.value -> isErr(result)
  {
    pattern: /!\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.value/g,
    replacement: 'isErr($1)',
    description: 'Negated value check'
  },
  
  // ========== PROMISE CHAINS ==========
  // Pattern: .then(result => result.value)
  {
    pattern: /\.then\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*\1\.value\s*\)/g,
    replacement: '.then($1 => isOk($1) ? $1.value : null)',
    description: 'Promise chain value'
  },
  // Pattern: .catch(error => ({ error }))
  {
    pattern: /\.catch\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*\{\s*error:\s*\1\s*\}\s*\)/g,
    replacement: '.catch($1 => err($1))',
    description: 'Promise catch to Result'
  }
];

// Special handling for complex patterns
function handleComplexPatterns(content) {
  // Handle !result.ok patterns where result.error is accessed in the block
  const notOkPattern = /if\s*\(\s*!([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.ok\s*\)\s*{([^}]+)}/g;
  
  content = content.replace(notOkPattern, (match, varName, body) => {
    if (body.includes(`${varName}.error`)) {
      // Replace the condition to use isErr
      const newCondition = `if (isErr(${varName})) {`;
      return newCondition + body + '}';
    }
    return match;
  });
  
  // Handle result.ok patterns where result.value is accessed
  const okPattern = /if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*?)\.ok\s*\)\s*{([^}]+)}/g;
  
  content = content.replace(okPattern, (match, varName, body) => {
    if (body.includes(`${varName}.value`)) {
      // Replace the condition to use isOk
      const newCondition = `if (isOk(${varName})) {`;
      return newCondition + body + '}';
    }
    return match;
  });
  
  return content;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const appliedFixes = [];
  
  // First, handle complex patterns
  const fixedContent = handleComplexPatterns(content);
  if (fixedContent !== content) {
    content = fixedContent;
    modified = true;
    appliedFixes.push('Complex !result.ok patterns');
  }
  
  // Apply all simple fixes
  fixes.forEach(fix => {
    const before = content;
    content = content.replace(fix.pattern, fix.replacement);
    if (before !== content) {
      modified = true;
      appliedFixes.push(fix.description);
    }
  });
  
  // Add missing imports if needed
  if (modified && (content.includes('isOk(') || content.includes('isErr(')) && !content.includes('import { isOk, isErr }') && !content.includes('import {isOk, isErr}')) {
    // Skip if it's a test file or the result.ts file itself
    if (!filePath.includes('.test.') && !filePath.includes('.spec.') && !filePath.endsWith('/result.ts')) {
      // Find existing import from result
      const resultImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"].*?\/result['"]/);
      if (resultImportMatch) {
        const imports = resultImportMatch[1].split(',').map(s => s.trim());
        const needsIsOk = content.includes('isOk(') && !imports.includes('isOk');
        const needsIsErr = content.includes('isErr(') && !imports.includes('isErr');
        
        if (needsIsOk) imports.push('isOk');
        if (needsIsErr) imports.push('isErr');
        
        const newImport = `import { ${imports.join(', ')} } from ${resultImportMatch[0].match(/from\s*(['"].*?['"])/)[1]}`;
        content = content.replace(resultImportMatch[0], newImport);
      } else {
        // Add new import after first import
        const firstImport = content.match(/^import.*$/m);
        if (firstImport) {
          const imports = [];
          if (content.includes('isOk(')) imports.push('isOk');
          if (content.includes('isErr(')) imports.push('isErr');
          if (imports.length > 0) {
            content = content.replace(firstImport[0], firstImport[0] + '\nimport { ' + imports.join(', ') + ' } from \'@/utils/result\';');
          }
        }
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    appliedFixes.forEach(fix => console.log(`   - ${fix}`));
    return true;
  }
  
  return false;
}

// Main
console.log('🔧 Enhanced Result Pattern Fixer');
console.log('================================\n');

const files = glob.sync('src/**/*.ts', {
  ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', 'src/scripts/**', '**/result.ts']
});

let fixed = 0;
let totalFiles = files.length;

console.log(`📊 Scanning ${totalFiles} TypeScript files...\n`);

files.forEach((file, index) => {
  if (fixFile(file)) {
    fixed++;
  }
  // Progress indicator
  if ((index + 1) % 10 === 0) {
    process.stdout.write(`Progress: ${index + 1}/${totalFiles}\r`);
  }
});

console.log(`\n\n📈 Summary:`);
console.log(`   Total files scanned: ${totalFiles}`);
console.log(`   Files fixed: ${fixed}`);
console.log(`   Success rate: ${((fixed / totalFiles) * 100).toFixed(1)}%`);
console.log(`\n✨ Enhanced fix complete!`);