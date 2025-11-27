#!/usr/bin/env node
/**
 * Script to check Firebase configuration from environment variables
 * Helps diagnose API key expiration and missing config issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', 'env', '.env');

console.log('🔍 Checking Firebase Configuration...\n');

// Check if env file exists
if (!fs.existsSync(envPath)) {
  console.error('❌ Environment file not found at:', envPath);
  console.log('\n💡 Create env/.env file with your Firebase config variables.');
  process.exit(1);
}

// Read and parse env file
let envVars = {};
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (error) {
  console.error('❌ Error reading env file:', error.message);
  process.exit(1);
}

// Required Firebase variables
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

console.log('📋 Environment Variables Status:\n');

let allPresent = true;
let hasExpiredKey = false;

requiredVars.forEach(varName => {
  const value = envVars[varName];
  if (!value) {
    console.log(`  ❌ ${varName}: MISSING`);
    allPresent = false;
  } else {
    // Mask sensitive values
    const masked = varName.includes('API_KEY') 
      ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
      : value;
    console.log(`  ✅ ${varName}: ${masked}`);
    
    // Check for common expired key patterns
    if (varName === 'VITE_FIREBASE_API_KEY') {
      if (value.length < 20) {
        console.log(`     ⚠️  Warning: API key seems too short`);
      }
    }
  }
});

console.log('\n📊 Summary:');
if (!allPresent) {
  console.log('  ❌ Some required variables are missing');
  console.log('\n💡 Fix: Update env/.env file with all required Firebase config values');
  console.log('   See FIREBASE_API_KEY_FIX.md for instructions');
} else {
  console.log('  ✅ All required variables are present');
  console.log('\n💡 If you\'re still getting "api-key-expired" error:');
  console.log('   1. Go to Firebase Console: https://console.firebase.google.com/');
  console.log('   2. Select project: chirp-web-7e581');
  console.log('   3. Go to Project Settings → Your apps');
  console.log('   4. Copy the new API key and update VITE_FIREBASE_API_KEY in env/.env');
  console.log('   5. Restart your dev server');
}

console.log('\n🔗 Quick Links:');
console.log('   Firebase Console: https://console.firebase.google.com/project/chirp-web-7e581/settings/general');
console.log('   Project Settings: https://console.firebase.google.com/project/chirp-web-7e581/settings/general');

