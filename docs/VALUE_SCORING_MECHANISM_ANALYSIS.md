# Value Scoring Mechanism: Codebase Analysis

**Purpose:** Document how value is currently measured, how different post types are treated, and the pros/cons of the approach. Based on direct code inspection of `functions/src/services/valueScoringAgent.ts`, pipeline, and related code.

---

## 1. Current Value Scoring Mechanism

### 1.1 Overview

Value is a **single 0–1 total** derived from five dimensions, each scored 0–1 by an LLM, then combined with **domain-specific weights** and **fact-check-aware penalties**.

- **Dimensions:** Epistemic, Insight, Practical, Relational, Effort  
- **Total:** `total = Σ (dimension_i × weight_i)`, clamped to [0, 1]  
- **Weights:** Depend on “dominant domain” (health, tech, productivity, or general).  
- **Penalties:** Applied after the LLM: epistemic cap when there are no fact-checks; epistemic/insight reduction when there are confident false verdicts.

### 1.2 The Five Dimensions (0–1 each)

| Dimension   | Definition (from prompt) |
|------------|---------------------------|
| **Epistemic** | Factual rigor and correctness |
| **Insight**   | Novelty, synthesis, non-obvious perspective |
| **Practical** | Actionable guidance or clear takeaways |
| **Relational** | Healthy discourse, empathy, constructive tone |
| **Effort**    | Depth of work, sourcing, structure |

LLM receives: post text (sanitized, up to 700 chars), claim count and risk summary, fact-check verdicts (or “pending”), optional discussion summary, and comment count. It returns five dimension scores plus confidence and optional drivers.

### 1.3 Domain-Aware Weights

Domain is resolved by `resolveDominantDomain(chirp, claims)`:

1. From **claims**: each claim has a `domain` (e.g. health, politics, technology). Domains are weighted by claim risk (high=2, medium=1.5, low=1).  
2. **Dominant domain** = domain with highest weighted count.  
3. If that domain is **inconsistent** with `chirp.topic` and `chirp.semanticTopics`, fallback is the normalized topic.  
4. If there are **no claims**, domain falls back to `chirp.topic ?? 'general'`.

Weights (must sum to 1.0):

| Domain              | Epistemic | Insight | Practical | Relational | Effort |
|---------------------|-----------|---------|-----------|------------|--------|
| Health, Politics    | 0.35      | 0.25    | 0.20      | 0.10       | 0.10   |
| Technology, Startups, AI | 0.25 | 0.35    | 0.20      | 0.10       | 0.10   |
| Productivity, Design    | 0.20 | 0.25    | 0.35      | 0.10       | 0.10   |
| **Default (General)**   | 0.30 | 0.25    | 0.20      | 0.15       | 0.10   |

So:

- **Factual / claim-heavy posts:** Domain comes from claims → health/politics favor epistemic; tech favors insight; productivity/design favor practical.  
- **No-claim posts (e.g. bot path):** Domain = topic or `"general"` → default weights.

### 1.4 Post-LLM Adjustments

1. **Clamp** all dimension scores to [0, 1].  
2. **Fact-check penalty** (`applyFactCheckPenalty`):
   - If **no fact-checks:** `epistemic = min(epistemic, 0.35)` (cap epistemic).  
   - If any **confident false** verdict (verdict === 'false' && confidence > 0.7):  
     - `penalty = min(0.8, confidentFalseCount * 0.25)`  
     - `epistemic *= (1 - penalty)`  
     - `insight *= (1 - penalty * 0.3)`  
3. **Validate** (replace non-finite values with 0.5, clamp to [0,1]).  
4. **Total** = weighted sum with domain weights, then clamp to [0, 1].  
5. **Confidence** and **drivers** passed through from LLM (drivers optional).

### 1.5 Where Value Scoring Runs

- **Pipeline (human posts):** Value scoring runs only **after** pre-check → extract claims → verify claims. So it runs only when:
  - Pre-check says `needsFactCheck === true`, and  
  - At least one claim is extracted, and  
  - Step 4 is not skipped (`skipValueScoring === false`).  

- **Early exits (no value score):**
  - Pre-check says **no** fact-check (opinion, experience, humor, question, etc.) → return with `factCheckStatus: 'clean'`, **no value score**.  
  - Pre-check says fact-check but **zero claims** extracted → return clean, **no value score**.

- **Bot path** (`skipFactCheck: true`): Pre-check and claim extraction/verification are skipped; **value scoring runs** with `claims = []`, `factChecks = []`. So bot posts get a value score; epistemic is capped at 0.35 (no fact-checks).

