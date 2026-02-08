# Subjective Value Scoring — Simple Explanation

A plain-language explanation of how to score posts based on **subjective** values (value that depends on who is looking).

---

## The problem in one sentence

**Right now we give every post one "value" number that's the same for everyone.** But value is subjective — the same post can be "great" for one person and "meh" for another. So we need a way to score that depends on **who is looking**.

---

## Analogy: restaurant ratings

- **One number for everyone (what we have now):**  
  "This restaurant is 8/10." Same 8 for a foodie, a picky kid, and someone on a diet. That's **platform quality** — our bar, not "good for you."

- **Subjective (what we want):**  
  "For you, this restaurant is 9/10" vs "For your friend, it's 6/10." Same place, different scores because **who is judging** matters. That's **value to you**.

To get "value to you," we need two things:

1. **What the post is like** — e.g. accurate, novel, practical, civil, effortful. We already have this: the five dimension scores per post.
2. **What you care about** — e.g. "I care more about accuracy than novelty." We don't have this yet. We get it by asking you (sliders) or learning from what you bookmark, share, or skip.

Then: **your value score for a post = how much the post has what you care about.**

**Example:**  
Post A is high on accuracy and low on practical tips. You care a lot about accuracy and little about tips → for you, Post A scores high. Your friend cares a lot about tips → for them, Post A scores lower. Same post, different "value to you."

---

## The process in five steps (plain language)

### 1. Decide what "value to you" means

We choose a rule. For example:  
"Value to you = a mix of the five dimensions (accuracy, insight, practical, community, effort), but **your** mix — your weights."

So we're not changing what we measure about the post (the five dimensions). We're changing **how we combine them** — using your weights instead of the platform's fixed weights.

### 2. Get "your mix" (your weights)

Two main ways:

- **Ask you:** Sliders or choices like "I care more about: accuracy / new ideas / practical tips / community / depth." We save that as your weights.
- **Learn from behavior:** You bookmark a lot of accurate, well-sourced posts → we infer you care about accuracy. You skip long theoretical posts → we infer you care less about depth. We update your weights over time.

Best: support both. Start with a default (or one question at signup); let users optionally set sliders; refine weights from behavior.

### 3. Combine at the right time

When we're building **your** feed, we know who you are (the viewer). So we:

- Take each post's five dimension scores (accuracy, insight, practical, relational, effort).
- Take **your** weights for those five things.
- Compute: **value to you** = (post's accuracy × your weight for accuracy) + (post's insight × your weight for insight) + … for all five.

That number is different for each user. Same post → different "value to you" for you vs your friend.

We do this **when we're about to show you the feed** (ranking time), not when we first score the post. Because we need to know **you** to compute "value to you."

### 4. Store the right things

- **Per post:** The five dimension scores (same for everyone). No single "value" number that's supposed to be "subjective" — that would be wrong, because subjective value depends on the viewer.
- **Per user:** Your weights (or a way to compute them from your behavior).

We **don't** store "value to user X" for every user X for every post (that would be huge and wasteful). We store post scores + user weights, and we **compute** "value to you" at the moment we're building your feed.

### 5. Check that it works

We run an experiment:

- **Group A:** Feed ranked using "value to you" (your weights × post dimensions).
- **Group B:** Feed ranked using the single platform score (current behavior).

We measure: bookmarks, time spent, return visits, or satisfaction. If Group A does better, ranking by "value to you" is actually giving people more of what they value. If not, we adjust how we get weights or how we combine (e.g. blend with platform quality).

---

## What changes in the product

| Today | With subjective value |
|-------|------------------------|
| One "value" score per post (same for everyone). | Same five dimension scores per post (no change). Plus **your weights** per user. |
| Feed = relevance to you + that one score. | Feed = relevance to you + **value to you** (your weights × post dimensions). |
| "Most Valued" = top by that one score. | We can keep "Most Valued" = top by **our bar** (platform quality). Add **"Valued for you"** = top by **your** weights. |

So we get two clear ideas: **"our bar"** (platform quality, one number per post) and **"your values"** (value to you, computed when we have you).

---

## One-sentence summary

**Subjective value scoring = same five dimensions per post, but a different mix per user (your weights), combined when we have you (at ranking time), and checked by whether ranking that way actually improves your engagement.**

---

## How this fits the current system

We **keep** the pipeline that produces the five dimension scores (epistemic, insight, practical, relational, effort) for each post. We **add**:

1. A way to get **your weights** (sliders, or inference from behavior, or segment default).
2. In the feed ranking code: when we have the viewer, compute **value to you** = post's five scores × viewer's weights, and use that (or blend it with platform quality) for ranking.

We do **not** throw away the current engine. We add the "your weights" part and the "combine at ranking time" step. The full technical framework (formal definitions, options, trade-offs) is in **SUBJECTIVE_VALUE_SCORING_FRAMEWORK.md**.

---

## How do we score a post? And how do we score the creator (Kurral)?

With subjective value, "value to you" is different for each viewer — so how do we still get **one score per post** for display, "Most Valued," and **one score per creator** (Kurral)? The answer: we keep **two separate ideas** and use each where it belongs.

