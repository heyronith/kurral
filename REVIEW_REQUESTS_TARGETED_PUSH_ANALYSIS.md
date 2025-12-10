# Review Requests: Targeted Push to High KurralScore Users with Matching Interests

## Executive Summary

This document analyzes how to push review requests to high kurralScore users who have matching interests/topics with posts marked `needs_review`, and proposes an enhanced UI component to display these requests efficiently. The goal is to dramatically speed up the review process by proactively engaging the most qualified reviewers.

**Current State**: A `ReviewRequestsPanel` component exists but appears to be basic. This proposal enhances it with intelligent matching, prioritization, and an improved user experience.

---

## Current System Analysis

### Existing Components Found

1. **ReviewRequestsPanel** (`src/webapp/components/ReviewRequestsPanel.tsx`)
   - Already exists and checks for `kurralScore >= 700`
   - Uses `reviewRequestService.getPendingReviewRequests()`
   - Shows priority levels (high/medium/low)
   - Displays semantic topics
   - Has "Review Now" and "View" buttons

2. **Interest Matching Logic** (from `src/webapp/lib/algorithm.ts`)
   - Matches `user.interests` with `chirp.semanticTopics` (substring matching)
   - Uses `user.profileEmbedding` vs `chirp.tunedAudience.targetAudienceEmbedding` (cosine similarity)
   - Matches `user.topics` with `chirp.topic` (exact match)

3. **KurralScore System**
   - Scale: 0-1000
   - Threshold for review panel: 700+
   - Tiers exist (bronze, silver, gold, platinum, etc.)

### Current Limitations

1. **Passive System**: Users must discover review requests themselves
2. **No Proactive Notifications**: No push notifications for matching requests
3. **No Interest-Based Filtering**: Doesn't prioritize by interest match strength
4. **No Batch Processing**: Can't review multiple requests quickly
5. **No Match Quality Indicators**: Doesn't show why a request matches the user

---

## Proposed Solution: Intelligent Review Request Push System

### Core Concept

When a post is marked `needs_review`, the system should:
1. **Identify matching users** based on interests, topics, and kurralScore
2. **Calculate match quality** (how well the post matches each user)
3. **Prioritize requests** by urgency and match quality
4. **Push notifications** to top-matched users
5. **Display in dedicated UI** with rich context and quick actions

---

## User Matching Algorithm

### Matching Criteria (Multi-Factor Scoring)

#### 1. **Interest Match Score** (0-100 points)
- **Semantic Topic Matching**: Compare `user.interests` with `chirp.semanticTopics`
  - Exact match: 100 points
  - Substring match (one contains the other): 80 points
  - Related terms (using embedding similarity): 60 points
  - Multiple matches: Bonus +10 per additional match (max +30)

#### 2. **Topic Expertise Score** (0-50 points)
- **User's Topic History**: Analyze user's past posts/comments in this topic
  - High engagement in topic: 50 points
  - Medium engagement: 30 points
  - Low engagement: 10 points
  - No history: 0 points

#### 3. **Profile Embedding Similarity** (0-40 points)
- **Semantic Profile Match**: Use cosine similarity between:
  - `user.profileEmbedding` and `chirp.tunedAudience.targetAudienceEmbedding`
  - Similarity > 0.8: 40 points
  - Similarity 0.6-0.8: 30 points
  - Similarity 0.4-0.6: 20 points
  - Similarity < 0.4: 0 points

#### 4. **KurralScore Bonus** (0-30 points)
- **Trust Level**: Higher kurralScore = more reliable reviewer
  - Score 900-1000: 30 points
  - Score 800-899: 25 points
  - Score 700-799: 20 points
  - Score < 700: 0 points (not eligible)

#### 5. **Review History Quality** (0-20 points)
- **Past Review Accuracy**: Track how accurate user's past reviews were
  - High accuracy (>80%): 20 points
  - Medium accuracy (60-80%): 10 points
  - Low accuracy (<60%): 0 points
  - No history: 10 points (neutral)

