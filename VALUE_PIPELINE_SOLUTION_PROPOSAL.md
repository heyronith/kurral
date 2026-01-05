# Value Pipeline Solution Proposal

## Problem Statement

The current value pipeline has a fail-closed design where pre-check failures cause ALL posts to skip fact-checking, even posts that clearly need it. We need an intelligent, dynamic algorithm that:

1. **Doesn't miss posts that need fact-checking** (high accuracy/recall)
2. **Doesn't fact-check everything** (cost/performance efficiency)
3. **Is resilient to API failures** (doesn't fail-closed)
4. **Uses intelligent heuristics** when AI is unavailable
5. **Prioritizes high-risk content** (health, finance, politics)

## Current Issues

1. **Fail-Closed Design**: When pre-check fails, `shouldProceedWithFactCheck` defaults to `false`, skipping ALL fact-checking
2. **Weak Fallback**: The fallback heuristic defaults to skipping ambiguous content
3. **No Risk-Based Prioritization**: All posts are treated equally, regardless of risk level
4. **No Gradual Degradation**: It's all-or-nothing - either AI works or everything fails

## Proposed Solution: Multi-Tier Intelligent Pre-Check System

### Tier 1: AI-Powered Pre-Check (Primary)

**When Available**: Use OpenAI API to intelligently determine if content needs fact-checking

**Enhancements**:
- Add confidence threshold (e.g., only skip if confidence > 0.8 AND needsFactCheck = false)
- For low confidence (< 0.7), err on the side of caution (proceed with fact-checking)
- Return structured response with risk assessment, not just boolean

**Benefits**:
- Most accurate classification
- Can identify nuanced cases (mixed content, subtle claims)

### Tier 2: Enhanced Rule-Based Heuristic (Fallback)

**When AI Unavailable**: Use an enhanced multi-factor heuristic that is FAIL-OPEN for ambiguous cases

**Key Improvements**:

1. **Risk-Based Indicators**:
   - **High-Risk Domains**: Health, medical, finance, politics, vaccines, climate, elections
   - **High-Risk Keywords**: "cure", "treatment", "investment advice", "vaccine causes", "election fraud", etc.
   - **Statistical Claims**: Percentages, numbers, "study shows", "research indicates"
   - **Authority Claims**: "experts say", "scientists claim", "doctors recommend"

2. **Confidence Scoring**:
   - Calculate a confidence score (0-1) based on indicator strength
   - If confidence > 0.7 AND has high-risk indicators → `needsFactCheck: true`
   - If confidence > 0.7 AND has only opinion indicators → `needsFactCheck: false`
   - **If confidence < 0.7 (ambiguous) → `needsFactCheck: true` (FAIL-OPEN)**

3. **Multi-Factor Analysis**:
   - Count factual indicators (numbers, percentages, dates, statistics)
   - Count opinion indicators (I think, I feel, in my opinion, personal experience)
   - Check for high-risk domain keywords
   - Check for authoritative language (experts, studies, research)
   - Check content length (longer posts more likely to have claims)

4. **Context Awareness**:
   - Account for topic metadata (if topic is "health" or "politics", higher risk)
   - Account for semantic topics (if post is about health/politics, higher risk)
   - Account for entities (if mentions medical/financial entities, higher risk)

### Tier 3: Content-Based Risk Scoring

**For All Posts**: Calculate a risk score even before pre-check

**Risk Factors**:
1. **Domain Risk** (from topic/semantic topics):
   - Health/medical: 0.9
   - Finance/economics: 0.8
   - Politics: 0.8
   - Science/technology: 0.6
   - General/other: 0.3

2. **Content Indicators**:
   - Statistical claims (%, numbers, "X out of Y"): +0.3
   - Authoritative language ("experts", "studies", "research"): +0.2
   - High-risk keywords (health, finance, politics keywords): +0.4
   - Opinion markers ("I think", "I feel"): -0.2
   - Personal experience markers ("I went", "I tried"): -0.3

3. **Content Length**:
   - Short posts (< 50 chars): lower risk (0.1)
   - Medium posts (50-200 chars): medium risk (0.5)
   - Long posts (> 200 chars): higher risk (0.7)

**Risk Thresholds**:
- Risk Score > 0.7: **Always fact-check** (high-risk content)
- Risk Score 0.4-0.7: **Use AI pre-check** (medium-risk, needs intelligent decision)
- Risk Score < 0.4: **Skip fact-checking** (low-risk content, likely opinion/experience)

### Tier 4: Post-Processing Validation

**After Pre-Check**: Validate the decision with a secondary check

**Validation Rules**:
1. If AI pre-check says "skip" BUT risk score > 0.7 → Override to "fact-check"
2. If AI pre-check fails BUT risk score > 0.6 → Proceed with fact-checking
3. If heuristic says "skip" BUT has high-risk keywords → Override to "fact-check"

## Implementation Strategy

### Phase 1: Enhanced Fallback Heuristic (Fail-Open)

**Goal**: Make the fallback heuristic fail-open for ambiguous cases

**Changes**:
1. Improve `fallbackPreCheck` function to calculate confidence scores
2. Default to `needsFactCheck: true` when confidence < 0.7 (ambiguous cases)
3. Add high-risk domain/keyword detection
4. Use topic/semantic topics for risk assessment

**Impact**: When AI fails, ambiguous content will be fact-checked (safer default)

### Phase 2: Risk-Based Pre-Check

**Goal**: Calculate risk score before pre-check and use it for decision-making

**Changes**:
1. Add `calculateContentRiskScore()` function
2. Use risk score to inform pre-check decision
3. Override pre-check "skip" decision if risk score is high
4. Skip pre-check entirely if risk score is very low (< 0.3)

**Impact**: High-risk content always gets fact-checked, low-risk content skips efficiently

### Phase 3: Confidence-Based Pre-Check

**Goal**: Use confidence scores from AI pre-check to make better decisions

**Changes**:
1. Modify pre-check to return confidence scores (already exists)
2. Only trust "skip" decision if confidence > 0.8
3. For low confidence (< 0.7), proceed with fact-checking
4. For medium confidence (0.7-0.8), use risk score as tiebreaker

**Impact**: Reduces false negatives (posts that need fact-checking but are skipped)

### Phase 4: Post-Processing Validation

**Goal**: Add a validation layer to catch edge cases

**Changes**:
1. Add validation after pre-check decision
2. Override "skip" if risk indicators are strong
3. Log overrides for monitoring/improvement

**Impact**: Catches edge cases where pre-check made the wrong decision

## Algorithm Flow

```
1. Calculate Content Risk Score
   ├─ If Risk Score > 0.7 → Proceed with fact-checking (skip pre-check)
   ├─ If Risk Score < 0.3 → Skip fact-checking (skip pre-check)
   └─ If Risk Score 0.3-0.7 → Continue to pre-check

2. Run Pre-Check (if needed)
   ├─ Try AI Pre-Check
   │  ├─ Success → Use AI decision + confidence
   │  │  ├─ If needsFactCheck = false AND confidence > 0.8 → Skip
   │  │  ├─ If needsFactCheck = false AND confidence < 0.8 → Proceed (low confidence override)
   │  │  └─ If needsFactCheck = true → Proceed
   │  └─ Failure → Fall back to enhanced heuristic
   └─ Enhanced Heuristic
      ├─ Calculate confidence score (0-1)
      ├─ If confidence > 0.7 AND has high-risk indicators → Proceed
      ├─ If confidence > 0.7 AND only opinion indicators → Skip
      └─ If confidence < 0.7 → Proceed (fail-open for ambiguous)

3. Post-Processing Validation
   ├─ If pre-check says "skip" BUT risk score > 0.7 → Override to proceed
   ├─ If pre-check says "skip" BUT has high-risk keywords → Override to proceed
   └─ Otherwise → Use pre-check decision

4. Final Decision
   └─ shouldProceedWithFactCheck = true/false
```

## Key Design Principles

1. **Fail-Open for Ambiguity**: When uncertain, err on the side of fact-checking
2. **Risk-Based Prioritization**: High-risk content (health, finance, politics) always gets fact-checked
3. **Confidence-Aware**: Low-confidence "skip" decisions are overridden
4. **Gradual Degradation**: System degrades gracefully when AI fails
5. **Cost Efficiency**: Low-risk content skips fact-checking to save costs
6. **Accuracy First**: Prioritize not missing posts that need fact-checking

## Expected Outcomes

1. **Reduced False Negatives**: Posts that need fact-checking won't be missed
2. **Cost Efficiency**: Low-risk posts skip expensive fact-checking
3. **Resilience**: System works even when AI API fails
4. **Better Prioritization**: High-risk content always gets fact-checked
5. **Configurable Thresholds**: Risk scores and confidence thresholds can be tuned

## Monitoring & Tuning

1. **Track Overrides**: Log when validation overrides pre-check decisions
2. **False Positive Rate**: Monitor how many low-risk posts are fact-checked unnecessarily
3. **False Negative Rate**: Monitor how many high-risk posts are skipped
4. **Cost Metrics**: Track fact-checking costs and optimize thresholds
5. **A/B Testing**: Test different risk thresholds and confidence levels

## Implementation Priority

1. **High Priority**: Enhanced fallback heuristic (fail-open) - Fixes immediate issue
2. **High Priority**: Risk-based pre-check - Prevents high-risk posts from being skipped
3. **Medium Priority**: Confidence-based pre-check - Improves accuracy
4. **Low Priority**: Post-processing validation - Polish and edge cases

## Code Structure

```
functions/src/services/
├── factCheckPreCheckAgent.ts
│   ├── calculateContentRiskScore() [NEW]
│   ├── enhancedFallbackPreCheck() [ENHANCED]
│   ├── preCheckChirp() [MODIFIED]
│   └── validatePreCheckDecision() [NEW]
└── valuePipelineService.ts
    └── processChirpValue() [MODIFIED - uses risk-based flow]
```

## Next Steps

1. Review this proposal with the team
2. Start with Phase 1 (enhanced fallback heuristic)
3. Test with real posts to tune thresholds
4. Iterate based on results

