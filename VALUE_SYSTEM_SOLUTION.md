# Value System: First-Principles Engineering Solution

**Approach:** Start with the fundamental problem, identify root causes, then design solutions that address the root causes rather than symptoms.

---

## Part 1: First-Principles Analysis

### 1.1 What is the Core Problem?

**The fundamental issue:** We're trying to measure "value" using a system that can be gamed because:

1. **We trust the LLM too much** - LLM-based extraction/scoring is non-deterministic and can be fooled
2. **We have no ground truth** - We don't know what "true value" actually is
3. **We optimize for the wrong thing** - We optimize for LLM scores, not actual user value
4. **We have no feedback loop** - We don't learn from mistakes
5. **We have no adversarial testing** - We don't test against gaming attempts

### 1.2 What Should We Actually Measure?

Instead of asking "what does the LLM think is valuable?", ask:

**"What do users actually find valuable?"**

This is the ground truth. Everything else is a proxy.

**How do we measure what users find valuable?**
- Users spend time reading/engaging with posts
- Users share posts with others
- Users cite posts in their own posts
- Users return to posts later
- Users follow the author
- Users engage in discussion

These are **behavioral signals** that indicate actual value.

### 1.3 The Fundamental Insight

**LLM-based scoring is a proxy for user value, not a measure of it.**

Proxies can be gamed. Ground truth cannot.

**Solution:** Use behavioral signals as ground truth, and use LLM scoring as one input to predict behavioral signals.

---

## Part 2: Redesigned Architecture

### 2.1 Three-Layer System

```
Layer 1: Behavioral Signals (Ground Truth)
  ↓
Layer 2: Predictive Models (LLM + other signals)
  ↓
Layer 3: Ranking/Recommendation (Use predictions to rank)
```

**Layer 1: Behavioral Signals (Ground Truth)**
- Time spent reading
- Shares/rechirps
- **Citations from community review** (via PostReviewContext)
- References in discussion comments
- Bookmarks
- Follows
- Discussion quality

**Layer 2: Predictive Models**
- LLM-based scoring (one input)
- Fact-check verdicts (one input)
- User history (one input)
- Content analysis (one input)
- Ensemble model (combines all inputs)

**Layer 3: Ranking/Recommendation**
- Use predictions to rank posts
- Use behavioral signals to validate predictions
- Retrain models based on validation

### 2.2 Key Principle: Separation of Concerns

```
Scoring ≠ Ranking ≠ Recommendation

Scoring: What is the value of this post?
Ranking: In what order should we show posts?
Recommendation: Which posts should we show to this user?
```

Currently, the system conflates these. We need to separate them.

---

## Part 3: Detailed Solution

### 3.1 Layer 1: Behavioral Signals

**Define behavioral signals:**

```typescript
type BehavioralSignal = {
  postId: string;
  userId: string;
  signalType: 'view' | 'share' | 'cite' | 'discuss' | 'follow' | 'bookmark';
  weight: number;  // How much this signal matters
  timestamp: Date;
  context?: {
    timeSpentMs?: number;
    depthOfEngagement?: 'skim' | 'read' | 'deep_read';
    discussionQuality?: number;
    citationStrength?: 'weak' | 'medium' | 'strong';  // For citations
  };
};

type PostBehavioralMetrics = {
  postId: string;
  totalViews: number;
  uniqueViewers: number;
  avgTimeSpentMs: number;
  shareCount: number;
  citationCount: number;  // From PostReviewContext submissions
  citationStrength: number;  // Average strength of citations (0-1)
  discussionReferenceCount: number;  // References in comments
  followCount: number;
  discussionQualityScore: number;
  bookmarkCount: number;
  
  // Derived metrics
  engagementRate: number;  // (shares + cites + follows) / views
  qualityScore: number;    // Weighted combination of signals
  trustScore: number;      // Based on user quality
};
```

