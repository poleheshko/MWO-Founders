#!/usr/bin/env node

/**
 * Script to convert Google Service Account JSON file to a single-line string
 * for use in Replit Secrets or environment variables
 * 
 * Usage: node scripts/convert-google-key.js [path-to-key.json]
 */

const fs = require('fs');
const path = require('path');

const keyPath = process.argv[2] || './credentials/mwo-founders-02a1503a4bee.json';

try {
  // Read the JSON file
  const keyContent = fs.readFileSync(keyPath, 'utf8');
  
  // Parse to validate it's valid JSON
  const keyJson = JSON.parse(keyContent);
  
  // Convert back to string (single line, no formatting)
  const keyString = JSON.stringify(keyJson);
  
  console.log('\n✅ Google Service Account Key converted successfully!\n');
  console.log('📋 Copy the following and paste it into Replit Secrets as GOOGLE_SERVICE_ACCOUNT_KEY:\n');
  console.log('─'.repeat(80));
  console.log(keyString);
  console.log('─'.repeat(80));
  console.log('\n💡 Tip: The key is already escaped and ready to use.\n');
  
} catch (error) {
  console.error('❌ Error converting Google Service Account Key:');
  console.error(error.message);
  process.exit(1);
}
