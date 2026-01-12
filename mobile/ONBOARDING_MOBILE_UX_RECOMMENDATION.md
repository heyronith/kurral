# Mobile Onboarding UX Recommendation

## Executive Summary

**Recommendation**: Create a **simpler, mobile-native onboarding** that collects the **same data as webapp** but uses **focused, single-purpose screens** optimized for mobile UX patterns.

**Key Principle**: Mobile users prefer **focused flows** over **information-dense layouts**. We should split the onboarding into clear, simple steps while maintaining all data collection capabilities.

---

## Data Collection Requirements (Same as Webapp)

### Must Collect:
1. ✅ **Display Name** (required)
2. ✅ **Handle/User ID** (required, with validation)
3. ✅ **Bio** (optional)
4. ✅ **URL** (optional)
5. ✅ **Location** (optional)
6. ✅ **Interests** (required, at least 1)
7. ✅ **Follow at least 3 people** (auto-follow popular accounts if needed)

### Supporting Features (to maintain parity):
- ✅ **AI-powered interest extraction** from natural language
- ✅ **Trending topics** for quick selection
- ✅ **Follow suggestions** based on interests
- ✅ **Handle availability checking** (real-time)
- ✅ **Profile summary generation** (background, non-blocking)
- ✅ **Auto-follow popular accounts** (ensures minimum follows)

---

## Mobile UX Approach: Simpler, Focused Flow

### Design Philosophy:
1. **One Focus Per Screen** - Each step has a clear, single purpose
2. **Native Mobile Patterns** - Full-screen screens, native navigation
3. **Progressive Disclosure** - Show only what's needed, when needed
4. **Less Visual Complexity** - Clean, minimal design (no sidebars, gradients)
5. **Touch-Optimized** - Large tap targets, easy interactions

---

## Proposed Mobile Onboarding Flow (3 Steps)

### **Step 1: Profile Basics** 📝
**Purpose**: Collect basic profile information

**Fields**:
- Display Name* (text input)
- Handle/User ID* (text input with @ prefix, real-time validation)
- Bio (multiline text input, optional)
- URL (text input, optional)
- Location (text input, optional)

**UI Approach**:
- Scrollable form (similar to current but improved)
- Inline validation feedback
- Handle availability indicator (green checkmark / red X)
- Clear required vs optional indicators

**Validation**:
- Display name: Required
- Handle: Required, 3+ chars, alphanumeric + underscore, real-time availability check
- Other fields: Optional

