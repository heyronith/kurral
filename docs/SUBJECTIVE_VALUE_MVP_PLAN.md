# Subjective Value MVP — 4-Step Implementation Plan

**Purpose:** MVP of "subjective value" using **only** engagement counts (bookmarks, reposts, comments) **alongside** the current system (platform quality). No user weights, no dimensions · weights, no ML. Score **posts** and **creators** with both signals.

**Scope:** Add an engagement-based "audience value" score; keep platform quality (valueScore.total) as-is. Use both for ranking, display, and Kurral.

---

## Will it work?

**Yes.** Keeping the current system and adding engagement-based scoring gives you:

- **Post:** Two signals — (1) **platform quality** (our bar, from pipeline), (2) **audience value** (bookmarks + reposts + comments). Use both for ranking and optionally for display. Posts that meet our bar **and** get engagement rank higher; posts that get lots of saves/shares/comments get a boost even without the strongest platform score.
- **Creator (Kurral):** Scored by both (1) quality of their posts (platform quality) and (2) how much the audience engaged (sum or average of engagement score across their posts). So creators are recognized for both "meeting our bar" and "audience found this valuable."

No replacement of platform quality; it’s an **additive** second signal.

---

## Current state (from codebase)

- **Chirp fields:** `commentCount` (required), `bookmarkCount` (optional), `rechirpCount` (optional). Types: `functions/src/types/index.ts`, `src/webapp/types/index.ts`, `mobile/src/types/index.ts`.
- **Updates:** `commentCount` is incremented/decremented on comment create/delete (e.g. `src/webapp/lib/firestore.ts`, `mobile/src/services/commentService.ts`). `bookmarkCount` and `rechirpCount` are updated on bookmark/rechirp (e.g. `src/webapp/lib/firestore.ts` with `increment(delta)`).
- **Ranking:** `shared/lib/algorithm.ts` — `scoreChirpForViewer` already uses `bookmarkCount` (boost up to 25) and `rechirpCount` (log boost up to 20) and `commentCount` (boost). So raw counts already affect feed order; we are formalizing them into a single **engagement score** and using it consistently for post score and Kurral.
- **Kurral:** `functions/src/services/kurralScoreService.ts` — today uses quality (from valueScore), violations, engagement (from **discussion quality**, not bookmark/repost/comment counts), consistency, trust. We add an **audience value** component from posts’ engagement scores.

---

## Step 1: Ensure engagement counts are stored and updated

**Goal:** Every post has up-to-date `bookmarkCount`, `rechirpCount`, and `commentCount` so we can compute engagement score.

**What to do:**

1. **Audit:** Confirm that whenever a user bookmarks/unbookmarks a post, the post’s `bookmarkCount` is updated (e.g. Firestore `increment`). Same for rechirp (repost): `rechirpCount` on the **original** post is incremented when someone rechirps it. `commentCount` is already updated on comment create/delete.
2. **Fill gaps:** If bookmark or rechirp does not update the post document, add the update in the same transaction or Cloud Function that handles the action. Ensure new posts are created with `bookmarkCount: 0`, `rechirpCount: 0`, `commentCount: 0` (or existing defaults).
3. **Optional: backfill.** For existing posts missing these fields, run a one-time job to set them from bookmarks/rechirps/comments collections (or leave as 0 if no source of truth).

**Deliverables:** All posts have (or can have) `bookmarkCount`, `rechirpCount`, `commentCount`. Counts are updated on every bookmark, rechirp, and comment.

**Code touchpoints:** Firestore write paths for bookmark, rechirp, comment; post create; types (already have optional fields).

---

## Step 2: Define and compute engagement score per post

**Goal:** One number per post that represents "audience value" from bookmarks, reposts, and comments — same for everyone, so we can use it for ranking, display, and Kurral.

**What to do:**

1. **Formula:** Define  
   `engagementScore = f(bookmarkCount, rechirpCount, commentCount)`  
   Examples:
   - **Weighted sum:**  
     `engagementScore = wB * bookmarkCount + wR * rechirpCount + wC * commentCount`  
     with e.g. `wB = 1`, `wR = 1`, `wC = 0.5` (comments weaker than save/share).
   - **Normalize to 0–1 or 0–100:** e.g. `normalized = min(1, engagementScore / K)` for a chosen K (e.g. 50 or 100), or use a log scale so a few engagements matter but it doesn’t blow up:  
     `engagementScore = min(1, (log(1 + weightedSum) / log(1 + K)))`.
2. **Where to compute:** Either (a) **on read** in ranking/Kurral/display (no new field), or (b) **on write** when bookmark/rechirp/comment change and store `engagementScore` (and optionally `engagementScoreUpdatedAt`) on the post. Storing avoids recomputing and allows indexing/sorting by engagement score (e.g. for "Popular" feed).
3. **Edge cases:** New post (all counts 0) → engagementScore = 0. No special cold start; it grows as engagement happens.

**Deliverables:** A single, documented formula for `engagementScore` per post; implementation either computed on read or stored on the post and updated when counts change.