**Why this works:**
- Behavioral signals are hard to fake (require real user engagement)
- Behavioral signals are objective (can be measured)
- Behavioral signals are diverse (multiple ways to show value)
- Behavioral signals are delayed (takes time to accumulate, harder to game)
- **Citations come from community review** (PostReviewContext) - decentralized and evidence-based

**Gaming resistance:**
- Can't fake views (requires real users)
- Can't fake shares (requires real users to share)
- Can't fake citations (requires real users to review and provide evidence)
- Can't fake discussion (requires real engagement)
- Can't fake follows (requires real users)

### 3.1.1 How Citations Work (Community-Driven)

**Key insight:** Citations are already happening through the existing `PostReviewContext` infrastructure. When users review posts marked "needs_review", they're adding sources and evidence. These ARE citations.

**The flow:**

```
Post A: "Vaccines cause autism"
↓
Fact-check: verdict = 'false' or 'unknown'
↓
Status: 'needs_review'
↓
Users with similar interests review it
↓
They submit PostReviewContext with:
  - action: 'validate' or 'invalidate'
  - sources: [URLs with evidence]
  - context: explanation
↓
These submissions ARE citations to Post A
↓
Citation count increases
↓
Used in value scoring
```

**Implementation:**

```typescript
// Extend Chirp type to track citations
export type Chirp = {
  // ... existing fields
  
  // NEW: Citation tracking
  citationCount: number;           // How many times cited
  citationStrength: number;        // Average strength (0-1)
  citations: Array<{
    postId: string;                // Post that cited this
    userId: string;                // User who cited
    sources: string[];             // Evidence sources
    verdict: 'validate' | 'invalidate';
    strength: 'weak' | 'medium' | 'strong';
    createdAt: Date;
  }>;
};

// When PostReviewContext is created, increment citation count
async function createPostReviewContext(context: PostReviewContext) {
  await addDoc(collection(db, 'postReviewContexts'), context);
  
  // Increment citation count on the post
  await updateDoc(doc(db, 'chirps', context.chirpId), {
    citationCount: increment(1),
    citations: arrayUnion({
      postId: context.chirpId,
      userId: context.submittedBy,
      sources: context.sources,
      verdict: context.action,
      strength: determineCitationStrength(context),
      createdAt: context.createdAt
    })
  });
}

// Determine citation strength based on evidence quality
function determineCitationStrength(context: PostReviewContext): 'weak' | 'medium' | 'strong' {
  const sourceCount = context.sources.length;
  const hasContext = !!context.context && context.context.length > 100;
  
  if (sourceCount >= 3 && hasContext) return 'strong';
  if (sourceCount >= 2 || hasContext) return 'medium';
  return 'weak';
}
```

**Why this is better than LLM-based citation detection:**
- Already implemented (no new infrastructure)
- Community-driven (decentralized)
- Evidence-based (sources are provided)
- Transparent (users can see citations)
- Hard to game (requires real review effort)
- Weighted by strength (strong citations matter more)

### 3.2 Layer 2: Predictive Models

**Problem:** We can't wait for behavioral signals to accumulate. New posts need scores immediately.

**Solution:** Use predictive models to estimate what behavioral signals will be, then validate against actual signals.

**Model 1: Content Quality Model**

```typescript
type ContentQualityPrediction = {
  postId: string;
  
  // Factual accuracy
  factualAccuracy: number;      // 0-1, based on fact-checks
  factCheckCoverage: number;    // 0-1, % of claims fact-checked
  
  // Clarity and structure
  clarity: number;              // 0-1, readability
  structure: number;            // 0-1, organization
  
  // Depth
  depth: number;                // 0-1, how thorough
  
  // Novelty
  novelty: number;              // 0-1, how novel
  
  // Tone
  tone: 'hostile' | 'neutral' | 'respectful';
  
  // Confidence
  confidence: number;           // 0-1, how confident in this prediction
};
```

**How to compute:**
1. Extract claims (as before)
2. Fact-check claims (as before)
3. Analyze structure (readability, organization)
4. Analyze novelty (compare to similar posts)
5. Analyze tone (sentiment analysis)
6. Combine into single score

