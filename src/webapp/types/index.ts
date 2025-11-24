// Core Data Types

export type Topic =
  | 'dev'
  | 'startups'
  | 'music'
  | 'sports'
  | 'productivity'
  | 'design'
  | 'politics'
  | 'crypto';

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

export type DiscussionQuality = {
  informativeness: number;
  civility: number;
  reasoningDepth: number;
  crossPerspective: number;
  summary: string;
};

export type User = {
  id: string;
  name: string;
  handle: string;
  email?: string;
  interests?: string[];
  createdAt: Date;
  following: string[]; // User IDs
  bookmarks?: string[]; // Chirp IDs that user has bookmarked
  // Onboarding fields
  displayName?: string;
  userId?: string; // Unique user ID (handle alternative)
  topics?: string[]; // Hashtags/topics user likes
  bio?: string;
  url?: string;
  location?: string; // City
  onboardingCompleted?: boolean;
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
};

export type TunedAudience = {
  allowFollowers: boolean;
  allowNonFollowers: boolean;
};

export type ReachMode = 'forAll' | 'tuned';

export type Chirp = {
  id: string;
  authorId: string;
  text: string;
  topic: Topic;
  semanticTopics?: string[];
  entities?: string[];
  intent?: string;
  analyzedAt?: Date;
  reachMode: ReachMode;
  tunedAudience?: TunedAudience;
  createdAt: Date;
  rechirpOfId?: string; // If this is a rechirp, reference original
  commentCount: number;
  countryCode?: string; // ISO 3166-1 alpha-2 country code where post was made
  imageUrl?: string; // Optional image URL
  scheduledAt?: Date; // Optional scheduled post time
  formattedText?: string; // Optional formatted text (markdown-style)
  claims?: Claim[];
  factChecks?: FactCheck[];
  factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
  valueScore?: ValueScore;
  valueExplanation?: string;
  discussionQuality?: DiscussionQuality;
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
};

export type FollowingWeight = 'none' | 'light' | 'medium' | 'heavy';

export type ForYouConfig = {
  followingWeight: FollowingWeight;
  boostActiveConversations: boolean;
  likedTopics: Topic[];
  mutedTopics: Topic[];
};

export type FeedType = 'latest' | 'forYou';

export const ALL_TOPICS: Topic[] = [
  'dev',
  'startups',
  'music',
  'sports',
  'productivity',
  'design',
  'politics',
  'crypto',
];

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

export type FirestoreComment = Omit<Comment, 'createdAt'> & {
  createdAt: any; // Firestore Timestamp
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

