# Tuned Post Infrastructure — Codebase Analysis

This document describes how the **tuned** post (reach) infrastructure is set up and how it works, based on a direct codebase analysis. No assumptions; all statements are tied to specific files and behavior.

---

## 1. What “Tuned” Means

- **Tuned** is a **reach mode** for a post (chirp). The other mode is **forAll**.
- A **tuned** post has restricted audience: who sees it is determined by **tuned audience** settings and optionally by **semantic similarity** between the post’s target-audience embedding and the viewer’s profile embedding.
- **TuningAgent** (feed algorithm tuning: `followingWeight`, `likedTopics`, `mutedTopics`) is **unrelated** to “tuned” posts. Tuned **posts** are about **per-post reach**, not feed algorithm preferences.

---

## 2. Type Definitions

### 2.1 `ReachMode` and `TunedAudience`

Defined in:

- `functions/src/types/index.ts`
- `src/webapp/types/index.ts`
- `mobile/src/types/index.ts` (same shape)

```ts
export type ReachMode = 'forAll' | 'tuned';

export type TunedAudience = {
  allowFollowers: boolean;
  allowNonFollowers: boolean;
  targetAudienceDescription?: string;   // Optional semantic description
  targetAudienceEmbedding?: number[];   // Embedding for semantic audience matching
};
```

### 2.2 Chirp

`Chirp` includes:

- `reachMode: ReachMode`
- `tunedAudience?: TunedAudience` (only meaningful when `reachMode === 'tuned'`)

So a “tuned post” is a chirp with `reachMode === 'tuned'` and (in practice) a defined `tunedAudience`.

---

## 3. Creation Path (Author Creates a Tuned Post)

### 3.1 Web App — Composer

**File:** `src/webapp/components/Composer.tsx`

- **State:** `reachMode` (`'forAll' | 'tuned'`), `tunedAudience` (`TunedAudience` with default `{ allowFollowers: true, allowNonFollowers: false }`).
- **Reach UI:** User can choose “For All” or “Tuned” (and see “TUNED” / “ALL” on the post button).
- **When user selects Tuned and has enough text:** A debounced `useEffect` runs when `reachMode === 'tuned'`, `plainText.trim().length > 10`, and `currentUser` exists. It:
  1. Loads topics via `loadTopicsForUser(userTopics)`.
  2. Calls **ReachAgent** `suggestTopicsAndReach(plainText.trim(), availableTopics, userTopics)`.
  3. On success (or fallback): sets `selectedTopic`, and `tunedAudience` from the suggestion, including `targetAudienceDescription` and `targetAudienceEmbedding` when the agent returns them.
- **On submit:** `handlePost` builds `chirpData` with `reachMode` and `tunedAudience: reachMode === 'tuned' ? tunedAudience : undefined`, then calls `addChirp(chirpData, { waitForProcessing: true })`.

So tuned posts are created when the user picks “Tuned” and the payload includes `reachMode: 'tuned'` and the current `tunedAudience` (possibly AI-suggested).

### 3.2 ReachAgent (Web) — Topics + Tuned Audience Suggestion

**File:** `src/webapp/lib/agents/reachAgent.js`

