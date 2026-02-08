# Subjective Value System — 3-Step End-to-End Implementation Plan

**Purpose:** A concrete, end-to-end implementation plan for the subjective value system update, based on everything we have discussed. This plan does not assume anything beyond what is stated in the referenced docs and code.

**What we are trying to accomplish (from our discussions):**

1. **Two distinct notions of “value”**
   - **Platform quality:** One number per post (five dimensions combined with *platform* weights + fact-check). Same for everyone. Used for: post score display, “Most Valued” feed, Kurral (creator score). This is what we have today as `valueScore.total`.
   - **Value to you:** Viewer-specific score = (post’s five dimension scores) · (viewer’s five weights). Computed at ranking time. Used for: feed order (and optionally “value to you” display). Not stored per post; not used for Kurral.

2. **Inferred-only user weights**
   - No sliders or stated preferences. Weights come only from behavior: **bookmarks, reposts, and comments/replies** (comments/replies as weaker, e.g. 0.5). Positive = user bookmarked/reposted/commented; negative/neutral = shown but none of those. We fit five weights per user so that value-to-U is higher for positive posts and lower for negative/neutral. Cold start: default weights (e.g. equal 0.2 each) or rank by platform quality until enough engagements (e.g. 10+); then use inferred weights.

3. **Dimension-based value only where dimensions exist**
   - “Value to you” = (dimensions) · (weights) applies only to posts that **have** dimension scores (i.e. posts that get `valueScore` in the pipeline). Posts that today exit early (opinion, experience, humor, no claims) have no dimension vector, so we cannot compute value-to-U for them in this framework until we give them dimension scores.

4. **Earning/recognition for all post types**
   - Today, only posts with `valueScore` contribute to valueStats (postValue30d, lifetimePostValue) and to Kurral quality from that post. Opinion/experience/humor posts do not. We want to mitigate so that earning/recognition is not limited to factual posts only (see SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md, “If we only score factual posts…”).

5. **No change to post score or Kurral definition**
   - Post score = platform quality (`valueScore.total`). Creator (Kurral) = function of platform quality of their posts (and other signals). We do **not** use “value to you” for Kurral or for the single post score displayed to everyone.

**References (no assumptions beyond these):**

- **Current pipeline and who gets valueScore:** VALUE_SCORING_MECHANISM_ANALYSIS.md (§1.5, §2); SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md (“How the current system handles different post types”). Code: `functions/src/services/pipeline/index.ts` (early exit when `!needsFactCheck` or `claims.length === 0`); `functions/src/services/pipeline/sideEffects.ts` (`recordPostValue` only when `result.valueScore`); `shared/lib/algorithm.ts` (`scoreChirpForViewer` uses `chirp.valueScore` only when present).
- **Subjective value definition and combination rule:** SUBJECTIVE_VALUE_SCORING_FRAMEWORK.md (§1–3); SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md (“The process in five steps,” “How do we score a post? And how do we score the creator (Kurral)?,” “Can we use only inferred…”).
- **Mitigation for “only factual posts earn”:** SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md (“If we only score factual posts…”): Option 1 = run value scoring for all posts; Option 2 = two tracks (value + audience value); Option 3 = weight earning by post type; Option 4 = two surfaces (Most Valued + Popular). Recommendation there: Option 1 (value score all posts) as smallest code change; Option 3 optional on top.
- **Gaming and hardening:** VALUE_SCORING_HARDENING.md (Tier 1/2/3); SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md (“Is it gameable?”). Not re-specified here; apply as needed during implementation.

---

## Step 1: Foundation — Value score for all posts and earning parity

**Goal:** Ensure every post can receive a value score (five dimensions + total) and contribute to creator valueStats and Kurral quality, so that (a) dimension-based “value to you” can apply to more posts later, and (b) earning/recognition is not limited to factual posts.

**Current state (from code and docs):**

