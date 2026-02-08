# Making Value Scoring Super Hard to Game

**Goal:** Harden the five-dimension value system so that gaming requires high effort, is detectable, and has limited payoff. This doc is ordered by implementation effort and ties each change to specific attack vectors from VALUE_SYSTEM_GAMING_ANALYSIS.md.

**Principles:**

1. **Evidence over judgment** — Tie scores to verifiable signals (fact-checks, structure, behavior) so LLM judgment alone can’t carry the score.
2. **Cross-dimension guardrails** — Don’t let insight/practical/relational/effort stay high when epistemic is low or missing.
3. **Detect, then penalize** — Detect gaming patterns (hedging, coordination, reputation farming) and apply deterministic penalties.
4. **Ground truth from behavior** — Use behavioral signals (engagement, citations, time) to validate and correct scores over time.

---

## Tier 1: Quick wins (current pipeline, no new infra)

These changes stay inside the existing pipeline and valueScoringAgent; they make common attacks harder without new services.

### 1.1 Epistemic-gate the other dimensions

**Problem:** Novel-but-false or polite-but-false posts get high insight/relational until fact-check penalty runs. Insight and relational are not explicitly tied to epistemic.

**Change:** After applying fact-check penalty, **cap insight and relational by epistemic** so they can’t outrun truth.

```typescript
// valueScoringAgent.ts, after applyFactCheckPenalty + validateVector
// Cap insight and relational by epistemic (no "high insight" without truth)
vector = {
  ...vector,
  insight: Math.min(vector.insight, Math.max(vector.epistemic, 0.35)),
  relational: Math.min(vector.relational, Math.max(vector.epistemic, 0.35)),
};
```

**Why it’s hard to game:** You can’t get high insight or high relational without at least moderate epistemic. Polite misinformation or “novel” false claims get capped.

**Vectors addressed:** Insight inflation, Relational manipulation.

---

### 1.2 Penalize unverifiable and mixed verdicts

**Problem:** Only `false` with confidence > 0.7 triggers penalty. Unverifiable or mixed claims don’t reduce epistemic, so vague/hedged claims avoid penalty.

**Change:** In `applyFactCheckPenalty`, also reduce epistemic when verdict is `unverifiable` or `mixed` (e.g. small fixed discount per such claim).

```typescript
// valueScoringAgent.ts, applyFactCheckPenalty
// After confident false penalty:
const unverifiableOrMixedCount = factChecks.filter(
  fc => (fc.verdict === 'unverifiable' || fc.verdict === 'mixed') && fc.confidence > 0.5
).length;
if (unverifiableOrMixedCount > 0) {
  const discount = Math.min(0.2, unverifiableOrMixedCount * 0.08);
  vector = { ...vector, epistemic: clamp01(vector.epistemic * (1 - discount)) };
}
```

**Why it’s hard to game:** Framing claims as unverifiable or getting mixed verdicts no longer leaves epistemic untouched.

**Vectors addressed:** Unverifiable attack, Hedging (when fact-check returns mixed).

---

### 1.3 Lower confidence threshold for false penalty

**Problem:** False verdicts with confidence ≤ 0.7 don’t trigger penalty, so “hard-to-verify” false claims slip through.

**Change:** Use a lower threshold (e.g. 0.6) for applying the false-claim penalty, and optionally make penalty scale with confidence.

```typescript
// valueScoringAgent.ts
const confidentFalseCount = factChecks.filter(
  fc => fc.verdict === 'false' && fc.confidence > 0.6  // was 0.7
).length;
// Optional: weight penalty by confidence so 0.9 confidence hurts more than 0.65
```

**Vectors addressed:** Penalty evasion.

---

### 1.4 Pre-check: always run value scoring; gate fact-check only

**Problem:** When pre-check says “no fact-check,” the pipeline returns early and **no value score is computed**. Opinion/experience/humor never get scored, so they’re invisible to the value system and “no claims” can be used to avoid any score.

**Change:** Don’t early-exit on “no fact-check.” Still run claim extraction (optional or lightweight) and **always run value scoring**. Use pre-check only to skip **fact-check step** (claims → verify). Value scoring then runs with `claims = []` and `factChecks = []` (epistemic capped at 0.35 as today).

**Why it’s hard to game:** Every post gets a value score. “No claims” no longer means “no score”; it means epistemic is capped and other dimensions still apply. Opinion/experience/humor get scored on insight, practical, relational, effort.

**Vectors addressed:** Pre-check bypass (no longer bypasses scoring), No claims (score still computed).

**Code:** Pipeline in `functions/src/services/pipeline/index.ts`: remove early return when `!needsFactCheck`; instead skip only verify step and continue to value scoring with empty claims/factChecks.

---

### 1.5 Minimum epistemic for “high value” display and ranking

**Problem:** A post can get a high total from high insight/practical/relational/effort while epistemic is low or capped, and still be shown as “high value.”

**Change:** In feed ranking and “Most Valued” logic, treat a post as “high value” only if **both** total is above threshold **and** epistemic is above a minimum (e.g. 0.4 when there were fact-checks, or allow capped epistemic for no-claim posts). Optionally: `effectiveValue = total * (0.5 + 0.5 * epistemic)` so epistemic gates visibility.

