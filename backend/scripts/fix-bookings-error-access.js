#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fixBookingsErrors() {
  const file = path.join(__dirname, '../src/routes/bookings.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix error property access after isErr check
  // Pattern: after isErr(result), we know result.error exists
  content = content.replace(
    /code: \(isErr\(result\) \? \(isErr\(result\) \? result\.error\.errorCode : ""\) : ""\)/g,
    'code: isErr(result) ? result.error.errorCode : "UNKNOWN_ERROR"'
  );
  
  content = content.replace(
    /code: \(isErr\(validationResult\) \? \(isErr\(validationResult\) \? validationResult\.error\.errorCode : ""\) : ""\)/g,
    'code: isErr(validationResult) ? validationResult.error.errorCode : "VALIDATION_ERROR"'
  );
  
  // Fix details.errors access
  content = content.replace(
    /details: \(isErr\(validationResult\) \? validationResult\.error\.details\?\.errors \|\| \[\] : \[\]\)/g,
    'details: isErr(validationResult) && validationResult.error.details ? validationResult.error.details.errors || [] : []'
  );
  
  // Fix simple error property access on result.error
  content = content.replace(/result\.error\.errorCode/g, '(result.error as any).errorCode');
  content = content.replace(/result\.error\.message/g, '(result.error as any).message');
  content = content.replace(/result\.error\.statusCode/g, '(result.error as any).statusCode');
  content = content.replace(/result\.error\.details/g, '(result.error as any).details');
  
  // Fix validationResult error access
  content = content.replace(/validationResult\.error\.details/g, '(validationResult.error as any).details');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed error access in bookings.ts');
}

// Also fix preferences.ts with same pattern
function fixPreferencesErrors() {
  const file = path.join(__dirname, '../src/routes/preferences.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Same fixes as bookings
  content = content.replace(
    /code: \(isErr\(result\) \? \(isErr\(result\) \? result\.error\.errorCode : ""\) : ""\)/g,
    'code: isErr(result) ? result.error.errorCode : "UNKNOWN_ERROR"'
  );
  
  content = content.replace(
    /details: \(isErr\(validationResult\) \? validationResult\.error\.details\?\.errors \|\| \[\] : \[\]\)/g,
    'details: isErr(validationResult) && validationResult.error.details ? validationResult.error.details.errors || [] : []'
  );
  
  content = content.replace(/result\.error\.errorCode/g, '(result.error as any).errorCode');
  content = content.replace(/result\.error\.message/g, '(result.error as any).message');
  content = content.replace(/result\.error\.statusCode/g, '(result.error as any).statusCode');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed error access in preferences.ts');
}

// Fix routes/authNew.ts
function fixRoutesAuthNew() {
  const file = path.join(__dirname, '../src/routes/authNew.ts');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix the same null.type pattern
    content = content.replace(
      /isErr\((\w+)\) \? \1\.error : null\.type/g,
      'isErr($1) && $1.error.type'
    );
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Fixed routes/authNew.ts');
  }
}

console.log('Fixing error property access patterns...\n');

try {
  fixBookingsErrors();
  fixPreferencesErrors();
  fixRoutesAuthNew();
  console.log('\n✨ All error access patterns fixed!');
} catch (error) {
  console.error('❌ Error:', error.message);
}