- **Role:** Suggests 1–3 topics and **reach settings** for the post.
- **Method:** `suggestTopicsAndReach(text, availableTopics, userTopics)`.
- **Output (success):** Object with:
  - `suggestedTopics`: array of `{ topic, confidence, explanation, isUserTopic }`
  - `tunedAudience`: `{ allowFollowers, allowNonFollowers }`
  - `explanation`, `overallExplanation`
  - After logic in reachAgent: `targetAudienceDescription` (default e.g. “People interested in #topic1, #topic2”) and `targetAudienceEmbedding` from `tryGenerateEmbedding(result.targetAudienceDescription)`.
- **Fallback on error:** Same shape with default `tunedAudience: { allowFollowers: true, allowNonFollowers: true }` and optional `targetAudienceDescription` / `targetAudienceEmbedding`.

So the **web** Composer gets optional semantic targeting via `targetAudienceDescription` and `targetAudienceEmbedding` from ReachAgent.

### 3.3 Heuristic Fallback (Web)

**File:** `src/webapp/lib/reachSuggestions.js`

- `suggestReachSettings(text, topic)` returns `{ tunedAudience, explanation }` using heuristics (e.g. discussion prompts → both allowed, personal → followers only). No embeddings.
- Used by UI that shows reach suggestions (e.g. `ReachSuggestionBox.js`, `TopicSuggestionBox.js`) when not using the full AI flow.

### 3.4 Mobile — Composer

**File:** `mobile/src/components/Composer/ComposerModal.tsx`

- Same idea: `reachMode`, `tunedAudience` state; when `reachMode === 'tuned'` and text length > 10, an effect calls the mobile **ReachAgent** (`getReachAgent()` from `reachAgentService`) for suggestions and sets topic + `tunedAudience`.
- On post: `chirpData` includes `reachMode` and `tunedAudience: reachMode === 'tuned' ? tunedAudience : undefined`.

**File:** `mobile/src/services/reachAgentService.ts`

- Defines `ReachSuggestion` with `tunedAudience: TunedAudience`.
- Schema for suggestions includes `tunedAudience: { allowFollowers, allowNonFollowers }`; mobile agent does not add `targetAudienceEmbedding` in the schema, but the type allows it and the Composer passes through whatever the agent returns.

### 3.5 Persistence — Firestore Create

**Web:** `src/webapp/lib/firestore.ts` — `chirpService.createChirp(chirp)`:

- Builds `chirpData` with `reachMode: chirp.reachMode`.
- If `chirp.tunedAudience` is set, sets `chirpData.tunedAudience = chirp.tunedAudience`.
- Writes to Firestore (and initializes fact-check fields, etc.). No stripping of `tunedAudience`.

**Mobile:** `mobile/src/services/chirpService.ts` — same idea: payload includes `reachMode` and `tunedAudience` when present; backend/create path persists them.

So from creation to storage, **tuned** is “author chose Tuned + stored `reachMode` and `tunedAudience` on the chirp document.”

---

## 4. Value Pipeline (Backend) — Does Not Change Tuned

**File:** `functions/src/index.ts`

- **processChirpValue** callable: receives `chirpId` and/or `chirp` payload. Resolves to a full `Chirp` (from Firestore or `normalizeChirpPayload(chirpPayload)`). `normalizeChirpPayload` sets `reachMode: payload.reachMode || 'forAll'` and `tunedAudience: payload.tunedAudience`.
- That `Chirp` is passed to `processChirp()`.

**File:** `functions/src/services/pipeline/index.ts`

- **processChirp(input)** runs pre-check, claim extraction, fact-check, value scoring. It only **updates** the chirp via `saveChirpResult(chirpId, result, predictedEngagement)`.
- **saveChirpResult** calls `chirpService.updateChirpInsights(chirpId, { claims, factChecks, factCheckStatus, valueScore, predictedEngagement, factCheckingStatus: null, factCheckingStartedAt: null })`. It does **not** write `reachMode` or `tunedAudience`.

So the pipeline **never overwrites or removes** tuned fields; they remain as written at create time.

**File:** `functions/src/services/firestoreService.ts`

- **deserializeChirp**: reads `data.reachMode`, `data.tunedAudience` from Firestore and puts them on the `Chirp` object. So when the function later fetches the chirp by ID, tuned fields are present.

---

## 5. Where Tuned Is Read and Enforced (Feeds)

Tuned is enforced when **deciding if a chirp is eligible** for a viewer. That logic is shared and used by both web and mobile.

### 5.1 Shared Eligibility: `isChirpEligibleForViewer`

**File:** `shared/lib/algorithm.ts`

- **Function:** `isChirpEligibleForViewer(chirp, viewer, config, options)`.
- **Reach handling:**
  - `reachMode === 'forAll'` → eligible (other checks like muted topics still apply).
  - `reachMode === 'tuned'`:
    - If `!chirp.tunedAudience` → **not eligible** (and a console warning).
    - Else:
      - `isFollowing = viewer.following.includes(chirp.authorId)`.
      - If `tunedAudience.allowFollowers && isFollowing` → eligible.
      - If `tunedAudience.allowNonFollowers && !isFollowing` → eligible.
      - Else if `chirp.tunedAudience.targetAudienceEmbedding` and `viewer.profileEmbedding` exist:
        - `similarity = cosineSimilarity(chirp.tunedAudience.targetAudienceEmbedding, viewer.profileEmbedding)`.
        - Threshold from `config.semanticSimilarityThreshold` (default 0.7).
        - If `similarity >= threshold` → eligible.
      - Else → **not eligible** (with a console warning).

So tuned posts are shown only to:

- Followers (if `allowFollowers`) or non-followers (if `allowNonFollowers`), **or**
- Viewers whose profile embedding is similar enough to the post’s target-audience embedding, when both embeddings exist.

### 5.2 For You Feed

**File:** `src/webapp/components/ForYouFeed.tsx` / `mobile/src/screens/Home/ForYouFeed.tsx`

- Feed is built with `generateForYouFeed(chirps, currentUser, config, getUser)` (from shared algorithm).
- **File:** `shared/lib/algorithm.ts` — `generateForYouFeed`:
  - Filters to “other people’s” chirps, then by time window.
  - **Eligibility filter:** `recent.filter(chirp => isChirpEligibleForViewer(chirp, viewer, config, ...))`.
  - Then scores (e.g. `scoreChirpForViewer`), sorts, applies diversity limits.

So **For You** only shows tuned posts to viewers who pass `isChirpEligibleForViewer` (follow/non-follow or semantic match).

### 5.3 Scoring Boost for Tuned + Embeddings

**File:** `shared/lib/algorithm.ts` — `scoreChirpForViewer`:

- If `viewer.profileEmbedding` and `chirp.tunedAudience?.targetAudienceEmbedding` exist, it computes cosine similarity and adds a boost (e.g. up to 35) with reason “aligns with your profile (X% similarity)”. So tuned posts that semantically match the viewer get a higher score in the For You feed.

### 5.4 Most Valued Feed

**File:** `src/webapp/lib/utils/mostValuedEligibility.ts` (and `.js`)

- **isChirpEligibleForMostValued**: Same rules as above for `reachMode === 'tuned'` (allowFollowers/allowNonFollowers + optional targetAudienceEmbedding vs viewer.profileEmbedding), with one difference: the viewer’s **own** posts are always eligible for Most Valued (whereas For You excludes own posts earlier).
- **filterChirpsForMostValued** then filters by fact-check status and this eligibility.

So Most Valued also respects tuned audience and optional semantic matching.

---

## 6. Display of “Tuned” to Users

- **ChirpCard / PostDetailView:** Show a “Reach” line. If `chirp.tunedAudience` exists, they show e.g. “Reach: Tuned (Followers, Non-followers)” or “Reach: Tuned” using `allowFollowers` / `allowNonFollowers` (see `src/webapp/components/ChirpCard.js`, `PostDetailView.js`, `mobile` equivalents).
- **Composer:** Button and label show “TUNED” vs “ALL” based on `reachMode`; topic/suggestion UI and TopicSuggestionBox let the user change topic and reach checkboxes (`tunedAudience.allowFollowers`, `tunedAudience.allowNonFollowers`).

---

## 7. End-to-End Flow Summary

1. **Author:** In Composer (web or mobile), selects “Tuned”. Optionally gets AI suggestions (ReachAgent) for topic + `tunedAudience` (and on web, `targetAudienceDescription` / `targetAudienceEmbedding`). Can edit topic and follow/non-follow checkboxes.
2. **Submit:** Client builds chirp with `reachMode: 'tuned'` and `tunedAudience` (and optional embeddings). `addChirp` creates the chirp in Firestore with these fields.
3. **Pipeline:** Client (or resume flow) calls `processChirpValue`. Cloud Function loads or normalizes the chirp (keeping `reachMode` and `tunedAudience`), runs the value pipeline, and only updates insights (claims, factCheck, valueScore, etc.). Tuned fields are never written by the pipeline.
4. **Feeds:** For You and Most Valued use shared logic: `isChirpEligibleForViewer` / `isChirpEligibleForMostValued`. Tuned chirps are eligible only if the viewer is allowed by follow/non-follow flags or by profile-vs-target embedding similarity (when both exist). For You then scores chirps (with a boost for profile/target similarity) and orders the feed.
5. **UI:** Cards and detail views show “Reach: Tuned (...)” from `tunedAudience`; Composer shows TUNED/ALL and reach checkboxes.

---

## 8. Files Reference (Tuned-Specific)

| Area | Files |
|------|--------|
| Types | `functions/src/types/index.ts`, `src/webapp/types/index.ts`, `mobile/src/types/index.ts` |
| Composer (tuned UI + payload) | `src/webapp/components/Composer.tsx`, `mobile/src/components/Composer/ComposerModal.tsx` |
| Reach suggestion (AI) | `src/webapp/lib/agents/reachAgent.js`, `mobile/src/services/reachAgentService.ts` |
| Heuristic suggestion | `src/webapp/lib/reachSuggestions.js` |
| Persistence | `src/webapp/lib/firestore.ts` (createChirp), `mobile/src/services/chirpService.ts`, `functions/src/services/firestoreService.ts` (deserialize), `functions/src/index.ts` (normalizeChirpPayload) |
| Pipeline (read-only for tuned) | `functions/src/services/pipeline/index.ts` (processChirp, saveChirpResult) |
| Eligibility & scoring | `shared/lib/algorithm.ts` (isChirpEligibleForViewer, scoreChirpForViewer, generateForYouFeed), `src/webapp/lib/utils/mostValuedEligibility.ts` |
| Feed usage | `src/webapp/components/ForYouFeed.tsx`, `mobile/src/screens/Home/ForYouFeed.tsx`, MostValuedSection / mostValuedService |
| Display | `src/webapp/components/ChirpCard.js`, `PostDetailView.js`, `TopicSuggestionBox.js`, `ReachSuggestionBox.js`; mobile equivalents |

This is the full picture of how the current tuned post infrastructure is set up and how it works in the codebase.
