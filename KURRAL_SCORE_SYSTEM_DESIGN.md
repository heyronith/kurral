# Kurral Score System - Comprehensive Design Document

## Executive Summary

**Is it possible?** ✅ **YES** - Based on research and existing codebase analysis, a credit-score-like reputation system is not only possible but highly recommended for maintaining platform quality.

**Current Foundation:**
- ✅ Value scoring system (5 dimensions)
- ✅ Fact-checking infrastructure
- ✅ Policy decision engine (clean/needs_review/blocked)
- ✅ Value contributions tracking
- ✅ Post review system

**What's Missing:**
- ❌ No user-level reputation score
- ❌ No violation tracking system
- ❌ No score decay/improvement mechanism
- ❌ No abuse prevention

---

## 1. Score Range & Structure

### Recommended Score Range: **300-850**

**Rationale:**
- Familiar to users (similar to FICO credit scores)
- Wide enough range for meaningful differentiation
- Allows for significant movement (up/down)
- Industry standard range

### Score Tiers

| Score Range | Tier | Meaning | Display Color |
|-------------|------|---------|---------------|
| 750-850 | Excellent | Trusted contributor, high-quality content | Green |
| 650-749 | Good | Reliable contributor, mostly accurate | Light Green |
| 550-649 | Fair | Mixed quality, some issues | Yellow |
| 450-549 | Poor | Frequent problems, low trust | Orange |
| 300-449 | Very Poor | Significant violations, untrustworthy | Red |

### Initial Score

**New Users Start at: 650** (Good tier)
- Gives benefit of the doubt
- Allows room to improve or decline
- Not punitive for new users
- Encourages participation

---

## 2. Score Components & Weights

Based on credit score research and social reputation systems:

### Component Breakdown

| Component | Weight | Description |
|-----------|--------|-------------|
| **Content Quality History** | 40% | Track record of factual accuracy and value |
| **Violation History** | 25% | Misinformation, hate speech, policy violations |
| **Engagement Quality** | 15% | Discussion quality, constructive interactions |
| **Consistency** | 10% | Regular activity, sustained participation |
| **Community Trust** | 10% | Reports, reviews, user feedback |

---

## 3. Positive Score Impacts

### Content Quality History (40% weight)

**Positive Factors:**

1. **High Value Scores**
   - Post with value score > 0.7: **+2 to +5 points**
   - Post with value score 0.5-0.7: **+1 to +2 points**
   - Comment with high contribution: **+0.5 to +1 points**

2. **Fact-Checked True Claims**
   - Each verified true claim: **+1 point**
   - High-confidence fact checks (>0.8): **+2 points**
   - Multiple true claims in one post: **+3 to +5 points**

3. **Clean Policy Status**
   - Post marked 'clean': **+1 point**
   - Consistent clean posts (10+): **+5 bonus points**

4. **High Epistemic Score**
   - Epistemic dimension > 0.8: **+3 points**
   - Shows factual rigor

**Calculation:**
```typescript
const qualityScore = (
  averageValueScore * 30 +           // 30% of component
  verifiedTrueClaimsCount * 5 +      // 5% of component
  cleanPostsRatio * 3 +              // 3% of component
  averageEpistemicScore * 2          // 2% of component
) * 0.4; // 40% weight
```

### Engagement Quality (15% weight)

**Positive Factors:**

1. **Constructive Discussions**
   - High relational score (>0.7): **+1 point**
   - Discussion quality > 0.8: **+2 points**
   - Cross-perspective engagement: **+1 point**

2. **Helpful Comments**
   - Comments with high practical value: **+0.5 points**
   - Comments that answer questions: **+1 point**

**Calculation:**
```typescript
const engagementScore = (
  averageRelationalScore * 10 +
  averageDiscussionQuality * 5
) * 0.15; // 15% weight
```

### Consistency (10% weight)

**Positive Factors:**

1. **Regular Activity**
   - Posting 3+ times per week: **+2 points**
   - Consistent for 30 days: **+5 points**
   - Consistent for 90 days: **+10 points**

2. **Account Age**
   - Account > 6 months: **+5 points**
   - Account > 1 year: **+10 points**
   - Account > 2 years: **+15 points**

**Calculation:**
```typescript
const consistencyScore = (
  activityConsistency * 5 +    // 5% of component
  accountAgeBonus * 5          // 5% of component
) * 0.10; // 10% weight
```

### Community Trust (10% weight)

**Positive Factors:**

1. **Positive Reviews**
   - Post validated by community: **+2 points**
   - Multiple validations: **+5 points**

2. **Low Report Rate**
   - No reports in 30 days: **+2 points**
   - No reports in 90 days: **+5 points**

**Calculation:**
```typescript
const trustScore = (
  positiveReviews * 7 +
  lowReportRate * 3
) * 0.10; // 10% weight
```

---

## 4. Negative Score Impacts

### Violation History (25% weight) - **MOST IMPORTANT**

**Negative Factors:**