- In `functions/src/services/pipeline/index.ts`: when `!needsFactCheck` (after pre-check) the pipeline returns immediately with no `valueScore`. When `needsFactCheck === true` but `claims.length === 0` (after extract-claims), the pipeline returns immediately with no `valueScore`.
- In `functions/src/services/pipeline/sideEffects.ts`: `recordPostValue` is called only when `result.valueScore` exists. So opinion/experience/humor and “factual but 0 claims” posts never update valueStats.
- In `functions/src/services/kurralScoreService.ts`: when `valueScore` is undefined, the new post does not contribute a new quality signal (previous quality or default is used). So Kurral does not improve or worsen from those posts.
- Most Valued and feed value boost use `valueScore.total`; posts without `valueScore` are excluded from Most Valued and get no value boost/penalty.

**What to implement:**

1. **Remove early exit without value scoring.**  
   In `functions/src/services/pipeline/index.ts`:
   - When `!needsFactCheck`: do **not** return after pre-check. Set `claims = []`, `factChecks = []`, `factCheckStatus = 'clean'`. Then run the same value-scoring step used for the full path (with `chirp`, `claims`, `factChecks`). Attach the returned `valueScore` to the result. Save result and run side effects (so `recordPostValue` and `updateKurralScore` run with a real `valueScore`).
   - When `needsFactCheck === true` but `claims.length === 0`: do **not** return after extract-claims. Set `factChecks = []`, `factCheckStatus = 'clean'`. Run the value-scoring step with `chirp`, `claims = []`, `factChecks = []`. Attach `valueScore` to the result. Save and run side effects.

2. **Value scoring behavior for “no fact-check” / “no claims” paths.**  
   The existing value scorer already receives `claims = []` and `factChecks = []` on the bot path; epistemic is capped at 0.35 when there are no fact-checks (`applyFactCheckPenalty` in `valueScoringAgent.ts`). Reuse that behavior: for these paths we pass the same inputs, so every post gets five dimension scores and a total (with epistemic capped for non-factual). No change to the value-scoring agent is required for this step unless we later add content-type-specific prompts (see VALUE_SCORING_MECHANISM_ANALYSIS.md recommendations).

3. **Optional: weight contribution to valueStats/Kurral by post type.**  
   If we want factual posts to count more toward earning than non-factual: in the place that records post value (e.g. `recordPostValue` in `functions/src/services/reputationService.ts`), multiply the contributed value by a weight, e.g. `weight = (result.claims?.length > 0 && result.factChecks?.length > 0) ? 1 : 0.3`. Apply the same weight when passing value into Kurral quality. Document the choice (e.g. in SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md Option 3).

**Deliverables:**

- All posts (including opinion, experience, humor, and “factual but 0 claims”) receive a `valueScore` (five dimensions + total).
- `recordPostValue` and `updateKurralScore` run for all posts, so valueStats and Kurral quality can move for every post.
- Most Valued and feed value boost can include non-factual posts (they now have `valueScore.total`).
- Optional: configurable weight for non-factual posts in valueStats/Kurral.

**Code touchpoints:**

- `functions/src/services/pipeline/index.ts` (logic after pre-check and after extract-claims: avoid early return; call value-scoring step; attach `valueScore`; then save and side effects).
- Optionally: `functions/src/services/reputationService.ts` (and any Kurral input) for post-type weight.

**Verification:**

- Run pipeline for a post that today would early-exit (e.g. opinion or 0 claims). Confirm result contains `valueScore` with five dimensions and total, and that side effects run.
- Confirm Firestore/DB: such posts update author valueStats and Kurral as intended.

---

## Step 2: User preference layer — Inferred weights and “value to you” at ranking time

**Goal:** Introduce per-viewer “value to you” by (a) storing or computing per-user weights on the five dimensions, inferred only from behavior (bookmarks, reposts, comments/replies), and (b) at feed ranking time, computing value-to-viewer = (post dimensions) · (viewer weights) and using it for ordering (and optionally for display).

**Current state:**

