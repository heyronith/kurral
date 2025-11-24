# Intelligent Notification System - Codebase Analysis & Design Thoughts

## Executive Summary

After thorough analysis of the codebase, **NO notification system currently exists**. The app tracks user interactions (comments, rechirps, follows, bookmarks) but doesn't notify users when these events occur. This document outlines my findings about the current state and design considerations for building an intelligent notification system.

---

## 1. CURRENT STATE ANALYSIS

### 1.1 User Interactions Tracked (Notification Triggers)

Based on codebase analysis, the following interactions occur but generate NO notifications:

#### ✅ **Comments/Replies** (`src/webapp/components/CommentSection.tsx`, `src/webapp/lib/firestore.ts`)
- **Location**: `CommentSection.tsx:40-59`, `firestore.ts:640-707`
- **What happens**:
  - Comment created → Saved to `comments` collection
  - `commentCount` atomically incremented on Chirp
  - `replyToUserId` field exists (line 67 in `types/index.ts`) - tracks who is being replied to
  - `parentCommentId` supports nested replies
- **Missing**: No notification sent to post author or replied-to user

#### ✅ **Rechirps** (`src/webapp/components/ChirpCard.tsx`)
- **Location**: `ChirpCard.tsx:66-81`
- **What happens**:
  - New Chirp created with `rechirpOfId` field linking to original
  - Always created as `'forAll'` reach mode
- **Missing**: No notification sent to original post author

#### ✅ **Follows** (`src/webapp/store/useUserStore.ts`)
- **Location**: `useUserStore.ts:60-89`
- **What happens**:
  - `following` array updated in User document
  - Persisted to Firestore via `userService.updateFollowing()`
- **Missing**: No notification sent to followed user

#### ✅ **Bookmarks** (`src/webapp/store/useUserStore.ts`)
- **Location**: `useUserStore.ts:125-165`
- **What happens**:
  - `bookmarks` array updated in User document
  - Persisted to Firestore
- **Design Question**: Should bookmarks generate notifications? Typically not, but could notify post author of high bookmark count.

### 1.2 Existing Data Structures Supporting Notifications

#### **Comment Type** (`src/webapp/types/index.ts:60-70`)
```typescript
export type Comment = {
  id: string;
  chirpId: string;
  authorId: string;
  text: string;
  createdAt: Date;
  parentCommentId?: string;     // ✅ Supports nested replies
  replyToUserId?: string;        // ✅ Already tracks who is being replied to
  depth?: number;
  replyCount?: number;
};
```
**Key Insight**: `replyToUserId` field exists but is only used for UI display. Could be leveraged for notifications.

#### **Chirp Type** (`src/webapp/types/index.ts:41-58`)
```typescript
export type Chirp = {
  id: string;
  authorId: string;              // ✅ Know who to notify for rechirps
  text: string;
  // ... other fields
  rechirpOfId?: string;          // ✅ Links rechirp to original
  commentCount: number;          // ✅ Tracks engagement
};
```

#### **User Type** (`src/webapp/types/index.ts:13-32`)
```typescript
export type User = {
  id: string;
  name: string;
  handle: string;
  following: string[];           // ✅ Know who follows whom
  bookmarks?: string[];          // ✅ Could notify on bookmarks
  // ... other fields
};
```

### 1.3 Real-time Infrastructure

**Existing Real-time Listeners** (`src/webapp/lib/firestore.ts:776-931`):
- ✅ `subscribeToComments(chirpId, callback)` - Real-time comment updates
- ✅ `subscribeToLatestChirps(followingIds, callback)` - Real-time chirp updates
- ✅ `subscribeToRecentChirps(callback)` - Real-time feed updates
- ✅ `subscribeToUser(userId, callback)` - Real-time user updates

**Key Insight**: Firestore real-time capabilities are already in use. Could leverage similar patterns for notification subscriptions.

### 1.4 Engagement Tracking

**TuningService** (`src/webapp/lib/services/tuningService.ts`):
- Tracks chirp views in localStorage
- Tracks chirp engagement (comments) in localStorage
- Used for feed algorithm tuning

**Key Insight**: Engagement data is tracked but only stored locally. Notification system would need server-side tracking for cross-device sync.

---

## 2. NOTIFICATION TYPES TO IMPLEMENT

