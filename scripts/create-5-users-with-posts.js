/**
 * Create 5 Users with Posts Script
 * Creates 5 users with email, names, handles, and 10 posts each across diverse topics
 * 
 * Usage: node scripts/create-5-users-with-posts.js
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  increment,
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

// User data - 5 users with diverse interests
const USERS_DATA = [
  {
    name: 'Alex Chen',
    handle: 'alexchen',
    email: 'alex.chen@example.com',
    topics: ['dev', 'productivity', 'design'],
    interests: ['dev', 'productivity', 'design'],
  },
  {
    name: 'Sarah Martinez',
    handle: 'sarahm',
    email: 'sarah.martinez@example.com',
    topics: ['startups', 'music', 'sports'],
    interests: ['startups', 'music', 'sports'],
  },
  {
    name: 'Jordan Kim',
    handle: 'jordank',
    email: 'jordan.kim@example.com',
    topics: ['crypto', 'politics', 'dev'],
    interests: ['crypto', 'politics', 'dev'],
  },
  {
    name: 'Taylor Brown',
    handle: 'taylorb',
    email: 'taylor.brown@example.com',
    topics: ['music', 'design', 'productivity'],
    interests: ['music', 'design', 'productivity'],
  },
  {
    name: 'Morgan Lee',
    handle: 'morganl',
    email: 'morgan.lee@example.com',
    topics: ['sports', 'startups', 'crypto'],
    interests: ['sports', 'startups', 'crypto'],
  },
];

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
  ],
};

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get random item from array
const randomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Helper to get random number in range
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Create a user with Firebase Auth and Firestore document
async function createUser(userData, password = 'TestPassword123!') {
  try {
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
    const userId = userCredential.user.uid;
    
    // Create Firestore user document
    const now = Timestamp.now();
    const userDoc = {
      name: userData.name,
      handle: userData.handle.toLowerCase(),
      email: userData.email,
      createdAt: now,
      following: [],
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
    
    return { userId, email: userData.email, password };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      // User already exists, try to sign in and update
      try {
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
        const userId = userCredential.user.uid;
        // Update user document
        await updateDoc(doc(db, 'users', userId), {
          topics: userData.topics || [],
          interests: userData.interests || [],
          name: userData.name,
          handle: userData.handle.toLowerCase(),
        });
        return { userId, email: userData.email, password };
      } catch (signInError) {
        throw new Error(`Failed to sign in existing user: ${signInError.message}`);
      }
    }
    throw error;
  }
}

// Create a chirp (post)
async function createChirp(authorId, text, topic, minutesAgo = 0) {
  const createdAt = Timestamp.fromMillis(Date.now() - (minutesAgo * 60 * 1000));
  
  const chirpData = {
    authorId: authorId,
    text: text,
    topic: topic,
    reachMode: 'forAll',
    createdAt: createdAt,
    commentCount: 0,
  };
  
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

async function createUsersWithPosts() {
  console.log('🚀 Creating 5 Users with Posts\n');
  console.log('='.repeat(70));

  // Check Firebase config
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
    console.error('❌ Firebase credentials not configured!');
    console.error('Please copy .env.example to .env and fill in your Firebase credentials.');
    process.exit(1);
  }

  const startTime = Date.now();
  const createdUsers = [];
  const allChirps = [];

  try {
    // Create 5 users
    console.log('📝 Creating 5 users...\n');
    
    for (let i = 0; i < USERS_DATA.length; i++) {
      const userData = USERS_DATA[i];
      console.log(`   [${i + 1}/5] Creating ${userData.name} (${userData.handle})...`);
      
      try {
        const user = await createUser(userData);
        createdUsers.push({ ...user, ...userData });
        console.log(`      ✅ Created: ${user.userId}`);
        console.log(`      📧 Email: ${user.email}`);
        console.log(`      🔑 Password: TestPassword123!`);
        console.log(`      📌 Topics: ${userData.topics.join(', ')}`);
        await sleep(300);
      } catch (error) {
        console.error(`      ❌ Failed: ${error.message}`);
      }
    }

    console.log(`\n✅ Created ${createdUsers.length} users\n`);

    // Create 10 posts for each user
    console.log('📝 Creating 10 posts for each user...\n');
    
    for (let i = 0; i < createdUsers.length; i++) {
      const user = createdUsers[i];
      const userTopics = user.topics || [];
      
      console.log(`   [${i + 1}/${createdUsers.length}] Creating posts for ${user.name}...`);
      
      const userChirps = [];
      for (let j = 0; j < 10; j++) {
        // Distribute posts across user's topics
        const topic = userTopics[j % userTopics.length];
        const texts = POST_TEXTS_BY_TOPIC[topic];
        const text = randomItem(texts);
        
        // Spread posts over last 48 hours
        const minutesAgo = randomInt(0, 2880);
        
        try {
          const chirpId = await createChirp(user.userId, text, topic, minutesAgo);
          userChirps.push({ chirpId, topic, minutesAgo });
          allChirps.push({ chirpId, userId: user.userId, topic });
          
          if ((j + 1) % 5 === 0) {
            process.stdout.write(`      Created ${j + 1}/10 posts... `);
          }
          await sleep(150);
        } catch (error) {
          console.warn(`      ⚠️  Failed to create post ${j + 1}:`, error.message);
        }
      }
      
      console.log(`      ✅ Created 10 posts across topics: ${[...new Set(userChirps.map(c => c.topic))].join(', ')}`);
    }

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Users created: ${createdUsers.length}`);
    console.log(`✅ Posts created: ${allChirps.length}`);
    console.log(`⏱️  Total time: ${duration} seconds`);

    console.log('\n' + '='.repeat(70));
    console.log('👥 CREATED USERS');
    console.log('='.repeat(70));
    
    createdUsers.forEach((user, index) => {
      const userPosts = allChirps.filter(c => c.userId === user.userId);
      const topicsUsed = [...new Set(userPosts.map(p => p.topic))];
      console.log(`\n${index + 1}. ${user.name} (@${user.handle})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: TestPassword123!`);
      console.log(`   User ID: ${user.userId}`);
      console.log(`   Topics: ${user.topics.join(', ')}`);
      console.log(`   Posts: ${userPosts.length} (across ${topicsUsed.length} topics: ${topicsUsed.join(', ')})`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('💡 Next Steps:');
    console.log('   1. Log in to the app with any of the user credentials above');
    console.log('   2. Check their profiles - should see 10 posts each');
    console.log('   3. Posts are distributed across their selected topics');
    console.log('   4. Posts are spread over the last 48 hours');
    console.log('='.repeat(70));

    console.log('\n✅ Script completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
createUsersWithPosts().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

