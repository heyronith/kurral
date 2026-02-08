# How Hashtags/Topics Are Mapped to Posts — Webapp & Mobile

This document describes how topics/hashtags are associated with each post (chirp) in both the webapp and mobile app, based on code analysis. No assumptions; all flows are traced from creation to display and querying.

---

## 1. Data model: what is stored per post

### 1.1 Types (shared)

- **`Topic`**: `LegacyTopic | string` — a single “bucket” topic (e.g. `'dev'`, `'startups'`, or any dynamic name).
- **`Chirp`** (from `src/webapp/types/index.ts`, `mobile/src/types/index.ts`, `functions/src/types/index.ts`):
  - **`topic`** (required): the **primary topic** for the post (one bucket).
  - **`semanticTopics`** (optional): array of **semantic tags** (e.g. `['react', 'frontend', 'typescript']`).
  - **`semanticTopicBuckets`** (optional): `Record<string, string>` — maps each semantic topic string to its **bucket** (e.g. `{ 'react': 'dev', 'frontend': 'dev' }`).

So each post has:
- One **primary topic** (`topic`) used for feeds, topic views, and ranking.
- Optional **semantic topics** and their **bucket mappings** used for discovery (topic feeds, For You scoring, “liked topic” matching).

### 1.2 Firestore: chirp document

- **Collection**: `chirps`.
- **Written by**: webapp/mobile via `chirpService.createChirp()` (which calls `addDoc(collection(db, 'chirps'), chirpData)`).
- **Relevant fields** (from `src/webapp/lib/firestore.ts` `createChirp` and `chirpFromFirestore`):
  - `topic` (string) — always set.
  - `semanticTopics` (array) — set only if length &gt; 0.
  - `semanticTopicBuckets` (map) — set only if present and non-empty.
- **Read**: `chirpFromFirestore()` maps `data.topic`, `data.semanticTopics || []`, `data.semanticTopicBuckets || {}` into the app `Chirp` type.

Indexes used for topic-based queries:
- `topic` + `createdAt` (topic feed).
- `semanticTopics` (array-contains) + `createdAt` (semantic topic feed).

---

## 2. Where topic/semantic data is set (creation flow)

Topic and semantic fields are **only** set at **create time** (Composer or backend news). Nothing in the codebase updates `topic` / `semanticTopics` / `semanticTopicBuckets` on existing chirps after creation (e.g. no pipeline that rewrites these fields).

---

### 2.1 Webapp: Composer → Firestore

**File**: `src/webapp/components/Composer.tsx` (`handlePost`).

1. **Primary topic (`topic`)**  
   Resolved in this order (all normalized/validated via `isValidTopic`):
   - User-selected topic: `selectedTopic`.
   - AI-suggested bucket: `bucketFromAI` (from ReachAgent content analysis).
   - First matching user profile topic from `userTopics`.
   - Fallback: `'dev'`.

   Then:
   - `ensureBucket(resolvedTopic)` is called so the topic exists in `topics` (and dynamic buckets are created if needed).
   - `chirpData.topic = resolvedTopic` is set.

2. **Semantic topics and buckets**  
   - **Source 1 — AI**: If `getReachAgent()` exists and text length ≥ 4, the Composer calls `reachAgent.analyzePostContent(plainText, availableTopics, existingBuckets)`. That returns `ContentAnalysis`: `semanticTopics`, `entities`, `intent`, `suggestedBucket`.  
     - `semanticTopics` → used as the list of semantic tags.  
     - `suggestedBucket` → sanitized and used as `bucketFromAI` (and in resolution of `topic` above).
   - **Source 2 — Fallback**: If no AI or it fails, `extractSemanticKeywords(plainText)` (regex `[a-z0-9#]{3,}`) is used to get semantic topics.
   - **Normalization**: `normalizeSemanticTopics(semanticTopics)` (lowercase, strip `#`, replace non-alphanumeric with `-`, trim, dedupe, max 50 chars).
   - **Buckets**: For each semantic topic, `mapSemanticTopicToBucket(topic, bucketFromAI || selectedTopic)` is called (`src/webapp/lib/services/topicBucketService.ts`). That:
     - Reads `topicMappings/{normalizedSemanticTopic}`; if a mapping exists, uses that bucket.
     - Otherwise uses the suggested bucket if valid, else a legacy keyword match, else `'dev'`.
     - Calls `ensureBucket(bucket)` and writes the mapping to Firestore.
   - The result is `semanticTopicBuckets: Record<string, string>`.
   - If AI didn’t provide a bucket, the first mapped bucket can be used as `bucketFromAI` for primary topic resolution.
   - **Persistence**: If `semanticTopics.length > 0`, `chirpData.semanticTopics` and `chirpData.semanticTopicBuckets` are set and sent to `addChirp(chirpData)`.

