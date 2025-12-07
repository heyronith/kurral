# Fact-Checking Edge Cases Analysis

## Executive Summary

This document identifies all edge cases where posts might miss the fact-checking process in the Dumbfeed codebase. The analysis is based on actual codebase review and identifies 9 critical edge cases.

---

## Fact-Checking Flow Overview

The fact-checking process is triggered through the following flow:

1. **Post Creation**: `addChirp()` in `useFeedStore.ts` (line 47-88)
2. **Value Pipeline**: `processChirpValue()` is called asynchronously (line 73)
3. **Claim Extraction**: `extractClaimsForChirp()` extracts claims from post text
4. **Fact Checking**: `factCheckClaims()` is called only if claims are found (line 108-116)
5. **Policy Evaluation**: `evaluatePolicy()` determines final fact-check status

**Critical Finding**: Fact-checking only occurs if:
- `processChirpValue()` is called
- Claim extraction succeeds and returns claims
- Fact-checking agent is available

---

## Edge Cases Identified

### 1. **Scheduled Posts Never Get Fact-Checked** ⚠️ CRITICAL

**Location**: `src/webapp/lib/firestore.ts` lines 867-899

**Issue**: When scheduled posts are published via `processScheduledPosts()`, they only remove the `scheduledAt` field but **never trigger `processChirpValue()`**.

```typescript
async processScheduledPosts(authorId?: string | null): Promise<void> {
  // ... queries scheduled posts
  // ... removes scheduledAt field
  // ❌ NO CALL TO processChirpValue()
}
```

**Impact**: All scheduled posts bypass fact-checking entirely.

**Trigger**: 
- User schedules a post
- Post is published when `scheduledAt <= now`
- Called from `ChirpApp.tsx` every 5 minutes (line 226, 231)

**Fix Required**: After removing `scheduledAt`, trigger `processChirpValue()` for each published post.

---

### 2. **Scripts Create Posts Without Fact-Checking** ⚠️ CRITICAL

**Location**: Multiple script files in `/scripts/` directory

**Files Affected**:
- `create-5-users-with-posts.js` (line 302-345)
- `test-platform-comprehensive.js` (line 346-379)
- `test-news-generation.js` (line 141)
- `test-persistence.js` (line 66)
- `test-semantic-topics-migration.js` (line 273, 707)

**Issue**: Scripts use `addDoc(collection(db, 'chirps'), chirpData)` directly, bypassing:
- `chirpService.createChirp()`
- `useFeedStore.addChirp()`
- `processChirpValue()`

**Impact**: All test/seed data posts are never fact-checked.

**Example**:
```javascript
// scripts/create-5-users-with-posts.js:314
const docRef = await addDoc(collection(db, 'chirps'), chirpData);
// ❌ No fact-checking triggered
```

**Fix Required**: Scripts should use `chirpService.createChirp()` or manually call `processChirpValue()`.

---

### 3. **Empty Text Posts Skip Fact-Checking** ⚠️ HIGH

**Location**: `src/webapp/lib/services/claimExtractionAgent.ts` line 117-119

**Issue**: If post text is empty or whitespace-only, claim extraction returns empty array, which skips fact-checking.

```typescript
export async function extractClaimsForChirp(chirp: Chirp): Promise<Claim[]> {
  if (!chirp.text?.trim()) {
    return []; // ❌ Returns empty, no fact-checking
  }
  // ...
}
```

**Impact**: Posts with only images, links, or whitespace are never fact-checked.

**Note**: This might be intentional for image-only posts, but should be documented.

---

### 4. **Claim Extraction Failure Skips Fact-Checking** ⚠️ HIGH

**Location**: `src/webapp/lib/services/valuePipelineService.ts` lines 97-116

**Issue**: If claim extraction fails or returns no claims, fact-checking is skipped entirely.

```typescript
const claimsResult = await safeExecute('claim extraction', () =>
  withRetry(() => extractClaimsForChirp(chirp), 'claim extraction')
);

if (claimsResult && claimsResult.length > 0) {
  insights.claims = claimsResult;
}

// ❌ If no claims, fact-checking is skipped
if (claimsForScoring().length > 0) {
  const factChecksResult = await safeExecute('fact checking', () =>
    withRetry(() => factCheckClaims(chirp, claimsForScoring()), 'fact checking')
  );
}
```

**Failure Scenarios**:
- API errors (CORS, network, rate limits)
- AI agent unavailable
- Malformed post text
- Extraction returns empty array

**Impact**: Posts with extractable claims that fail extraction are never fact-checked.

---

### 5. **Asynchronous Processing Can Fail Silently** ⚠️ HIGH

**Location**: `src/webapp/store/useFeedStore.ts` lines 73-81

**Issue**: `processChirpValue()` is called asynchronously with `.then().catch()`. If it fails, error is only logged.

```typescript
processChirpValue(newChirp)
  .then((enrichedChirp) => {
    // Update state
  })
  .catch((error) => {
    console.error('[ValuePipeline] Failed to enrich chirp:', error);
    // ❌ No retry, no notification, fact-checking silently fails
  });
```

**Failure Scenarios**:
- Network errors during processing
- Firestore write failures
- Service unavailability
- Timeout errors

**Impact**: Fact-checking failures are silent and posts remain unchecked.

---

### 6. **BaseAgent Unavailability Uses Fallback** ⚠️ MEDIUM

