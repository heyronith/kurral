/**
 * Comprehensive Platform Test Script
 * Creates 1 main user + 40 other users with full activity to test all platform features
 * 
 * Usage: node scripts/test-platform-comprehensive.js
 * 
 * This script:
 * 1. Creates 1 main user (author) with selected topics
 * 2. Creates 40 other users with varied topics/interests
 * 3. Sets up following relationships
 * 4. Creates posts across all topics with varied timestamps
 * 5. Creates comments and nested replies
 * 6. Creates rechirps
 * 7. Verifies all data creation
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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
  getDoc,
  updateDoc,
  increment,
  writeBatch
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

// All available topics
const ALL_TOPICS = ['dev', 'startups', 'music', 'sports', 'productivity', 'design', 'politics', 'crypto'];

// Sample post texts organized by topic
const POST_TEXTS_BY_TOPIC = {
  dev: [
    "Just released a new open-source library for React state management! Check it out on GitHub.",
    "Breaking: Major tech company announces new AI framework. This could change everything.",
    "New JavaScript features in ES2024 are game-changers. Here's what you need to know.",
    "Just finished building a real-time collaboration tool. The architecture is fascinating.",
    "Tech industry is seeing massive layoffs this quarter. What does this mean for developers?",
    "New programming language gaining traction. Early adopters are raving about it.",
    "Just discovered an amazing debugging tool. It's saved me hours of work already.",
    "Breaking news: Major security vulnerability found in popular npm package. Update immediately!",
    "New framework release is getting mixed reviews. What do you think?",
    "Just launched my startup! Building developer tools for the next generation.",
    "Tech conference announcements are rolling in. Which ones are you attending?",
    "New API standards are being proposed. This could standardize the industry.",
    "Just read an interesting article about quantum computing. The future is wild.",
    "Breaking: New development tool hits 1M downloads in first week.",
    "Tech giants are investing heavily in AI. What does this mean for developers?",
    "Just migrated our entire codebase to TypeScript. The type safety is incredible.",
    "New database technology is revolutionizing how we store data. Exciting times!",
    "Just learned about microservices architecture. The scalability benefits are huge.",
    "Breaking: Open source project reaches 100k stars on GitHub. Community is amazing!",
    "New cloud platform offering free tier for developers. Time to migrate?",
  ],
  startups: [
    "Just raised our Series A! Excited to scale the team and product.",
    "Y Combinator demo day is coming up. Can't wait to see the pitches.",
    "Just launched our MVP. Early users are loving it!",
    "Breaking: Startup ecosystem is booming. More funding than ever before.",
    "Just hired our first engineer. Building something special.",
    "New accelerator program accepting applications. Should I apply?",
    "Just hit 10k users! Growth is accelerating faster than expected.",
    "Breaking: Unicorn startup announces IPO. What does this mean for the market?",
    "Just pivoted our product. Sometimes you need to change direction.",
    "New startup funding round announced. Investors are bullish on SaaS.",
    "Just joined a startup as CTO. The energy is incredible.",
    "Breaking: Startup acquisition news. The M&A market is heating up.",
    "Just launched our beta. Early feedback is overwhelmingly positive.",
    "New incubator program starting. Perfect timing for early-stage founders.",
    "Just closed our seed round. Time to build!",
    "Breaking: Startup valuation reaches new heights. Market is frothy.",
    "Just released our product roadmap. Excited to share what's coming.",
    "New startup community forming. Great place to network and learn.",
    "Just hit product-market fit. The feeling is indescribable.",
    "Breaking: Startup layoffs continue. Market correction or new normal?",
  ],
  music: [
    "Just dropped my new single! Streaming on all platforms now.",
    "Breaking: Major artist announces world tour. Tickets go on sale Friday.",
    "New album release is getting rave reviews. The production is incredible.",
    "Just discovered an amazing new artist. Their sound is unique.",
    "Breaking: Music streaming service hits 100M subscribers. Industry is evolving.",
    "Just performed at a sold-out venue. The energy was electric.",
    "New music festival lineup announced. Can't wait to see these artists live.",
    "Breaking: Grammy nominations announced. Some surprises this year.",
    "Just released a music video. The visuals are stunning.",
    "New music technology is changing how we create. Exciting times!",
    "Just collaborated with another artist. The creative process was amazing.",
    "Breaking: Music industry revenue hits all-time high. Streaming is king.",
    "Just started learning a new instrument. It's never too late!",
    "New music discovery app launched. Finding new artists is easier than ever.",
    "Just attended a live concert. Nothing beats the live experience.",
    "Breaking: Music copyright case settled. Implications for the industry.",
    "Just produced my first track. The learning curve is steep but rewarding.",
    "New music streaming feature announced. Game changer for artists.",
    "Just joined a band. Making music with others is the best.",
    "Breaking: Music industry embraces AI. What does this mean for artists?",
  ],
  sports: [
    "Just watched an incredible game! The final minutes were intense.",
    "Breaking: Major trade announced. This changes everything for the season.",
    "New sports technology is revolutionizing training. Athletes are getting faster.",
    "Just attended a championship game. The atmosphere was electric.",
    "Breaking: Record-breaking performance tonight. History in the making.",
    "Just started training for a marathon. The journey begins now.",
    "New sports league announced. Exciting times for fans.",
    "Breaking: Injury update on star player. Team will need to adjust.",
    "Just played in a local tournament. Competition was fierce.",
    "New sports analytics platform launched. Data is changing the game.",
    "Just watched the Olympics. The level of competition is incredible.",
    "Breaking: Sports betting legalized in new state. Industry impact?",
    "Just joined a local sports team. Great way to stay active.",
    "New sports documentary released. Must watch for fans.",
    "Just attended a sports conference. Learning from the best.",
    "Breaking: Major sports contract signed. Record-breaking deal.",
    "Just started following a new sport. The strategy is fascinating.",
    "New sports app launched. Tracking performance is easier than ever.",
    "Just watched a comeback victory. Never give up!",
    "Breaking: Sports science breakthrough. Training methods evolving.",
  ],
  productivity: [
    "Just discovered a new productivity system. Game changer for my workflow.",
    "Breaking: New productivity app hits 1M users. Time management made easy.",
    "Just completed a productivity challenge. Results exceeded expectations.",
    "New time-blocking technique is working wonders. Highly recommend trying it.",
    "Breaking: Productivity research reveals new insights. Science-backed methods.",
    "Just organized my entire workspace. The impact on focus is immediate.",
    "New productivity tool launched. Streamlining my daily routine.",
    "Breaking: Remote work productivity study published. Interesting findings.",
    "Just implemented a new morning routine. Starting the day right.",
    "New productivity framework gaining traction. Worth exploring.",
    "Just eliminated distractions from my workspace. Focus improved dramatically.",
    "Breaking: Productivity app raises funding. Investors see the value.",
    "Just started time-tracking. The data is eye-opening.",
    "New productivity method from top performer. Trying it this week.",
    "Just completed a deep work session. The results speak for themselves.",
    "Breaking: Productivity science breakthrough. New methods validated.",
    "Just optimized my task management system. Efficiency increased 3x.",
    "New productivity community forming. Great place to share tips.",
    "Just read a productivity book. Implementing the strategies now.",
    "Breaking: Productivity trends for 2024. What's working now?",
  ],
  design: [
    "Just redesigned my portfolio. The new aesthetic is much cleaner.",
    "Breaking: New design tool launched. The features are incredible.",
    "Just completed a design system. Consistency across products is key.",
    "New design trend emerging. Minimalism is making a comeback.",
    "Breaking: Design award winners announced. Inspiring work this year.",
    "Just attended a design conference. The talks were inspiring.",
    "New design resource website launched. Free assets for designers.",
    "Breaking: Design industry salary report published. Market is strong.",
    "Just learned a new design technique. Expanding my skillset.",
    "New design tool update released. Workflow improvements are significant.",
    "Just collaborated on a design project. Teamwork makes the dream work.",
    "Breaking: Design system adoption growing. Consistency matters.",
    "Just started a design challenge. Pushing my creative boundaries.",
    "New design book released. Must-read for designers.",
    "Just redesigned a client's brand. The transformation is dramatic.",
    "Breaking: Design trends for 2024. What's in and what's out?",
    "Just created a design template. Sharing with the community.",
    "New design community platform launched. Great for feedback.",
    "Just completed a UI/UX course. The knowledge is invaluable.",
    "Breaking: Design tool acquisition. Industry consolidation continues.",
  ],
  politics: [
    "Just read an important policy proposal. The implications are significant.",
    "Breaking: Major political development announced. This changes the landscape.",
    "New legislation introduced. The debate will be intense.",
    "Just attended a town hall meeting. Civic engagement matters.",
    "Breaking: Election results announced. The outcome is clear.",
    "Just researched a political issue. Understanding all perspectives is crucial.",
    "New political movement gaining momentum. Grassroots organizing works.",
    "Breaking: Political poll results published. Trends are shifting.",
    "Just voted in local election. Every vote counts.",
    "New political analysis released. The insights are valuable.",
    "Just attended a political rally. The energy was palpable.",
    "Breaking: Political scandal breaks. Accountability is essential.",
    "Just wrote to my representative. Making my voice heard.",
    "New political documentary released. Important context for current events.",
    "Just learned about a new policy. The details matter.",
    "Breaking: Political coalition formed. Alliances shifting.",
    "Just participated in a political discussion. Civil discourse is important.",
    "New political platform launched. Engaging voters in new ways.",
    "Just researched candidates. Informed voting is crucial.",
    "Breaking: Political reform proposal. Potential for real change.",
  ],
  crypto: [
    "Just bought my first Bitcoin. The future of money is here.",
    "Breaking: Major cryptocurrency exchange announces new features. Adoption growing.",
    "New blockchain project launched. The technology is fascinating.",
    "Just learned about DeFi. The possibilities are endless.",
    "Breaking: Cryptocurrency regulation update. Clarity is coming.",
    "Just staked my tokens. Earning passive income feels good.",
    "New NFT collection dropped. The art is incredible.",
    "Breaking: Cryptocurrency market update. Volatility continues.",
    "Just explored a new blockchain. The innovation is impressive.",
    "New crypto wallet launched. Security features are top-notch.",
    "Just participated in a DAO. Decentralized governance is interesting.",
    "Breaking: Cryptocurrency adoption milestone reached. Mainstream acceptance growing.",
    "Just researched a new token. Due diligence is essential.",
    "New crypto exchange launched. Competition is good for users.",
    "Just learned about smart contracts. The automation is powerful.",
    "Breaking: Cryptocurrency regulation news. Industry is maturing.",
    "Just diversified my crypto portfolio. Risk management is key.",
    "New blockchain use case discovered. The applications are expanding.",
    "Just attended a crypto conference. The community is passionate.",
    "Breaking: Cryptocurrency technology breakthrough. Innovation continues.",
  ],
};

// Sample comment texts
const COMMENT_TEXTS = [
  "Great point! I completely agree with this.",
  "Interesting perspective. Hadn't thought about it that way.",
  "This is exactly what I needed to hear. Thanks for sharing!",
  "I have a different take on this. What do you think about...",
  "Couldn't agree more. This is spot on.",
  "Thanks for the insight. This helps clarify things.",
  "I'm not sure I fully understand. Can you elaborate?",
  "This resonates with me. Similar experience here.",
  "Well said! This captures it perfectly.",
  "I disagree, but I respect your opinion. Here's why...",
  "This is a game-changer. Excited to try it out.",
  "Thanks for sharing your experience. Very helpful.",
  "I have a question about this. How does...",
  "This is exactly the kind of content I come here for.",
  "Great discussion! Learning a lot from the comments.",
  "I've been thinking about this too. Your take is interesting.",
  "This makes so much sense. Thanks for breaking it down.",
  "I'm curious about your experience with...",
  "This is helpful. Appreciate you sharing.",
  "Great post! Looking forward to more content like this.",
];

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get random item from array
const randomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Helper to get random items from array
const randomItems = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Helper to get random number in range
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Create a user with Firebase Auth and Firestore document
async function createUser(email, password, userData) {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Create Firestore user document
    const now = Timestamp.now();
    const userDoc = {
      name: userData.name,
      handle: userData.handle,
      email: email,
      createdAt: now,
      following: userData.following || [],
      bookmarks: [],
      interests: userData.interests || [],
      topics: userData.topics || [],
      onboardingCompleted: true,
      kurralScore: {
        score: 65,
        lastUpdated: now,
        components: {
          qualityHistory: 0,
          violationHistory: 0,
          engagementQuality: 0,
          consistency: 0,
          communityTrust: 0,
        },
        history: [],
      },
      forYouConfig: {
        followingWeight: 'medium',
        boostActiveConversations: true,
        likedTopics: userData.topics || [],
        mutedTopics: [],
        timeWindowDays: 7,
      },
    };
    
    await setDoc(doc(db, 'users', userId), userDoc);
    
    return { userId, email, password };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      // User already exists, try to sign in
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        // Update user document
        await updateDoc(doc(db, 'users', userId), {
          topics: userData.topics || [],
          interests: userData.interests || [],
        });
        return { userId, email, password };
      } catch (signInError) {
        throw new Error(`Failed to sign in existing user: ${signInError.message}`);
      }
    }
    throw error;
  }
}

// Create a chirp (post)
async function createChirp(authorId, text, topic, minutesAgo = 0, options = {}) {
  const createdAt = Timestamp.fromMillis(Date.now() - (minutesAgo * 60 * 1000));
  
  const chirpData = {
    authorId: authorId,
    text: text,
    topic: topic,
    reachMode: options.reachMode || 'forAll',
    createdAt: createdAt,
    commentCount: 0,
  };
  
  // Add optional fields
  if (options.tunedAudience) {
    chirpData.tunedAudience = options.tunedAudience;
  }
  
  if (options.rechirpOfId) {
    chirpData.rechirpOfId = options.rechirpOfId;
  }
  
  if (options.semanticTopics && options.semanticTopics.length > 0) {
    chirpData.semanticTopics = options.semanticTopics;
  }
  
  if (options.entities && options.entities.length > 0) {
    chirpData.entities = options.entities;
  }
  
  if (options.intent) {
    chirpData.intent = options.intent;
  }
  
  const docRef = await addDoc(collection(db, 'chirps'), chirpData);
  
  // Increment topic engagement
  try {
    const topicRef = doc(db, 'topics', topic);
    const topicSnap = await getDoc(topicRef);
    
    if (topicSnap.exists()) {
      await updateDoc(topicRef, {
        postsLast48h: increment(1),
        postsLast1h: increment(1),
        postsLast4h: increment(1),
        lastEngagementUpdate: Timestamp.now(),
      });
    } else {
      await setDoc(topicRef, {
        name: topic,
        postsLast48h: 1,
        postsLast1h: 1,
        postsLast4h: 1,
        totalUsers: 0,
        averageVelocity1h: 0,
        isTrending: false,
        lastEngagementUpdate: Timestamp.now(),
      });
    }
  } catch (error) {
    console.warn(`⚠️  Could not update topic engagement for ${topic}:`, error.message);
  }
  
  return docRef.id;
}

// Create a comment
async function createComment(chirpId, authorId, text, options = {}) {
  const commentData = {
    chirpId: chirpId,
    authorId: authorId,
    text: text,
    depth: options.depth || 0,
    replyCount: 0,
    createdAt: Timestamp.now(),
  };
  
  if (options.parentCommentId) {
    commentData.parentCommentId = options.parentCommentId;
  }
  
  if (options.replyToUserId) {
    commentData.replyToUserId = options.replyToUserId;
  }
  
  if (options.discussionRole) {
    commentData.discussionRole = options.discussionRole;
  }
  
  const docRef = await addDoc(collection(db, 'comments'), commentData);
  const commentId = docRef.id;
  
  // Update comment count on chirp if top-level comment
  if (!options.parentCommentId) {
    try {
      await updateDoc(doc(db, 'chirps', chirpId), {
        commentCount: increment(1),
      });
    } catch (error) {
      console.warn(`⚠️  Could not update comment count:`, error.message);
    }
  }
  
  // Update reply count on parent comment if this is a reply
  if (options.parentCommentId) {
    try {
      await updateDoc(doc(db, 'comments', options.parentCommentId), {
        replyCount: increment(1),
      });
    } catch (error) {
      console.warn(`⚠️  Could not update reply count:`, error.message);
    }
  }
  
  return commentId;
}

// Update user following list
async function updateFollowing(userId, followingIds) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      following: followingIds,
    });
    
    // Verify the update worked by reading back
    await sleep(100); // Small delay to ensure write is committed
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const savedFollowing = data.following || [];
      if (savedFollowing.length !== followingIds.length) {
        console.warn(`⚠️  Following list mismatch for user ${userId}. Expected ${followingIds.length}, got ${savedFollowing.length}`);
        // Try to fix it
        await updateDoc(doc(db, 'users', userId), {
          following: followingIds,
        });
        await sleep(100);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Could not update following for user ${userId}:`, error.message);
    return false;
  }
}

// Main test function
async function runTest() {
  console.log('🚀 Starting Comprehensive Platform Test\n');
  console.log('='.repeat(70));
  
  // Check Firebase config
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }
  
  const startTime = Date.now();
  const users = [];
  const chirps = [];
  const comments = [];
  const rechirps = [];
  
  try {
    // Step 1: Create main user (author)
    console.log('\n📝 Step 1: Creating main user (author)...');
    const mainUserTopics = ['dev', 'startups', 'productivity'];
    const mainUser = await createUser(
      `main-author-${Date.now()}@test.com`,
      'TestPassword123!',
      {
        name: 'Main Author',
        handle: `mainauthor${Date.now()}`,
        topics: mainUserTopics,
        interests: mainUserTopics,
        following: [],
      }
    );
    users.push({ ...mainUser, isMain: true, topics: mainUserTopics });
    console.log(`✅ Created main user: ${mainUser.userId} (${mainUser.email})`);
    console.log(`   Topics: ${mainUserTopics.join(', ')}`);
    await sleep(500);
    
    // Step 2: Create 40 other users
    console.log('\n📝 Step 2: Creating 40 other users...');
    const otherUsersCount = 40;
    
    for (let i = 0; i < otherUsersCount; i++) {
      const userNum = i + 1;
      const userTopics = randomItems(ALL_TOPICS, randomInt(2, 4));
      const userName = `Test User ${userNum}`;
      const userHandle = `testuser${userNum}${Date.now()}`;
      
      try {
        const user = await createUser(
          `testuser${userNum}-${Date.now()}@test.com`,
          'TestPassword123!',
          {
            name: userName,
            handle: userHandle,
            topics: userTopics,
            interests: userTopics,
            following: [],
          }
        );
        users.push({ ...user, isMain: false, topics: userTopics, name: userName });
        
        if ((userNum % 10 === 0) || userNum === otherUsersCount) {
          console.log(`   Created ${userNum}/${otherUsersCount} users...`);
        }
        
        // Rate limiting - wait between user creations
        await sleep(300);
      } catch (error) {
        console.error(`   ⚠️  Failed to create user ${userNum}:`, error.message);
      }
    }
    
    console.log(`✅ Created ${users.length} total users (1 main + ${users.length - 1} others)`);
    
    // Step 3: Set up following relationships
    console.log('\n📝 Step 3: Setting up following relationships...');
    const mainUserId = mainUser.userId;
    const otherUserIds = users.filter(u => !u.isMain).map(u => u.userId);
    
    // Main user follows 15-20 other users
    const mainUserFollows = randomItems(otherUserIds, randomInt(15, 20));
    const mainUserFollowsSuccess = await updateFollowing(mainUserId, mainUserFollows);
    if (mainUserFollowsSuccess) {
      console.log(`   ✅ Main user follows ${mainUserFollows.length} users`);
      
      // Verify by reading back
      const verifyDoc = await getDoc(doc(db, 'users', mainUserId));
      if (verifyDoc.exists()) {
        const verifyData = verifyDoc.data();
        const actualFollowing = verifyData.following || [];
        console.log(`   📊 Verified: Main user following list has ${actualFollowing.length} users in Firestore`);
        if (actualFollowing.length !== mainUserFollows.length) {
          console.warn(`   ⚠️  Warning: Following count mismatch. Expected ${mainUserFollows.length}, got ${actualFollowing.length}`);
        }
      }
    } else {
      console.error(`   ❌ Failed to update main user following list`);
    }
    
    // 15-20 users follow main user
    const usersFollowingMain = randomItems(otherUserIds, randomInt(15, 20));
    let successCount = 0;
    for (const userId of usersFollowingMain) {
      // Read current following list from Firestore, not from local array
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const currentFollowing = userDoc.exists() ? (userDoc.data().following || []) : [];
        const newFollowing = [...currentFollowing, mainUserId];
        const success = await updateFollowing(userId, newFollowing);
        if (success) successCount++;
        await sleep(100); // Small delay between updates
      } catch (error) {
        console.warn(`   ⚠️  Failed to update following for user ${userId}:`, error.message);
      }
    }
    console.log(`   ✅ ${successCount}/${usersFollowingMain.length} users now follow main user`);
    
    // Some users follow each other (cross-following)
    let crossFollows = 0;
    let crossFollowSuccess = 0;
    for (let i = 0; i < Math.min(20, otherUserIds.length); i++) {
      const userId = otherUserIds[i];
      const followCount = randomInt(3, 8);
      const toFollow = randomItems(
        otherUserIds.filter(id => id !== userId),
        followCount
      );
      
      try {
        // Read current following list from Firestore
        const userDoc = await getDoc(doc(db, 'users', userId));
        const currentFollowing = userDoc.exists() ? (userDoc.data().following || []) : [];
        const newFollowing = [...currentFollowing, ...toFollow];
        const success = await updateFollowing(userId, newFollowing);
        if (success) {
          crossFollowSuccess++;
          crossFollows += toFollow.length;
        }
        await sleep(100);
      } catch (error) {
        console.warn(`   ⚠️  Failed to update cross-following for user ${userId}:`, error.message);
      }
    }
    console.log(`   ✅ ${crossFollowSuccess} users with cross-following relationships (${crossFollows} total follows)`);
    await sleep(500);
    
    // Step 4: Create posts from all users
    console.log('\n📝 Step 4: Creating posts from all users...');
    
    // Main user posts (20-25 posts)
    const mainUserPostCount = randomInt(20, 25);
    console.log(`   Creating ${mainUserPostCount} posts from main user...`);
    for (let i = 0; i < mainUserPostCount; i++) {
      const topic = randomItem(mainUserTopics);
      const texts = POST_TEXTS_BY_TOPIC[topic];
      const text = randomItem(texts);
      const minutesAgo = randomInt(0, 2880); // Last 48 hours
      
      try {
        const chirpId = await createChirp(mainUserId, text, topic, minutesAgo, {
          reachMode: randomItem(['forAll', 'tuned']),
        });
        chirps.push({ chirpId, authorId: mainUserId, topic, minutesAgo });
        
        if ((i + 1) % 5 === 0) {
          console.log(`     Created ${i + 1}/${mainUserPostCount} posts...`);
        }
        await sleep(200);
      } catch (error) {
        console.warn(`     ⚠️  Failed to create post ${i + 1}:`, error.message);
      }
    }
    
    // Other users posts (3-5 posts each)
    console.log(`   Creating posts from ${otherUserIds.length} other users...`);
    let otherPostsCreated = 0;
    const targetOtherPosts = otherUserIds.length * 4; // Average 4 posts per user
    
    for (const userId of otherUserIds) {
      const user = users.find(u => u.userId === userId);
      if (!user) continue;
      
      const postCount = randomInt(3, 5);
      const userTopics = user.topics || [];
      
      for (let i = 0; i < postCount; i++) {
        const topic = randomItem(userTopics.length > 0 ? userTopics : ALL_TOPICS);
        const texts = POST_TEXTS_BY_TOPIC[topic];
        const text = randomItem(texts);
        const minutesAgo = randomInt(0, 2880); // Last 48 hours
        
        try {
          const chirpId = await createChirp(userId, text, topic, minutesAgo, {
            reachMode: randomItem(['forAll', 'tuned']),
          });
          chirps.push({ chirpId, authorId: userId, topic, minutesAgo });
          otherPostsCreated++;
          
          if (otherPostsCreated % 20 === 0) {
            console.log(`     Created ${otherPostsCreated} posts from other users...`);
          }
          await sleep(150);
        } catch (error) {
          console.warn(`     ⚠️  Failed to create post:`, error.message);
        }
      }
    }
    
    console.log(`✅ Created ${chirps.length} total posts (${mainUserPostCount} from main user, ${otherPostsCreated} from others)`);
    await sleep(500);
    
    // Step 5: Create comments and replies
    console.log('\n📝 Step 5: Creating comments and replies...');
    
    // Select posts to add comments to (30-40% of posts)
    const postsToComment = randomItems(chirps, Math.floor(chirps.length * 0.35));
    let commentCount = 0;
    let replyCount = 0;
    
    for (const chirp of postsToComment) {
      // 2-5 top-level comments per post
      const topLevelCount = randomInt(2, 5);
      const topLevelComments = [];
      
      for (let i = 0; i < topLevelCount; i++) {
        const commentAuthor = randomItem(users);
        const commentText = randomItem(COMMENT_TEXTS);
        
        try {
          const commentId = await createComment(chirp.chirpId, commentAuthor.userId, commentText);
          topLevelComments.push({ commentId, authorId: commentAuthor.userId });
          comments.push({ commentId, chirpId: chirp.chirpId, isReply: false });
          commentCount++;
          await sleep(100);
        } catch (error) {
          console.warn(`     ⚠️  Failed to create comment:`, error.message);
        }
      }
      
      // 1-3 replies per top-level comment (on some comments)
      const commentsToReply = randomItems(topLevelComments, Math.floor(topLevelComments.length * 0.6));
      
      for (const parentComment of commentsToReply) {
        const replyCountForComment = randomInt(1, 3);
        
        for (let i = 0; i < replyCountForComment; i++) {
          const replyAuthor = randomItem(users.filter(u => u.userId !== parentComment.authorId));
          const replyText = randomItem(COMMENT_TEXTS);
          
          try {
            const replyId = await createComment(chirp.chirpId, replyAuthor.userId, replyText, {
              parentCommentId: parentComment.commentId,
              replyToUserId: parentComment.authorId,
              depth: 1,
            });
            comments.push({ commentId: replyId, chirpId: chirp.chirpId, isReply: true });
            replyCount++;
            await sleep(100);
          } catch (error) {
            console.warn(`     ⚠️  Failed to create reply:`, error.message);
          }
        }
      }
      
      if (commentCount % 50 === 0) {
        console.log(`     Created ${commentCount} comments, ${replyCount} replies...`);
      }
    }
    
    console.log(`✅ Created ${commentCount} comments and ${replyCount} replies (${comments.length} total)`);
    await sleep(500);
    
    // Step 6: Create rechirps
    console.log('\n📝 Step 6: Creating rechirps...');
    
    // Select posts to rechirp (10-15 posts)
    const postsToRechirp = randomItems(chirps, randomInt(10, 15));
    
    for (const chirp of postsToRechirp) {
      // 1-3 users rechirp this post
      const rechirpCount = randomInt(1, 3);
      const rechirpUsers = randomItems(
        users.filter(u => u.userId !== chirp.authorId),
        rechirpCount
      );
      
      for (const user of rechirpUsers) {
        try {
          // Get original chirp text for rechirp
          const originalChirpDoc = await getDoc(doc(db, 'chirps', chirp.chirpId));
          const originalText = originalChirpDoc.exists() ? originalChirpDoc.data().text : 'Rechirped';
          
          const rechirpId = await createChirp(user.userId, originalText, chirp.topic, 0, {
            rechirpOfId: chirp.chirpId,
            reachMode: 'forAll',
          });
          rechirps.push({ rechirpId, originalChirpId: chirp.chirpId, userId: user.userId });
          await sleep(150);
        } catch (error) {
          console.warn(`     ⚠️  Failed to create rechirp:`, error.message);
        }
      }
    }
    
    console.log(`✅ Created ${rechirps.length} rechirps`);
    await sleep(500);
    
    // Step 7: Verification
    console.log('\n📝 Step 7: Verifying data creation...');
    
    // Verify users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersCount = usersSnapshot.size;
    console.log(`   Users: ${usersCount} (expected: ${users.length})`);
    
    // Verify main user following list
    const mainUserDoc = await getDoc(doc(db, 'users', mainUserId));
    if (mainUserDoc.exists()) {
      const mainUserData = mainUserDoc.data();
      const mainUserFollowing = mainUserData.following || [];
      console.log(`   Main user following: ${mainUserFollowing.length} users`);
      if (mainUserFollowing.length === 0) {
        console.warn(`   ⚠️  WARNING: Main user following list is empty! This is a problem.`);
        console.warn(`   Attempting to fix by re-adding following list...`);
        const fixed = await updateFollowing(mainUserId, mainUserFollows);
        if (fixed) {
          console.log(`   ✅ Fixed! Re-verified following list.`);
        }
      } else {
        console.log(`   ✅ Main user following list verified: ${mainUserFollowing.length} users`);
      }
    } else {
      console.error(`   ❌ Main user document not found!`);
    }
    
    // Verify chirps
    const chirpsSnapshot = await getDocs(collection(db, 'chirps'));
    const chirpsCount = chirpsSnapshot.size;
    console.log(`   Chirps: ${chirpsCount} (created: ${chirps.length})`);
    
    // Verify comments
    const commentsSnapshot = await getDocs(collection(db, 'comments'));
    const commentsCount = commentsSnapshot.size;
    console.log(`   Comments: ${commentsCount} (created: ${comments.length})`);
    
    // Verify topics
    const topicsSnapshot = await getDocs(collection(db, 'topics'));
    const topicsCount = topicsSnapshot.size;
    console.log(`   Topics with posts: ${topicsCount}`);
    
    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Users created: ${users.length} (1 main + ${users.length - 1} others)`);
    console.log(`✅ Posts created: ${chirps.length}`);
    console.log(`✅ Comments created: ${comments.length} (${commentCount} top-level, ${replyCount} replies)`);
    console.log(`✅ Rechirps created: ${rechirps.length}`);
    // Get final following count from Firestore
    const finalMainUserDoc = await getDoc(doc(db, 'users', mainUserId));
    const finalFollowingCount = finalMainUserDoc.exists() 
      ? (finalMainUserDoc.data().following || []).length 
      : 0;
    
    console.log(`✅ Following relationships: ${finalFollowingCount} (main follows), ${usersFollowingMain.length} (follow main)`);
    console.log(`✅ Topics covered: ${topicsCount}`);
    console.log(`⏱️  Total time: ${duration} seconds`);
    
    console.log('\n' + '='.repeat(70));
    console.log('🔑 MAIN USER CREDENTIALS (Use this to test the platform)');
    console.log('='.repeat(70));
    console.log(`Email: ${mainUser.email}`);
    console.log(`Password: TestPassword123!`);
    console.log(`User ID: ${mainUser.userId}`);
    console.log(`Handle: ${users.find(u => u.isMain)?.handle || 'N/A'}`);
    console.log(`Topics: ${mainUserTopics.join(', ')}`);
    console.log(`Following: ${finalFollowingCount} users (verified in Firestore)`);
    if (finalFollowingCount === 0) {
      console.log(`\n⚠️  WARNING: Following list is empty!`);
      console.log(`   This might be a Firestore write issue. Try:`);
      console.log(`   1. Check Firestore console to verify the following array exists`);
      console.log(`   2. Try refreshing the app after logging in`);
      console.log(`   3. Check browser console for any errors`);
    }
    console.log('='.repeat(70));
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Log in to the app with the main user credentials above');
    console.log('   2. Check the "Latest" feed - should show posts from followed users');
    console.log('   3. Check the "For You" feed - should show personalized content');
    console.log('   4. Test commenting, replying, and rechirping');
    console.log('   5. Check notifications - should see activity from other users');
    console.log('   6. Test profile pages - view other users\' profiles');
    console.log('   7. Test following/unfollowing');
    console.log('   8. Check trending topics - should see topics with high engagement');
    console.log('   9. Test news generation - refresh news to see AI-generated content');
    console.log('   10. Test value scoring - posts should have value scores calculated');
    
    console.log('\n✅ Test script completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest().then(() => {
  console.log('\n✅ All done!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});

