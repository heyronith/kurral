# Value System Analysis: Deep Dive into Definition, Calculation, and Trade-offs

**Author's Note:** This analysis is based on direct code inspection of the actual implementation. No assumptions. Every claim is traceable to the codebase.

---

## Executive Summary

The platform uses a **5-dimensional value scoring system** combined with a **user reputation system (Kurral Score)**. Value is calculated through an LLM-based agent that scores content on epistemic rigor, insight, practical utility, relational quality, and effort. The system applies domain-aware weighting and fact-check penalties. User reputation is a separate 0-100 score that aggregates quality, violations, engagement, consistency, and trust.

**Key insight:** Value and reputation are decoupled. A post can have high value but the author's reputation can be low (and vice versa).

---

## Part 1: How Value is Defined

### 1.1 The Five Dimensions

Value is defined across **5 orthogonal dimensions**, each scored 0-1:

```typescript
type ValueVector = {
  epistemic: number;    // Factual rigor and correctness
  insight: number;      // Novelty, synthesis, non-obvious perspective
  practical: number;    // Actionable guidance or clear takeaways
  relational: number;   // Healthy discourse, empathy, constructive tone
  effort: number;       // Depth of work, sourcing, structure
};
```

**What each dimension means:**

| Dimension | Definition | Examples of High Value | Examples of Low Value |
|-----------|-----------|------------------------|----------------------|
| **Epistemic** | Factual rigor and correctness | Claims backed by evidence, verified facts, proper citations | Unsubstantiated claims, misinformation, logical fallacies |
| **Insight** | Novelty, synthesis, non-obvious perspective | Novel connections, synthesis of disparate ideas, unique angle | Obvious observations, rehashed takes, surface-level analysis |
| **Practical** | Actionable guidance or clear takeaways | Step-by-step instructions, concrete tips, implementable advice | Vague statements, theoretical without application, no clear action |
| **Relational** | Healthy discourse, empathy, constructive tone | Acknowledges counterarguments, respectful, builds on others' ideas | Dismissive, hostile, strawmans, ad hominem attacks |
| **Effort** | Depth of work, sourcing, structure | Well-researched, multiple sources, clear organization, detailed | Low effort, minimal sourcing, disorganized, superficial |

### 1.2 The Total Score

The total value score is a **weighted average** of the five dimensions:

```
total = epistemic × w_epistemic + insight × w_insight + practical × w_practical + relational × w_relational + effort × w_effort
```

Where weights sum to 1.0 and vary by **domain** (see section 1.3).

### 1.3 Domain-Aware Weighting

The system recognizes that different domains prioritize different dimensions. Weights are determined by analyzing the dominant domain of the post's claims:

**Health & Politics Domain:**
```
epistemic: 0.35  (highest priority - factual accuracy critical)
insight: 0.25
practical: 0.2
relational: 0.1
effort: 0.1
```
*Rationale:* In health and politics, misinformation causes real harm. Epistemic rigor is paramount.

**Technology, Startups, AI Domain:**
```
epistemic: 0.25
insight: 0.35   (highest priority - novel ideas drive value)
practical: 0.2
relational: 0.1
effort: 0.1
```
*Rationale:* In tech, novel insights and synthesis matter more than perfect accuracy. Exploration is valued.

**Productivity & Design Domain:**
```
epistemic: 0.2
insight: 0.25
practical: 0.35  (highest priority - actionability matters most)
relational: 0.1
effort: 0.1
```
*Rationale:* In productivity/design, the question is "does this help me?" Practical utility is key.

**Default (General) Domain:**
```
epistemic: 0.3
insight: 0.25
practical: 0.2
relational: 0.15
effort: 0.1
```

**How domain is determined:**
1. Extract all claims from the post
2. For each claim, get its domain (health, politics, tech, etc.)
3. Weight domains by claim risk level (high-risk claims weighted 2x, medium 1.5x)
4. Pick the domain with highest weighted count
5. Verify consistency with post's topic and semantic topics
6. Fall back to post's topic if no clear domain emerges

---

## Part 2: How Value is Calculated

### 2.1 The Calculation Pipeline

Value calculation happens in **4 sequential steps**:

```
1. Pre-check (Agentic)
   ↓
2. Extract Claims
   ↓
3. Verify Claims (Fact-check with Web Search)
   ↓
4. Score Value (LLM-based)
```

Each step is **atomic** - either succeeds completely or fails loudly. No silent errors.

### 2.2 Step 1: Pre-check (Agentic)

**Purpose:** Decide if fact-checking is needed.

**Input:** Post text + optional image

