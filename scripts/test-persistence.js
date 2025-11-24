/**
 * Data Persistence Test Script
 * Tests creating chirps, comments, and following users
 * 
 * Usage: node scripts/test-persistence.js
 * 
 * Note: This requires Firebase credentials in .env file and an authenticated user
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { config } from 'dotenv';
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
const db = getFirestore(app);

// Test credentials - can be set in .env or will try to create a new user
let TEST_EMAIL = process.env.TEST_EMAIL;
let TEST_PASSWORD = process.env.TEST_PASSWORD;

async function testCreateChirp(userId) {
  console.log('🧪 Testing chirp creation...');
  try {
    const chirpData = {
      authorId: userId,
      text: `Test chirp created at ${new Date().toISOString()}`,
      topic: 'dev',
      reachMode: 'forAll',
      createdAt: Timestamp.now(),
      commentCount: 0,
    };
    
    const docRef = await addDoc(collection(db, 'chirps'), chirpData);
    console.log('✅ Chirp created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Chirp creation failed:', error.message);
    throw error;
  }
}

async function testCreateComment(userId, chirpId) {
  console.log('🧪 Testing comment creation...');
  try {
    const commentData = {
      chirpId: chirpId,
      authorId: userId,
      text: `Test comment created at ${new Date().toISOString()}`,
      createdAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, 'comments'), commentData);
    console.log('✅ Comment created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Comment creation failed:', error.message);
    throw error;
  }
}

async function testReadChirps() {
  console.log('🧪 Testing chirp reading...');
  try {
    const q = query(
      collection(db, 'chirps'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(q);
    console.log(`✅ Read ${snapshot.size} chirps`);
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('❌ Chirp reading failed:', error.message);
    throw error;
  }
}

async function testReadComments(chirpId) {
  console.log('🧪 Testing comment reading...');
  try {
    const q = query(
      collection(db, 'comments'),
      where('chirpId', '==', chirpId),
      orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    console.log(`✅ Read ${snapshot.size} comments for chirp ${chirpId}`);
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('❌ Comment reading failed:', error.message);
    throw error;
  }
}

async function testUpdateFollowing(userId) {
  console.log('🧪 Testing following update...');
  try {
    const { updateDoc } = await import('firebase/firestore');
    const userRef = doc(db, 'users', userId);
    let userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log('⚠️  User document does not exist, creating it...');
      // Create user document if it doesn't exist
      const displayName = TEST_EMAIL.split('@')[0];
      const handle = displayName;
      await setDoc(userRef, {
        name: displayName,
        handle: handle,
        email: TEST_EMAIL,
        following: [],
        createdAt: Timestamp.now(),
      });
      console.log('✅ User document created');
      // Re-fetch the document after creation
      userSnap = await getDoc(userRef);
    }
    
    const currentFollowing = userSnap.data().following || [];
    const newFollowing = [...currentFollowing, 'test-user-id'];
    
    await updateDoc(userRef, { following: newFollowing });
    console.log('✅ Following updated');
    
    // Revert change
    await updateDoc(userRef, { following: currentFollowing });
    console.log('✅ Following reverted');
  } catch (error) {
    console.error('❌ Following update failed:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Starting data persistence tests...\n');
  
  // Check if credentials are configured
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }

  try {
    // Create test user if credentials not provided
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      console.log('📝 No test credentials found. Creating a new test user...');
      TEST_EMAIL = `test-persistence-${Date.now()}@example.com`;
      TEST_PASSWORD = 'TestPassword123!';
      
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
        const userId = userCredential.user.uid;
        console.log('✅ Test user created:', userId);
        console.log(`   Email: ${TEST_EMAIL}`);
        console.log(`   Password: ${TEST_PASSWORD}`);
        
        // Create user document in Firestore (required for the app to work properly)
        const displayName = TEST_EMAIL.split('@')[0];
        const handle = displayName;
        try {
          await setDoc(doc(db, 'users', userId), {
            name: displayName,
            handle: handle,
            email: TEST_EMAIL,
            following: [],
            createdAt: Timestamp.now(),
          });
          console.log('✅ User document created in Firestore');
        } catch (firestoreError) {
          console.log('⚠️  Could not create user document (may already exist):', firestoreError.message);
        }
        console.log('');
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log('⚠️  Test user already exists. Please set TEST_EMAIL and TEST_PASSWORD in .env');
          console.log('   Or use the credentials from a previous test:auth run');
          process.exit(1);
        } else {
          throw error;
        }
      }
    }
    
    // Sign in
    console.log('🔐 Signing in...');
    const userCredential = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
    const userId = userCredential.user.uid;
    console.log('✅ Signed in as:', userId);
    
    // Ensure user document exists in Firestore
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.log('📝 Creating user document in Firestore...');
      const displayName = TEST_EMAIL.split('@')[0];
      const handle = displayName;
      await setDoc(userRef, {
        name: displayName,
        handle: handle,
        email: TEST_EMAIL,
        following: [],
        createdAt: Timestamp.now(),
      });
      console.log('✅ User document created');
    }
    console.log('');
    
    // Test creating chirp
    const chirpId = await testCreateChirp(userId);
    console.log('');
    
    // Test reading chirps
    await testReadChirps();
    console.log('');
    
    // Test creating comment
    await testCreateComment(userId, chirpId);
    console.log('');
    
    // Test reading comments
    await testReadComments(chirpId);
    console.log('');
    
    // Test updating following
    await testUpdateFollowing(userId);
    console.log('');
    
    console.log('✅ All data persistence tests passed!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    console.error('\nNote: Make sure you have created a test user and set TEST_EMAIL and TEST_PASSWORD in .env');
    process.exit(1);
  }
}

runTests();

