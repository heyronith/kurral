# Review Context System: Speed, Bias Handling, and Decision-Making Improvements

## Executive Summary

This document analyzes the current review context system for posts marked `needs_review` and proposes improvements to:
1. **Speed up fact-checking** by incentivizing and prioritizing user reviews
2. **Handle bias** in user-submitted reviews through consensus mechanisms and verification
3. **Make automated decisions** based on aggregated reviews with confidence scoring

**Current System Analysis**: The existing system has a critical flaw - the **first user's submission immediately changes the post status** without any consensus or verification, making it vulnerable to bias and manipulation.

---

## Current System Analysis

### Current Flow (from `src/webapp/lib/firestore.ts` lines 2675-2764)

1. **Post marked `needs_review`** → User sees yellow border and "Needs Review" badge
2. **User submits review context**:
   - Action: `'validate'` or `'invalidate'`
   - Sources: Array of URLs (required, 1-10 URLs)
   - Context: Optional text explanation (max 500 chars)
3. **Immediate status update**:
   - `'validate'` → Status immediately changes to `'clean'`
   - `'invalidate'` → Status immediately changes to `'blocked'`
4. **One review per user per post** (enforced)

### Critical Problems Identified

#### 1. **First-Review-Wins Problem** ⚠️ CRITICAL
- **Location**: `src/webapp/lib/firestore.ts` line 2717
- **Issue**: First user's review immediately changes status without consensus
- **Impact**: 
  - Biased users can manipulate post status
  - No verification of sources
  - No consideration of reviewer reputation
  - No mechanism to handle conflicting reviews

#### 2. **No Bias Detection**
- No check for reviewer's relationship to post author
- No verification of source credibility
- No detection of coordinated reviews
- No weighting based on reviewer's kurralScore/trust

#### 3. **No Consensus Mechanism**
- Single review determines outcome
- No aggregation of multiple reviews
- No confidence scoring
- No threshold for decision-making

#### 4. **No Source Verification**
- URLs are accepted without validation
- No check if sources actually support the claim
- No verification of source credibility
- No detection of fake/misleading sources

#### 5. **No Speed Incentives**
- No prioritization of high-risk posts
- No notifications to expert users
- No gamification or rewards for reviews
- No time-based urgency indicators

---

## Proposed Solutions

### Solution 1: Consensus-Based Decision Making

**Replace immediate status update with consensus mechanism**

#### Implementation Approach

1. **Collect Multiple Reviews** (minimum threshold before decision)
   - Require minimum 3 reviews for high-risk posts
   - Require minimum 2 reviews for non-high-risk posts
   - Allow unlimited reviews (not just one per user)

2. **Weight Reviews by Reviewer Trust**
   - Use `kurralScore` to weight reviews
   - Higher kurralScore = higher weight
   - Formula: `weight = baseWeight * (kurralScore / 1000)`
   - Minimum weight: 0.5 (even low-score users contribute)

3. **Aggregate Reviews**
   - Calculate weighted average: `(sum of validate votes * weights) vs (sum of invalidate votes * weights)`
   - Confidence score: `|validate_weight - invalidate_weight| / total_weight`
   - Decision threshold: 
     - Confidence > 0.6 → Make decision
     - Confidence 0.4-0.6 → Needs more reviews
     - Confidence < 0.4 → Conflicting evidence, flag for human admin review

4. **Source Verification**
   - Automatically verify sources using fact-check agent
   - Check if sources actually support the reviewer's claim
   - Weight reviews with verified sources higher
   - Flag reviews with unverifiable/fake sources

#### Code Structure

```typescript
// New service: reviewConsensusService.ts
export async function evaluateReviewConsensus(chirpId: string): Promise<ConsensusDecision> {
  const reviews = await reviewContextService.getReviewContextsForChirp(chirpId);
  
  if (reviews.length < MIN_REVIEWS_THRESHOLD) {
    return { status: 'pending', needsMoreReviews: true };
  }
  
  // Weight reviews by kurralScore
  const weightedReviews = reviews.map(review => ({
    ...review,
    weight: calculateReviewWeight(review.submittedBy)
  }));
  
  // Aggregate votes
  const validateWeight = weightedReviews
    .filter(r => r.action === 'validate')
    .reduce((sum, r) => sum + r.weight, 0);
    
  const invalidateWeight = weightedReviews
    .filter(r => r.action === 'invalidate')
    .reduce((sum, r) => sum + r.weight, 0);
  
  const totalWeight = validateWeight + invalidateWeight;
  const confidence = Math.abs(validateWeight - invalidateWeight) / totalWeight;
  
  if (confidence > 0.6) {
    const decision = validateWeight > invalidateWeight ? 'clean' : 'blocked';
    return { status: decision, confidence, reviewCount: reviews.length };
  } else if (confidence < 0.4) {
    return { status: 'needs_admin_review', confidence, reviewCount: reviews.length };
  } else {
    return { status: 'pending', needsMoreReviews: true, confidence };
  }
}

function calculateReviewWeight(userId: string): number {
  const user = await userService.getUser(userId);
  const kurralScore = user?.kurralScore?.score ?? 500; // Default to middle
  const baseWeight = 1.0;
  return baseWeight * (kurralScore / 1000); // Scale 0-1000 to 0-1, then multiply
}
```

