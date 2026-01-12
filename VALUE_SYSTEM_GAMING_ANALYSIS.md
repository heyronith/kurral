# How to Game the Value System: A Complete Engineering Analysis

**Author's Note:** This is a security/adversarial analysis. Every attack vector is traced to actual code. The goal is to identify vulnerabilities before bad actors do.

---

## Executive Summary

The value system has **at least 15 major gaming vectors** across 4 categories:

1. **Claim Extraction Gaming** (4 vectors)
2. **Fact-Check Evasion** (5 vectors)
3. **Scoring Manipulation** (4 vectors)
4. **Reputation Exploitation** (2 vectors)

**Severity:** HIGH. Most attacks require no technical sophistication. Some require coordination.

**Time to exploit:** Hours to days for most attacks. Weeks for sophisticated attacks.

---

## Part 1: Claim Extraction Gaming

### 1.1 The "No Claims" Attack

**How it works:**
```
IF no claims are extracted
THEN pipeline returns early with factCheckStatus: 'clean'
AND valueScore is NOT calculated
```

**Code reference:**
```typescript
// functions/src/services/pipeline/index.ts, line ~150
if (claims.length === 0) {
  const result: PipelineResult = {
    success: true,
    status: 'completed',
    preCheck,
    claims: [],
    factChecks: [],
    factCheckStatus: 'clean',  // ← CLEAN STATUS WITHOUT VALUE SCORE
    processedAt: new Date(),
    durationMs: Date.now() - startTime,
    stepsCompleted,
  };
  // ... saves and returns
}
```

**Attack:**
Write posts that make implicit claims instead of explicit claims.

**Examples:**
- ❌ "Vaccines cause autism" (explicit claim, will be extracted)
- ✅ "My child got vaccinated and then developed autism" (implicit claim, might not be extracted)
- ❌ "Climate change is real" (explicit)
- ✅ "I noticed the weather is different than 20 years ago" (implicit)
- ❌ "This supplement cures cancer" (explicit)
- ✅ "This supplement helped my friend who had cancer" (implicit, anecdotal)

**Why it works:**
The claim extraction LLM is trained to extract **explicit factual claims**. Implicit claims, anecdotes, and correlations are harder to extract.

**Impact:**
- Post bypasses fact-checking entirely
- Gets `factCheckStatus: 'clean'` without any value scoring
- Appears as high-quality content (no penalties)

**Severity:** HIGH

**Proof of concept:**
```
Post: "After taking this supplement, my energy levels improved dramatically."
Expected extraction: None (anecdotal, not a factual claim)
Result: factCheckStatus = 'clean', no value score calculated
```

---

### 1.2 The "Vague Language" Attack

**How it works:**
Make claims so vague that the LLM can't extract them.

**Examples:**
- ❌ "Studies show X causes Y" (specific, extractable)
- ✅ "Research suggests certain factors might influence outcomes" (vague, hard to extract)
- ❌ "The Earth is 4.5 billion years old" (specific)
- ✅ "Our planet has been around for a very long time" (vague)

**Why it works:**
The claim extraction prompt asks for "explicit factual claims." Vague statements are technically claims, but the LLM might not extract them because they're not specific enough to fact-check.

**Impact:**
- Fewer claims extracted
- Fewer fact-checks performed
- Lower epistemic penalty

**Severity:** MEDIUM

---

### 1.3 The "Hedging" Attack

**How it works:**
Add hedging language to make claims non-falsifiable.

