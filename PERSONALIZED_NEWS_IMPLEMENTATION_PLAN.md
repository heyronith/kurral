# Personalized AI-Driven News Generation - Implementation Plan

## Overview
Transform the news generation system from topic-based to user-personalized, using a multi-stage AI agent pipeline that analyzes posts from the user's selected topics to identify and generate newsworthy stories.

---

## Phase 1: Architecture & Data Model

### 1.1 User Context Integration
**Goal**: Retrieve and use user's selected topics for personalized news

**Tasks**:
- Modify `newsService.fetchTrendingNews()` to accept `userId` parameter
- Add helper function `getUserTopics(userId: string): Promise<string[]>`
- Fallback logic: If user has no topics, use trending topics globally
- Cache user topics in store to avoid repeated lookups

**Data Flow**:
```
User ID → User Profile → topics[] → News Service
```

**Files to Modify**:
- `src/webapp/lib/services/newsService.ts` - Add user context
- `src/webapp/lib/firestore.ts` - Add getUserTopics helper (or use existing userService)
- `src/webapp/store/useNewsStore.ts` - Pass userId to service

---

### 1.2 News Data Model Updates
**Goal**: Store user-specific news and story metadata

**New Fields in TrendingNews**:
```typescript
export type TrendingNews = {
  // ... existing fields
  userId?: string; // User this news is personalized for (null = global)
  storyClusterPostIds: string[]; // Post IDs used to generate this news
  storySignature: string; // Hash/signature to detect duplicate stories
  sourceTopics: string[]; // Topics posts came from
}
```

**Firestore Structure**:
- Collection: `trendingNews`
- Index: `userId` + `lastUpdated` (for user-specific queries)
- Index: `storySignature` (for duplication detection)

**Files to Modify**:
- `src/webapp/types/index.ts` - Update TrendingNews type
- `firestore.indexes.json` - Add new indexes

---

## Phase 2: Multi-Topic Post Aggregation

### 2.1 Post Aggregation Service Enhancement
**Goal**: Fetch posts from multiple user topics and combine them

**New Function**:
```typescript
async function getPostsFromUserTopics(
  userTopics: string[],
  hours: number = 4,
  limitPerTopic: number = 50
): Promise<Chirp[]>
```

**Logic**:
1. Fetch posts from each user topic in parallel
2. Combine all posts into single array
3. Sort by engagement + recency
4. Return combined list (max 200 posts to avoid token limits)

**Files to Create/Modify**:
- `src/webapp/lib/services/postAggregationService.ts` - Add new function

---

## Phase 3: AI Agent Pipeline Implementation

### 3.1 Story Discovery Agent
**Goal**: Analyze all posts and identify distinct newsworthy stories

**New File**: `src/webapp/lib/services/storyDiscoveryAgent.ts`

**Function**:
```typescript
interface StoryCluster {
  storyId: string;
  summary: string; // What the story is about
  postIds: string[]; // Posts that belong to this story
  topics: string[]; // Topics these posts came from
  newsworthinessScore: number; // 0-1 score
  keyEntities: string[]; // Key people, places, things
  timeRange: { start: Date; end: Date };
}

async function discoverStories(
  posts: Chirp[],
  userTopics: string[]
): Promise<StoryCluster[]>
```

**AI Prompt Strategy**:
1. **Analysis Phase**: "Analyze these posts and identify distinct news stories"
2. **Clustering Phase**: "Group posts by story theme"
3. **Scoring Phase**: "Score each story for newsworthiness"

**Output Structure**:
```json
{
  "stories": [
    {
      "storyId": "story_1",
      "summary": "npm package security vulnerability discovered",
      "postIds": ["post1", "post2", "post15"],
      "topics": ["dev"],
      "newsworthinessScore": 0.85,
      "keyEntities": ["npm", "security", "vulnerability"],
      "timeRange": { "start": "...", "end": "..." }
    }
  ]
}
```

**Validation**:
- Each story must have ≥5 posts
- Stories must be distinct (not overlapping)
- Newsworthiness score > 0.5

---

### 3.2 Story Selection Agent
**Goal**: Select the most newsworthy story for this user

**New File**: `src/webapp/lib/services/storySelectionAgent.ts`