**Key difference:** Don't use LLM to score directly. Use LLM to extract features, then use a trained model to score.

**Model 2: User Quality Model**

```typescript
type UserQualityProfile = {
  userId: string;
  
  // Historical accuracy
  accuracyRate: number;         // % of posts with true claims
  
  // Historical engagement
  avgEngagementRate: number;    // Average engagement on past posts
  
  // Historical citations
  citationRate: number;         // How often cited by others
  
  // Consistency
  consistency: number;          // How consistent over time
  
  // Trust score
  trustScore: number;           // 0-1, overall trustworthiness
};
```

**Why this matters:**
- A post from a high-trust user is more likely to be valuable
- A post from a low-trust user is more likely to be gaming
- User quality is harder to fake (requires long history)

**Model 3: Ensemble Model**

```typescript
type ValuePrediction = {
  postId: string;
  
  // Component predictions
  contentQuality: ContentQualityPrediction;
  userQuality: UserQualityProfile;
  
  // Ensemble prediction
  predictedEngagementRate: number;  // 0-1
  predictedShareRate: number;       // 0-1
  predictedCitationRate: number;    // 0-1
  
  // Final score
  predictedValue: number;           // 0-1
  confidence: number;               // 0-1
};
```

**How to train:**
1. Collect historical data (posts + behavioral signals)
2. Train model to predict behavioral signals from content + user features
3. Validate on held-out test set
4. Retrain monthly with new data

**Key insight:** The model learns what actually predicts user engagement, not what an LLM thinks is valuable.

### 3.3 Layer 3: Validation and Feedback

**Problem:** Models can drift. Gaming attempts can fool models.

**Solution:** Continuously validate predictions against actual behavioral signals.

```typescript
type ModelValidation = {
  postId: string;
  
  // Prediction (made at post time)
  predictedValue: number;
  predictedEngagementRate: number;
  
  // Actual (measured after 7 days)
  actualEngagementRate: number;
  actualShareRate: number;
  actualCitationRate: number;
  
  // Validation metrics
  predictionError: number;      // |predicted - actual|
  isAccurate: boolean;          // error < threshold
  
  // Feedback
  feedback: 'accurate' | 'overestimated' | 'underestimated';
};
```

**Feedback loop:**
1. Make prediction at post time
2. Wait 7 days for behavioral signals to accumulate
3. Compare prediction to actual signals
4. If prediction is wrong, investigate why
5. Retrain model with corrected data

**Detecting gaming:**
- If prediction is high but actual engagement is low → likely gaming
- If user has pattern of high predictions but low actual engagement → likely gaming
- If multiple users post similar content at same time → likely coordinated

---

## Part 4: Solving Each Gaming Vector (Updated)

### 4.1 No Claims Attack

**Current vulnerability:**
```
Post: "My child got vaccinated and then developed autism"
Claims extracted: None (anecdotal)
Result: factCheckStatus = 'clean', no value score
```

**Solution:**

1. **Extract implicit claims**
   ```typescript
   // Instead of just explicit claims, extract:
   // - Implicit causal claims ("X happened after Y" → "Y caused X")
   // - Anecdotal claims ("I experienced X" → "X is possible")
   // - Correlational claims ("X and Y happened together" → "X correlates with Y")
   
   type ClaimType = 'explicit' | 'implicit' | 'anecdotal' | 'correlational';
   ```

2. **Weight claims by type**
   ```typescript
   // Explicit claims: weight = 1.0
   // Implicit claims: weight = 0.7
   // Anecdotal claims: weight = 0.3
   // Correlational claims: weight = 0.2
   
   // Fact-check penalty is weighted by claim type
   ```

3. **Use behavioral signals**
   - If post gets low engagement despite high predicted value → likely gaming
   - If post gets high engagement despite low predicted value → model is wrong, retrain

**Result:** Implicit claims are extracted and fact-checked. Anecdotal claims are weighted lower. Gaming is detected via behavioral signals.

---

### 4.2 Hedging Attack