```typescript
// shared/lib/algorithm.ts, scoreChirpForViewer
// When applying value boost, require epistemic floor for full boost
const valueTotal = clamp01(chirp.valueScore.total);
const epistemic = clamp01(chirp.valueScore.epistemic ?? 0);
const effectiveValue = chirp.valueScore
  ? valueTotal * (0.5 + 0.5 * Math.max(epistemic, 0.35))  // epistemic gates boost
  : 0;
```

**Why it’s hard to game:** Gaming insight/relational/effort alone doesn’t get full “high value” boost without some epistemic backing.

**Vectors addressed:** Insight inflation, Relational manipulation, Effort inflation.

---

## Tier 2: Medium effort (same pipeline, more logic and signals)

### 2.1 Hedging and meta-claim detection

**Problem:** “Some people believe X” gets fact-checked as true (people do believe it), so epistemic isn’t penalized even when the underlying claim X is false.

**Change:**

1. **Pre-check or claim extraction:** Add a hedging/meta-claim flag per claim (e.g. “object-level” vs “meta”: “vaccines cause autism” vs “some people believe vaccines cause autism”). If meta, fact-check the **underlying** claim (e.g. “vaccines cause autism”), not the meta claim.
2. **Value scoring:** If hedging level is “heavy” or “moderate,” apply a small epistemic discount (e.g. 0.1) regardless of verdict, or pass hedging into the value prompt so the model can down-weight epistemic.

**Why it’s hard to game:** Hedged framing no longer guarantees a true verdict and no penalty.

**Vectors addressed:** Hedging attack.

**Code:** Pre-check schema in `precheck.ts` or claim schema in `claimExtractionAgent` / `extractClaims.ts`: add `hedgingLevel`, `underlyingClaim`. Fact-check step: when `underlyingClaim` exists, verify that. Value scorer: `applyFactCheckPenalty` or prompt: reduce epistemic when hedging is high.

---

### 2.2 Effort: cap by substance, not length

**Problem:** Long, repetitive or filler-heavy posts get high effort from “text length, number of claims.”

**Change:**

1. **Input to scorer:** Add a simple **substance proxy**: e.g. unique words / total words, or (claims.length + 1) / (1 + sqrt(textLength)). Pass it in the summary as “Substance proxy: low | medium | high.”
2. **Post-LLM:** Cap effort by epistemic when there are no fact-checks (e.g. `effort = min(effort, max(epistemic, 0.4))` for no-fact-check path), so low-epistemic fluff doesn’t get high effort.

**Why it’s hard to game:** Effort can’t be inflated by length alone; it’s tied to substance and/or epistemic.

**Vectors addressed:** Effort inflation.

---

### 2.3 Domain from content, not only claims