#### 6. **Recency Bonus** (0-10 points)
- **Recent Activity**: Users active in last 24h get bonus
  - Active in last hour: 10 points
  - Active in last 24h: 5 points
  - Inactive > 24h: 0 points

### Total Match Score Calculation

```
Total Score = Interest Match + Topic Expertise + Profile Similarity + 
              KurralScore Bonus + Review History + Recency Bonus

Maximum Score: 250 points
Minimum Threshold: 100 points (to receive request)
```

### User Selection Strategy

1. **Top 20 Matches**: Select top 20 users by total score
2. **Diversity**: Ensure mix of kurralScore tiers (not all 900+)
3. **Geographic Distribution**: If relevant, consider time zones
4. **Avoid Conflicts**: Don't send to post author or close connections

---

## Enhanced UI Component Design

### Component Name: `ReviewRequestsHub`

A dedicated, prominent UI component that serves as the central hub for review requests.

### Location Options

1. **Right Sidebar Panel** (Recommended)
   - Always visible when user has pending requests
   - Collapsible/expandable
   - Shows count badge when collapsed

2. **Dedicated Page** (`/reviews`)
   - Full-page view with filtering and sorting
   - Better for power users
   - Can be accessed from navigation

3. **Notification Bell Integration**
   - Show review requests in notification dropdown
   - Quick access from anywhere

4. **Hybrid Approach** (Best)
   - Sidebar panel for quick access
   - Dedicated page for detailed view
   - Notification bell for alerts

### UI Component Features

#### 1. **Header Section**
- **Title**: "Review Requests" with count badge
- **Filter Toggle**: "My Interests" / "All Requests" / "High Priority"
- **Sort Options**: "Best Match" / "Most Urgent" / "Newest"
- **Refresh Button**: Manual refresh
- **Settings Icon**: Configure preferences (frequency, topics, etc.)

#### 2. **Request Card Design**

Each request card should display:

**Visual Elements:**
- **Priority Badge**: Color-coded (red=high, yellow=medium, blue=low)
- **Match Quality Indicator**: Visual score (e.g., "95% match" with progress bar)
- **Post Preview**: Truncated text with "Read more" option
- **Topic Tags**: Semantic topics as chips/badges
- **Author Info**: Profile picture, name, handle
- **Time Indicator**: "Posted 2h ago" / "Needs review for 1h"

**Match Reasons Display:**
- "Matches your interest: [topic]"
- "You have expertise in: [topic]"
- "High kurralScore: [score]"
- "Similar profile alignment: [percentage]%"

**Quick Actions:**
- **"Quick Review" Button**: Opens inline review modal
- **"View Full Post" Button**: Navigate to post detail
- **"Dismiss" Button**: Remove from list (with reason: "Not my expertise" / "Too busy" / etc.)
- **"Save for Later" Button**: Add to saved reviews list

**Progress Indicator:**
- "2/3 reviews collected" progress bar
- "1 more review needed" text
- Estimated time to decision: "~15 min if you review now"

#### 3. **Batch Actions**
- **"Review All Matched"**: Quick review for all high-match requests
- **"Dismiss All Low Priority"**: Bulk dismiss
- **"Mark All as Viewed"**: Clear unread indicators

#### 4. **Empty States**
- **No Requests**: "No review requests at the moment. Posts matching your interests will appear here."
- **All Reviewed**: "You're all caught up! Great work helping the community."
- **Low Match Quality**: "No high-quality matches found. Check back later or adjust your interests."

#### 5. **Smart Notifications**

**In-App Notifications:**
- Toast notification when new high-match request arrives
- Badge count on component header
- Sound/vibration (user preference)

**Push Notifications** (if implemented):
- "New review request matches your expertise: [topic]"
- "High-priority post needs your review: [preview]"
- "3 posts need review in topics you follow"

---

## Matching Service Architecture

### Service: `reviewMatchingService.ts`

**Functions:**

1. **`findMatchingReviewers(chirp: Chirp, limit: number = 20)`**
   - Finds top N users who match the post
   - Returns sorted list with match scores
   - Excludes post author and close connections

