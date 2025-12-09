# Fact-Checking Process Analysis: Ambiguous and Conflicting Evidence Cases

## Executive Summary

This analysis examines how the Dumbfeed fact-checking system handles posts that are neither clearly true nor false, and cases where there is conflicting evidence on the internet (e.g., accusations with evidence both supporting and contradicting them).

**Key Finding**: The system does NOT automatically block posts with ambiguous or conflicting evidence. Instead, it uses a risk-based approach where:
- **High-risk claims** (health, finance, politics) with mixed/conflicting evidence → marked as `needs_review`
- **Non-high-risk claims** with mixed/conflicting evidence → approved with `clean` status
- **Unknown/unverifiable claims** → marked as `needs_review`

**Critical Note**: Posts with `needs_review` or `blocked` status are **still visible** in feeds - they are not filtered out. They are displayed with visual indicators (colored borders) to alert users.

---

## Fact-Check Verdict Types

The system supports four possible verdicts for each claim (defined in `src/webapp/lib/services/factCheckAgent.ts`):

1. **`'true'`** - Claim is verified as true
2. **`'false'`** - Claim is verified as false
3. **`'mixed'`** - Conflicting evidence exists (evidence both supporting and contradicting the claim)
4. **`'unknown'`** - Cannot be verified (insufficient information found)

These verdicts are determined by the fact-checking agent which uses web search to find evidence. The agent is instructed to return `"mixed"` when it finds evidence both supporting and contradicting a claim.

---

## Policy Evaluation Logic

The policy engine (`src/webapp/lib/services/policyEngine.ts`) evaluates fact-check verdicts and assigns a final status to posts:

### Status Types
- **`'clean'`** - Post is approved and verified
- **`'needs_review'`** - Post requires human review
- **`'blocked'`** - Post is blocked (only for false claims with high confidence)

### Decision Rules (from `evaluatePolicy()` function)

1. **False Claims (High Confidence)**
   - Condition: `verdict === 'false' && confidence > 0.7`
   - Result: Status = `'blocked'`
   - Action: Post is blocked, escalated to human review

2. **Mixed Evidence - High-Risk Claims**
   - Condition: `isHighRiskClaim(claim) && verdict === 'mixed'`
   - Result: Status = `'needs_review'`
   - Action: Post marked for review, escalated to human
   - **High-risk domains**: `['health', 'finance', 'politics']`
   - **High-risk also includes**: Claims with `riskLevel === 'high'`

3. **Mixed Evidence - Non-High-Risk Claims**
   - Condition: `!isHighRiskClaim(claim) && verdict === 'mixed'`
   - Result: Status = `'clean'` (remains unchanged)
   - Action: Post is **approved** and visible normally
   - **This means**: Accusations or claims in non-high-risk domains (e.g., entertainment, sports, general news) with conflicting evidence are **approved by default**

4. **Unknown/Unverifiable Claims**
   - Condition: `verdict === 'unknown'`
   - Result: Status = `'needs_review'` (if currently `'clean'`)
   - Action: Post marked for review

5. **True Claims**
   - Condition: `verdict === 'true'`
   - Result: Status = `'clean'` (remains unchanged)
   - Action: Post approved

6. **No Fact Check Available**
   - Condition: No fact-check found for claim
   - Result: 
     - If high-risk claim → Status = `'needs_review'`
     - If non-high-risk claim → Status remains `'clean'`

---

## What Happens to Posts Based on Status

### Posts with `'clean'` Status
- **Visibility**: Fully visible in all feeds
- **Visual Indicator**: Green border (in `ChirpCard.tsx`)
- **User Experience**: Normal display, no warnings

### Posts with `'needs_review'` Status
- **Visibility**: **Still visible** in feeds (NOT filtered out)
- **Visual Indicator**: Yellow border (in `ChirpCard.tsx`)
- **User Experience**: 
  - Status badge shows "Needs Review"
  - Users can click to see fact-check details
  - Non-author users can submit review context (validate or flag)
  - Post remains visible while awaiting review

### Posts with `'blocked'` Status
- **Visibility**: **Still visible** in feeds (NOT filtered out)
- **Visual Indicator**: Red border (in `ChirpCard.tsx`)
- **User Experience**: 
  - Status badge shows "Blocked"
  - Post is marked as containing false information
  - Post remains visible (not hidden from feeds)

**Important**: The feed algorithm (`src/webapp/lib/algorithm.ts`) does **NOT** filter posts based on `factCheckStatus`. All posts are eligible for display regardless of their fact-check status.

---

## Specific Scenarios

### Scenario 1: Accusation with Conflicting Evidence (Non-High-Risk Domain)

**Example**: "John Doe stole my idea" (posted in general/entertainment context)

**Process**:
1. Claim is extracted from post
2. Fact-checking agent searches web, finds:
   - Evidence supporting the accusation
   - Evidence contradicting the accusation
3. Agent returns verdict: `'mixed'` with evidence from both sides
4. Policy evaluation:
   - Domain is NOT health/finance/politics
   - Risk level is likely not 'high'
   - Result: Status = `'clean'` (approved)
