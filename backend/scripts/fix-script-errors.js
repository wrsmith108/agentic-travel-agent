#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Fix errors introduced by previous scripts
 */

function fixEnhancedAmadeusService() {
  const filePath = path.join(__dirname, '../src/services/flights/enhancedAmadeusService.ts');
  console.log('\nFixing enhancedAmadeusService.ts...');
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the incorrect import changes
  content = content.replace(/import { Result, ok, err, isOk, isErr } from '\.\.\/\.\.\/utils\/resultString';/g, 
                          "import { Result, ok, err, isOk, isErr } from '../../utils/result';");
  content = content.replace(/import { Result, ok, err, isOk } from '@\/utils\/resultString';/g, "");
  
  // Fix incorrect resultString references
  content = content.replace(/\.resultString\?/g, '.result?');
  content = content.replace(/const resultString = result\.value/g, 'const resultStr = result.value');
  content = content.replace(/const resultString = await/g, 'const result = await');
  content = content.replace(/for \(const resultString of results\)/g, 'for (const result of results)');
  content = content.replace(/if \(resultString\.ok && result\.value\)/g, 'if (result.ok && result.value)');
  content = content.replace(/if \(resultString\.ok && result\.value\)/g, 'if (result.ok && result.value)');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('  ✅ Fixed result/resultString issues');
}

function fixFlightSearchService() {
  const filePath = path.join(__dirname, '../src/services/flights/flightSearchService.ts');
  console.log('\nFixing flightSearchService.ts...');
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix incorrect variable name changes
  content = content.replace(/const searchResultString = await/g, 'const searchResult = await');
  content = content.replace(/if \(!isOk\(searchResultString\)\)/g, 'if (!isOk(searchResult))');
  content = content.replace(/return err\(\(isErr\(searchResultString\) \? searchResultString\.error/g, 
                          'return err((isErr(searchResult) ? searchResult.error');
  content = content.replace(/const flights = isOk\(searchResultString\) \? searchResult\.value/g, 
                          'const flights = isOk(searchResult) ? searchResult.value');
  
  content = content.replace(/const searchResultString = await this\.redisClient\.get/g, 
                          'const searchResult = await this.redisClient.get');
  content = content.replace(/const searchResultString = searchResult\.value/g, 
                          'const searchResultStr = searchResult.value');
  content = content.replace(/if \(isOk\(searchResultString\) && searchResult\.value\)/g, 
                          'if (isOk(searchResult) && searchResult.value)');
  
  // Fix other incorrect replacements
  content = content.replace(/if \(isOk\(searchResultString\) && searchResult\.value\.length > 0\)/g,
                          'if (isOk(searchResult) && searchResult.value.length > 0)');
  content = content.replace(/const prices = isOk\(searchResultString\) \? searchResult\.value/g,
                          'const prices = isOk(searchResult) ? searchResult.value');
  content = content.replace(/const bestFlight = isOk\(searchResultString\) \? searchResult\.value/g,
                          'const bestFlight = isOk(searchResult) ? searchResult.value');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('  ✅ Fixed searchResult/searchResultString issues');
}

// Run fixes
console.log('Fixing script-introduced errors...');

try {
  fixEnhancedAmadeusService();
  fixFlightSearchService();
  console.log('\n✅ All script errors fixed');
} catch (error) {
  console.error('\n❌ Error:', error.message);
}

console.log('\nNext step: Run npm run typecheck again');