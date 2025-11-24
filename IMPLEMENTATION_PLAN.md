# Chirp Webapp Implementation Plan

## Overview
This plan breaks down the Chirp webapp implementation into 4 logical steps, building from foundation to full feature set.

---

## Step 1: Foundation & Data Layer
**Goal:** Establish core data structures, state management, and basic UI shell

### Tasks:
1. **Data Models & Types**
   - Define TypeScript types for: `User`, `Chirp`, `Comment`, `Topic`
   - Define `ForYouConfig` type (followingWeight, boostActiveConversations, likedTopics, mutedTopics)
   - Define `TunedAudience` type for reach settings
   - Create mock data generators for development

2. **State Management**
   - Set up Zustand store (or Context) for:
     - Current user state
     - Feed state (Latest, For You)
     - For You configuration
     - Following relationships
   - Create state selectors and actions

3. **App Shell Structure**
   - Build main app layout in `AppSection.tsx`:
     - Composer area (top)
     - Feed tabs container (Latest / For You)
     - For You controls panel (conditional, shown when For You tab active)
   - Implement tab switching logic
   - Dark theme styling with Tailwind

4. **Basic UI Components**
   - Create reusable components:
     - `ChirpCard` - displays a single chirp
     - `Composer` - text input with character counter (placeholder for now)
     - `FeedTabs` - Latest/For You tab switcher
     - `ForYouControls` - panel shell (empty for now)

5. **Mock Data Integration**
   - Load mock chirps into state
   - Display in Latest feed (chronological)
   - Basic rendering without interactions

**Deliverable:** App shell visible with mock data, tab switching works, state management in place

---

## Step 2: Core Features - Composer & Latest Feed
**Goal:** Enable posting and viewing chronological feed

### Tasks:
1. **Composer Implementation**
   - Text input with character limit (280 chars)
   - Character counter display
   - Topic selector (dropdown/chip selector)
   - Reach mode toggle (For All / Tuned)
   - Post button with validation
   - Basic form state management

2. **Latest Feed**
   - Fetch chirps from followed accounts only
   - Sort strictly by `createdAt DESC`
   - Display all chirp metadata:
     - Author name/handle
     - Relative time
     - Text content
     - Topic chip
     - Action row (Reply, Rechirp, Tune - buttons exist but not functional yet)
   - "Because: Latest – pure chronological" label

3. **Basic Interactions**
   - Create new chirp (adds to feed)
   - Follow/unfollow users (update following list)
   - Update Latest feed when new chirp posted

4. **Reach Settings (Basic)**
   - For All mode: simple toggle
   - Tuned mode: show toggles UI (allowFollowers, allowNonFollowers, requireTopicMatch)
   - Store reach settings with chirp
   - Display reach label on chirps ("Reach: For All" or "Reach: Tuned...")

**Deliverable:** Users can post chirps, view Latest feed chronologically, basic reach settings work

---

## Step 3: For You Feed & Algorithm
**Goal:** Implement algorithmic feed with user controls and transparency

### Tasks:
1. **Eligibility Filter**
   - Implement `isChirpEligibleForViewer()` function
   - Check reach settings (For All vs Tuned)
   - Check viewer's muted topics
   - Check following relationship

2. **Scoring Algorithm**
   - Implement `scoreChirpForViewer()` function
   - Apply followingWeight logic (4 levels)
   - Apply topic preferences (liked/muted)
   - Apply active conversations boost (if enabled)
   - Apply recency decay
   - Sort by score DESC, then createdAt DESC

3. **For You Feed**
   - Generate candidate pool (recent chirps)
   - Filter by eligibility
   - Score and sort
   - Display with "because" explanations:
     - Generate explanation based on scoring factors
     - Show: "Because: you follow @alice + active conversation"
     - Show: "Because: topic #dev you like"
     - Show: "Because: matches your Tuned reach for #dev"

4. **For You Controls Panel**
   - Following vs Everyone mix (4-option segmented control)
   - Boost active conversations toggle
   - Topic preferences:
     - Liked topics row (click to add/remove)
     - Muted topics row (click to add/remove)
     - Prevent same topic in both lists
   - Human-readable summary (live update)
   - Real-time feed update when controls change

5. **Tune Button**
   - Add Tune action to each chirp
   - Contextual menu with 3 options:
     - "More from this person" → adjust followingWeight
     - "More about this topic" → add to likedTopics
     - "Less like this" → add to mutedTopics
   - Update For You config
   - Re-score and re-render feed
   - Optional: toast notification

**Deliverable:** Fully functional For You feed with transparent algorithm, user controls, and Tune button

---

## Step 4: Advanced Features & Polish
**Goal:** Add agent suggestions, comments, and final touches

### Tasks:
1. **Agent-Assisted Reach Suggestions**
   - Create API endpoint/service for suggestions
   - When user switches to Tuned mode:
     - Call agent with chirp text + topic
     - Receive suggested `TunedAudience` + explanation message
     - Display suggestion box with:
       - Suggested settings
       - Explanation message
       - "Apply suggestion" / "Ignore" buttons
   - User can still edit toggles after suggestion
   - MVP: Use simple heuristics (later can swap in LLM)

2. **Comments System**
   - Add comment creation UI (expandable on chirp)
   - Store comments in state
   - Calculate `activeComments` count per chirp
   - Display comment count
   - Use for "active conversations" boost signal

3. **Rechirp Functionality**
   - Implement rechirp action
   - Create new chirp with reference to original
   - Display in feeds appropriately

4. **User Profiles & Following**
   - Basic profile view
   - Follow/unfollow functionality
   - Display following count (not public, just for user)

5. **Polish & UX**
   - Loading states
   - Empty states (no chirps, no matches)
   - Smooth transitions
   - Error handling
   - Responsive design
   - Accessibility improvements

6. **Integration with Landing Page**
   - Ensure app section integrates smoothly
   - Anchor links work correctly
   - Demo modal can reference actual app

**Deliverable:** Complete, polished webapp with all MVP features

---

## Technical Notes

### State Management Approach
- Use Zustand for global state (lightweight, simple)
- Local component state for UI-only concerns
- Separate stores: `useUserStore`, `useFeedStore`, `useConfigStore`

### Data Flow
- Mock data initially (in-memory)
- Later: Replace with API calls
- Feed generation happens client-side for MVP
- Later: Move to backend for performance

### Algorithm Implementation
- Keep scoring function pure and testable
- Eligibility filter runs first
- Scoring runs on eligible candidates only
- Explanation generation based on score contributors

### Component Structure
```
AppSection.tsx (main container)
├── Composer.tsx
├── FeedTabs.tsx
│   ├── LatestFeed.tsx
│   └── ForYouFeed.tsx
├── ForYouControls.tsx
└── ChirpCard.tsx (reusable)
    ├── ChirpActions.tsx
    └── ChirpReachLabel.tsx
```

---

## Success Criteria

After Step 4, the app should:
- ✅ Allow users to post text-only chirps with topics and reach settings
- ✅ Display Latest feed (chronological, following-only)
- ✅ Display For You feed (algorithmic, transparent, user-controlled)
- ✅ Show "because" explanations for every For You item
- ✅ Allow real-time tuning via controls panel and Tune button
- ✅ Provide agent suggestions for Tuned reach settings
- ✅ Support comments for active conversations signal
- ✅ Respect all reach settings in both feeds
- ✅ Have clean, minimal, dark UI
- ✅ Work smoothly without bugs

---

## Next Steps After MVP
- Backend API integration
- Authentication system
- Database persistence
- Real-time updates
- Advanced topic discovery
- Onboarding flows
- Analytics integration

