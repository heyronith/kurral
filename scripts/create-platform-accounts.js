/**
 * Create Platform Accounts Script
 * 
 * Creates two platform accounts: "Kural" and "Kural News"
 * These are official platform accounts that can be used for announcements, news, etc.
 * 
 * Usage: 
 *   node scripts/create-platform-accounts.js
 * 
 * Environment Variables Required:
 *   - VITE_FIREBASE_API_KEY (or FIREBASE_API_KEY)
 *   - VITE_FIREBASE_AUTH_DOMAIN (or FIREBASE_AUTH_DOMAIN)
 *   - VITE_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID)
 *   - VITE_FIREBASE_STORAGE_BUCKET (or FIREBASE_STORAGE_BUCKET)
 *   - VITE_FIREBASE_MESSAGING_SENDER_ID (or FIREBASE_MESSAGING_SENDER_ID)
 *   - VITE_FIREBASE_APP_ID (or FIREBASE_APP_ID)
 * 
 * Optional:
 *   - KURAL_PLATFORM_EMAIL (default: platform@kurral.app)
 *   - KURAL_PLATFORM_PASSWORD (auto-generated if not set)
 *   - KURAL_NEWS_EMAIL (default: news@kurral.app)
 *   - KURAL_NEWS_PASSWORD (auto-generated if not set)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

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

// Validate Firebase config
const requiredVars = ['apiKey', 'authDomain', 'projectId'];
const missingVars = requiredVars.filter(key => !firebaseConfig[key]);
if (missingVars.length > 0) {
  console.error('❌ Missing required Firebase environment variables:');
  missingVars.forEach(key => {
    console.error(`   - ${key === 'apiKey' ? 'VITE_FIREBASE_API_KEY' : key === 'authDomain' ? 'VITE_FIREBASE_AUTH_DOMAIN' : 'VITE_FIREBASE_PROJECT_ID'}`);
  });
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Generate secure random password
function generateSecurePassword(length = 32) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  // Ensure at least one of each required character type
  if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
  if (!/[A-Z]/.test(password)) password = password.slice(0, -1) + 'A';
  if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
  if (!/[!@#$%^&*]/.test(password)) password = password.slice(0, -1) + '!';
  return password;
}

// Platform account definitions
const PLATFORM_ACCOUNTS = [
  {
    name: 'Kural',
    handle: 'kural',
    email: process.env.KURAL_PLATFORM_EMAIL || 'platform@kurral.app',
    password: process.env.KURAL_PLATFORM_PASSWORD || generateSecurePassword(),
    bio: 'Official Kural platform account. Updates, announcements, and community highlights.',
    interests: ['platform', 'announcements', 'community'],
    topics: ['platform', 'announcements', 'community'],
    platformAccountType: 'main',
  },
  {
    name: 'Kural News',
    handle: 'kuralnews',
    email: process.env.KURAL_NEWS_EMAIL || 'news@kurral.app',
    password: process.env.KURAL_NEWS_PASSWORD || generateSecurePassword(),
    bio: 'Official Kural News account. Curated news, updates, and important information.',
    interests: ['news', 'updates', 'information'],
    topics: ['news', 'updates', 'information'],
    platformAccountType: 'news',
  },
  {
    name: 'Kural Tech',
    handle: 'kuraltech',
    email: process.env.KURAL_TECH_EMAIL || 'tech@kurral.app',
    password: process.env.KURAL_TECH_PASSWORD || generateSecurePassword(),
    bio: 'Technology news, innovations, and updates. AI, software, startups, and the future of tech.',
    interests: ['technology', 'tech', 'ai', 'software', 'innovation', 'startups'],
    topics: ['technology', 'tech', 'ai', 'software', 'innovation'],
    platformAccountType: 'tech',
  },
  {
    name: 'Kural Science',
    handle: 'kuralscience',
    email: process.env.KURAL_SCIENCE_EMAIL || 'science@kurral.app',
    password: process.env.KURAL_SCIENCE_PASSWORD || generateSecurePassword(),
    bio: 'Science news, discoveries, and research. Space, climate, medicine, and breakthroughs.',
    interests: ['science', 'research', 'discovery', 'space', 'climate', 'medicine'],
    topics: ['science', 'research', 'discovery', 'space', 'climate'],
    platformAccountType: 'science',
  },
  {
    name: 'Kural Business',
    handle: 'kuralbusiness',
    email: process.env.KURAL_BUSINESS_EMAIL || 'business@kurral.app',
    password: process.env.KURAL_BUSINESS_PASSWORD || generateSecurePassword(),
    bio: 'Business and finance news. Markets, economy, startups, and corporate updates.',
    interests: ['business', 'finance', 'economy', 'markets', 'startups', 'corporate'],
    topics: ['business', 'finance', 'economy', 'markets'],
    platformAccountType: 'business',
  },
  {
    name: 'Kural Sports',
    handle: 'kuralsports',
    email: process.env.KURAL_SPORTS_EMAIL || 'sports@kurral.app',
    password: process.env.KURAL_SPORTS_PASSWORD || generateSecurePassword(),
    bio: 'Sports news, scores, and updates. All major leagues and competitions.',
    interests: ['sports', 'football', 'basketball', 'soccer', 'olympics', 'athletics'],
    topics: ['sports', 'football', 'basketball', 'soccer', 'olympics'],
    platformAccountType: 'sports',
  },
  {
    name: 'Kural Health',
    handle: 'kuralhealth',
    email: process.env.KURAL_HEALTH_EMAIL || 'health@kurral.app',
    password: process.env.KURAL_HEALTH_PASSWORD || generateSecurePassword(),
    bio: 'Health and wellness news. Medical breakthroughs, public health, and wellness tips.',
    interests: ['health', 'medical', 'wellness', 'medicine', 'public health', 'fitness'],
    topics: ['health', 'medical', 'wellness', 'medicine'],
    platformAccountType: 'health',
  },
  {
    name: 'Kural Entertainment',
    handle: 'kuralentertainment',
    email: process.env.KURAL_ENTERTAINMENT_EMAIL || 'entertainment@kurral.app',
    password: process.env.KURAL_ENTERTAINMENT_PASSWORD || generateSecurePassword(),
    bio: 'Entertainment news. Movies, TV, music, celebrities, and pop culture.',
    interests: ['entertainment', 'movies', 'tv', 'music', 'celebrity', 'pop culture'],
    topics: ['entertainment', 'movies', 'tv', 'music'],
    platformAccountType: 'entertainment',
  },
];

/**
 * Create or update a platform account
 */
