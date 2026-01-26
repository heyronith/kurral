# Derived Signals MVP: Gaming-Resistant Value Prediction

## Core Concept

Instead of using raw behavioral signals (views, shares, citations) which can be gamed, we derive **composite signals** that capture relationships and patterns. These derived signals are then used to predict optimal value weights.

```
Raw Signals → Derived Signals → Weight Prediction → Value Score
     ↑                                                    │
     └────────────── Feedback Loop ───────────────────────┘
```

---

## The 4 Core Derived Signals

We focus on 4 high-value derived signals that are:
- Hard to game (require coordinated, sustained, realistic behavior)
- Predictive of genuine value
- Computationally feasible
- Built on data you already collect (or can easily collect)

### Signal 1: Engagement Authenticity Score (EAS)

**What it measures:** Whether engagement patterns look organic or manufactured.

**Raw inputs:**
- View count
- View timestamps
- Time spent per view
- Viewer account ages
- Viewer activity patterns

**Derivation:**

```typescript
type EngagementAuthenticityScore = {
  postId: string;
  
  // Component scores (0-1 each)
  temporalDistribution: number;    // Views spread naturally over time vs clustered
  viewerDiversity: number;         // Entropy of viewer accounts
  readingPatternScore: number;     // Time-spent follows natural reading curve
  accountAgeScore: number;         // Viewers have established accounts
  
  // Final score
  eas: number;                     // Weighted combination
};

function computeEAS(views: ViewEvent[]): number {
  // Temporal distribution: penalize unnatural spikes
  const hourBuckets = groupByHour(views);
  const temporalEntropy = calculateEntropy(hourBuckets);
  const temporalScore = normalize(temporalEntropy, expectedRange);
  
  // Viewer diversity: penalize same accounts viewing repeatedly
  const uniqueViewers = new Set(views.map(v => v.userId)).size;
  const diversityScore = uniqueViewers / views.length;
  
  // Reading pattern: real readers have variable time-spent
  const timeSpentVariance = calculateVariance(views.map(v => v.timeSpentMs));
  const readingScore = timeSpentVariance > MIN_NATURAL_VARIANCE ? 1 : timeSpentVariance / MIN_NATURAL_VARIANCE;
  
  // Account age: penalize new accounts (likely bots)
  const avgAccountAge = average(views.map(v => v.viewerAccountAgeDays));
  const accountScore = Math.min(1, avgAccountAge / 90); // 90 days = full score
  
  // Weighted combination
  return (
    temporalScore * 0.3 +
    diversityScore * 0.3 +
    readingScore * 0.2 +
    accountScore * 0.2
  );
}
```

**Why it's hard to game:**
- Bots create unnatural temporal patterns (spikes)
- Fake accounts are usually new
- Simulating realistic reading time variance is hard
- Need many diverse, old accounts to score well

---

### Signal 2: Citation Network Quality (CNQ)

**What it measures:** Whether citations come from a genuine, diverse community or a coordinated group.

**Raw inputs:**
- Citation count (from PostReviewContext)
- Citing user IDs
- Citation timestamps
- Sources provided in citations
- Citing users' interest graphs

**Derivation:**

```typescript
type CitationNetworkQuality = {
  postId: string;
  
  // Component scores (0-1 each)
  userDiversityScore: number;      // How diverse are the citing users
  sourceIndependence: number;      // Do citations use different sources
  temporalSpread: number;          // Citations spread over time
  crossBubbleScore: number;        // Citations from outside author's network
  citerReputationScore: number;    // Average reputation of citing users
  
  // Final score
  cnq: number;
};

function computeCNQ(citations: Citation[], authorNetwork: string[]): number {
  if (citations.length === 0) return 0;
  
  // User diversity: entropy of citing users
  const userIds = citations.map(c => c.userId);
  const userEntropy = calculateEntropy(countOccurrences(userIds));
  const maxEntropy = Math.log2(citations.length);
  const userDiversityScore = userEntropy / maxEntropy;
  
  // Source independence: how many unique source domains
  const allSources = citations.flatMap(c => c.sources);
  const uniqueDomains = new Set(allSources.map(extractDomain)).size;
  const sourceIndependence = Math.min(1, uniqueDomains / (citations.length * 0.5));
  
  // Temporal spread: citations over days, not hours
  const timestamps = citations.map(c => c.createdAt.getTime());
  const timeRange = Math.max(...timestamps) - Math.min(...timestamps);
  const daySpread = timeRange / (24 * 60 * 60 * 1000);
  const temporalSpread = Math.min(1, daySpread / 7); // 7 days = full score
  
  // Cross-bubble: citations from users NOT in author's network
  const crossBubbleCitations = citations.filter(c => !authorNetwork.includes(c.userId));
  const crossBubbleScore = crossBubbleCitations.length / citations.length;
  
  // Citer reputation: average Kurral score of citing users
  const avgCiterReputation = average(citations.map(c => c.citerKurralScore || 0.5));
  const citerReputationScore = avgCiterReputation;
  
  // Weighted combination
  return (
    userDiversityScore * 0.25 +
    sourceIndependence * 0.2 +
    temporalSpread * 0.15 +
    crossBubbleScore * 0.25 +
    citerReputationScore * 0.15
  );
}
```