5. **Post is approved and visible** with normal display

### Scenario 2: Accusation with Conflicting Evidence (High-Risk Domain)

**Example**: "Politician X accepted bribes" (posted in politics context)

**Process**:
1. Claim is extracted from post
2. Fact-checking agent searches web, finds conflicting evidence
3. Agent returns verdict: `'mixed'`
4. Policy evaluation:
   - Domain is 'politics' (high-risk)
   - Result: Status = `'needs_review'`
   - Escalated to human review
5. **Post is visible** with yellow border and "Needs Review" badge
6. Users can submit review context to validate or flag

### Scenario 3: Unverifiable Claim

**Example**: "There's a secret government program" (insufficient evidence found)

**Process**:
1. Claim is extracted
2. Fact-checking agent searches web, finds insufficient information
3. Agent returns verdict: `'unknown'`
4. Policy evaluation:
   - Result: Status = `'needs_review'`
5. **Post is visible** with yellow border and "Needs Review" badge

### Scenario 4: Post with No Extractable Claims

**Example**: "Beautiful sunset today!" (opinion/observation, no factual claim)

**Process**:
1. Claim extraction finds no claims
2. Policy evaluation:
   - No claims → Status = `'clean'`
3. **Post is approved** (no fact-checking needed)

---

## Key Insights

### 1. Mixed Evidence Handling is Domain-Dependent
- **High-risk domains** (health, finance, politics): Mixed evidence triggers review
- **Other domains**: Mixed evidence results in approval
- This creates an asymmetry where the same type of conflicting evidence is handled differently based on topic

### 2. Posts Are Never Automatically Hidden
- Unlike some platforms that hide disputed content, Dumbfeed keeps all posts visible
- Status is communicated through visual indicators (colored borders) and badges
- Users can see fact-check details and make informed decisions

### 3. Human Review is Escalated, Not Automatic
- Posts marked `needs_review` are escalated (`escalateToHuman = true`)
- However, the system doesn't automatically hide them pending review
- Users can submit review context to help resolve ambiguous cases

### 4. Confidence Threshold Only for Blocking
- Only `false` verdicts with `confidence > 0.7` result in blocking
- Mixed and unknown verdicts don't use confidence thresholds for blocking
- This means even high-confidence mixed evidence won't block a post (only triggers review for high-risk)

### 5. No Fact-Check vs. Unknown Verdict
- If no fact-check is performed (e.g., agent unavailable): Non-high-risk claims remain `clean`
- If fact-check returns `unknown`: Status becomes `needs_review`
- This creates a difference where unverified claims (unknown) are treated more strictly than uncheckable claims (no fact-check)

---

## Code References

### Policy Evaluation
- **File**: `src/webapp/lib/services/policyEngine.ts`
- **Function**: `evaluatePolicy(claims: Claim[], factChecks: FactCheck[])`
- **Lines**: 19-69

### Fact-Check Verdict Schema
- **File**: `src/webapp/lib/services/factCheckAgent.ts`
- **Lines**: 22-46 (FACT_CHECK_SCHEMA)
- **Verdict enum**: `['true', 'false', 'mixed', 'unknown']`

### High-Risk Domain Definition
- **File**: `src/webapp/lib/services/policyEngine.ts`
- **Line**: 9
- **Domains**: `['health', 'finance', 'politics']`

### Post Visibility (No Filtering)
- **File**: `src/webapp/lib/algorithm.ts`
- **Function**: `isChirpEligibleForViewer()`
- **Note**: No check for `factCheckStatus` in eligibility logic

### Visual Indicators
- **File**: `src/webapp/components/ChirpCard.tsx`
- **Function**: `getCardStyling()`
- **Lines**: 199-252
- **Status colors**: Green (clean), Yellow (needs_review), Red (blocked)

---

## Recommendations for Consideration

1. **Consistent Mixed Evidence Handling**: Consider whether mixed evidence should always trigger review, regardless of domain, or if the current domain-based approach is intentional.

2. **Confidence Thresholds for Mixed**: Consider using confidence levels for mixed verdicts to determine severity (e.g., high-confidence mixed evidence might warrant blocking for high-risk claims).

3. **Visibility Policy**: Consider whether `blocked` posts should be hidden from feeds or remain visible with warnings (current behavior).

4. **Unknown vs. No Fact-Check**: The difference in handling between "no fact-check performed" and "unknown verdict" might be worth standardizing.

5. **User Education**: Since posts remain visible regardless of status, ensure users understand what the colored borders and badges mean.

---

## Conclusion

The fact-checking system uses a nuanced, risk-based approach to handle ambiguous and conflicting evidence:

- **Non-high-risk claims** with mixed evidence are **approved** (`clean` status)
- **High-risk claims** with mixed evidence are **flagged for review** (`needs_review` status)
- **Unverifiable claims** are **flagged for review** (`needs_review` status)
- **All posts remain visible** regardless of status, with visual indicators to inform users

This approach prioritizes transparency (posts remain visible) while using domain-based risk assessment to determine when human review is necessary.
