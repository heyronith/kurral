# Semantic Topics Migration - Implementation Plan

## Overview
Migrate from legacy 8-topic system to fully semantic topics for discovery, views, and engagement tracking.

---

## Step 1: Update Data Types & Types
**Files:** `src/webapp/types/index.ts`

**Changes:**
- Change `ForYouConfig.likedTopics` and `mutedTopics` from `Topic[]` to `string[]` (support semantic topics)
- Keep `Topic` type for backward compatibility but allow semantic topics in config
- Update `TopicMetadata` to work with dynamic topic names (not just 8 legacy)

**Why:** Enable semantic topics in user preferences (liked/muted).

---

## Step 2: Update Topic Query Service
**Files:** `src/webapp/lib/services/postAggregationService.ts`

**Changes:**
- Update `getPostsByTopic()` to query both:
  - Legacy `topic` field: `where('topic', '==', topicName)`
  - Semantic topics array: `where('semanticTopics', 'array-contains', topicName)`
- Combine results and dedupe by post ID
- Update `getTopPostsForTopic()` and `getPostsForUserTopics()` to use new query logic

**Why:** Topic views must show posts with semantic topics, not just legacy topics.

---

## Step 3: Update Topic Engagement Tracking
**Files:** `src/webapp/lib/firestore.ts` (topicService section)

**Changes:**
- Update `refreshTopicEngagement()` to:
  - Extract semantic topics from all posts in last 48h
  - Count posts per semantic topic (48h, 4h, 1h windows)
  - Create/update `TopicMetadata` for each semantic topic found
  - Track both legacy and semantic topics
- Update `incrementTopicEngagement()` to handle semantic topics
- Update `recalculateTopicMetrics()` to work with semantic topics

**Why:** Trending topics must reflect actual semantic topic activity, not just 8 legacy topics.

---

## Step 4: Update Topic Discovery (RightPanel)
**Files:** `src/webapp/components/RightPanel.tsx`, `src/webapp/store/useTopicStore.ts`

**Changes:**
- Update `useTopicStore.loadTrendingTopics()` to:
  - Fetch top semantic topics from `topicService.getTrendingTopics()`
  - Include both legacy and semantic topics
  - Sort by engagement (postsLast1h)
- Update `RightPanel` to display semantic topics in trending list
- Ensure topic names are clickable and work with `selectTopic()`

**Why:** Users must discover and click on semantic topics like "react", "typescript", etc.

---

## Step 5: Update Instruction Service
**Files:** `src/webapp/lib/services/instructionService.ts`

**Changes:**
- Update `sanitizeTopics()` to:
  - Accept semantic topics (not just legacy 8)
  - Return `string[]` instead of `Topic[]`
  - Keep validation (normalize, dedupe)
- Update `buildTopicPool()` to include semantic topics from user interests
- Update AI prompt to suggest semantic topics when appropriate

**Why:** Instructions like "show me more react posts" should add "react" to likedTopics, not fail.

---

## Step 6: Update Algorithm (Verify Semantic Topic Matching)
**Files:** `src/webapp/lib/algorithm.ts`

**Changes:**
- Verify `matchesTopic()` function handles semantic topics correctly (already implemented)
- Ensure `likedTopics` and `mutedTopics` work with semantic topic strings
- Test that semantic topics in config match `chirp.semanticTopics` array

**Why:** Ensure feed scoring/eligibility works with semantic topics in user config.

---

## Step 7: Update Topic Detail View
**Files:** `src/webapp/components/TopicDetailView.tsx`

**Changes:**
- No changes needed if `getPostsByTopic()` is updated (Step 2)
- Verify it displays semantic topic names correctly
- Ensure back button and navigation work

**Why:** Topic views should automatically work once query service is updated.

---

## Step 8: Update Topic Service - Get Trending Topics
**Files:** `src/webapp/lib/firestore.ts` (topicService.getTrendingTopics)

**Changes:**
- Update `getTrendingTopics()` to:
  - Query all topics (legacy + semantic) from `topics` collection
  - Filter by `isTrending: true` or sort by `postsLast1h`
  - Return top N topics (not just legacy 8)
  - Include both legacy and semantic topics in results

**Why:** Trending topics list must include semantic topics, not just 8 legacy.

---

## Step 9: Update Composer & Rechirp Logic
**Files:** `src/webapp/components/Composer.tsx`, `src/webapp/components/ChirpCard.tsx`

**Changes:**
- Update `handleRechirp()` in `ChirpCard.tsx` to:
  - Copy `semanticTopics` array when rechirping
  - Keep legacy `topic` for backward compatibility
- Verify Composer generates semantic topics for all posts

**Why:** Rechirps should preserve semantic topics, not just legacy topic.

---

## Step 10: Testing & Validation
**Files:** Create `scripts/test-semantic-topics-migration.js`

**Changes:**
- Test topic discovery shows semantic topics
- Test topic views show posts with semantic topics
- Test engagement tracking counts semantic topics
- Test instructions can add semantic topics to likedTopics
- Test feed scoring works with semantic topics in config
- Test backward compatibility (legacy topics still work)

**Why:** Ensure end-to-end functionality before deployment.

---

## Implementation Order
1. **Step 1** (Types) - Foundation
2. **Step 2** (Query Service) - Core functionality
3. **Step 3** (Engagement Tracking) - Data layer
4. **Step 4** (Discovery) - UI layer
5. **Step 5** (Instructions) - User input
6. **Step 6** (Algorithm) - Verify existing
7. **Step 7** (Topic View) - Verify works
8. **Step 8** (Trending Service) - Complete discovery
9. **Step 9** (Composer/Rechirp) - Edge cases
10. **Step 10** (Testing) - Validation

---

## Key Considerations
- **Backward Compatibility:** Legacy topics must continue working
- **Performance:** Semantic topic queries may be slower (array-contains queries)
- **Data Migration:** No migration needed - semantic topics already exist in posts
- **Firestore Indexes:** May need composite index for `semanticTopics` + `createdAt` queries
- **UI/UX:** Topic names should be normalized/displayed consistently

---

## Success Criteria
✅ Users can discover semantic topics in trending list
✅ Users can click semantic topics to view posts
✅ Engagement tracking includes semantic topics
✅ Instructions can add semantic topics to preferences
✅ Feed scoring works with semantic topics
✅ Legacy topics still work (backward compatible)