**Why it's hard to game:**
- Coordinated citations cluster in time → low temporal spread
- Fake accounts have low reputation → low citer reputation
- Coordinated groups share sources → low source independence
- Attackers cite from their own network → low cross-bubble score

---

### Signal 3: Discussion Depth Index (DDI)

**What it measures:** Whether the post generates substantive discussion or shallow engagement.

**Raw inputs:**
- Comments on the post
- Comment lengths
- Comment reply chains
- Unique commenters
- Comment sentiment diversity

**Derivation:**

```typescript
type DiscussionDepthIndex = {
  postId: string;
  
  // Component scores (0-1 each)
  threadDepthScore: number;        // How deep do reply chains go
  substantivenessScore: number;    // Are comments substantive (not just "great post!")
  perspectiveDiversity: number;    // Do comments represent different viewpoints
  commenterQuality: number;        // Reputation of commenters
  
  // Final score
  ddi: number;
};

function computeDDI(comments: Comment[]): number {
  if (comments.length === 0) return 0;
  
  // Thread depth: average depth of reply chains
  const maxDepth = Math.max(...comments.map(c => c.depth || 0));
  const avgDepth = average(comments.map(c => c.depth || 0));
  const threadDepthScore = Math.min(1, avgDepth / 3); // 3 levels = full score
  
  // Substantiveness: filter out low-effort comments
  const substantiveComments = comments.filter(c => 
    c.text.length > 50 && 
    !isLowEffort(c.text) // "great post", "thanks", emoji-only, etc.
  );
  const substantivenessScore = substantiveComments.length / comments.length;
  
  // Perspective diversity: sentiment variance (not everyone agrees)
  const sentiments = comments.map(c => c.sentiment || 0); // -1 to 1
  const sentimentVariance = calculateVariance(sentiments);
  const perspectiveDiversity = Math.min(1, sentimentVariance / 0.5);
  
  // Commenter quality: average reputation
  const avgCommenterReputation = average(comments.map(c => c.commenterKurralScore || 0.5));
  const commenterQuality = avgCommenterReputation;
  
  // Weighted combination
  return (
    threadDepthScore * 0.25 +
    substantivenessScore * 0.35 +
    perspectiveDiversity * 0.2 +
    commenterQuality * 0.2
  );
}

function isLowEffort(text: string): boolean {
  const lowEffortPatterns = [
    /^(great|nice|good|awesome|thanks|thx|lol|haha|wow|this|yes|no|agreed|exactly|same|true|facts)[\s!.]*$/i,
    /^[\p{Emoji}\s]+$/u,  // emoji-only
    /^.{1,20}$/,          // very short
  ];
  return lowEffortPatterns.some(p => p.test(text.trim()));
}
```

**Why it's hard to game:**
- Generating substantive comments at scale is expensive (need real humans or sophisticated AI)
- Reply chains require back-and-forth (coordination overhead)
- Perspective diversity means you can't just have your supporters comment
- Low-reputation accounts drag down the score

---

### Signal 4: Sustained Interest Score (SIS)

**What it measures:** Whether interest in the post persists over time or spikes and dies.