**Output:**
```typescript
type PreCheckResult = {
  needsFactCheck: boolean;
  confidence: number;        // 0-1
  reasoning: string;
  contentType: 'factual' | 'news' | 'opinion' | 'experience' | 'question' | 'humor' | 'other';
};
```

**Logic:** An LLM agent classifies the content type. If it's opinion, humor, or experience, fact-checking is skipped. If it's factual or news, fact-checking proceeds.

**Early exit:** If `needsFactCheck = false`, the pipeline returns immediately with `factCheckStatus: 'clean'` and skips all downstream steps.

### 2.3 Step 2: Extract Claims

**Purpose:** Pull factual claims from the post text.

**Input:** Post text

**Output:**
```typescript
type Claim = {
  id: string;
  text: string;
  type: 'factual' | 'causal' | 'evaluative' | 'predictive';
  domain: string;           // 'health', 'politics', 'tech', etc.
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;       // How confident the extraction is
  extractedAt: Date;
};
```

**Logic:** An LLM agent reads the post and extracts explicit factual claims. Each claim is classified by type and risk level.

**Early exit:** If no claims are found, the pipeline returns with `factCheckStatus: 'clean'` and skips fact-checking.

### 2.4 Step 3: Verify Claims (Fact-check)

**Purpose:** Verify each claim against web evidence.

**Input:** Post + Claims

**Output:**
```typescript
type FactCheck = {
  id: string;
  claimId: string;
  verdict: 'true' | 'false' | 'mixed' | 'unverifiable';
  confidence: number;       // 0-1, how confident in the verdict
  evidence: Evidence[];     // Sources used
  reasoning: string;
  caveats?: string[];
  checkedAt: Date;
};

type Evidence = {
  source: string;
  url?: string;
  snippet: string;
  quality: number;          // 0-1, source quality rating
  fetchedAt: Date;
};
```

**Logic:**
1. For each claim, perform web search
2. Gather evidence from multiple sources
3. Use LLM to synthesize evidence and render a verdict
4. Assign confidence based on evidence quality and agreement

**Verdicts:**
- `true`: Evidence strongly supports the claim
- `false`: Evidence contradicts the claim
- `mixed`: Evidence is conflicting
- `unverifiable`: No evidence found either way

### 2.5 Step 4: Score Value (LLM-based)

**Purpose:** Rate the post on the 5 value dimensions.

**Input:** Post + Claims + Fact-checks + (optional) Discussion quality

**Output:**
```typescript
type ValueScore = {
  epistemic: number;
  insight: number;
  practical: number;
  relational: number;
  effort: number;
  total: number;
  confidence: number;
  drivers?: string[];       // Why this score (e.g., "well-sourced", "novel angle")
  updatedAt: Date;
};
```

**The LLM Prompt:**
```
You are scoring post value for a social network.

Dimensions (0-1 each):
- Epistemic: factual rigor and correctness.
- Insight: novelty, synthesis, non-obvious perspective.
- Practical: actionable guidance or clear takeaways.
- Relational: healthy discourse, empathy, constructive tone.
- Effort: depth of work, sourcing, structure.

Input summary:
[Post text, claims, fact-checks, discussion quality]

Instructions:
- Base scores on provided evidence only.
- Reward posts with true/high-confidence claims.
- Penalize misinformation (false verdicts or missing evidence).
- Practical value depends on concrete steps or useful tips.
- Relational value depends on civility and cross-perspective markers.
- Effort considers text length, number of claims, and clarity indicators.
- Return JSON matching schema.
```

**Post-processing:**

1. **Clamp to [0, 1]:** All scores are clamped to valid range
2. **Apply fact-check penalty:** If there are confident false claims, reduce epistemic and insight scores
3. **Validate:** Replace any NaN/Infinity with 0.5 (neutral)
4. **Compute total:** Weighted average using domain-aware weights
5. **Clamp total:** Final total is clamped to [0, 1]

**Fact-check Penalty Logic:**
```typescript
const confidentFalseCount = factChecks.filter(
  (check) => check.verdict === 'false' && check.confidence > 0.7
).length;

if (confidentFalseCount > 0) {
  const penalty = Math.min(0.8, confidentFalseCount * 0.25);
  epistemic = epistemic * (1 - penalty);
  insight = insight * (1 - penalty * 0.3);  // Insight penalized less
}
```

**Example:** If a post has 2 confident false claims:
- Penalty = min(0.8, 2 × 0.25) = 0.5
- Epistemic reduced by 50%
- Insight reduced by 15%

---

## Part 3: How Value Affects User Reputation (Kurral Score)

### 3.1 The Kurral Score System

Each user has a **Kurral Score** (0-100) that represents their reputation on the platform.

