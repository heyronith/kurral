# Fact-Check Pre-Check Gate Implementation

## Overview

This document describes the implementation of a pre-check gate system that determines whether content needs fact-checking before running expensive fact-checking operations. This saves API costs and improves efficiency by filtering out content that doesn't contain verifiable factual claims.

## Implementation Summary

### 1. Pre-Check Agent (`factCheckPreCheckAgent.ts`)

A new agent service that analyzes content and determines if it needs fact-checking.

**Key Functions:**
- `preCheckChirp(chirp: Chirp)`: Pre-checks posts
- `preCheckComment(comment: Comment)`: Pre-checks comments/replies
- `preCheckText(text: string, imageUrl?: string)`: Pre-checks plain text (for quoted posts)

**Decision Criteria:**
- ✅ **Needs Fact-Check**: Verifiable factual claims, health/medical claims, scientific claims, news-like statements, statistical data, etc.
- ❌ **Skip Fact-Check**: Pure opinions, personal experiences, questions, emotions, general conversation, etc.

**Returns:**
```typescript
{
  needsFactCheck: boolean;
  confidence: number;
  reasoning: string;
  contentType: 'factual_claim' | 'opinion' | 'experience' | 'question' | 'emotion' | 'conversation' | 'mixed' | 'other';
}
```

### 2. Integration into Value Pipeline (`valuePipelineService.ts`)

**For Posts (Chirps):**
1. Pre-check gate runs BEFORE claim extraction
2. If pre-check says "skip", fact-checking is skipped entirely
3. If pre-check says "needs fact-check", normal flow continues
4. Handles rechirps (inherits original's fact-check data)
5. Handles quoted posts (extracts claims from both user's text AND quoted post's text)

**For Comments:**
1. Pre-check gate runs for each comment
2. If pre-check says "needs fact-check", extracts claims and fact-checks
3. Comment fact-checks are considered in value scoring and reputation calculations

### 3. Claim Extraction Updates (`claimExtractionAgent.ts`)

**New Function:**
- `extractClaimsForComment(comment: Comment)`: Extracts claims from comments/replies

**Updated Function:**
- `extractClaimsForChirp(chirp: Chirp, quotedChirp?: Chirp)`: Now accepts optional quoted chirp parameter
  - When quoted chirp is provided, extracts claims from BOTH user's text and quoted post's text
  - Handles images from both sources

### 4. Repost Handling (Rechirps)

**Optimization:**
- Rechirps check if original post has fact-check data
- If original has data, inherits it directly (no duplicate work)
- If original doesn't have data, runs pre-check on original to determine if needed
- Saves API costs by avoiding duplicate fact-checking

### 5. Quoted Posts Handling

**Enhanced Coverage:**
- Pre-checks both user's new text AND quoted post's text
- Extracts claims from both sources
- Fact-checks all claims together
- Ensures quoted misinformation is caught

## Flow Diagram

### Regular Post Flow
```
Post Created
  ↓
Pre-Check Gate
  ↓
├─→ Needs Fact-Check? YES → Extract Claims → Fact-Check → Continue Pipeline
└─→ Needs Fact-Check? NO → Skip Fact-Checking → Mark as 'clean' → Continue Pipeline
```

### Rechirp Flow
```
Rechirp Created
  ↓
Fetch Original Post
  ↓
├─→ Original has fact-check data? YES → Inherit Data → Skip Processing
└─→ Original has fact-check data? NO → Pre-Check Original → Continue if needed
```

### Quoted Post Flow
```
Quoted Post Created
  ↓
Pre-Check User's Text
  ↓
Fetch Quoted Post
  ↓
Pre-Check Quoted Post Text
  ↓
Extract Claims from BOTH texts
  ↓
Fact-Check All Claims
```

### Comment Flow
```
Comment Created
  ↓
Pre-Check Comment
  ↓
├─→ Needs Fact-Check? YES → Extract Claims → Fact-Check → Update Scoring
└─→ Needs Fact-Check? NO → Skip Fact-Checking → Continue Discussion Analysis
```

## Benefits

1. **Cost Savings**: Skip unnecessary fact-checking for opinions, experiences, etc.
2. **Better Scoring**: Don't penalize non-factual content with fact-check scores
3. **Faster Processing**: Early exit for content that doesn't need verification
4. **Complete Coverage**: Now fact-checks comments AND quoted posts properly
5. **Efficiency**: Rechirps inherit data instead of duplicating work

## Files Modified

1. `src/webapp/lib/services/factCheckPreCheckAgent.ts` - NEW: Pre-check agent service
2. `src/webapp/lib/services/valuePipelineService.ts` - Updated: Integrated pre-check gate
3. `src/webapp/lib/services/claimExtractionAgent.ts` - Updated: Added comment extraction and quoted post support

## Testing Recommendations

1. Test pre-check with various content types (opinions, facts, mixed)
2. Test rechirp inheritance of fact-check data
3. Test quoted posts extracting claims from both texts
4. Test comments going through pre-check and fact-checking
5. Verify cost savings (measure API calls before/after)

## Configuration

The pre-check uses `gpt-4o-mini` for cost efficiency (pre-check should be fast and cheap).

Confidence threshold can be adjusted in the pre-check agent if needed (currently uses agent's confidence directly).

## Edge Cases Handled

1. **Rechirp of post without fact-check data**: Runs pre-check on original to determine if needed
2. **Quoted post with no new text**: Still extracts from quoted post text
3. **Agent unavailable**: Falls back to heuristic detection
4. **Mixed content**: If content has both opinion and facts, marks as "needs fact-check"
5. **Original post deleted after rechirp**: Rechirp keeps inherited data

## Future Enhancements

1. Cache pre-check results for identical text content
2. Learn from user feedback to improve pre-check accuracy
3. Adjust confidence thresholds based on domain (e.g., health content always fact-check)
4. Store pre-check results on content for audit trail