Based on codebase analysis, here are the notification types that make sense:

### 2.1 **Comment Notifications**
**Trigger**: When someone comments on user's post
- **Recipient**: Post author (`chirp.authorId`)
- **Data Available**: ✅ Chirp ID, comment author, comment text
- **Priority**: HIGH - Most common interaction

### 2.2 **Reply Notifications**
**Trigger**: When someone replies to user's comment
- **Recipient**: Comment author (`comment.authorId`)
- **Data Available**: ✅ Comment has `replyToUserId` field
- **Priority**: HIGH - Direct engagement
- **Edge Case**: Should notify original post author if reply is to a comment on their post? (probably not, to avoid spam)

### 2.3 **Rechirp Notifications**
**Trigger**: When someone rechirps user's post
- **Recipient**: Original post author (`chirp.authorId` where `rechirpOfId` points to user's chirp)
- **Data Available**: ✅ `rechirpOfId` links to original
- **Priority**: MEDIUM - Less frequent but high engagement signal

### 2.4 **Follow Notifications**
**Trigger**: When someone follows user
- **Recipient**: Followed user
- **Data Available**: ✅ `following` array updates
- **Priority**: MEDIUM - Social signal

### 2.5 **Mention Notifications** (Future Enhancement)
**Trigger**: When user is @mentioned in post/comment
- **Current State**: ❌ No mention parsing exists
- **Data Needed**: Would need to parse `@username` in text and extract user IDs
- **Priority**: MEDIUM-HIGH - Direct engagement signal

---

## 3. DESIGN CONSIDERATIONS

### 3.1 Notification Aggregation

**Batching Similar Notifications**:
- Multiple comments on same post → "5 people commented on your post"
- Multiple replies in same thread → "3 people replied to your comment"
- Multiple rechirps → "10 people rechirped your post"
- Multiple follows → "5 new followers"

**Time Windows**:
- Aggregate within 15-30 minute windows
- Show individual notifications for recent items (< 5 minutes old)
- Group older notifications

### 3.2 Notification Filtering & Intelligence

**User Preferences**:
- Allow users to disable specific notification types
- Mute notifications from specific users
- Mute notifications on specific posts/conversations
- Quiet hours (no notifications during sleep time)

**Relevance Scoring**:
- Boost notifications from users you follow
- Boost notifications on posts you've engaged with
- Deprioritize notifications from users you rarely interact with
- Consider recency + engagement level

**Spam Prevention**:
- Rate limiting: Max notifications per user per hour
- Don't notify on own actions (already handled in UI)
- Don't notify if user is actively viewing the post/thread

### 3.3 Real-time vs Batched Delivery

**Real-time (Push) Notifications**:
- Best for: Replies, mentions (direct engagement)
- Trigger immediately when event occurs
- Use browser push API or in-app notification bell

**Batched (Email/Digest) Notifications**:
- Best for: Follows, rechirps (less urgent)
- Daily/weekly digest of activity
- Respects user's attention

**Hybrid Approach**:
- Real-time for high-priority notifications (< 5 min old)
- Batch older notifications into digest

### 3.4 Notification State Management

**Notification Status**:
- `unread` - User hasn't seen it
- `read` - User viewed it (but may not have clicked)
- `dismissed` - User explicitly dismissed
- `archived` - User archived it

**Read Receipt Logic**:
- Mark as read when user opens notification panel
- Mark as read when user navigates to related post/comment
- Auto-archive after 7 days

---

## 4. DATA MODEL PROPOSAL

### 4.1 Notification Document Structure

```typescript
export type Notification = {
  id: string;                    // Auto-generated by Firestore
  userId: string;                // Recipient user ID
  type: NotificationType;        // 'comment' | 'reply' | 'rechirp' | 'follow' | 'mention'
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

export type NotificationType = 
  | 'comment'      // Someone commented on your post
  | 'reply'        // Someone replied to your comment
  | 'rechirp'      // Someone rechirped your post
  | 'follow'       // Someone followed you
  | 'mention';     // Someone mentioned you (future)
```

### 4.2 Firestore Collection Structure

**Collection**: `notifications`
- Document ID: Auto-generated
- Indexes needed:
  - `userId + read + createdAt` (for unread notifications feed)
  - `userId + type + createdAt` (for filtered notification views)
  - `userId + dismissed + createdAt` (for cleanup queries)

**Subcollection Alternative** (Better for large scale):
- `users/{userId}/notifications/{notificationId}`
- Enables better querying per-user
- Easier to set up security rules

### 4.3 Notification Preferences

```typescript
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
  emailDigest: 'none' | 'daily' | 'weekly';
  
  // Muted users/posts
  mutedUserIds: string[];
  mutedChirpIds: string[];
  mutedThreadIds: string[];      // Mute entire comment threads
  
  lastEmailDigestAt?: Date;
};
```

**Storage**: `users/{userId}/preferences/notifications` (subdocument)

---

## 5. IMPLEMENTATION HOOKS (Where to Add Notification Triggers)

### 5.1 Comment Creation Hook

**Location**: `src/webapp/lib/firestore.ts:640-707` (`commentService.createComment`)

**After Line 701** (after batch commit succeeds):
```typescript
// Create notification for post author (if commenter is not the author)
const chirpDoc = await getDoc(doc(db, 'chirps', comment.chirpId));
const chirp = chirpDoc.data();
if (chirp && chirp.authorId !== comment.authorId) {
  await createNotification({
    userId: chirp.authorId,
    type: 'comment',
    actorId: comment.authorId,
    chirpId: comment.chirpId,
    commentId: newComment.id,
  });
}
```

### 5.2 Reply Creation Hook

**Location**: Same as above, but check if `parentCommentId` exists

**After Line 701**:
```typescript
// If this is a reply, notify parent comment author
if (comment.parentCommentId) {
  const parentCommentDoc = await getDoc(doc(db, 'comments', comment.parentCommentId));
  const parentComment = parentCommentDoc.data();
  if (parentComment && parentComment.authorId !== comment.authorId) {
    await createNotification({
      userId: parentComment.authorId,
      type: 'reply',
      actorId: comment.authorId,
      chirpId: comment.chirpId,
      commentId: newComment.id,
      metadata: {
        parentCommentId: comment.parentCommentId,
      },
    });
  }
}
```

### 5.3 Rechirp Creation Hook

**Location**: `src/webapp/lib/firestore.ts:313-373` (`chirpService.createChirp`)

**After Line 369** (after chirp is created):
```typescript
// If this is a rechirp, notify original post author
if (chirp.rechirpOfId) {
  const originalChirpDoc = await getDoc(doc(db, 'chirps', chirp.rechirpOfId));
  const originalChirp = originalChirpDoc.data();
  if (originalChirp && originalChirp.authorId !== chirp.authorId) {
    await createNotification({
      userId: originalChirp.authorId,
      type: 'rechirp',
      actorId: chirp.authorId,
      chirpId: chirp.rechirpOfId,  // Original chirp ID
      metadata: {
        originalChirpId: chirp.rechirpOfId,
      },
    });
  }
}
```

### 5.4 Follow Hook

**Location**: `src/webapp/lib/firestore.ts:501-507` (`userService.updateFollowing`)

**After Line 503** (need to detect if following array was added to, not just updated):
- **Challenge**: Current implementation replaces entire array, can't detect additions easily
- **Solution**: Compare old vs new array, or use Cloud Function trigger on user document update
- **Alternative**: Add follow in separate function that creates notification atomically

**Proposed New Function**:
```typescript
async addFollow(followerId: string, followeeId: string): Promise<void> {
  // Get current following array
  const userDoc = await getDoc(doc(db, 'users', followerId));
  const currentFollowing = userDoc.data()?.following || [];
  
  if (currentFollowing.includes(followeeId)) {
    return; // Already following
  }
  
  // Batch: Update following array + create notification
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', followerId), {
    following: [...currentFollowing, followeeId],
  });
  await batch.commit();
  
  // Create notification
  await createNotification({
    userId: followeeId,
    type: 'follow',
    actorId: followerId,
  });
}
```

---

## 6. INTELLIGENT NOTIFICATION ALGORITHM

### 6.1 Aggregation Logic

**Goal**: Reduce notification noise by grouping similar events

**Strategy**:
1. When creating notification, check for recent unread notifications of same type
2. If found within 15-minute window AND same `chirpId`/`commentId`:
   - Increment `aggregatedCount` on existing notification
   - Add `actorId` to `aggregatedActorIds` array
   - Update `createdAt` to most recent event time
   - Skip creating new notification
3. If not found, create new notification

**Example Aggregation**:
```
Initial: "Alice commented on your post"
+5 min:  "Bob commented on your post" → Merge: "Alice and Bob commented on your post"
+10 min: "Carol commented on your post" → Merge: "Alice, Bob, and 1 other commented on your post"
```

### 6.2 Relevance Scoring (For Prioritization)

**Factors**:
1. **Relationship Score**:
   - User follows actor: +30
   - Actor follows user: +20
   - Mutual follow: +50
   - No relationship: +10

2. **Recency**:
   - < 5 minutes: +20
   - < 30 minutes: +10
   - < 2 hours: +5
   - Older: 0

3. **Engagement History**:
   - User frequently engages with actor: +15
   - User rarely engages with actor: -10
   - No history: 0

4. **Content Engagement**:
   - User has commented on this post: +25
   - User has bookmarked this post: +15
   - User created this post: +30

5. **Notification Type**:
   - Reply (direct): +40
   - Comment: +25
   - Rechirp: +15
   - Follow: +10

**Total Score** = Sum of all factors

**Use Case**: Sort notifications by score (highest first), or group high-scoring notifications at top.

### 6.3 Smart Grouping Beyond Aggregation

**Thread-based Grouping**:
- Group all notifications from same comment thread
- Show: "Alice, Bob, and 3 others replied in this thread"
- Click expands to show individual notifications

**Topic-based Grouping** (Optional):
- Group notifications by topic/chirp topic
- Show: "5 new comments on #dev posts"

**Time-based Grouping**:
- Group by "Today", "Yesterday", "This Week", "Older"
- Visual separation in UI

---

## 7. NOTIFICATION DELIVERY MECHANISMS

### 7.1 In-App Notifications

**Real-time Listener** (`src/webapp/lib/firestore.ts` pattern):
```typescript
subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => notificationFromFirestore(doc)));
  });
}
```

**UI Component**: Notification Bell
- Show unread count badge
- Dropdown list of recent notifications
- Click notification → Navigate to related post/comment
- Mark as read on click

### 7.2 Browser Push Notifications

**Implementation**:
- Use Firebase Cloud Messaging (FCM) or Web Push API
- Request permission on first notification preference save
- Send push when notification created (if user enabled push)

**When to Send Push**:
- User is offline or not on app
- Notification score > 50 (high relevance)
- User hasn't been active in last 5 minutes
- Respect quiet hours

### 7.3 Email Digest

**Implementation**:
- Cloud Function scheduled to run daily/weekly
- Query all unread notifications for each user
- Generate HTML email with grouped notifications
- Send via SendGrid, AWS SES, or similar
- Mark notifications as "emailed" (don't re-send)

**Email Content**:
- Top 10 most relevant notifications
- Grouped by type
- Links to view full notification center
- Unsubscribe link

---

## 8. TECHNICAL ARCHITECTURE

### 8.1 Notification Service Layer

**New File**: `src/webapp/lib/services/notificationService.ts`

**Functions Needed**:
- `createNotification(data)` - Create notification document
- `getNotifications(userId, filters)` - Fetch notifications
- `markAsRead(notificationId)` - Mark notification as read
- `markAllAsRead(userId)` - Bulk mark as read
- `dismissNotification(notificationId)` - Dismiss notification
- `getUnreadCount(userId)` - Get count of unread notifications
- `aggregateNotifications(newNotification)` - Smart aggregation logic
- `getNotificationPreferences(userId)` - Get user preferences
- `updateNotificationPreferences(userId, preferences)` - Update preferences

### 8.2 Cloud Functions (Recommended for Scale)

**Why Cloud Functions?**:
- Offload notification creation from client
- Better control over aggregation logic
- Can batch writes efficiently
- Triggers on Firestore changes (no client code changes needed)

**Functions to Create**:
1. **`onCommentCreated`**: Trigger on `comments` collection create
   - Create notification for post author
   - Create notification for parent comment author (if reply)

2. **`onChirpCreated`**: Trigger on `chirps` collection create
   - If rechirp, create notification for original author

3. **`onUserFollowUpdated`**: Trigger on `users` document update
   - Detect if `following` array changed
   - Create notification for newly followed users

**Benefits**:
- No client code changes needed (hooks in existing code can stay for immediate feedback)
- Automatic scaling
- Better aggregation control
- Can add rate limiting, spam detection

### 8.3 Notification Store (Zustand)

**New File**: `src/webapp/store/useNotificationStore.ts`

**State**:
- `notifications: Notification[]`
- `unreadCount: number`
- `isLoading: boolean`
- `preferences: NotificationPreferences | null`

**Actions**:
- `loadNotifications()`
- `markAsRead(id)`
- `markAllAsRead()`
- `dismiss(id)`
- `subscribeToNotifications()` - Set up real-time listener

---

## 9. UI COMPONENTS NEEDED

### 9.1 NotificationBell Component

**Location**: `src/webapp/components/NotificationBell.tsx`

**Features**:
- Badge showing unread count
- Dropdown panel showing recent notifications
- Click notification → Navigate to post/comment
- "Mark all as read" button
- Settings link to notification preferences

### 9.2 NotificationPreferences Component

**Location**: `src/webapp/pages/SettingsPage.tsx` or separate modal

**Features**:
- Toggle switches for each notification type
- Quiet hours picker
- Email digest frequency selector
- Muted users/posts list
- Save preferences

### 9.3 NotificationItem Component

**Location**: `src/webapp/components/NotificationItem.tsx`

**Features**:
- Display actor avatar, name
- Show notification type icon
- Show preview text (comment snippet, post title)
- Show timestamp (relative: "5m ago")
- Read/unread indicator
- Dismiss button

---

## 10. SECURITY & PRIVACY CONSIDERATIONS

### 10.1 Firestore Security Rules

**Rules Needed**:
- Users can only read their own notifications
- Users can only update `read` and `dismissed` fields on their notifications
- Only server (Cloud Functions) can create notifications
- Users cannot delete notifications (only dismiss)

**Example Rules**:
```javascript
match /notifications/{notificationId} {
  allow read: if request.auth != null && 
                  resource.data.userId == request.auth.uid;
  allow update: if request.auth != null && 
                   resource.data.userId == request.auth.uid &&
                   // Only allow updating read/dismissed
                   request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['read', 'dismissed']);
  allow create: if false; // Only Cloud Functions can create
  allow delete: if false; // No deletions (use dismissed flag)
}
```

### 10.2 Privacy Controls

- Users can disable all notifications
- Users can mute specific users (no notifications from them)
- Users can mute specific posts/conversations
- Notifications don't reveal private information
- Respect user's reach settings (don't notify on posts with `'tuned'` reach if user isn't in audience)

---

## 11. PERFORMANCE CONSIDERATIONS

### 11.1 Indexes Required

**Add to `firestore.indexes.json`**:
```json
{
  "collectionGroup": "notifications",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "read", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "notifications",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### 11.2 Pagination

- Load notifications in batches of 20-50
- Infinite scroll or "Load More" button
- Don't load all notifications at once

### 11.3 Cleanup

**Archived Notifications**:
- Auto-archive notifications older than 30 days
- Move to `archivedNotifications` collection or subcollection
- Or soft-delete by setting `archived: true` flag

**Old Read Notifications**:
- Delete notifications older than 90 days that are read
- Keep unread notifications indefinitely (until user sees them)

**Cloud Function** (Scheduled):
```typescript
// Run daily at 2 AM
export const cleanupOldNotifications = functions.pubsub
  .schedule('0 2 * * *')
  .onRun(async (context) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    // Delete read notifications older than 90 days
    const batch = admin.firestore().batch();
    // ... batch delete logic
  });
```

---

## 12. TESTING STRATEGY

### 12.1 Unit Tests

- Notification aggregation logic
- Relevance scoring algorithm
- Notification preferences validation

### 12.2 Integration Tests

- Create comment → Verify notification created
- Create reply → Verify notification to parent commenter
- Create rechirp → Verify notification to original author
- Follow user → Verify notification created
- Mark as read → Verify state updated
- Aggregation → Verify notifications grouped correctly

### 12.3 Edge Cases to Test

- User comments on own post (should not notify)
- User replies to own comment (should not notify)
- Multiple comments in rapid succession (should aggregate)
- User follows/unfollows repeatedly (should not spam)
- Notification preferences disabled (should not create notification)
- Quiet hours active (should not send push, but create notification)
- User muted (should not create notification)

---

## 13. IMPLEMENTATION PRIORITY

### Phase 1: Core Infrastructure (Week 1)
1. ✅ Notification data model & types
2. ✅ Firestore collection setup & indexes
3. ✅ Notification service layer (`notificationService.ts`)
4. ✅ Basic CRUD operations
5. ✅ Security rules

### Phase 2: Notification Creation Hooks (Week 1-2)
1. ✅ Comment notifications
2. ✅ Reply notifications
3. ✅ Rechirp notifications
4. ✅ Follow notifications

### Phase 3: UI Components (Week 2)
1. ✅ NotificationBell component
2. ✅ NotificationItem component
3. ✅ Notification panel/dropdown
4. ✅ Real-time subscription

### Phase 4: Intelligence & Aggregation (Week 2-3)
1. ✅ Aggregation algorithm
2. ✅ Relevance scoring
3. ✅ Smart grouping
4. ✅ Notification preferences UI

### Phase 5: Advanced Features (Week 3-4)
1. ✅ Browser push notifications
2. ✅ Email digest (Cloud Function)
3. ✅ Quiet hours
4. ✅ Mute functionality
5. ✅ Cleanup jobs

---

## 14. OPEN QUESTIONS & DECISIONS NEEDED

1. **Should bookmarks generate notifications?**
   - Probably not by default, but could be opt-in
   - Could notify post author if bookmark count reaches threshold (e.g., 10 bookmarks)

2. **Should mentions be parsed from text?**
   - Requires parsing `@username` in posts/comments
   - Need user lookup by handle
   - Could be Phase 2 feature

3. **Should notifications respect reach settings?**
   - If post has `'tuned'` reach, should we notify users not in audience?
   - Probably not - would violate privacy expectations

4. **How to handle notification spam?**
   - Rate limiting per actor (max X notifications per hour to same user)
   - User can report spam
   - Auto-mute users who are repeatedly muted by others

5. **Mobile app support?**
   - Current codebase appears web-only
   - If mobile app planned, need FCM setup for native push

6. **Should notifications be deletable?**
   - Current proposal: Only dismissible, not deletable
   - Alternative: Allow deletion with 7-day undo period

7. **Notification expiry?**
   - Proposed: Read notifications deleted after 90 days
   - Alternative: Keep all notifications, archive old ones

---

## 15. KEY FINDINGS SUMMARY

### What Exists:
- ✅ User interactions (comments, rechirps, follows, bookmarks) are tracked
- ✅ Data models support notifications (`replyToUserId`, `rechirpOfId`, etc.)
- ✅ Real-time infrastructure (Firestore listeners) is in use
- ✅ Engagement tracking exists (TuningService)

### What's Missing:
- ❌ No notification collection in Firestore
- ❌ No notification service layer
- ❌ No notification creation hooks
- ❌ No notification UI components
- ❌ No notification preferences system
- ❌ No aggregation/intelligence layer

### Next Steps:
1. Design notification data model (see Section 4)
2. Create notification service layer
3. Add notification creation hooks to existing code
4. Build notification UI components
5. Implement aggregation algorithm
6. Add user preferences
7. Set up Cloud Functions for scale (optional but recommended)

---

## 16. REFERENCES TO CODEBASE

- **Types**: `src/webapp/types/index.ts`
- **Firestore Service**: `src/webapp/lib/firestore.ts`
- **Comment Creation**: `src/webapp/lib/firestore.ts:640-707`
- **Chirp Creation**: `src/webapp/lib/firestore.ts:313-373`
- **Follow Logic**: `src/webapp/store/useUserStore.ts:60-89`
- **Real-time Listeners**: `src/webapp/lib/firestore.ts:776-931`
- **Engagement Tracking**: `src/webapp/lib/services/tuningService.ts`
- **Firestore Indexes**: `firestore.indexes.json`

---

**Document Created**: Based on comprehensive codebase analysis
**Last Updated**: Analysis complete
**Status**: Ready for implementation planning

