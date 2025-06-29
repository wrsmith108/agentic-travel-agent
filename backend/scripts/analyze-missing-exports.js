#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Analyzing Missing Type Exports');
console.log('=================================\n');

// Run typecheck and capture errors
let output;
try {
  execSync('npm run typecheck', { cwd: process.cwd() });
  console.log('✅ No TypeScript errors found!');
  process.exit(0);
} catch (error) {
  output = error.stdout.toString() + error.stderr.toString();
}

// Parse missing export errors
const missingExportPattern = /error TS2305: Module '(.+)' has no exported member '(.+)'/g;
const missingExports = new Map();

let match;
while ((match = missingExportPattern.exec(output)) !== null) {
  const [, modulePath, memberName] = match;
  if (!missingExports.has(modulePath)) {
    missingExports.set(modulePath, new Set());
  }
  missingExports.get(modulePath).add(memberName);
}

// Parse wrong name errors (Did you mean X?)
const wrongNamePattern = /error TS2724: '(.+)' has no exported member named '(.+)'\. Did you mean '(.+)'\?/g;
const wrongNames = new Map();

while ((match = wrongNamePattern.exec(output)) !== null) {
  const [, modulePath, wrongName, correctName] = match;
  if (!wrongNames.has(modulePath)) {
    wrongNames.set(modulePath, new Map());
  }
  wrongNames.get(modulePath).set(wrongName, correctName);
}

console.log(`📊 Found ${missingExports.size} modules with missing exports\n`);

// Generate fixes
const fixes = [];

missingExports.forEach((members, modulePath) => {
  console.log(`\n📁 Module: ${modulePath}`);
  console.log(`   Missing exports: ${Array.from(members).join(', ')}`);
  
  // Try to find the actual file
  const cleanPath = modulePath.replace(/['"]/g, '');
  let filePath;
  
  if (cleanPath.startsWith('.')) {
    // Relative path - need to resolve from error location
    console.log(`   ⚠️  Relative path detected - manual resolution needed`);
  } else {
    // Absolute path from src
    filePath = path.join('src', cleanPath.replace('@/', '') + '.ts');
    
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ Found file: ${filePath}`);
      
      // Check if these types exist in related files
      const dir = path.dirname(filePath);
      const relatedFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.ts') && !f.includes('.test.') && !f.includes('.spec.'));
      
      console.log(`   📂 Related files in directory: ${relatedFiles.join(', ')}`);
      
      // Generate export suggestions
      fixes.push({
        file: filePath,
        exports: Array.from(members),
        suggestions: relatedFiles
      });
    } else {
      console.log(`   ❌ File not found: ${filePath}`);
    }
  }
});

wrongNames.forEach((corrections, modulePath) => {
  console.log(`\n📁 Module: ${modulePath}`);
  console.log(`   Wrong names:`);
  corrections.forEach((correct, wrong) => {
    console.log(`     ${wrong} → ${correct}`);
  });
});

// Generate fix file
if (fixes.length > 0) {
  console.log('\n\n📝 Generating fix suggestions...\n');
  
  fixes.forEach(fix => {
    console.log(`\n// ${fix.file}`);
    console.log(`// Add these exports:`);
    console.log(`export type {`);
    fix.exports.forEach(exp => {
      console.log(`  ${exp},`);
    });
    console.log(`} from './[appropriate-file]';`);
    console.log(`// Check these files: ${fix.suggestions.join(', ')}`);
  });
}

// Common missing types and their likely sources
const commonSources = {
  'PlainPassword': 'password.ts',
  'PlainTextPassword': 'password.ts',
  'PasswordStorage': 'storage/types.ts',
  'TokenStorage': 'storage/types.ts',
  'Logger': 'types/core.ts',
  'IdGenerator': 'types/core.ts',
  'TimeProvider': 'types/core.ts',
  'JWTToken': 'types/auth.ts',
  'SessionStorage': 'storage/types.ts',
  'JWTConfig': 'types/config.ts',
  'SessionUser': 'types/auth.ts',
  'SessionData': 'types/auth.ts',
  'JWTPayload': 'types/auth.ts'
};

console.log('\n\n🔧 Common type sources:');
console.log('======================');
Object.entries(commonSources).forEach(([type, source]) => {
  console.log(`${type.padEnd(20)} → ${source}`);
});

console.log('\n✨ Analysis complete!');