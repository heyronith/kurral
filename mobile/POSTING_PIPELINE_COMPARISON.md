# Posting Pipeline Comparison: Web App vs Mobile App

**Analysis Date:** Based on codebase review  
**Status:** ❌ **NOT MATCHING** - Mobile app is missing critical backend processing

---

## Executive Summary

The mobile app posting pipeline is **significantly different** from the web app. The mobile app only handles basic chirp creation but **completely bypasses** the value pipeline, fact checking, topic engagement tracking, and notification creation that happens in the web app.

---

## Web App Posting Pipeline

### 1. Composer Component (`src/webapp/components/Composer.tsx`)

**Data Preparation (lines 907-1087):**
- ✅ Text content (plain and formatted HTML)
- ✅ Semantic analysis via `reachAgent.analyzePostContent()`:
  - `semanticTopics`: Extracted semantic topics
  - `entities`: Named entities
  - `intent`: Post intent (question, announcement, etc.)
  - `bucketFromAI`: AI-suggested topic bucket
- ✅ Topic bucket mapping: Maps semantic topics to buckets via `mapSemanticTopicToBucket()`
- ✅ Creates missing topics via `createMissingTopics()`
- ✅ Content embedding generation via `tryGenerateEmbedding()`
- ✅ Mention resolution: Resolves @handles to user IDs
- ✅ Topic resolution: Resolves to selected topic or AI-suggested topic
- ✅ Ensures topic bucket exists via `ensureBucket()`

**Chirp Data Sent (lines 1050-1085):**
```typescript
{
  authorId, text, topic, reachMode, tunedAudience,
  contentEmbedding, mentions, quotedChirpId,
  semanticTopics, semanticTopicBuckets, entities, intent, analyzedAt,
  imageUrl, scheduledAt, formattedText
}
```

### 2. Feed Store (`src/webapp/store/useFeedStore.ts`)

**addChirp Function (lines 47-88):**
1. ✅ Calls `chirpService.createChirp(chirpData)` → Creates document in Firestore
2. ✅ Calls `topicService.incrementTopicEngagement()` → Updates topic engagement metrics (async, fire-and-forget)
3. ✅ Calls `processChirpValue(newChirp)` → **Critical backend processing** (async, fire-and-forget)

### 3. Chirp Service (`src/webapp/lib/firestore.ts`)

**createChirp Function (lines 684-843):**
1. ✅ Creates Firestore document with all fields
2. ✅ Sets `factCheckingStatus: 'pending'` and `factCheckingStartedAt`
3. ✅ Creates mention notifications via `notificationService.createNotification()` for each mentioned user
4. ✅ Creates rechirp notifications if applicable
5. ✅ Returns created chirp

### 4. Value Pipeline Service (`src/webapp/lib/services/valuePipelineService.ts`)

**processChirpValue Function (lines 263-710):**
This is the **core backend processing pipeline** that runs after chirp creation:

1. ✅ **Pre-check Gate**: Determines if fact-checking is needed via `preCheckChirp()`
2. ✅ **Claim Extraction**: Extracts claims from text via `extractClaimsForChirp()`
3. ✅ **Fact Checking**: Runs fact-checking on claims via `factCheckClaims()` (if needed)
4. ✅ **Discussion Analysis**: Analyzes comment threads for quality
5. ✅ **Policy Evaluation**: Evaluates policy and sets `factCheckStatus` (clean/needs_review/blocked)
6. ✅ **Value Scoring**: Scores the chirp's value via `scoreChirpValue()`
7. ✅ **Explanation Generation**: Generates value explanation
8. ✅ **Updates Firestore**: Saves all insights back to the chirp document

---

## Mobile App Posting Pipeline

### 1. Composer Component (`mobile/src/components/Composer/ComposerModal.tsx`)

**Data Preparation (lines 264-315):**
- ✅ Text content (plain and formatted HTML via markdown conversion)
- ✅ Mention resolution: Resolves @handles to user IDs (limited to 3 for performance)
- ❌ **NO semantic analysis** (no `reachAgent`, no `analyzePostContent`)
- ❌ **NO semantic topics extraction**
- ❌ **NO entities extraction**
- ❌ **NO intent detection**
- ❌ **NO topic bucket mapping**
- ❌ **NO content embedding generation**
- ❌ **NO topic creation/validation**

