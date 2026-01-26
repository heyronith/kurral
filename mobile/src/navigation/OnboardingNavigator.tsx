import React, { useState, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingStep1Profile from '../screens/Auth/OnboardingStep1Profile';
import OnboardingStep2Interests from '../screens/Auth/OnboardingStep2Interests';
import OnboardingStep3Follow from '../screens/Auth/OnboardingStep3Follow';
import { userService } from '../services/userService';
import { useAuthStore } from '../stores/useAuthStore';
import { generateAndSaveProfileSummary } from '../services/profileSummaryAgent';

export type OnboardingData = {
  displayName?: string;
  handle?: string;
  bio?: string;
  url?: string;
  location?: string;
  interests?: string[];
};

export type OnboardingStackParamList = {
  Step1Profile: {
    profileData?: OnboardingData;
    interests?: string[];
    onUpdate: (data: Partial<OnboardingData>) => void;
    currentUserId: string;
  };
  Step2Interests: {
    profileData: OnboardingData;
    interests?: string[];
    onUpdate: (data: Partial<OnboardingData>) => void;
    currentUserId: string;
  };
  Step3Follow: {
    profileData: OnboardingData;
    interests: string[];
    onComplete: () => void;
    currentUserId: string;
  };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingNavigator = () => {
  const { user, setUser } = useAuthStore();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mobile/src/navigation/OnboardingNavigator.tsx:43',message:'OnboardingNavigator mounting',data:{hasUser: !!user},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'nav-render'})}).catch(()=>{});
  // #endregion
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    displayName: user?.name || user?.displayName || '',
    handle: user?.handle || '',
    bio: user?.bio || '',
    url: user?.url || '',
    location: user?.location || '',
    interests: user?.interests || [],
  });

  const handleUpdate = useCallback((data: Partial<OnboardingData>) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
  }, []);

  const ensureMinimumFollows = async (userId: string, minCount: number = 3): Promise<void> => {
    try {
      const refreshed = await userService.getUser(userId);
      if (!refreshed) return;

      const currentFollowing = refreshed.following || [];
      if (currentFollowing.length >= minCount) {
        return;
      }

      const popular = await userService.getPopularAccounts(8);
      const candidateIds = popular
        .map((user) => user.id)
        .filter((id) => id !== userId && !currentFollowing.includes(id))
        .slice(0, minCount - currentFollowing.length);

      if (candidateIds.length === 0) {
        return;
      }

      await userService.autoFollowAccounts(userId, candidateIds);
    } catch (error) {
      console.error('[OnboardingNavigator] Error ensuring minimum follows:', error);
      // Don't throw - this is non-critical
    }
  };

  const handleComplete = useCallback(async () => {
    if (!user) {
      console.error('[OnboardingNavigator] No user found');
      return;
    }

    try {
      // Build update data
      const updateData: any = {
        displayName: onboardingData.displayName?.trim(),
        userId: onboardingData.handle?.trim().toLowerCase(),
        handle: onboardingData.handle?.trim().toLowerCase(),
        name: onboardingData.displayName?.trim(),
        topics: [],
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        interests: onboardingData.interests || [],
        firstTimeUser: true,
      };

      // Only add optional fields if they have values
      if (onboardingData.bio?.trim()) {
        updateData.bio = onboardingData.bio.trim();
      }
      if (onboardingData.url?.trim()) {
        updateData.url = onboardingData.url.trim();
      }
      if (onboardingData.location?.trim()) {
        updateData.location = onboardingData.location.trim();
      }

      // Save profile data (CRITICAL - must complete before navigation)
      await userService.updateUser(user.id, updateData);

      // Ensure minimum follows (non-blocking)
      ensureMinimumFollows(user.id).catch((error) => {
        console.error('[OnboardingNavigator] Error ensuring minimum follows (non-critical):', error);
      });

      // Update auth store
      const updatedUser = { ...user, ...updateData };
      setUser(updatedUser);

      // Generate profile summary in background (NON-CRITICAL)
      generateAndSaveProfileSummary(user.id)
        .then(async (summary) => {
          if (summary) {
            // Refresh user data when summary is ready
            const refreshed = await userService.getUser(user.id);
            if (refreshed) {
              setUser(refreshed);
            }
          }
        })
        .catch((error) => {
          // Log but don't block - summary generation is non-critical
          console.error('[OnboardingNavigator] Profile summary generation failed (non-critical):', error);
        });
    } catch (error: any) {
      console.error('[OnboardingNavigator] Error completing onboarding:', error);
      // In a real app, you might want to show an error alert here
      // For now, we'll just log it
    }
  }, [user, onboardingData, setUser]);

  if (!user) {
    return null;
  }

  return (
    <Stack.Navigator
      initialRouteName="Step1Profile"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Step1Profile"
        component={OnboardingStep1Profile}
        initialParams={{
          profileData: onboardingData,
          interests: onboardingData.interests,
          onUpdate: handleUpdate,
          currentUserId: user.id,
        }}
      />
      <Stack.Screen
        name="Step2Interests"
        component={OnboardingStep2Interests}
        initialParams={{
          profileData: onboardingData,
          interests: onboardingData.interests,
          onUpdate: handleUpdate,
          currentUserId: user.id,
        }}
      />
      <Stack.Screen
        name="Step3Follow"
        component={OnboardingStep3Follow}
        initialParams={{
          profileData: onboardingData,
          interests: onboardingData.interests || [],
          onComplete: handleComplete,
          currentUserId: user.id,
        }}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;

