#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const apiDir = './app/api';
const libDir = './lib';

// Patterns to find hardcoded weeks
const patterns = [
  /2025-week-[0-9]/g,
  /week.*=.*[0-9]/g,
  /weekNumber.*=.*[0-9]/g,
  /getCurrentNFLWeek\(\).*[0-9]/g
];

function findHardcodedWeeks(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      results.push(...findHardcodedWeeks(fullPath));
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          patterns.forEach(pattern => {
            const matches = line.match(pattern);
            if (matches) {
              results.push({
                file: fullPath,
                line: index + 1,
                content: line.trim(),
                matches
              });
            }
          });
        });
      } catch (error) {
        console.error(`Error reading ${fullPath}:`, error.message);
      }
    }
  }
  
  return results;
}

function main() {
  console.log('🔍 Scanning for hardcoded weeks...\n');
  
  const apiResults = findHardcodedWeeks(apiDir);
  const libResults = findHardcodedWeeks(libDir);
  
  const allResults = [...apiResults, ...libResults];
  
  if (allResults.length === 0) {
    console.log('✅ No hardcoded weeks found!');
    return;
  }
  
  console.log(`❌ Found ${allResults.length} instances of hardcoded weeks:\n`);
  
  const groupedByFile = allResults.reduce((acc, result) => {
    if (!acc[result.file]) {
      acc[result.file] = [];
    }
    acc[result.file].push(result);
    return acc;
  }, {});
  
  Object.entries(groupedByFile).forEach(([file, results]) => {
    console.log(`📁 ${file}:`);
    results.forEach(result => {
      console.log(`   Line ${result.line}: ${result.content}`);
    });
    console.log('');
  });
  
  console.log('\n🔧 Recommended fixes:');
  console.log('1. Replace hardcoded weeks with getCurrentNFLWeek()');
  console.log('2. Use query parameters for week selection');
  console.log('3. Default to current week when no week is specified');
  console.log('4. Remove debugging APIs with hardcoded weeks');
}

if (require.main === module) {
  main();
}