- **Discussion:** In the pipeline, the value scoring step calls `scoreChirpValue(chirp, claims, factChecks, undefined)`. Discussion is **never** passed in production; only tests pass discussion.

---

## 2. How Different Post Types Are Measured

### 2.1 Factual / News / Claim-Heavy Posts

- **Path:** Pre-check → needs fact-check → extract claims → verify → **score value**.  
- **Input to scorer:** Post text, N claims (with domains/risk), fact-check verdicts (true/false/mixed/unverifiable) and confidence.  
- **Domain:** From claims (e.g. health, politics, tech) → domain-specific weights.  
- **Epistemic:** Can be high if verdicts are true/high-confidence; reduced by confident false verdicts.  
- **Result:** Full value score; used in feed (value boost/penalty), Kurral quality, “Most Valued”, etc.

### 2.2 Opinion / Experience / Humor / Personal Updates (“No fact-check needed”)

- **Path:** Pre-check → `needsFactCheck === false` → **early return** with `factCheckStatus: 'clean'`.  
- **Value scoring:** **Not run.** No `valueScore` is written.  
- **Result:** These posts are **not measured** by the current value system. In the feed they get no value boost and no value penalty (they simply lack `valueScore`). Algorithm still uses other signals (follow, interests, recency, bookmarks, etc.).

So:

- **Random personal updates,** “I think…”, “My day was…”, jokes, greetings: **no value score.**  
- There is **no separate “relational” or “entertainment” track** for them; they are just excluded from value scoring.

### 2.3 Posts That “Need” Fact-Check But Have No Extracted Claims

- **Path:** Pre-check → needs fact-check → extract claims → **0 claims** → early return, clean, **no value score**.  
- **Result:** Same as 2.2 from a product perspective: no value score, no value-based boost/penalty.

### 2.4 Bot / Automated Posts (skipFactCheck)

- **Path:** Pre-check and claim/verify skipped → **value scoring runs** with `claims = []`, `factChecks = []`.  
- **Input to scorer:** Post text only; summary says “No explicit extracted claims” and “Fact checks pending.”  
- **Domain:** From `chirp.topic` or `"general"` (no claim domains).  
- **Epistemic:** Capped at 0.35 (no fact-checks).  
- **Result:** They get a value score based on insight, practical, relational, effort and capped epistemic, with default (or topic-based) weights.

### 2.5 Summary Table

| Post type                     | Pre-check      | Claims | Value scored? | Domain source   | Epistemic treatment   |
|-------------------------------|----------------|--------|----------------|-----------------|------------------------|
| Factual / news / claim-heavy  | needs check    | > 0    | Yes            | From claims     | Full; penalized if false |
| Opinion / experience / humor  | no check       | —      | **No**         | —               | —                      |
| “Factual” but 0 claims        | needs check    | 0      | **No**         | —               | —                      |
| Bot (skipFactCheck)           | skipped        | 0      | Yes            | Topic / general | Capped 0.35            |

---

## 3. Pros of the Current Mechanism

1. **Multi-dimensional:** Epistemic, insight, practical, relational, effort are distinct; avoids reducing “value” to a single vague notion.  
2. **Domain-aware weights:** Health/politics stress epistemic; tech stress insight; productivity/design stress practical. Aligns scoring with what matters in each domain.  
3. **Fact-check integration:** Epistemic cap when there are no checks; strong penalty for confident false verdicts. Reduces reward for unverified or false factual claims.  
4. **Deterministic post-LLM logic:** Weights and penalties are in code; same vector and weights always yield same total.  
5. **Sanitization and schema:** Input to the LLM is sanitized and length-limited; output is JSON-schema constrained, reducing prompt-injection and parse issues.  
6. **Single total:** Easy to use in ranking, thresholds (“Most Valued”), and user-facing labels (e.g. value badge).  
7. **Kurral / reputation:** Value score feeds into user-level quality and reputation (Kurral score), so “value” has downstream impact.

---

## 4. Cons of the Current Mechanism

