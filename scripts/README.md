# Test Scripts

This directory contains automated test scripts for verifying Firebase functionality.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Firebase credentials:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase project credentials

## Available Tests

### Authentication Tests (`test-auth.js`)

Tests signup, login, and logout functionality.

```bash
npm run test:auth
```

**What it tests:**
- ✅ User signup with email/password
- ✅ User logout
- ✅ User login with email/password
- ✅ Logout again

**Note:** Creates a test user with a unique email. The test user will remain in Firebase Auth (you may want to clean it up manually).

### Data Persistence Tests (`test-persistence.js`)

Tests creating and reading chirps, comments, and following users.

```bash
npm run test:persistence
```

**What it tests:**
- ✅ Creating chirps in Firestore
- ✅ Reading chirps from Firestore
- ✅ Creating comments in Firestore
- ✅ Reading comments from Firestore
- ✅ Updating user following list

**How it works:**
- If `TEST_EMAIL` and `TEST_PASSWORD` are set in `.env`, uses those credentials
- If not set, automatically creates a new test user
- You can also use credentials from `test:auth` output

### Run All Tests (`test-all.sh`)

Runs both authentication and persistence tests in sequence.

```bash
npm run test:all
```

This is the easiest way to test everything at once!

## Manual Testing

Some tests require manual interaction:

### Real-time Updates Test

1. Open the app in two browser tabs
2. In tab 1, create a new chirp
3. Verify it appears in tab 2 automatically
4. In tab 2, add a comment to the chirp
5. Verify the comment count updates in tab 1

This cannot be automated as it requires browser interaction and multiple tabs.

### News Generation Tests (`test-news-generation.js`)

Tests the AI-powered news generation from trending topics.

```bash
npm run test:news
```

**What it tests:**
- ✅ Creates multiple posts for a topic to simulate trending
- ✅ Updates topic velocity tracking (posts per hour)
- ✅ Detects trending topics (velocity spikes)
- ✅ Verifies AI-generated news appears in Firestore
- ✅ Checks news aggregation and generation

**How it works:**
1. Authenticates with Firebase (creates test user if needed)
2. Creates 15+ posts for a test topic (default: "dev")
3. Updates topic engagement metrics
4. Calculates velocity and detects trending status
5. Checks for AI-generated news in Firestore

**Expected output:**
- Posts created successfully
- Topic marked as trending (if velocity spike detected)
- AI-generated news items in `trendingNews` collection
- News with source "Platform Discussion"

**Note:** 
- Requires OpenAI API key configured (VITE_OPENAI_API_KEY)
- News generation happens when you refresh news in the app
- The script creates the posts, but news generation is triggered by the app's news service
- If topic doesn't trend, try increasing the post count in the script

### Personalized News Generation Tests (`test-personalized-news.js`)

Tests the AI-powered personalized news generation from user's selected topics using multi-stage AI agents.

```bash
npm run test:personalized-news
```

**What it tests:**
- ✅ Creates test user with multiple selected topics (dev, startups, crypto)
- ✅ Creates distinct story clusters within each topic
- ✅ Tests story discovery agent (identifies distinct stories)
- ✅ Tests story selection agent (picks best story)
- ✅ Verifies personalized news generation (user-specific)
- ✅ Verifies storyClusterPostIds are stored correctly
- ✅ Verifies story signatures for deduplication
- ✅ Verifies sourceTopics tracking

**How it works:**
1. Authenticates and creates test user with selected topics: `['dev', 'startups', 'crypto']`
2. Creates distinct story clusters:
   - **dev**: npm security vulnerability (7 posts), tech layoffs (5 posts)
   - **startups**: AI startup funding (5 posts), startup accelerator (4 posts)
   - **crypto**: Bitcoin regulation (5 posts)
3. Updates topic engagement metrics for all topics
4. Checks for personalized news in Firestore (filtered by userId)
5. Verifies story cluster post IDs match actual posts

