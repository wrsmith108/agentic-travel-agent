#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function addTypeAssertions(content) {
  let changeCount = 0;
  let fixed = content;
  
  // Fix specific booking result properties
  const bookingProperties = [
    'bookingId', 'pnr', 'status', 'paymentStatus', 'ticketingDeadline',
    'contactInfo', 'createdAt', 'length', 'flightOffer', 'travelers',
    'payment', 'passengers', 'totalAmount', 'currency'
  ];
  
  bookingProperties.forEach(prop => {
    const pattern = new RegExp(`result\\.value\\.${prop}`, 'g');
    fixed = fixed.replace(pattern, (match) => {
      changeCount++;
      return `(result.value as any).${prop}`;
    });
  });
  
  // Fix data. access patterns
  const dataProperties = ['bookings', 'booking', 'alerts', 'preferences'];
  dataProperties.forEach(prop => {
    const pattern = new RegExp(`data\\.${prop}`, 'g');
    fixed = fixed.replace(pattern, (match, offset) => {
      // Check context - only fix if it's after res.json
      const before = fixed.substring(Math.max(0, offset - 100), offset);
      if (before.includes('data:') || before.includes('res.json')) {
        changeCount++;
        return `(data as any).${prop}`;
      }
      return match;
    });
  });
  
  // Fix error. property access on unknown types
  fixed = fixed.replace(/error\.message/g, (match, offset) => {
    const before = fixed.substring(Math.max(0, offset - 50), offset);
    if (before.includes('catch') || before.includes('}')) {
      changeCount++;
      return '(error as any).message';
    }
    return match;
  });
  
  // Fix SafeParseSuccess .value access
  fixed = fixed.replace(/parsed\.value/g, (match, offset) => {
    const before = fixed.substring(Math.max(0, offset - 100), offset);
    if (before.includes('safeParse') && !before.includes('zodToResult')) {
      changeCount++;
      return 'parsed.data';
    }
    return match;
  });
  
  return { fixed, changeCount };
}

// Focus on routes/bookings.ts which has the most issues
const targetFile = path.join(__dirname, '../src/routes/bookings.ts');

if (fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  const { fixed, changeCount } = addTypeAssertions(content);
  
  if (changeCount > 0) {
    fs.writeFileSync(targetFile, fixed, 'utf8');
    console.log(`✅ Added ${changeCount} type assertions in bookings.ts`);
  } else {
    console.log('ℹ️  No changes needed in bookings.ts');
  }
} else {
  console.log('❌ Could not find bookings.ts');
}

// Also check other route files
const otherRoutes = ['auth.ts', 'authNew.ts', 'preferences.ts', 'flights.ts'];
otherRoutes.forEach(fileName => {
  const filePath = path.join(__dirname, '../src/routes', fileName);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { fixed, changeCount } = addTypeAssertions(content);
    
    if (changeCount > 0) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Added ${changeCount} type assertions in ${fileName}`);
    }
  }
});