# Comprehensive Agents Analysis for Dumbfeed Social Media Platform

This document provides a deep analysis of all AI agents used throughout the Dumbfeed social media platform.

## Overview

The platform uses **15 distinct AI agents** organized across three main deployment contexts:
- **Cloud Functions** (server-side): 6 agents for content processing and value scoring
- **Web App** (client-side): 7 agents for user-facing features
- **Mobile App**: 3 agents (shared implementations with web app)

All agents are built on top of a `BaseAgent` class that provides secure OpenAI API access through proxies.

---

## Agent Categories

### 1. Content Quality & Fact-Checking Agents
### 2. Content Discovery & News Generation Agents
### 3. User Personalization Agents
### 4. Content Creation & Optimization Agents
### 5. Search & Discovery Agents

---

## Detailed Agent Inventory

### 1. CONTENT QUALITY & FACT-CHECKING AGENTS

**Infrastructure Overview:**
All 6 agents in this category are deployed as **Cloud Functions** (server-side) and form a sequential pipeline for content quality assessment. They share a common `BaseAgent` infrastructure that provides secure OpenAI API access with robust error handling, authentication management, and JSON parsing capabilities.

**Pipeline Architecture:**
The agents execute in a strict sequence within `valuePipelineService.processChirpValue()`:
1. **Pre-Check** → 2. **Claim Extraction** → 3. **Fact Check** → 4. **Discussion Analysis** → 5. **Value Scoring** → 6. **Explanation**

Each stage can be skipped or use fallbacks if AI is unavailable, ensuring the pipeline never completely fails.

**BaseAgent Infrastructure:**
- **Location:** `functions/src/agents/baseAgent.ts`
- **Purpose:** Provides standardized OpenAI API access for all agents
- **Key Features:**
  - Cached OpenAI client instance (singleton pattern)
  - Direct API key access from `process.env.OPENAI_API_KEY`
  - Supports `gpt-4o-mini` (default), `gpt-4o`, `gpt-3.5-turbo`
  - Three core methods:
    - `generate(prompt, systemInstruction?)` - Text generation
    - `generateJSON<T>(prompt, systemInstruction?, schema?)` - Structured JSON output
    - `generateJSONWithVision<T>(textPrompt, imageUrl, systemInstruction?, schema?)` - Vision + JSON
  - Robust error handling:
    - Custom `OpenAIAuthenticationError` for 401/auth failures
    - Custom `OpenAIJSONParseError` for parsing failures
    - Automatic JSON extraction from markdown code blocks
    - Graceful fallback when API unavailable (`isAvailable()` check)
  - Temperature: 0.7, Max tokens: 1024 (defaults)

**Data Flow:**
```
Chirp → PreCheck → [if needsFactCheck] → Claim Extraction → Fact Check → Discussion Analysis → Value Scoring → Explanation → Updated Chirp
```

**Error Handling Strategy:**
- Each agent checks `BaseAgent.isAvailable()` before execution
- All agents have heuristic fallback implementations
- Pipeline uses `safeExecute()` wrapper to catch and log errors without stopping
- Retry logic via `withRetry()` wrapper (3 attempts with exponential backoff)
- Progress saved to Firestore at each stage for recovery

---

#### 1.1 Fact Check Pre-Check Agent
**Location:** `functions/src/services/factCheckPreCheckAgent.ts`  
**Purpose:** Cost optimization - determines if content needs fact-checking before running expensive fact-check operations.

**Key Functions:**
- `preCheckChirp(chirp: Chirp)` - Pre-checks posts
- `preCheckComment(comment: Comment)` - Pre-checks comments
- `preCheckText(text: string, imageUrl?: string)` - Pre-checks raw text
- `calculateContentRiskScore(input: RiskInput)` - Heuristic risk calculation

**Implementation Details:**
- **AI Model Selection:** Automatically uses `gpt-4o` for vision tasks when `imageUrl` is present, otherwise `gpt-4o-mini`
- **Heuristic Fallback:** `calculateContentRiskScore()` provides rule-based risk scoring when AI unavailable:
  - Base risk: 0.1
  - High-risk topics (health, finance, politics, etc.): +0.35
  - High-risk keywords (vaccine, treatment, investment, etc.): +0.2
  - Statistical indicators (percentages, numbers): +0.2
  - Authority indicators ("according to", "study shows"): +0.15
  - Text length >200 chars: +0.1, <40 chars: -0.05
  - Image present: +0.05
  - Final score clamped to [0, 1]