**Current vulnerability:**
```
Post: "Some people believe vaccines might cause autism"
Fact-check: Verdict = 'true' (people do believe this)
Result: No penalty
```

**Solution:**

1. **Detect hedging language**
   ```typescript
   type ClaimHedging = {
     claimId: string;
     hedgingLevel: 'none' | 'mild' | 'moderate' | 'heavy';
     hedgingPatterns: string[];  // ["some people", "might", "could"]
   };
   
   // Hedging patterns:
   // - "some people believe"
   // - "might be"
   // - "could be"
   // - "possibly"
   // - "allegedly"
   // - "reportedly"
   ```

2. **Separate meta-claims from object-claims**
   ```typescript
   // Object-claim: "Vaccines cause autism"
   // Meta-claim: "Some people believe vaccines cause autism"
   
   // Fact-check object-claim, not meta-claim
   // If object-claim is false, penalize even if meta-claim is true
   ```

3. **Penalize hedging**
   ```typescript
   // If claim is heavily hedged:
   // - Reduce epistemic score by 0.2
   // - Reduce insight score by 0.1
   // - Reason: hedging is often used to avoid accountability
   ```

**Result:** Hedged claims are detected and penalized. Meta-claims are separated from object-claims.

---

### 4.3 Pre-check Bypass

**Current vulnerability:**
```
Post: "I think vaccines might cause autism"
Pre-check: contentType = 'opinion', needsFactCheck = false
Result: Bypasses fact-checking
```

**Solution:**

1. **Improve pre-check robustness**
   ```typescript
   // Current: Simple classification (factual vs opinion)
   // Proposed: Multi-dimensional classification
   
   type PreCheckResult = {
     contentType: 'factual' | 'opinion' | 'experience' | 'question' | 'humor' | 'other';
     confidence: number;
     
     // New fields
     underlyingClaim?: string;  // Extract underlying claim
     claimConfidence?: number;  // How confident is the underlying claim
     hedgingLevel?: 'none' | 'mild' | 'moderate' | 'heavy';
     
     // Decision
     needsFactCheck: boolean;
     reasoning: string;
   };
   ```

2. **Always fact-check if underlying claim is present**
   ```typescript
   // Even if framed as opinion, if there's an underlying factual claim, fact-check it
   
   if (preCheck.underlyingClaim && preCheck.claimConfidence > 0.5) {
     needsFactCheck = true;
   }
   ```

3. **Use behavioral signals**
   - If opinion post gets high engagement → might be gaming
   - If opinion post gets low engagement → likely genuine opinion

**Result:** Pre-check is more robust. Underlying claims are extracted even from opinion posts.

---

### 4.4 Relational Manipulation

**Current vulnerability:**
```
Post: "I respect vaccines, but I have concerns about safety"
Relational score: High (respectful tone)
Result: Misinformation gets high score
```

**Solution:**

1. **Separate tone from accuracy**
   ```typescript
   // Current: Relational score includes tone
   // Proposed: Separate tone from accuracy
   
   type ValueVector = {
     epistemic: number;      // Accuracy
     insight: number;        // Novelty
     practical: number;      // Actionability
     relational: number;     // Tone (separate from accuracy)
     effort: number;         // Depth
     
     // New field
     toneQuality: number;    // How respectful/civil
   };
   
   // Tone doesn't affect epistemic score
   // Accuracy affects epistemic score
   ```

2. **Penalize respectful misinformation**
   ```typescript
   // If post is respectful but contains false claims:
   // - High relational score (for tone)
   // - Low epistemic score (for accuracy)
   // - Total score reflects both
   
   // Users can see the breakdown and understand the trade-off
   ```

3. **Use behavioral signals**
   - If respectful post gets low engagement → might be low-value
   - If respectful post gets high engagement → might be genuinely valuable

**Result:** Tone and accuracy are separated. Respectful misinformation is still penalized for inaccuracy.

---

### 4.5 Reputation Farming