**Chirp Data Sent (lines 294-305):**
```typescript
{
  authorId, text, topic, reachMode, tunedAudience,
  quotedChirpId, imageUrl, scheduledAt, formattedText, mentions
}
```

**Missing Fields:**
- ❌ `semanticTopics`
- ❌ `semanticTopicBuckets`
- ❌ `entities`
- ❌ `intent`
- ❌ `analyzedAt`
- ❌ `contentEmbedding`

### 2. Feed Store (`mobile/src/stores/useFeedStore.ts`)

**addChirp Function (lines 52-59):**
1. ✅ Calls `chirpService.createChirp(chirpData)` → Creates document in Firestore
2. ❌ **NO topic engagement increment** (missing `topicService.incrementTopicEngagement()`)
3. ❌ **NO value pipeline processing** (missing `processChirpValue()` call)

### 3. Chirp Service (`mobile/src/services/chirpService.ts`)

**createChirp Function (lines 152-189):**
1. ✅ Creates Firestore document with provided fields
2. ❌ **NO factCheckingStatus initialization** (web app sets `factCheckingStatus: 'pending'`)
3. ❌ **NO mention notifications** (web app creates notifications for mentioned users)
4. ❌ **NO rechirp notifications** (web app creates notifications for rechirps)
5. ✅ Returns created chirp

---

## Critical Differences

### ❌ Missing Backend Processing

| Feature | Web App | Mobile App | Impact |
|---------|---------|------------|--------|
| **Fact Checking** | ✅ Automatic via `processChirpValue()` | ❌ Never triggered | Posts never get fact-checked |
| **Value Scoring** | ✅ Automatic via `processChirpValue()` | ❌ Never triggered | Posts never get value scores |
| **Claim Extraction** | ✅ Automatic via `processChirpValue()` | ❌ Never triggered | Posts never get claims extracted |
| **Discussion Quality** | ✅ Automatic via `processChirpValue()` | ❌ Never triggered | No discussion quality metrics |
| **Topic Engagement** | ✅ Automatic via `topicService.incrementTopicEngagement()` | ❌ Never triggered | Topic metrics not updated |
| **Mention Notifications** | ✅ Created in `createChirp()` | ❌ Not created | Users don't get notified when mentioned |
| **Semantic Analysis** | ✅ AI-powered analysis in composer | ❌ Not performed | No semantic topics/entities/intent |
| **Content Embedding** | ✅ Generated in composer | ❌ Not generated | Affects semantic search/recommendations |

### ❌ Missing Data Fields

The mobile app doesn't send these fields that the web app does:
- `semanticTopics`: Affects topic discovery and feed recommendations
- `semanticTopicBuckets`: Affects topic organization
- `entities`: Affects entity-based features
- `intent`: Affects intent-based features
- `analyzedAt`: Metadata for analysis tracking
- `contentEmbedding`: Affects semantic similarity and recommendations

### ❌ Missing Initialization

The mobile app's `createChirp` doesn't initialize:
- `factCheckingStatus: 'pending'`: Required for fact-checking pipeline to process the chirp

---

## Backend Processing Architecture

### How Fact Checking Works

1. **Frontend triggers**: `processChirpValue()` is called from the frontend after chirp creation
2. **No automatic triggers**: There are **NO** Firestore triggers or Cloud Functions that automatically process chirps
3. **Client-side processing**: All processing happens via frontend calling backend services
4. **Status tracking**: Chirps are marked with `factCheckingStatus: 'pending'` → `'in_progress'` → `'completed'`

### Cloud Functions Analysis

From `functions/src/index.ts`:
- ✅ Notification creation (via callable function, not automatic)
- ✅ Review request emails (scheduled cron, processes existing `needs_review` posts)
- ✅ RSS polling (creates chirps, but also sets `factCheckingStatus: 'pending'`)
- ❌ **NO automatic chirp processing triggers**

**Conclusion**: Fact checking and value pipeline are **completely frontend-driven**. If the mobile app doesn't call `processChirpValue()`, posts will never be processed.

---

## Impact Assessment

### High Impact ❌

