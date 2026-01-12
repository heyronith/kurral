// Core Data Types

// Legacy topic buckets (fixed set)
export const LEGACY_TOPICS = [
  'dev',
  'startups',
  'music',
  'sports',
  'productivity',
  'design',
  'politics',
  'crypto',
] as const;

export type LegacyTopic = typeof LEGACY_TOPICS[number];

// Topic can be a legacy bucket or a dynamically created bucket name
export type Topic = LegacyTopic | string;

export type TopicName = string;

export type ClaimDomain =
  | 'health'
  | 'finance'
  | 'politics'
  | 'technology'
  | 'science'
  | 'society'
  | 'general';

export type ClaimType = 'fact' | 'opinion' | 'experience';
export type ClaimRiskLevel = 'low' | 'medium' | 'high';

export type ClaimEvidence = {
  source: string;
  url?: string;
  snippet: string;
  quality: number; // 0-1
};

export type Claim = {
  id: string;
  text: string;
  type: ClaimType;
  domain: ClaimDomain;
  riskLevel: ClaimRiskLevel;
  confidence: number; // 0-1
  extractedAt: Date;
  evidence?: ClaimEvidence[];
};

export type FactCheckVerdict = 'true' | 'false' | 'mixed' | 'unknown';

export type FactCheck = {
  id: string;
  claimId: string;
  verdict: FactCheckVerdict;
  confidence: number;
  evidence: ClaimEvidence[];
  caveats?: string[];
  checkedAt: Date;
};

export type ValueVector = {
  epistemic: number;
  insight: number;
  practical: number;
  relational: number;
  effort: number;
};

export type ValueScore = ValueVector & {
  total: number;
  confidence: number;
  updatedAt: Date;
  drivers?: string[];
};

export type KurralScoreComponents = {
  qualityHistory: number;
  violationHistory: number;
  engagementQuality: number;
  consistency: number;
  communityTrust: number;
};

export type KurralScoreHistoryEntry = {
  date: Date;
  score: number;
  delta: number;
  reason: string;
};

export type KurralScore = {
  score: number; // 0-100
  lastUpdated: Date;
  components: KurralScoreComponents;
  history: KurralScoreHistoryEntry[];
};

export type DiscussionQuality = {
  informativeness: number;
  civility: number;
  reasoningDepth: number;
  crossPerspective: number;
  summary: string;
};

export type BookmarkFolder = {
  id: string;
  name: string;
  chirpIds: string[];
  createdAt: Date;
};

export type User = {
  id: string;
  name: string;
  handle: string;
  email?: string;
  interests?: string[];
  createdAt: Date;
  following: string[]; // User IDs
  bookmarks?: string[]; // Chirp IDs that user has bookmarked (legacy - for backward compatibility)
  bookmarkFolders?: BookmarkFolder[]; // Organized bookmark folders
  // Onboarding fields
  displayName?: string;
  userId?: string; // Unique user ID (handle alternative)
  topics?: string[]; // Hashtags/topics user likes
  bio?: string;
  url?: string;
  location?: string; // City
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Date;
  firstTimeUser?: boolean;
  autoFollowedAccounts?: string[];
  profilePictureUrl?: string; // Profile picture URL
  coverPhotoUrl?: string; // Cover photo URL
  reputation?: Record<string, number>;
  valueStats?: {
    postValue30d: number;
    commentValue30d: number;
    lifetimePostValue?: number;
    lifetimeCommentValue?: number;
    lastUpdated: Date;
  };
  kurralScore?: KurralScore;
  forYouConfig?: ForYouConfig;
  profileSummary?: string; // AI-generated semantic profile summary
  profileSummaryVersion?: number; // Version number for tracking updates
  profileSummaryUpdatedAt?: Date; // When summary was last generated
  profileEmbedding?: number[]; // Embedding vector for profile summary
  profileEmbeddingVersion?: number;
  semanticTopics?: string[];
};

export type TunedAudience = {
  allowFollowers: boolean;
  allowNonFollowers: boolean;
  targetAudienceDescription?: string; // Optional semantic description
  targetAudienceEmbedding?: number[]; // Embedding for semantic audience description
};

export type ReachMode = 'forAll' | 'tuned';