---

### Solution 2: Bias Detection and Mitigation

#### A. Relationship Detection
- Check if reviewer follows/is followed by post author
- Check if reviewer has interacted with author before
- Weight reviews from connected users lower (potential bias)
- Weight reviews from independent users higher

#### B. Source Credibility Scoring
- Use existing `isTrustedDomain()` function from `factCheckAgent.ts`
- Score sources: Trusted domains (0.95), .gov/.edu (0.85), .org (0.7), others (0.5)
- Weight reviews with higher-credibility sources more
- Flag reviews with only low-credibility sources

#### C. Coordinated Review Detection
- Detect if multiple reviews submitted in short time window
- Check if reviewers are connected to each other
- Flag potential coordinated manipulation
- Require additional reviews if coordination detected

#### D. Reviewer History Analysis
- Track reviewer's past review accuracy
- Compare reviewer's past decisions with final outcomes
- Weight reviewers with high accuracy history higher
- Flag reviewers with consistently biased patterns

#### Code Structure

```typescript
async function detectBias(review: PostReviewContext, chirp: Chirp): Promise<BiasScore> {
  const reviewer = await userService.getUser(review.submittedBy);
  const author = await userService.getUser(chirp.authorId);
  
  // Relationship bias
  const isFollowing = reviewer?.following?.includes(chirp.authorId);
  const isFollowed = author?.following?.includes(review.submittedBy);
  const relationshipBias = (isFollowing || isFollowed) ? 0.3 : 1.0;
  
  // Source credibility
  const sourceScores = review.sources.map(url => scoreEvidence(url));
  const avgSourceCredibility = sourceScores.reduce((a, b) => a + b, 0) / sourceScores.length;
  
  // Review history (if available)
  const pastReviews = await getPastReviewsByUser(review.submittedBy);
  const accuracyScore = calculateReviewAccuracy(pastReviews);
  
  return {
    relationshipBias,
    sourceCredibility: avgSourceCredibility,
    reviewerAccuracy: accuracyScore,
    overallBiasScore: (relationshipBias * 0.3) + (avgSourceCredibility * 0.4) + (accuracyScore * 0.3)
  };
}
```

---

### Solution 3: Speed Improvements

#### A. Prioritization System
- **High-risk posts** (health, finance, politics) → Priority 1
- **Posts with high engagement** → Priority 2
- **Recent posts** (< 1 hour old) → Priority 3
- **Older posts** → Priority 4

#### B. Notification System
- Notify users with high kurralScore when posts need review
- Notify users who follow the post author
- Notify users who have expertise in the topic (based on past posts)
- Batch notifications to avoid spam

#### C. UI Improvements
- Show "X reviews needed" counter on post
- Show progress bar: "2/3 reviews collected"
- Highlight posts needing review in feed
- Quick review button in feed (one-click validate/invalidate)

#### D. Gamification
- Award kurralScore points for helpful reviews
- Track review accuracy and reward accurate reviewers
- Leaderboard for top reviewers
- Badges for review milestones

#### Code Structure

```typescript
// New service: reviewNotificationService.ts
export async function notifyPotentialReviewers(chirp: Chirp): Promise<void> {
  const priority = calculateReviewPriority(chirp);
  
  if (priority === 'high') {
    // Notify high-trust users immediately
    const highTrustUsers = await getUsersWithKurralScore(700, 1000);
    await sendReviewNotifications(chirp, highTrustUsers);
  }
  
  // Notify topic experts
  const topicExperts = await getUsersWithTopicExpertise(chirp.topic);
  await sendReviewNotifications(chirp, topicExperts);
  
  // Notify followers of author
  const author = await userService.getUser(chirp.authorId);
  const followers = await getUsersByIds(author?.followers || []);
  await sendReviewNotifications(chirp, followers);
}

function calculateReviewPriority(chirp: Chirp): 'high' | 'medium' | 'low' {
  const claims = chirp.claims || [];
  const hasHighRiskClaim = claims.some(c => 
    ['health', 'finance', 'politics'].includes(c.domain) || c.riskLevel === 'high'
  );
  
  if (hasHighRiskClaim) return 'high';
  if (chirp.engagementCount > 10) return 'medium';
  return 'low';
}
```

---

### Solution 4: Automated Source Verification

#### Implementation
- When review is submitted, automatically verify sources
- Use fact-check agent to check if sources support reviewer's claim
- Weight verified sources higher
- Flag unverified/misleading sources

#### Code Structure

```typescript
async function verifyReviewSources(
  review: PostReviewContext, 
  chirp: Chirp
): Promise<SourceVerificationResult> {
  const claims = chirp.claims || [];
  const verificationResults = [];
  
  for (const sourceUrl of review.sources) {
    // Use fact-check agent to verify source
    const verification = await factCheckAgent.verifySourceAgainstClaim(
      sourceUrl,
      claims[0], // Primary claim
      review.action
    );
    
    verificationResults.push({
      url: sourceUrl,
      supportsClaim: verification.supports,
      credibility: verification.credibility,
      verified: verification.verified
    });
  }
  
  const verifiedCount = verificationResults.filter(r => r.verified && r.supportsClaim).length;
  const totalCount = verificationResults.length;
  const verificationScore = verifiedCount / totalCount;
  
  return {
    verificationResults,
    overallScore: verificationScore,
    isReliable: verificationScore > 0.7
  };
}
```

