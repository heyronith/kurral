# Review Request Flow - Data Fetching & Delivery Analysis

## Executive Summary

**Answer: NO Firebase Functions are needed for fetching and delivering review requests in the notification view.**

The current implementation uses **direct Firestore queries from the client** (mobile app). All data fetching and delivery happens client-side.

---

## Current Implementation Flow

### 1. **Review Request Fetching** (Client-Side Only)

**File**: `mobile/src/services/reviewRequestService.ts`

```typescript
async getPendingReviewRequests(userId: string): Promise<ReviewRequest[]> {
  // 1. Direct Firestore query - NO Functions
  const q = query(
    collection(db, 'chirps'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  const allChirps = snapshot.docs.map(toChirp);
  
  // 2. Client-side filtering
  const chirpsNeedingReview = allChirps.filter(
    (chirp) => 
      chirp.factCheckStatus === 'needs_review' &&
      chirp.authorId !== userId
  );
  
  // 3. Client-side priority calculation
  const reviewRequests = chirpsNeedingReview.map((chirp) => ({
    chirp,
    priority: calculatePriority(chirp, user),
  }));
  
  // 4. Client-side sorting and limiting
  return reviewRequests
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 20);
}
```

**Data Flow**:
```
Mobile App → Firestore SDK → Direct Query → Client-Side Processing → Display
```

**No Functions Involved**: ✅ Pure client-side Firestore queries

---

### 2. **Notification Fetching** (Client-Side Only)

**File**: `mobile/src/services/notificationService.ts`

```typescript
async getNotifications(userId: string, options = {}): Promise<Notification[]> {
  // Direct Firestore query - NO Functions
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('dismissed', '==', false),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(notificationFromFirestore);
}
```

**Data Flow**:
```
Mobile App → Firestore SDK → Direct Query → Display
```

**No Functions Involved**: ✅ Pure client-side Firestore queries

---

### 3. **NotificationsScreen Integration**

**File**: `mobile/src/screens/Notifications/NotificationsScreen.tsx`

```typescript
const loadNotifications = async () => {
  // Parallel fetching - both direct Firestore queries
  const [fetchedNotifications, fetchedReviewRequests] = await Promise.all([
    notificationService.getNotifications(currentUser.id, { limitCount: 50 }),
    reviewRequestService.getPendingReviewRequests(currentUser.id),
  ]);
  
  // Client-side combination and sorting
  const items = [
    ...fetchedNotifications.map(n => ({ ...n, isReviewRequest: false })),
    ...fetchedReviewRequests.map((rr, index) => ({
      id: `review-request-${rr.chirp.id}-${index}`,
      isReviewRequest: true,
      chirpId: rr.chirp.id,
      priority: rr.priority,
      createdAt: rr.chirp.createdAt,
      chirp: rr.chirp,
    })),
  ];
  
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  setCombinedItems(items);
};
```

**Data Flow**:
```
Mobile App
  ├─→ Firestore (notifications collection) → Direct Query
  └─→ Firestore (chirps collection) → Direct Query
       ↓
  Client-Side Processing (combine, sort, filter)
       ↓
  Display in UI
```

**No Functions Involved**: ✅ All client-side

---

## Where Firebase Functions ARE Used

### 1. **Post Processing** (Backend - Required)

**File**: `functions/src/index.ts` - `onChirpCreate` trigger

```typescript
export const onChirpCreate = functionsV1.firestore
  .document('chirps/{chirpId}')
  .onCreate(async (snapshot, context) => {
    // Processes post through fact-checking pipeline
    // Sets factCheckStatus = 'needs_review' when needed
  });
```

**Purpose**: 
- Processes posts through fact-checking pipeline
- Sets `factCheckStatus = 'needs_review'` when posts need review
- This happens **automatically** when posts are created

**When**: Runs automatically via Firestore trigger when a chirp is created

---

### 2. **Email Notifications** (Backend - Optional)

**File**: `functions/src/index.ts` - `sendReviewRequestsCron`

```typescript
export const sendReviewRequestsCron = functions.scheduler.onSchedule(
  { schedule: 'every 30 minutes' },
  async () => {
    // Finds posts with needs_review status
    // Sends EMAIL notifications to reviewers
  }
);
```

**Purpose**:
- Sends **email notifications** to reviewers (separate from in-app notifications)
- Runs every 30 minutes
- Finds reviewers based on kurralScore >= 70 and topic matching