1. **No value score for most “personal” content:** Opinion, experience, humor, personal updates never get a value score. The system does not distinguish “great personal story” vs “low-effort rant” or “toxic joke” for value. Relational/effort dimensions are only applied to posts that already passed the fact-check path.  
2. **All-or-nothing gate:** Pre-check is a hard gate. If pre-check says “no fact-check,” the post is never scored. There is no “value-only” path for non-factual content.  
3. **No claims ⇒ no value (for human factual intent):** If pre-check says “needs fact-check” but claim extraction returns 0 claims, the post is not scored. No fallback “general quality” score for that case.  
4. **Discussion unused in production:** Discussion quality (informativeness, civility, reasoning, perspective) is accepted by `scoreChirpValue` but the pipeline always passes `undefined`. So relational/discourse quality from comments is not used.  
5. **LLM subjectivity and drift:** Dimension scores are subjective (e.g. “novelty,” “constructive tone”). Model or prompt changes can shift scores without any change in post content.  
6. **No content-type-specific instructions:** The same prompt is used for all scored posts. There is no explicit branch for “factual vs experience vs tutorial”; the model infers from the summary (e.g. “No explicit extracted claims”).  
7. **Epistemic cap for no fact-checks is global:** When there are no fact-checks, epistemic is capped at 0.35 regardless of domain. So even in productivity/design, epistemic cannot go higher without claims + verification.  
8. **Kurral quality vs value weights:** Kurral score uses a fixed quality formula (e.g. epistemic 0.3, insight 0.2, …) that does not mirror the domain-varying weights used for the post value total. So “value” and “reputation quality” can be slightly misaligned by domain.  
9. **Gaming and consistency:** As noted in VALUE_SYSTEM_GAMING_ANALYSIS.md, the system is gameable (e.g. safe claims, domain tagging). No explicit anti-gaming or consistency checks in the scoring step itself.

---

## 5. Recommendations (for future work)

- **Option A – Score all posts:** Run value scoring for every post (e.g. after pre-check), not only when claims exist. For “no fact-check” or “no claims,” pass a flag or content type so the model can score relational/effort/insight without over-weighting epistemic.  
- **Option B – Content-type-aware prompts:** Add `contentType` (and optionally “no claims”) to the value-scoring prompt and optionally use different dimension weights or instructions for factual vs opinion vs experience.  
- **Option C – Use discussion when available:** Pass discussion quality into the pipeline and into `scoreChirpValue` so relational and discourse quality can affect the score.  
- **Option D – Clarify “no value score” in UX:** If the product keeps “no score” for opinion/experience, make it explicit in UI (e.g. “Not scored for value” or “Personal post”) so users don’t assume a hidden zero.

---

## 6. Assessment: How Good, Logical, and Unbreakable Are the Five Dimensions?

### 6.1 How good (useful and well-defined)

| Dimension    | Assessment | Notes |
|-------------|------------|--------|
| **Epistemic** | **Strong** | Clearly defined (“factual rigor and correctness”), backed by claim extraction + fact-check. The only dimension with hard, post-LLM corrections (cap when no fact-checks; penalty for false verdicts). Directly tied to verifiable evidence. |
| **Insight**   | **Moderate** | “Novelty, synthesis, non-obvious perspective” is useful but vague. No objective anchor—LLM judges novelty from text only. Novel-sounding but false claims can score high (see gaming doc). No post-LLM check. |
| **Practical** | **Moderate** | “Actionable guidance or clear takeaways” is understandable. Still subjective (what counts as “actionable”?). No external signal; easy to game with fake step lists or vague “tips.” |
| **Relational** | **Weak** | “Healthy discourse, empathy, constructive tone” is highly subjective. Sarcasm, cultural norms, and subtle hostility are hard for an LLM to judge consistently. In production, discussion is never passed in, so relational is judged from the post text only—no real “discourse” signal. Polite misinformation can get high relational. |
| **Effort**    | **Weak** | Prompt says “depth of work, sourcing, structure” and “text length, number of claims, clarity.” Effort is inferred from proxies (length, claim count), not real effort. Long, low-substance posts can inflate it; short, dense posts can be under-scored. |

**Summary:** Epistemic is the only dimension with a clear, evidence-based definition and hard safeguards. The others are useful as concepts but under-specified and not anchored to observable signals, so “good” is mixed.

### 6.2 How logical (coherent and non-overlapping)

- **Overlap:** The dimensions are **not orthogonal**. Examples:
  - **Epistemic vs Insight:** A “novel” claim that is false still gets insight from the LLM; only epistemic is penalized after the fact. So insight can reward novelty even when epistemic is low—logically you might want “insight” to be discounted when claims are false (partially done via penalty on insight for false claims, but only by a fixed factor).
  - **Effort vs Epistemic/Practical:** “Depth of work” and “sourcing” overlap with epistemic rigor; “structure” and “clear takeaways” overlap with practical. The model is asked to separate them without clear boundaries.
  - **Relational vs Practical:** “Constructive tone” can overlap with “actionable guidance” (e.g. helpful, friendly how-to posts score high on both). No rule prevents double-counting.

- **Missing cases:** Content can be high on one dimension and low on others (e.g. high effort, low insight). The weighted sum handles that. But there is no explicit rule for **contradictions** (e.g. high epistemic + high insight for a novel-but-false claim). The fact-check penalty reduces epistemic and insight for false claims, which partially addresses that; the logic is not stated in the dimension definitions themselves.