3. **ReachAgent** (`src/webapp/lib/agents/reachAgent.ts`):  
   `analyzePostContent` uses an LLM with a schema that returns `semanticTopics`, `entities`, `intent`, `suggestedBucket`. Fallback (no API or parse error): `extractFallbackTopics(text)`, `inferLegacyTopicFromText(text)` for `suggestedBucket`, and `detectIntentFromText(text)`.

4. **What gets written to Firestore**  
   - From `src/webapp/lib/firestore.ts` `createChirp`:  
     - Always: `topic`, `authorId`, `text`, `reachMode`, `createdAt`, `commentCount`, fact-check fields.  
     - If provided: `semanticTopics`, `semanticTopicBuckets`, `entities`, `intent`, `analyzedAt`, `contentEmbedding`, and other optional chirp fields.  
   - So: **one primary topic + optional semantic topics and bucket map** are stored at creation.

---

### 2.2 Mobile: Composer → Firestore

**File**: `mobile/src/components/Composer/ComposerModal.tsx` (post handler, same logical flow as webapp).

1. **Primary topic**  
   Same resolution order:
   - `selectedTopic` (user-picked).
   - `bucketFromAI` (from ReachAgent).
   - First valid topic in `userTopics` (from `user.topics` or `user.interests`).
   - Fallback: `ALL_TOPICS[0]` (e.g. `'dev'`).

2. **Semantic topics and buckets**  
   - **AI**: If `getReachAgent()` exists and text length ≥ 4, `reachAgent.analyzePostContent(trimmed, availableTopicsForAnalysis, existingBuckets)` is used; result gives `semanticTopics`, `entities`, `intent`, `suggestedBucket`; `suggestedBucket` sanitized → `bucketFromAI`.
   - **Fallback**: `extractSemanticKeywords(trimmed)`.
   - **Normalization**: `normalizeSemanticTopics(semanticTopics)`.
   - **Buckets**: Same as webapp — `mapSemanticTopicToBucket(topic, bucketFromAI || selectedTopic)` (mobile uses `mobile/src/services/topicBucketService.ts`), then `semanticTopicBuckets[topic] = bucket`.
   - **Persistence**: If `semanticTopics.length > 0`, `chirpData.semanticTopics` and `chirpData.semanticTopicBuckets` are set; then `addChirp(chirpData)` → same Firestore `createChirp` path (mobile `useFeedStore` calls the same Firestore API).

So **mobile and webapp map topics/hashtags to a post in the same way**: one primary `topic` + optional `semanticTopics` and `semanticTopicBuckets` at create time, with ReachAgent + topicBucketService for semantics and bucket mapping.

---

### 2.3 Rechirps and quote reposts

- **Rechirp** (webapp `ChirpCard.tsx` / `PostDetailView.tsx`, mobile `ChirpCard.tsx`):  
  When creating the new chirp, the payload explicitly sets `topic: chirp.topic` and `semanticTopics: chirp.semanticTopics` (if any) from the **original** chirp. So the rechirp gets the **same** topic and semantic tags as the original.

- **Quote repost**: User opens Composer with the quoted chirp; they write new text and pick/auto-resolve topic and semantics for the **new** post. The new post’s topic/semantic fields are from the new content and selection, not copied from the quoted chirp.

---

### 2.4 Backend (Cloud Functions): news posts

**File**: `functions/src/news/postNews.ts` — `postArticleAsChirp(article, kuralnewsUserId, semanticAnalysis?)`.

- **Primary topic**: `topic = article.category` (string from the normalized article).
- **Semantic**: If `semanticAnalysis` is provided:
  - `semanticAnalysis.semanticTopics` → `chirpData.semanticTopics`.
  - `semanticAnalysis.suggestedBucket` → normalized (strip `#`, lowercased) → `chirpData.semanticTopicBuckets = { [bucket]: bucket }`.
- Chirp is written to `chirps` with `set` (deterministic ID). So **news posts** get topic from article category and optional semantic fields from the pipeline’s content analysis.

---

### 2.5 Backend pipeline (value/fact-check)

**File**: `functions/src/services/pipeline/index.ts`.  
The pipeline **reads** `chirp.topic` (e.g. for logging) and when creating child structures (e.g. quote/rechirp) passes `topic: parentChirp.topic`. It does **not** write or update `topic` / `semanticTopics` / `semanticTopicBuckets` on the chirp document. So **topic mapping is not modified server-side after creation**.

---

## 3. How topic/semantic data is used (read/display/query)

### 3.1 Display on cards and post detail