- There is no per-user weight storage or inference. Feed ranking in `shared/lib/algorithm.ts` uses `chirp.valueScore.total` (platform quality) when present; same score for every viewer.
- Engagement events (bookmarks, reposts, comments/replies) may exist elsewhere; we need to use them only for fitting weights, and only over posts that have `valueScore` (dimension vector).

**What to implement:**

1. **User weight storage.**  
   Define a place to store five dimension weights per user (e.g. Firestore `users/{userId}.valueWeights` or fields on existing user doc). Normalize so they sum to 1 (or fix scale). Default for new or cold-start users: e.g. `[0.2, 0.2, 0.2, 0.2, 0.2]`.

2. **Inference of weights from behavior.**  
   - **Positive signals:** User bookmarked, reposted, or commented/replied on a post. Treat comment/reply as weaker (e.g. weight 0.5 in the fitting).  
   - **Negative/neutral:** Post was shown to the user but they did not bookmark, repost, or comment/reply (use impression or feed-view data if available).  
   - **Eligible posts:** Only posts that have `valueScore` (five dimensions). Exclude posts without dimension scores from the fitting dataset.  
   - **Model:** Fit five weights per user so that value-to-U = (post dimensions) · (user weights) is higher for positive posts and lower for negative/neutral (e.g. regression or ranking objective). Regularize toward default weights to avoid extreme vectors.  
   - **When to run:** Periodically (e.g. daily or weekly) or on-demand when building feed, with a minimum number of positive + negative/neutral examples per user (e.g. 10+ positive, 20+ negative/neutral) before trusting inferred weights; otherwise use default.

3. **Cold start.**  
   - New user or user with too few engagements: use default weights (e.g. equal 0.2 each). Optionally rank feed by platform quality + relevance until threshold (e.g. 10 bookmarks + reposts + comments/replies), then switch to inferred weights. Document in SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md (“Cold start (inferred-only)”).

4. **Ranking-time “value to you.”**  
   In the feed ranking path that currently uses `chirp.valueScore` (e.g. `scoreChirpForViewer` in `shared/lib/algorithm.ts`):
   - Load or compute the viewer’s five weights (default if cold start).
   - For each candidate chirp that has `valueScore`, compute  
     `valueToViewer = (chirp.valueScore.epistemic * we + chirp.valueScore.insight * wi + … )` for the five dimensions (using same dimension keys as stored).
   - Use `valueToViewer` instead of `chirp.valueScore.total` for the value component of the ranking score (or use a blend, e.g. `alpha * valueToViewer + (1 - alpha) * chirp.valueScore.total`; alpha can be 1 for a full subjective ranking).
   - For chirps without `valueScore` (should be none after Step 1), keep current behavior (no value term or use other signals only).

5. **Display and downstream.**  
   - Post score shown in UI remains **platform quality** (`valueScore.total`) — one number per post, same for everyone. Do not show “value to you” as the main post score.  
   - Optionally: in the viewer’s own context, show “Value to you: X” computed from valueToViewer (e.g. on post detail or in a tooltip).  
   - Most Valued feed and Kurral continue to use **platform quality** only (no change from Step 1).

**Deliverables:**

- Per-user stored or computed weights (inferred from bookmarks, reposts, comments/replies; comment/reply weighted 0.5).
- Value to viewer computed at ranking time and used in feed order.
- Cold start defined and implemented (default weights; optional delay until minimum engagements).
- Post score and Kurral unchanged (still platform quality).

**Code touchpoints:**

- New or existing: user document or collection for `valueWeights` (five numbers).
- New: service or Cloud Function to fit weights from engagement events and eligible posts (posts with `valueScore`); write back to user.
- `shared/lib/algorithm.ts`: in `scoreChirpForViewer`, accept or load viewer weights, compute valueToViewer when chirp has `valueScore`, use it in the score (or blended with platform quality).
- Optional: webapp/mobile UI for “Value to you: X” when viewer is current user.

**Verification:**

- After fitting: confirm stored weights sum to 1 and that valueToViewer differs across users for the same post.
- Confirm feed order changes when viewer weights change (e.g. after simulated engagements).
- Confirm Most Valued and Kurral still use only `valueScore.total`.