- **Weights:** Domain weights are coherent (e.g. health → epistemic, tech → insight). The fact that weights sum to 1.0 is logically consistent. So the **combination** is logical; the **definitions** of the five dimensions are somewhat overlapping and not fully independent.

**Summary:** Logically the system is coherent at the formula level (weighted sum, domain weights, penalties). At the dimension level, definitions overlap and are not strictly independent, and the handling of “novel but false” is partly in code (penalties) rather than in the dimension semantics.

### 6.3 How unbreakable (robust and non-gameable)

From VALUE_SYSTEM_GAMING_ANALYSIS.md and the code:

| Dimension    | Breakability | Main attack vectors |
|-------------|-------------|----------------------|
| **Epistemic** | **Partially breakable** | Hedging (“some people believe…” → true verdict); unverifiable framing (“I feel that…”); low-confidence false claims (no penalty if confidence ≤ 0.7); implicit claims (no extraction → no fact-check → epistemic cap 0.35). Hard false claims with high-confidence verdicts are penalized. |
| **Insight**   | **Easily gameable** | “Insight inflation”: novel-sounding but false or unproven claims get high insight because the LLM judges novelty from text, not truth. In tech domain (insight 35%), this directly inflates total. No post-LLM check tying insight to epistemic. |
| **Practical** | **Gameable** | Fake “actionable” content: vague step lists, generic tips, or bullet points that look actionable but add little. No verification that advice is correct or usable. |
| **Relational** | **Easily gameable** | “Relational manipulation”: polite, empathetic tone while spreading misinformation. LLM scores tone separately from accuracy; respectful misinformation gets high relational and no relational penalty. |
| **Effort**    | **Gameable** | “Effort inflation”: long posts, many claims, filler paragraphs, or redundant restatements. Prompt tells the LLM to consider “text length” and “number of claims,” so substance vs filler is not strictly enforced. |

**Structural weaknesses:**

1. **No cross-dimension guardrails:** Epistemic is the only dimension with hard, evidence-based corrections. Insight, practical, relational, and effort have no analogous checks, so they can be inflated independently.
2. **Single LLM call:** All five dimensions come from one pass. The model can be inconsistent (e.g. high epistemic + high insight for a false claim until penalties apply), and there is no second check or consistency rule.
3. **Subjective wording:** “Novelty,” “constructive,” “depth of work” are interpretable in many ways; different prompts or models can shift scores without content change.
4. **No calibration:** Scores are not calibrated to human judgments or outcomes (e.g. downstream engagement or expert ratings), so “0.8 insight” has no fixed meaning.

**Summary:** The dimensions are **not unbreakable**. Epistemic is the most robust due to fact-check integration and penalties; the other four are soft, subjective, and gameable. The system is coherent and useful for ranking, but it is not a secure or fully reliable measure of “value” under adversarial or opportunistic behavior.

### 6.4 Overall verdict

| Criterion   | Verdict | One-line summary |
|------------|--------|-------------------|
| **Good**   | Mixed  | Epistemic is well-defined and anchored; the other four are useful but vague and not backed by hard signals. |
| **Logical** | Mostly yes | Weighted combination and domain weights are coherent; dimension definitions overlap and are not strictly independent. |
| **Unbreakable** | No | Epistemic is partially protected; insight, practical, relational, and effort are gameable and lack evidence-based safeguards. |

---

## 7. Code References

| Concern              | Location |
|----------------------|----------|
| Dimension weights    | `functions/src/services/valueScoringAgent.ts` — `getDimensionWeights`, `resolveDominantDomain` |
| Fact-check penalty   | `functions/src/services/valueScoringAgent.ts` — `applyFactCheckPenalty` |
| Build summary / prompt | `functions/src/services/valueScoringAgent.ts` — `buildSummary`, `scoreChirpValue` |
| Pipeline early exits | `functions/src/services/pipeline/index.ts` — after pre-check (no fact-check) and after extract claims (0 claims) |
| Score step (no discussion) | `functions/src/services/pipeline/steps/scoreValue.ts` — `scoreChirpValue(..., undefined)` |
| Feed use of value    | `shared/lib/algorithm.ts` — `scoreChirpForViewer` (value boost/penalty from `chirp.valueScore`) |
| Kurral quality from value | `functions/src/services/kurralScoreService.ts` — `getQualityScore(valueScore)` |
| Pre-check content types | `functions/src/services/pipeline/steps/precheck.ts` — contentType: factual, news, opinion, experience, question, humor, other |

This document reflects the codebase as of the analysis date; implementation details should be re-checked against the latest code when making changes.