**Raw inputs:**
- Engagement events over time (views, shares, comments)
- Bookmark count
- Return visits (same user viewing again)
- References from other posts over time

**Derivation:**

```typescript
type SustainedInterestScore = {
  postId: string;
  
  // Component scores (0-1 each)
  decayCurveHealth: number;        // Engagement decays slowly, not cliff-drop
  returnVisitRate: number;         // Users come back to the post
  bookmarkRate: number;            // Users save for later
  longTailReferences: number;      // Referenced in posts days/weeks later
  
  // Final score
  sis: number;
};

function computeSIS(
  engagementEvents: EngagementEvent[],
  bookmarks: Bookmark[],
  references: Reference[],
  postAge: number // days
): number {
  if (postAge < 3) return 0.5; // Not enough data yet
  
  // Decay curve: compare day 1 engagement to day 7 engagement
  const day1Events = engagementEvents.filter(e => daysSincePost(e) < 1).length;
  const day7Events = engagementEvents.filter(e => daysSincePost(e) >= 6 && daysSincePost(e) < 7).length;
  
  // Healthy decay: day 7 should be at least 10% of day 1
  const decayRatio = day1Events > 0 ? day7Events / day1Events : 0;
  const decayCurveHealth = Math.min(1, decayRatio / 0.1); // 10% retention = full score
  
  // Return visits: unique users who viewed more than once
  const viewsByUser = groupBy(engagementEvents.filter(e => e.type === 'view'), 'userId');
  const returnVisitors = Object.values(viewsByUser).filter(views => views.length > 1).length;
  const totalViewers = Object.keys(viewsByUser).length;
  const returnVisitRate = totalViewers > 0 ? returnVisitors / totalViewers : 0;
  
  // Bookmark rate: bookmarks / views
  const totalViews = engagementEvents.filter(e => e.type === 'view').length;
  const bookmarkRate = totalViews > 0 ? Math.min(1, (bookmarks.length / totalViews) * 10) : 0;
  
  // Long-tail references: references after day 3
  const longTailRefs = references.filter(r => daysSincePost(r) > 3).length;
  const longTailReferences = Math.min(1, longTailRefs / 5); // 5 late refs = full score
  
  // Weighted combination
  return (
    decayCurveHealth * 0.3 +
    returnVisitRate * 0.25 +
    bookmarkRate * 0.2 +
    longTailReferences * 0.25
  );
}
```

**Why it's hard to game:**
- Sustained engagement over 7+ days requires ongoing coordination
- Return visits from same users are hard to fake at scale
- Bookmarks indicate genuine "save for later" intent
- Long-tail references require other posts to organically mention you

---

## Combining Derived Signals into Value Weight Prediction

### The Weight Prediction Model

Instead of static domain-based weights, we predict optimal weights based on derived signals:

```typescript
type DerivedSignals = {
  eas: number;  // Engagement Authenticity Score
  cnq: number;  // Citation Network Quality
  ddi: number;  // Discussion Depth Index
  sis: number;  // Sustained Interest Score
};

type ValueWeights = {
  epistemic: number;
  insight: number;
  practical: number;
  relational: number;
  effort: number;
};

// Simple rule-based approach (MVP)
function predictValueWeights(
  signals: DerivedSignals,
  domain: string
): ValueWeights {
  // Start with domain defaults
  const baseWeights = getDomainWeights(domain);
  
  // Adjust based on derived signals
  const adjustments = {
    // High citation quality → epistemic matters more (factual content being validated)
    epistemic: baseWeights.epistemic + (signals.cnq - 0.5) * 0.1,
    
    // High discussion depth → relational matters more (generating discourse)
    relational: baseWeights.relational + (signals.ddi - 0.5) * 0.1,
    
    // High sustained interest → insight matters more (lasting value)
    insight: baseWeights.insight + (signals.sis - 0.5) * 0.1,
    
    // Low engagement authenticity → penalize all scores
    // (likely gaming, reduce overall value)
    practical: baseWeights.practical,
    effort: baseWeights.effort,
  };
  
  // Apply authenticity as a global multiplier
  const authenticityMultiplier = 0.5 + (signals.eas * 0.5); // 0.5 to 1.0
  
  // Normalize to sum to 1
  const raw = {
    epistemic: Math.max(0, adjustments.epistemic) * authenticityMultiplier,
    insight: Math.max(0, adjustments.insight) * authenticityMultiplier,
    practical: Math.max(0, adjustments.practical) * authenticityMultiplier,
    relational: Math.max(0, adjustments.relational) * authenticityMultiplier,
    effort: Math.max(0, adjustments.effort) * authenticityMultiplier,
  };
  
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  
  return {
    epistemic: raw.epistemic / sum,
    insight: raw.insight / sum,
    practical: raw.practical / sum,
    relational: raw.relational / sum,
    effort: raw.effort / sum,
  };
}
```