**Code touchpoints:** New helper e.g. `getEngagementScore(chirp)` in `shared/lib/` or in services that need it; optionally post write path (bookmark/rechirp/comment) to update stored `engagementScore`; types if we add a stored field.

---

## Step 3: Use engagement score for posts (ranking and display)

**Goal:** Feed ranking and optional UI use both platform quality and engagement score. Current system unchanged; we add engagement as a second signal.

**What to do:**

1. **Feed ranking:** In `shared/lib/algorithm.ts` (`scoreChirpForViewer`), the algorithm already uses `bookmarkCount`, `rechirpCount`, and `commentCount` for boosts. Either:
   - **Option A:** Replace those ad-hoc boosts with a single **engagement score** term, e.g. `engagementBoost = engagementScore * E` (E = max points, e.g. 20–30), and keep platform quality (valueScore.total) as today; or  
   - **Option B:** Add an explicit blend: `valueSignal = α * platformQuality + (1 - α) * engagementScore` (e.g. α = 0.6) and use `valueSignal` where we currently use platform quality in the score.  
   Choose one and implement so that both "our bar" and "audience engaged" affect order.
2. **Display:** Keep showing platform quality (e.g. "Quality: 78") from `valueScore.total`. Optionally show engagement (e.g. "Saved: 12 · Shared: 5 · Replies: 8" or a single "Audience: 72") from `engagementScore` or raw counts. No requirement to show a combined number; two signals can be shown separately.
3. **Most Valued / Popular:** Keep "Most Valued" as sort by platform quality (`valueScore.total`). Optionally add a "Popular" feed sorted by `engagementScore` (or by raw weighted sum) so high-engagement posts (including those without strong platform score) can surface.

**Deliverables:** Feed ranking uses both platform quality and engagement score (via chosen option). Optional: engagement or counts shown on post; optional "Popular" feed.

**Code touchpoints:** `shared/lib/algorithm.ts` (scoreChirpForViewer); optional UI in ChirpCard/PostDetail; optional new feed query for Popular.

---

## Step 4: Use engagement score for creator (Kurral)

**Goal:** Kurral reflects both (1) platform quality of the creator’s posts and (2) how much the audience engaged with their posts (bookmarks, reposts, comments).

**What to do:**

1. **Audience value component:** For creator C, define an **audience value** score from their posts, e.g. sum or average of `engagementScore` over C’s posts in a window (e.g. last 30 days or last 50 posts). Normalize to 0–1 (e.g. divide by max observed or by a cap) so it can be combined with existing Kurral components.
2. **Add to Kurral:** In `functions/src/services/kurralScoreService.ts`, Kurral currently uses: quality (from valueScore), violations, engagement (discussion quality), consistency, trust. Add a new component, e.g. **audienceValue**, from step 1. Options:
   - **Replace** current "engagement" (discussion quality) with audience value from counts; or  
   - **Add** audience value as an extra component and give it a weight (e.g. 0.1), renormalize other weights so they still sum to 1.  
   Recommendation: **add** audience value (e.g. weight 0.1) so both "discussion quality" and "audience saved/shared/replied" matter.
3. **When to update:** Kurral is updated today when a post is processed (pipeline side effects). Audience value depends on counts that change when users bookmark/rechirp/comment. So either: (a) **On-demand:** When we need Kurral, aggregate engagement scores from the creator’s recent posts (read from post docs). Or (b) **Periodic:** Scheduled function that recomputes Kurral for active creators using latest engagement scores. Or (c) **On engagement:** When a bookmark/rechirp/comment is written, optionally trigger a Kurral recompute for that post’s author (can be deferred/batched). Start with (a) for MVP; move to (b) or (c) if latency or freshness requires it.

**Deliverables:** Kurral includes an "audience value" component derived from posts’ engagement scores. Weights and update strategy documented and implemented.

**Code touchpoints:** `functions/src/services/kurralScoreService.ts` (add audience value, adjust SCORE_WEIGHTS); optional: aggregation of engagement scores over a user’s posts (in Kurral service or in reputationService); optional: trigger on bookmark/rechirp/comment to refresh Kurral.

---

## Summary table

| Step | Focus | Outcome |
|------|--------|--------|
| **1** | Counts | Every post has up-to-date `bookmarkCount`, `rechirpCount`, `commentCount`. |
| **2** | Engagement score | One number per post: `engagementScore = f(bookmarkCount, rechirpCount, commentCount)` (stored or computed). |
| **3** | Posts | Feed ranking uses both platform quality and engagement score; optional display and "Popular" feed. |
| **4** | Creator (Kurral) | Kurral includes an audience value component from creators’ posts’ engagement scores. |

**Dependencies:** Step 2 needs Step 1 (counts). Step 3 and 4 need Step 2 (engagement score). Step 4 can be done in parallel with Step 3 once Step 2 is defined.

**What we are not doing in MVP:** User weights, dimensions · weights, "value to you" per viewer, ML, or impression-based "subjective value created." Those remain for a later phase; see SUBJECTIVE_VALUE_IMPLEMENTATION_PLAN.md and SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md.