**Current vulnerability:**
```
Week 1-4: Post high-quality content
Result: Kurral Score = 85

Week 5: Start posting misinformation
Result: Kurral Score slowly decreases, but still 75+
Users trust the account and misinformation spreads
```

**Solution:**

1. **Implement temporal decay**
   ```typescript
   // Current: Reputation persists forever
   // Proposed: Reputation decays over time
   
   type KurralScore = {
     score: number;
     lastUpdated: Date;
     
     // New field
     decayRate: number;  // How fast reputation decays
     
     // Calculation
     adjustedScore = score * Math.exp(-decayRate * daysSinceLastUpdate);
   };
   ```

2. **Implement recency weighting**
   ```typescript
   // Weight recent posts more heavily than old posts
   
   const recencyWeight = Math.exp(-daysSincePosted / 30);  // 30-day half-life
   const qualityScore = 
     (recentPostsQuality * recencyWeight) + 
     (olderPostsQuality * (1 - recencyWeight));
   ```

3. **Implement sudden change detection**
   ```typescript
   // If user's posting quality suddenly drops, flag it
   
   if (qualityDropPercentage > 30) {
     // Investigate
     // Possible explanations:
     // - Account hacked
     // - User changed behavior
     // - Gaming attempt
   }
   ```

**Result:** Reputation decays over time. Recent posts matter more. Sudden changes are detected.

---

### 4.6 Coordinated Inauthentic Behavior

**Current vulnerability:**
```
10 accounts post identical misinformation
Each post gets scored independently
Misinformation appears on "Most Valued" feed
```

**Solution:**

1. **Detect similar posts**
   ```typescript
   // Use embeddings to detect similar posts
   
   type SimilarityAnalysis = {
     postId: string;
     similarPosts: Array<{
       postId: string;
       similarity: number;  // 0-1
       authorId: string;
       postedAt: Date;
     }>;
     
     // Flags
     isSuspiciouslySimilar: boolean;  // similarity > 0.9
     isCoordinated: boolean;          // multiple similar posts in short time
   };
   ```

2. **Penalize coordinated posts**
   ```typescript
   // If multiple similar posts detected:
   // - Reduce value score by 0.2 for each duplicate
   // - Flag for manual review
   // - Investigate user accounts
   
   if (analysis.isCoordinated) {
     valueScore *= 0.8;  // 20% penalty
   }
   ```

3. **Analyze user networks**
   ```typescript
   // Check if similar posts come from related accounts
   
   type UserNetwork = {
     userId: string;
     followingIds: string[];
     followedByIds: string[];
     
     // Suspicious patterns
     hasClusterOfNewAccounts: boolean;
     hasClusterOfSimilarBehavior: boolean;
   };
   ```

**Result:** Coordinated posts are detected and penalized. User networks are analyzed.

---

### 4.7 Citation Gaming (NEW - Leveraging Existing Infrastructure)

**How citations work:**
- Users review posts marked "needs_review"
- They submit PostReviewContext with sources and evidence
- These submissions ARE citations
- Citation count increases for the post
- Citations are weighted by strength (weak/medium/strong)

**Gaming attempt:**
```
Attacker creates Post A: "My product is amazing"
Attacker creates 10 fake accounts
Attacker has fake accounts submit PostReviewContext citing Post A
Result: All 10 citations are obviously fake (same sources, same language, same time)
```

**Defense:**
```typescript
// Detect coordinated citations
function detectCoordinatedCitations(post: Chirp): boolean {
  const citations = post.citations;
  
  // Check for patterns
  const sourceOverlap = calculateSourceOverlap(citations);
  const timingCluster = calculateTimingCluster(citations);
  const authorCluster = calculateAuthorCluster(citations);
  
  if (sourceOverlap > 0.8 || timingCluster > 0.8 || authorCluster > 0.8) {
    return true;  // Likely coordinated
  }
  
  return false;
}

// Penalize coordinated citations
if (detectCoordinatedCitations(post)) {
  post.citationCount *= 0.5;  // 50% penalty
  post.citationStrength *= 0.3;  // 70% penalty
}
```