**Examples:**
- ❌ "Vaccines cause autism" (falsifiable)
- ✅ "Some people believe vaccines might cause autism" (non-falsifiable, it's a meta-claim about beliefs)
- ❌ "Climate change is caused by humans" (falsifiable)
- ✅ "Some scientists argue that climate change might be influenced by human activity" (non-falsifiable)

**Why it works:**
The fact-check system looks for verdicts: true/false/mixed/unverifiable. A claim about "what some people believe" is technically true (people do believe it), so it gets a `true` verdict.

**Impact:**
- Claims get marked as `true` even if the underlying claim is false
- Epistemic score doesn't get penalized
- Misinformation spreads with high credibility

**Severity:** HIGH

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~250
const confidentFalseCount = factChecks.filter(
  (check) => check.verdict === 'false' && check.confidence > 0.7
).length;
// Only 'false' verdicts trigger penalty
// 'true' verdicts (even for hedged claims) don't
```

---

### 1.4 The "Domain Confusion" Attack

**How it works:**
Mix domains to confuse the weighting system.

**Example:**
```
Post about "AI in healthcare"
Claims extracted:
  - "AI can diagnose cancer" (health domain, high epistemic weight)
  - "AI is the future" (tech domain, high insight weight)

Dominant domain calculation:
  - health: 1 claim
  - tech: 1 claim
  - Falls back to post topic

Result: Weighting is ambiguous, might use wrong weights
```

**Why it works:**
The domain detection algorithm weights claims by risk level, but if there's a tie, it falls back to the post's topic. If the post topic is ambiguous, weighting is wrong.

**Impact:**
- A health post might get tech weighting (insight-heavy instead of epistemic-heavy)
- Misinformation in health domain gets rewarded for "insight"
- Accuracy is deprioritized

**Severity:** MEDIUM

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~130
const topDomain = 
  [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] 
  || normalizedTopic;  // ← Falls back to topic if tie
```

---

## Part 2: Fact-Check Evasion

### 2.1 The "Unverifiable" Attack

**How it works:**
Make claims that are technically true but unverifiable.

**Examples:**
- ❌ "The Earth is round" (verifiable, true)
- ✅ "I feel like the Earth is round" (unverifiable, it's a subjective feeling)
- ❌ "Smoking causes cancer" (verifiable, true)
- ✅ "I believe smoking might be related to health issues" (unverifiable, it's a belief)

**Why it works:**
The fact-check system returns `unverifiable` for claims it can't verify. Unverifiable claims don't trigger penalties.

**Impact:**
- Misinformation framed as beliefs/feelings bypasses fact-checking
- No epistemic penalty
- Appears credible

**Severity:** HIGH

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~250
const confidentFalseCount = factChecks.filter(
  (check) => check.verdict === 'false' && check.confidence > 0.7
).length;
// 'unverifiable' verdicts don't trigger penalty
```

---

### 2.2 The "Outdated Evidence" Attack

**How it works:**
Make claims that were false in the past but are now true (or vice versa).

**Example:**
```
Post: "Pluto is a planet"
Fact-check: Verdict = 'false' (Pluto was reclassified in 2006)
Result: Post gets penalized

But if you post this in 1990:
Fact-check: Verdict = 'true'
Result: Post gets rewarded
```

**Why it works:**
The fact-check system uses current evidence. It doesn't account for temporal context.

**Impact:**
- Old posts with outdated claims keep high scores
- New posts with historically accurate claims get penalized
- Confusion about what's "true"

**Severity:** MEDIUM

---

### 2.3 The "Contested Facts" Attack

**How it works:**
Make claims about politically/socially contested topics where evidence is mixed.

**Examples:**
- "Vaccines are safe" (contested, evidence is mixed)
- "Climate change is real" (contested, evidence is mixed)
- "Economic policy X is effective" (contested, evidence is mixed)

**Why it works:**
The fact-check system returns `mixed` for contested claims. Mixed verdicts don't trigger penalties.

**Impact:**
- Misinformation on contested topics bypasses penalties
- Both sides of a debate can claim high credibility
- No incentive for nuance

**Severity:** MEDIUM

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~250
const confidentFalseCount = factChecks.filter(
  (check) => check.verdict === 'false' && check.confidence > 0.7
).long;
// 'mixed' verdicts don't trigger penalty
```

---

### 2.4 The "Source Bias" Attack

**How it works:**
Make claims that are technically true but sourced from biased sources.

**Example:**
```
Claim: "Study shows supplement X is effective"
Evidence: Paper from supplement manufacturer
Verdict: 'true' (the study exists and says that)
Result: No penalty, even though source is biased
```

**Why it works:**
The fact-check system verifies claims against evidence, but doesn't evaluate source bias.

**Impact:**
- Biased claims get high credibility
- Manufacturer-funded studies are treated same as independent studies
- Epistemic score doesn't reflect source quality

**Severity:** MEDIUM

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~200
const buildSummary = (...) => {
  const factSummary = factChecks
    .map((fc) => `${fc.verdict} (${fc.confidence.toFixed(2)}) on claim ${fc.claimId}`)
    .slice(0, 5)
    .join('; ');
  // ← No source bias evaluation
}
```

---

### 2.5 The "Pre-check Bypass" Attack

**How it works:**
Frame misinformation as "opinion" to skip fact-checking entirely.

**Code reference:**
```typescript
// functions/src/services/pipeline/index.ts, line ~100
if (!needsFactCheck) {
  console.log('\n⏹️  No fact-check needed - returning early with clean status');
  const result: PipelineResult = {
    success: true,
    status: 'completed',
    preCheck,
    claims: [],
    factChecks: [],
    factCheckStatus: 'clean',  // ← CLEAN WITHOUT FACT-CHECKING
    ...
  };
}
```

**Attack:**
Write posts that the pre-check LLM classifies as "opinion" instead of "factual."

**Examples:**
- ❌ "Vaccines cause autism" (pre-check: factual, needs fact-check)
- ✅ "I think vaccines might cause autism" (pre-check: opinion, skips fact-check)
- ❌ "The Earth is flat" (pre-check: factual, needs fact-check)
- ✅ "Some people believe the Earth is flat" (pre-check: opinion, skips fact-check)

**Why it works:**
The pre-check LLM is trained to classify content type. Adding "I think" or "some people believe" changes the classification from "factual" to "opinion."

**Impact:**
- Misinformation bypasses fact-checking entirely
- Gets `factCheckStatus: 'clean'` without any verification
- Appears as high-quality content

**Severity:** CRITICAL

**Proof of concept:**
```
Post 1: "Vaccines cause autism"
Pre-check: contentType = 'factual', needsFactCheck = true
Result: Fact-checked, penalized

Post 2: "I think vaccines might cause autism"
Pre-check: contentType = 'opinion', needsFactCheck = false
Result: NOT fact-checked, gets 'clean' status
```

---

## Part 3: Scoring Manipulation

### 3.1 The "Effort Inflation" Attack

**How it works:**
Artificially inflate effort score by adding length without substance.

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~200
const buildSummary = (...) => {
  return [
    `Post text: """${sanitizeForPrompt(chirp.text).slice(0, 700)}"""`,
    claimSummary,
    factSummary,
    discussionSummary,
    commentsSummary,
  ].join('\n');
};
```

The LLM prompt says:
```
- Effort: depth of work, sourcing, structure.
- Effort considers text length, number of claims, and clarity indicators.
```

**Attack:**
Write long posts with many claims but low substance.

**Examples:**
- Repeat the same claim 10 times with different wording
- Add filler paragraphs that don't add information
- Include many citations but to low-quality sources
- Use complex language to appear more authoritative

**Why it works:**
The LLM is told to consider "text length" and "number of claims." It might not distinguish between substance and filler.

**Impact:**
- Effort score inflated
- Total value score inflated (effort is 10% of total)
- Low-quality long posts get high scores

**Severity:** MEDIUM

---

### 3.2 The "Relational Manipulation" Attack

**How it works:**
Artificially inflate relational score by appearing respectful while spreading misinformation.

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~200
const buildSummary = (...) => {
  const discussionSummary = discussion
    ? `Discussion quality -> inform:${discussion.informativeness.toFixed(2)}, civility:${discussion.civility.toFixed(2)}, reasoning:${discussion.reasoningDepth.toFixed(2)}, perspective:${discussion.crossPerspective.toFixed(2)}`
    : 'No discussion data yet.';
};
```

The LLM prompt says:
```
- Relational: healthy discourse, empathy, constructive tone.
- Relational value depends on civility and cross-perspective markers.
```

**Attack:**
Write misinformation in a respectful, empathetic tone.

**Examples:**
- ❌ "Vaccines are poison" (hostile, low relational)
- ✅ "I understand vaccines help many people, but I have concerns about safety" (respectful, high relational)
- ❌ "Climate deniers are idiots" (hostile)
- ✅ "I respect the scientific consensus, but I think we should consider alternative perspectives" (respectful)

**Why it works:**
The LLM evaluates tone separately from accuracy. A respectful post gets high relational score even if the underlying claim is false.

**Impact:**
- Misinformation in respectful tone gets high relational score
- Total value score is inflated (relational is 10-15% of total)
- Misinformation appears credible and civil

**Severity:** HIGH

---

### 3.3 The "Insight Inflation" Attack

**How it works:**
Artificially inflate insight score by making novel-sounding but false claims.

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~200
const buildSummary = (...) => {
  // LLM sees: claims, fact-checks, discussion quality
  // But doesn't see: how novel the claim actually is
};
```

The LLM prompt says:
```
- Insight: novelty, synthesis, non-obvious perspective.
```

**Attack:**
Make claims that sound novel but are actually false.

**Examples:**
- ❌ "Gravity is caused by magnetism" (novel-sounding, false)
- ❌ "Consciousness is a quantum phenomenon" (novel-sounding, unproven)
- ❌ "The moon landing was faked" (novel-sounding, false)

**Why it works:**
The LLM evaluates novelty based on the claim itself, not on whether it's true. A novel-sounding false claim gets high insight score.

**Impact:**
- False but novel claims get high insight scores
- In tech domain, insight is 35% of total weight
- Misinformation gets rewarded for being novel

**Severity:** HIGH

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~160
if (dominantDomain === 'technology' || dominantDomain === 'startups' || dominantDomain === 'ai') {
  return {
    epistemic: 0.25,
    insight: 0.35,  // ← HIGH WEIGHT
    practical: 0.2,
    relational: 0.1,
    effort: 0.1,
  };
}
```

---

### 3.4 The "Fact-Check Penalty Evasion" Attack

**How it works:**
Make false claims with low confidence so they don't trigger penalties.

**Code reference:**
```typescript
// functions/src/services/valueScoringAgent.ts, line ~250
const confidentFalseCount = factChecks.filter(
  (check) => check.verdict === 'false' && check.confidence > 0.7  // ← THRESHOLD
).length;
```

**Attack:**
Make claims that are false but hard to verify with high confidence.

**Examples:**
- ❌ "The Earth is flat" (easy to verify, high confidence false)
- ✅ "The Earth might be slightly flatter than we think" (hard to verify, low confidence false)
- ❌ "Vaccines cause autism" (easy to verify, high confidence false)
- ✅ "Vaccines might have rare side effects we haven't discovered yet" (hard to verify, low confidence false)

**Why it works:**
The penalty only applies if `confidence > 0.7`. Claims with low confidence don't trigger penalties.

**Impact:**
- False claims with low confidence bypass penalties
- Misinformation spreads if it's hard to verify
- Epistemic score doesn't reflect uncertainty

**Severity:** MEDIUM

---

## Part 4: Reputation Exploitation

### 4.1 The "Reputation Farming" Attack

**How it works:**
Build high reputation by posting high-value content, then use it to spread misinformation.

**Code reference:**
```typescript
// src/webapp/lib/services/kurralScoreService.ts, line ~30
const getQualityScore = (valueScore?: ValueScore): number => {
  if (!valueScore) {
    return 0.5; // Neutral baseline
  }
  const weighted =
    (valueScore.epistemic ?? 0.5) * 0.3 +
    (valueScore.insight ?? 0.5) * 0.2 +
    (valueScore.practical ?? 0.5) * 0.2 +
    (valueScore.relational ?? 0.5) * 0.2 +
    (valueScore.effort ?? 0.5) * 0.1;
  return Math.max(0, Math.min(1, weighted));
};
```

**Attack:**
1. Post high-quality content for weeks (build reputation)
2. Once reputation is high, start posting misinformation
3. Users trust the high-reputation account, so misinformation spreads

**Why it works:**
The system doesn't penalize reputation retroactively. Once you have high reputation, it persists even if you start posting low-quality content.

**Impact:**
- Misinformation from high-reputation accounts spreads faster
- Users assume high reputation = trustworthy
- Reputation can be weaponized

**Severity:** HIGH

**Proof of concept:**
```
Week 1-4: Post high-quality tech content
Result: Kurral Score = 85

Week 5: Start posting health misinformation
Result: Kurral Score slowly decreases, but still 75+
Users see high reputation and trust the misinformation
```

---

### 4.2 The "Coordinated Inauthentic Behavior" Attack

**How it works:**
Coordinate with other accounts to artificially inflate value scores.

**Attack:**
1. Create 10 fake accounts
2. Have all 10 accounts post the same misinformation
3. Each post gets scored independently
4. Misinformation appears on "Most Valued" feed
5. Real users see it and think it's credible

**Why it works:**
The system scores each post independently. It doesn't detect coordinated behavior.

**Impact:**
- Misinformation can be artificially promoted
- "Most Valued" feed can be gamed
- Coordination is hard to detect

**Severity:** HIGH

**Code reference:**
```typescript
// src/webapp/lib/services/mostValuedService.ts, line ~80
export const mostValuedService = {
  async getTopValuedPosts(
    timeframe: Timeframe = 'week',
    interests?: string[],
    minValueThreshold: number = 0.5,
    limitCount: number = 5
  ): Promise<MostValuedResult> {
    const constraints = buildConstraints({
      timeframe,
      interests,
      minValueThreshold,
      limit: limitCount,
    });
    const snapshot = await getDocs(query(collection(db, 'chirps'), ...constraints));
    // ← No detection of coordinated behavior
  }
};
```

---

## Part 5: Advanced Gaming Strategies

### 5.1 The "Hybrid Attack"

**How it works:**
Combine multiple gaming vectors for maximum impact.

**Example:**
```
1. Frame misinformation as "opinion" (Pre-check bypass)
2. Use hedging language (Hedging attack)
3. Write in respectful tone (Relational manipulation)
4. Add length and citations (Effort inflation)
5. Make it novel-sounding (Insight inflation)

Result: Post bypasses fact-checking, gets high scores, spreads misinformation
```

**Severity:** CRITICAL

---

### 5.2 The "Domain Hopping" Attack

**How it works:**
Post the same misinformation in different domains to find the one with lowest epistemic weight.

**Example:**
```
Claim: "Supplement X cures cancer"

Domain 1: Health (epistemic weight = 0.35)
Result: High epistemic penalty, low total score

Domain 2: Productivity (epistemic weight = 0.2)
Result: Lower epistemic penalty, higher total score

Domain 3: General (epistemic weight = 0.3)
Result: Medium epistemic penalty

Strategy: Post in Productivity domain where epistemic is deprioritized
```

**Why it works:**
The system uses domain-aware weighting. Different domains have different epistemic weights.

**Severity:** MEDIUM

---

### 5.3 The "Temporal Gaming" Attack

**How it works:**
Post misinformation when fact-checking is slow or unavailable.

**Example:**
```
1. Post misinformation at 3 AM when fact-checking service is slow
2. Post gets `factCheckStatus: 'pending'` for hours
3. Users see it and share it before fact-check completes
4. By the time fact-check completes, misinformation has spread
```

**Why it works:**
The pipeline is asynchronous. There's a window between posting and fact-checking.

**Severity:** MEDIUM

---

## Part 6: Why These Attacks Work

### Root Causes

1. **LLM-based claim extraction is imperfect**
   - Can't extract implicit claims
   - Can't extract hedged claims
   - Can't extract vague claims

2. **Fact-check system has blind spots**
   - Doesn't penalize unverifiable claims
   - Doesn't penalize mixed verdicts
   - Doesn't evaluate source bias
   - Doesn't account for temporal context

3. **Scoring is based on limited context**
   - LLM only sees post text, claims, fact-checks
   - Doesn't see user history
   - Doesn't see coordinated behavior
   - Doesn't see source bias

4. **Pre-check can be bypassed**
   - Adding "I think" changes classification
   - Adding "some people believe" changes classification
   - LLM is not robust to framing

5. **No feedback loop**
   - Users don't know why they got a score
   - No way to appeal or correct
   - No way to detect gaming

6. **Reputation is sticky**
   - High reputation persists even with low-quality posts
   - No retroactive penalties
   - Can be weaponized

---

## Part 7: Severity Matrix

| Attack | Severity | Effort | Detection | Impact |
|--------|----------|--------|-----------|--------|
| No Claims | HIGH | LOW | HARD | Bypasses fact-checking |
| Vague Language | MEDIUM | LOW | MEDIUM | Fewer fact-checks |
| Hedging | HIGH | LOW | HARD | Misinformation spreads |
| Domain Confusion | MEDIUM | MEDIUM | MEDIUM | Wrong weighting |
| Unverifiable | HIGH | LOW | HARD | Misinformation spreads |
| Outdated Evidence | MEDIUM | MEDIUM | HARD | Confusion |
| Contested Facts | MEDIUM | LOW | HARD | No penalties |
| Source Bias | MEDIUM | MEDIUM | HARD | Biased claims rewarded |
| Pre-check Bypass | CRITICAL | LOW | HARD | Bypasses fact-checking |
| Effort Inflation | MEDIUM | MEDIUM | MEDIUM | Low-quality posts rewarded |
| Relational Manipulation | HIGH | MEDIUM | HARD | Misinformation appears civil |
| Insight Inflation | HIGH | MEDIUM | HARD | False claims rewarded |
| Penalty Evasion | MEDIUM | MEDIUM | MEDIUM | False claims bypass penalties |
| Reputation Farming | HIGH | HIGH | MEDIUM | Misinformation from trusted accounts |
| Coordinated Behavior | HIGH | HIGH | HARD | Artificial promotion |
| Hybrid Attack | CRITICAL | HIGH | HARD | Maximum impact |

---

## Part 8: Recommended Mitigations

### 8.1 Immediate (Low Effort)

1. **Increase confidence threshold for penalties**
   ```typescript
   // Current: confidence > 0.7
   // Proposed: confidence > 0.85
   ```
   *Effect:* Reduces penalty evasion

2. **Add source bias evaluation**
   ```typescript
   type Evidence = {
     ...
     sourceBias?: 'left' | 'center' | 'right' | 'unknown';
     sourceCredibility?: number; // 0-1
   }
   ```
   *Effect:* Reduces source bias attack

3. **Penalize unverifiable claims**
   ```typescript
   // Current: unverifiable claims don't trigger penalty
   // Proposed: unverifiable claims reduce epistemic by 0.1
   ```
   *Effect:* Reduces unverifiable attack

4. **Add tone detection to pre-check**
   ```typescript
   type PreCheckResult = {
     ...
     tone?: 'literal' | 'sarcastic' | 'ironic' | 'hedged';
   }
   ```
   *Effect:* Reduces hedging attack

### 8.2 Short-term (Medium Effort)

1. **Implement claim-level weighting**
   ```typescript
   // Current: 1 false claim = 25% penalty
   // Proposed: penalty = (falseClaims / totalClaims) * 0.5
   ```
   *Effect:* Reduces penalty evasion, more fair

2. **Add temporal decay to reputation**
   ```typescript
   // Current: reputation persists forever
   // Proposed: reputation decays -0.1 per month of inactivity
   ```
   *Effect:* Reduces reputation farming

3. **Detect coordinated behavior**
   ```typescript
   // Check if multiple accounts post identical/similar content
   // Flag as potential coordinated inauthentic behavior
   ```
   *Effect:* Reduces coordinated attacks

4. **Add user feedback loop**
   ```typescript
   // Let users rate if they agree with the score
   // Use feedback to retrain scoring model
   ```
   *Effect:* Improves scoring accuracy, detects gaming

### 8.3 Long-term (High Effort)

1. **Implement adversarial training**
   - Train LLM on known gaming attempts
   - Improve robustness to hedging, vagueness, etc.

2. **Add causal inference**
   - Determine which factors actually drive value
   - Remove factors that are easily gamed

3. **Implement multi-model ensemble**
   - Use multiple LLMs for scoring
   - Require consensus to prevent single-model gaming

4. **Add human review for high-stakes domains**
   - Health and politics posts reviewed by humans
   - Reduces misinformation in critical domains

---

## Part 9: Detection Strategies

### 9.1 Automated Detection

**Pattern 1: Sudden reputation drop**
```
User posts high-quality content for weeks
Then suddenly posts low-quality content
Reputation drops from 85 to 70 in one day
→ Likely reputation farming attack
```

**Pattern 2: Coordinated posting**
```
Multiple accounts post identical/similar content
Within same time window
All get high value scores
→ Likely coordinated inauthentic behavior
```

**Pattern 3: Hedging pattern**
```
User consistently uses hedging language
"I think", "some people believe", "might be"
But underlying claims are false
→ Likely hedging attack
```

**Pattern 4: Domain hopping**
```
User posts same claim in multiple domains
Gets different scores in each domain
Promotes the version with highest score
→ Likely domain hopping attack
```

### 9.2 Manual Detection

1. **Audit high-value posts**
   - Manually review top 100 posts by value
   - Check for gaming patterns

2. **Audit high-reputation users**
   - Manually review top 100 users by reputation
   - Check for sudden changes in posting quality

3. **Audit fact-check verdicts**
   - Manually review fact-checks with low confidence
   - Check for gaming patterns

---

## Part 10: Conclusion

The value system is **highly gameable** with at least 15 major attack vectors. The most critical vulnerabilities are:

1. **Pre-check bypass** (CRITICAL) - Framing misinformation as opinion
2. **Hedging attack** (HIGH) - Making claims non-falsifiable
3. **Relational manipulation** (HIGH) - Spreading misinformation respectfully
4. **Reputation farming** (HIGH) - Building reputation then spreading misinformation

**Most attacks require minimal effort** (hours to days) and **no technical sophistication**. Some attacks (coordinated behavior, reputation farming) require more effort but are still feasible.

**The system needs immediate hardening** before launch. Recommended priority:

1. **Immediate:** Increase confidence threshold, add source bias evaluation
2. **Short-term:** Implement claim-level weighting, add temporal decay, detect coordinated behavior
3. **Long-term:** Adversarial training, multi-model ensemble, human review

Without these mitigations, the system will be gamed extensively, and misinformation will spread at scale.

---

## Appendix: Code References

- Claim extraction: `functions/src/services/pipeline/steps/extractClaims.ts`
- Fact-checking: `functions/src/services/pipeline/steps/verifyClaims.ts`
- Value scoring: `functions/src/services/valueScoringAgent.ts`
- Pre-check: `functions/src/services/pipeline/steps/precheck.ts`
- Kurral score: `src/webapp/lib/services/kurralScoreService.ts`
- Most valued: `src/webapp/lib/services/mostValuedService.ts`
