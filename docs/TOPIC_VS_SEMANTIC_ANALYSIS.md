# Are We Still Using `topic`? Or Only `semanticTopics` / `semanticTopicBuckets`?

**Short answer:** The codebase **still uses the single `topic` field** everywhere. It does **not** use only `semanticTopics` and `semanticTopicBuckets`. All three are used: `topic` is **required**; semantic fields are **optional** and used in addition.

Evidence from the repo (no assumptions):

---

## 1. Type definition

**Files:** `src/webapp/types/index.ts`, `mobile/src/types/index.ts`, `functions/src/types/index.ts`

```ts
export type Chirp = {
  // ...
  topic: Topic;                                    // required (no ?)
  semanticTopics?: string[];                       // optional
  semanticTopicBuckets?: Record<string, string>;  // optional
  // ...
};
```

So at the type level, **every chirp has a `topic`**; semantic fields are optional.

---

## 2. Writing chirps: `topic` is always set

### Webapp/mobile Firestore create

**File:** `src/webapp/lib/firestore.ts` — `createChirp()`

- Initial payload **always** includes `topic`:
  ```ts
  const chirpData: any = {
    authorId: chirp.authorId,
    text: chirp.text,
    topic: chirp.topic,   // always set
    reachMode: chirp.reachMode,
    createdAt: Timestamp.now(),
    commentCount: 0,
  };
  ```
- `semanticTopics` and `semanticTopicBuckets` are added **only if** present:
  ```ts
  if (chirp.semanticTopics && chirp.semanticTopics.length > 0) {
    chirpData.semanticTopics = chirp.semanticTopics;
  }
  if (chirp.semanticTopicBuckets && Object.keys(chirp.semanticTopicBuckets).length > 0) {
    chirpData.semanticTopicBuckets = chirp.semanticTopicBuckets;
  }
  ```

So every chirp document created from web/mobile **has a `topic` field**. Semantic fields are optional.

### Composer (web and mobile)

- **Web:** `src/webapp/components/Composer.tsx` — `chirpData.topic = resolvedTopic` is always set (resolution: selectedTopic → bucketFromAI → userTopics → `'dev'`).
- **Mobile:** `mobile/src/components/Composer/ComposerModal.tsx` — same: `chirpData.topic = resolvedTopic` is always set.

So user-created chirps **always** have a primary `topic`.

### Rechirp / quote

- **Web:** `ChirpCard.tsx`, `PostDetailView.tsx` — rechirp payload: `topic: chirp.topic` (from original).
- **Mobile:** `ChirpCard.tsx`, `PostDetailScreen.tsx` — same: `topic: chirp.topic`.

Rechirps **always** carry the original `topic`.

### Backend (news)

**File:** `functions/src/news/postNews.ts` — `postArticleAsChirp()`

- `topic` is always set from the article:
  ```ts
  const topic = article.category;
  const chirpData = {
    // ...
    topic,
    // ...
  };
  ```
- Then, if `semanticAnalysis` is present, `semanticTopics` and `semanticTopicBuckets` are added.

So news chirps **always** have `topic`; semantic fields are optional.

**Conclusion:** There is **no** code path that creates a chirp **without** `topic`. Every create path sets `topic`; semantic fields are additive.

---

## 3. Reading chirps: `topic` is read and used

### Firestore → app mapping

**File:** `src/webapp/lib/firestore.ts` — `chirpFromFirestore()`

```ts
return {
  // ...
  topic: data.topic,
  semanticTopics: data.semanticTopics || [],
  semanticTopicBuckets: data.semanticTopicBuckets || {},
  // ...
};
```

Same pattern in:

- `src/webapp/lib/services/postAggregationService.js` — `topic: data.topic`
- `mobile/src/services/postAggregationService.ts` — `topic: data.topic`
- `functions/src/services/firestoreService.ts` — `topic: data.topic`
- `src/webapp/lib/services/mostValuedService.js` / `.ts`, `reviewRequestService`, etc.

So **every** chirp read from Firestore exposes `topic`; semantic fields are normalized to default to `[]` / `{}` when missing.

---

## 4. Queries: both `topic` and `semanticTopics` are used

### Topic feed (posts for a given topic)