1. **No Fact Checking**: Mobile posts never go through fact-checking, meaning:
   - No claim extraction
   - No fact verification
   - No policy evaluation
   - No `factCheckStatus` (clean/needs_review/blocked)

2. **No Value Scoring**: Mobile posts never get value scores, meaning:
   - No value metrics
   - Affects "Most Valued" feed
   - Affects user reputation calculations

3. **No Notifications**: Mentioned users don't get notified

4. **No Topic Engagement**: Topic metrics don't update, affecting trending topics

### Medium Impact ⚠️

5. **No Semantic Analysis**: Missing semantic topics/entities/intent affects:
   - Topic discovery
   - Feed recommendations
   - Search functionality

6. **No Content Embeddings**: Affects:
   - Semantic similarity calculations
   - Recommendation algorithms

---

## Recommendations

## Implementation Status

✅ **COMPLETED:** All Priority 1 items have been implemented to match the web app pipeline:

1. ✅ **Added `processChirpValue()` call** in `useFeedStore.addChirp()` after chirp creation
   - Uses wrapper service that imports from webapp (`mobile/src/services/valuePipelineService.ts`)
   - Triggers asynchronously after chirp creation (doesn't block posting)

2. ✅ **Added `topicService.incrementTopicEngagement()` call** in `useFeedStore.addChirp()`
   - Created mobile-specific topicService (`mobile/src/services/topicService.ts`)
   - Increments engagement for both explicit topic and semantic topics

3. ✅ **Initialized `factCheckingStatus: 'pending'`** in `chirpService.createChirp()`
   - Also initializes `factCheckingStartedAt` timestamp
   - Matches webapp behavior exactly

4. ✅ **Created mention notifications** in `chirpService.createChirp()`
   - Created mobile-specific notificationService (`mobile/src/services/notificationService.ts`)
   - Creates notifications for mentions and rechirps via Cloud Function
   - Uses fire-and-forget pattern (doesn't block posting)

5. ✅ **Added `updateChirpInsights()` method** to `chirpService`
   - Required for `processChirpValue` to update chirp insights
   - Handles serialization of claims, fact checks, value scores, etc.

**Priority 2 (Optional - Now Implemented):**
- ✅ **Semantic analysis** in ComposerModal
  - Uses `getReachAgent()` to analyze post content
  - Extracts semantic topics, entities, intent, and suggested bucket
  - Maps semantic topics to buckets using `mapSemanticTopicToBucket()`
  - Creates missing topics
  - Falls back to keyword extraction if AI analysis fails
- ✅ **Generate content embeddings** in ComposerModal
  - Uses `tryGenerateEmbedding()` to generate embeddings for post content
  - Embeddings are stored in `contentEmbedding` field

**Implementation Details:**
- Created wrapper services:
  - `mobile/src/services/reachAgentService.ts` - Re-exports `getReachAgent` from webapp
  - `mobile/src/services/embeddingService.ts` - Re-exports `tryGenerateEmbedding` from webapp
  - `mobile/src/services/topicBucketService.ts` - Re-exports bucket mapping functions from webapp
- Updated `ComposerModal.handlePost()` to:
  1. Load available topics (top 30 + user's topics) from webapp's topicService
  2. Call `reachAgent.analyzePostContent()` if available (for posts >= 4 chars)
  3. Fallback to keyword extraction if AI analysis fails
  4. Normalize and map semantic topics to buckets
  5. Generate content embedding using `tryGenerateEmbedding()`
  6. Include all semantic data (topics, entities, intent, embedding) in chirpData

All semantic analysis and embedding generation now matches webapp behavior exactly.

---

## Code References

- Web Composer: `src/webapp/components/Composer.tsx:907-1087`
- Web Feed Store: `src/webapp/store/useFeedStore.ts:47-88`
- Web Chirp Service: `src/webapp/lib/firestore.ts:684-843`
- Web Value Pipeline: `src/webapp/lib/services/valuePipelineService.ts:263-710`
- Mobile Composer: `mobile/src/components/Composer/ComposerModal.tsx:285-315`
- Mobile Feed Store: `mobile/src/stores/useFeedStore.ts:52-59`
- Mobile Chirp Service: `mobile/src/services/chirpService.ts:152-189`