async function createPlatformAccount(accountData) {
  const { name, handle, email, password, bio, interests, topics, platformAccountType } = accountData;
  
  console.log(`\n📝 Creating platform account: ${name} (@${handle})`);
  console.log(`   Email: ${email}`);
  
  try {
    let userId;
    let isNewUser = false;
    
    // Try to create Firebase Auth user
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userId = userCredential.user.uid;
      isNewUser = true;
      console.log(`   ✅ Firebase Auth account created (UID: ${userId})`);
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        // User already exists, sign in to get UID
        console.log(`   ⚠️  Firebase Auth account already exists, signing in...`);
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          userId = userCredential.user.uid;
          console.log(`   ✅ Signed in to existing account (UID: ${userId})`);
        } catch (signInError) {
          console.error(`   ❌ Failed to sign in to existing account: ${signInError.message}`);
          console.error(`   💡 If you need to reset the password, do it manually in Firebase Console`);
          throw new Error(`Cannot access existing account. Password may be incorrect or account may need reset.`);
        }
      } else {
        throw authError;
      }
    }
    
    // Check if Firestore user document exists
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    
    const now = Timestamp.now();
    const userData = {
      name: name,
      handle: handle.toLowerCase(),
      email: email,
      bio: bio,
      interests: interests || [],
      topics: topics || [],
      createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : now,
      following: userDocSnap.exists() ? (userDocSnap.data().following || []) : [],
      bookmarks: userDocSnap.exists() ? (userDocSnap.data().bookmarks || []) : [],
      onboardingCompleted: true,
      firstTimeUser: false,
      // Mark as platform account (custom field)
      isPlatformAccount: true,
      platformAccountType: platformAccountType || (handle === 'kural' ? 'main' : 'news'),
      // Kurral Score setup
      kurralScore: userDocSnap.exists() && userDocSnap.data().kurralScore ? userDocSnap.data().kurralScore : {
        score: 100, // Platform accounts start with high score
        lastUpdated: now,
        components: {
          qualityHistory: 100,
          violationHistory: 0,
          engagementQuality: 100,
          consistency: 100,
          communityTrust: 100,
        },
        history: [],
      },
      // For You Config
      forYouConfig: userDocSnap.exists() && userDocSnap.data().forYouConfig ? userDocSnap.data().forYouConfig : {
        followingWeight: 'high',
        boostActiveConversations: true,
        likedTopics: topics || [],
        mutedTopics: [],
        timeWindowDays: 30,
      },
      // Value stats
      valueStats: userDocSnap.exists() && userDocSnap.data().valueStats ? userDocSnap.data().valueStats : {
        postValue30d: 0,
        commentValue30d: 0,
        lifetimePostValue: 0,
        lifetimeCommentValue: 0,
        lastUpdated: now,
      },
    };
    
    if (userDocSnap.exists()) {
      // Update existing user document
      await updateDoc(userDocRef, {
        name: userData.name,
        handle: userData.handle,
        email: userData.email,
        bio: userData.bio,
        interests: userData.interests,
        topics: userData.topics,
        isPlatformAccount: true,
        platformAccountType: userData.platformAccountType,
        onboardingCompleted: true,
        firstTimeUser: false,
        // Only update kurralScore if it doesn't exist
        ...(userDocSnap.data().kurralScore ? {} : { kurralScore: userData.kurralScore }),
        // Only update forYouConfig if it doesn't exist
        ...(userDocSnap.data().forYouConfig ? {} : { forYouConfig: userData.forYouConfig }),
        // Only update valueStats if it doesn't exist
        ...(userDocSnap.data().valueStats ? {} : { valueStats: userData.valueStats }),
      });
      console.log(`   ✅ Updated Firestore user document`);
    } else {
      // Create new user document
      await setDoc(userDocRef, userData);
      console.log(`   ✅ Created Firestore user document`);
    }
    
    // Verify the user document
    const verifyDoc = await getDoc(userDocRef);
    if (!verifyDoc.exists()) {
      throw new Error('Failed to verify user document creation');
    }
    
    const createdUser = verifyDoc.data();
    console.log(`   ✅ Platform account ready:`);
    console.log(`      - Name: ${createdUser.name}`);
    console.log(`      - Handle: @${createdUser.handle}`);
    console.log(`      - Email: ${createdUser.email}`);
    console.log(`      - Platform Account: ${createdUser.isPlatformAccount ? 'Yes' : 'No'}`);
    console.log(`      - Type: ${createdUser.platformAccountType || 'N/A'}`);
    console.log(`      - Onboarding: ${createdUser.onboardingCompleted ? 'Completed' : 'Not completed'}`);
    
    return {
      success: true,
      userId,
      email,
      password: isNewUser ? password : '[EXISTING - not shown]',
      handle: createdUser.handle,
      isNewUser,
    };
    
  } catch (error) {
    console.error(`   ❌ Error creating platform account ${name}:`, error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Creating Platform Accounts');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const account of PLATFORM_ACCOUNTS) {
    try {
      const result = await createPlatformAccount(account);
      results.push(result);
    } catch (error) {
      console.error(`\n❌ Failed to create ${account.name}:`, error.message);
      results.push({
        success: false,
        account: account.name,
        error: error.message,
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  successful.forEach(result => {
    console.log(`\n✅ ${result.handle || result.account}:`);
    console.log(`   User ID: ${result.userId}`);
    console.log(`   Email: ${result.email}`);
    if (result.isNewUser) {
      console.log(`   Password: ${result.password}`);
      console.log(`   ⚠️  SAVE THIS PASSWORD SECURELY!`);
    } else {
      console.log(`   Status: Existing account (password not shown)`);
    }
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed Accounts:`);
    failed.forEach(result => {
      console.log(`   - ${result.account}: ${result.error}`);
    });
  }
  
  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Save the passwords securely (use a password manager)`);
  console.log(`   2. Store credentials in environment variables for automation:`);
  successful.forEach(result => {
    if (result.isNewUser) {
      const envVarMap = {
        'kural': 'KURAL_PLATFORM_PASSWORD',
        'kuralnews': 'KURAL_NEWS_PASSWORD',
        'kuraltech': 'KURAL_TECH_PASSWORD',
        'kuralscience': 'KURAL_SCIENCE_PASSWORD',
        'kuralbusiness': 'KURAL_BUSINESS_PASSWORD',
        'kuralsports': 'KURAL_SPORTS_PASSWORD',
        'kuralhealth': 'KURAL_HEALTH_PASSWORD',
        'kuralentertainment': 'KURAL_ENTERTAINMENT_PASSWORD',
      };
      const envVar = envVarMap[result.handle] || `KURAL_${result.handle.toUpperCase()}_PASSWORD`;
      console.log(`      ${envVar}=${result.password}`);
    }
  });
  console.log(`   3. These accounts can now be used for platform announcements`);
  console.log(`   4. Consider setting up automated posting for news account`);
  
  console.log('\n✅ Platform account creation complete!\n');
  
  process.exit(failed.length > 0 ? 1 : 0);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

