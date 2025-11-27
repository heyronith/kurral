# Value Scoring Calculation Improvements

## Current State
- ✅ Removed fallback method - only works when AI agent is available
- ✅ Returns `null` when agent unavailable (graceful degradation)
- ✅ Uses simple average: `total = (epistemic + insight + practical + relational + effort) / 5`

## Specific Improvement Recommendations

### 1. **Weighted Total Score Calculation**

**Current Issue**: All dimensions weighted equally (20% each)

**Improvement**: Use domain-specific weights based on post topic/type

```typescript
// In valueScoringAgent.ts
const getDimensionWeights = (chirp: Chirp, claims: Claim[]): Record<keyof ValueVector, number> => {
  const domain = dominantDomain(claims.map(c => c.domain)) || chirp.topic;
  
  // Health/Politics: Higher epistemic weight
  if (domain === 'health' || domain === 'politics') {
    return {
      epistemic: 0.35,  // 35% - most important
      insight: 0.25,   // 25%
      practical: 0.20, // 20%
      relational: 0.10, // 10%
      effort: 0.10     // 10%
    };
  }
  
  // Technology/Startups: Higher insight weight
  if (domain === 'technology' || chirp.topic === 'startups') {
    return {
      epistemic: 0.25,
      insight: 0.35,    // 35% - most important
      practical: 0.20,
      relational: 0.10,
      effort: 0.10
    };
  }
  
  // Productivity/Design: Higher practical weight
  if (chirp.topic === 'productivity' || chirp.topic === 'design') {
    return {
      epistemic: 0.20,
      insight: 0.25,
      practical: 0.35,  // 35% - most important
      relational: 0.10,
      effort: 0.10
    };
  }
  
  // Default weights
  return {
    epistemic: 0.30,
    insight: 0.25,
    practical: 0.20,
    relational: 0.15,
    effort: 0.10
  };
};

// Calculate weighted total
const weights = getDimensionWeights(chirp, claims);
const total = 
  vector.epistemic * weights.epistemic +
  vector.insight * weights.insight +
  vector.practical * weights.practical +
  vector.relational * weights.relational +
  vector.effort * weights.effort;
```

**Impact**: More accurate scores that reflect what matters most for each topic

---

### 2. **Incorporate Confidence into Total Score**

**Current Issue**: Confidence calculated but not used in total score

**Improvement**: Apply confidence as a multiplier or penalty

```typescript
// Option A: Multiplicative (confidence reduces score)
const baseTotal = /* weighted calculation above */;
const total = baseTotal * (0.5 + confidence * 0.5); // Scales between 50%-100% of base

// Option B: Penalty system (low confidence reduces score more)
const confidencePenalty = confidence < 0.5 ? (1 - confidence) * 0.3 : 0;
const total = baseTotal * (1 - confidencePenalty);

// Option C: Separate high/low confidence thresholds
const total = confidence > 0.7 
  ? baseTotal  // Full score if high confidence
  : baseTotal * (0.6 + confidence * 0.4); // Reduced if low confidence
```

**Impact**: Low-confidence scores are appropriately penalized

---

### 3. **Post Type Normalization**

**Current Issue**: Questions, jokes, and analyses scored the same way

**Improvement**: Detect post type and adjust scoring expectations

```typescript
// Add to buildSummary function
const detectPostType = (chirp: Chirp): 'question' | 'analysis' | 'opinion' | 'experience' | 'joke' | 'other' => {
  const text = chirp.text.toLowerCase();
  if (text.includes('?') && (text.match(/\?/g) || []).length >= 2) return 'question';
  if (text.match(/lol|haha|😂|😄/i)) return 'joke';
  if (text.match(/i think|i believe|in my opinion/i)) return 'opinion';
  if (text.match(/i did|i tried|i used|my experience/i)) return 'experience';
  if (text.length > 500 && claims.length > 2) return 'analysis';
  return 'other';
};

// Adjust scoring expectations in prompt
const postType = detectPostType(chirp);
const typeContext = {
  question: "This is a question post. Focus on relational value (engagement) and effort (clarity). Epistemic/practical less relevant.",
  joke: "This is a joke/humorous post. Focus on relational value. Epistemic/practical not applicable.",
  analysis: "This is an analytical post. Higher standards for epistemic, insight, and effort.",
  opinion: "This is an opinion post. Balance epistemic (factual basis) with insight (perspective).",
  experience: "This is an experience post. Focus on practical value and effort (detail)."
};

// Add to prompt
const prompt = `...\nPost type: ${postType}\n${typeContext[postType]}\n...`;
```