**Result:** Coordinated citations are detected and penalized. Real citations from diverse users are rewarded.

---

## Part 5: Complete Redesigned Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ User posts content                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Content Analysis                                  │
│ - Extract explicit + implicit + anecdotal claims           │
│ - Detect hedging language                                  │
│ - Analyze tone and structure                               │
│ - Detect similar posts (coordinated behavior)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Fact-Checking                                     │
│ - Fact-check all claims (explicit + implicit)              │
│ - Evaluate source bias                                     │
│ - Assign confidence scores                                 │
│ - Detect unverifiable claims                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: User Quality Analysis                             │
│ - Analyze user history                                     │
│ - Calculate user trust score                               │
│ - Detect sudden behavior changes                           │
│ - Analyze user network                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: Predictive Modeling                               │
│ - Combine content + fact-checks + user quality             │
│ - Train ensemble model                                     │
│ - Predict engagement metrics                               │
│ - Assign confidence scores                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: Ranking & Recommendation                          │
│ - Rank posts by predicted value                            │
│ - Personalize for user interests                           │
│ - Diversify recommendations                                │
│ - Show confidence scores to users                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ User engages with content                                  │
│ - Views, shares, cites, follows, discusses                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 6: Validation & Feedback                             │
│ - Collect behavioral signals                               │
│ - Compare predictions to actual engagement                 │
│ - Detect gaming attempts                                   │
│ - Retrain models with new data                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 6: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Build the basic infrastructure for behavioral signals and validation. Leverage existing PostReviewContext for citations.

1. **Add behavioral signal tracking**
   ```typescript
   // Track all user interactions
   - Views (with time spent)
   - Shares/rechirps
   - Citations (from PostReviewContext submissions)
   - Follows
   - Discussion engagement
   - Bookmarks
   
   // NEW: Track citations from PostReviewContext
   - When PostReviewContext is created, increment post's citationCount
   - Store citation metadata (sources, verdict, strength)
   - Calculate citation strength based on evidence quality
   ```

2. **Build validation framework**
   ```typescript
   // Compare predictions to actual signals
   - Store predictions at post time
   - Measure actual engagement after 7 days
   - Calculate prediction error
   - Identify gaming attempts
   - Track citation accumulation over time
   ```

3. **Improve claim extraction**
   ```typescript
   // Extract implicit + anecdotal claims
   - Detect causal language ("caused", "led to", "resulted in")
   - Detect anecdotal language ("I experienced", "my friend had")
   - Detect correlational language ("happened after", "coincided with")
   - Integrate with existing fact-checking pipeline
   ```

### Phase 2: Modeling (Weeks 5-8)

**Goal:** Build predictive models that learn from behavioral signals.

1. **Build content quality model**
   ```typescript
   // Predict engagement from content features
   - Factual accuracy
   - Clarity and structure
   - Depth
   - Novelty
   - Tone
   ```

2. **Build user quality model**
   ```typescript
   // Predict engagement from user history
   - Historical accuracy
   - Historical engagement
   - Citation rate
   - Consistency
   - Trust score
   ```

3. **Build ensemble model**
   ```typescript
   // Combine content + user + fact-checks
   - Train on historical data
   - Validate on held-out test set
   - Measure prediction accuracy
   ```

### Phase 3: Hardening (Weeks 9-12)

**Goal:** Add gaming detection and adversarial robustness.

1. **Detect coordinated behavior**
   ```typescript
   // Find similar posts from multiple accounts
   - Use embeddings to detect similarity
   - Analyze posting patterns
   - Investigate user networks
   ```

2. **Detect sudden changes**
   ```typescript
   // Find users with sudden quality drops
   - Compare recent posts to historical average
   - Flag suspicious changes
   - Investigate accounts
   ```

3. **Detect hedging and evasion**
   ```typescript
   // Find posts using evasion tactics
   - Detect hedging language
   - Detect implicit claims
   - Detect anecdotal framing
   ```

