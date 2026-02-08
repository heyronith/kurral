# A Framework for Scoring Based on Subjective Values

**If this doc feels too abstract, read [SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md](./SUBJECTIVE_VALUE_SIMPLE_EXPLANATION.md) first** — same ideas in plain language with an analogy and step-by-step.

**Goal:** Define a process and framework for building an algorithm that scores content based on *subjective* values — i.e. value as it varies by who is evaluating (the viewer, the segment, or the context), not a single platform-wide "quality" number.

This doc assumes the premise: **value is subjective.** So the score must depend on the evaluator. The framework below is the best process I can articulate for doing that rigorously.

---

## 1. What “Scoring Based on Subjective Values” Means

### 1.1 Operational definition

**Subjective value** is not a property of the post alone. It is a relation: **value of post P to evaluator E** (or to segment S, or in context C).

So we need one of:

- **Value to user:** `V(P, U)` — how valuable is post P to user U?
- **Value for segment:** `V(P, S)` — how valuable is P to users in segment S? (persona, interest cluster, etc.)
- **Value in context:** `V(P, U, C)` — how valuable is P to U in context C (e.g. “browsing for tips” vs “research mode”)?

The algorithm’s job is to **compute that relation** and use it for ranking, “value to you” feeds, and (if we aggregate) for collective surfaces like “Most Valued.”

### 1.2 Implication for the system

- We **cannot** have a single `valueScore` per post that ignores the viewer and still call it “subjective value.”
- We **can** have:
  - **Post-level features** (dimension scores, fact-checks, topic, etc.) that are **evaluator-independent**, and
  - **Evaluator-level parameters** (weights, embedding, preferences, segment), and
  - **Score = combine(features, evaluator)** at the moment we need it (e.g. at ranking time).

So the framework separates: (1) **content representation** (what we know about the post), (2) **evaluator representation** (what we know about who is valuing), (3) **combination rule** (how we define V(P, E)).

---

## 2. The Best Process: Five Steps

A robust process for subjective-value scoring has five steps. Order matters.

### Step 1: Define “value” operationally

**Decide what “value to user” (or segment) means in practice.**

Options:

- **A. Utility / satisfaction:** “Value to U = expected utility or satisfaction U gets from seeing/engaging with P.” We never observe utility directly; we approximate it (see Step 2).
- **B. Weighted dimensions:** “Value to U = weighted sum of dimension scores (epistemic, insight, practical, relational, effort), where weights are U’s preferences.” Transparent, controllable; requires getting weights.
- **C. Engagement / outcome:** “Value to U = predicted probability (or expected strength) of a positive outcome for U (e.g. bookmark, share, long read, return).” Revealed preference; requires choosing which outcomes count as “value.”

Choose one (or a hybrid) and write it down. Example: *“Value to user U = weighted sum of the five dimension scores with U’s weights, where weights are inferred from U’s engagement history; we validate by testing whether ranking by this score improves engagement and satisfaction over baseline.”*

**Why this first:** Without an operational definition, “subjective value” stays vague and the algorithm has no target.

---

### Step 2: Elicit or infer the evaluator’s “values”

**Get the parameters that make value subjective — i.e. that differ by user or segment.**

Ways to get evaluator-specific parameters:

| Method | What we get | Pros | Cons |
|--------|-------------|------|------|
| **Stated preferences** | User sets sliders or choices: “I care more about accuracy / insight / practical tips / community / depth.” → weights per dimension. | Transparent, controllable, auditable. | Users may not set them; coarse; can be gamed if incentives misalign. |
| **Inferred from behavior** | From engagement (bookmarks, time, shares, skips) infer weights or a preference embedding. | No extra UI; adapts over time. | Cold start; opaque; need to define “positive” vs “negative” behavior. |
| **Segment / persona** | Assign user to segment (e.g. “truth-seeker,” “practical,” “community”) with segment-level weights. | Stable, interpretable; good when we have few segments. | Coarse; within-segment variation ignored. |
| **Behavioral ground truth** | Don’t store weights; train a model: `P(positive outcome \| post, user)` and use that as “value to user.” | Directly tied to what users do. | Need to choose outcome; engagement can be gamed; cold start. |

**Best practice:** Prefer a **hybrid**. For example:

- **Default:** Segment-level or global-default weights (from surveys or power users).
- **Override:** Let users optionally set sliders (stated preferences).
- **Refinement:** Update weights or preference embedding from behavior (inferred), with stated preferences as prior or constraint.

**Why this second:** Subjective value requires a representation of *who* is valuing. Without evaluator parameters, we only have platform quality.

