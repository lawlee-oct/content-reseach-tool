#!/usr/bin/env node

/**
 * Environment Check Script
 * Kiểm tra các API keys có được set không
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('🔍 Content Research Tool - Environment Check');
console.log('='.repeat(60) + '\n');

// Check .env files
const envLocal = path.join(__dirname, '.env.local');
const envFile = path.join(__dirname, '.env');

const envExists = {
  '.env.local': fs.existsSync(envLocal),
  '.env': fs.existsSync(envFile),
};

console.log('📁 Environment Files:');
console.log(`   .env.local: ${envExists['.env.local'] ? '✅ Found' : '❌ Missing'}`);
console.log(`   .env:       ${envExists['.env'] ? '✅ Found' : '❌ Missing'}`);

// Check environment variables
const requiredVars = {
  'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  'SERPAPI_KEY': process.env.SERPAPI_KEY,
};

const optionalVars = {
  'GEMINI_MODEL': process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  'OPENAI_MODEL': process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

console.log('\n🔑 Required API Keys:');
let hasRequiredKey = false;

for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    const masked = value.substring(0, 4) + '...' + value.substring(value.length - 4);
    console.log(`   ${key}: ✅ Set (${masked})`);
    hasRequiredKey = true;
  } else {
    console.log(`   ${key}: ❌ Not set`);
  }
}

console.log('\n⚙️  Optional Configuration:');
for (const [key, value] of Object.entries(optionalVars)) {
  console.log(`   ${key}: ${value}`);
}

// Check Node.js version
console.log(`\n📦 Runtime:
   Node.js: ${process.version}
   npm: ${require('child_process').execSync('npm -v').toString().trim()}`);

// Recommendations
console.log('\n' + '─'.repeat(60));
if (!hasRequiredKey) {
  console.log('❌ ISSUE: No LLM API key configured\n');
  console.log('🔧 To fix, choose one of:\n');
  console.log('   1️⃣  Use Google Gemini (Free):');
  console.log('      - Get key: https://aistudio.google.com/app/apikey');
  console.log('      - Add to .env.local: GEMINI_API_KEY=your_key\n');
  console.log('   2️⃣  Use OpenAI:');
  console.log('      - Get key: https://platform.openai.com/api-keys');
  console.log('      - Add to .env.local: OPENAI_API_KEY=your_key\n');
  console.log('   3️⃣  Use Both (Recommended):');
  console.log('      - Set both keys in .env.local');
  console.log('      - Gemini as primary, OpenAI as fallback\n');
  process.exit(1);
} else {
  console.log('✅ LLM configured - flow should work!\n');
  if (!requiredVars['SERPAPI_KEY']) {
    console.log('⚠️  Note: Agent 1 (Discovery) needs SERPAPI_KEY');
    console.log('   Get at: https://serpapi.com (requires payment)\n');
  }
  process.exit(0);
}
