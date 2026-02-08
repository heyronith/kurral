# Value Is Subjective — How Does the Current Scoring Engine Make Sense?

**The truth:** Value is subjective. Different people value different things. A post that is “high epistemic, low practical” might be valuable to a researcher and useless to someone looking for actionable tips. A post that is “high relational, low epistemic” might be valuable for community and unhelpful for truth-seeking. So “the value of this post” is not a single objective quantity; it depends on who is reading and what they care about.

Given that, **how does the current scoring engine make sense?** This doc thinks through the current infra and answers that directly.

---

## 1. What the Current Engine Actually Measures

The engine does **not** measure “value to user X” or “value in general.” It measures **alignment with a fixed, platform-chosen definition of quality**.

Concretely:

- **Input:** Post text (truncated), extracted claims, fact-check verdicts, optional discussion. No viewer, no user preferences, no “what do you care about?”
- **Process:** One LLM scores five dimensions (epistemic, insight, practical, relational, effort). Domain-aware weights are applied (health → epistemic heavy, tech → insight heavy, etc.). Fact-check penalties are applied. A single **total** is computed.
- **Output:** A single number per post: `valueScore.total` (and the vector). Same score for every viewer. No “value to you.”

So the score is **platform-defined quality**: “How well does this post align with *our* criteria (truthfulness, novelty, actionability, civility, effort), weighted by *our* domain policy?” It is not “how valuable will this be to the reader.”

**Where this shows up in the codebase:**

- **Value scoring:** `valueScoringAgent.ts` — no viewer, no user id, no preferences. Only chirp, claims, factChecks, optional discussion.
- **Feed ranking:** `algorithm.ts` — `scoreChirpForViewer` takes a **viewer** and adds *personal* signals (following, interests, profile embedding, liked topics, bookmarks, rechirps, recency). The **value score** (`chirp.valueScore.total`) is one input among many; it is the same for every viewer. So: **ranking = personal relevance (to this viewer) + platform quality (value score).**
- **Most Valued:** Queries by `valueScore.total` (and time/interests). So “Most Valued” = “posts with highest *platform* quality,” not “posts you would value most.”
- **Kurral score:** User reputation = history of post *platform* quality. “Trusted creator” = “someone who consistently posts what the *platform* defines as high quality.”

So across the stack, “value” in the engine is really **platform quality**: a single, global, viewer-independent score.

---

## 2. Where Subjectivity Appears (and Doesn’t)

### 2.1 Subjective at the level of the platform

The **choice** of dimensions and weights is subjective. The platform decided that “value” should be a blend of epistemic, insight, practical, relational, effort, and that in health we weight epistemic more and in tech we weight insight more. That’s a policy choice, not a fact of nature. So the **definition** of “value” in the system is subjective — it’s the platform’s definition.

### 2.2 Subjective within the dimensions

- **Epistemic:** Closest to objective when backed by fact-check (true/false verdicts). Still subjective in how “rigor” and “correctness” are interpreted when fact-checks are missing or mixed.
- **Insight:** Highly subjective — “novelty,” “synthesis,” “non-obvious” depend on who’s judging and what they already know.
- **Practical:** Subjective — “actionable” and “useful” depend on the reader’s goals and context.
- **Relational:** Subjective — “healthy discourse,” “empathy,” “constructive” depend on culture and interpretation.
- **Effort:** Partly observable (length, structure, claims), partly subjective (“depth,” “sourcing”).

So the engine mixes one relatively objective signal (fact-checked epistemic) with several subjective ones, then collapses them into one number. The result is **not** “objective value”; it’s “platform quality under our chosen criteria.”

### 2.3 Subjectivity of the viewer is only partly in the system

**What is personalized:**

- **Ranking:** Following, interests, profile embedding, liked topics, muted topics, bookmarks, rechirps, recency. So *what you see* and *in what order* depends on you. That’s where “value to you” is partly reflected — via relevance and engagement signals, not via the value score itself.
- **Tuned posts:** Audience targeting (who can see the post) can be tuned; that affects *who* sees it, not *how good* the platform says it is.

**What is not personalized:**

- The **value score** itself. It does not depend on the viewer. There is no “value to you” score that uses your stated or inferred preferences (e.g. “I care more about practical than insight”). So the engine does **not** model “value is subjective *per user*”; it only models “we have one definition of quality.”