---

### Step 3: Define the combination rule

**Specify how content representation and evaluator parameters combine into V(P, E).**

**Option A — Weighted dimensions (interpretable):**

- **Content:** Post has dimension vector `d = (epistemic, insight, practical, relational, effort)` (from current or improved pipeline).
- **Evaluator:** User (or segment) has weight vector `w = (w_e, w_i, w_p, w_r, w_f)` summing to 1.
- **Rule:** `V(P, U) = d · w` (dot product). So “value to you” = your weighted combination of the same dimensions.

**Option B — Embedding similarity (flexible):**

- **Content:** Post embedding `e_post` (from content + dimensions or from a model).
- **Evaluator:** User “value embedding” `e_user` (from preferences or behavior).
- **Rule:** `V(P, U) = similarity(e_post, e_user)` (e.g. cosine or dot product). So “value to you” = how well the post matches your value profile.

**Option C — Behavioral prediction (outcome-based):**

- **Content:** Post features + dimension scores.
- **Evaluator:** User id or user embedding.
- **Rule:** `V(P, U) = P(positive outcome | P, U)` from a model trained on historical behavior. So “value to you” = predicted likelihood you’ll find it valuable (by our chosen outcome).

**Option D — Hybrid (recommended):**

- Keep **dimension scores** as the content representation (interpretable, auditable).
- Use **user weights** (stated or inferred) for the combination: `V(P, U) = d · w(U)`.
- Optionally **blend** with a behavioral prediction: `V = α * (d · w) + (1 − α) * P(engage | P, U)` and tune α by validation.

**Why this third:** The combination rule is the actual algorithm. It must be explicit so we can implement and validate it.

---

### Step 4: Decide when and where to compute the score

**Subjective score depends on the evaluator, so we must compute it at a time we know who the evaluator is.**

- **At ranking time:** We have the viewer. Compute `V(P, viewer)` for each candidate post. No need to store “value to every user” (O(posts × users)); we only need post features and user parameters.
- **Stored per segment:** If we use segments, we can precompute `V(P, S)` per segment and store that for “value for segment S” feeds or analytics. Still not per-user unless we want to cache that.
- **Never:** Don’t store a single “value” per post and use it as “subjective value”; that’s platform quality.

**Recommendation:** Store **post-level features** (dimension vector, topic, fact-check summary, etc.). Store **user-level (or segment-level) parameters** (weights or embedding). Compute **value to user at read/ranking time** when we have the viewer.

**Why this fourth:** Architecture (what we store vs compute) determines feasibility and consistency with “subjective.”

---

### Step 5: Validate and iterate

**Check that the operational definition of “value” matches what we want in practice.**

- **Metric:** If value = weighted dimensions, do users with different weights get different rankings? If value = predicted engagement, does ranking by V(P, U) improve engagement/satisfaction vs ranking by platform quality alone?
- **Method:** A/B test. Control: rank by platform quality + relevance (current style). Treatment: rank by V(P, viewer) (subjective score) + relevance. Measure: clicks, time spent, bookmarks, shares, return visits, or stated satisfaction.
- **Iterate:** If treatment wins, we’re aligned. If not, refine: operational definition, elicitation (e.g. better inference of weights), or combination rule (e.g. blend with behavior).

**Why this fifth:** Subjective value is only meaningful if the algorithm produces outcomes we care about (engagement, satisfaction, trust). Validation closes the loop.

---

## 3. End-to-End Framework (Summary)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. OPERATIONAL DEFINITION                                                │
│    "Value to user U = weighted sum of dimension scores with U's weights" │
│    (or: predicted P(bookmark | P, U), etc.)                             │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. ELICITATION                                                           │
│    Stated: sliders, onboarding.  Inferred: behavior → weights/embedding. │
│    Segment: persona weights.  Ground truth: train on outcomes.           │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. COMBINATION RULE                                                      │
│    Content: dimension vector d (post).  Evaluator: weights w(U) or emb.  │
│    V(P,U) = d · w(U)  or  similarity(d, w(U))  or  model(P, U).          │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. COMPUTE AT RANKING TIME                                               │
│    Store: post features (d), user/segment params (w or embedding).        │
│    At request: for each candidate P, compute V(P, viewer); rank.        │
└─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. VALIDATE                                                              │
│    A/B: rank by V(P, viewer) vs rank by platform quality.                │
│    Measure: engagement, satisfaction, retention.  Iterate.               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Design Choices and Trade-offs

### 4.1 Stated vs inferred preferences