- **Webapp**
  - **ChirpCard** (`src/webapp/components/ChirpCard.tsx`): Shows `#{chirp.topic}`. If `chirp.semanticTopics?.length > 0`, shows either all `#{tag}` or a “+N” toggle to expand.
  - **PostDetailView** (`src/webapp/components/PostDetailView.tsx`): Same — `#{chirp.topic}` and optional list of `#{tag}` from `chirp.semanticTopics`.
- **Mobile**
  - **ChirpCard** (`mobile/src/components/ChirpCard.tsx`): Shows `#{topicLabel}` where `topicLabel = chirp.topic || 'general'`. Does not render `semanticTopics` in the snippet found; only the primary topic badge.
  - **PostDetailScreen**: Same idea — primary topic from `chirp.topic`; semantic tags usage would be in the same pattern if present in the detail UI.

So in both apps, the **primary topic** is shown as the main hashtag; **semantic topics** are shown in the webapp (card + detail); mobile currently emphasizes the single topic.

---

### 3.2 Topic feed (posts for a given topic)

**Webapp**: `TopicDetailView.tsx` → `getPostsByTopic(selectedTopic, 168, 200)` from `postAggregationService`.  
**Mobile**: `TopicDetailScreen.tsx` → same `getPostsByTopic(topicName, 168, 200)` from mobile `postAggregationService`.

**Implementation** (webapp `src/webapp/lib/services/postAggregationService.js`, mobile `mobile/src/services/postAggregationService.ts`):

- **Two queries** (both time-bounded by `createdAt`):
  1. **Primary topic**: `where('topic', '==', normalizedTopic)`.
  2. **Semantic topics**: `where('semanticTopics', 'array-contains', normalizedTopic)`.
- Results are merged, deduped by chirp id, sorted by time, then sliced.

So a post appears in a topic feed if **either** its **primary topic** equals that topic **or** that topic is one of its **semantic topics**. Same behavior on web and mobile.

---

### 3.3 For You feed and topic scoring

**Shared**: `shared/lib/algorithm.ts` (and webapp/mobile use this for For You).

- **Eligibility**: `isChirpEligibleForViewer` uses `matchesTopic(chirp, config.mutedTopics)` — if the chirp matches any muted topic (by primary or semantic), it’s excluded.
- **Scoring**: `findMatchingTopic(chirp, config.likedTopics)` is used to give a bonus (e.g. “topic #X you like”). Matching uses:
  - `normalizeTopicValue(chirp.topic)` vs each config topic, and
  - `chirp.semanticTopics` (normalized) with `topicsOverlap(semanticTopic, normalizedConfig)` (substring/overlap).
So **both** `topic` and `semanticTopics` drive “liked topic” boost and “muted topic” filtering in the same way on web and mobile.

---

### 3.4 Other uses

- **NewsDetailView** (webapp): Matches chirps to a news story by keywords, title words, and **topic** — `chirp.topic` and `topics` from the news item.
- **Review requests / most valued / search**: Various services use `chirp.topic` and sometimes `chirp.semanticTopics` for filtering or display (e.g. review request panel, most valued section, search results). Logic is consistent with “one primary topic + optional semantic tags.”

---

## 4. End-to-end summary

| Layer | What maps topics/hashtags to a post |
|-------|-------------------------------------|
| **Data model** | Each chirp has `topic` (one bucket) and optional `semanticTopics` + `semanticTopicBuckets`. |
| **Creation (web)** | Composer resolves `topic` from selected/AI/user/fallback; gets `semanticTopics` (+ optional `suggestedBucket`) from ReachAgent or keyword fallback; maps each semantic topic to a bucket via `topicBucketService`; writes all to Firestore in one create. |
| **Creation (mobile)** | Same as web: same resolution order for `topic`, same ReachAgent + topicBucketService for semantics and buckets, same Firestore create. |
| **Creation (news)** | Backend sets `topic = article.category` and optionally `semanticTopics` / `semanticTopicBuckets` from pipeline analysis. |
| **Rechirp** | New chirp copies `topic` and `semanticTopics` from the original. Quote repost uses new content and Composer resolution. |
| **Display** | Both apps show `#{chirp.topic}`; webapp also shows `chirp.semanticTopics` (expandable). |
| **Topic feed** | Posts for topic T = Firestore query `topic == T` OR `semanticTopics` array-contains T; same on web and mobile. |
| **For You** | Same shared algorithm: `topic` and `semanticTopics` used for liked-topic boost and muted-topic filtering. |

So: **hashtags/topics are mapped to each post at creation time only** (Composer or news pipeline). The **primary topic** is a single bucket; **semantic topics** are an optional list with an optional bucket mapping. Both webapp and mobile use the same mapping logic and the same Firestore fields; the only difference in display is that the webapp also surfaces the full list of semantic tags on cards and post detail.
