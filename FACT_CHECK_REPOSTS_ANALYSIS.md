# Fact-Checking for Reposts: Problems & Solutions

## Executive Summary

This document identifies critical issues with how fact-checking is handled for reposts (rechirps and quoted posts) and provides actionable solutions. Currently, the system treats all reposts as new posts, leading to duplicate work, resource waste, and potential inconsistencies.

---

## Problems Identified

### 1. Rechirps (Simple Reposts)

- **Problem**: Rechirps re-run fact-checking on identical text, duplicating work unnecessarily
- **Problem**: No inheritance of original post's fact-check data
- **Problem**: Rechirps may show different statuses than the original post
- **Problem**: Wastes API calls and processing time

### 2. Quoted Posts

- **Problem**: Only user's new text is fact-checked; original post's claims are ignored
- **Problem**: Original post's fact-check status is not considered
- **Problem**: Risk of false negatives if original had problematic claims

### 3. System Architecture

- **Problem**: No check for `rechirpOfId` or `quotedChirpId` in fact-checking logic
- **Problem**: No deduplication for identical text content
- **Problem**: No coordination between original and repost processing
- **Problem**: Fact-check prompts don't indicate if content is reposted

---

## Solutions

### 1. Rechirps - Inherit Original Fact-Check Data

- **Solution**: Check for `rechirpOfId` before running fact-checking
- **Solution**: If original has fact-check data, copy `claims`, `factChecks`, and `factCheckStatus` to rechirp
- **Solution**: Skip claim extraction and fact-checking if original data exists
- **Solution**: If original is still processing, wait or mark rechirp as pending

### 2. Quoted Posts - Check Both Texts

- **Solution**: Extract claims from both user's new text AND original post's text
- **Solution**: Fact-check all claims (new + original)
- **Solution**: Combine fact-check results and evaluate policy on combined set
- **Solution**: If original has existing fact-checks, reuse them; only check new claims

### 3. Deduplication

- **Solution**: Create text-content hash cache for fact-check results
- **Solution**: Before fact-checking, check if identical text was already checked
- **Solution**: Reuse cached results for identical content

### 4. Context Awareness

- **Solution**: Update fact-check prompts to indicate if content is reposted
- **Solution**: Include original post's fact-check status in prompt context
- **Solution**: Add logic in `processChirpValue` to detect reposts and handle accordingly

### 5. Status Synchronization

- **Solution**: When original post's status changes, update all related rechirps
- **Solution**: Use Firestore listeners or triggers to sync status updates
- **Solution**: Display note that repost inherits status from original

### 6. Implementation Priority

- **Priority 1**: Rechirp inheritance (copy fact-check data from original)
- **Priority 2**: Quoted post handling (check both texts)
- **Priority 3**: Deduplication cache (avoid duplicate work)
- **Priority 4**: Status synchronization (keep reposts in sync with originals)

### 7. Code Changes Needed

- Modify `processChirpValue` to check for `rechirpOfId`/`quotedChirpId`
- Add function to fetch and copy original post's fact-check data
- Update `extractClaimsForChirp` to handle quoted posts (extract from both texts)
- Add text-content hash cache for deduplication
- Update fact-check prompts to include repost context

---

## Technical Implementation Details

### Rechirp Inheritance Flow

1. **Detection**: Check if `chirp.rechirpOfId` exists in `processChirpValue`
2. **Fetch Original**: Load original post from Firestore
3. **Check Status**: If original has `factCheckStatus`, `claims`, and `factChecks`
4. **Copy Data**: Copy fact-check data to rechirp
5. **Skip Processing**: Skip claim extraction and fact-checking
6. **Update Status**: Set rechirp's `factCheckStatus` to match original

### Quoted Post Handling Flow

1. **Detection**: Check if `chirp.quotedChirpId` exists
2. **Fetch Original**: Load original post from Firestore
3. **Extract Claims**: Extract claims from both:
   - User's new text (from `chirp.text`)
   - Original post's text (from `quotedChirp.text`)
4. **Fact-Check Strategy**:
   - Reuse original's fact-checks for original's claims
   - Only fact-check new claims from user's text
5. **Combine Results**: Merge fact-check results
6. **Policy Evaluation**: Evaluate policy on combined claim set

### Deduplication Cache

1. **Hash Generation**: Create SHA-256 hash of post text content
2. **Cache Lookup**: Check if hash exists in cache (Firestore collection or in-memory)
3. **Cache Hit**: If found, reuse fact-check results
4. **Cache Miss**: Run fact-checking and store results with hash
5. **Cache Invalidation**: Clear cache when fact-check results are updated

---

## Expected Benefits

### Efficiency

- **Reduced API Calls**: Rechirps won't trigger duplicate fact-checking
- **Faster Processing**: Rechirps get instant status from original
- **Cost Savings**: Eliminate redundant fact-checking operations

### Accuracy

- **Consistency**: Rechirps always match original post's status
- **Complete Coverage**: Quoted posts check both original and new content
- **Better Context**: Fact-checking aware of repost context

### User Experience

- **Instant Status**: Rechirps show status immediately
- **Transparency**: Users see that repost inherits from original
- **Reliability**: No discrepancies between original and repost statuses

---

## Edge Cases to Handle

### 1. Original Post Still Processing

- **Scenario**: User rechirps while original is fact-checking
- **Solution**: Mark rechirp as pending, wait for original to complete, then copy results

### 2. Original Post Deleted

- **Scenario**: Original post is deleted after rechirp is created
- **Solution**: Keep rechirp's inherited fact-check data, don't re-check

### 3. Original Post Status Changes

- **Scenario**: Original post's status changes after rechirp inherits it
- **Solution**: Implement status synchronization to update rechirps

### 4. Quoted Post with No New Claims

- **Scenario**: User's new text has no extractable claims
- **Solution**: Only use original post's fact-check data

### 5. Multiple Rechirps

- **Scenario**: Original post has many rechirps
- **Solution**: All rechirps inherit same data, sync status updates to all

---

## Testing Checklist

- [ ] Rechirp inherits original's fact-check data
- [ ] Rechirp skips claim extraction and fact-checking
- [ ] Quoted post extracts claims from both texts
- [ ] Quoted post reuses original's fact-checks
- [ ] Deduplication cache works for identical text
- [ ] Status synchronization updates rechirps
- [ ] Edge cases handled correctly
- [ ] Performance improvement measured
- [ ] Cost reduction verified

---

## Code References

- **Value Pipeline**: `src/webapp/lib/services/valuePipelineService.ts`
- **Claim Extraction**: `src/webapp/lib/services/claimExtractionAgent.ts`
- **Fact-Checking**: `src/webapp/lib/services/factCheckAgent.ts`
- **Chirp Creation**: `src/webapp/store/useFeedStore.ts`
- **Chirp Service**: `src/webapp/lib/firestore.ts` (chirpService)

---

## Related Documents

- `FACT_CHECK_EDGE_CASES_ANALYSIS.md` - Other fact-checking edge cases
- `FACT_CHECK_PERSISTENCE_SOLUTION.md` - Fact-checking persistence mechanism
- `REVIEW_SYSTEM_PRODUCTION_READINESS.md` - Review system analysis