2. **`calculateMatchScore(user: User, chirp: Chirp)`**
   - Calculates total match score (0-250)
   - Returns breakdown by category
   - Caches results for performance

3. **`getUserTopicExpertise(userId: string, topic: string)`**
   - Analyzes user's past posts/comments in topic
   - Returns expertise level (high/medium/low)

4. **`shouldNotifyUser(userId: string, chirpId: string)`**
   - Checks user preferences
   - Checks notification frequency limits
   - Returns boolean

5. **`createReviewRequest(chirpId: string, userId: string, matchScore: number)`**
   - Creates review request record
   - Triggers notification
   - Updates user's pending requests

### Data Structure

**ReviewRequest Type:**
```typescript
{
  id: string;
  chirpId: string;
  userId: string;
  matchScore: number; // 0-250
  matchBreakdown: {
    interestMatch: number;
    topicExpertise: number;
    profileSimilarity: number;
    kurralScoreBonus: number;
    reviewHistory: number;
    recencyBonus: number;
  };
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  expiresAt?: Date; // Auto-expire after 24h
  status: 'pending' | 'reviewed' | 'dismissed' | 'expired';
  dismissedReason?: string;
}
```

---

## Prioritization Logic

### Priority Calculation

**High Priority** (Red):
- Match score > 180 AND
- Post is high-risk (health/finance/politics) OR
- Post has high engagement (>10 comments) OR
- Post is < 1 hour old

**Medium Priority** (Yellow):
- Match score 120-180 OR
- Post is medium-risk OR
- Post has medium engagement (5-10 comments) OR
- Post is 1-4 hours old

**Low Priority** (Blue):
- Match score 100-120 OR
- Post is low-risk OR
- Post has low engagement (<5 comments) OR
- Post is > 4 hours old

### Urgency Factors

- **Time Since Marked**: Older posts = more urgent
- **Review Count**: Fewer reviews = more urgent
- **Engagement Level**: More engagement = more urgent
- **Risk Level**: Higher risk = more urgent

---

## Notification Strategy

### Notification Triggers

1. **Immediate Push** (High Priority):
   - Match score > 200
   - High-risk post
   - User is online/active

2. **Batched Push** (Medium Priority):
   - Match score 150-200
   - Medium-risk post
   - Sent in hourly batches

3. **Digest Push** (Low Priority):
   - Match score 100-150
   - Low-risk post
   - Sent in daily digest

### Notification Content

**Title**: "Review Request: [Topic]"
**Body**: "[Post preview...] - Matches your interest in [topic]. [X] reviews needed."
**Action Buttons**: "Review Now" | "View Post" | "Dismiss"

### Frequency Limits

- **Per User**: Max 5 requests per day (configurable)
- **Per Post**: Max 20 users notified
- **Cooldown**: 1 hour between notifications for same user

---

## User Preferences & Settings

### Settings Panel

Users should be able to configure:

1. **Interest Matching**
   - Enable/disable interest-based matching
   - Select specific interests to match
   - Exclude specific topics

2. **Notification Preferences**
   - Frequency: "Real-time" / "Hourly digest" / "Daily digest" / "Never"
   - Priority filter: "High only" / "High + Medium" / "All"
   - Sound/vibration settings

3. **Review Preferences**
   - Minimum match score threshold (default: 100)
   - Preferred topics (only show these)
   - Blocked topics (never show these)
   - Maximum requests per day

4. **Display Preferences**
   - Show in sidebar: Yes/No
   - Show in notifications: Yes/No
   - Auto-expand new requests: Yes/No

---

## Performance Optimizations

### Caching Strategy

1. **User Interest Cache**: Cache user interests for 1 hour
2. **Match Score Cache**: Cache match scores for 30 minutes
3. **Topic Expertise Cache**: Cache expertise levels for 24 hours
4. **Review History Cache**: Cache review accuracy for 1 hour

### Query Optimization