### The Feedback Loop

```typescript
// After 7 days, compare predicted weights to "ideal" weights
// Ideal weights = weights that would have predicted actual engagement

async function runFeedbackLoop(postId: string) {
  const post = await getPost(postId);
  const signals = await computeDerivedSignals(postId);
  
  // What weights did we predict?
  const predictedWeights = post.predictedWeights;
  
  // What weights would have been "correct"?
  // (weights that maximize correlation with actual engagement)
  const idealWeights = computeIdealWeights(post, signals);
  
  // Store the delta for model retraining
  await storeFeedbackSample({
    postId,
    domain: post.domain,
    signals,
    predictedWeights,
    idealWeights,
    delta: computeDelta(predictedWeights, idealWeights),
  });
}

// Monthly: retrain the weight prediction model
async function retrainWeightModel() {
  const samples = await getFeedbackSamples(last30Days);
  
  // Learn: given (signals, domain) → what weights work best?
  const newModel = trainModel(samples);
  
  // Deploy new model
  await deployWeightModel(newModel);
}
```

---

## Data Collection Requirements

### New Data to Collect

| Data Point | Where to Collect | Storage |
|------------|------------------|---------|
| View timestamps | Client-side event | `postEngagement` collection |
| Time spent per view | Client-side (visibility API) | `postEngagement` collection |
| Viewer account age | Computed from user.createdAt | Join at query time |
| Comment depth | Already have (reply chains) | `comments` collection |
| Comment sentiment | Compute on write (simple model) | `comments.sentiment` field |
| Return visits | Client-side event | `postEngagement` collection |
| Bookmarks | Already have | `bookmarks` collection |
| Post references | Parse post text for links | `postReferences` collection |

### Schema Updates

```typescript
// New collection: postEngagement
type PostEngagementEvent = {
  postId: string;
  userId: string;
  eventType: 'view' | 'share' | 'bookmark' | 'return_visit';
  timestamp: Date;
  metadata: {
    timeSpentMs?: number;
    scrollDepth?: number;
    viewerAccountAgeDays?: number;
  };
};

// New collection: derivedSignals (computed daily)
type PostDerivedSignals = {
  postId: string;
  computedAt: Date;
  eas: number;
  cnq: number;
  ddi: number;
  sis: number;
  rawInputs: {
    viewCount: number;
    citationCount: number;
    commentCount: number;
    bookmarkCount: number;
  };
};

// Update chirps collection
type Chirp = {
  // ... existing fields
  
  // NEW: Derived signals (updated daily for first 14 days)
  derivedSignals?: PostDerivedSignals;
  
  // NEW: Predicted weights (set at scoring time)
  predictedWeights?: ValueWeights;
  
  // NEW: Final adjusted value score
  adjustedValueScore?: number;
};
```

---

## Implementation Phases

### Phase 1: Data Collection (Week 1-2)

**Goal:** Start collecting the raw data needed for derived signals.

1. Add client-side view tracking with time spent
2. Add return visit detection
3. Add comment sentiment scoring (simple positive/negative/neutral)
4. Add post reference detection (links to other posts)

**Deliverables:**
- `postEngagement` collection populated
- Comment sentiment field populated
- Post references tracked

### Phase 2: Signal Computation (Week 3-4)

**Goal:** Implement derived signal computation.

1. Implement EAS computation
2. Implement CNQ computation
3. Implement DDI computation
4. Implement SIS computation
5. Create daily batch job to compute signals for posts aged 3-14 days

**Deliverables:**
- `derivedSignals` collection populated
- Daily computation job running
- Dashboard to monitor signal distributions

### Phase 3: Weight Prediction (Week 5-6)