```typescript
type KurralScore = {
  score: number;            // 0-100
  components: {
    qualityHistory: number;       // 0-100, based on post value scores
    violationHistory: number;     // 0-100, penalty for policy violations
    engagementQuality: number;    // 0-100, based on discussion quality
    consistency: number;          // 0-100, based on rolling 30-day value
    communityTrust: number;       // 0-100, based on policy decisions
  };
  history: Array<{
    score: number;
    delta: number;
    reason: string;
    date: Date;
  }>;
};
```

**Starting score:** 65 (neutral baseline)

### 3.2 Kurral Score Calculation

The score is calculated as:

```
positivePoints = 
  qualityScore × 0.4 +
  engagementScore × 0.15 +
  consistencyScore × 0.1 +
  trustScore × 0.1

penaltyPoints = violationPenalty × 0.25

netScore = positivePoints - penaltyPoints
normalizedScore = clamp(netScore, -0.25, 0.75)
scaledScore = ((normalizedScore + 0.25) / 1) × 100
finalScore = clamp(scaledScore, 0, 100)
```

**Weights:**
- Quality: 40% (most important)
- Violations: 25% (penalties)
- Engagement: 15%
- Consistency: 10%
- Trust: 10%

### 3.3 Component Calculations

**Quality Score** (from value scores):
```typescript
qualityScore = 
  epistemic × 0.3 +
  insight × 0.2 +
  practical × 0.2 +
  relational × 0.2 +
  effort × 0.1
```

**Violation Penalty:**
- Blocked content: +1.0 (max penalty)
- Needs review: +0.4
- Confident false claims (>0.7 confidence): +0.25 per claim (capped at 1.0)

**Engagement Score** (from discussion quality):
```typescript
engagementScore = 
  (informativeness + reasoningDepth + crossPerspective + civility) / 4
```

**Consistency Score** (from 30-day rolling value):
```typescript
consistencyScore = min(1, totalValue30d / 5)
```
*Rationale:* 5 value points per 30 days is considered solid consistency.

**Trust Score:**
- Blocked content: 0
- Recent violations: 0.3
- Needs review: 0.6
- Clean: 1.0

### 3.4 Value Contribution Tracking

The system tracks **value contributions** separately:

```typescript
type ValueStats = {
  postValue30d: number;           // Sum of post value scores (30-day rolling)
  commentValue30d: number;        // Sum of comment value scores (30-day rolling)
  lifetimePostValue: number;      // All-time sum
  lifetimeCommentValue: number;   // All-time sum
  lastUpdated: Date;
};
```

These are updated whenever a post/comment is scored.

---

## Part 4: Pros and Cons Analysis

### 4.1 PROS

#### ✅ Multi-dimensional Approach
**Pro:** The 5-dimensional system captures different types of value that a single score cannot.
- A post can be high-effort but low-insight
- A post can be high-insight but low-relational
- This allows nuanced ranking and filtering

**Example:** A technical deep-dive might score high on epistemic/effort but low on practical. A motivational post might score high on relational but low on epistemic.

