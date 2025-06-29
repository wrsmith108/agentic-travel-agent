const fs = require('fs');
const path = require('path');

function createBackup(filePath) {
  const backupPath = filePath + '.result.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
}

// Files with known result scoping issues
const fixes = [
  {
    file: 'src/services/booking/flightBookingService.ts',
    patterns: [
      {
        // Fix line 186: resultString = result.value issue
        from: /const resultString = await this\.redisClient\.get\(key\);\s*\n\s*const resultString = result\.value \? result\.value\.toString\(\) : null/g,
        to: 'const resultString = await this.redisClient.get(key);'
      },
      {
        // Fix result.value references when we have resultString
        from: /if \(!isOk\(resultString\) \|\| isErr\(resultString\)\) \{[\s\S]*?\}\s*const bookingData: BookingData = JSON\.parse\(result\.value\);/g,
        to: `if (!resultString) {
        return err(new AppError(404, 'Booking not found', ErrorCodes.NOT_FOUND));
      }

      const bookingData: BookingData = JSON.parse(resultString);`
      },
      {
        // Fix other result.value references
        from: /JSON\.parse\(result\.value\)/g,
        to: 'JSON.parse(resultString)'
      }
    ]
  }
];

console.log('Fixing result scoping issues...');

fixes.forEach(({ file, patterns }) => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;
    
    patterns.forEach(({ from, to }) => {
      if (from.test(content)) {
        createBackup(filePath);
        content = content.replace(from, to);
        changes++;
      }
    });
    
    if (changes > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed ${changes} result scoping issues in ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Manual fixes needed for remaining issues');
console.log('Checking for more patterns...');

// Check for remaining undefined result variables
const checkFiles = [
  'src/services/booking/flightBookingService.ts',
  'src/services/batch/priceMonitoringProcessor.ts'
];

checkFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('result.') && !line.includes('const result') && !line.includes('let result')) {
        console.log(`${file}:${index + 1} - ${line.trim()}`);
      }
    });
  }
});