1. **Indexed Queries**: Index on `kurralScore`, `interests`, `semanticTopics`
2. **Batch Processing**: Process multiple posts in single query
3. **Lazy Loading**: Load review requests on-demand
4. **Pagination**: Load 10 requests at a time

### Real-time Updates

1. **WebSocket/SSE**: Push new requests in real-time
2. **Polling Fallback**: Poll every 5 minutes if WebSocket unavailable
3. **Optimistic Updates**: Update UI immediately, sync in background

---

## Gamification & Incentives

### Rewards System

1. **KurralScore Points**
   - Complete review: +5 points
   - High-quality review (verified sources): +10 points
   - Review matches final consensus: +15 points
   - Review helps reach consensus: +20 points

2. **Badges**
   - "Fact Checker" badge: 10 reviews
   - "Expert Reviewer" badge: 50 reviews
   - "Community Guardian" badge: 100 reviews
   - "Top Reviewer" badge: Top 10% reviewers

3. **Leaderboard**
   - Weekly top reviewers
   - Most accurate reviewers
   - Most helpful reviews

4. **Recognition**
   - Highlight top reviewers in community
   - Feature accurate reviewers
   - Thank you messages from post authors

---

## Analytics & Metrics

### Track These Metrics

1. **Matching Effectiveness**
   - Average match score
   - Review completion rate by match score
   - Time to first review by match score

2. **User Engagement**
   - Review request open rate
   - Review completion rate
   - Dismissal rate and reasons

3. **Speed Improvements**
   - Average time to first review
   - Average time to consensus
   - Review velocity (reviews per hour)

4. **Quality Metrics**
   - Review accuracy rate
   - Source verification rate
   - Consensus confidence distribution

---

## Implementation Phases

### Phase 1: Enhanced Matching (Week 1)
- Implement multi-factor matching algorithm
- Create `reviewMatchingService`
- Add match score calculation
- Test with sample data

### Phase 2: UI Component Enhancement (Week 2)
- Enhance `ReviewRequestsPanel` with new features
- Add match quality indicators
- Implement filtering and sorting
- Add batch actions

### Phase 3: Notifications (Week 3)
- Implement notification system
- Add user preferences
- Create notification content templates
- Test notification delivery

### Phase 4: Analytics & Optimization (Week 4)
- Add analytics tracking
- Implement caching
- Optimize queries
- Performance testing

### Phase 5: Gamification (Week 5)
- Add rewards system
- Create badges
- Implement leaderboard
- Launch community recognition

---

## Success Criteria

### Key Performance Indicators

1. **Speed**: Average time to first review < 30 minutes
2. **Engagement**: Review completion rate > 60%
3. **Quality**: Review accuracy > 75%
4. **User Satisfaction**: User rating > 4/5
5. **Coverage**: 80% of requests get minimum reviews within 2 hours

### Success Metrics

- **Review Velocity**: 3x increase in reviews per hour
- **Match Quality**: Average match score > 150
- **User Participation**: 40% of eligible users participate
- **Consensus Speed**: 50% faster consensus decisions

---

## Risk Mitigation

### Potential Issues

1. **Notification Fatigue**
   - **Mitigation**: Frequency limits, user preferences, smart batching

2. **Low Match Quality**
   - **Mitigation**: Higher thresholds, better matching algorithm, user feedback

3. **Bias in Matching**
   - **Mitigation**: Diversity requirements, avoid echo chambers, cross-topic matching

4. **Performance Issues**
   - **Mitigation**: Caching, indexing, batch processing, lazy loading

5. **User Abuse**
   - **Mitigation**: Rate limiting, quality checks, kurralScore requirements

---

## Conclusion

By pushing review requests to high kurralScore users with matching interests, we can dramatically speed up the fact-checking process while maintaining quality. The enhanced UI component provides an intuitive, efficient interface for reviewers to contribute to the community's fact-checking efforts.

The multi-factor matching algorithm ensures that the right users see the right requests, while the gamification and rewards system incentivizes participation. Combined with smart notifications and user preferences, this creates a powerful, scalable system for community-driven fact-checking.