- **Signal Detection:** Extracts signals like `stats_or_numbers`, `authority_cue`, `high_risk_keywords`, `high_risk_topic`, `has_image`, `opinion_marker`, `long_text`
- **System Prompt:** Instructs AI to err on the side of verification (set `needsFactCheck=true` when uncertain)
- **Content Classification:** Categorizes as `factual`, `news`, `opinion`, `experience`, or `other`
- **Decision Logic:** If opinion markers detected AND risk < 0.3, returns `needsFactCheck: false` with high confidence

**AI Model:** `gpt-4o-mini` (text), `gpt-4o` (with images)  
**Output:** `PreCheckResult` with `needsFactCheck` boolean, confidence, reasoning, contentType, riskScore, and signals array

**Integration:** Called first in pipeline; result determines whether to proceed with claim extraction and fact-checking

---

#### 1.2 Claim Extraction Agent
**Location:** `functions/src/services/claimExtractionAgent.ts`  
**Purpose:** Extracts verifiable claims from posts and comments for fact-checking.

**Key Functions:**
- `extractClaimsForChirp(chirp: Chirp, quotedChirp?: Chirp)` - Extracts claims from posts
- `extractClaimsForComment(comment: Comment)` - Extracts claims from comments

**Implementation Details:**
- **Model Selection:** Uses `gpt-4o` when any image is present (chirp or quoted chirp), otherwise `gpt-4o-mini`
- **Vision Capabilities:** 
  - Reads ALL text in images: overlays, captions, memes, infographics, embedded text
  - Extracts statistical claims, quotes, and factual statements shown visually
  - Handles image-only posts (no text)
- **Quoted Post Handling:**
  - Extracts claims from BOTH user's new text AND original quoted post text
  - Handles quoted images separately
  - Combines all claims into single array
- **Retry Logic:** 
  - First attempt with standard prompt
  - If no claims returned, retries with strict prompt (emphasizes non-empty text requirement)
  - Falls back to heuristic extraction if both attempts fail
- **Heuristic Fallback:**
  - Splits text into sentences (min 8 chars)
  - Takes first 3 sentences as claims
  - Classifies as `experience` if contains "I " or "my ", otherwise `fact`
  - Sets domain to `general`, risk based on keywords (health/finance/politics → `medium`)
  - Confidence: 0.35 (low)
- **Claim Validation:**
  - Filters out empty text claims
  - Ensures each claim has non-empty `text` field
  - Generates unique IDs: `${chirpId}-${claimId}` or `${chirpId}-claim-${index}`
  - Normalizes confidence to [0, 1]
- **System Prompt Features:**
  - Emphasizes atomic claims (max 240 chars each)
  - Requires domain detection (7 categories)
  - Requires risk level assignment
  - Handles denials/controversies as claims
  - NEVER returns empty claims list when input contains statements

**AI Model:** `gpt-4o-mini` (text), `gpt-4o` (with images)  
**Output:** Array of `Claim` objects with:
- `id`: Unique identifier
- `text`: Claim text (max 240 chars, trimmed)
- `type`: `fact` | `opinion` | `experience`
- `domain`: One of 7 domains
- `riskLevel`: `low` | `medium` | `high`
- `confidence`: 0-1 score
- `extractedAt`: Timestamp
- `evidence?`: Optional evidence array from extraction

**Integration:** Called after pre-check if `needsFactCheck=true`; output feeds into fact-check agent

---

#### 1.3 Fact Check Agent
**Location:** `functions/src/services/factCheckAgent.ts`  
**Purpose:** Verifies the truthfulness of extracted claims using AI and evidence evaluation.

**Key Functions:**
- `factCheckClaims(chirp: Chirp, claims: Claim[])` - Fact-checks multiple claims
- `isTrustedDomain(url?: string)` - Checks if domain is trusted
- `scoreEvidence(url?: string)` - Scores evidence quality by domain