1. **Misinformation (Severe)**
   - False claim with high confidence (>0.7): **-15 to -25 points**
   - Multiple false claims: **-30 to -50 points**
   - High-risk domain (health/finance/politics) false claim: **-40 to -60 points**

2. **Policy Violations**
   - Post marked 'blocked': **-20 points**
   - Post marked 'needs_review': **-5 to -10 points**
   - Multiple violations: **-30 to -50 points**

3. **Hate Speech / Toxicity**
   - Detected hate speech: **-50 to -100 points** (severe)
   - Low civility score (<0.3): **-5 to -10 points**
   - Toxic discussion patterns: **-10 to -20 points**

4. **Spam / Low Quality**
   - Very low value score (<0.2): **-2 to -5 points**
   - Spam patterns detected: **-10 to -20 points**
   - Repetitive low-quality content: **-5 to -10 points**

**Calculation:**
```typescript
const violationScore = (
  falseClaimsCount * -20 +           // -15% of component
  blockedPostsCount * -15 +          // -5% of component
  hateSpeechIncidents * -50 +        // -3% of component
  spamPatterns * -10                 // -2% of component
) * 0.25; // 25% weight (negative)
```

### Content Quality History (Negative Side)

**Negative Factors:**

1. **Low Value Scores**
   - Post with value score < 0.3: **-1 to -3 points**
   - Consistently low scores: **-5 to -10 points**

2. **Unverified Claims**
   - High-risk unverified claims: **-5 points**
   - Multiple unknown verdicts: **-3 points**

**Calculation:**
```typescript
const qualityPenalty = (
  lowValueScorePosts * -2 +
  unverifiedHighRiskClaims * -5
) * 0.40; // 40% weight (negative side)
```

### Community Trust (Negative Side)

**Negative Factors:**

1. **User Reports**
   - Post reported by users: **-5 to -10 points**
   - Multiple reports: **-15 to -25 points**
   - Reports validated: **-30 to -50 points**

2. **Negative Reviews**
   - Post invalidated by community: **-10 points**
   - Multiple invalidations: **-20 points**

**Calculation:**
```typescript
const trustPenalty = (
  userReports * -10 +
  validatedReports * -30 +
  invalidatedPosts * -15
) * 0.10; // 10% weight (negative)
```

---

## 5. Score Calculation Formula

### Base Formula

```typescript
const kurralScore = Math.max(300, Math.min(850,
  650 + // Starting score
  (qualityScore * 0.40) +        // Content Quality (40%)
  (violationPenalty * 0.25) +     // Violations (25%, negative)
  (engagementScore * 0.15) +      // Engagement (15%)
  (consistencyScore * 0.10) +     // Consistency (10%)
  (trustScore * 0.10)             // Community Trust (10%)
));
```

### Time Decay & Recovery

**Violation Decay:**
- Violations lose impact over time
- After 30 days: 50% impact
- After 90 days: 25% impact
- After 180 days: 10% impact
- After 365 days: 0% impact (removed)

**Positive Activity Boost:**
- Recent good behavior (last 30 days) weighted 2x
- Sustained good behavior (90+ days) weighted 1.5x

---

## 6. Implementation Strategy

### Phase 1: Core Infrastructure

**1. Add Kurral Score to User Type**
```typescript
// In types/index.ts
export type User = {
  // ... existing fields
  kurralScore?: {
    score: number;              // 300-850
    lastUpdated: Date;
    components: {
      qualityHistory: number;   // 0-100
      violationHistory: number; // 0-100 (lower is better)
      engagementQuality: number; // 0-100
      consistency: number;      // 0-100
      communityTrust: number;    // 0-100
    };
    history: Array<{
      date: Date;
      change: number;            // + or - points
      reason: string;
      source: 'post' | 'comment' | 'violation' | 'review';
    }>;
  };
};
```

**2. Create Kurral Score Service**
```typescript
// src/webapp/lib/services/kurralScoreService.ts

export async function calculateKurralScore(userId: string): Promise<number> {
  // 1. Get user's posts/comments from last 90 days
  // 2. Calculate each component
  // 3. Apply weights
  // 4. Return score 300-850
}

export async function updateKurralScore(
  userId: string,
  event: 'post_created' | 'violation' | 'review',
  data: any
): Promise<void> {
  // Real-time score update
  // Record in history
  // Update user document
}
```

**3. Integration Points**

- **Post Created**: Update score based on value score
- **Fact Check Complete**: Update based on verdicts
- **Policy Decision**: Update based on status
- **Post Reviewed**: Update based on validation/invalidation
- **User Reports**: Update based on reports

### Phase 2: Violation Tracking

**Create Violations Collection:**
```typescript
// Firestore: violations collection
{
  id: string;
  userId: string;
  type: 'misinformation' | 'hate_speech' | 'spam' | 'policy_violation';
  severity: 'low' | 'medium' | 'high' | 'severe';
  chirpId?: string;
  commentId?: string;
  factCheckId?: string;
  pointsDeducted: number;
  createdAt: Date;
  expiresAt: Date; // For decay calculation
  reviewed: boolean;
  reviewedBy?: string;
}
```

### Phase 3: Score Display

