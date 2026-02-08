/**
 * Upload Bot Images Script
 * 
 * This script uploads the provided bot profile pictures to Firebase Storage
 * and updates the corresponding user documents in Firestore.
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, query, where, getDocs, updateDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const MAPPING = [
    { handle: 'kural', image: 'image_0.png', name: 'Kural (Grey)' },
    { handle: 'kuralbusiness', image: 'image_1.png', name: 'Business (Orange)' },
    { handle: 'kuraltech', image: 'image_2.png', name: 'Tech (Cyan)' },
    { handle: 'kuralscience', image: 'image_3.png', name: 'Science (Yellow)' },
    { handle: 'kuralentertainment', image: 'image_4.png', name: 'Entertainment (Purple)' },
];

async function run() {
    console.log('🚀 Starting Bot Image Upload...');

    // 1. Sign in (using design account as it was successfully created/accessible in previous logs)
    // Note: We need some auth to upload based on storage rules
    const email = 'design@kurral.app';
    const password = 'C2FS2gBYDJS8mBZA2a1v4QkSsTQBz7#v';

    try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userId = userCred.user.uid;
        console.log(`✅ Signed in as ${email} (UID: ${userId})`);

        for (const item of MAPPING) {
            const localPath = path.join(__dirname, '..', item.image);
            if (!fs.existsSync(localPath)) {
                console.warn(`⚠️ Skipped ${item.handle}: Local file ${localPath} not found.`);
                continue;
            }

            console.log(`⏳ Uploading image for @${item.handle}...`);
            const storageRef = ref(storage, `profile-pictures/${userId}/bot_${item.handle}.png`);
            const fileBuffer = fs.readFileSync(localPath);

            await uploadBytes(storageRef, fileBuffer, { contentType: 'image/png' });
            const downloadURL = await getDownloadURL(storageRef);
            console.log(`✅ Uploaded to Storage: ${downloadURL}`);
            item.url = downloadURL;
        }

        console.log('\n📋 --- UPLOADED URLs ---');
        MAPPING.forEach(m => console.log(`${m.handle}: ${m.url}`));
        console.log('------------------------\n');

        console.log('\n🏁 Upload complete! Now run the maintenance callable with these URLs.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

run();