---

## Step 3: Product surfaces, optional “Popular,” and validation

**Goal:** Clarify product semantics (platform quality vs value to you), add optional feeds/surfaces, and validate that ranking by “value to you” improves outcomes.

**What to implement:**

1. **Naming and semantics (copy/UI).**  
   - **“Most Valued”** = top by **platform quality** (`valueScore.total`). Keep current query and behavior. In product copy, this is “top by our quality bar” (not “posts you would value most”).  
   - **“Value to you”** = ranking by valueToViewer (viewer’s weights × post dimensions). Optionally add a dedicated feed or tab “Valued for you” that sorts the same candidate set by valueToViewer.  
   - Ensure any in-app explanation or help text reflects: one score per post = platform quality; feed order (and optional “Valued for you”) = your inferred preferences.

2. **Optional: “Popular” / “Most saved” surface.**  
   If we want a second path for recognition that does not depend on dimension scores: add a feed that ranks **all** posts by engagement (e.g. bookmark count + repost count, optionally + comment count). No filter on `valueScore`. This gives opinion/experience/humor posts a way to surface by “most saved/shared” even if we do not use dimension-based value for them in “value to you.” Implementation: new query or sort (e.g. by `bookmarkCount + repostCount` in a time window). Product copy: “Popular = most saved and shared by the community.”

3. **Validation (A/B test).**  
   - **Control:** Feed ranked using platform quality + relevance (current behavior before “value to you” or with alpha=0).  
   - **Treatment:** Feed ranked using value to you (or blend with platform quality, e.g. alpha=0.5 or 1).  
   - **Metrics:** Bookmarks, time spent, return visits, optional satisfaction survey.  
   - Run long enough to account for cold start (many users may have default weights initially).  
   - If treatment wins, adopt or tune blend (alpha). If not, iterate on inference (signals, regularization, cold start) or combination rule (see SUBJECTIVE_VALUE_SCORING_FRAMEWORK.md Step 5).

**Deliverables:**

- Clear product semantics and copy for “Most Valued” vs “value to you” (and optional “Valued for you” feed).
- Optional “Popular” / “Most saved” feed for all posts by engagement.
- A/B test design and metrics; first results and decision on rollout/tuning.

**Code touchpoints:**

- Most Valued: no change (already by `valueScore.total`).
- Optional: new feed endpoint or client logic for “Valued for you” (sort by valueToViewer).
- Optional: new feed endpoint or client logic for “Popular” (sort by bookmark/repost/comment counts; no valueScore filter).
- Experimentation/feature-flag layer to assign users to control vs treatment for ranking.

**Verification:**

- Copy and UI clearly distinguish platform quality from “value to you.”
- If “Popular” is built: it returns posts without requiring `valueScore`.
- A/B test is measurable and documented.

---

## Summary table

| Step | Focus | Main outcome |
|------|--------|--------------|
| **1** | Foundation | Every post gets `valueScore`; valueStats and Kurral from every post; earning/recognition not limited to factual posts. |
| **2** | User preference layer | Inferred weights (bookmarks, reposts, comments/replies); “value to you” at ranking time; feed order by (or blended with) value to you; cold start. |
| **3** | Product and validation | Clear semantics (Most Valued = platform quality; optional Valued for you, Popular); A/B test and iterate. |

**Dependencies:** Step 2 assumes Step 1 is done (so that more posts have dimension scores for fitting and ranking). Step 3 can start once Step 2 is in place (at least in one variant) and can run in parallel with optional surfaces like “Popular.”

**What we are not assuming:** We are not assuming a separate “audience value” track (Option 2), “subjective value created” as post/creator score, or stated preferences/sliders; those are out of scope unless we explicitly add them later. We are not assuming any specific hardening (e.g. epistemic-gating other dimensions) in this plan; apply VALUE_SCORING_HARDENING.md as part of implementation where appropriate.
