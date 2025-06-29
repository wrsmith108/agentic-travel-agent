#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fix final TypeScript errors
 */

function fixFile(filePath, fixes) {
  console.log(`\nFixing ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changesMade = false;
  
  for (const fix of fixes) {
    const before = content;
    content = content.replace(fix.pattern, fix.replacement);
    if (before !== content) {
      console.log(`  ✅ ${fix.description}`);
      changesMade = true;
    }
  }
  
  if (changesMade) {
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    console.log('  ℹ️  No changes needed');
  }
  
  return changesMade;
}

// Define fixes for each file
const fixes = [
  {
    file: 'src/middleware/authNew.ts',
    fixes: [
      {
        pattern: /const decodedUserId = decoded\.payload\.sub \|\| null;/g,
        replacement: 'const decodedUserId = decoded.payload.sub || "";',
        description: 'Fixed null usage in authNew.ts'
      },
      {
        pattern: /return res\.status\(statusCode\)\.json/g,
        replacement: 'return res.status(typeof statusCode === "number" ? statusCode : 401).json',
        description: 'Fixed status code type'
      }
    ]
  },
  {
    file: 'src/routes/authNew.ts',
    fixes: [
      {
        pattern: /const decodedUserId = decoded\.payload\.sub \|\| null;/g,
        replacement: 'const decodedUserId = decoded.payload.sub || "";',
        description: 'Fixed null usage in authNew routes'
      },
      {
        pattern: /return res\.status\(statusCode\)\.json/g,
        replacement: 'return res.status(typeof statusCode === "number" ? statusCode : 401).json',
        description: 'Fixed status code type in routes'
      }
    ]
  },
  {
    file: 'src/models/flight.ts',
    fixes: [
      {
        pattern: /expiresAt: new Date\(Date\.now\(\) \+ 30 \* 24 \* 60 \* 60 \* 1000\) as string,/g,
        replacement: 'expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),',
        description: 'Fixed Date to string conversion'
      },
      {
        pattern: /createdAt: new Date\(\),/g,
        replacement: 'createdAt: new Date().toISOString(),',
        description: 'Fixed createdAt Date to string'
      },
      {
        pattern: /alertedAt: new Date\(\) as string,/g,
        replacement: 'alertedAt: new Date().toISOString(),',
        description: 'Fixed alertedAt Date to string'
      }
    ]
  },
  {
    file: 'src/middleware/costControl.ts',
    fixes: [
      {
        pattern: /req\.query\.startDate\(/g,
        replacement: 'String(req.query.startDate).substring(',
        description: 'Fixed query parameter function call'
      },
      {
        pattern: /req\.query\.endDate\(/g,
        replacement: 'String(req.query.endDate).substring(',
        description: 'Fixed query parameter function call'
      }
    ]
  },
  {
    file: 'src/routes/authWithResult.ts',
    fixes: [
      {
        pattern: /authenticateToken\(req, res\)/g,
        replacement: 'authenticateToken(req)',
        description: 'Fixed authenticateToken call signature'
      }
    ]
  },
  {
    file: 'src/services/jwt/jwtTokenService.ts',
    fixes: [
      {
        pattern: /blacklistedAt: blacklistedAt as string,/g,
        replacement: 'blacklistedAt: blacklistedAt.toISOString(),',
        description: 'Fixed Date to string conversion in JWT service'
      }
    ]
  },
  {
    file: 'src/services/flights/enhancedAmadeusService.ts',
    fixes: [
      {
        pattern: /const resultStr = result\.value \? result\.value\.toString\(\) : null\n/g,
        replacement: '',
        description: 'Removed duplicate variable declaration'
      }
    ]
  },
  {
    file: 'src/services/flights/flightSearchService.ts',
    fixes: [
      {
        pattern: /const searchResultStr = searchResult\.value \? searchResult\.value\.toString\(\) : null\n/g,
        replacement: '',
        description: 'Removed duplicate variable declaration'
      }
    ]
  }
];

// Run all fixes
console.log('Fixing final TypeScript errors...');
let totalFixed = 0;

for (const fileConfig of fixes) {
  const filePath = path.join(__dirname, '..', fileConfig.file);
  
  if (fs.existsSync(filePath)) {
    if (fixFile(filePath, fileConfig.fixes)) {
      totalFixed++;
    }
  } else {
    console.log(`\n❌ File not found: ${fileConfig.file}`);
  }
}

console.log(`\n✅ Fixed ${totalFixed} files`);
console.log('\nNext step: Run npm run typecheck to verify all errors are resolved');