export type Chirp = {
  id: string;
  authorId: string;
  text: string;
  topic: Topic;
  semanticTopics?: string[];
  semanticTopicBuckets?: Record<string, string>; // semantic topic -> bucket mapping
  entities?: string[];
  intent?: string;
  analyzedAt?: Date;
  reachMode: ReachMode;
  tunedAudience?: TunedAudience;
  contentEmbedding?: number[]; // Embedding for the chirp content
  createdAt: Date;
  rechirpOfId?: string; // If this is a rechirp, reference original
  quotedChirpId?: string; // If this is a quote repost, reference original
  quotedChirp?: Chirp; // Hydrated quoted chirp (client-side only, not in Firestore)
  commentCount: number;
  bookmarkCount?: number;
  rechirpCount?: number;
  countryCode?: string; // ISO 3166-1 alpha-2 country code where post was made
  imageUrl?: string; // Optional image URL
  scheduledAt?: Date; // Optional scheduled post time
  formattedText?: string; // Optional formatted text (markdown-style)
  mentions?: string[]; // Array of User IDs mentioned in the post
  factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'; // Processing status
  factCheckingStartedAt?: Date; // When processing started
  claims?: Claim[];
  factChecks?: FactCheck[];
  factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
  valueScore?: ValueScore;
  valueExplanation?: string;
  discussionQuality?: DiscussionQuality;
  qualityWeightedBookmarkScore?: number;
  qualityWeightedRechirpScore?: number;
  qualityWeightedCommentScore?: number;
  qualityScoresLastUpdated?: Date;
  predictedEngagement?: {
    expectedViews7d: number;
    expectedBookmarks7d: number;
    expectedRechirps7d: number;
    expectedComments7d: number;
    predictedAt: Date;
  };
  predictionValidation?: {
    flaggedForReview: boolean;
    overallError: number;
    validatedAt: Date;
  };
};

export type Comment = {
  id: string;
  chirpId: string;
  authorId: string;
  text: string;
  createdAt: Date;
  parentCommentId?: string; // For nested replies - ID of parent comment
  replyToUserId?: string; // User ID being replied to (for @mentions and notifications)
  depth?: number; // Nesting depth (0 = top-level comment)
  replyCount?: number; // Number of direct replies to this comment
  discussionRole?: 'question' | 'answer' | 'evidence' | 'opinion' | 'moderation' | 'other';
  valueContribution?: ValueVector & { total: number };
  imageUrl?: string; // Optional image URL
  scheduledAt?: Date; // Optional scheduled comment time
  formattedText?: string; // Optional formatted text (markdown-style)
  factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'; // Processing status
  factCheckingStartedAt?: Date; // When processing started
  claims?: Claim[];
  factChecks?: FactCheck[];
  factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
};

export type FollowingWeight = 'none' | 'light' | 'medium' | 'heavy';

export type ForYouConfig = {
  followingWeight: FollowingWeight;
  boostActiveConversations: boolean;
  likedTopics: TopicName[];
  mutedTopics: TopicName[];
  timeWindowDays?: number;
  semanticSimilarityThreshold?: number;
};

export const DEFAULT_FOR_YOU_CONFIG: ForYouConfig = {
  followingWeight: 'medium',
  boostActiveConversations: true,
  likedTopics: [],
  mutedTopics: [],
  timeWindowDays: 7,
  semanticSimilarityThreshold: 0.7,
};

export type FeedType = 'latest' | 'forYou';

export const ALL_TOPICS: LegacyTopic[] = [...LEGACY_TOPICS];

// Helpers to validate topic values
export const isLegacyTopic = (value?: string): value is LegacyTopic => {
  if (!value) return false;
  return LEGACY_TOPICS.includes(value as LegacyTopic);
};

export const isValidTopic = (value?: string): value is Topic => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (isLegacyTopic(normalized)) return true;
  // Allow dynamic buckets: lowercase, alphanumeric + hyphen, 2-50 chars
  return /^[a-z0-9-]{2,50}$/.test(normalized);
};

// Topic metadata for engagement tracking
export type TopicMetadata = {
  name: string; // Topic name (e.g., 'dev')
  postsLast48h: number; // Number of posts in last 48 hours
  postsLast1h: number; // Number of posts in last 1 hour (for velocity)
  postsLast4h: number; // Number of posts in last 4 hours (for velocity)
  totalUsers: number; // Total users who follow/engage with this topic
  lastEngagementUpdate: Date; // When engagement was last calculated
  averageVelocity1h: number; // Average posts per hour over last 24h (for spike detection)
  isTrending: boolean; // Whether topic is currently trending (velocity spike)
  lastNewsGeneratedAt?: Date; // When AI news was last generated for this topic
};

// Firestore document types (with Firestore timestamps)
export type FirestoreChirp = Omit<Chirp, 'createdAt' | 'scheduledAt' | 'analyzedAt'> & {
  createdAt: any; // Firestore Timestamp
  scheduledAt?: any; // Firestore Timestamp
  analyzedAt?: any;
};