So: **subjectivity is partly acknowledged** (different people get different feeds because of relevance and engagement), but **the score that we call “value” is not subjective** — it’s a single, platform-wide quality score.

---

## 3. How It Can Still “Make Sense”

The engine can make sense **if** we stop treating it as a measure of “value” in the purely subjective sense and instead treat it as **platform-defined quality (or integrity)**.

### 3.1 Coherent interpretation: “Platform quality,” not “universal value”

- The platform **defines** quality as: truthfulness (epistemic), novelty (insight), actionability (practical), civility (relational), effort (effort), with domain-specific weights.
- The score measures **alignment with that definition**. It’s a **normative** measure: “Does this post meet *our* bar?” not “Will every user find this valuable?”
- **Ranking** then combines:
  - **Platform quality** (value score) — same for everyone;
  - **Relevance to you** (interests, following, tuned audience, etc.) — different per user.
- So what you see is: “Posts that are both *good by our definition* and *relevant to you*.” That’s coherent: we own the definition of “good”; you get personalization on top.

In that framing, the engine **does** make sense: it’s not claiming to measure “true value”; it’s measuring “quality by our explicit criteria” and using that alongside relevance. Subjectivity is handled by (1) admitting the criteria are our choice, and (2) personalizing what and how we show.

### 3.2 Where it doesn’t fully make sense (if we insist “value” = subjective)

If we insist that “value” means “what each user would value,” then:

- A **single global value score** is the wrong object. We’d want “value to user X” or “value for segment Y,” i.e. scores that depend on the viewer (e.g. user-specific or segment-specific weights on the five dimensions).
- **“Most Valued”** would be better named “Highest platform quality” or “Top by our criteria,” because it’s not “posts you would value most.”
- **Kurral score** would be “reputation for platform quality,” not “reputation for creating value” in the sense of “what everyone values.”

So the engine **doesn’t** fully make sense if we insist on a purely subjective notion of value and still call the current score “value.” It **does** make sense if we reframe the score as “platform quality” and keep “value to you” as the combination of that quality with personalized relevance and engagement.

---

## 4. What the Current Infra Implies

| Piece of infra | What it assumes | Relation to “value is subjective” |
|----------------|-----------------|-----------------------------------|
| Single `valueScore` per post | “This post has one quality level.” | Assumes a single, platform-wide notion of quality, not per-user value. |
| Domain weights from *content* | “Health posts should weight epistemic more.” | Platform policy, not “what this viewer cares about.” |
| Feed = value + relevance + engagement | “We rank by our quality + your relevance + community signals.” | Subjectivity enters via relevance and engagement, not via the value score. |
| Most Valued = sort by `valueScore.total` | “Top posts by our criteria.” | Not “posts you would value most.” |
| Kurral = history of post value | “Trust = history of meeting our quality bar.” | Coherent as “platform trust,” not “universal value creator.” |
| No viewer in value scoring | “Quality is a property of the post.” | Explicit: we do not compute “value to you” in the scorer. |

So the infra is **consistent with** “we measure platform-defined quality and then personalize delivery.” It is **inconsistent with** “we measure each user’s subjective value.”

---

## 5. Summary: How Does It Make Sense?

- **Value is subjective** — agreed. The current engine does **not** measure “value” in that sense. It measures **alignment with a fixed, platform-chosen definition of quality** (five dimensions, domain weights, fact-check integration).
- **It makes sense** if we interpret the score as **platform quality (or integrity)** and accept that:
  1. The *definition* is subjective (we chose the dimensions and weights).
  2. The *application* is uniform (one score per post, no viewer).
  3. *Subjectivity of the user* is handled by **personalization** (relevance, following, engagement), not by changing the value score per viewer.
- **It doesn’t fully make sense** if we claim the score is “how valuable this post is” in a universal or per-user sense. Then we’d need either:
  - A different object (e.g. “value to you” with user-dependent weights), or
  - Clearer naming and framing: call the score “platform quality” or “integrity score” and reserve “value” for the combined experience (quality + relevance + engagement).

So the deep answer: **the scoring engine makes sense when we treat it as measuring platform-defined quality, not universal or subjective value.** Subjectivity is real; the engine doesn’t try to measure it in the score — it encodes a single normative definition and uses relevance and engagement to personalize what users see. Making that explicit in naming and product copy would align the infra with the truth that value is subjective.