**Navigation**:
- Next button (disabled until valid)
- Skip for now? (proceed with minimum data, but we'll enforce later)

---

### **Step 2: Interests** 🎯
**Purpose**: Collect user interests for feed personalization

**Features**:
- **Input Method 1**: Type keyword and tap "Add" button
- **Input Method 2**: Type full sentence and tap "Extract" (AI extraction)
- **Visual Interest Chips**: Show added interests as removable chips
- **Trending Topics Section**: Browse and tap trending topics to add
- **Minimum Requirement**: At least 1 interest required

**UI Approach**:
- Reuse interest management logic from `EditProfileModal.tsx`
- Chip-based UI (already implemented)
- Loading states for AI extraction
- Error handling with clear messages

**Data**:
- Store as array of lowercase strings (same format as webapp)

**Navigation**:
- Back button
- Continue button (disabled until at least 1 interest)
- "Skip for now" option (but we'll enforce minimum later or auto-add from popular topics)

---

### **Step 3: Follow People** (Optional but Recommended) 👥
**Purpose**: Help users discover interesting accounts

**Features**:
- **AI Suggestions**: Show users with similar interests (from `getUsersWithSimilarInterests`)
- **User Cards**: Display name, handle, bio, matching interests
- **Follow Button**: One-tap follow/unfollow
- **Skip Option**: Can skip if user doesn't want to follow anyone
- **Auto-Follow**: Ensure minimum 3 follows (backfill with popular accounts if needed)

**UI Approach**:
- Simple list of user cards
- Follow/Following toggle button
- Skip button (prominent)
- Continue button (always enabled - following is optional for this step)

**Auto-Follow Logic**:
- After onboarding completes, ensure user follows at least 3 accounts
- If user skipped this step or followed < 3, auto-follow popular accounts

**Navigation**:
- Back button
- Skip button
- Continue button (proceeds to app)

---

## Visual Design Differences from Webapp

### Webapp Style:
- Sidebar with overview cards
- Gradient backgrounds
- Multi-column layout (on larger screens)
- Information-dense design
- Step overview cards

### Mobile Style (Recommended):
- Full-screen focused screens
- Clean white/dark background
- Single-column layout
- Minimal design
- Simple progress indicator (dots or progress bar at top)
- Native navigation (back button, header)

---

## Implementation Strategy

### Phase 1: Core Structure (Priority 1)
1. **Create Multi-Step Navigation**
   - Use React Navigation with stack navigator
   - Create 3 separate screen components
   - Add step state management

2. **Step 1: Profile Basics Screen**
   - Enhance current form
   - Add handle validation
   - Add real-time availability checking
   - Add URL and Location fields

### Phase 2: Interest Management (Priority 1)
3. **Step 2: Interests Screen**
   - Extract interest management logic from `EditProfileModal`
   - Create reusable interest input component
   - Integrate AI extraction (`extractInterestsFromStatement`)
   - Add trending topics section (use `useTopicStore`)
   - Implement chip-based UI

### Phase 3: Follow Suggestions (Priority 2)
4. **Step 3: Follow Suggestions Screen**
   - Use `getUsersWithSimilarInterests` method
   - Create user suggestion cards
   - Implement follow/unfollow actions
   - Add skip functionality

### Phase 4: Backend Integration (Priority 1)
5. **Add Missing User Service Methods**
   - `getPopularAccounts(limitCount)` - Get popular accounts for auto-follow
   - `autoFollowAccounts(userId, accountIds)` - Batch follow accounts

6. **Complete Onboarding Logic**
   - Save all collected data
   - Ensure minimum follows (auto-follow if needed)
   - Trigger profile summary generation (background)
   - Navigate to main app

---

## Code Reusability

### ✅ Can Reuse from EditProfileModal:
- Interest management logic (`looksLikeStatement`, `handleUnifiedInterestSubmit`)
- Interest chip UI components
- AI extraction integration
- Handle validation logic (with modifications)

### ✅ Can Reuse Services:
- `profileInterestAgent.ts` - AI extraction
- `profileSummaryAgent.ts` - Profile summary generation
- `useTopicStore` - Trending topics
- `userService.getUsersWithSimilarInterests()` - Follow suggestions

### ❌ Need to Create:
- Multi-step navigation structure
- Step-specific screen components
- Progress indicator component
- User suggestion card component
- Auto-follow logic (`ensureMinimumFollows`)

---

## Example Screen Flow

```
┌─────────────────────────┐
│   Step 1: Profile       │
│   [Progress: ●○○]       │
│                         │
│   Display Name *        │
│   [_____________]       │
│                         │
│   Handle * @[_____]     │
│   ✓ Available           │
│                         │
│   Bio                   │
│   [_____________]       │
│   [_____________]       │
│                         │
│   URL                   │
│   Location              │
│                         │
│   [Back]    [Continue]  │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│   Step 2: Interests     │
│   [Progress: ●●○]       │
│                         │
│   Add your interests    │
│   [_____________][Add]  │
│                         │
│   Your interests (2):   │
│   [ai research] [×]     │
│   [react] [×]           │
│                         │
│   Trending Topics:      │
│   [tech] [startups]     │
│   [design] [ai]         │
│                         │
│   [Back]    [Continue]  │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│   Step 3: Follow        │
│   [Progress: ●●●]       │
│                         │
│   Discover people       │
│   with similar          │
│   interests             │
│                         │
│   ┌───────────────────┐ │
│   │ John Doe          │ │
│   │ @johndoe          │ │
│   │ React, TypeScript │ │
│   │      [Follow]     │ │
│   └───────────────────┘ │
│                         │
│   ┌───────────────────┐ │
│   │ Jane Smith        │ │
│   │ @janesmith        │ │
│   │ AI, Research      │ │
│   │    [Following]    │ │
│   └───────────────────┘ │
│                         │
│   [Skip]    [Continue]  │
└─────────────────────────┘
```

---

## Comparison: Mobile vs Webapp

| Feature | Webapp | Mobile (Recommended) |
|---------|--------|---------------------|
| **Number of Steps** | 4 (includes Review) | 3 (no review step) |
| **Layout** | Sidebar + Main Content | Full-screen focused |
| **Visual Style** | Rich gradients, cards | Clean, minimal |
| **Progress Indicator** | Progress bar + step cards | Dots or simple bar |
| **Navigation** | Back/Next buttons | Native back + Continue |
| **Review Step** | Yes (Step 4) | No (proceed directly) |
| **Data Collected** | All fields | Same (all fields) |
| **AI Features** | Full integration | Same (full integration) |
| **Follow Suggestions** | Yes (Step 3) | Yes (Step 3) |
| **Auto-Follow** | Yes | Yes |

---

## Benefits of Simpler Mobile Approach

1. **Better Mobile UX**: Focused screens reduce cognitive load
2. **Faster Completion**: Users can complete onboarding quickly
3. **Native Feel**: Uses standard mobile patterns users expect
4. **Maintainable**: Simpler code structure, easier to maintain
5. **Same Functionality**: Collects all required data, just in a mobile-optimized way
6. **Reusable Components**: Can leverage existing EditProfileModal logic

---

## Decision Recommendation

**✅ Implement simpler, mobile-native onboarding** with:
- 3 focused steps (Profile → Interests → Follow)
- Full-screen native design
- Same data collection as webapp
- Reuse existing interest management components
- Add missing backend methods for auto-follow

**Estimated Implementation Time**: 1-2 days for full implementation

This approach provides the best balance of:
- ✅ Mobile UX best practices
- ✅ Complete data collection
- ✅ Code reusability
- ✅ Faster development
- ✅ Better user experience on mobile