**Implementation Details:**
- **Dual Execution Modes:**
  1. **Standard Mode (default):** Uses `BaseAgent` with `gpt-4o-mini`
  2. **Web Search Mode:** Uses OpenAI Responses API with `gpt-4o` + `web_search_preview` tool
     - Enabled via `OPENAI_WEB_SEARCH !== 'false'` env var
     - Model configurable via `OPENAI_WEB_SEARCH_MODEL` (default: `gpt-4o`)
     - Forces web search for every claim (doesn't rely on training data)
     - Requires URLs in evidence (filters out evidence without URLs)
- **Evidence Quality Scoring:**
  - **Trusted Domains (0.95):** WHO, CDC, NIH, FDA, World Bank, IMF, Reuters, AP News, Nature, Science, FT, NY Times, Guardian
  - **Government/Education (0.85):** Any `.gov` or `.edu` domain
  - **Organizations (0.7):** Any `.org` domain
  - **Blocked Domains (0.0):** Facebook, Reddit, TikTok, Instagram, Telegram
  - **Default (0.5):** Unknown domains
  - **No URL (0.4):** Evidence without URL
- **Evidence Filtering:**
  - Removes evidence with quality ≤ 0.1
  - In web search mode, requires URL presence
  - Normalizes quality scores to [0, 1]
- **Verdict Sanitization:**
  - Only accepts: `true`, `false`, `mixed`, `unknown`
  - Invalid verdicts default to `unknown`
- **Confidence Normalization:**
  - Clamps confidence to [0, 1]
  - Defaults to 0.5 if invalid
- **Error Handling:**
  - Prominently logs authentication errors (critical for debugging)
  - Falls back to `unknown` verdict with low confidence (0.25) on errors
  - Adds caveat: "Automatic fallback: unable to verify claim"
- **Prompt Construction:**
  - Includes post context (ID, author, topic)
  - Includes post text (if present)
  - Includes image URL (if present) with note about text extraction
  - Emphasizes credible sources and avoiding speculation
  - Instructs to return "unknown" if unsure
- **Web Search Response Parsing:**
  - Handles complex response structure with `output_text` and `output` arrays
  - Extracts JSON from various response formats
  - Logs web search summary (citation count, search presence)

**AI Model:** `gpt-4o-mini` (default), `gpt-4o` (with web search)  
**Output:** Array of `FactCheck` objects with:
- `id`: `${claimId}-fact-check`
- `claimId`: Reference to original claim
- `verdict`: `true` | `false` | `mixed` | `unknown`
- `confidence`: 0-1 score
- `evidence`: Array of evidence objects (source, url?, snippet, quality)
- `caveats?`: Optional array of caveat strings
- `checkedAt`: Timestamp

**Integration:** Called after claim extraction; processes claims sequentially; results feed into value scoring and policy evaluation

---

#### 1.4 Discussion Quality Agent
**Location:** `functions/src/services/discussionQualityAgent.ts`  
**Purpose:** Analyzes comment thread quality to assess discourse value.

**Key Functions:**
- `analyzeDiscussion(chirp: Chirp, comments: Comment[])` - Analyzes entire discussion threads

**Implementation Details:**
- **Comment Limiting:** Analyzes maximum 20 comments (takes first 20 from array)
- **Comment Summarization:** Each comment summarized as `Comment {id} by {authorId}: {text}` (max 600 chars)
- **Thread Quality Dimensions (0-1 each):**
  - `informativeness`: How informative the discussion is
  - `civility`: Level of respectful discourse
  - `reasoningDepth`: Depth of reasoning and argumentation
  - `crossPerspective`: Diversity of perspectives
  - `summary`: Text summary of thread quality
- **Comment Role Classification:**
  - `question`: Asking for information
  - `answer`: Providing information
  - `evidence`: Citing sources or data
  - `opinion`: Expressing viewpoint
  - `moderation`: Moderating discussion
  - `other`: Other roles
- **Comment Contribution Scoring:**
  - Scores each comment across 5 value dimensions (0-1 each):
    - `epistemic`: Factual rigor
    - `insight`: Novelty/synthesis
    - `practical`: Actionable value
    - `relational`: Healthy discourse
    - `effort`: Depth of work
  - Calculates `total` as average of 5 dimensions
  - Normalizes all scores to [0, 1]
- **Heuristic Fallback:**
  - If no comments: Returns zero scores with "No discussion yet" summary
  - If AI unavailable: Uses length-based scoring:
    - Length score = min(1, textLength / 400)
    - Epistemic: lengthScore * 0.6
    - Insight: lengthScore * 0.5
    - Practical: lengthScore * 0.3
    - Relational: 0.4 (fixed)
    - Effort: lengthScore
    - Role: `question` if contains "?", otherwise `opinion`
    - Thread quality: Fixed moderate scores (0.3-0.7 range)
- **Prompt Construction:**
  - Includes post ID, topic, and full post text
  - Lists all comments (up to 20) with summaries
  - Instructs to score dimensions 0-1 and classify roles

**AI Model:** `gpt-4o-mini`  
**Output:** `DiscussionAnalysis` object with:
- `threadQuality`: Object with 4 dimension scores + summary
- `commentInsights`: Record mapping comment ID to:
  - `role`: Comment role classification
  - `contribution`: Value vector (5 dimensions + total)

**Integration:** Called after fact-checking; analyzes all comments for a chirp; results feed into value scoring agent

---

#### 1.5 Value Scoring Agent
**Location:** `functions/src/services/valueScoringAgent.ts`  
**Purpose:** Scores posts across 5 value dimensions to determine overall content quality.

**Key Functions:**
- `scoreChirpValue(chirp: Chirp, claims: Claim[], factChecks: FactCheck[], discussion?: DiscussionAnalysis)` - Scores post value
- `sanitizeForPrompt(value: string)` - Prevents prompt injection attacks
- `getDimensionWeights(chirp: Chirp, claims: Claim[])` - Returns domain-specific weights
- `applyFactCheckPenalty(vector: ValueVector, factChecks: FactCheck[])` - Applies misinformation penalties

**Implementation Details:**
- **Value Dimensions (0-1 each):**
  - **Epistemic**: Factual rigor and correctness
  - **Insight**: Novelty, synthesis, non-obvious perspectives
  - **Practical**: Actionable guidance or clear takeaways
  - **Relational**: Healthy discourse, empathy, constructive tone
  - **Effort**: Depth of work, sourcing, structure
- **Domain-Specific Weighting:**
  - **Health/Politics:** Epistemic 0.35, Insight 0.25, Practical 0.2, Relational 0.1, Effort 0.1
  - **Technology/Startups/AI:** Epistemic 0.25, Insight 0.35, Practical 0.2, Relational 0.1, Effort 0.1
  - **Productivity/Design:** Epistemic 0.2, Insight 0.25, Practical 0.35, Relational 0.1, Effort 0.1
  - **Default:** Epistemic 0.3, Insight 0.25, Practical 0.2, Relational 0.15, Effort 0.1
  - Domain determined by: dominant claim domain (weighted by risk level) or topic/semantic topics
- **Fact-Check Penalties:**
  - If no fact-checks: Caps epistemic at 0.35 (uncertainty penalty)
  - For confident false verdicts (confidence > 0.7):
    - Penalty = min(0.8, falseCount * 0.25)
    - Epistemic: `epistemic * (1 - penalty)`
    - Insight: `insight * (1 - penalty * 0.3)` (smaller penalty)
- **Prompt Injection Prevention:**
  - Removes null bytes and control characters
  - Removes code blocks (markdown and inline)
  - Removes instruction patterns: "ignore previous", "disregard", "forget", "override"
  - Removes role assignments: "you are now", "act as", "pretend to be"
  - Removes output format commands: "output format", "respond as", "use format"
  - Removes delimiters: "---new instruction", "===new prompt", etc.
  - Removes direct instruction headers
  - Truncates to 2000 chars max
  - Normalizes whitespace
- **Input Summary Construction:**
  - Post text (sanitized, max 700 chars)
  - Claim summary (count, risk breakdown)
  - Fact-check summary (verdicts and confidence scores)
  - Discussion quality summary (4 dimensions)
  - Comment count
- **Score Calculation:**
  - AI generates raw scores for 5 dimensions
  - Scores clamped to [0, 1]
  - Fact-check penalties applied
  - Vector validated (NaN/infinite → 0.5)
  - Weighted total: `Σ(dimension * weight)`
  - Total clamped to [0, 1]
- **Driver Identification:**
  - AI identifies key drivers of value (optional string array)
  - Filtered to remove empty strings

**AI Model:** `gpt-4o-mini`  
**Output:** `ValueScore` object with:
- `epistemic`, `insight`, `practical`, `relational`, `effort`: 0-1 scores
- `total`: Weighted total score (0-1)
- `confidence`: AI confidence in scoring (0-1)
- `updatedAt`: Timestamp
- `drivers?`: Optional array of key value drivers

**Integration:** Called after fact-checking and discussion analysis; aggregates all previous results into final value score

---

#### 1.6 Explainer Agent
**Location:** `functions/src/services/explainerAgent.ts`  
**Purpose:** Generates human-readable explanations for value scores.

**Key Functions:**
- `generateValueExplanation(chirp: Chirp, valueScore: ValueScore, claims: Claim[], factChecks: FactCheck[], discussion?: DiscussionQuality)` - Generates explanation
- `fallbackExplanation(...)` - Heuristic explanation when AI unavailable

**Implementation Details:**
- **Explanation Guidelines:**
  - Maximum 3 sentences
  - References strongest positive driver first
  - Mentions concerns if verdicts were mixed/false
  - Plain language (no jargon)
  - Addresses author directly (second person)
- **Prompt Construction:**
  - Post text (first 700 chars)
  - Full value vector (5 dimensions)
  - Total score and confidence
  - Claim count
  - Fact-check summary (claimId:verdict pairs)
  - Discussion summary (if available)
- **Heuristic Fallback:**
  - Format: "Epistemic {score} driven by {trueCount} verified claims. Insight {score} from {claimCount} extracted claims."
  - Adds discussion quality if available
  - Concatenates parts with spaces
- **Error Handling:**
  - Returns fallback explanation on any error
  - Trims output string
  - Returns empty string if all else fails

**AI Model:** `gpt-4o-mini`  
**Output:** String explanation (max 3 sentences) of why the post received its value score

**Integration:** Called after value scoring; generates user-facing explanation for the computed score

---

#### Pipeline Orchestration & Data Flow

**Orchestrator:** `functions/src/services/valuePipelineService.ts`

**Main Function:** `processChirpValue(chirp: Chirp, options?: { skipFactCheck?: boolean })`

**Execution Flow:**

1. **Initialization & Risk Assessment**
   - Calculates heuristic risk score (for logging)
   - Initializes insights object to collect results
   - Sets up `safeExecute()` wrapper for error handling

2. **Pre-Check Stage**
   - Calls `preCheckChirp(chirp)` via `safeExecute()` + `withRetry()`
   - Handles special cases:
     - **Rechirps:** Checks if original has complete fact-check data (inherits if available)
     - **Quoted Posts:** May trigger pre-check on quoted post
   - Decision: `shouldProceedWithFactCheck = preCheckResult?.needsFactCheck ?? false`
   - If `needsFactCheck: false`, sets `factCheckStatus: 'clean'` and skips to discussion analysis

3. **Claim Extraction Stage**
   - Only executes if `shouldProceedWithFactCheck === true`
   - Handles quoted posts:
     - If quoted post has complete fact-check data: extracts only user's new claims
     - Matches user claims to original claims (for fact-check reuse)
     - If quoted post incomplete: extracts from both texts
   - Calls `extractClaimsForChirp(chirp, quotedChirp?)`
   - Saves claims to Firestore progress
   - If no claims extracted but pre-check said needed: sets `factCheckStatus: 'needs_review'`

4. **Fact-Check Stage**
   - Only executes if `shouldProceedWithFactCheck === true` AND claims exist
   - Optimizations:
     - **Quoted Post Reuse:** If user claims match original claims, reuses fact-checks
     - Only fact-checks new/unmatched claims
   - Calls `factCheckClaims(chirp, claimsToCheck)` for each batch
   - Saves fact-checks to Firestore progress
   - Applies policy evaluation (determines `factCheckStatus`: `clean` | `needs_review` | `blocked`)

5. **Discussion Analysis Stage**
   - Always executes (independent of fact-checking)
   - Loads all comments for chirp (via `commentService.getCommentsForChirp()`)
   - Calls `analyzeDiscussion(chirp, comments)`
   - Saves discussion quality to insights

6. **Value Scoring Stage**
   - Only executes if `BaseAgent.isAvailable()`
   - Calls `scoreChirpValue(chirp, claims, factChecks, discussion)`
   - Applies domain-specific weights
   - Applies fact-check penalties
   - Saves value score to insights

7. **Explanation Generation Stage**
   - Only executes if value score computed successfully
   - Calls `generateValueExplanation(chirp, valueScore, claims, factChecks, discussion)`
   - Saves explanation to insights

8. **Finalization**
   - Combines all insights into updated chirp object
   - Saves final progress as `'completed'`
   - Records post value for reputation system (if new score)
   - Syncs rechirp status if applicable

**Error Handling Strategy:**
- `safeExecute<T>(label, fn)`: Wraps each agent call, catches errors, logs, returns `undefined`
- `withRetry(fn, label)`: Retries failed operations (3 attempts, exponential backoff)
- Progress saved at each stage (allows recovery from partial failures)
- Fallbacks: Each agent has heuristic fallback when AI unavailable
- Never throws: Pipeline always returns updated chirp (even if partially processed)

**Special Cases:**
- **Rechirps:** Inherits fact-check data from original if complete
- **Quoted Posts:** Extracts claims from both texts, reuses fact-checks when possible
- **Image-Only Posts:** Handled by vision models in pre-check and claim extraction
- **Empty Content:** Early returns with appropriate status
- **Still Processing:** Returns chirp with `factCheckingStatus: 'pending'`

**Performance Optimizations:**
- Pre-check avoids expensive fact-checking for low-risk content
- Claim matching reuses fact-checks for quoted posts
- Discussion analysis limited to 20 comments
- Progress saved incrementally (allows partial recovery)
- Retry logic prevents transient failures from blocking pipeline

**Data Persistence:**
- Progress saved to Firestore at each stage via `saveChirpProgress()`
- Final results merged into chirp document
- Supports resuming from partial state

---

### 2. CONTENT DISCOVERY & NEWS GENERATION AGENTS

#### 2.1 Story Discovery Agent
**Location:** `src/webapp/lib/services/storyDiscoveryAgent.ts`  
**Purpose:** Discovers newsworthy stories by clustering related posts together.

**Key Functions:**
- `discoverStories(posts: Chirp[], userTopics: string[])` - Discovers stories from post collections

**Capabilities:**
- Analyzes collections of posts to identify distinct newsworthy stories
- Groups posts that refer to the same real-world event
- Returns up to 3 stories per analysis
- Each story must reference at least 5 post IDs
- Scores newsworthiness (0-1)
- Extracts key entities, keywords, and topics
- Provides confidence scores for story coherence
- Prefers stories with breaking news, concrete events, or strong engagement

**AI Model:** `gpt-4o-mini`  
**Output:** Array of `StoryCluster` objects with summary, headline idea, post IDs, topics, and scores

---

#### 2.2 Story Selection Agent
**Location:** `src/webapp/lib/services/storySelectionAgent.ts`  
**Purpose:** Selects the best story from discovered stories for news generation.

**Key Functions:**
- `selectBestStory(stories: StoryCluster[], existingNews: TrendingNews[], userId: string | null)` - Selects optimal story

**Capabilities:**
- Scores stories based on:
  - Newsworthiness (50% weight)
  - Confidence (25% weight)
  - Engagement bonus (20% weight)
  - Topic diversity bonus (5%)
- Applies duplicate penalty for recently published stories (3-hour window)
- Returns selected story with alternatives and reasoning

**AI Model:** None (pure algorithmic scoring)  
**Output:** `StorySelectionResult` with selected story, alternatives, and reason

---

#### 2.3 News Generation Agent
**Location:** `src/webapp/lib/services/newsGenerationAgent.ts`  
**Purpose:** Generates comprehensive news stories from aggregated posts.

**Key Functions:**
- `generateNewsFromPosts(posts: Chirp[], topic: string, context?: StoryContext)` - Generates news story

**Capabilities:**
- Synthesizes information from multiple posts (up to 100 posts analyzed)
- Creates:
  - **Headline**: Max 60 characters, factual and concise
  - **Summary**: Max 280 characters, 1-2 sentences
  - **Full Description**: 2-3 paragraphs, news article style
  - **Key Facts**: 5-10 verifiable facts extracted from posts
  - **Confidence**: 0-1 score based on fact consistency
  - **Related Topics**: Relevant topic tags
  - **Keywords**: 10-15 important keywords for search/matching
- Notes conflicting information when present
- Indicates incomplete information
- Maintains neutral, factual tone

**AI Model:** `gpt-4o-mini`  
**Output:** `NewsSummary` with headline, summary, full description, key facts, and metadata

---

### 3. USER PERSONALIZATION AGENTS

#### 3.1 Profile Summary Agent
**Location:** 
- `src/webapp/lib/services/profileSummaryAgent.ts` (web app)
- `mobile/src/services/profileSummaryAgent.ts` (mobile app)

**Purpose:** Generates semantic profile summaries for personalized content recommendations.

**Key Functions:**
- `generateProfileSummary(user: User)` - Generates summary from user data
- `generateAndSaveProfileSummary(userId: string)` - Generates and saves summary to Firestore

**Capabilities:**
- Creates concise summaries (2-4 sentences, max 75 words)
- Analyzes: interests, bio, location, URL, reputation domains, value stats, following count
- Extracts implicit signals from bio, location, and URL
- Writes in third person
- Generates embeddings for semantic matching
- Updates profile with version tracking

**AI Model:** `gpt-4o-mini`  
**Output:** String summary of user profile

---

#### 3.2 Profile Interest Agent
**Location:**
- `src/webapp/lib/services/profileInterestAgent.ts` (web app)
- `mobile/src/services/profileInterestAgent.ts` (mobile app)

**Purpose:** Extracts interest keywords from natural language statements.

**Key Functions:**
- `extractInterestsFromStatement(statement: string)` - Extracts interests from text

**Capabilities:**
- Parses natural language to extract topical keywords
- Returns array of 1-3 word keywords (max 10)
- Focuses on actionable topics like "ai research", "public policy", "sports"
- Handles various response formats (arrays, objects, markdown)
- Normalizes and deduplicates results

**AI Model:** `gpt-4o-mini`  
**Output:** Array of interest keyword strings

---

#### 3.3 Tuning Agent
**Location:** `src/webapp/lib/agents/tuningAgent.ts`  
**Purpose:** Learns optimal algorithm weights for individual users based on behavior.

**Key Functions:**
- `suggestTuning(behaviorData: UserBehaviorData)` - Suggests algorithm improvements
- `TuningAgent.collectBehaviorData(...)` - Collects user behavior data

**Capabilities:**
- Analyzes user behavior patterns:
  - Chirps viewed vs. engaged
  - Following engagement rate
  - Active conversation engagement
  - Topic engagement patterns
- Suggests:
  - `followingWeight`: `none`, `light`, `medium`, or `heavy`
  - `boostActiveConversations`: Boolean
  - `likedTopics`: Array of topics user engages with
  - `mutedTopics`: Array of topics user avoids
- Provides confidence scores (only suggests if confidence > 0.3)
- Conservative approach - only suggests changes with clear patterns

**AI Model:** `gpt-4o-mini`  
**Output:** `TuningSuggestion` with algorithm settings and explanations

---

### 4. CONTENT CREATION & OPTIMIZATION AGENTS

#### 4.1 Reach Agent
**Location:**
- `src/webapp/lib/agents/reachAgent.ts` (web app)
- `mobile/src/services/reachAgentService.ts` (mobile app)

**Purpose:** Suggests optimal topic selection and audience reach settings for posts.

**Key Functions:**
- `suggestTopicsAndReach(text: string, availableTopics: TopicMetadata[], userTopics: string[])` - Suggests topics and reach
- `analyzePostContent(text: string, availableTopics: TopicMetadata[], existingBuckets: string[])` - Analyzes content semantics
- `suggestReachSettings(text: string, topic: Topic, userTopics?: string[])` - Legacy method for reach settings only

**Capabilities:**
- **Topic Suggestion:**
  - Suggests 1-3 most relevant topics ranked by relevance
  - Considers topic engagement (posts in last 48h, user count)
  - Marks user's profile topics
  - Provides confidence scores and explanations
- **Content Analysis:**
  - Extracts semantic topics (3-8 keywords)
  - Identifies entities (products, technologies, people, companies)
  - Detects intent: `question`, `announcement`, `tutorial`, `opinion`, `update`, `discussion`
  - Suggests topic bucket (existing or new)
- **Reach Settings:**
  - Suggests `allowFollowers` and `allowNonFollowers` settings
  - Based on content intent (personal vs. public vs. discussion)
  - Generates target audience descriptions and embeddings

**AI Model:** `gpt-4o-mini`  
**Output:** `ReachSuggestion` with topics, audience settings, and explanations

---

### 5. SEARCH & DISCOVERY AGENTS

#### 5.1 Search Agent
**Location:**
- `src/webapp/lib/agents/searchAgent.ts` (web app)
- `mobile/src/services/searchAgent.ts` (mobile app)

**Purpose:** Provides semantic search understanding and result ranking.

**Key Functions:**
- `understandQuery(query: string)` - Parses and understands search queries
- `rankResults(query: string, chirps: Chirp[], getAuthor: (userId: string) => User | undefined, limit: number)` - Ranks search results

**Capabilities:**
- **Query Understanding:**
  - Extracts semantic intent (what user really wants)
  - Identifies keywords for searching
  - Detects topics/hashtags mentioned
  - Identifies usernames or people mentioned
- **Result Ranking:**
  - Ranks chirps by relevance to query (0-1 scores)
  - Considers: text content matching, topic relevance, recency, author relevance
  - Provides explanations for relevance scores
  - Returns top N results sorted by relevance

**AI Model:** `gpt-4o-mini`  
**Output:** `SearchQuery` (intent, keywords, topics, users) and `SearchResult[]` (ranked chirps with scores)

---

## Base Agent Infrastructure

### BaseAgent Class
**Locations:**
- `functions/src/agents/baseAgent.ts` (Cloud Functions - server-side)
- `src/webapp/lib/agents/baseAgent.ts` (Web app - client-side via proxy)
- `mobile/src/services/baseAgent.ts` (Mobile app - client-side via proxy)

**Purpose:** Provides secure, standardized OpenAI API access for all agents.

**Key Features:**
- **Server-side (Cloud Functions):**
  - Direct OpenAI API access with API key from environment
  - Supports `gpt-4o-mini` (default), `gpt-4o`, `gpt-3.5-turbo`
  - Handles authentication errors gracefully
  - JSON parsing with error handling
  - Vision support for image analysis

- **Client-side (Web/Mobile):**
  - Uses secure proxy endpoint (`/api/openai-proxy`)
  - Never exposes API keys to client
  - Supports same models as server-side
  - Requires user authentication

**Methods:**
- `generate(prompt: string, systemInstruction?: string)` - Text generation
- `generateJSON<T>(prompt: string, systemInstruction?: string, schema?: any)` - JSON generation
- `generateJSONWithVision<T>(textPrompt: string, imageUrl: string | null, systemInstruction?: string, schema?: any)` - Vision + JSON
- `isAvailable()` - Checks if OpenAI API is configured

---

## Agent Usage Patterns

### Value Pipeline (Server-Side)
The core content quality pipeline uses agents in this sequence:

1. **Pre-Check** → Determines if fact-checking needed
2. **Claim Extraction** → Extracts verifiable claims
3. **Fact Check** → Verifies claims
4. **Discussion Analysis** → Analyzes comment threads
5. **Value Scoring** → Scores overall value
6. **Explanation** → Generates human-readable explanation

### Content Discovery (Client-Side)
News generation pipeline:

1. **Story Discovery** → Finds newsworthy stories in posts
2. **Story Selection** → Picks best story
3. **News Generation** → Creates news article

### User Personalization (Client-Side)
Profile and feed optimization:

1. **Profile Summary** → Creates semantic profile
2. **Profile Interest** → Extracts interests from statements
3. **Tuning Agent** → Optimizes feed algorithm

### Content Creation (Client-Side)
Post creation assistance:

1. **Reach Agent** → Suggests topics and audience settings
2. **Content Analysis** → Extracts semantic metadata

### Search (Client-Side)
Search functionality:

1. **Search Agent** → Understands queries and ranks results

---

## Model Usage Summary

| Model | Usage | Agents |
|-------|-------|--------|
| `gpt-4o-mini` | Default for most agents | All agents (default) |
| `gpt-4o` | Vision tasks, complex analysis | Claim Extraction (with images), Fact Check Pre-Check (with images) |
| `gpt-3.5-turbo` | Alternative (not currently used) | Available via BaseAgent |

---

## Error Handling & Fallbacks

All agents implement robust fallback mechanisms:

1. **AI Unavailable:** Falls back to heuristic-based approaches
2. **API Errors:** Returns fallback results with error messages
3. **Parsing Errors:** Handles malformed JSON responses gracefully
4. **Authentication Errors:** Logs prominently and uses fallbacks

---

## Security Considerations

1. **API Key Protection:**
   - Server-side: Environment variables
   - Client-side: Proxy endpoint (never exposed)

2. **Prompt Injection Prevention:**
   - Value Scoring Agent sanitizes input text
   - Removes instruction patterns, role assignments, output format commands

3. **Content Sanitization:**
   - All agents validate and sanitize inputs
   - Length limits enforced
   - Special characters handled

---

## Performance Optimizations

1. **Cost Optimization:**
   - Pre-check agent avoids expensive fact-checks when unnecessary
   - Uses `gpt-4o-mini` (cheaper) for most tasks
   - Only uses `gpt-4o` for vision tasks

2. **Token Limits:**
   - Story Discovery: Limits to 120 posts
   - News Generation: Limits to 100 posts
   - Discussion Analysis: Limits to 20 comments

3. **Caching:**
   - BaseAgent caches OpenAI client instances
   - Profile summaries cached in user documents

---

## Future Enhancements

Potential areas for expansion:

1. **Multi-modal Agents:** More vision-based analysis
2. **Real-time Agents:** Streaming responses for better UX
3. **Specialized Models:** Fine-tuned models for specific tasks
4. **Agent Orchestration:** Multi-agent workflows
5. **A/B Testing:** Compare agent performance
6. **Cost Tracking:** Monitor API usage per agent

---

## Summary Statistics

- **Total Agents:** 15
- **Server-Side Agents:** 6 (Cloud Functions)
- **Client-Side Agents:** 7 (Web App) + 3 (Mobile App, shared)
- **Base Infrastructure:** 3 BaseAgent implementations
- **Primary Model:** `gpt-4o-mini`
- **Vision Model:** `gpt-4o`
- **Total Agent Files:** 26+ (including duplicates across platforms)

---

*Last Updated: Analysis based on codebase as of current state*