### Phase 4: Optimization (Weeks 13+)

**Goal:** Continuously improve models and detection.

1. **Retrain models monthly**
   ```typescript
   // Use new behavioral data to retrain
   - Collect 30 days of behavioral signals
   - Retrain ensemble model
   - Measure improvement
   ```

2. **Add adversarial training**
   ```typescript
   // Train models on known gaming attempts
   - Collect gaming examples
   - Train models to detect them
   - Improve robustness
   ```

3. **Add human review**
   ```typescript
   // For high-stakes domains, add human review
   - Health posts reviewed by experts
   - Political posts reviewed by fact-checkers
   - Improve accuracy
   ```

---

## Part 7: Key Metrics

### 7.1 System Health Metrics

```typescript
type SystemHealthMetrics = {
  // Prediction accuracy
  predictionAccuracy: number;        // % of predictions within 20% of actual
  predictionBias: number;            // Are we over/under-estimating?
  
  // Gaming detection
  gamingDetectionRate: number;       // % of gaming attempts detected
  falsePosRate: number;              // % of false positives
  
  // Model performance
  modelAccuracy: number;             // Overall model accuracy
  modelDrift: number;                // How much model has drifted
  
  // User satisfaction
  userSatisfaction: number;          // Do users like the rankings?
  userTrust: number;                 // Do users trust the system?
};
```

### 7.2 Citation Metrics

```typescript
type CitationMetrics = {
  // Citation accumulation
  avgCitationsPerPost: number;       // Average citations per post
  citationGrowthRate: number;        // Citations per day
  
  // Citation quality
  avgCitationStrength: number;       // Average strength (0-1)
  strongCitationRate: number;        // % of citations that are strong
  
  // Citation diversity
  uniqueCitingUsers: number;         // How many different users cite
  citationSourceDiversity: number;   // How diverse are the sources
  
  // Citation gaming
  coordinatedCitationRate: number;   // % of citations that are coordinated
  citationGamingDetectionRate: number; // % of gaming attempts detected
};
```

### 7.3 Gaming Resistance Metrics

```typescript
type GamingResistanceMetrics = {
  // Effort to game
  effortToGame: 'low' | 'medium' | 'high';
  
  // Detection speed
  detectionSpeedDays: number;        // How fast do we detect gaming?
  
  // Impact of gaming
  maxImpactOnRanking: number;        // Max % improvement from gaming
  
  // Coordination difficulty
  coordinationDifficulty: 'low' | 'medium' | 'high';
};
```

---

## Part 8: Why This Works

### 8.1 Addresses Root Causes

| Root Cause | Solution |
|-----------|----------|
| LLM-based scoring is non-deterministic | Use behavioral signals as ground truth |
| No ground truth | Measure actual user engagement |
| Optimize for wrong thing | Optimize for predicting user engagement |
| No feedback loop | Validate predictions against actual signals |
| No adversarial testing | Continuously detect gaming attempts |

### 8.2 Gaming Resistance

| Gaming Vector | Defense |
|---------------|---------|
| No claims | Extract implicit claims |
| Hedging | Detect and penalize hedging |
| Pre-check bypass | Improve pre-check robustness |
| Relational manipulation | Separate tone from accuracy |
| Reputation farming | Implement temporal decay |
| Coordinated behavior | Detect similar posts |
| Citation gaming | Detect coordinated citations |
| Effort inflation | Use behavioral signals |
| Insight inflation | Use behavioral signals |
| Penalty evasion | Use behavioral signals |

### 8.3 Leveraging Existing Infrastructure

**Key advantage:** We don't need to build new infrastructure for citations. We already have it.

```
Current infrastructure:
- Posts marked "needs_review" are sent to users with similar interests
- Users submit PostReviewContext with sources and evidence
- These submissions ARE citations

New approach:
- Track PostReviewContext submissions as behavioral signals
- Weight citations by strength (based on evidence quality)
- Detect coordinated citations (multiple fake accounts)
- Use citations in value scoring

Result:
- No new infrastructure needed
- Leverages existing community review system
- Evidence-based (sources are provided)
- Hard to game (requires real review effort)
- Transparent (users can see citations)
```