**Location**: 
- `src/webapp/lib/services/claimExtractionAgent.ts` lines 121-123
- `src/webapp/lib/services/factCheckAgent.ts` lines 374-376

**Issue**: When `BaseAgent.isAvailable()` returns false, fallback functions are used that may not extract claims properly.

```typescript
// claimExtractionAgent.ts
if (!BaseAgent.isAvailable()) {
  return fallbackExtract(chirp); // ❌ May return empty array
}

// factCheckAgent.ts
if (!BaseAgent.isAvailable()) {
  return claims.map(fallbackFactCheck); // ❌ Always returns 'unknown' verdict
}
```

**Impact**: 
- Fallback claim extraction may miss claims
- Fallback fact-checking always returns 'unknown' verdict
- Posts may get incorrect 'clean' status when they should be reviewed

**Trigger**: 
- Missing API keys
- API service down
- Configuration errors

---

### 7. **Rechirps May Not Inherit Fact-Checking** ⚠️ MEDIUM

**Location**: `src/webapp/components/Composer.tsx` line 898, `useFeedStore.ts` line 47

**Issue**: When creating a rechirp (repost), the new post goes through normal creation flow, but:
- Original post's fact-check status is not copied
- Rechirp is treated as new post and must be fact-checked again
- If fact-checking fails for rechirp, it has no status

**Impact**: Rechirps of fact-checked posts may appear without fact-check status if processing fails.

**Note**: This might be intentional (rechirps should be re-checked), but should be verified.

---

### 8. **Error Handling Swallows Fact-Check Failures** ⚠️ MEDIUM

**Location**: `src/webapp/lib/services/valuePipelineService.ts` lines 88-95

**Issue**: `safeExecute()` catches all errors and returns `undefined`, which silently skips fact-checking.

```typescript
const safeExecute = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    console.error(`[ValuePipeline] ${label} failed:`, error);
    return undefined; // ❌ Silently fails
  }
};
```

**Impact**: Any error in the fact-checking pipeline (network, API, parsing) results in no fact-checking without user notification.

---

### 9. **Policy Engine Returns 'clean' for No Claims** ⚠️ LOW (By Design)

**Location**: `src/webapp/lib/services/policyEngine.ts` lines 19-26

**Issue**: If no claims are extracted, policy engine automatically returns 'clean' status.

```typescript
export function evaluatePolicy(claims: Claim[], factChecks: FactCheck[]): PolicyDecision {
  if (claims.length === 0) {
    return {
      status: 'clean', // ❌ Auto-clean for no claims
      reasons: ['No extractable claims'],
      escalateToHuman: false,
    };
  }
  // ...
}
```

**Impact**: Posts that should be reviewed but fail claim extraction get 'clean' status.

**Note**: This appears to be by design, but creates a gap where posts with problematic content that can't be parsed get marked as clean.

---

## Summary Statistics

| Severity | Count | Edge Cases |
|----------|-------|------------|
| **CRITICAL** | 2 | Scheduled posts, Script-created posts |
| **HIGH** | 3 | Empty text, Claim extraction failure, Async failures |
| **MEDIUM** | 3 | BaseAgent fallback, Rechirps, Error handling |
| **LOW** | 1 | Policy engine no-claims behavior |

**Total Edge Cases**: 9

---

## Recommendations

### Immediate Fixes (Critical)

1. **Fix Scheduled Posts**: Modify `processScheduledPosts()` to trigger `processChirpValue()` after publishing
2. **Fix Scripts**: Update all test scripts to use `chirpService.createChirp()` or manually trigger fact-checking

### High Priority Fixes

3. **Add Retry Logic**: Implement retry mechanism for failed `processChirpValue()` calls
4. **Improve Error Handling**: Add user notifications for fact-checking failures
5. **Handle Empty Claims**: Consider fact-checking image-only posts based on metadata

### Medium Priority Improvements

6. **Monitor Fallback Usage**: Log when fallback functions are used and alert on high usage
7. **Rechirp Handling**: Document and verify rechirp fact-checking behavior
8. **Better Error Reporting**: Add structured error logging for fact-checking pipeline

---

## Code References

### Key Files

- `src/webapp/store/useFeedStore.ts` - Post creation entry point
- `src/webapp/lib/services/valuePipelineService.ts` - Fact-checking orchestration
- `src/webapp/lib/services/claimExtractionAgent.ts` - Claim extraction
- `src/webapp/lib/services/factCheckAgent.ts` - Fact-checking execution
- `src/webapp/lib/firestore.ts` - Scheduled posts processing
- `scripts/*.js` - Test scripts that bypass fact-checking

### Key Functions

- `addChirp()` - Creates post and triggers fact-checking
- `processChirpValue()` - Main fact-checking pipeline
- `extractClaimsForChirp()` - Extracts claims from post
- `factCheckClaims()` - Performs fact-checking
- `processScheduledPosts()` - Publishes scheduled posts (missing fact-checking)

---

## Testing Recommendations

1. **Test Scheduled Posts**: Verify fact-checking triggers after publishing
2. **Test Error Scenarios**: Simulate API failures and verify behavior
3. **Test Empty Claims**: Verify posts with no extractable claims
4. **Test Fallback Mode**: Test behavior when BaseAgent is unavailable
5. **Test Script Posts**: Verify test data gets fact-checked

---

*Analysis Date: 2024*
*Codebase Version: Current main branch*