**Profile Page Integration:**
- Display Kurral Score prominently
- Show score tier (Excellent/Good/Fair/Poor/Very Poor)
- Show recent changes
- Show component breakdown (optional)

**Feed Integration:**
- Show score badge on posts
- Filter/boost based on score
- Trust indicators

---

## 7. Abuse Prevention

### Anti-Gaming Measures

1. **Rate Limiting**
   - Max score increase per day: +20 points
   - Prevents rapid score manipulation

2. **Quality Over Quantity**
   - 10 low-quality posts < 1 high-quality post
   - Spam detection prevents gaming

3. **Time Weighting**
   - Recent violations weighted more heavily
   - Old violations decay naturally

4. **Cross-Validation**
   - Multiple signals required for severe penalties
   - Human review for high-impact changes

5. **Anomaly Detection**
   - Flag sudden score changes
   - Investigate suspicious patterns

### Fraud Detection

1. **Bot Detection**
   - Unusual posting patterns
   - Low engagement despite high volume
   - Automated content detection

2. **Collusion Detection**
   - Coordinated reporting
   - Fake validation patterns
   - Suspicious engagement rings

---

## 8. Score Update Frequency

### Real-Time Updates (Immediate)
- Post created with value score
- Fact check completed
- Policy violation detected
- Post blocked/flagged

### Batch Updates (Every 24 hours)
- Recalculate all components
- Apply time decay
- Update score history
- Clean expired violations

### Full Recalculation (Weekly)
- Complete score recalculation
- Verify accuracy
- Detect anomalies

---

## 9. Data Requirements

### What We Have ✅
- Value scores (5 dimensions)
- Fact checks (verdicts, confidence)
- Policy decisions (clean/needs_review/blocked)
- Value contributions
- Discussion quality
- Post reviews (validate/invalidate)

### What We Need to Add ❌
- Violation tracking system
- User report system
- Hate speech detection
- Spam detection
- Score history tracking
- Abuse detection

---

## 10. Example Scenarios

### Scenario 1: New User (Starting at 650)

**Week 1:**
- Posts 5 posts, average value 0.6 → **+8 points** (658)
- All fact checks true → **+5 points** (663)
- No violations → **+0 points** (663)

**Week 2:**
- Posts 3 high-quality posts (0.8+) → **+12 points** (675)
- One false claim detected → **-20 points** (655)
- **Score: 655** (Good tier)

### Scenario 2: Established User (Current: 720)

**Day 1:**
- Posts misinformation (health claim, false, high confidence) → **-50 points** (670)
- **Score: 670** (Good tier)

**Day 30:**
- Violation impact decays to 50% → **+25 points** (695)
- Continued good behavior → **+5 points** (700)
- **Score: 700** (Good tier)

### Scenario 3: High-Quality Contributor (Current: 800)

**Month 1:**
- 20 posts, average value 0.75 → **+30 points**
- All verified true → **+20 points**
- High engagement → **+10 points**
- **Score: 860** → **Capped at 850** (Excellent tier)

---

## 11. Implementation Priority

### High Priority (MVP)
1. ✅ Basic score calculation (300-850)
2. ✅ Integration with existing value scores
3. ✅ Violation tracking for false claims
4. ✅ Score display in profile

### Medium Priority
1. ⚠️ Hate speech detection
2. ⚠️ Spam detection
3. ⚠️ User report system
4. ⚠️ Score history tracking

### Low Priority (Future)
1. 🔮 Advanced abuse detection
2. 🔮 Score-based feed ranking
3. 🔮 Score badges/achievements
4. 🔮 Public score leaderboards

---

## 12. Risks & Mitigations

### Risk 1: Score Manipulation
**Mitigation:** Rate limiting, quality over quantity, anomaly detection

### Risk 2: False Positives (Good users penalized)
**Mitigation:** Multiple signals required, human review for severe penalties, appeal system

### Risk 3: Score Stagnation (Hard to improve)
**Mitigation:** Time decay, recent activity boost, clear improvement paths

### Risk 4: Privacy Concerns
**Mitigation:** Optional public display, granular privacy controls

---

## 13. Success Metrics

### Track These:
- Average Kurral Score across platform
- Score distribution (should be bell curve)
- Score improvement rate (users going up)
- Violation rate (should decrease over time)
- User engagement correlation with score

---

## Conclusion

**Feasibility: ✅ HIGHLY FEASIBLE**

The Kurral Score system is not only possible but recommended. Your existing infrastructure (value scoring, fact-checking, policy engine) provides 70% of what's needed. The remaining 30% (violation tracking, abuse prevention) is standard engineering work.

**Key Advantages:**
- Leverages existing data
- Encourages quality content
- Discourages misinformation
- Builds platform trust
- Differentiates from competitors

**Recommended Next Steps:**
1. Implement Phase 1 (Core Infrastructure)
2. Test with beta users
3. Iterate based on feedback
4. Roll out gradually

The system will create a self-reinforcing cycle: **High scores → More visibility → More engagement → Higher scores** for quality contributors, while penalizing bad actors.