- **Stated:** User sees “I care more about: accuracy / new ideas / practical tips / community / depth.” Easy to explain (“we rank by what you said you value”). Risk: users don’t set them or set them once and forget; sliders can be coarse.
- **Inferred:** System learns from behavior. Adapts; no extra UI. Risk: cold start; “value” is opaque; we must define which behavior counts as “valuing” (e.g. bookmark = positive, skip = negative).

**Recommendation:** Support both. Default weights from segment or inference; allow optional sliders so users can override and so we can explain “we’re ranking by your preferences.”

### 4.2 Dimensions vs pure behavioral

- **Dimensions (epistemic, insight, practical, relational, effort):** Interpretable; we can show “why this is valuable to you” (your weights × post’s scores). Fits policy (e.g. epistemic floor). Requires maintaining dimension scores.
- **Pure behavioral (“value = P(engage)”):** Directly tied to engagement. No need to name dimensions. Harder to explain; risk of optimizing for clicks over long-term value.

**Recommendation:** Prefer **dimensions + user weights** as the main subjective score, and use **behavioral prediction** as a complement (e.g. for cold start or as a blend in validation). That way “value to you” stays explainable and policy-aware.

### 4.3 Cold start

- New user: we have no behavior and possibly no stated preferences. Options: (a) use segment default (e.g. “general” weights), (b) use platform-quality ranking until we have data, (c) ask 1–2 preference questions at onboarding.
- New post: we have dimension scores (from pipeline); we don’t need user-specific data to compute V(P, U) once we have U’s weights. So cold start is mainly a **user** problem, not a post problem.

### 4.4 Aggregation: “Most Valued” for a product

If “Most Valued” should reflect subjective value:

- **Option A — Per-user feed:** “Most Valued for you” = ranking by V(P, you). So each user gets a different list. No single global “Most Valued” surface.
- **Option B — Aggregate:** Define “collective value” e.g. “sum of value to each user who saw it” or “fraction of users for whom this is in top-K.” Then “Most Valued” = rank by that aggregate. Computationally heavier; requires defining the aggregate.
- **Option C — Keep platform quality for global:** “Most Valued” = top by platform quality (current); add a separate “For you” or “Valued for you” that uses V(P, you). Clear semantics: one is “our bar,” the other is “your values.”

**Recommendation:** Option C is the clearest: keep a global “Top by our criteria” and add “Valued for you” = rank by V(P, viewer). That aligns with “value is subjective” without overloading “Most Valued.”

---

## 5. How This Fits the Current Infra

- **Keep:** Post-level pipeline that produces **dimension scores** (epistemic, insight, practical, relational, effort) and fact-check signals. That’s the **content representation**; it stays evaluator-independent.
- **Add:** **Evaluator representation** — per-user (or per-segment) weights on the five dimensions (or a preference embedding). From sliders, inference, or segment.
- **Add:** **Combination at read time** — in `scoreChirpForViewer` (or equivalent), compute `valueToViewer = dimensionVector · viewerWeights` (or use viewer embedding). Use that instead of (or blended with) `chirp.valueScore.total` for the “value” component of the ranking score.
- **Rename/clarify:** Treat `valueScore.total` as **platform quality**; treat `valueToViewer` as **value to you**. Product copy and APIs can reflect that.
- **Validate:** A/B test ranking by valueToViewer vs by valueScore.total; measure engagement and satisfaction; iterate on elicitation and combination rule.

So the framework does **not** require throwing away the current engine. It requires (1) an operational definition of “value to user,” (2) a way to get user-specific parameters, (3) a combination rule at ranking time, and (4) validation. The current engine becomes the **content side**; the **evaluator side** and the **combination rule** are the new pieces.

---

## 6. Summary: Best Process for Subjective-Value Scoring

1. **Define operationally** what “value to user” (or segment) means — e.g. weighted dimensions with user weights, or predicted positive outcome.
2. **Elicit or infer** evaluator parameters — stated preferences (sliders), inferred from behavior, or segment defaults; hybrid is best.
3. **Define the combination rule** — e.g. V(P, U) = d · w(U); compute at ranking time from stored post features and user parameters.
4. **Compute at the right time** — store post features and user/segment parameters; compute subjective score when we have the viewer (e.g. in feed ranking).
5. **Validate and iterate** — A/B test ranking by subjective score vs platform quality; measure engagement and satisfaction; refine definition, elicitation, or rule.

The algorithm then **scores based on subjective values** by making the evaluator an explicit input and combining content representation with evaluator-specific parameters through a clear, testable rule. That is the process and framework that make subjective-value scoring coherent and improvable.