#### ✅ Domain-Aware Weighting
**Pro:** Different domains have different value priorities. Health posts prioritize accuracy; tech posts prioritize novelty.
- Prevents gaming the system (can't just write long posts in health domain)
- Aligns scoring with domain norms
- Reduces misinformation in high-stakes domains

**Con:** Requires accurate domain detection. If domain detection fails, weighting is wrong.

#### ✅ Fact-Check Integration
**Pro:** Epistemic scores are directly penalized for false claims.
- Creates incentive for accuracy
- Misinformation doesn't get rewarded
- Penalty is proportional to confidence (confident false claims hurt more)

**Con:** Fact-checking is expensive (web search + LLM). Not all posts are fact-checked.

#### ✅ Decoupled Value and Reputation
**Pro:** A post's value is independent of the author's reputation.
- A new user can write a high-value post
- A high-reputation user can write a low-value post
- Prevents reputation from becoming a self-reinforcing loop

**Con:** Users might not understand why their reputation is low if their posts have high value.

#### ✅ Prompt Injection Protection
**Pro:** The code sanitizes user input before sending to LLM.
- Removes code blocks, special tokens, instruction patterns
- Prevents users from hijacking the scoring prompt
- Limits input length to 2000 chars

**Con:** Sanitization might remove legitimate content (e.g., code examples).

#### ✅ Atomic Pipeline
**Pro:** Each step either succeeds completely or fails loudly.
- No partial/corrupted data
- Easy to debug
- Clear error messages

**Con:** If any step fails, the entire pipeline fails. No graceful degradation.

---

### 4.2 CONS

#### ❌ LLM-Based Scoring is Non-Deterministic
**Con:** The same post might get different scores on different days.
- LLM responses vary (temperature, model updates, etc.)
- Makes it hard to debug why a score changed
- Users might perceive scoring as unfair/arbitrary

**Mitigation:** The code stores `confidence` scores. Low confidence scores could trigger re-scoring.

#### ❌ Expensive Computation
**Con:** Full pipeline requires:
- Pre-check LLM call
- Claim extraction LLM call
- Web search (per claim)
- Fact-check LLM call (per claim)
- Value scoring LLM call

**Cost:** ~$0.10-0.50 per post (rough estimate)

**Mitigation:** Pre-check step skips fact-checking for opinion/humor posts. Early exits reduce cost.

#### ❌ Fact-Check Verdicts are Binary
**Con:** Reality is often nuanced. A claim might be "mostly true" or "true in context."
- Binary verdicts (true/false/mixed) lose nuance
- Penalty system is coarse (0.25 per false claim)

**Mitigation:** The system has `mixed` and `unverifiable` verdicts. Confidence scores provide nuance.

#### ❌ Domain Detection is Heuristic
**Con:** Domain is determined by analyzing claims, not by explicit user input.
- If claim extraction fails, domain detection fails
- If claims are vague, domain is ambiguous
- Falls back to post topic, which might be wrong

**Example:** A post about "AI in healthcare" might be classified as tech (high insight weight) instead of health (high epistemic weight).

#### ❌ Relational Score is Hard to Measure
**Con:** "Healthy discourse" is subjective.
- LLM might not detect subtle hostility
- Sarcasm might be misinterpreted
- Cultural differences in communication style

**Mitigation:** Relational score is only 10-15% of total weight. Discussion quality is also tracked separately.

#### ❌ No Temporal Decay
**Con:** A post's value score never changes after initial scoring.
- If new evidence emerges, the score doesn't update
- If a claim becomes false later, the score doesn't change
- Outdated posts keep their high scores

**Mitigation:** The system tracks `updatedAt` timestamp. Could implement re-scoring on demand.

#### ❌ Effort Score is Proxy-Based
**Con:** Effort is estimated from text length, number of claims, clarity indicators.
- A well-written short post might score low on effort
- A rambling long post might score high on effort
- Doesn't measure actual research effort

**Mitigation:** Effort is only 10% of total weight. Not a major factor.

#### ❌ No Feedback Loop
**Con:** Users don't see why their post got a certain score.
- The `drivers` field is supposed to explain, but it's optional
- Users can't improve if they don't know what's wrong
- Might feel like a black box

**Mitigation:** The `explainerAgent` generates human-readable explanations. But this is separate from scoring.

#### ❌ Kurral Score Conflates Different Concepts
**Con:** Kurral Score mixes quality, violations, engagement, consistency, and trust.
- A user with high quality but many violations gets a mid-range score
- A user with low quality but no violations gets a mid-range score
- Hard to interpret what the score means

**Mitigation:** The system exposes component scores. Users can see the breakdown.

#### ❌ Reputation Can't Recover Quickly
**Con:** Kurral Score history is limited to 20 entries. Penalties persist.
- A user who made mistakes can't easily rebuild reputation
- Violations have long-term impact
- Might discourage users from returning

**Mitigation:** Consistency score is based on 30-day rolling value. Recent good posts help.

---

## Part 5: Critical Issues and Edge Cases

### 5.1 The Fact-Check Penalty is Too Aggressive

**Issue:** A single confident false claim reduces epistemic by 25%.

```
confidentFalseCount = 1
penalty = min(0.8, 1 × 0.25) = 0.25
epistemic = epistemic × (1 - 0.25) = epistemic × 0.75
```

**Problem:** A post with 1 false claim out of 10 true claims gets penalized heavily.

**Example:**
- Post makes 10 claims, 9 are true, 1 is false
- Epistemic score: 0.8 → 0.6 (25% reduction)
- But the post is 90% accurate!

**Recommendation:** Consider claim-level weighting:
```
penalty = (confidentFalseCount / totalClaimCount) × 0.5
```

### 5.2 Domain Detection Fails for Interdisciplinary Posts

**Issue:** A post about "AI ethics" might be classified as tech (insight-heavy) instead of philosophy (epistemic-heavy).

**Problem:** Weighting is wrong, score is wrong.

**Recommendation:** Allow multiple domains with weighted contributions:
```
weights = {
  tech: 0.6,
  philosophy: 0.4
}
```

### 5.3 No Handling of Satire or Irony

**Issue:** A post that says "The Earth is flat" as satire will be fact-checked and marked false.

**Problem:** Satire gets penalized for being false.

**Recommendation:** Add a `tone` field to claims:
```
type Claim = {
  ...
  tone: 'literal' | 'sarcastic' | 'ironic' | 'hypothetical';
}
```

### 5.4 Fact-Check Verdicts Don't Account for Uncertainty

**Issue:** A claim about a future event (e.g., "AI will surpass human intelligence by 2030") is marked `unverifiable`.

**Problem:** Predictive claims are treated the same as unverifiable claims. But they're different.

**Recommendation:** Add a `claimType` field:
```
type Claim = {
  ...
  type: 'factual' | 'causal' | 'evaluative' | 'predictive';
}
```

And handle predictive claims differently (e.g., lower epistemic weight).

### 5.5 No Handling of Contested Facts

**Issue:** A claim about a politically contested topic (e.g., "COVID vaccines are safe") might have conflicting evidence.

**Problem:** Verdict is `mixed`, but users might interpret this as "we don't know."

**Recommendation:** Track evidence quality and source bias:
```
type Evidence = {
  ...
  quality: number;
  sourceBias?: 'left' | 'center' | 'right' | 'unknown';
}
```

---

## Part 6: Comparison to Alternatives

### 6.1 Single-Score System (e.g., Reddit Upvotes)

**How it works:** One number (upvotes) represents value.

**Pros:**
- Simple
- Fast
- Users understand it

**Cons:**
- Loses nuance (can't distinguish insight from effort)
- Susceptible to gaming (upvote brigades)
- No fact-checking

**Verdict:** The 5-dimensional system is better for nuanced ranking.

### 6.2 Crowdsourced Scoring (e.g., Wikipedia)

**How it works:** Community votes on quality.

**Pros:**
- Captures collective wisdom
- Transparent
- Resistant to gaming (requires consensus)

**Cons:**
- Slow (requires many votes)
- Biased toward majority opinion
- Doesn't scale to new posts

**Verdict:** The LLM-based system is faster and more consistent.

### 6.3 Pure Fact-Check System (e.g., Snopes)

**How it works:** Only verify factual accuracy.

**Pros:**
- Clear and objective
- Easy to understand
- Resistant to subjectivity

**Cons:**
- Ignores other dimensions of value (insight, effort, relational)
- Doesn't reward good writing or novel ideas
- Doesn't penalize low-effort posts

**Verdict:** The 5-dimensional system is more comprehensive.

---

## Part 7: Recommendations for Improvement

### 7.1 Short-term (Low Effort)

1. **Add confidence thresholds:** Only apply fact-check penalty if confidence > 0.8
2. **Expose drivers:** Always populate the `drivers` field to explain scores
3. **Add re-scoring:** Allow users to request re-scoring if new evidence emerges
4. **Track score changes:** Log when a score changes and why

### 7.2 Medium-term (Medium Effort)

1. **Implement temporal decay:** Reduce score of old posts (e.g., -0.01 per month)
2. **Add claim-level weighting:** Weight false claims by their importance
3. **Implement multi-domain support:** Allow posts to have multiple domains
4. **Add tone detection:** Detect satire/irony and handle differently

### 7.3 Long-term (High Effort)

1. **Implement user feedback loop:** Let users rate if they agree with the score
2. **Train custom models:** Fine-tune LLM on platform-specific scoring
3. **Implement collaborative filtering:** Use user preferences to personalize weights
4. **Add causal inference:** Determine which factors actually drive value

---

## Conclusion

The value system is **well-designed for a social platform** with the following strengths:

1. **Multi-dimensional:** Captures different types of value
2. **Domain-aware:** Adapts to domain norms
3. **Fact-check integrated:** Penalizes misinformation
4. **Decoupled:** Value and reputation are independent
5. **Secure:** Protects against prompt injection

However, it has **notable limitations**:

1. **Non-deterministic:** LLM-based scoring varies
2. **Expensive:** Requires multiple LLM calls and web searches
3. **Coarse-grained:** Binary verdicts lose nuance
4. **Heuristic-based:** Domain detection and effort scoring are proxies
5. **No feedback loop:** Users don't understand why they got a score

The system is **production-ready** but would benefit from the recommended improvements, especially around transparency and temporal dynamics.

---

## Appendix: Code References

- Value scoring: `functions/src/services/valueScoringAgent.ts`
- Pipeline orchestrator: `functions/src/services/pipeline/index.ts`
- Kurral score: `src/webapp/lib/services/kurralScoreService.ts`
- Reputation tracking: `src/webapp/lib/services/reputationService.ts`
- Type definitions: `functions/src/types/index.ts`