---

## Decision-Making Algorithm

### Final Consensus Decision Flow

```
1. Post marked needs_review
   ↓
2. Collect reviews (minimum threshold)
   ↓
3. For each review:
   - Calculate reviewer weight (kurralScore)
   - Detect bias (relationship, source credibility)
   - Verify sources
   - Calculate final review weight
   ↓
4. Aggregate weighted votes
   ↓
5. Calculate confidence score
   ↓
6. Decision:
   - Confidence > 0.6 → Update status (clean/blocked)
   - Confidence 0.4-0.6 → Request more reviews
   - Confidence < 0.4 → Escalate to admin
   ↓
7. If decision made:
   - Update post status
   - Notify reviewers of outcome
   - Update reviewer accuracy scores
```

### Confidence Calculation

```typescript
function calculateConfidence(
  validateWeight: number,
  invalidateWeight: number,
  totalWeight: number
): number {
  const difference = Math.abs(validateWeight - invalidateWeight);
  return difference / totalWeight; // 0 = tied, 1 = unanimous
}

// Decision thresholds:
// - Confidence > 0.6: Strong consensus → Make decision
// - Confidence 0.4-0.6: Weak consensus → Need more reviews
// - Confidence < 0.4: Conflicting → Admin review
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. ✅ Remove immediate status update on first review
2. ✅ Implement minimum review threshold
3. ✅ Add consensus calculation
4. ✅ Weight reviews by kurralScore

### Phase 2: Bias Detection (Week 1)
1. ✅ Relationship detection
2. ✅ Source credibility scoring
3. ✅ Reviewer history tracking
4. ✅ Coordinated review detection

### Phase 3: Speed Improvements (Week 2)
1. ✅ Notification system
2. ✅ Prioritization system
3. ✅ UI improvements (progress indicators)
4. ✅ Quick review buttons

### Phase 4: Advanced Features (Week 3-4)
1. ✅ Automated source verification
2. ✅ Gamification system
3. ✅ Admin escalation workflow
4. ✅ Review accuracy tracking

---

## Code Changes Required

### 1. Modify `reviewContextService.createReviewContext()`
- **File**: `src/webapp/lib/firestore.ts`
- **Change**: Remove immediate status update (line 2717-2726)
- **Add**: Trigger consensus evaluation instead

### 2. Create `reviewConsensusService.ts`
- New service for consensus calculation
- Functions: `evaluateReviewConsensus()`, `calculateConfidence()`, `makeConsensusDecision()`

### 3. Create `reviewBiasService.ts`
- New service for bias detection
- Functions: `detectBias()`, `verifySources()`, `checkCoordination()`

### 4. Create `reviewNotificationService.ts`
- New service for notifications
- Functions: `notifyPotentialReviewers()`, `calculatePriority()`

### 5. Update `ReviewContextModal.tsx`
- Show review progress (X/Y reviews collected)
- Show estimated time to decision
- Display current consensus status

### 6. Add database fields
- `chirp.reviewConsensus`: Current consensus state
- `chirp.reviewCount`: Number of reviews collected
- `chirp.reviewConfidence`: Confidence score
- `user.reviewHistory`: Track past review accuracy

---

## Risk Mitigation

### Potential Issues

1. **Review Manipulation**
   - **Mitigation**: Weight by kurralScore, detect coordination, require minimum reviews

2. **Slow Review Collection**
   - **Mitigation**: Notifications, prioritization, gamification, quick review UI

3. **Bias from Connected Users**
   - **Mitigation**: Relationship detection, lower weight for connected reviewers

4. **Fake Sources**
   - **Mitigation**: Source verification, credibility scoring, trusted domain checking

5. **Admin Overload**
   - **Mitigation**: Only escalate truly conflicting cases (< 0.4 confidence)

---

## Metrics to Track

1. **Review Speed**
   - Average time from `needs_review` to decision
   - Time to first review
   - Time to minimum threshold

2. **Review Quality**
   - Review accuracy (compared to final outcome)
   - Source verification rate
   - Bias detection rate

3. **System Effectiveness**
   - Consensus confidence distribution
   - Admin escalation rate
   - False positive/negative rate

4. **User Engagement**
   - Review participation rate
   - Reviewer retention
   - Review completion rate

---

## Conclusion

The current review context system has a critical flaw where the first review immediately changes post status. The proposed improvements address this through:

1. **Consensus-based decisions** requiring multiple reviews
2. **Bias detection** through relationship analysis and source verification
3. **Speed improvements** through notifications and prioritization
4. **Automated decision-making** with confidence scoring

This creates a robust, fair, and efficient system for handling ambiguous posts while maintaining user trust and preventing manipulation.
