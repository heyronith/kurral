// Shared domain types used by Cloud Functions value pipeline

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

export type LegacyTopic = (typeof LEGACY_TOPICS)[number];
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
  quality: number;
};

export type Claim = {
  id: string;
  text: string;
  type: ClaimType;
  domain: ClaimDomain;
  riskLevel: ClaimRiskLevel;
  confidence: number;
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
  score: number;
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

export type User = {
  id: string;
  name: string;
  handle: string;
  email?: string;
  interests?: string[];
  createdAt: Date;
  following: string[];
  bookmarks?: string[];
  displayName?: string;
  userId?: string;
  topics?: string[];
  bio?: string;
  url?: string;
  location?: string;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Date;
  firstTimeUser?: boolean;
  autoFollowedAccounts?: string[];
  profilePictureUrl?: string;
  coverPhotoUrl?: string;
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
  profileSummary?: string;
  profileSummaryVersion?: number;
  profileSummaryUpdatedAt?: Date;
  profileEmbedding?: number[];
  profileEmbeddingVersion?: number;
  semanticTopics?: string[];
};

export type TunedAudience = {
  allowFollowers: boolean;
  allowNonFollowers: boolean;
  targetAudienceDescription?: string;
  targetAudienceEmbedding?: number[];
};

export type ReachMode = 'forAll' | 'tuned';

export type Chirp = {
  id: string;
  authorId: string;
  text: string;
  topic: Topic;
  semanticTopics?: string[];
  semanticTopicBuckets?: Record<string, string>;
  entities?: string[];
  intent?: string;
  analyzedAt?: Date;
  reachMode: ReachMode;
  tunedAudience?: TunedAudience;
  contentEmbedding?: number[];
  createdAt: Date;
  rechirpOfId?: string;
  quotedChirpId?: string;
  quotedChirp?: Chirp;
  commentCount: number;
  countryCode?: string;
  imageUrl?: string;
  scheduledAt?: Date;
  formattedText?: string;
  mentions?: string[];
  factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  factCheckingStartedAt?: Date;
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
  parentCommentId?: string;
  replyToUserId?: string;
  depth?: number;
  replyCount?: number;
  discussionRole?: 'question' | 'answer' | 'evidence' | 'opinion' | 'moderation' | 'other';
  valueContribution?: ValueVector & { total: number };
  imageUrl?: string;
  scheduledAt?: Date;
  formattedText?: string;
  factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  factCheckingStartedAt?: Date;
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

export type TopicMetadata = {
  name: string;
  postsLast48h: number;
  postsLast1h: number;
  postsLast4h: number;
  totalUsers: number;
  lastEngagementUpdate: Date;
  averageVelocity1h: number;
  isTrending: boolean;
  lastNewsGeneratedAt?: Date;
};

export type FirestoreChirp = Omit<Chirp, 'createdAt' | 'scheduledAt' | 'analyzedAt'> & {
  createdAt: any;
  scheduledAt?: any;
  analyzedAt?: any;
};

export type FirestoreComment = Omit<Comment, 'createdAt' | 'scheduledAt' | 'factCheckingStartedAt'> & {
  createdAt: any;
  scheduledAt?: any;
  factCheckingStartedAt?: any;
};

export type FirestoreUser = Omit<User, 'createdAt'> & {
  createdAt: any;
};

export type FirestoreTopicMetadata = Omit<TopicMetadata, 'lastEngagementUpdate'> & {
  lastEngagementUpdate: any;
  lastNewsGeneratedAt?: any;
};

export type NotificationType = 'comment' | 'reply' | 'rechirp' | 'follow' | 'mention';

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  read: boolean;
  dismissed: boolean;
  createdAt: Date;
  actorId: string;
  chirpId?: string;
  commentId?: string;
  aggregatedCount?: number;
  aggregatedActorIds?: string[];
  metadata?: {
    parentCommentId?: string;
    originalChirpId?: string;
  };
};

export type FirestoreNotification = Omit<Notification, 'createdAt'> & {
  createdAt: any;
};

export type NotificationPreferences = {
  userId: string;
  commentNotifications: boolean;
  replyNotifications: boolean;
  rechirpNotifications: boolean;
  followNotifications: boolean;
  mentionNotifications: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  mutedUserIds: string[];
  mutedChirpIds: string[];
  mutedThreadIds: string[];
};

export type FirestoreNotificationPreferences = NotificationPreferences;

export type PostReviewAction = 'validate' | 'invalidate';

export type PostReviewContext = {
  id: string;
  chirpId: string;
  submittedBy: string;
  action: PostReviewAction;
  sources: string[];
  context?: string;
  createdAt: Date;
};

export type FirestorePostReviewContext = Omit<PostReviewContext, 'createdAt'> & {
  createdAt: any;
};


