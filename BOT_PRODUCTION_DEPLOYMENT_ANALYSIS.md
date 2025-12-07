# Bot Production Deployment Analysis

## Current Infrastructure Analysis

### What You Have:
1. **Vercel** - Frontend hosting + serverless functions
   - `vercel.json` configured for Vite app
   - API functions in `/api` folder (openai-proxy.js, detect-country.js)
   - **Limitation**: Serverless functions have execution time limits (10s free, 60s pro)

2. **Firebase** - Backend services
   - Firestore (database)
   - Auth
   - Storage
   - **No Cloud Functions configured yet** (no functions folder found)

### Bot Worker Requirements:
- **Pipeline**: Runs every 1 hour (fetch articles, route to bots, schedule posts)
- **Post Dispatcher**: Checks every 15 seconds for due posts and publishes them

---

## Problem: Vercel Cannot Run Long-Running Processes

**Vercel Constraints:**
- Serverless functions timeout after 10s (free) or 60s (pro)
- Cannot run continuous processes
- Cannot keep connections alive indefinitely
- Bot worker needs to run 24/7

**Conclusion:** You **CANNOT** run the bot worker directly on Vercel.

---

## Solution Options (Using Your Current Stack)

### Option 1: Vercel Cron Jobs + Serverless Functions (Simplest)

**How it works:**
- Split bot worker into two scheduled functions
- Pipeline function: Runs hourly via Vercel Cron
- Post dispatcher function: Runs every minute via Vercel Cron (checks for due posts)

**Pros:**
- Uses existing Vercel infrastructure
- No new services needed
- Simple to set up

**Cons:**
- Post dispatcher runs every 60s instead of 15s (acceptable trade-off)
- Functions have execution time limits (but should be fine for these tasks)

**Implementation:**
1. Create `/api/bot-pipeline.js` - Runs hourly
2. Create `/api/bot-dispatcher.js` - Runs every minute
3. Add `vercel.json` cron configuration

---

### Option 2: Firebase Cloud Functions + Cloud Scheduler (Best for Firebase Stack)

**How it works:**
- Set up Firebase Cloud Functions
- Use Cloud Scheduler to trigger functions on schedule
- Pipeline function: Hourly trigger
- Post dispatcher function: Every minute trigger

**Pros:**
- Native Firebase integration
- Better for Firebase-heavy stack
- More reliable scheduling
- Can run longer (up to 9 minutes per function)

**Cons:**
- Requires Firebase Functions setup (one-time)
- Need to enable Cloud Scheduler API

**Implementation:**
1. Create `functions/` folder
2. Deploy functions to Firebase
3. Set up Cloud Scheduler triggers

---

### Option 3: External Service (Not Using Current Stack)

**Options:**
- Railway, Render, Fly.io (run Node.js worker)
- Requires separate service outside Vercel/Firebase

**Cons:**
- Additional service to manage
- Additional cost
- More complex setup

---

## Recommended Solution: Option 1 (Vercel Cron Jobs)

**Why:**
- Simplest to implement
- Uses your existing Vercel setup
- No new services or accounts needed
- Works with your current infrastructure

**Trade-offs:**
- Post dispatcher runs every 60s instead of 15s (minimal impact)
- Functions must complete within timeout limits (should be fine)

---

## Implementation Plan

### Step 1: Create Vercel Serverless Functions

**File: `/api/bot-pipeline.js`**
- Runs the news pipeline (fetch articles, route, schedule posts)
- Triggered hourly by Vercel Cron

**File: `/api/bot-dispatcher.js`**
- Checks Firestore for due posts
- Publishes them
- Triggered every minute by Vercel Cron

### Step 2: Configure Vercel Cron

Add cron configuration to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/bot-pipeline",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/bot-dispatcher",
      "schedule": "* * * * *"
    }
  ]
}
```

### Step 3: Set Environment Variables in Vercel

Add to Vercel project settings:
- `VITE_NEWS_API_KEY` (or `NEWS_API_KEY`)
- `VITE_FIREBASE_API_KEY` (or `FIREBASE_API_KEY`)
- All other Firebase config vars
- `VITE_NEWS_PIPELINE_INTERVAL_MS=0` (functions handle scheduling)

---

## Answer to Your Question

**Can we use current infrastructure (Vercel + Firebase)?**

**YES**, but with modifications:
- ✅ Use Vercel serverless functions (already have `/api` folder)
- ✅ Use Vercel Cron Jobs for scheduling
- ✅ Use Firebase Firestore (already using it)
- ❌ Cannot run continuous worker process on Vercel
- ✅ Can achieve same result with scheduled functions

**Simplest approach:** Convert bot worker into two scheduled Vercel functions.

---

## Next Steps

I can implement Option 1 (Vercel Cron Jobs) right now. This will:
1. Create the two serverless functions
2. Update `vercel.json` with cron configuration
3. Ensure it works with your existing Firebase setup

Would you like me to implement this?
