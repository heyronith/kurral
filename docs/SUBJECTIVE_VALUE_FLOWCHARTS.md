# Subjective Value System — Flowcharts

**Purpose:** Explain the current and proposed infra in flowchart form. No new design — this only visualizes what’s in SUBJECTIVE_VALUE_IMPLEMENTATION_PLAN.md and SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md.

---

## 1. Post pipeline: from new post to stored score

**What happens when a new post is created and processed.**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NEW POST CREATED                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PRE-CHECK                                                                        │
│  • Is this factual (needs fact-check) or opinion/experience/humor/question?       │
│  • Output: needsFactCheck (true/false), contentType                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
            needsFactCheck = false                  needsFactCheck = true
            (opinion, humor, etc.)                  (factual)
                    │                                       │
                    │                                       ▼
                    │                       ┌───────────────────────────────────────┐
                    │                       │  EXTRACT CLAIMS                          │
                    │                       │  • Pull out verifiable claims from text   │
                    │                       │  • Output: claims[]                      │
                    │                       └───────────────────────────────────────┘
                    │                                       │
                    │                       ┌───────────────┴───────────────┐
                    │                       │                               │
                    │               claims.length = 0              claims.length > 0
                    │                       │                               │
                    │                       │                               ▼
                    │                       │               ┌───────────────────────────────┐
                    │                       │               │  FACT-CHECK                     │
                    │                       │               │  • Verify each claim           │
                    │                       │               │  • Output: factChecks[]         │
                    │                       │               └───────────────────────────────┘
                    │                       │                               │
                    └───────────────────────┴───────────────────────────────┘
                                        │
                                        │  TODAY: early exits (no fact-check path
                                        │         or 0 claims) → STOP HERE, no valueScore
                                        │
                                        │  PROPOSED (Step 1): no early exit without scoring
                                        │  For "no fact-check" or "0 claims": set claims=[],
                                        │  factChecks=[], factCheckStatus='clean', then continue
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  VALUE SCORING (same step for all paths)                                          │
│  • Input: post text, claims[], factChecks[]                                       │
│  • LLM scores five dimensions (0–1 each): epistemic, insight, practical,           │
│    relational, effort                                                             │
│  • If no fact-checks: epistemic capped at 0.35                                    │
│  • Apply fact-check penalties if any false verdicts                                │
│  • Domain weights (health vs tech vs general) → weighted sum                      │
│  • Output: valueScore = { epistemic, insight, practical, relational, effort,      │
│            total, confidence }                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SAVE TO POST                                                                     │
│  • Store valueScore on the post document (Firestore)                              │
│  • total = "platform quality" (one number per post, same for everyone)             │
│  • Five dimensions stored too (used later for "value to you")                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SIDE EFFECTS                                                                     │
│  • recordPostValue → update creator's valueStats (postValue30d, lifetimePostValue)│
│  • updateKurralScore → update creator's Kurral (quality from this post)           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Summary:** One pipeline produces **one valueScore per post** (five dimensions + total). Total = **platform quality**. Today only factual posts with claims get here; proposed Step 1 sends all posts through value scoring (with fact-check skipped when needed).

---

## 2. Where “platform quality” vs “value to you” are used

**Two different numbers; each used in specific places.**

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │  PER POST (stored once)                                      │
                    │  valueScore = { epistemic, insight, practical, relational,   │
                    │                effort, total, confidence }                    │
                    │  • total = PLATFORM QUALITY (our weights × dimensions)        │
                    │  • Same for every viewer                                      │
                    └─────────────────────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────────────┐
│  POST SCORE DISPLAY  │   │  "MOST VALUED" FEED  │   │  KURRAL (creator score)     │
│  e.g. "Quality: 78"  │   │  Sort by valueScore  │   │  Quality = f(platform       │
│  Use: valueScore     │   │  .total (platform    │   │  quality of creator's      │
│  .total              │   │  quality)            │   │  posts, violations, …)       │
└─────────────────────┘   └─────────────────────┘   └─────────────────────────────┘
          │                             │                             │
          │                             │                             │
          └─────────────────────────────┴─────────────────────────────┘
                                        │
                        All use PLATFORM QUALITY only (valueScore.total)
                        Same number for everyone.


                    ┌─────────────────────────────────────────────────────────────┐
                    │  PER VIEWER (computed at ranking time, not stored on post)   │
                    │  valueToViewer = (post's 5 dimensions) · (viewer's 5 weights)│
                    │  = "VALUE TO YOU"                                            │
                    └─────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FEED RANKING                                                                     │
│  When we build the feed for viewer U:                                              │
│  • For each candidate post: compute valueToViewer = dimensions · U's weights       │
│  • Use valueToViewer (or blend with platform quality) to order the feed          │
│  • Optional: show "Value to you: 85" when U is viewing a post                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Summary:** **Platform quality** = one number per post (total); used for display, Most Valued, Kurral. **Value to you** = computed when we have the viewer; used only for feed order (and optional “value to you” label).

---

## 3. How we get the viewer’s weights (inferred from behavior)