### Two different "scores"

| Idea | What it is | Same for everyone? | Used for |
|------|------------|--------------------|----------|
| **Platform quality** | One number per post: our bar (five dimensions combined with **our** weights, plus fact-check). Same pipeline as today. | Yes | Post "score" on the post, "Most Valued," **Kurral (creator score)** |
| **Value to you** | Your weights × post's five dimensions. Computed when we have **you** (the viewer). | No — different per user | **Ranking your feed** (and optionally "for you: 85" when you view a post) |

So we **still score every post** with the current pipeline. That gives us the five dimension scores and a **platform quality total** (what we have today as `valueScore.total`). That is the **post score** — one number per post, same for everyone. We use it for:

- Showing a score on the post (e.g. "Quality: 78").
- "Most Valued" feed (top by platform quality).
- **Kurral (creator score)** — see below.

We **add** "value to you" only for **your** feed order (and optionally for "value to you: X" when you're the viewer). We don't store "value to you" per post; we don't use it for Kurral.

### How we score the post (concretely)

- **Unchanged:** Run the same pipeline (pre-check → claims → fact-check → value scoring). We get per post: epistemic, insight, practical, relational, effort, and a **total** (platform weights). Store that on the post as today (`valueScore`).
- That total **is** the "post score" — platform quality, one number per post. We use it everywhere we need a single post-level score: display, "Most Valued," and Kurral.

So **scoring a post** does not change: we still score it once, with our bar (platform quality). "Value to you" is not the post score; it's a **ranking signal** we compute when we have you.

### How we score the creator (Kurral)

- **Unchanged:** Kurral = function of (quality of their posts, violations, engagement, consistency, trust). "Quality of their posts" = the **platform quality** of each post (the same `valueScore` we store today). So Kurral = "reputation for **meeting our bar**" — truthfulness, insight, practical value, civility, effort — not "reputation for being valuable to each user."
- We do **not** use "value to you" for Kurral. If we did, we'd have to aggregate "value to user A," "value to user B," … for every viewer, which is heavy and unclear. So Kurral stays based on **platform quality** of the creator's posts.

So **scoring the creator** does not change: Kurral is still driven by how well their posts meet **our** bar (platform quality), not by a per-user "value to you."

### Short answers

- **How do we score a post?** Same as now: one score per post = **platform quality** (five dimensions + our weights + fact-check). That's the post score. "Value to you" is only for your feed order (and optional "for you" display), not the post score.
- **How do we score the creator (Kurral)?** Same as now: Kurral = f(platform quality of their posts, violations, engagement, …). We use each post's **platform quality** (`valueScore`), not "value to you." So creators are still scored by how well they meet **our** bar.

---

## Can we use "subjective value created" to score the post and the creator?

**Yes.** We can define an algorithm where:

- **Post score** = how much **subjective value** the post has created for the people who saw it (aggregated over viewers).
- **Creator score (Kurral)** = how much subjective value their posts have created (aggregated over their posts and the viewers of those posts).

So both the post and the creator are scored by **value created for viewers**, not by our fixed bar. Below is one way to do it.

### Idea: "Subjective value the post has created"

For each post we ask: **how much value did this post create for the people who encountered it?**

We need two things:

1. **Who saw (or was shown) the post?** — We track impressions or viewers (or approximate with a sample or with "typical" users).
2. **How much value did it create for each of them?** — For each viewer U we have "value to U" = U's weights × post's five dimensions. So we can compute "value to U" for every viewer who saw the post.

Then we **aggregate** over viewers. For example:

- **Average value to viewers:** (sum of "value to U" over viewers who saw the post) ÷ (number of those viewers). So "on average, how valuable was this post to the people who saw it?" That's a **post score** based on subjective value created.
- **Value per impression:** (sum of "value to U" over viewers) ÷ (number of impressions). So we don't just reward "shown to more people"; we normalize by exposure.
- **Fraction of viewers who found it valuable:** fraction of viewers for whom "value to U" was above a threshold (e.g. top 20%). So "what share of viewers found this post valuable?"

Pick one (or a blend). That aggregate = **subjective value the post has created**. We use it as the **post score** (and then for Kurral).

### How to compute it (concretely)

1. **Per post:** We have the five dimension scores (epistemic, insight, practical, relational, effort). We have (or infer) weights for each user.
2. **When a user U is shown the post:** We compute value to U = (post's dimensions) · (U's weights). We store or stream this (e.g. "post P was shown to user U, value to U = 0.72").
3. **Periodically (e.g. daily or weekly):** For each post P, take all (U, value to U) for users who were shown P. Aggregate: e.g. average value to viewers, or sum / impressions. That number = **subjective value created** for post P. Store it as the **post score** (or as a second score alongside platform quality).
4. **Creator (Kurral):** For each creator, aggregate the "subjective value created" of their posts: e.g. sum over last 30 days, or average, or weighted by recency. Kurral = f(subjective value created by their posts, violations, engagement, …). So creators are scored by **how much subjective value their posts created** for viewers.

So the algorithm is: **post score = aggregate of (value to viewer) over viewers who saw the post; creator score = aggregate of those post scores over the creator's posts.**

### Cold start: new post has no viewers yet

A new post has zero viewers, so we can't yet compute "average value to viewers." Options:

- **Option A — Predicted value until we have data:** For a new post, use **expected** subjective value: e.g. average "value to U" over a representative sample of users (using the distribution of user weights). So we approximate "if we showed this post to our user base, what would the average value to viewers be?" Store that as the initial post score. Once the post has real viewers, **blend** predicted with actual: e.g. score = (1 − α) × predicted + α × actual, where α grows with number of viewers (e.g. α = min(1, viewer_count / 100)).
- **Option B — Platform quality until we have data:** Use **platform quality** (our bar) as the post score until we have enough viewers (e.g. 50 or 100); then switch to (or blend with) "average value to viewers." So new posts are scored by our bar; older posts with traffic are scored by subjective value created.

Either way, we always have a post score; for new posts it's predicted or platform quality, for posts with viewers it's (or blends in) actual subjective value created.

### Exposure: don't just reward "shown to more people"

If we used **sum** of value to viewers, a post shown to 1M people would beat a post shown to 100 even if the second post was more valuable per person. So we **normalize**:

- Use **average** value to viewers (not sum), or
- Use **value per impression** (sum of value to viewers ÷ impressions), or
- Use **fraction of viewers who found it valuable** (e.g. above threshold).

Then "subjective value created" reflects **how valuable the post was to the people who saw it**, not just how many people saw it.

### Summary: algorithm using subjective value created

| Step | What we do |
|------|------------|
| 1. Per impression | When we show post P to user U, compute value to U = (P's dimensions) · (U's weights). Log it (post P, user U, value to U). |
| 2. Post score | Periodically, for each post P: aggregate over viewers who saw P — e.g. average value to viewers, or value per impression. That = **subjective value the post has created**. Store as post score (or second score). Cold start: use predicted value (expected over user distribution) or platform quality until we have enough viewers; then blend in actual. |
| 3. Creator score (Kurral) | Kurral = f(subjective value created by creator's posts over last 30d, violations, engagement, …). So creator is scored by **how much subjective value their posts created** for viewers. |

So **yes** — we can create an algorithm that uses **subjective value the post has created** (aggregate of value to viewers) to score the post and, in turn, score the creator (Kurral). The cost is we need to track (or approximate) who was shown each post and to compute value to each viewer; and we need a cold-start rule for new posts (predicted value or platform quality until we have real viewer data).

---

## How do we measure subjective value per user? How good is it? Is it gameable?

### How we measure "subjective value per user"

We measure **value to user U** for a post P with a single formula:

**Value to U = (post P's five dimension scores) · (user U's five weights)**

So:
- **Post side:** We have five numbers per post — epistemic, insight, practical, relational, effort (from the current pipeline). Same for everyone.
- **User side:** We have five weights per user — how much U cares about epistemic, insight, practical, relational, effort. Those weights sum to 1 (or we normalize). They differ per user.
- **Value to U:** One number = epistemic_P × weight_e(U) + insight_P × weight_i(U) + … for all five. That's "how valuable is this post to user U" under our definition.

So **subjective value per user** = that one number per (post, user). We get it by combining **post dimensions** (we already have) with **user weights** (we need to get).

**How we get user weights (two ways):**

| Method | What we do | Pros | Cons |
|--------|------------|------|------|
| **Stated** | User sets sliders or choices: "I care more about accuracy / new ideas / tips / community / depth." We save five weights (or map choices to weights). | Transparent, controllable, easy to explain. | Users may not set them; can be set once and forgotten; coarse. |
| **Inferred** | From behavior: user bookmarks/reposts/saves posts → we infer they value those posts. We estimate weights by fitting: "what weights would make value-to-U high for posts they engaged with and low for posts they didn't?" (e.g. regression or model). | No extra UI; adapts over time. | Cold start (new user has no behavior); noisy; we must define "positive" vs "negative" (e.g. bookmark = positive, skip = negative). |

**Best:** Support both. Default weights (or from segment) until we have data; optional sliders so users can override; refine from behavior over time.

So the **measurement** of subjective value per user is: **value to U = (P's dimensions) · (U's weights)**, where U's weights come from stated preferences and/or inferred from behavior.

---

### Can we use only inferred (bookmarks, reposts, comments/replies) and skip stated?

**Yes.** We can drop sliders and use **only** inferred weights from behavior: **bookmarks, reposts, and comments/replies**. No "I care more about…" UI; weights come entirely from what users do.

**How it works:**

1. **Positive signals:** User bookmarks a post, reposts it, or **comments/replies** on it → we treat that as "user engaged with this post" (signal of value). We have the post's five dimension scores. So we have (user U, post P, positive).
2. **Negative or neutral:** User was shown post P but did not bookmark, repost, or comment/reply (and maybe scrolled past quickly) → we treat that as "user did not value this post as much" (or neutral). So we have (user U, post P, negative or neutral).
3. **Fit weights:** For each user U, we have a set of posts they engaged with (positive) and posts they were shown but didn't engage with (negative/neutral). We estimate five weights for U so that **value to U** = (P's dimensions) · (U's weights) is **higher** for positive posts and **lower** for negative/neutral posts. That's a simple regression or ranking model: find weights that best separate "engaged" from "not engaged" by dimension scores.
4. **Use weights:** Once we have U's weights, we compute value to U for any post the same way: (post dimensions) · (U's weights). Use for ranking, "value to you," and (if we aggregate) "subjective value created."

**Signals we use (inferred only — bookmark, repost, comment/reply):**

| Signal | Count as "valued"? | Notes |
|--------|--------------------|--------|
| **Bookmark** | Yes (strong) | User chose to save; clear signal they found it valuable. |
| **Repost** | Yes (strong) | User chose to share; strong signal of value. |
| **Comment / reply** | Yes (weaker) | User engaged with the post; comments can be negative (disagreement, criticism) so treat as weaker than bookmark/repost — e.g. weight 0.5 when fitting or when aggregating "value created." |
| **Shown but no bookmark/repost/comment** | Negative or neutral | For fitting "low value to U." |

We use **bookmark, repost, and comment/reply** as positive signals. No likes or time spent. Treat "shown but no bookmark, repost, or comment/reply" as negative or neutral. **Caveat:** Comments/replies can express disagreement or criticism, so we treat them as a **weaker** positive (e.g. weight 0.5 in the fitting or in "subjective value created") unless we later add sentiment/role (e.g. only count "answer" or "supportive" comments as full positive). Fit weights per user when we have enough data (e.g. 10+ positive and 20+ negative/neutral examples).

**Pros of inferred-only:**

- **No extra UI** — no sliders or onboarding questions; simpler product.
- **No stated-preference gaming** — users can't set weights to game; only behavior counts.
- **Adapts over time** — as they bookmark, repost, and comment/reply more, weights update.
- **Revealed preference** — we use what they actually do, not what they say.
- **Comments/replies** add a third engagement signal so we have more data per user (especially for people who comment more than they bookmark/repost).

**Cons of inferred-only:**

- **Cold start** — new user has no bookmarks, reposts, or comments/replies. We need a **default**: e.g. equal weights (0.2 each), or segment default, or use platform quality for ranking until we have enough data (e.g. 5–10 bookmarks + reposts + comments). Then switch to inferred weights.
- **Noisier** — bookmark might mean "save for later"; repost might be performative; **comment/reply can be negative** (disagreement, criticism). So we weight comment/reply as weaker (e.g. 0.5) unless we add sentiment or thread role. Inferred weights are approximate; we can smooth (e.g. regularize toward default) or require minimum engagement before trusting weights.
- **Less transparent** — we can't say "you said you care about accuracy"; we can say "based on what you've saved, shared, and replied to, we think you care about accuracy and practical tips." That's still explainable but less direct.

**Cold start (inferred-only):**

- **New user (no or few bookmarks/reposts/comments):** Use **default weights** — e.g. equal (0.2, 0.2, 0.2, 0.2, 0.2) or platform default. Rank by platform quality + relevance until we have enough behavior (e.g. 10+ bookmarks + reposts + comments/replies). Then start fitting and using inferred weights.
- **Ongoing:** Periodically refit weights (e.g. weekly) from last N positive engagements (bookmark, repost, comment/reply — with comment/reply optionally weighted 0.5) and last M shown-but-not-engaged posts. Store the five weights per user; use them for value-to-U and (if we use it) subjective value created.

**Summary:** We use **only** inferred weights from **bookmarks, reposts, and comments/replies**. No stated preferences; no likes or time spent. Positive = bookmark, repost, or comment/reply (comment/reply as weaker, e.g. weight 0.5); negative/neutral = shown but none of those; fit user weights to separate those by dimension scores; use default weights for cold start. Simpler product, no sliders; we pay with cold start and noisier inference (comments can be negative).

---

### We cannot do dimension-based value measurement for all posts

**We cannot** apply this kind of value measurement (dimensions · user weights, or "subjective value created" from bookmarks/reposts/comments) to **all** posts. Reason: in the current system, many posts **never get dimension scores** — e.g. posts about personal life, opinion, experience, humor, questions, greetings. Those posts exit the pipeline early and have **no** `valueScore` (no epistemic, insight, practical, relational, effort). So we have no dimension vector to multiply by user weights; we cannot compute "value to U" or "subjective value created" for them.

So:

- **Posts that get value scored** (full pipeline: pre-check → claims → fact-check → value scoring): we have five dimension scores. We can use bookmark, repost, and comment/reply to infer user weights and compute value to U and (if we aggregate) subjective value created. Dimension-based value measurement **applies** to these posts.
- **Posts that do not get value scored** (early exit: no fact-check needed, or no claims extracted): we have **no** dimension scores. We cannot compute value to U = (dimensions) · (weights). We can still use bookmark, repost, and comment/reply as **raw engagement signals** (e.g. "this post was bookmarked, reposted, or commented on a lot") for ranking or for a separate "popular with you" surface, but we **cannot** fold them into the same dimension-based "value to you" or "subjective value created" framework. So dimension-based value measurement **does not apply** to those posts.

Implication: when we use **bookmark, repost, and comment/reply** for inferred weights, we fit weights from posts that **have** dimension scores (posts that went through the full pipeline). Posts without dimension scores (personal-life, opinion, experience, humor, etc.) are excluded from the fitting data and from "value to you" / "subjective value created" — they simply don't have dimensions to combine with weights. How the current system decides which posts get value scored (and which exit early) is described in the next section, with code references.

---

### How the current system handles different post types (codebase)

The following is taken from the **actual codebase** (no assumptions). It describes when a post gets a value score and when it does not, and what happens in each case.

**1. Pre-check: when do we skip fact-check (and thus never run value scoring)?**

**File:** `functions/src/services/pipeline/steps/precheck.ts`

- The pre-check agent returns `needsFactCheck: boolean` and `contentType`: one of `"factual" | "news" | "opinion" | "experience" | "question" | "humor" | "other"` (see schema and `SYSTEM_PROMPT`).
- **CLASSIFY AS NO FACT-CHECK NEEDED** (`needsFactCheck=false`): pure opinions ("I think...", "In my opinion..."), personal experiences ("I went to...", "My day was..."), questions without embedded claims, jokes/memes/humor, greetings, small talk, emotional expressions.
- **File:** `functions/src/services/pipeline/index.ts` (lines 149–178): **If `!needsFactCheck`**, the pipeline returns immediately with `result` that has `claims: []`, `factChecks: []`, `factCheckStatus: 'clean'`, and **no `valueScore`**. It calls `saveChirpResult(chirp.id, result)` and `queueSideEffects(chirp, result)`. So **opinion, experience, humor, question, greetings, small talk, emotional** posts **never** get value scored; they exit after pre-check.

**2. Extract claims: when do we exit without value scoring even after pre-check said "needs fact-check"?**

**File:** `functions/src/services/pipeline/index.ts` (lines 209–234)

- After extract-claims step, **if `claims.length === 0`**, the pipeline returns with `result` that has `preCheck`, `claims: []`, `factChecks: []`, `factCheckStatus: 'clean'`, and **no `valueScore`**. So posts that needed fact-check but had **no extractable claims** also **never** get value scored.

**3. When does a post get a value score?**

**File:** `functions/src/services/pipeline/index.ts` (lines 281–355)

- Value scoring runs only when we **did not** early-exit: i.e. `needsFactCheck === true` and `claims.length > 0`. Then we run step 4 (score value), get `valueScore`, and save it in the result. So a post gets `valueScore` **only if** it passed pre-check with needsFactCheck and had at least one extracted claim.

**4. Side effects for posts that have no value score (early exit)**

**File:** `functions/src/services/pipeline/sideEffects.ts`

- **updateReputation (recordPostValue):** `if (!result.valueScore) return;` (lines 59–61). So for early-exit posts (no valueScore), we **do not** call `recordPostValue`. Their value is **not** added to the author's `valueStats` (postValue30d, lifetimePostValue, etc.). **Code:** `functions/src/services/reputationService.ts` — `recordPostValue` is only invoked from sideEffects when `result.valueScore` exists; it uses `valueScore.total` to record contribution.
- **updateKurral:** `hasUpdates = Boolean(result.valueScore || result.factCheckStatus || result.factChecks.length > 0)` (lines 81–90). For early exit, `result.valueScore` is undefined, `result.factCheckStatus` is `'clean'`, `result.factChecks` is `[]`. So `hasUpdates` is true (because `'clean'` is truthy). So we **do** call `updateKurralScore` for early-exit posts, but with **`valueScore: undefined`**. **File:** `functions/src/services/kurralScoreService.ts` — when `context.valueScore` is undefined, `getQualityScore(valueScore)` is not used for the new post; the code uses `previousComponents?.qualityHistory ?? 50` / 100 for the quality component (line 122). So Kurral is updated but **no new quality signal** is contributed by that post; the creator's Kurral does not go up or down from this post's "value."

**5. Feed ranking: posts without value score**

**File:** `shared/lib/algorithm.ts` (lines 342–356)

- Value score is applied only **if (chirp.valueScore)**. So posts **without** `valueScore` get **no value boost and no value penalty**. They still get other signals (following, interests, bookmarks, recency, fact-check status, etc.). They are still **eligible** for the feed (eligibility is not gated on valueScore; see `isChirpEligibleForViewer`).

**6. Most Valued: posts without value score**

**File:** `src/webapp/lib/services/mostValuedService.ts` (lines 122, 136); same logic in `src/webapp/lib/services/mostValuedService.js` (lines 92, 102)

- The query uses `where('valueScore.total', '>=', minValue)` and `orderBy('valueScore.total', 'desc')`. So posts **without** a `valueScore` field (or with no `valueScore.total`) are **excluded** from the Most Valued feed — the query requires the field to exist and meet the threshold.

**7. Dashboard value stats**

**File:** `src/webapp/pages/DashboardPage.tsx` (lines 143–163); same in `DashboardPage.js`

- Value-related stats (total value, average value, high-value count, low-value count) are computed only over **posts that have `valueScore`**: e.g. `postsWithValue = allPosts.filter(p => p.valueScore)`. So posts without valueScore are **excluded** from dashboard value stats.

**8. UI: value badge**

**File:** `src/webapp/components/ChirpCard.tsx`, `ChirpCard.js`, `PostDetailView.tsx`, `FactCheckStatusPopup.tsx`

- The value score (e.g. "Value: 78") is shown only when **`chirp.valueScore`** exists. Posts without valueScore do not show a value badge.

**Summary (current system):**

| Post type | Pre-check | Claims | Value scored? | recordPostValue? | Kurral (this post) | Feed (value) | Most Valued | Dashboard value stats |
|-----------|-----------|--------|----------------|------------------|---------------------|--------------|-------------|------------------------|
| Opinion, experience, humor, question, greetings, small talk | needsFactCheck=false | — | **No** | No | No new quality | No boost/penalty | Excluded | Excluded |
| Factual but 0 claims extracted | needsFactCheck=true | 0 | **No** | No | No new quality | No boost/penalty | Excluded | Excluded |
| Factual, ≥1 claim | needsFactCheck=true | >0 | **Yes** | Yes | Yes (quality from valueScore) | Boost/penalty | Included | Included |

So **personal-life / opinion / experience / humor** (and similar) posts **do not** get dimension-based value measurement in the current system. They have no `valueScore`; they don't contribute to valueStats or to Kurral quality from this post; they don't appear in Most Valued; they don't get value boost/penalty in the feed. If we add inferred (bookmark, repost, comment/reply) value measurement, it **only applies to posts that have dimension scores** — i.e. posts that went through the full pipeline. For posts without dimension scores, we cannot compute "value to U" or "subjective value created" in the same framework; we can only use bookmark, repost, and comment/reply as raw engagement signals elsewhere if we choose.

---

### If we only score factual posts, users only "earn" from factual posts — how do we mitigate? (vs X / general social media)

**Problem:** In the current system, only posts that get a value score (factual, with claims) contribute to valueStats (postValue30d, lifetimePostValue) and to Kurral quality from that post. So **earning / recognition / future monetization** is effectively limited to **factual posts**. Users who post mostly opinion, experience, humor, or personal updates don't accumulate "value" from those posts; they don't appear in Most Valued; they don't get value boost in the feed. That's different from general social media (e.g. X/Twitter), where **any** content can drive engagement (likes, retweets, replies) and creator monetization (ads, subscriptions) — so creators can earn from all post types. If we don't mitigate, we risk: (1) fewer incentives for users who prefer non-factual content, (2) perception that "you can only earn if you post factual claims," (3) a narrower creator base than X-like platforms.

**How we mitigate (options, with code-level implications):**

**1. Run value scoring for all posts (don't early-exit without scoring)**

**Idea:** Do **not** return early when `!needsFactCheck` or `claims.length === 0`. Instead: skip only the **fact-check step** (no claims to verify), but **always run value scoring**. So every post gets a value score (five dimensions + total). For posts that skipped fact-check, we pass `claims = []`, `factChecks = []` into the value scorer; epistemic is already capped at 0.35 when there are no fact-checks (see `applyFactCheckPenalty` in `valueScoringAgent.ts`). So opinion/experience/humor posts get scored on insight, practical, relational, effort and capped epistemic — and they **do** get `valueScore`, so they **do** contribute to valueStats, Kurral, Most Valued, and feed value boost.

**Code change:** In `functions/src/services/pipeline/index.ts`, when `!needsFactCheck` (lines 149–178) or when `claims.length === 0` (lines 209–234), **do not** return immediately. Instead: (a) set `factChecks = []`, `factCheckStatus = 'clean'`; (b) call the value scoring step (same as step 4) with `chirp`, `claims`, `factChecks`; (c) attach `valueScore` to the result; (d) then save and run side effects. So `recordPostValue` and `updateKurralScore` run for these posts too, with a real `valueScore`. Users then "earn" from all posts — factual posts can have high epistemic; non-factual posts have capped epistemic but can still score high on insight, practical, relational, effort.

**Pros:** One system for all posts; everyone can accumulate value and Kurral from every post; Most Valued and feed can include high-quality opinion/experience/humor. **Cons:** We run value scoring on more posts (cost); epistemic is capped for non-factual so "factual quality" is still distinguished.

**2. Separate track: "value" (factual) vs "audience value" (all posts)**

**Idea:** Keep current behavior for **platform quality** (value score only for factual posts). Add a **second** track for **all** posts: e.g. "audience value" or "engagement value" = bookmark count + repost count (or quality-weighted), or "subjective value created" from bookmarks/reposts per impression. Use **platform quality** for Most Valued, Kurral quality component, and high-weight earning. Use **audience value** for a separate surface (e.g. "Popular with you," "Most bookmarked") and for a **second component** of earning/recognition: e.g. earning = α × (value from factual posts) + (1 − α) × (audience value from all posts). So users who post mostly non-factual content can still earn from the audience-value track.

**Code implications:** Track bookmarks/reposts per post (and optionally per impression). For posts **without** valueScore, define an "audience value" score (e.g. normalized bookmark+repost rate). In valueStats or a parallel structure, accumulate both "postValue30d" (from valueScore, factual only) and e.g. "audienceValue30d" (from all posts). Kurral (or monetization formula) could blend both: e.g. qualityScore = 0.6 × qualityFromValueScores + 0.4 × audienceValueScore. So creators who post mostly opinion/experience still accumulate audience value and get recognition.

**Pros:** Clear separation: "our bar" (factual quality) vs "audience found this valuable" (all posts). **Cons:** Two systems to maintain; need to define and defend the blend (α).

**3. Weight earning by post type (factual full weight, non-factual partial)**

**Idea:** If we **do** run value scoring for all posts (option 1), we can still **weight** how much each post contributes to valueStats and Kurral by post type. E.g. factual posts (with fact-checks) contribute full `valueScore.total`; non-factual posts (no fact-checks) contribute e.g. 0.3 × valueScore.total or a cap (e.g. max 0.5 per post). So users "earn" from all posts, but **factual posts count more** toward valueStats and Kurral. That preserves incentive for factual quality while still giving some recognition for non-factual.

**Code implications:** In `recordPostValue` (or wherever we add value to valueStats), multiply the contributed value by a weight: e.g. `weight = result.claims?.length > 0 && result.factChecks?.length > 0 ? 1 : 0.3`. So non-factual posts add less to postValue30d and lifetimePostValue. Kurral quality component could use the same weighted sum. So everyone can earn from every post, but factual posts drive more of the total.

**Pros:** Single pipeline (value score for all); simple adjustment (one weight). **Cons:** Arbitrary factor (0.3 or cap); need to explain to users why "opinion posts count less."

**4. Two surfaces: "Most Valued" (factual) + "Popular" or "Most saved" (all posts)**

**Idea:** Keep **Most Valued** as "top by platform quality" (valueScore.total) — so it stays factual-heavy. Add a **second** surface: e.g. "Popular with you" or "Most saved/reposted" that ranks by bookmark+repost count (or rate) for **all** posts. So opinion/experience/humor can surface in "Popular" even if they don't have a value score. Recognition: "Most Valued" badge for factual quality; "Popular" or "Most saved" badge for audience engagement. Monetization/earning could use both: e.g. eligibility from Kurral (factual quality) + a bonus or separate tier from "Popular" performance. So we don't force all earning through factual-only; we give a path for non-factual creators too.

**Code implications:** Most Valued stays as today (query by valueScore.total). Add a new query or feed: e.g. order by (bookmarkCount + repostCount) or by quality-weighted bookmark/repost, for posts in a time window; no requirement for valueScore. So posts without valueScore can appear in "Popular." Product copy: "Most Valued = top by our quality bar; Popular = most saved and shared by the community."

**Pros:** Clear semantics; aligns with "value" vs "engagement" distinction. **Cons:** Two leaderboards/surfaces to maintain and explain.

**Summary — how we mitigate:**

| Option | What changes | Effect on earning/recognition |
|--------|----------------|--------------------------------|
| **1. Value score all posts** | No early-exit without value scoring; run value scoring for opinion/experience/humor with claims=[], factChecks=[]. | All posts contribute to valueStats and Kurral; users earn from every post. Epistemic capped for non-factual. |
| **2. Two tracks (value + audience value)** | Keep value score for factual only; add "audience value" (bookmark/repost) for all posts. Blend in valueStats/Kurral. | Factual posts drive "value" track; all posts drive "audience value" track; earning = blend of both. |
| **3. Weight by post type** | Value score all posts (option 1) but weight contribution: factual = 1, non-factual = 0.3 (or cap). | Everyone earns from every post; factual posts count more. |
| **4. Two surfaces (Most Valued + Popular)** | Most Valued = valueScore (factual-heavy). Add "Popular" / "Most saved" = bookmark+repost for all posts. | Recognition and earning can include "Popular" so non-factual creators have a path. |

**Recommendation:** Option **1** (value score all posts) is the smallest code change and removes the "only factual posts earn" limitation; option **3** (weight by post type) can be added on top if we want factual posts to count more. Option **2** or **4** are good if we want to keep "value" strictly factual and add a separate "audience/engagement" track for all posts — closer to X-like "any content can drive engagement and recognition."

---

### How good is the framework?

**Strengths:**

- **Interpretable:** "Value to you" = your weighted mix of the same five dimensions we already use. We can explain: "we ranked this high because it scores well on accuracy and practical tips, which you care about."
- **Uses existing infra:** We keep the five dimension scores per post; we only add user weights and the dot product. No new content pipeline.
- **Aligns with "value is subjective":** The score depends on who is looking (user weights). Same post → different value for different users.
- **Testable:** We can A/B test ranking by "value to you" vs platform quality and measure engagement, satisfaction, retention.
- **Works for "subjective value created":** We can aggregate (e.g. average value to viewers) to score the post and the creator by value created for viewers.

**Weaknesses:**

- **Dimensions are still our choice:** We're not measuring "true" subjective value; we're measuring "value under our five dimensions with your weights." So it's subjective *within* our framework, not open-ended.
- **Stated weights:** Users may not set them or may set them strategically; sliders are coarse (five dimensions only).
- **Inferred weights:** Noisy (behavior has many causes); cold start for new users; we must choose what counts as "valuing" (e.g. save vs like vs time).
- **Not direct utility:** We never observe "how much did you value this?" directly. We approximate with weights × dimensions (or with behavior as a proxy). So "value to you" is a **model**, not a ground-truth measure.

**Verdict:** The framework is **good for** making ranking and "value to you" depend on the viewer in a clear, implementable way. It's **not perfect** — it's a structured approximation of subjective value (our dimensions + your weights), not a direct read of "how much you valued this." For product use (ranking, "Valued for you," and aggregate "subjective value created"), it's a reasonable and improvable framework.

---

### Is it gameable?

**Yes.** There are several ways to game it; how bad they are depends on how we use the score and what we do to limit abuse.

**1. Gaming stated weights (to change your own feed)**

- **Attack:** User sets weights to favor a certain type of content (e.g. max weight on "insight") so that high-insight posts rank higher for them. That's **legitimate preference** — we want feed to reflect what they value. So that's not really "gaming" in a bad sense.
- **Attack:** User sets weights to try to get their *own* posts to rank higher in *others'* feeds. But "value to you" is computed per viewer; your weights only affect *your* feed. So your weights don't directly change how others see your post. So this vector is **limited** unless we later use stated weights for something else (e.g. recommended viewers for a post).

**2. Gaming inferred weights (to change your own feed)**

- **Attack:** User deliberately bookmarks/saves only one type of content to push inferred weights (e.g. only save high-effort posts so we infer they care about effort). Then feed becomes skewed. That's **personalization gaming** — they get more of what they "trained" us to show. Impact: their feed is narrow; they might get bored or miss diversity. Mitigation: cap how much one dimension can dominate; add diversity; or blend inferred weights with stated/default so extreme behavior doesn't fully control the feed.

**3. Gaming "subjective value created" (to inflate post or creator score)**

- **Attack:** Creator (or ally) uses many fake or coordinated accounts that "view" their posts. Each account has weights chosen so that **value to U** is high for those posts (e.g. accounts with high weight on "insight" view high-insight posts). Then **average value to viewers** is artificially high → post score and Kurral go up.
- **Why it works:** "Subjective value created" = aggregate of value to viewers. If most "viewers" are sybils with weights that favor the post, the average is high.
- **Mitigations:**
  - **Count only real viewers:** Require accounts to pass basic integrity (e.g. not new, some history, not same cohort across many posts). Exclude or down-weight viewers that look fake or coordinated.
  - **Diversity of viewers:** Require that "value to viewers" is computed over a diverse set of viewers (e.g. many different weight profiles). If all viewers have the same profile, discount or flag.
  - **Blend with platform quality:** Post score = α × (average value to viewers) + (1 − α) × (platform quality). So gaming "value to viewers" has limited impact unless we're confident the viewers are real. Same for Kurral: blend subjective value created with platform quality so sybil viewers can't fully dictate creator score.
  - **Minimum exposure:** Only use "subjective value created" once a post has many *distinct* viewers (e.g. 100+). Before that, use platform quality or predicted value. That raises the cost of sybil attacks.

**4. Gaming dimension scores (same as today)**

- **Attack:** Gaming the *post* dimensions (epistemic, insight, etc.) — e.g. hedging, effort inflation, relational manipulation — still works as in the current system. "Value to U" = dimensions · weights; if dimensions are gamed, value to U is gamed too. So all the hardening we discussed for the five dimensions (fact-check, epistemic cap, etc.) still applies. Subjective value doesn't remove that; it only adds the **weight** side (user) on top.

**Summary — is it gameable?**

| What | Gameable? | Main risk | Mitigation |
|------|------------|-----------|------------|
| Stated weights | Mostly benign (user shapes own feed) | Strategic sliders to skew own feed | Limit impact; blend with inferred/default |
| Inferred weights | Yes (behavior to skew inference) | Narrow, self-reinforcing feed | Diversity; cap dominance; blend with stated |
| Subjective value created (post/creator) | Yes | Sybil viewers with favorable weights | Real-viewer checks; viewer diversity; blend with platform quality; minimum exposure |
| Dimension scores | Yes (same as today) | Inflated epistemic/insight/effort etc. | Keep existing hardening (fact-check, epistemic gate, etc.) |

**Verdict:** The framework is **gameable**, especially "subjective value created" for post/creator scoring (sybil viewers). It's **not uniquely fragile** — the dimension side is as gameable as today, and we add viewer-side gaming. We can **reduce** gaming by: (1) treating viewers as untrusted and requiring real, diverse viewers before trusting "average value to viewers"; (2) blending subjective value created with platform quality so gaming has limited payoff; (3) keeping all existing dimension-level hardening. With those, the framework can be **reasonably robust** for product use, but it won't be "unbreakable."