**Impact**: More appropriate scoring for different post types

---

### 4. **Enhanced Prompt with Examples**

**Current Issue**: No examples or calibration guidance for AI

**Improvement**: Add few-shot examples to prompt

```typescript
const EXAMPLES = `
Examples of scoring:

Example 1 (High epistemic, low insight):
Post: "The COVID-19 vaccine reduces hospitalization by 90% according to CDC data."
Epistemic: 0.95 (verified fact)
Insight: 0.20 (widely known)
Practical: 0.40 (somewhat actionable)
Relational: 0.50 (neutral)
Effort: 0.30 (minimal)
Total: 0.47

Example 2 (High insight, medium epistemic):
Post: "I've noticed that successful startups often pivot 2-3 times before finding product-market fit. Here's why..."
Epistemic: 0.60 (observation, not fully verified)
Insight: 0.85 (novel synthesis)
Practical: 0.75 (actionable)
Relational: 0.70 (constructive)
Effort: 0.80 (detailed)
Total: 0.74

Example 3 (Low epistemic, high relational):
Post: "Let's discuss: What's your biggest productivity hack?"
Epistemic: 0.20 (no claims)
Insight: 0.30 (minimal)
Practical: 0.50 (could be useful)
Relational: 0.90 (high engagement)
Effort: 0.40 (simple question)
Total: 0.46
`;

// Add to prompt
const prompt = `...\n${EXAMPLES}\n...`;
```

**Impact**: Better calibration and consistency in AI scoring

---

### 5. **Text Length Normalization**

**Current Issue**: Long posts may score higher on effort regardless of quality

**Improvement**: Use logarithmic scaling for text length

```typescript
// In buildSummary, add normalized length metric
const normalizedLength = Math.min(1, Math.log10(chirp.text.length / 50 + 1) / Math.log10(20));
// This scales: 50 chars = 0.5, 500 chars = 0.75, 5000 chars = 1.0

// Add to prompt context
const lengthContext = `Post length: ${chirp.text.length} chars (normalized: ${normalizedLength.toFixed(2)}). 
Effort should consider quality of content, not just length. A concise 200-word post can have more effort than a rambling 2000-word post.`;
```

**Impact**: Prevents length bias in effort scoring

---

### 6. **Fact Check Quality Weighting**

**Current Issue**: All fact checks treated equally regardless of source quality

**Improvement**: Weight epistemic score by fact check source quality

```typescript
// In scoreChirpValue, before calling AI
const factCheckQualityScore = factChecks.length > 0
  ? factChecks.reduce((sum, fc) => {
      const sourceQuality = fc.evidence?.reduce((max, e) => Math.max(max, e.quality || 0.5), 0) || 0.5;
      const verdictWeight = fc.verdict === 'true' ? 1.0 : fc.verdict === 'mixed' ? 0.5 : 0.2;
      return sum + (verdictWeight * fc.confidence * sourceQuality);
    }, 0) / factChecks.length
  : 0.3;

// Add to prompt
const factCheckContext = `Fact check quality score: ${factCheckQualityScore.toFixed(2)} (0-1 scale, higher = better sources and verification)`;
```

**Impact**: Better epistemic scores reflect source credibility

---

### 7. **Discussion Quality Impact on Relational Score**

**Current Issue**: Discussion quality calculated but not explicitly used in scoring guidance

**Improvement**: Provide discussion metrics directly to AI

```typescript
// Enhance buildSummary with discussion breakdown
const discussionBreakdown = discussion ? `
Discussion metrics:
- Informativeness: ${discussion.threadQuality.informativeness.toFixed(2)}
- Civility: ${discussion.threadQuality.civility.toFixed(2)}
- Reasoning depth: ${discussion.threadQuality.reasoningDepth.toFixed(2)}
- Cross-perspective: ${discussion.threadQuality.crossPerspective.toFixed(2)}
- Total comments: ${Object.keys(discussion.commentInsights).length}
- Summary: ${discussion.threadQuality.summary}