**Files:** `src/webapp/lib/services/postAggregationService.js`, `mobile/src/services/postAggregationService.ts`

- **Query 1 — primary topic:**  
  `where('topic', '==', normalizedTopic)`
- **Query 2 — semantic topics:**  
  `where('semanticTopics', 'array-contains', normalizedTopic)`

Results are merged and deduped. So the topic feed uses **both** the single `topic` field **and** the `semanticTopics` array.

### Mobile “topic” feed (by user topics)

**File:** `mobile/src/services/chirpService.ts` — `buildTopicQuery()`

```ts
where('topic', 'in', topics.slice(0, 10)),
```

This feed is built **only** from the single `topic` field (user’s topic list). There is no query here that uses only `semanticTopics`.

### Firestore indexes

**File:** `firestore.indexes.json`

- Composite index on `chirps`: `topic` + `createdAt`.
- Composite index on `chirps`: `semanticTopics` (array-contains) + `createdAt`.

So **both** `topic` and `semanticTopics` are first-class in the schema and indexes.

---

## 5. Display and business logic: `topic` is primary

### Display

- **Web ChirpCard / PostDetailView:** Show `#{chirp.topic}`; then optionally `chirp.semanticTopics` as extra tags.
- **Mobile ChirpCard / PostDetailScreen:** `topicLabel = chirp.topic || 'general'`; primary badge is `#{topicLabel}`. Semantic tags are not rendered in the same way as on web.

So the **primary** hashtag shown is always from `chirp.topic`; semantic topics are extra (and mainly surfaced on web).

### For You algorithm

**File:** `shared/lib/algorithm.ts`

- `findMatchingTopic(chirp, topics)` uses:
  - `normalizeTopicValue(chirp.topic)` for the primary topic, and
  - `chirp.semanticTopics` (normalized) for overlap with config topics.
- Used for liked-topic boost and muted-topic filtering.

So the algorithm uses **both** `chirp.topic` and `chirp.semanticTopics`, not only semantic fields.

### Other logic

- **Review requests:** `chirp.topic` and `user.topics` (e.g. `user.topics.includes(chirp.topic)`).
- **Value scoring / fact-check / discussion quality / claim extraction:** All use `chirp.topic` in prompts or domain resolution.
- **Pipeline:** Reads `chirp.topic`; when creating child structures (e.g. rechirp context), passes `topic: parentChirp.topic`.

So **`topic` is still used** across display, feeds, algorithms, and backend.

---

## 6. Summary table

| Concern | Finding |
|--------|--------|
| **Type** | `topic` is required on `Chirp`; `semanticTopics` / `semanticTopicBuckets` are optional. |
| **Create (web/mobile)** | Every chirp payload includes `topic`; semantic fields added only when present. |
| **Create (news)** | `topic = article.category` always; semantic fields optional. |
| **Rechirp** | `topic` copied from original. |
| **Firestore read** | All mappers set `topic: data.topic`. |
| **Topic feed** | Uses both `where('topic', '==', ...)` and `where('semanticTopics', 'array-contains', ...)`. |
| **Mobile topic feed** | Uses only `where('topic', 'in', topics)`. |
| **Indexes** | Separate composites for `topic` and for `semanticTopics`. |
| **Display** | Primary tag is always `chirp.topic`; semantic tags are extra. |
| **Algorithm / backend** | Use both `chirp.topic` and `chirp.semanticTopics`. |

---

## 7. Direct answer to the question

- **Are we still using `topic`?**  
  **Yes.** The single `topic` field is required on the type, always set on create (web, mobile, rechirp, news), read from Firestore, used in queries (topic feed and mobile topic feed), indexes, display, and all relevant backend/algorithm logic.

- **Are we only using `semanticTopics` and `semanticTopicBuckets`?**  
  **No.** Those are optional and used **in addition to** `topic`. There is no migration in the codebase to “semantic only”; both the primary `topic` and the semantic fields are used together.

If the intent is to move to **only** semantic topics and buckets, that would require a deliberate change: making `topic` optional or derived (e.g. from a primary semantic bucket), updating all creates/reads/queries/display/algorithm, and possibly migrating existing data. The current code does not do that.