**Problem:** Domain is from claim domains; if there are no claims, domain falls back to topic. Topic can be wrong or gamed (e.g. post health misinformation under #productivity for lower epistemic weight).

**Change:** Run a lightweight **content-type/domain classifier** on post text (and optional topic) that outputs health | politics | technology | productivity | general. Use it to:
- Override or blend with claim-based domain when claims exist.
- Set domain when there are no claims (instead of topic alone).

Prefer content-based domain when it disagrees with topic (e.g. health content under #productivity → use health weights).

**Why it’s hard to game:** Hashtag/topic no longer fully controls weighting; content semantics do.

**Vectors addressed:** Domain confusion, Domain hopping.

---

### 2.4 Reputation: recency and decay

**Problem:** High Kurral score persists; users can farm reputation then switch to low-quality or misinformation.

**Change:**

1. **Recency weighting:** Weight recent posts (e.g. last 30 days) more than older ones when computing user quality / Kurral.
2. **Decay or “recent quality”:** Either decay Kurral when the user hasn’t posted in a while, or maintain a separate “recent quality” (e.g. last 10 posts) and use min(overall, recent) or a blend for ranking/display.
3. **Sudden drop detection:** If recent-post average value drops sharply vs historical (e.g. > 30%), flag or temporarily reduce trust multiplier for that user.

**Why it’s hard to game:** Building reputation then switching to bad content is detected and recent behavior matters more.

**Vectors addressed:** Reputation farming.

**Code:** `functions/src/services/kurralScoreService.ts`: add recency weights and optional decay; optionally a “recentQuality” or “recentValueAvg” field and logic that down-weights when it drops.

---

### 2.5 Similar-post and coordination detection

**Problem:** Many accounts post the same or near-duplicate content; each post is scored independently and can dominate “Most Valued.”

**Change:**

1. **Embedding similarity:** When saving or scoring a post, compute embedding (reuse existing `contentEmbedding` if present). Query for other posts with high cosine similarity in a short time window (e.g. 24–48 hours).
2. **Penalty:** If similar posts exist from different authors (e.g. ≥2), apply a deterministic penalty to value total (e.g. multiply by 0.7 for 2, 0.5 for 3+), or flag for review.
3. **Same author:** If same author has multiple near-duplicate posts, treat as one for “Most Valued” or apply a duplicate penalty.

**Why it’s hard to game:** Coordinated or copy-paste posting no longer gets full score per copy.

**Vectors addressed:** Coordinated inauthentic behavior.

**Code:** Pipeline or a post-write function: compute/attach embedding; batch job or on-demand: similarity search; write a `similarPostCount` or `coordinationPenalty` field and use it in ranking / Most Valued.

---

## Tier 3: Structural (behavioral ground truth and validation)

These require new or expanded infra (events, jobs, maybe ML). They make gaming “super hard” because score is validated against behavior and bad actors are detected over time.

### 3.1 Behavioral signals as ground truth

**Problem:** Value is defined only by LLM + fact-checks. There is no ground truth, so gaming is “whatever raises the LLM score.”

**Change:** Treat **behavioral signals** as ground truth: e.g. quality-weighted bookmarks, rechirps, in-thread citations, time-on-post, follow-from-post. Store per-post metrics (with delay, e.g. 7 days). Use them to:

- **Rank and “Most Valued”:** Blend predicted value (current score) with realized value (behavioral metrics) once data exists; for old posts, rely more on behavior.
- **Calibration:** Periodically compare LLM score to realized engagement; if a user or content type consistently gets high score but low engagement, down-weight that segment or retrain.

**Why it’s hard to game:** Faking engagement at scale is costly (many real accounts, consistent behavior). Single-account gaming doesn’t move aggregate metrics much.

**Vectors addressed:** All scoring manipulation (effort, insight, relational, etc.) that doesn’t produce real engagement.

**Ref:** VALUE_SYSTEM_SOLUTION.md (behavioral layer, citations from PostReviewContext).

---

### 3.2 Prediction–outcome validation and gaming flags

**Problem:** No feedback loop; we don’t know if high-scored posts actually get engagement or if they’re gamed.

**Change:**

1. **Store prediction at post time:** e.g. `predictedValue`, `predictedEngagement7d`.
2. **After 7 days:** Compute actual engagement (bookmarks, rechirps, quality-weighted where available).
3. **Compare:** If predicted value is high but actual engagement is low (e.g. below 20th percentile), mark post or author for “overprediction.” If an author has many overpredictions, apply a **trust discount** to their future scores (e.g. multiply value by 0.8) or flag for review.
4. **Use in ranking:** Don’t boost “high value” for posts that are in overprediction bucket until validated.

**Why it’s hard to game:** Sustained gaming (high score, low engagement) gets detected and discounted.

**Vectors addressed:** Reputation farming, Insight/Effort/Relational inflation (when they don’t drive engagement).

---

### 3.3 Multi-signal consensus for dimension scores

**Problem:** All five dimensions come from one LLM call; a single prompt or model quirk can inflate multiple dimensions at once.

**Change (longer term):**

- **Epistemic:** Keep as today (fact-checks + optional LLM), or add a second “epistemic-only” small model that only gets claims + fact-checks.
- **Effort:** Derive partly from observables: e.g. word count, claim count, presence of structure (headings, lists), link count. Blend with LLM effort.
- **Insight:** Require epistemic above a threshold before allowing high insight (already in Tier 1); optionally add a second “novelty” model that only sees abstract/summary and no verdicts.
- **Relational:** Use discussion quality when available (pass into scorer); optionally separate “tone” model and cap relational by epistemic (Tier 1).

**Why it’s hard to game:** No single prompt or single model can inflate all dimensions; epistemic and effort are anchored to evidence and structure.

**Vectors addressed:** Single-model gaming, dimension overlap.

---

## Summary: what makes it “super hard” to game

| Layer | What we do | Why it’s hard to game |
|-------|------------|------------------------|
| **Dimensions** | Cap insight/relational by epistemic; penalize unverifiable/mixed; epistemic-gate “high value” in ranking | Can’t get high value from tone or “novelty” without some truth |
| **Pre-check / scoring** | Always run value scoring; use pre-check only to skip fact-check | No “opinion” bypass; every post gets a score |
| **Claims / fact-check** | Hedging detection; fact-check underlying claim; lower confidence threshold for false penalty | Hedged and vague claims no longer escape penalty |
| **Effort** | Substance proxy; cap effort by epistemic when no fact-checks | Length/filler don’t alone drive effort |
| **Domain** | Content-based domain (not only topic) | Hashtag/topic can’t alone choose epistemic weight |
| **Reputation** | Recency weight; decay; sudden-drop detection | Farming then switching is visible and costly |
| **Coordination** | Similar-post detection; penalty for duplicate/coordinated posts | Sybil/copy-paste has reduced payoff |
| **Ground truth** | Behavioral signals; prediction–outcome validation; trust discount for overprediction | Score must match real engagement; gaming is detected and discounted |

Implementing **Tier 1** in the current codebase gives the largest gain for the least effort; **Tier 2** closes more attack vectors; **Tier 3** makes the system robust to adversarial and opportunistic gaming over time.

**References:** VALUE_SYSTEM_GAMING_ANALYSIS.md (attack vectors), VALUE_SYSTEM_SOLUTION.md (behavioral layer, validation loop), VALUE_SCORING_MECHANISM_ANALYSIS.md (current dimensions and pipeline).
