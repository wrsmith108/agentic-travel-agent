const fs = require('fs');
const path = require('path');

function createBackup(filePath) {
  const backupPath = filePath + '.assign.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
}

function findTSFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
      files.push(...findTSFiles(fullPath));
    } else if (item.endsWith('.ts') && !item.endsWith('.test.ts') && !item.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = findTSFiles(srcDir);

let totalChanges = 0;

console.log('Fixing common type assignment issues...');

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let changes = 0;
    
    // Fix 1: deadline.toISOString() as string should be just deadline.toISOString()
    if (content.includes('deadline as string')) {
      createBackup(file);
      content = content.replace(/deadline as string/g, 'deadline.toISOString()');
      changes++;
    }
    
    // Fix 2: Type 'string' is not assignable to type 'Date' - usually in assignments
    // Look for lines like someDate: dateString and change to someDate: new Date(dateString).toISOString()
    if (content.includes('createdAt: createTimestamp()') || content.includes('updatedAt: createTimestamp()')) {
      // createTimestamp probably returns string already, no change needed
    }
    
    // Fix 3: Common Return type issues
    const returnAsStringPattern = /return.*? as string$/gm;
    if (returnAsStringPattern.test(content)) {
      createBackup(file);
      // Remove unnecessary 'as string' casts
      content = content.replace(/return (.*?) as string;/g, 'return $1;');
      changes++;
    }
    
    // Fix 4: Map.entries issues - await results before accessing
    if (content.includes('.entries()') && content.includes('Promise<Map')) {
      createBackup(file);
      content = content.replace(
        /(.*)(await.*?)(\.entries\(\))/g,
        '$1(await $2).entries()'
      );
      changes++;
    }
    
    if (changes > 0) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Fixed ${changes} type assignment issues in ${path.relative(srcDir, file)}`);
      totalChanges += changes;
    }
    
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal assignment issues fixed: ${totalChanges}`);