**Function**:
```typescript
interface StorySelection {
  selectedStory: StoryCluster;
  reason: string; // Why this story was selected
  alternativeStories: StoryCluster[]; // Other stories found
}

async function selectBestStory(
  stories: StoryCluster[],
  userId: string,
  existingNews: TrendingNews[]
): Promise<StorySelection>
```

**Selection Criteria**:
1. **Newsworthiness Score** (highest priority)
2. **Engagement** (total comments/likes)
3. **Recency** (more recent = better)
4. **Deduplication** (not covered in last 3 hours)
5. **User Relevance** (spans user's topics = bonus)

**Deduplication Logic**:
- Generate `storySignature` from key entities + summary
- Check against `existingNews` for same user
- Skip if signature matches recent news

**Files to Create**:
- `src/webapp/lib/services/storySelectionAgent.ts`

---

### 3.3 News Generation Agent Enhancement
**Goal**: Generate news from selected story cluster (already exists, needs enhancement)

**File**: `src/webapp/lib/services/newsGenerationAgent.ts`

**Enhancements**:
1. Accept `storyCluster` instead of raw posts
2. Use `storyCluster.postIds` to fetch exact posts
3. Include story context in prompt
4. Generate `storySignature` for deduplication

**Updated Function**:
```typescript
async function generateNewsFromStory(
  storyCluster: StoryCluster,
  posts: Chirp[] // Posts matching storyCluster.postIds
): Promise<NewsSummary>
```

**Enhanced Prompt**:
- Include story summary from discovery agent
- Reference key entities
- Use posts from story cluster only
- Generate story signature

---

## Phase 4: Post-Generation Concerns

### 4.1 Duplication Prevention

#### 4.1.1 User-Specific Deduplication
**Problem**: Same user shouldn't see duplicate news

**Solution**:
- Store `storySignature` in news document
- Before generating, check user's existing news for matching signatures
- Skip generation if story already covered in last 3 hours

**Implementation**:
```typescript
function generateStorySignature(story: StoryCluster): string {
  // Hash of: keyEntities + summary + timeRange
  // Returns: "npm_security_vulnerability_2024_01_15"
}

async function isStoryAlreadyCovered(
  signature: string,
  userId: string,
  hours: number = 3
): Promise<boolean>
```

#### 4.1.2 Global Deduplication (Optional)
**Problem**: Multiple users might see same story

**Solution**:
- Store global news in separate collection or with `userId: null`
- Allow same story for different users (personalization)
- OR: Generate once globally, personalize presentation

**Decision**: **User-specific only** (each user gets personalized news)

---

### 4.2 Related Posts Matching

#### 4.2.1 Store Story Cluster Post IDs
**Problem**: Need to show exact posts that generated the news

**Solution**:
- Store `storyClusterPostIds` in news document
- Use these IDs to fetch posts for detail view
- Fallback to keyword matching if IDs missing (backward compatibility)

**Implementation in NewsDetailView**:
```typescript
// Priority 1: Use storyClusterPostIds if available
if (selectedNews.storyClusterPostIds?.length > 0) {
  relatedPosts = chirps.filter(c => 
    selectedNews.storyClusterPostIds.includes(c.id)
  );
}
// Priority 2: Fallback to keyword matching
else {
  relatedPosts = matchByKeywords(chirps, selectedNews);
}
```

**Files to Modify**:
- `src/webapp/components/NewsDetailView.tsx` - Use storyClusterPostIds
- `src/webapp/lib/services/newsService.ts` - Store post IDs

---

### 4.3 Caching Strategy

#### 4.3.1 User-Specific Cache
**Problem**: Cache news per user, not globally

**Solution**:
- Modify `getCachedNews()` to accept `userId`
- Query: `where('userId', '==', userId)`
- Cache freshness: 3 hours per user

**Implementation**:
```typescript
async getCachedNews(userId: string | null): Promise<TrendingNews[]> {
  const q = userId 
    ? query(
        collection(db, 'trendingNews'),
        where('userId', '==', userId),
        orderBy('lastUpdated', 'desc'),
        limit(3)
      )
    : query(
        collection(db, 'trendingNews'),
        where('userId', '==', null), // Global news
        orderBy('lastUpdated', 'desc'),
        limit(3)
      );
  // ...
}
```

#### 4.3.2 Cache Invalidation
**Triggers**:
- New posts in user's topics (check every 5 minutes)
- User changes topics (invalidate cache)
- Force refresh button

---

### 4.4 Refresh Logic

#### 4.4.1 Smart Refresh
**Problem**: When to regenerate news?

**Solution**:
- Check if new posts exist in user's topics since last generation
- Only regenerate if:
  - New posts > threshold (e.g., 10 new posts)
  - OR cache is stale (>3 hours)
  - OR user force refreshes

**Implementation**:
```typescript
async function shouldRegenerateNews(
  userId: string,
  lastGenerated: Date
): Promise<boolean> {
  const userTopics = await getUserTopics(userId);
  const newPostsCount = await countNewPostsSince(
    userTopics,
    lastGenerated
  );
  return newPostsCount >= 10 || isStale(lastGenerated);
}
```

---

## Phase 5: Integration & UI Updates

### 5.1 Store Updates
**File**: `src/webapp/store/useNewsStore.ts`

**Changes**:
- `loadTrendingNews()` accepts optional `userId`
- Store current `userId` in state
- Pass `userId` to `newsService.fetchTrendingNews()`

### 5.2 Service Integration
**File**: `src/webapp/lib/services/newsService.ts`

**New Main Function**:
```typescript
async fetchPersonalizedNews(
  userId: string | null,
  forceRefresh: boolean = false
): Promise<TrendingNews[]>
```

**Flow**:
1. Get user topics (or use trending topics if null)
2. Fetch posts from user topics
3. Run Story Discovery Agent
4. Run Story Selection Agent
5. Run News Generation Agent
6. Save with user context
7. Return news

### 5.3 Component Updates
**Files**:
- `src/webapp/components/TrendingNewsSection.tsx` - No changes needed
- `src/webapp/components/NewsDetailView.tsx` - Use storyClusterPostIds
- `src/webapp/pages/ChirpApp.tsx` - Pass userId to store

---

## Phase 6: Error Handling & Edge Cases

### 6.1 User Has No Topics
**Solution**: Fallback to trending topics globally

### 6.2 No Posts in User Topics
**Solution**: Return empty array or show "No news yet" message

### 6.3 Story Discovery Finds No Stories
**Solution**: 
- Lower threshold (minimum 3 posts per story)
- OR return empty array
- OR generate generic "discussion trending" news

### 6.4 AI Agent Failures
**Solution**:
- Retry with simpler prompt
- Fallback to keyword-based clustering
- Log error and continue

### 6.5 Token Limits
**Solution**:
- Limit posts to 200 max
- Process in batches if needed
- Use summarization for very long posts

---

## Phase 7: Performance Optimization

### 7.1 Parallel Processing
- Fetch posts from multiple topics in parallel
- Run story discovery and selection in single agent call (if possible)

### 7.2 Caching
- Cache user topics (5 min TTL)
- Cache discovered stories (1 hour TTL)
- Cache generated news (3 hour TTL)

### 7.3 Incremental Updates
- Only analyze new posts since last generation
- Merge with existing story clusters

---

## Phase 8: Testing Strategy

### 8.1 Unit Tests
- Story signature generation
- Deduplication logic
- Post aggregation

### 8.2 Integration Tests
- Full pipeline with mock posts
- User context retrieval
- Cache behavior

### 8.3 Manual Testing
- User with multiple topics
- User with no topics
- User with very active topics
- User with inactive topics

---

## Implementation Order

1. **Phase 1**: Data model & user context (Foundation)
2. **Phase 2**: Post aggregation (Data collection)
3. **Phase 3**: AI agents (Core logic)
4. **Phase 4**: Post-generation concerns (Quality & UX)
5. **Phase 5**: Integration (Connect everything)
6. **Phase 6**: Error handling (Robustness)
7. **Phase 7**: Performance (Optimization)
8. **Phase 8**: Testing (Validation)

---

## Success Metrics

- **Personalization**: News reflects user's topics
- **Quality**: Stories are distinct and newsworthy
- **Performance**: Generation completes in <30 seconds
- **Deduplication**: No duplicate stories for same user
- **Relevance**: Related posts match news content accurately

---

## Notes

- All AI agents use existing `BaseAgent` class
- Maintain backward compatibility (global news still works)
- Consider cost: Each generation = 3-4 AI calls (discovery, selection, generation)
- Monitor token usage and optimize prompts