**Expected output:**
- User created with multiple topics
- 26+ posts created across 3 topics with distinct story clusters
- Topics marked as trending (if velocity spikes detected)
- Personalized news items in `trendingNews` collection with:
  - `userId` matching test user
  - `storyClusterPostIds` array with post IDs
  - `storySignature` for deduplication
  - `sourceTopics` array showing which topics posts came from

**Key Features Tested:**
- **Personalization**: News is user-specific (userId field)
- **Story Discovery**: AI identifies distinct stories within topics
- **Story Selection**: AI picks most newsworthy story
- **Post Tracking**: storyClusterPostIds links news to exact posts
- **Deduplication**: storySignature prevents duplicate stories

**Note:** 
- Requires OpenAI API key configured (VITE_OPENAI_API_KEY)
- News generation happens when you refresh news in the app
- The script creates the posts and sets up user profile
- You need to manually trigger news generation in the app UI
- Test user credentials are printed at the end of the script

### Comprehensive Platform Test (`test-platform-comprehensive.js`)

**End-to-end platform test that creates a full test environment with users, posts, comments, and activity.**

```bash
npm run test:platform
```

**What it creates:**
- ✅ 1 main user (author) with selected topics (dev, startups, productivity)
- ✅ 40 other users with varied topics/interests
- ✅ Following relationships (main user follows 15-20 users, 15-20 users follow main user)
- ✅ 100-150+ posts across all 8 topics with varied timestamps
- ✅ Comments and nested replies on 30-40% of posts
- ✅ Rechirps on 10-15 posts
- ✅ Topic engagement metrics updated
- ✅ All data persisted to Firestore

**What it tests:**
- ✅ User creation and authentication
- ✅ Post creation across all topics
- ✅ Following/unfollowing relationships
- ✅ Comment system (top-level and nested replies)
- ✅ Rechirp functionality
- ✅ Topic engagement tracking
- ✅ Data persistence to Firestore
- ✅ Feed personalization setup
- ✅ Notification triggers (comments, replies, rechirps)

**How it works:**
1. Creates 1 main user (author) with topics: `['dev', 'startups', 'productivity']`
2. Creates 40 other users with random topic selections (2-4 topics each)
3. Sets up following relationships:
   - Main user follows 15-20 other users
   - 15-20 users follow main user
   - Cross-following between other users
4. Creates posts:
   - Main user: 20-25 posts across their topics
   - Other users: 3-5 posts each (120-200 total)
   - Posts distributed over last 48 hours
   - Mix of `forAll` and `tuned` reach modes
5. Creates comments:
   - 2-5 top-level comments per selected post
   - 1-3 replies per top-level comment (on 60% of comments)
   - Comments from various users
6. Creates rechirps:
   - 10-15 posts rechirped
   - 1-3 users rechirp each selected post
7. Verifies all data creation

**Expected output:**
- 41 total users created (1 main + 40 others)
- 100-150+ posts created across all topics
- 100-200+ comments created (top-level + replies)
- 10-15 rechirps created
- Following relationships established
- All topics have engagement metrics
- Main user credentials printed for testing

**Test User Credentials:**
The script prints the main user credentials at the end:
- Email: `main-author-{timestamp}@test.com`
- Password: `TestPassword123!`
- User ID and handle are also displayed

**Next Steps After Running:**
1. Log in to the app with the main user credentials
2. Check the "Latest" feed - should show posts from followed users
3. Check the "For You" feed - should show personalized content
4. Test commenting, replying, and rechirping
5. Check notifications - should see activity from other users
6. Test profile pages - view other users' profiles
7. Test following/unfollowing
8. Check trending topics - should see topics with high engagement
9. Test news generation - refresh news to see AI-generated content
10. Test value scoring - posts should have value scores calculated

**Note:**
- This script creates a significant amount of test data
- All data is persisted to your Firebase project
- The script includes rate limiting to avoid Firebase quotas
- Execution time: ~2-5 minutes depending on network speed
- You can run this multiple times (handles existing users gracefully)
- Main user email includes timestamp to avoid conflicts

