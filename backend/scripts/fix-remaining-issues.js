#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Fix null usage in middleware/authNew.ts
function fixAuthNew() {
  const file = path.join(__dirname, '../src/middleware/authNew.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix null usage
  content = content.replace(/decoded\.payload\.sub \|\| null/g, 'decoded.payload.sub || ""');
  
  // Fix status code handling
  content = content.replace(/return res\.status\(statusCode\)/g, 
    'return res.status(typeof statusCode === "number" ? statusCode : 401)');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed authNew.ts');
}

// Fix null usage in routes/authNew.ts
function fixRoutesAuthNew() {
  const file = path.join(__dirname, '../src/routes/authNew.ts');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix null usage
    content = content.replace(/decoded\.payload\.sub \|\| null/g, 'decoded.payload.sub || ""');
    
    // Fix status code handling
    content = content.replace(/return res\.status\(statusCode\)/g, 
      'return res.status(typeof statusCode === "number" ? statusCode : 401)');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Fixed routes/authNew.ts');
  }
}

// Fix function calls in costControl.ts
function fixCostControl() {
  const file = path.join(__dirname, '../src/middleware/costControl.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix query parameter access
  content = content.replace(/req\.query\.startDate\(/g, 'String(req.query.startDate).substring(');
  content = content.replace(/req\.query\.endDate\(/g, 'String(req.query.endDate).substring(');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed costControl.ts');
}

// Fix authenticateToken call in authWithResult.ts
function fixAuthWithResult() {
  const file = path.join(__dirname, '../src/routes/authWithResult.ts');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix function call signature
    content = content.replace(/authenticateToken\(req, res\)/g, 'authenticateToken(req)');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Fixed authWithResult.ts');
  }
}

// Fix SafeParseSuccess .value access
function fixSafeParseValue() {
  const file = path.join(__dirname, '../src/routes/bookings.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix SafeParseSuccess access
  content = content.replace(/filtersResult\.value/g, 'filtersResult.data');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed SafeParseSuccess in bookings.ts');
}

// Fix jwt.ts boolean type issues
function fixJwtTypes() {
  const file = path.join(__dirname, '../src/utils/jwt.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Fix decode/verify type issues
  content = content.replace(/const decoded = jwt\.decode\(token\)/g, 
    'const decoded = jwt.decode(token) as JWTPayload | null');
  
  content = content.replace(/const verified = jwt\.verify/g, 
    'const verified = jwt.verify');
  
  // Fix boolean assignment
  content = content.replace(/: boolean = decoded && decoded !== null/g, 
    ' = decoded');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed jwt.ts types');
}

// Fix testFlightSearch.ts Date() calls
function fixTestFlightSearch() {
  const file = path.join(__dirname, '../src/utils/testFlightSearch.ts');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix Date() calls
    content = content.replace(/Date\(\)\.substring/g, 'new Date().toISOString().substring');
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Fixed testFlightSearch.ts');
  }
}

// Fix zodToResult.ts AppError type
function fixZodToResult() {
  const file = path.join(__dirname, '../src/utils/zodToResult.ts');
  let content = fs.readFileSync(file, 'utf8');
  
  // Add name property to error object
  content = content.replace(
    /return err\({/g, 
    'return err({\n      name: "ValidationError",');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Fixed zodToResult.ts');
}

// Fix duplicate imports in security scanner
function fixSecurityScanner() {
  const file = path.join(__dirname, '../src/services/security/securityScanner.ts');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove duplicate imports (keep only first)
    const lines = content.split('\n');
    const resultImportIndices = [];
    
    lines.forEach((line, idx) => {
      if (line.includes('import') && line.includes('Result') && line.includes('from')) {
        resultImportIndices.push(idx);
      }
    });
    
    // Remove second import if exists
    if (resultImportIndices.length > 1) {
      lines.splice(resultImportIndices[1], 1);
    }
    
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('✅ Fixed securityScanner.ts imports');
  }
}

// Run all fixes
console.log('Fixing remaining TypeScript issues...\n');

try {
  fixAuthNew();
  fixRoutesAuthNew();
  fixCostControl();
  fixAuthWithResult();
  fixSafeParseValue();
  fixJwtTypes();
  fixTestFlightSearch();
  fixZodToResult();
  fixSecurityScanner();
  
  console.log('\n✨ All fixes applied!');
} catch (error) {
  console.error('❌ Error:', error.message);
}