**Goal:** Use derived signals to adjust value weights.

1. Implement rule-based weight prediction (MVP)
2. Integrate with existing value scoring pipeline
3. Store predicted weights on posts
4. A/B test: compare adjusted scores to current scores

**Deliverables:**
- Weight prediction integrated
- A/B test running
- Metrics dashboard

### Phase 4: Feedback Loop (Week 7-8)

**Goal:** Close the loop and enable learning.

1. Implement ideal weight computation
2. Store feedback samples
3. Build retraining pipeline (can be manual initially)
4. Monitor prediction accuracy over time

**Deliverables:**
- Feedback samples collected
- First model retrain completed
- Accuracy metrics tracked

---

## Gaming Resistance Analysis

### How Each Signal Resists Gaming

| Signal | Gaming Attempt | Why It Fails |
|--------|----------------|--------------|
| EAS | Buy bot views | Bots cluster in time, have new accounts, uniform reading patterns |
| EAS | Use engagement pods | Pod members have correlated behavior, limited diversity |
| CNQ | Coordinate fake citations | Citations cluster in time, same sources, within attacker's network |
| CNQ | Buy citations from services | Service accounts have low reputation, similar patterns |
| DDI | Post fake comments | Low-effort comments filtered, no reply chains, no perspective diversity |
| DDI | Use AI to generate comments | AI comments lack genuine disagreement, similar style |
| SIS | Spike engagement on day 1 | Decay curve catches the cliff-drop |
| SIS | Sustain fake engagement for 7 days | Expensive, requires ongoing coordination |

### Cost to Game (Rough Estimates)

| Attack | Current System | Derived Signals System |
|--------|----------------|------------------------|
| Inflate views | $10 (buy bot views) | $500+ (need diverse, old accounts with realistic patterns) |
| Fake citations | $50 (coordinate 10 accounts) | $1000+ (need high-rep accounts, diverse sources, spread over days) |
| Fake discussion | $100 (pay for comments) | $2000+ (need substantive comments, reply chains, perspective diversity) |
| Sustained campaign | N/A | $5000+ (7+ days of coordinated, realistic engagement) |

The goal isn't to make gaming impossible—it's to make it **economically unviable**.

---

## Success Metrics

### System Health

- [ ] Derived signals computed for 95%+ of posts aged 3+ days
- [ ] Signal computation latency < 5 minutes per batch
- [ ] Weight prediction latency < 100ms per post

### Gaming Resistance

- [ ] EAS correctly identifies 80%+ of bot-driven engagement (manual audit)
- [ ] CNQ correctly identifies 80%+ of coordinated citations (manual audit)
- [ ] Cost to game increased 10x+ vs current system

### Value Prediction

- [ ] Predicted weights correlate 0.6+ with ideal weights after 30 days
- [ ] Adjusted value scores correlate 0.7+ with long-term engagement
- [ ] User satisfaction with "Most Valued" feed increases (survey)

---

## Open Questions

1. **Cold start:** New posts have no derived signals. Do we use LLM-only scoring for first 3 days, then blend in derived signals?

2. **Signal weights:** The component weights within each derived signal (e.g., 0.3 for temporal distribution in EAS) are guesses. Should we learn these too?

3. **Adversarial adaptation:** Sophisticated actors will eventually learn the derived signals. How do we evolve the signals over time?

4. **Privacy:** Time-spent tracking and return visits are sensitive. Do we need user consent? Anonymization?

5. **Computational cost:** Computing derived signals for all posts daily could be expensive. Should we only compute for posts above a view threshold?

---

## Conclusion

This MVP focuses on 4 derived signals that are:
- **High signal-to-noise:** Each captures a meaningful aspect of genuine value
- **Hard to game:** Require coordinated, sustained, realistic behavior
- **Feasible to implement:** Built on data you can collect with moderate effort
- **Interpretable:** You can explain why a post scored low

The key insight: **relationships between signals are harder to fake than raw signals**. A post with high views but low engagement authenticity is suspicious. A post with many citations but low citation network quality is suspicious. By looking at patterns rather than counts, we make gaming economically unviable.

Start with Phase 1 (data collection) immediately—you need the data before you can compute anything. The rest can be built incrementally.