### 8.4 Scalability

- **Behavioral signals:** Automatically collected, no manual effort
- **Predictive models:** Trained once, run in real-time
- **Validation:** Automated comparison of predictions to actual signals
- **Gaming detection:** Automated pattern matching
- **Citation tracking:** Automatic from PostReviewContext submissions

---

## Part 9: Comparison to Current System

### Current System

```
Post → LLM Scoring → Value Score → Ranking
                ↓
            (No feedback)
```

**Problems:**
- LLM scoring is non-deterministic
- No ground truth
- No feedback loop
- Easy to game
- Citations not tracked or measured

### New System

```
Post → Content Analysis → Fact-Checking → User Quality → Predictive Model → Ranking
                                                              ↓
                                                    (Behavioral Signals)
                                                    - Views
                                                    - Shares
                                                    - Citations (from PostReviewContext)
                                                    - Follows
                                                    - Discussion
                                                    - Bookmarks
                                                              ↓
                                                    Validation & Feedback
                                                              ↓
                                                    Model Retraining
```

**Advantages:**
- Behavioral signals are ground truth
- Continuous feedback loop
- Gaming is detected and penalized
- Models improve over time
- Citations are tracked and weighted
- Leverages existing PostReviewContext infrastructure
- Community-driven evidence collection

---

## Part 10: Implementation Considerations

### 10.1 Data Requirements

**Behavioral signals:**
- Views (with time spent)
- Shares/rechirps
- Citations (from PostReviewContext submissions)
- Follows
- Discussion engagement
- Bookmarks

**Citation data:**
- PostReviewContext submissions (sources, verdict, context)
- Citation strength (weak/medium/strong based on evidence)
- Citation diversity (unique users, source diversity)
- Citation timing (for coordinated detection)

**User data:**
- Historical posts
- Historical engagement
- Citation history
- Consistency metrics

**Content data:**
- Claims (explicit + implicit)
- Fact-checks
- Tone analysis
- Structure analysis

### 10.2 Computational Requirements

**Real-time:**
- Content analysis: ~100ms per post
- Fact-checking: ~2-5s per post (can be async)
- Predictive model: ~10ms per post
- Total: ~2-5s per post (acceptable for async)

**Batch:**
- Model retraining: Monthly, ~1 hour
- Validation: Daily, ~30 minutes
- Gaming detection: Daily, ~30 minutes

### 10.3 Privacy Considerations

**Behavioral signals:**
- Don't store user identity with signals
- Aggregate signals at post level
- Use differential privacy for sensitive metrics

**User quality:**
- Don't expose individual user scores
- Only show aggregate metrics
- Allow users to opt-out of tracking

---

## Part 11: Success Criteria

### 11.1 System Effectiveness

- [ ] Prediction accuracy > 80% (within 20% of actual engagement)
- [ ] Gaming detection rate > 90%
- [ ] False positive rate < 5%
- [ ] Model drift < 10% per month

### 11.2 Gaming Resistance

- [ ] Effort to game > 1 week
- [ ] Detection speed < 7 days
- [ ] Max impact of gaming < 10% improvement in ranking
- [ ] Coordination difficulty = high

### 11.3 User Satisfaction

- [ ] User satisfaction > 4/5
- [ ] User trust > 4/5
- [ ] Engagement rate > 30%
- [ ] Misinformation spread < 5%

---

## Conclusion

The key insight is: **Don't try to measure value directly. Measure what users actually find valuable, then use that as ground truth.**

This approach:
1. **Eliminates gaming** - Behavioral signals are hard to fake
2. **Improves accuracy** - Models learn from real user behavior
3. **Enables feedback** - Continuous validation and retraining
4. **Scales efficiently** - Automated collection and analysis
5. **Builds trust** - Users see how the system works

The system is no longer a black box. It's a transparent, learnable, and continuously improving system that gets better over time.
