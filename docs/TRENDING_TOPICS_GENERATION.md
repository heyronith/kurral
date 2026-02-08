# How Trending Topics Are Generated (Current Setup)

In the current setup, trending topics are generated from **both** the single `topic` field and the `semanticTopics` array. Counts are unified in the `topics` collection; the UI then reads from that collection.

---

## 1. Where “trending” lives

- **Collection:** `topics` (one document per topic *name*).
- **Fields:** `name`, `postsLast48h`, `postsLast4h`, `postsLast1h`, `averageVelocity1h`, `isTrending`, `lastEngagementUpdate`, etc.
- **Trending rule:** `isTrending = (averageVelocity > 0) && (count1h >= averageVelocity * 2)` — i.e. the 1h count is at least 2× the average hourly rate over the last 4h.

Trending topics are **not** computed directly from chirps at read time. They are **pre-aggregated** into `topics`; the app then queries this collection.

---

## 2. How counts get into `topics` (both `topic` and `semanticTopics`)

Two code paths write into the same `topics` docs:

### 2.1 Full refresh: `refreshTopicEngagement()`

**File:** `src/webapp/lib/firestore.ts` (and `.js` equivalent)

- Scans **all chirps** with `createdAt` in the last 48 hours (batched).
- For **each chirp**:
  - Calls `incrementCounts(chirp.topic, postTime)` → the **single `topic`** contributes to that topic name’s counts (48h, 4h, 1h).
  - Then `chirp.semanticTopics?.forEach((semanticTopic) => incrementCounts(semanticTopic, postTime))` → **each entry in `semanticTopics`** also contributes to that topic name’s counts.
- Writes aggregated counts (and recomputes `isTrending`) into `topics/{topicName}` for every distinct topic name seen (from either `topic` or `semanticTopics`).

So after a full refresh, every topic name that appears **either** as a chirp’s primary `topic` **or** as one of its `semanticTopics` is represented in `topics`, and trending is derived from those counts.

### 2.2 On new chirp: `incrementTopicEngagement()`

**Files:** `src/webapp/store/useFeedStore.ts`, `mobile/src/stores/useFeedStore.ts`

When a chirp is created, the feed store builds the set of topic names to update:

```ts
const engagementTopics = new Set([
  chirpData.topic,
  ...(chirpData.semanticTopics || []),
]
  .map((topic) => topic?.trim().toLowerCase())
  .filter((topic): topic is string => Boolean(topic))
);
topicService.incrementTopicEngagement(Array.from(engagementTopics));
```

So **both** the primary `topic` and every `semanticTopic` from the new chirp are passed to `incrementTopicEngagement`. Each of those topic names gets its `topics` doc updated (e.g. `postsLast48h`, `postsLast1h` incremented, and `recalculateVelocity` can set `isTrending`).

---

## 3. How the UI gets “trending topics”

**File:** `src/webapp/lib/firestore.ts` — `getTrendingTopics(limitCount)`

- Queries the **`topics`** collection only (no direct chirp or topic/semanticTopics reads):
  - Query 1: `where('isTrending', '==', true)`, `orderBy('postsLast1h', 'desc')`, `limit(limitCount)`.
  - Query 2: `orderBy('postsLast1h', 'desc')`, `limit(limitCount)`.
- Merges and dedupes by topic name, sorts by `postsLast1h` desc, returns the top N.

So “trending topics” in the UI are exactly the topic names that appear in `topics` with high 1h activity and `isTrending == true`. Those counts were populated from **both** `chirp.topic` and `chirp.semanticTopics` by the two paths above.

---

## 4. Direct answer

| Question | Answer |
|----------|--------|
| **Are trending topics generated from `topic` or `semanticTopics`?** | **Both.** |
| **How?** | (1) `refreshTopicEngagement()` counts each chirp’s `topic` once and each of its `semanticTopics` once into the same `topics` aggregates. (2) On create, `incrementTopicEngagement()` is called with `[chirpData.topic, ...chirpData.semanticTopics]`. So every topic name from either source contributes to the same `topics` doc and thus to trending. |
| **Where is “trending” computed?** | In the `topics` collection: `isTrending = (averageVelocity > 0) && (count1h >= averageVelocity * 2)`, where counts come from both `topic` and `semanticTopics`. |
| **What does the UI read?** | Only the `topics` collection via `getTrendingTopics()`; it does not read chirps’ `topic` or `semanticTopics` for trending. |

So in this setup, trending topics are generated from **both** topics and semantic topics; they are merged by topic name in the `topics` collection and then exposed as “trending” via that collection.