**Note**: This is for **email delivery**, not in-app notification delivery. The mobile app doesn't use this.

---

### 3. **Notification Creation** (Backend - For Regular Notifications)

**File**: `functions/src/index.ts` - `createNotification`

```typescript
export const createNotification = functions.https.onCall(async (request) => {
  // Creates notifications for comments, replies, rechirps, etc.
  // Handles aggregation, preferences, rate limiting
});
```

**Purpose**:
- Creates notifications for **regular activities** (comments, replies, rechirps)
- Handles aggregation, user preferences, rate limiting
- **NOT used for review requests** (review requests are just posts with needs_review status)

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    POST CREATION                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Mobile App: ComposerModal                                  │
│  - User creates post                                       │
│  - Calls chirpService.createChirp()                        │
│  - Direct Firestore write                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Firestore: 'chirps' Collection                            │
│  - Post document created                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Firebase Function: onChirpCreate (TRIGGER)                │
│  - Automatically processes post                             │
│  - Runs fact-checking pipeline                              │
│  - Sets factCheckStatus = 'needs_review' if needed        │
│  - Updates post document in Firestore                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Firestore: 'chirps' Collection                            │
│  - Post now has factCheckStatus = 'needs_review'            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Mobile App: NotificationsScreen                           │
│  - User opens notifications view                            │
│  - Calls reviewRequestService.getPendingReviewRequests()   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Direct Firestore Query (NO Functions)                      │
│  - Queries 'chirps' collection                              │
│  - Filters for factCheckStatus === 'needs_review'          │
│  - Excludes user's own posts                                │
│  - Calculates priority client-side                          │
│  - Returns top 20                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Mobile App: NotificationsScreen                           │
│  - Displays review requests in notification list            │
│  - User taps → navigates to PostDetail                      │
│  - User can submit review                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

### ✅ **NO Functions Needed For**:
1. **Fetching review requests** - Direct Firestore query
2. **Fetching notifications** - Direct Firestore query  
3. **Priority calculation** - Client-side logic
4. **Filtering and sorting** - Client-side processing
5. **Display in UI** - Pure client-side

### ✅ **Functions ARE Used For** (But Not for Delivery):
1. **Post processing** - `onChirpCreate` trigger marks posts as `needs_review`
2. **Email notifications** - `sendReviewRequestsCron` sends emails (separate from in-app)
3. **Regular notifications** - `createNotification` for comments/replies/etc.

---

## Architecture Decision

**Why Client-Side Queries?**

1. **Real-time Updates**: Firestore queries can use `onSnapshot()` for real-time updates
2. **No Latency**: Direct queries are faster than Function calls
3. **Cost Efficiency**: No Function invocation costs
4. **Scalability**: Firestore handles query scaling automatically
5. **Simplicity**: No need for backend processing for simple queries

**Trade-offs**:
- **Client-side filtering**: Fetches 100 chirps, filters to ~20 (inefficient but acceptable for MVP)
- **No server-side priority**: Priority calculated client-side (works fine)
- **No caching**: Each fetch queries Firestore (acceptable for notifications)

---

## Performance Considerations

### Current Approach (Client-Side):
- **Query**: Fetches 100 recent chirps
- **Filter**: Client-side filters for `needs_review`
- **Process**: Client-side priority calculation
- **Result**: Returns top 20

**Efficiency**: ⚠️ Moderate
- Fetches more data than needed (100 chirps to get ~20 review requests)
- But acceptable for MVP and small-medium scale

### Potential Optimization (Future):
If scale becomes an issue, could add:
1. **Firestore Composite Index**: Query `factCheckStatus` + `createdAt` directly
2. **Backend Function**: Pre-filter and prioritize server-side
3. **Caching**: Cache review requests for X minutes

**Current Status**: ✅ Works well for MVP, no optimization needed yet

---

## Summary

**Question**: Does this entire flow need Firebase Functions?

**Answer**: 
- **For fetching/delivery**: ❌ **NO** - All client-side Firestore queries
- **For post processing**: ✅ **YES** - `onChirpCreate` trigger processes posts
- **For email notifications**: ✅ **YES** - But separate from in-app delivery

**Data Delivery Method**:
```
Mobile App → Firestore SDK → Direct Queries → Client Processing → UI Display
```

**No server-side processing needed for delivery** - it's all real-time Firestore queries! 🚀

