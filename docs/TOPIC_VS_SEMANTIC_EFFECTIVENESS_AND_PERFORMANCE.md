# Topics vs Semantic Topics: Effectiveness and Performance

Based on how the codebase uses `topic` and `semanticTopics` today.

---

## Summary

| Criterion | Single `topic` | `semanticTopics` (array) |
|-----------|----------------|---------------------------|
| **Query performance** | **Higher** — one equality query, one index, minimal reads | **Lower** — topic feed runs two queries and merges; more docs scanned when array is large |
| **Effectiveness / discovery** | **Lower** — one bucket per post; exact match only | **Higher** — multiple tags per post; same post can match many topic feeds; better for “liked topic” and discovery |
| **Storage** | **Lower** — one string per chirp | **Higher** — array of 3–8+ strings per chirp |
| **Index cost** | **Lower** — simple composite (topic, createdAt) | **Higher** — array index (CONTAINS + createdAt) |

**Bottom line:**  
- **Highest performance:** single `topic` (one query, one index, least data).  
- **Highest effectiveness:** `semanticTopics` (richer matching, better discovery).  
- **Current design:** uses both — `topic` for a primary bucket and fast paths; `semanticTopics` for broader, finer-grained matching. Combining them gives better effectiveness than topic-only, at the cost of more queries and merge logic where both are used (e.g. topic feed).

---

## 1. Performance

### 1.1 Single `topic` field

- **Query:** `where('topic', '==', normalizedTopic)` (+ time range, orderBy, limit).  
  One equality filter → single index seek, predictable read cost.
- **Index:** `(topic ASC, createdAt DESC)` — simple composite, small keys.
- **Mobile “topic” feed:** `where('topic', 'in', topics.slice(0, 10))` — **one query** (Firestore `in` limited to 10 values).
- **Reads:** Only documents with that exact `topic` are read; no merge/dedup for a single-topic view.
- **Storage:** One string per chirp.

So **single-topic is highest performance**: one query, one index, minimal reads and no client-side merge for a single topic feed.

### 1.2 `semanticTopics` (array)

- **Query:** `where('semanticTopics', 'array-contains', normalizedTopic)` (+ time range, orderBy, limit).  
  Array-contains uses a separate composite index; cost grows with array size and index size.
- **Index:** `(semanticTopics CONTAINS, createdAt DESC)` — array index is heavier than a single-field equality index.
- **Topic feed today:** The app does **not** use only semantic topics. It runs **two queries in parallel**:
  1. `where('topic', '==', normalizedTopic)`
  2. `where('semanticTopics', 'array-contains', normalizedTopic)`  
  Then it **merges and deduplicates** in memory. So:
  - **2 round-trips** to Firestore per topic.
  - Up to **2 × limit** documents read, then deduped.
  - Extra **client-side work**: merge, dedup by id, sort.
- **getPostsForUserTopics:** For each user topic it calls `getPostsByTopic`, which runs those 2 queries. So **N topics ⇒ 2N queries**, then N-way merge/dedup.
- **Storage:** Array of several strings per chirp (e.g. 3–8); larger than a single `topic`.

So **semanticTopics in the current design is lower performance** for topic feed: more queries, more reads, more index and client work. If you switched to **only** semantic (one query per topic, no dual query), performance would be closer to topic-only but still with a heavier array index and more data per doc.

### 1.3 For You feed (no extra topic queries)

- For You loads **all recent chirps** (or by author/following), then **scores in memory** using `findMatchingTopic(chirp, likedTopics)` and `matchesTopic(chirp, mutedTopics)`, which use both `chirp.topic` and `chirp.semanticTopics`.  
- So for For You, **performance is dominated by “load N chirps”**, not by topic vs semantic. Using both fields for matching is a small in-memory cost and **improves effectiveness** (more accurate liked/muted matching).

---

## 2. Effectiveness

### 2.1 Single `topic` field

- **Strength:** One clear bucket per post (e.g. `dev`, `startups`). Simple, fast to reason about and query.
- **Limitation:** A post appears in **only one** topic feed (the one that equals its `topic`). So:
  - A post about “React and TypeScript” might have `topic: 'dev'`. It shows in `#dev` but **not** in `#react` or `#typescript` unless those are the literal `topic` value.
  - Finer-grained or multiple interests (e.g. “frontend”, “react”) are not reflected unless you add many buckets and everyone uses them consistently.
- **Liked/muted matching:** Only exact (or overlap) match on that single value; no extra tags to improve relevance.

So **topic-only is lower effectiveness** for discovery and for matching user interests.

### 2.2 `semanticTopics` (array)

- **Strength:** Multiple tags per post (e.g. `['react', 'frontend', 'typescript']`). So:
  - The **same post** can appear in **multiple** topic feeds (e.g. #react, #frontend, #dev if “dev” is in the list or derived).
  - Finer-grained discovery: users can follow “react” and see all posts tagged react, even when the primary bucket is “dev”.
  - For You: `findMatchingTopic` checks both `chirp.topic` and `chirp.semanticTopics` with `topicsOverlap`. So a post with semantic tag “react” still matches a user’s liked topic “react” even if `chirp.topic` is “dev”. **Better relevance** for liked/muted topics.
- **Limitation:** Depends on quality and consistency of tags (e.g. from ReachAgent or fallback); bad tags can add noise.

So **semanticTopics is higher effectiveness** for discovery, coverage of topic feeds, and For You liked/muted matching.

---

## 3. Trade-off summary

| Goal | Prefer |
|------|--------|
| **Fastest topic feed, fewest reads, simplest indexes** | Single `topic` (one query, one index). |
| **Best discovery and relevance** (multiple feeds per post, better liked/muted) | `semanticTopics` (and current dual use with `topic`). |
| **Current design** | Both: `topic` = primary bucket (required); `semanticTopics` = optional extra tags. Topic feed runs **both** queries and merges → better effectiveness, lower performance than topic-only. |

---

## 4. If you had to choose one

- **“Most effective”** → **Semantic topics.** You get multiple tags per post, more topic feeds per post, and better For You matching. You lose the single, trivial equality query and the current dual-query merge.
- **“Highest performance”** → **Single topic.** One equality query, one composite index, no merge/dedup for a single topic, less storage and index cost. You lose multi-tag discovery and the extra matching surface for liked/muted.

The current setup uses **both** so that:
- **Performance-critical paths** (e.g. mobile topic feed by user topics) can use **only** `topic` with one `in` query.
- **Quality-critical paths** (topic detail view, news aggregation) use **both** `topic` and `semanticTopics` (two queries + merge) for better coverage and relevance.

So: **topic = performance, semanticTopics = effectiveness**; together they balance both.
