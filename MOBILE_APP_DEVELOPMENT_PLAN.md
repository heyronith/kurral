# Kural Mobile App Development Plan

**Project:** React Native Mobile App for Kural  
**Timeline:** 12 weeks (3 months)  
**Start Date:** [To be filled]  
**Target Completion:** [To be filled]

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
5. [Tech Stack](#tech-stack)
6. [Code Reusability](#code-reusability)
7. [Critical Decisions](#critical-decisions)
8. [Key Challenges & Solutions](#key-challenges--solutions)
9. [Development Setup](#development-setup)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)

---

## Executive Summary

This document outlines the complete development plan for creating a production-ready React Native mobile app for Kural that maintains full feature parity with the existing web application.

### Key Objectives

- ✅ Build native iOS and Android apps using React Native
- ✅ Maintain 100% feature parity with web app
- ✅ Reuse ~75% of business logic from web app
- ✅ Use the same Firebase backend (shared data)
- ✅ Deliver production-ready apps in 12 weeks

### Why React Native?

- **High Code Reusability:** ~75% of business logic can be reused
- **Shared Backend:** Same Firebase project, database, and services
- **Single Codebase:** One codebase for iOS and Android
- **Native Performance:** Near-native performance for most features
- **Mature Ecosystem:** Large community and extensive libraries
- **Team Familiarity:** Uses React/TypeScript (same as web app)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Firebase Backend                      │
│  • Firestore Database                                    │
│  • Authentication                                        │
│  • Storage (Images)                                      │
│  • Cloud Functions                                       │
└────────────┬───────────────────────┬─────────────────────┘
             │                       │
    ┌────────▼────────┐     ┌───────▼────────┐
    │   Web App       │     │  Mobile App    │
    │   (React)       │     │  (React Native)│
    │                 │     │                │
    │  Existing code  │     │  New code      │
    │  (Unchanged)    │     │  (This project)│
    └─────────────────┘     └────────────────┘
```

### Mobile App Architecture

```
mobile/
├── src/
│   ├── components/         # Reusable UI components
│   ├── screens/            # Screen-level components
│   ├── navigation/         # React Navigation setup
│   ├── services/           # Business logic (shared with web)
│   ├── stores/             # Zustand stores (shared with web)
│   ├── types/              # TypeScript types (shared with web)
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── config/             # App configuration
├── android/                # Android native code
├── ios/                    # iOS native code
└── package.json
```

---

## Project Structure

### Folder Organization

```
Dumbfeed/
├── mobile/                          # NEW - Mobile app (this project)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Composer/           # Rich text composer
│   │   │   ├── ChirpCard/          # Post display component
│   │   │   ├── CommentSection/     # Comments component
│   │   │   ├── Feed/               # Feed components
│   │   │   ├── Profile/            # Profile components
│   │   │   └── common/             # Shared UI components
│   │   ├── screens/
│   │   │   ├── Auth/               # Login, Signup, Onboarding
│   │   │   ├── Home/               # Main feed screens
│   │   │   ├── Profile/            # Profile screens
│   │   │   ├── Search/             # Search screens
│   │   │   ├── Settings/           # Settings screens
│   │   │   └── Notifications/      # Notifications screen
│   │   ├── navigation/
│   │   │   ├── AppNavigator.tsx    # Main navigation
│   │   │   ├── AuthNavigator.tsx   # Auth flow navigation
│   │   │   └── types.ts            # Navigation types
│   │   ├── services/
│   │   │   ├── firebase.ts         # Firebase config
│   │   │   ├── authService.ts      # Authentication
│   │   │   ├── firestore.ts        # Firestore services
│   │   │   ├── storage.ts          # Image uploads
│   │   │   └── pushNotifications.ts # Push notifications
│   │   ├── stores/                 # Zustand stores (copy from webapp/store)
│   │   ├── types/                  # TypeScript types (copy from webapp/types)
│   │   ├── hooks/                  # Custom hooks
│   │   ├── utils/                  # Utility functions
│   │   └── config/
│   │       ├── env.ts              # Environment config
│   │       └── theme.ts            # Theme configuration
│   ├── android/                    # Android native project
│   ├── ios/                        # iOS native project
│   ├── package.json
│   ├── tsconfig.json
│   ├── app.json                    # Expo config (if using Expo)
│   └── babel.config.js
├── src/                            # EXISTING - Web app (unchanged)
│   └── webapp/
└── ... (rest of existing files)
```

---

## Phase-by-Phase Implementation

### Phase 0: Foundation & Setup (Week 1)

**Objective:** Setup project structure and development environment

**Tasks:**

1. **Initialize React Native Project**
   - Create `mobile/` folder in project root
   - Initialize React Native project with TypeScript
   - Setup project structure

2. **Install Core Dependencies**
   ```bash
   npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
   npm install react-native-screens react-native-safe-area-context
   npm install react-native-gesture-handler react-native-reanimated
   npm install @react-native-firebase/app @react-native-firebase/auth
   npm install @react-native-firebase/firestore @react-native-firebase/storage
   npm install @react-native-firebase/messaging
   npm install zustand
   npm install react-native-image-picker
   npm install @react-native-async-storage/async-storage
   npm install react-native-vector-icons
   npm install nativewind tailwindcss  # Optional: for Tailwind-like styling
   ```

3. **Setup Firebase for React Native**
   - Configure `google-services.json` (Android)
   - Configure `GoogleService-Info.plist` (iOS)
   - Initialize Firebase in native code
   - Test Firebase connection

4. **Setup Navigation**
   - Configure React Navigation
   - Create navigation structure
   - Setup route types

5. **Setup Shared Code Structure**
   - Copy types from `src/webapp/types/`
   - Copy stores from `src/webapp/store/`
   - Copy services from `src/webapp/lib/`
   - Adapt for React Native imports

**Deliverables:**
- ✅ Working React Native project
- ✅ Firebase connected and tested
- ✅ Basic navigation structure
- ✅ Shared code structure in place

---

### Phase 1: Authentication & User Management (Week 2)

**Objective:** Complete authentication flow

**Tasks:**

1. **Auth Service Migration**
   - Create `mobile/src/services/authService.ts`
   - Implement email/password authentication
   - Implement Google Sign-In (use `@react-native-google-signin/google-signin`)
   - Implement password reset
   - Handle auth state persistence

2. **User Store Migration**
   - Copy `useUserStore.ts` from web app
   - Replace `localStorage` with `AsyncStorage`
   - Test user caching and loading

3. **Auth Screens**
   - `LoginScreen.tsx` - Convert from web component
   - `SignupScreen.tsx` - Convert from web component
   - `ForgotPasswordScreen.tsx` - Convert
   - `OnboardingScreen.tsx` - Multi-step onboarding flow

4. **Protected Routes**
   - Create `ProtectedRoute` wrapper component
   - Implement auth state persistence
   - Handle deep linking for auth flows

5. **Profile Setup**
   - Profile picture upload (use `react-native-image-picker`)
   - Handle image upload to Firebase Storage

**Deliverables:**
- ✅ Complete authentication flow working
- ✅ Google Sign-In functional
- ✅ User profile creation/editing
- ✅ Onboarding flow complete

---

### Phase 2: Core Navigation & Feed Infrastructure (Week 3)

**Objective:** Main app navigation and feed data loading

**Tasks:**

1. **Navigation Structure**
   ```
   - TabNavigator (Bottom tabs)
     - HomeTab (Latest/ForYou feeds)
     - SearchTab
     - NotificationsTab
     - ProfileTab
   - Stack Navigator
     - PostDetailScreen
     - ProfileDetailScreen
     - SettingsScreen
   - Modal Stack
     - ComposerModal
   ```

2. **Feed Store Migration**
   - Copy `useFeedStore.ts` (100% reusable)
   - Test real-time Firestore listeners

3. **Feed Services**
   - Copy `chirpService`, `commentService` from web app
   - Update Firebase imports to React Native Firebase
   - Real-time subscriptions work identically

4. **Feed Screens (Basic UI)**
   - `HomeScreen.tsx` - Feed tabs (Latest/ForYou)
   - `LatestFeed.tsx` - List component
   - `ForYouFeed.tsx` - List component
   - Use `FlatList` for performance

5. **ChirpCard Component**
   - Convert `ChirpCard.tsx` to React Native
   - Replace HTML → React Native components:
     - `<div>` → `<View>`
     - `<span>` → `<Text>`
     - `<img>` → `<Image>`
   - Implement touch interactions
   - Handle navigation to post detail

**Deliverables:**
- ✅ Working navigation structure
- ✅ Feeds loading data from Firestore
- ✅ Real-time updates working
- ✅ Basic chirp display

---

### Phase 3: Rich Text Composer (Week 4-5) — CRITICAL

**Objective:** Replace contentEditable with mobile-friendly rich text editor

**Challenge:** Web uses `contentEditable` with `document.execCommand` - not available in React Native

**Solution:** Use `react-native-rich-text-editor` or build custom solution

**Implementation Plan:**

1. **Choose Rich Text Editor Library**
   - Option A: `@react-native-rich-text-editor/react-native-rich-text-editor`
   - Option B: `react-native-pell-rich-editor`
   - Option C: Custom implementation with `TextInput` + format metadata

2. **Composer Component Architecture**
   ```
   mobile/src/components/Composer/
   ├── Composer.tsx          # Main composer component
   ├── FormatToolbar.tsx     # Bold, Italic buttons
   ├── MentionInputHandler.tsx # Handle @ mentions
   ├── ImagePickerButton.tsx # Attach images
   ├── EmojiPicker.tsx       # Emoji selection
   ├── SchedulePicker.tsx    # Date/time picker
   ├── TopicSelector.tsx     # Topic dropdown
   └── ReachModeSelector.tsx # Audience selection
   ```

3. **Rich Text Formatting**
   - Store text as: `{ text: "Hello", formats: [{start: 0, end: 5, bold: true}] }`
   - Render with custom Text component
   - Or use library that handles this

4. **Mention System**
   - Detect `@` in TextInput
   - Show user search dropdown
   - Insert mention with special formatting
   - Store mentions as metadata

5. **Image Handling**
   ```typescript
   import ImagePicker from 'react-native-image-picker';
   
   const pickImage = async () => {
     const result = await ImagePicker.launchImageLibrary({
       mediaType: 'photo',
       quality: 0.8,
     });
     // Upload to Firebase Storage (same logic as web)
   };
   ```

6. **Mobile-Specific UX**
   - Full-screen modal (not draggable like web)
   - Bottom sheet style composer
   - Keyboard-aware scrolling
   - Auto-focus on open

7. **Comment Editor**
   - Reuse same rich text components
   - Simpler version (no scheduling)
   - Inline editing

**Deliverables:**
- ✅ Working rich text composer
- ✅ Image uploads working
- ✅ Mentions working
- ✅ Scheduling posts
- ✅ Formatting (bold/italic)
- ✅ Topic selection
- ✅ Reach mode selection

---

### Phase 4: Post Detail & Interactions (Week 6)

**Objective:** Complete post viewing and interaction features

**Tasks:**

1. **Post Detail Screen**
   - Convert `PostDetailView.tsx`
   - Full-screen view with navigation
   - Scrollable content
   - Image gallery support

2. **Comment System**
   - Convert `CommentSection.tsx`
   - Nested comment threads
   - Comment editor (reuse Phase 3 components)
   - Real-time comment updates

3. **Interactions**
   - Like/Unlike (Firestore updates - same logic)
   - Bookmark (same logic)
   - Share (use React Native Share API)
   - Report functionality

4. **Fact Check Display**
   - Convert `FactCheckStatusPopup.tsx`
   - Modal presentation
   - Status indicators

**Deliverables:**
- ✅ Complete post detail view
- ✅ Commenting system working
- ✅ All interactions functional

---

### Phase 5: Search & Discovery (Week 7)

**Objective:** Search functionality and content discovery

**Tasks:**

1. **Search Store**
   - Copy `useSearchStore.ts` (100% reusable)

2. **Search Screen**
   - Convert search UI
   - Search input with debounce
   - Results list
   - User/chirp/topic results

3. **Topic Discovery**
   - Convert `TopicDetailView.tsx`
   - Topic feed
   - Topic following

4. **News Feed**
   - Convert `NewsDetailView.tsx`
   - Trending news display
   - News aggregation (same backend)

5. **Profile Discovery**
   - User search
   - Profile cards
   - Follow/unfollow from search

**Deliverables:**
- ✅ Complete search functionality
- ✅ Topic discovery
- ✅ News feed integration
- ✅ User discovery

---

### Phase 6: Profile & Settings (Week 8)

**Objective:** User profiles and app settings

**Tasks:**

1. **Profile Screen**
   - Convert `ProfilePage.tsx`
   - Profile header (cover photo, avatar)
   - Stats display
   - Chirps list (user's posts)
   - Followers/Following modal

2. **Profile Editing**
   - Convert `EditProfileModal.tsx`
   - Image uploads (avatar, cover)
   - Bio editing
   - Handle editing

3. **Settings Screen**
   - Convert `SettingsPage.tsx`
   - Tab navigation (Feed/Notifications/Account)
   - For You Feed controls
   - Notification preferences
   - Account settings
   - Delete account

4. **Bookmarks**
   - Convert `BookmarksPage.tsx`
   - Bookmarked chirps list
   - Same data source as web

**Deliverables:**
- ✅ Complete profile viewing/editing
- ✅ Settings fully functional
- ✅ Bookmarks working

---

### Phase 7: Notifications & Push (Week 9)

**Objective:** In-app and push notifications

**Tasks:**

1. **Notification Store**
   - Copy `useNotificationStore.ts`
   - Adapt for React Native

2. **FCM Setup**
   ```typescript
   // mobile/src/services/pushNotifications.ts
   import messaging from '@react-native-firebase/messaging';
   
   // Request permission
   await messaging().requestPermission();
   
   // Get token
   const token = await messaging().getToken();
   
   // Listen for messages
   messaging().onMessage(async remoteMessage => {
     // Show in-app notification
   });
   ```

3. **Notifications Screen**
   - Convert `NotificationsPage.tsx`
   - Notification list
   - Mark as read
   - Navigation to relevant content

4. **Background Notifications**
   - Handle notification taps
   - Deep linking from notifications
   - Badge counts

**Deliverables:**
- ✅ Push notifications working
- ✅ In-app notifications
- ✅ Notification preferences
- ✅ Deep linking from notifications

---

### Phase 8: Advanced Features (Week 10)

**Objective:** Dashboard, Most Valued, and other advanced features

**Tasks:**

1. **Dashboard Screen**
   - Convert `DashboardPage.tsx`
   - Analytics display
   - Charts (use `react-native-chart-kit` or `victory-native`)

2. **Most Valued**
   - Convert `MostValuedPage.tsx`
   - Value filtering
   - Timeframe selection
   - High-value content display

3. **Tuning System**
   - Convert tuning suggestions
   - Modal presentations
   - Apply tuning preferences

4. **Value Pipeline**
   - Copy value calculation services (100% reusable)
   - Background processing
   - Score updates

**Deliverables:**
- ✅ Dashboard functional
- ✅ Most Valued page working
- ✅ Tuning system integrated
- ✅ Value scoring operational

---

### Phase 9: Polish & Optimization (Week 11)

**Objective:** Performance, UX polish, and bug fixes

**Tasks:**

1. **Performance Optimization**
   - Implement FlatList optimizations
   - Image caching (use `react-native-fast-image`)
   - Lazy loading for feeds
   - Memory leak fixes

2. **UI/UX Polish**
   - Consistent styling (create theme system)
   - Animations (use `react-native-reanimated`)
   - Loading states
   - Error handling UI
   - Empty states

3. **Offline Support**
   - Cache critical data
   - Queue actions when offline
   - Sync when online

4. **Accessibility**
   - Screen reader support
   - Proper labels
   - Touch target sizes

5. **Error Handling**
   - Global error boundary
   - Network error handling
   - Firebase error handling
   - User-friendly error messages

**Deliverables:**
- ✅ Optimized performance
- ✅ Polished UI/UX
- ✅ Offline support
- ✅ Accessibility improvements

---

### Phase 10: Testing & Deployment (Week 12)

**Objective:** Comprehensive testing and app store preparation

**Tasks:**

1. **Testing**
   - Unit tests for stores/services
   - Integration tests for critical flows
   - E2E tests (use Detox or Maestro)
   - Device testing (iOS/Android)

2. **App Store Preparation**
   - App icons and splash screens
   - Store listings (screenshots, descriptions)
   - Privacy policy compliance
   - Terms of service

3. **Build Configuration**
   - Production builds
   - Code signing (iOS)
   - Release keystore (Android)
   - Environment configurations

4. **Beta Testing**
   - TestFlight (iOS)
   - Google Play Internal Testing
   - Beta user feedback

5. **Final Polish**
   - Bug fixes from beta
   - Performance tuning
   - Final UI tweaks

**Deliverables:**
- ✅ Production-ready builds
- ✅ App store submissions
- ✅ Beta testing complete
- ✅ Ready for release

---

## Tech Stack

### Core Framework
- **React Native:** 0.73+ (or latest stable)
- **TypeScript:** ^5.2.2
- **Expo:** Optional but recommended for faster development

### Navigation
- **@react-navigation/native:** ^6.1.9
- **@react-navigation/stack:** ^6.3.20
- **@react-navigation/bottom-tabs:** ^6.5.11

### Firebase
- **@react-native-firebase/app:** ^19.0.1
- **@react-native-firebase/auth:** ^19.0.1
- **@react-native-firebase/firestore:** ^19.0.1
- **@react-native-firebase/storage:** ^19.0.1
- **@react-native-firebase/messaging:** ^19.0.1

### State Management
- **zustand:** ^5.0.8 (same as web app)

### UI & Styling
- **nativewind:** ^4.0.0 (Tailwind for React Native) - OR
- **StyleSheet** (React Native's built-in styling)
- **react-native-vector-icons:** ^10.0.3
- **react-native-reanimated:** ^3.6.1 (animations)

### Storage
- **@react-native-async-storage/async-storage:** ^1.21.0

### Media
- **react-native-image-picker:** ^7.1.0
- **react-native-fast-image:** ^8.6.3 (for optimized image display)

### Rich Text Editing
- **@react-native-rich-text-editor/react-native-rich-text-editor** OR
- **react-native-pell-rich-editor**

### Authentication
- **@react-native-google-signin/google-signin:** ^11.0.0

### Utilities
- **react-native-url-polyfill:** ^2.0.0
- **date-fns:** ^3.0.0

---

## Code Reusability Breakdown

| Component | Reusability | Notes |
|-----------|-------------|-------|
| TypeScript Types | 100% | Copy directly from `src/webapp/types/` |
| Zustand Stores | 95% | Replace `localStorage` with `AsyncStorage` |
| Firebase Services | 90% | Update imports, same logic |
| Business Logic | 85% | Algorithm code, value calculations |
| Utils/Helpers | 90% | Most work as-is |
| UI Components | 10% | Complete rewrite needed |
| Navigation | 0% | Different library (React Navigation) |
| Rich Text Editor | 0% | Complete rewrite |

**Overall: ~75% code reuse in business logic layer**

---

## Critical Decisions

### 1. Rich Text Editor Solution

**Recommendation:** Start with `@react-native-rich-text-editor/react-native-rich-text-editor` or `react-native-pell-rich-editor`

**Why:**
- Faster development (don't reinvent the wheel)
- Handles complexity (selection, formatting, etc.)
- Can customize later if needed

**Fallback:** Custom implementation if libraries don't meet requirements

### 2. State Management

**Decision:** Keep Zustand (works identically in React Native)

- 95% of stores are reusable
- Just replace `localStorage` with `AsyncStorage`

### 3. Styling Approach

**Option A: NativeWind (Recommended)**
- Use Tailwind classes (similar to web)
- Familiar syntax for team
- Good performance

**Option B: StyleSheet + Theme System**
- More control
- Better performance
- More verbose

**Recommendation:** NativeWind for consistency with web codebase

### 4. Navigation Library

**Decision:** React Navigation (Industry Standard)

- Industry standard
- Excellent documentation
- Deep linking support
- Tab/stack navigation built-in

### 5. Image Handling

**Use `react-native-image-picker` for:**
- Profile pictures
- Post images
- Cover photos

**Use `react-native-fast-image` for:**
- Displaying images in feeds
- Better caching and performance

### 6. Push Notifications

**Use `@react-native-firebase/messaging`**
- Official Firebase package
- Works with existing Firebase setup
- Handles iOS/Android differences

---

## Key Challenges & Solutions

### Challenge 1: Rich Text Editor

**Problem:** Web uses `contentEditable` with `document.execCommand` - not available in React Native

**Solution:** Use library (`react-native-rich-text-editor`) or custom implementation with TextInput + format metadata

**Effort:** High (Week 4-5)

### Challenge 2: Drag-and-Drop Composer

**Problem:** Web has draggable floating composer - not ideal for mobile

**Solution:** Mobile uses full-screen modal (better UX anyway)

**Effort:** Medium (simplified UX)

### Challenge 3: Google OAuth

**Problem:** Web uses `signInWithPopup` - not available in React Native

**Solution:** Use `@react-native-google-signin/google-signin`

**Effort:** Low-Medium (Week 2)

### Challenge 4: Push Notifications

**Problem:** Web uses Service Workers - different on mobile

**Solution:** FCM setup + permissions handling

**Effort:** Medium (Week 9)

### Challenge 5: Image Uploads

**Problem:** Web uses `<input type="file">` - not available in React Native

**Solution:** `react-native-image-picker` + existing Firebase Storage logic

**Effort:** Low (Week 2)

### Challenge 6: Real-time Updates

**Solution:** Firestore listeners work identically in React Native

**Effort:** Low (already working)

---

## Development Setup

### Prerequisites

#### macOS Setup (for iOS development)

1. **Install Xcode**
   ```bash
   # Download from App Store or Apple Developer
   xcode-select --install
   ```

2. **Install CocoaPods**
   ```bash
   sudo gem install cocoapods
   ```

3. **Install Node.js** (if not already installed)
   ```bash
   # Using Homebrew
   brew install node
   # Or use nvm
   nvm install 18
   ```

4. **Install Watchman** (for file watching)
   ```bash
   brew install watchman
   ```

5. **Install React Native CLI**
   ```bash
   npm install -g react-native-cli
   ```

#### Android Setup (optional, for Android development)

1. **Install Java Development Kit (JDK)**
   ```bash
   brew install openjdk@11
   ```

2. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - Install Android SDK
   - Configure ANDROID_HOME environment variable

3. **Configure Android Environment**
   ```bash
   # Add to ~/.zshrc or ~/.bash_profile
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```

### Initial Project Setup

1. **Create Mobile Folder**
   ```bash
   cd /Users/ronny/Desktop/Dumbfeed
   mkdir mobile
   cd mobile
   ```

2. **Initialize React Native Project**
   ```bash
   # Using React Native CLI
   npx react-native@latest init KuralMobile --directory . --skip-install
   
   # OR using Expo (recommended for faster start)
   npx create-expo-app@latest . --template blank-typescript
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Setup Firebase**
   - Download `GoogleService-Info.plist` (iOS) from Firebase Console
   - Download `google-services.json` (Android) from Firebase Console
   - Place in appropriate folders

### Running the App

#### iOS Simulator
```bash
# Start Metro bundler
npm start

# In another terminal, run iOS
npm run ios
# OR
npx react-native run-ios
```

#### Android Emulator
```bash
# Start Metro bundler
npm start

# In another terminal, run Android
npm run android
# OR
npx react-native run-android
```

---

## Testing Strategy

### Unit Tests
- Jest for testing stores/services
- React Native Testing Library for components

### Integration Tests
- Test critical user flows
- Test Firebase integration

### E2E Tests
- Detox (recommended) or Maestro
- Test on real devices/simulators

### Manual Testing Checklist
- [ ] Authentication flows
- [ ] Feed loading and updates
- [ ] Post creation (with rich text)
- [ ] Image uploads
- [ ] Comments
- [ ] Notifications
- [ ] Profile viewing/editing
- [ ] Settings
- [ ] Search functionality

---

## Deployment Guide

### iOS Deployment

1. **Setup Apple Developer Account**
   - Enroll in Apple Developer Program ($99/year)

2. **Configure Code Signing**
   - Open project in Xcode
   - Configure signing & capabilities

3. **Build for App Store**
   ```bash
   cd ios
   xcodebuild -workspace KuralMobile.xcworkspace -scheme KuralMobile -configuration Release archive
   ```

4. **Submit via Xcode or Transporter**

### Android Deployment

1. **Generate Signing Key**
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure Gradle**
   - Add signing config to `android/app/build.gradle`

3. **Build Release APK**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

4. **Build App Bundle (for Play Store)**
   ```bash
   ./gradlew bundleRelease
   ```

5. **Upload to Google Play Console**

---

## Success Metrics

### Phase Completion Criteria

1. ✅ All web features functional in mobile
2. ✅ Performance: < 2s initial load, 60fps scrolling
3. ✅ Firebase services working (auth, firestore, storage, messaging)
4. ✅ Rich text composer matches web functionality
5. ✅ Push notifications working
6. ✅ App store ready (icons, screenshots, compliance)
7. ✅ Beta testing feedback addressed

### Performance Targets

- **Initial Load Time:** < 2 seconds
- **Frame Rate:** 60 FPS during scrolling
- **Image Load Time:** < 1 second for cached images
- **Time to Interactive:** < 3 seconds

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| Phase 0 | Week 1 | Project setup, Firebase connected |
| Phase 1 | Week 2 | Authentication working |
| Phase 2 | Week 3 | Feeds loading, basic UI |
| Phase 3 | Week 4-5 | Rich text composer (CRITICAL) |
| Phase 4 | Week 6 | Post detail, comments, interactions |
| Phase 5 | Week 7 | Search, discovery, topics |
| Phase 6 | Week 8 | Profiles, settings, bookmarks |
| Phase 7 | Week 9 | Notifications, push |
| Phase 8 | Week 10 | Dashboard, Most Valued |
| Phase 9 | Week 11 | Polish, optimization |
| Phase 10 | Week 12 | Testing, deployment |

**Total: 12 weeks (3 months) for production-ready app**

---

## Notes & Considerations

### Backend Compatibility

- ✅ Same Firebase project (shared data)
- ✅ Same Firestore database
- ✅ Same authentication system
- ✅ Same Cloud Functions
- ✅ Same Storage buckets

### Code Sharing Strategy

- Start by copying code and adapting
- Consider monorepo structure later if needed
- Shared types can be in separate package
- Services/stores can be shared via symlinks or packages

### Maintenance

- Web app remains unchanged
- Mobile app is separate codebase
- Both connect to same backend
- Updates to shared logic need to be synced

---

## Next Steps

1. ✅ Review and approve this plan
2. ✅ Setup development environment (Phase 0)
3. ✅ Begin Phase 1 (Authentication)
4. ✅ Weekly progress reviews

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Ready for Implementation

---

## Mac Setup Guide for React Native Development

### Current System Status

✅ **Already Installed:**
- Node.js v22.15.1
- Homebrew
- Xcode 26.0.1
- CocoaPods

⚠️ **Needs Installation:**
- Watchman (for file watching during development)

### Step-by-Step Setup Instructions

#### 1. Install Watchman

Watchman is Facebook's file watching service that React Native uses to detect changes.

```bash
brew install watchman
```

#### 2. Install React Native CLI (Optional - Expo recommended)

For pure React Native (without Expo):
```bash
npm install -g react-native-cli
```

**Note:** We recommend using Expo for faster development, which doesn't require this.

#### 3. Install Expo CLI (Recommended)

Expo simplifies React Native development and is easier to get started:

```bash
npm install -g expo-cli
# OR use npx (no global install needed)
npx create-expo-app --version
```

#### 4. Setup iOS Simulator

Xcode is already installed. To open iOS Simulator:

```bash
# Open Xcode first to accept license if needed
open -a Simulator

# OR via command line
xcrun simctl list devices
```

#### 5. Verify Installation

Run these commands to verify everything is set up:

```bash
# Check Node.js
node --version  # Should show v22.15.1 or similar

# Check npm
npm --version

# Check Watchman (after installation)
watchman --version

# Check CocoaPods
pod --version

# Check Xcode
xcodebuild -version  # Should show Xcode 26.0.1

# Check Expo (after installation)
npx expo --version
```

### Quick Start: Initialize Mobile App

Once setup is complete, you can initialize the mobile app:

```bash
cd /Users/ronny/Desktop/Dumbfeed
mkdir -p mobile
cd mobile

# Initialize with Expo (Recommended - easier to start)
npx create-expo-app@latest . --template blank-typescript

# OR with React Native CLI (more control, more setup)
npx react-native@latest init KuralMobile --directory . --template react-native-template-typescript
```

### Running the App

#### With Expo:

```bash
cd mobile
npm start

# Then:
# - Press 'i' for iOS Simulator
# - Press 'a' for Android Emulator (if set up)
# - Scan QR code with Expo Go app on physical device
```

#### With React Native CLI:

```bash
cd mobile
npm start

# In another terminal:
npm run ios    # For iOS Simulator
npm run android # For Android Emulator (if set up)
```

### Development Workflow

1. **Start Metro Bundler:**
   ```bash
   cd mobile
   npm start
   ```

2. **Run on iOS Simulator:**
   ```bash
   # In another terminal
   npm run ios
   ```

3. **Make Changes:**
   - Edit code in `mobile/src/`
   - Changes hot-reload automatically
   - Press `r` in Metro to reload
   - Press `Cmd+R` in Simulator to reload

### Troubleshooting

#### iOS Simulator Issues

- **Simulator won't open:** 
  ```bash
  open -a Simulator
  xcodebuild -runFirstLaunch
  ```

- **Build errors:** 
  ```bash
  cd mobile/ios
  pod install
  cd ..
  npm run ios
  ```

- **Metro bundler cache issues:**
  ```bash
  npm start -- --reset-cache
  ```

#### Common Issues

- **Port already in use (8081):**
  ```bash
  lsof -ti:8081 | xargs kill -9
  ```

- **CocoaPods issues:**
  ```bash
  cd mobile/ios
  pod deintegrate
  pod install
  ```

- **Node modules issues:**
  ```bash
  cd mobile
  rm -rf node_modules
  npm install
  ```

### Next Steps After Setup

1. ✅ Verify all tools are installed
2. ✅ Initialize mobile app folder
3. ✅ Test running the app in iOS Simulator
4. ✅ Proceed with Phase 0: Foundation & Setup

