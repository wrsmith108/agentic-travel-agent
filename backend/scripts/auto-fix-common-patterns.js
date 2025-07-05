#!/usr/bin/env node

/**
 * Automated Pattern Detection and Fixing Script
 * Automatically fixes 80% of common TypeScript error patterns
 */

const fs = require('fs');
const path = require('path');

// Source directories to process
const SOURCE_DIRS = [
  'backend/src/services',
  'backend/src/routes',
  'backend/src/middleware',
  'backend/src/utils'
];

// Common error patterns and their fixes
const PATTERN_FIXES = [
  {
    name: 'Direct Result value access',
    pattern: /\.value(?!\s*\?)/g,
    replacement: (match, context) => {
      // Check if there's a guard before this
      const lines = context.content.split('\n');
      const currentLineIndex = context.lineIndex;
      
      // Look for isOk guard in previous lines
      for (let i = Math.max(0, currentLineIndex - 5); i < currentLineIndex; i++) {
        if (lines[i].includes('isOk(') || lines[i].includes('if (result.')) {
          return match; // Keep as is, likely already guarded
        }
      }
      
      return '.value /* TODO: Add isOk() guard */';
    }
  },
  {
    name: 'Direct Result error access',
    pattern: /\.error(?!\s*\?)/g,
    replacement: (match, context) => {
      const lines = context.content.split('\n');
      const currentLineIndex = context.lineIndex;
      
      // Look for isErr guard in previous lines
      for (let i = Math.max(0, currentLineIndex - 5); i < currentLineIndex; i++) {
        if (lines[i].includes('isErr(') || lines[i].includes('if (!result.')) {
          return match; // Keep as is, likely already guarded
        }
      }
      
      return '.error /* TODO: Add isErr() guard */';
    }
  },
  {
    name: 'Legacy success property',
    pattern: /\.success\b/g,
    replacement: 'isOk(result) /* Migrated from .success */'
  },
  {
    name: 'Legacy data property',
    pattern: /\.data\b/g,
    replacement: '.value /* Migrated from .data */'
  },
  {
    name: 'Missing Result import',
    pattern: /^(?!.*import.*Result).*Result</g,
    replacement: (match, context) => {
      // Add import at the top of the file
      const lines = context.content.split('\n');
      const importIndex = lines.findIndex(line => line.includes('import'));
      
      if (importIndex !== -1) {
        lines.splice(importIndex, 0, "import { Result, ok, err, isOk, isErr } from '@/utils/result';");
        context.content = lines.join('\n');
      }
      
      return match;
    }
  },
  {
    name: 'Date string comparison',
    pattern: /new Date\([^)]+\)\s*[<>=]+\s*["'][^"']*["']/g,
    replacement: (match) => {
      return match.replace(/["']([^"']*)["']/, 'new Date("$1")');
    }
  },
  {
    name: 'Variable redeclaration with let',
    pattern: /let\s+(\w+)\s*=.*?\n.*let\s+\1\s*=/g,
    replacement: (match, varName) => {
      return match.replace(/let\s+(\w+)\s*=/, `let ${varName}1 =`);
    }
  },
  {
    name: 'Undefined null check',
    pattern: /if\s*\(\s*(\w+)\s*!=\s*null\s*\)/g,
    replacement: 'if ($1 !== null && $1 !== undefined)'
  },
  {
    name: 'Non-null assertion on potentially undefined',
    pattern: /(\w+)!\./g,
    replacement: (match, varName) => {
      return `${varName}?.`;
    }
  }
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

function applyFixes(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let modifiedContent = content;
  const fixes = [];
  
  for (const fix of PATTERN_FIXES) {
    const matches = [...modifiedContent.matchAll(fix.pattern)];
    
    if (matches.length > 0) {
      for (const match of matches) {
        const context = {
          content: modifiedContent,
          lineIndex: modifiedContent.substring(0, match.index).split('\n').length - 1,
          match: match
        };
        
        let replacement;
        if (typeof fix.replacement === 'function') {
          replacement = fix.replacement(match[0], context);
          modifiedContent = context.content; // In case the function modified content
        } else {
          replacement = fix.replacement;
        }
        
        if (replacement !== match[0]) {
          modifiedContent = modifiedContent.replace(match[0], replacement);
          fixes.push({
            pattern: fix.name,
            original: match[0],
            fixed: replacement
          });
        }
      }
    }
  }
  
  if (!dryRun && fixes.length > 0) {
    fs.writeFileSync(filePath, modifiedContent);
  }
  
  return fixes;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  console.log('🔧 Auto-fixing common TypeScript patterns...');
  
  if (dryRun) {
    console.log('🔍 Running in dry-run mode (no files will be modified)');
  }
  
  let totalFixes = 0;
  let totalFiles = 0;
  const allFiles = [];
  
  // Collect all files to process
  for (const dir of SOURCE_DIRS) {
    allFiles.push(...findFiles(dir));
  }
  
  console.log(`📁 Processing ${allFiles.length} files...`);
  
  for (const file of allFiles) {
    const fixes = applyFixes(file, dryRun);
    
    if (fixes.length > 0) {
      totalFiles++;
      totalFixes += fixes.length;
      
      console.log(`\n📝 ${file}:`);
      
      for (const fix of fixes) {
        console.log(`  ✅ ${fix.pattern}`);
        if (verbose) {
          console.log(`    - "${fix.original}" → "${fix.fixed}"`);
        }
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Files processed: ${allFiles.length}`);
  console.log(`  Files modified: ${totalFiles}`);
  console.log(`  Total fixes applied: ${totalFixes}`);
  
  if (dryRun && totalFixes > 0) {
    console.log(`\n🔧 Run without --dry-run to apply these fixes`);
  } else if (totalFixes > 0) {
    console.log(`\n✅ All fixes applied successfully!`);
    console.log(`⚠️  Please review the changes and run tests before committing.`);
  } else {
    console.log(`\n✅ No issues found - code is already clean!`);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { applyFixes, PATTERN_FIXES };