export type FirestoreComment = Omit<Comment, 'createdAt' | 'scheduledAt' | 'factCheckingStartedAt'> & {
  createdAt: any; // Firestore Timestamp
  scheduledAt?: any; // Firestore Timestamp
  factCheckingStartedAt?: any; // Firestore Timestamp
};

// Comment tree structure for UI rendering
export type CommentTreeNode = Comment & {
  replies: CommentTreeNode[];
};

export type FirestoreUser = Omit<User, 'createdAt'> & {
  createdAt: any; // Firestore Timestamp
};

export type FirestoreTopicMetadata = Omit<TopicMetadata, 'lastEngagementUpdate'> & {
  lastEngagementUpdate: any; // Firestore Timestamp
  lastNewsGeneratedAt?: any; // Firestore Timestamp
};

// Trending News types
export type TrendingNews = {
  id: string;
  title: string;
  description: string; // Full description for detail view
  summary: string; // Short summary for list view (1-2 sentences)
  source: string;
  sources: string[]; // Multiple sources covering the story
  category: string;
  publishedAt: Date;
  imageUrl?: string;
  url?: string; // Original article link
  relatedTopics: string[]; // Auto-extracted topics for post matching
  keywords: string[]; // Keywords for matching
  engagementCount: number; // Posts in your app about this
  lastUpdated: Date; // When this news was last refreshed
  userId?: string; // User the news was generated for (null/global)
  storyClusterPostIds?: string[]; // Post IDs used for this story
  storySignature?: string; // Hash/fingerprint of the story to prevent duplicates
  sourceTopics?: string[]; // Topics the story pulls from
  confidence?: number; // AI confidence score
};

export type FirestoreTrendingNews = Omit<TrendingNews, 'publishedAt' | 'lastUpdated'> & {
  publishedAt: any; // Firestore Timestamp
  lastUpdated: any; // Firestore Timestamp
};

export type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  url: string;
  urlToImage?: string;
  sourceId?: string | null;
  sourceName: string;
  publishedAt: Date;
  category?: string;
  query?: string;
  fetchedAt: Date;
};

// Notification types
export type NotificationType = 
  | 'comment'      // Someone commented on your post
  | 'reply'        // Someone replied to your comment
  | 'rechirp'      // Someone rechirped your post
  | 'follow'       // Someone followed you
  | 'mention';     // Someone mentioned you (future)

export type Notification = {
  id: string;                    // Auto-generated by Firestore
  userId: string;                // Recipient user ID
  type: NotificationType;        // Type of notification
  read: boolean;                 // Has user seen this?
  dismissed: boolean;            // User explicitly dismissed
  createdAt: Date;               // When notification was created
  
  // Event data (links to source)
  actorId: string;               // User who triggered notification
  chirpId?: string;              // Related chirp (if applicable)
  commentId?: string;            // Related comment (if applicable)
  
  // Aggregation data
  aggregatedCount?: number;      // If aggregated: "5 people commented"
  aggregatedActorIds?: string[]; // List of actor IDs in aggregation
  
  // Metadata
  metadata?: {                   // Type-specific data
    // For replies:
    parentCommentId?: string;
    originalPostAuthorId?: string;
    
    // For rechirps:
    originalChirpId?: string;
  };
};

export type FirestoreNotification = Omit<Notification, 'createdAt'> & {
  createdAt: any; // Firestore Timestamp
};

export type NotificationPreferences = {
  userId: string;
  
  // Per-type preferences
  commentNotifications: boolean;
  replyNotifications: boolean;
  rechirpNotifications: boolean;
  followNotifications: boolean;
  mentionNotifications: boolean;
  
  // Advanced settings
  quietHoursStart?: string;      // "22:00" - 10 PM
  quietHoursEnd?: string;        // "08:00" - 8 AM
  
  // Muted users/posts
  mutedUserIds: string[];
  mutedChirpIds: string[];
  mutedThreadIds: string[];      // Mute entire comment threads
};

export type FirestoreNotificationPreferences = NotificationPreferences;

// Post Review Context types - for users to add context to posts marked "needs_review"
export type PostReviewAction = 'validate' | 'invalidate';

export type PostReviewContext = {
  id: string;                      // Auto-generated by Firestore
  chirpId: string;                 // Post ID this context is for
  submittedBy: string;             // User ID who submitted the context
  action: PostReviewAction;        // 'validate' or 'invalidate'
  sources: string[];               // Array of source URLs supporting the action
  context?: string;                // Optional explanation/context
  createdAt: Date;                 // When context was submitted
};

export type FirestorePostReviewContext = Omit<PostReviewContext, 'createdAt'> & {
  createdAt: any; // Firestore Timestamp
};
