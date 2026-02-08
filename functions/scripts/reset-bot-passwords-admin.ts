/**
 * Reset Bot Passwords (Firebase Admin)
 *
 * Uses the Admin SDK to set new passwords for all 10 platform bot accounts and
 * ensure their Firestore users docs have isPlatformAccount + platformAccountType.
 * No existing password or email access needed.
 *
 * Run from project root: npm run reset-bot-passwords
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 * Get it: Firebase Console → Project settings → Service accounts → Generate new private key.
 */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '..', '..', '..', '.env') });

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS is not set. Set it to your service account JSON path.\n');
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT,
  });
}

const auth = admin.auth();
const db = admin.firestore();

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  const b = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) s += chars[b[i] % chars.length];
  return s;
}

const PLATFORM_ACCOUNTS = [
  { handle: 'kural', email: process.env.KURAL_PLATFORM_EMAIL || 'platform@kurral.app', name: 'Kural', platformAccountType: 'main', bio: 'Official Kural platform account.', interests: ['platform', 'announcements'], topics: ['platform', 'announcements'] },
  { handle: 'kuralnews', email: process.env.KURAL_NEWS_EMAIL || 'news@kurral.app', name: 'Kural News', platformAccountType: 'news', bio: 'Official Kural News account.', interests: ['news', 'updates'], topics: ['news', 'updates'] },
  { handle: 'kuraltech', email: process.env.KURAL_TECH_EMAIL || 'tech@kurral.app', name: 'Kural Tech', platformAccountType: 'tech', bio: 'Technology news and updates.', interests: ['technology', 'tech'], topics: ['technology', 'tech'] },
  { handle: 'kuralscience', email: process.env.KURAL_SCIENCE_EMAIL || 'science@kurral.app', name: 'Kural Science', platformAccountType: 'science', bio: 'Science news and research.', interests: ['science', 'research'], topics: ['science', 'research'] },
  { handle: 'kuralbusiness', email: process.env.KURAL_BUSINESS_EMAIL || 'business@kurral.app', name: 'Kural Business', platformAccountType: 'business', bio: 'Business and finance news.', interests: ['business', 'finance'], topics: ['business', 'finance'] },
  { handle: 'kuralsports', email: process.env.KURAL_SPORTS_EMAIL || 'sports@kurral.app', name: 'Kural Sports', platformAccountType: 'sports', bio: 'Sports news and scores.', interests: ['sports'], topics: ['sports'] },
  { handle: 'kuralhealth', email: process.env.KURAL_HEALTH_EMAIL || 'health@kurral.app', name: 'Kural Health', platformAccountType: 'health', bio: 'Health and wellness news.', interests: ['health', 'medical'], topics: ['health', 'medical'] },
  { handle: 'kuralentertainment', email: process.env.KURAL_ENTERTAINMENT_EMAIL || 'entertainment@kurral.app', name: 'Kural Entertainment', platformAccountType: 'entertainment', bio: 'Entertainment news.', interests: ['entertainment'], topics: ['entertainment'] },
  { handle: 'kuraldesign', email: process.env.KURAL_DESIGN_EMAIL || 'design@kurral.app', name: 'Kural Design', platformAccountType: 'design', bio: 'Design inspiration and news.', interests: ['design', 'art'], topics: ['design', 'art'] },
  { handle: 'kuralgaming', email: process.env.KURAL_GAMING_EMAIL || 'gaming@kurral.app', name: 'Kural Gaming', platformAccountType: 'gaming', bio: 'Gaming news and culture.', interests: ['gaming', 'games'], topics: ['gaming', 'games'] },
];

async function run() {
  console.log('🔐 Resetting bot passwords and ensuring Firestore flags (Admin SDK)\n');

  const results: { handle: string; email: string; password: string; status: string }[] = [];

  for (const acc of PLATFORM_ACCOUNTS) {
    const newPassword = generatePassword();
    try {
      let user: admin.auth.UserRecord;
      try {
        user = await auth.getUserByEmail(acc.email);
        await auth.updateUser(user.uid, { password: newPassword });
        console.log(`   ✅ @${acc.handle}: Password reset (${acc.email})`);
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === 'auth/user-not-found' || (e as Error)?.message?.toLowerCase().includes('user')) {
          user = await auth.createUser({
            email: acc.email,
            password: newPassword,
            displayName: acc.name,
            emailVerified: true,
          });
          console.log(`   ✅ @${acc.handle}: Auth user created (${acc.email})`);
        } else {
          throw e;
        }
      }

      const uid = user.uid;

      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const base = {
        name: acc.name,
        handle: acc.handle,
        email: acc.email,
        bio: acc.bio,
        interests: acc.interests,
        topics: acc.topics,
        isPlatformAccount: true,
        platformAccountType: acc.platformAccountType,
        onboardingCompleted: true,
        firstTimeUser: false,
      };

      if (snap.exists) {
        await userRef.update(base);
        console.log(`   ✅ @${acc.handle}: Firestore updated`);
      } else {
        await userRef.set({
          ...base,
          createdAt: now,
          following: [],
          bookmarks: [],
          kurralScore: { score: 100, lastUpdated: now, components: { qualityHistory: 100, violationHistory: 0, engagementQuality: 100, consistency: 100, communityTrust: 100 }, history: [] },
          forYouConfig: { followingWeight: 'high', boostActiveConversations: true, likedTopics: acc.topics, mutedTopics: [], timeWindowDays: 30 },
          valueStats: { postValue30d: 0, commentValue30d: 0, lifetimePostValue: 0, lifetimeCommentValue: 0, lastUpdated: now },
        });
        console.log(`   ✅ @${acc.handle}: Firestore user doc created`);
      }

      results.push({ handle: acc.handle, email: acc.email, password: newPassword, status: 'ok' });
    } catch (e: unknown) {
      const msg = (e as Error)?.message || String(e);
      console.error(`   ❌ @${acc.handle}: ${msg}`);
      results.push({ handle: acc.handle, email: acc.email, password: '', status: `failed: ${msg}` });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Add these to .env (only for accounts with status ok):');
  console.log('='.repeat(60));

  const envVars: Record<string, string> = {
    kural: 'KURAL_PLATFORM_PASSWORD',
    kuralnews: 'KURAL_NEWS_PASSWORD',
    kuraltech: 'KURAL_TECH_PASSWORD',
    kuralscience: 'KURAL_SCIENCE_PASSWORD',
    kuralbusiness: 'KURAL_BUSINESS_PASSWORD',
    kuralsports: 'KURAL_SPORTS_PASSWORD',
    kuralhealth: 'KURAL_HEALTH_PASSWORD',
    kuralentertainment: 'KURAL_ENTERTAINMENT_PASSWORD',
    kuraldesign: 'KURAL_DESIGN_PASSWORD',
    kuralgaming: 'KURAL_GAMING_PASSWORD',
  };

  for (const r of results) {
    if (r.status === 'ok' && r.password) {
      console.log(`${envVars[r.handle] || 'KURAL_*_PASSWORD'}=${r.password}`);
    }
  }

  console.log('\n📧 Emails (for reference):');
  for (const r of results) {
    console.log(`   @${r.handle}: ${r.email}`);
  }

  console.log('\n✅ Done. Run: npm run create:platform (with the new passwords in .env) to sync any extra fields, or you’re done.');
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