Relational score should strongly correlate with civility and cross-perspective metrics.
` : 'No discussion yet. Relational score based on post tone only.';
```

**Impact**: More accurate relational scoring based on actual discussion quality

---

### 8. **Calibration Check Against Human Ratings**

**Current Issue**: No validation that AI scores match human perception

**Improvement**: Add calibration layer (future enhancement)

```typescript
// Store calibration data
interface CalibrationData {
  postId: string;
  aiScore: ValueScore;
  humanRatings: Array<{ userId: string; scores: ValueVector; total: number }>;
  calibrationOffset: ValueVector; // Difference between AI and human average
}

// After scoring, if human ratings exist, apply calibration
const applyCalibration = (score: ValueScore, calibration?: CalibrationData): ValueScore => {
  if (!calibration) return score;
  
  // Adjust each dimension by calibration offset (weighted)
  const adjusted = {
    epistemic: clamp01(score.epistemic + calibration.calibrationOffset.epistemic * 0.3),
    insight: clamp01(score.insight + calibration.calibrationOffset.insight * 0.3),
    // ... etc
  };
  
  return { ...score, ...adjusted, total: /* recalculate */ };
};
```

**Impact**: Scores align better with human perception over time

---

### 9. **Confidence-Based Score Ranges**

**Current Issue**: All scores 0-1, but confidence not reflected in display

**Improvement**: Show confidence intervals

```typescript
// In ValueScore type, add confidence intervals
type ValueScore = ValueVector & {
  total: number;
  confidence: number;
  updatedAt: Date;
  drivers?: string[];
  // NEW:
  totalRange?: [number, number]; // [min, max] based on confidence
};

// Calculate range
const confidenceMargin = (1 - confidence) * 0.2; // Max 20% variance
const totalRange: [number, number] = [
  Math.max(0, total - confidenceMargin),
  Math.min(1, total + confidenceMargin)
];
```

**Impact**: Users understand score uncertainty

---

### 10. **Post-Specific Scoring Instructions**

**Current Issue**: Generic instructions for all posts

**Improvement**: Customize instructions based on post characteristics

```typescript
const getCustomInstructions = (chirp: Chirp, claims: Claim[], factChecks: FactCheck[]): string => {
  const instructions: string[] = [];
  
  // High-risk claims need stricter epistemic scoring
  if (claims.some(c => c.riskLevel === 'high')) {
    instructions.push('CRITICAL: This post contains high-risk claims. Epistemic score must be conservative. Penalize heavily if fact checks are missing or low confidence.');
  }
  
  // Many claims = higher effort expectation
  if (claims.length > 5) {
    instructions.push('This post has many claims. Effort score should reflect the depth of analysis required.');
  }
  
  // No claims = different scoring approach
  if (claims.length === 0) {
    instructions.push('No verifiable claims extracted. Focus scoring on insight, practical value, and relational aspects. Epistemic score should be neutral (0.5) unless post contains obvious misinformation.');
  }
  
  // All fact checks true = boost epistemic
  if (factChecks.length > 0 && factChecks.every(fc => fc.verdict === 'true')) {
    instructions.push('All fact checks verified as true. Epistemic score should be high (0.8+).');
  }
  
  return instructions.join('\n');
};

// Add to prompt
const customInstructions = getCustomInstructions(chirp, claims, factChecks);
const prompt = `...\n\nCustom Instructions:\n${customInstructions}\n...`;
```

**Impact**: More nuanced and appropriate scoring for edge cases

---

## Implementation Priority

1. **High Priority** (Immediate impact):
   - #1: Weighted total score calculation
   - #2: Incorporate confidence into total
   - #4: Enhanced prompt with examples

2. **Medium Priority** (Better accuracy):
   - #3: Post type normalization
   - #6: Fact check quality weighting
   - #7: Discussion quality impact

3. **Low Priority** (Nice to have):
   - #5: Text length normalization
   - #9: Confidence-based score ranges
   - #10: Post-specific instructions

4. **Future** (Requires infrastructure):
   - #8: Calibration check against human ratings

---

## Testing Recommendations

1. **A/B Testing**: Compare old vs. new scoring on same posts
2. **Correlation Analysis**: Check if new scores correlate better with engagement
3. **Edge Case Testing**: Test with questions, jokes, very long posts, posts with no claims
4. **User Feedback**: Collect user ratings on score accuracy