**We need five weights per user to compute “value to you.” We infer them from what they do.**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  USER BEHAVIOR (we log this)                                                       │
│  • Bookmarked post P     → positive signal (strong)                               │
│  • Reposted post P       → positive signal (strong)                               │
│  • Commented/replied on P → positive signal (weaker, e.g. 0.5)                    │
│  • Saw post P but did none of the above → negative/neutral                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ELIGIBLE POSTS FOR FITTING                                                       │
│  Only posts that have valueScore (five dimensions).                                │
│  For each such post user engaged with: we have (user U, post P, positive).        │
│  For each such post user saw but didn't engage: (user U, post P, negative/neutral). │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FIT WEIGHTS (e.g. regression or ranking model)                                   │
│  Find five weights for user U so that:                                             │
│  • valueToU = (P's dimensions) · (U's weights) is HIGH for posts U engaged with   │
│  • valueToU is LOW for posts U saw but didn't engage with                          │
│  Output: U's weights = [w_epistemic, w_insight, w_practical, w_relational,       │
│           w_effort] (sum to 1)                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STORE PER USER                                                                   │
│  Save U's five weights (e.g. in users/{userId} or separate collection).            │
│  Cold start: new user or too few engagements → use default weights (e.g.        │
│  0.2, 0.2, 0.2, 0.2, 0.2).                                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Summary:** Bookmarks, reposts, comments/replies are **inputs** to infer weights. The **output** is five numbers per user. We do **not** use raw bookmark/repost/comment counts as “value to you”; we use them to learn weights, then value to you = dimensions · weights.

---

## 4. Feed ranking flow (when you open the app)

**What happens when we build the feed for a specific viewer.**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  VIEWER U OPENS FEED                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  LOAD VIEWER'S WEIGHTS                                                            │
│  • Fetch U's five weights (from Step 3).                                          │
│  • If cold start (no or few engagements): use default weights (e.g. 0.2 each).   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FETCH CANDIDATE POSTS                                                            │
│  • Get posts eligible for U (e.g. from following, interests, recency).             │
│  • Each post has valueScore = { epistemic, insight, practical, relational,        │
│    effort, total } (if Step 1 is done, all posts have this).                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FOR EACH CANDIDATE POST P                                                         │
│  • valueToViewer = P.epistemic×U.we + P.insight×U.wi + P.practical×U.wp +         │
│                    P.relational×U.wr + P.effort×U.wf                              │
│  • (If we blend with platform quality: finalValue = α×valueToViewer +              │
│    (1−α)×P.total)                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  COMBINE WITH OTHER SIGNALS                                                        │
│  • Ranking score = f(valueToViewer, follow, recency, interests, …)                │
│  • Sort by ranking score                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  RETURN ORDERED FEED TO VIEWER                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Summary:** We have the viewer → we have their weights → for each post we compute value to viewer from dimensions · weights → we use that (possibly blended) to order the feed. No “value to you” is stored on the post; it’s computed at request time.

---

## 5. Optional: post score from “subjective value created” (aggregate over viewers)

**This is not in the 3-step plan. If we later want “post score = how much value this post created for everyone who saw it,” the flow would look like this.**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  WHEN POST P IS SHOWN TO VIEWER U (impression)                                     │
│  • We have P's five dimensions. We have U's five weights.                          │
│  • valueToU = (P's dimensions) · (U's weights)                                     │
│  • Log: (post P, viewer U, valueToU)                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                        (repeat for every impression of P)
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PERIODICALLY: AGGREGATE PER POST                                                  │
│  For each post P:                                                                  │
│  • Take all (viewer U, valueToU) where U was shown P                               │
│  • Post score from subjective value = aggregate of valueToU                        │
│    e.g. average(valueToU) or sum(valueToU)/impressions                             │
│  • Store as second score on P (or replace platform quality — design choice)       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Summary:** “Subjective value created” = we track who saw the post, compute value to each of them (dimensions · their weights), then average (or similar). That’s **not** “count of bookmarks/reposts/comments”; it’s aggregate of (value to U) over viewers who **saw** the post. Bookmarks/reposts/comments are used to **get** each U’s weights, not to define this aggregate.

---

## 6. One-page overview

```
  POST LIFECYCLE                    VIEWER / FEED

  New post                           User bookmarks / reposts / comments
       │                                        │
       ▼                                        ▼
  Pre-check ──► (no fact-check path or 0 claims)   Fit weights from behavior
       │         → still continue (Step 1)              │
       ▼                                                ▼
  Value scoring ──► valueScore on post            Store 5 weights per user
  (5 dimensions + total)                                  │
       │                                                  │
       ├── total = PLATFORM QUALITY                       │
       │   • Display on post                              │
       │   • Most Valued feed                             │
       │   • Kurral                                       │
       │                                                  │
       └── 5 dimensions ─────────────────────────────────┘
                                    │
                                    ▼
                          Viewer opens feed
                                    │
                                    ▼
                          For each post: valueToViewer = dimensions · viewer's weights
                                    │
                                    ▼
                          Rank feed by valueToViewer (or blend with platform quality)
```

---

**Doc refs:** SUBJECTIVE_VALUE_IMPLEMENTATION_PLAN.md, SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md.
