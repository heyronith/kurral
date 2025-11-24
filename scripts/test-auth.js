/**
 * Authentication Test Script
 * Tests signup, login, and logout functionality
 * 
 * Usage: node scripts/test-auth.js
 * 
 * Note: This requires Firebase credentials in .env file
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const testEmail = process.env.TEST_EMAIL || `test-${Date.now()}@example.com`;
const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';
const testName = 'Test User';
const testHandle = `testuser${Date.now()}`;

async function testSignup() {
  console.log('🧪 Testing signup...');
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    console.log('✅ Signup successful:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('❌ Signup failed:', error.message);
    throw error;
  }
}

async function testLogin() {
  console.log('🧪 Testing login...');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    console.log('✅ Login successful:', userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

async function testLogout() {
  console.log('🧪 Testing logout...');
  try {
    await signOut(auth);
    console.log('✅ Logout successful');
  } catch (error) {
    console.error('❌ Logout failed:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Starting authentication tests...\n');
  
  // Check if credentials are configured
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }

  try {
    // Test signup
    await testSignup();
    console.log('');
    
    // Test logout
    await testLogout();
    console.log('');
    
    // Test login
    await testLogin();
    console.log('');
    
    // Test logout again
    await testLogout();
    console.log('');
    
    console.log('✅ All authentication tests passed!');
    console.log('\n📝 Test user credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log('\n💡 Tip: Add these to your .env file to use with test:persistence:');
    console.log(`   TEST_EMAIL=${testEmail}`);
    console.log(`   TEST_PASSWORD=${testPassword}`);
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

runTests();

