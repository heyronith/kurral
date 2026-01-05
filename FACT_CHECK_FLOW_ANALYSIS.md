# Fact-Checking Flow Analysis

## Overview
This document describes the current fact-checking flow when a post goes live, for both webapp and mobile app.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        POST CREATION                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User Creates Post (Mobile/Webapp)                                │
│    - Composer component                                              │
│    - handlePost() → addChirp(chirpData)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Save to Firestore                                                 │
│    - chirpService.createChirp()                                     │
│    - Creates document in 'chirps' collection                        │
│    - Sets factCheckingStatus: 'pending'                             │
│    - Sets factCheckingStartedAt: Timestamp.now()                    │
│    - Returns newChirp object                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Update Local State (Immediate UI Update)                         │
│    - Post appears in feed immediately                               │
│    - No fact-check badge yet (factCheckStatus not set)              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Trigger Value Pipeline (Asynchronous)                            │
│    - processChirpValue(newChirp) called                             │
│    - Both mobile & webapp: Calls Firebase Cloud Function            │
│    - httpsCallable(functions, 'processChirpValue')                  │
│    - Fire-and-forget (doesn't block UI)                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  FIREBASE CLOUD FUNCTION (Server-Side)               │
│                  functions/src/index.ts:processChirpValue            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Mark as In Progress                                              │
│    - saveChirpProgress(chirpId, {}, 'in_progress')                 │
│    - Updates Firestore: factCheckingStatus: 'in_progress'           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Pre-Check (factCheckPreCheckAgent)                               │
│    - preCheckChirp(chirp)                                           │
│    - Uses OpenAI to determine if post needs fact-checking           │
│    - Returns: { needsFactCheck: boolean, contentType: string }      │
│    - If !needsFactCheck: Skip to step 10 (mark as 'clean')         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                        ┌─────┴─────┐
                        │           │
                    needsFactCheck  │
                    = true?         │
                        │           │
                   ┌────┴────┐      │
                   │   YES   │      │
                   └────┬────┘      │
                        │           │
                        │      ┌────┴────┐
                        │      │   NO    │
                        │      └────┬────┘
                        │           │
                        ▼           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Extract Claims (claimExtractionAgent)                            │
│    - extractClaimsForChirp(chirp, undefined)                        │
│    - Uses OpenAI to extract verifiable claims                       │
│    - Handles text + images (vision model if imageUrl present)       │
│    - Returns: Claim[]                                               │
│    - Saves: insights.claims = claimsResult                          │
│    - Updates Firestore: saveChirpProgress(..., { claims }, ...)    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. Fact-Check Claims (factCheckAgent)                               │
│    - factCheckClaims(chirp, claims)                                 │
│    - For each claim, uses OpenAI to verify                          │
│    - Optionally uses web search for evidence                        │
│    - Returns: FactCheck[]                                           │
│    - Each FactCheck has: verdict, confidence, evidence, caveats     │
│    - Saves: insights.factChecks = factChecksResult                  │
│    - Updates Firestore: saveChirpProgress(..., { factChecks }, ...) │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. Policy Evaluation (policyEngine)                                 │
│    - evaluatePolicy(claims, factChecks)                             │
│    - Determines final status based on fact-check results            │
│    - Returns: { status: 'clean' | 'needs_review' | 'blocked' }     │
│    - Saves: insights.factCheckStatus = policyDecision.status        │
│    - Updates Firestore: saveChirpProgress(..., { factCheckStatus }) │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 10. Value Scoring (valueScoringAgent)                               │
│     - scoreChirpValue(chirp, claims, factChecks, discussion)        │
│     - Calculates epistemic, insight, practical, relational, effort  │
│     - Returns: ValueScore                                           │
│     - Saves: insights.valueScore = latestValueScore                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 11. Discussion Quality Analysis (discussionQualityAgent)            │
│     - analyzeDiscussion(chirp)                                      │
│     - Analyzes comment thread quality                               │
│     - Returns: DiscussionQuality                                    │
│     - Saves: insights.discussionQuality = discussion.threadQuality  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 12. Generate Explanation (explainerAgent)                           │
│     - generateValueExplanation(chirp, valueScore)                   │
│     - Creates concise explanation for value score                   │
│     - Saves: insights.valueExplanation = explanation                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 13. Save Final Results                                              │
│     - Updates Firestore with all insights                           │
│     - Sets factCheckingStatus: 'completed'                          │
│     - Clears factCheckingStartedAt                                  │
│     - Records post value (reputationService)                        │
│     - Updates Kurral Score (kurralScoreService)                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 14. Return Enriched Chirp                                           │
│     - Returns chirp with all fact-check data                        │
│     - factCheckStatus: 'clean' | 'needs_review' | 'blocked'        │
│     - claims: Claim[]                                               │
│     - factChecks: FactCheck[]                                       │
│     - valueScore: ValueScore                                        │
│     - valueExplanation: string                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 15. Update UI (Client-Side)                                         │
│     - Feed store receives enriched chirp                            │
│     - Updates local state with enriched data                        │
│     - Fact-check badge appears (if factCheckStatus is set)          │
│     - Badge colors:                                                 │
│       * Green (✓): 'clean'                                          │
│       * Yellow (⚠): 'needs_review'                                  │
│       * Red (✗): 'blocked'                                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Points

### 1. **Post Appears Immediately**
   - Post is saved to Firestore and appears in the feed immediately
   - No fact-check badge is shown initially (factCheckStatus not set yet)
   - User can see and interact with the post right away

### 2. **Processing is Asynchronous**
   - Fact-checking happens in the background via Firebase Cloud Functions
   - Does not block the UI or prevent the post from being visible
   - Both mobile and webapp trigger the same FCF endpoint

### 3. **Progressive Updates**
   - Results are saved to Firestore progressively as each step completes
   - If processing fails partway, progress is saved and can be resumed
   - UI updates when the FCF returns the enriched chirp

### 4. **Status Progression**
   - Initial: `factCheckingStatus: 'pending'` (when post is created)
   - During: `factCheckingStatus: 'in_progress'` (while processing)
   - Final: `factCheckingStatus: 'completed'` or null (when done)
   - Final status: `factCheckStatus: 'clean' | 'needs_review' | 'blocked'`

### 5. **Retry Logic**
   - All OpenAI API calls use retry with exponential backoff
   - Handles rate limits and network errors
   - Maximum 3 retries per operation

### 6. **Pre-Check Optimization**
   - Pre-check step determines if fact-checking is actually needed
   - If pre-check says no fact-checking needed, skips claim extraction and fact-checking
   - Marks post as 'clean' immediately

### 7. **Rechirps (Reposts)**
   - Rechirps inherit fact-check data from the original post
   - If original post is not yet fact-checked, rechirp waits
   - Scheduled function `processPendingRechirpsCron` processes pending rechirps periodically

## Code Locations

### Mobile App
- Post Creation: `mobile/src/components/Composer/ComposerModal.tsx` → `handlePost()`
- Feed Store: `mobile/src/stores/useFeedStore.ts` → `addChirp()`
- Value Pipeline Client: `mobile/src/services/valuePipelineService.ts` → `processChirpValue()`
- Chirp Service: `mobile/src/services/chirpService.ts` → `createChirp()`

### Webapp
- Post Creation: `src/webapp/components/Composer.tsx` → `handlePost()`
- Feed Store: `src/webapp/store/useFeedStore.ts` → `addChirp()`
- Value Pipeline Client: `src/webapp/lib/services/valuePipelineService.ts` → `processChirpValue()`
- Chirp Service: `src/webapp/lib/firestore.ts` → `chirpService.createChirp()`

### Firebase Cloud Functions (Server-Side)
- Entry Point: `functions/src/index.ts` → `processChirpValue` (callable function)
- Main Pipeline: `functions/src/services/valuePipelineService.ts` → `processChirpValue()`
- Pre-Check: `functions/src/services/factCheckPreCheckAgent.ts`
- Claim Extraction: `functions/src/services/claimExtractionAgent.ts`
- Fact-Check: `functions/src/services/factCheckAgent.ts`
- Policy Engine: `functions/src/services/policyEngine.ts`
- Value Scoring: `functions/src/services/valueScoringAgent.ts`
- Discussion Quality: `functions/src/services/discussionQualityAgent.ts`
- Explanation: `functions/src/services/explainerAgent.ts`
- Reputation: `functions/src/services/reputationService.ts`
- Kurral Score: `functions/src/services/kurralScoreService.ts`

## Timing Considerations

1. **Post Creation**: ~100-500ms (Firestore write)
2. **UI Update**: Immediate (local state update)
3. **FCF Invocation**: ~100-200ms (network call)
4. **Pre-Check**: ~1-3 seconds (OpenAI API call)
5. **Claim Extraction**: ~2-5 seconds (OpenAI API call, longer if images)
6. **Fact-Checking**: ~3-10 seconds per claim (OpenAI API call, longer with web search)
7. **Policy Evaluation**: <100ms (pure logic)
8. **Value Scoring**: <100ms (pure logic)
9. **Final Save**: ~100-500ms (Firestore write)
10. **UI Update**: ~100-200ms (network callback + state update)

**Total Time**: Typically 5-20 seconds for a post with 1-2 claims

## Error Handling

- All steps are wrapped in `safeExecute()` to prevent failures from stopping the pipeline
- Failed steps return `undefined` and pipeline continues with available data
- Retry logic handles transient failures (rate limits, network errors)
- Final status is always set, even if some steps fail
- Failed processing can be resumed later (factCheckResumeService)

## Special Cases

### Scheduled Posts
- Scheduled posts are created with `scheduledAt` timestamp
- When scheduled time arrives, scheduled posts service triggers fact-checking
- Same pipeline flow as immediate posts

### Rechirps (Reposts)
- Rechirps inherit fact-check data from original post
- If original is not yet fact-checked, rechirp waits
- Scheduled function processes pending rechirps periodically

### Comments
- Comments follow a similar but simpler flow
- Pre-check → Claim extraction → Fact-check → Policy evaluation
- No value scoring or discussion quality for individual comments
- Results update the parent chirp's discussion quality

