/**
 * Verify Platform Accounts Script
 * 
 * Verifies platform accounts can sign in and optionally resets passwords
 * 
 * Usage: 
 *   node scripts/verify-platform-accounts.js
 *   node scripts/verify-platform-accounts.js --reset-passwords
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { 
  getFirestore, 
  doc,
  getDoc,
} from 'firebase/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PLATFORM_ACCOUNTS = [
  {
    name: 'Kural',
    handle: 'kural',
    email: process.env.KURAL_PLATFORM_EMAIL || 'platform@kurral.app',
    password: process.env.KURAL_PLATFORM_PASSWORD,
  },
  {
    name: 'Kural News',
    handle: 'kuralnews',
    email: process.env.KURAL_NEWS_EMAIL || 'news@kurral.app',
    password: process.env.KURAL_NEWS_PASSWORD,
  },
];

const shouldResetPasswords = process.argv.includes('--reset-passwords');

/**
 * Verify account can sign in
 */
async function verifyAccount(account) {
  const { name, email, password } = account;
  
  console.log(`\n🔍 Verifying: ${name} (${email})`);
  
  if (!password) {
    console.log(`   ⚠️  No password provided in environment variables`);
    console.log(`   💡 Add KURAL_PLATFORM_PASSWORD or KURAL_NEWS_PASSWORD to .env`);
    return { success: false, reason: 'No password provided' };
  }
  
  try {
    // Try to sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log(`   ✅ Sign in successful!`);
    console.log(`      UID: ${user.uid}`);
    console.log(`      Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    console.log(`      Disabled: ${user.disabled ? 'Yes' : 'No'}`);
    
    // Check Firestore document
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log(`      Firestore Document: ✅ Exists`);
      console.log(`      Handle: @${userData.handle}`);
      console.log(`      Platform Account: ${userData.isPlatformAccount ? 'Yes' : 'No'}`);
      console.log(`      Onboarding: ${userData.onboardingCompleted ? 'Completed' : 'Not completed'}`);
    } else {
      console.log(`      Firestore Document: ❌ Missing`);
    }
    
    // Sign out
    await auth.signOut();
    
    return { success: true, user };
    
  } catch (error) {
    console.log(`   ❌ Sign in failed: ${error.code}`);
    console.log(`      Error: ${error.message}`);
    
    // Provide helpful error messages
    if (error.code === 'auth/user-not-found') {
      console.log(`   💡 Account does not exist. Run: npm run create:platform`);
    } else if (error.code === 'auth/wrong-password') {
      console.log(`   💡 Password is incorrect. Options:`);
      console.log(`      1. Check if password was copied correctly (watch for special characters)`);
      console.log(`      2. Reset password: npm run verify:platform --reset-passwords`);
      console.log(`      3. Update password in .env and run create:platform again`);
    } else if (error.code === 'auth/invalid-email') {
      console.log(`   💡 Email format is invalid`);
    } else if (error.code === 'auth/user-disabled') {
      console.log(`   💡 Account is disabled. Check Firebase Console`);
    } else if (error.code === 'auth/too-many-requests') {
      console.log(`   💡 Too many failed attempts. Wait a few minutes`);
    }
    
    return { success: false, error: error.code, message: error.message };
  }
}

/**
 * Send password reset email
 */
async function resetPassword(account) {
  const { name, email } = account;
  
  console.log(`\n📧 Sending password reset email to: ${email}`);
  
  try {
    await sendPasswordResetEmail(auth, email);
    console.log(`   ✅ Password reset email sent!`);
    console.log(`   💡 Check the email inbox (or spam folder) for reset link`);
    return { success: true };
  } catch (error) {
    console.log(`   ❌ Failed to send reset email: ${error.code}`);
    console.log(`      Error: ${error.message}`);
    return { success: false, error: error.code };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔐 Verifying Platform Accounts');
  console.log('='.repeat(60));
  
  if (shouldResetPasswords) {
    console.log('\n⚠️  RESET MODE: Will send password reset emails\n');
  }
  
  const results = [];
  
  for (const account of PLATFORM_ACCOUNTS) {
    if (shouldResetPasswords) {
      const resetResult = await resetPassword(account);
      results.push({ account: account.name, type: 'reset', ...resetResult });
    } else {
      const verifyResult = await verifyAccount(account);
      results.push({ account: account.name, type: 'verify', ...verifyResult });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  
  if (shouldResetPasswords) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log('\n✅ Password reset emails sent:');
      successful.forEach(r => {
        console.log(`   - ${r.account}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed to send reset emails:');
      failed.forEach(r => {
        console.log(`   - ${r.account}: ${r.error}`);
      });
    }
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Check email inbox (and spam folder) for reset links');
    console.log('   2. Click reset link and set new password');
    console.log('   3. Update .env file with new passwords:');
    console.log('      KURAL_PLATFORM_PASSWORD=new-password');
    console.log('      KURAL_NEWS_PASSWORD=new-password');
    
  } else {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log('\n✅ Accounts verified successfully:');
      successful.forEach(r => {
        console.log(`   - ${r.account}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Accounts with issues:');
      failed.forEach(r => {
        console.log(`   - ${r.account}: ${r.reason || r.error || 'Unknown error'}`);
      });
      
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Make sure passwords are in .env file');
      console.log('   2. Check for special character issues when copying passwords');
      console.log('   3. Try resetting passwords: npm run verify:platform --reset-passwords');
      console.log('   4. Verify accounts exist: npm run create:platform');
    }
  }
  
  console.log('\n✅ Verification complete!\n');
  
  process.exit(results.some(r => !r.success) ? 1 : 0);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

