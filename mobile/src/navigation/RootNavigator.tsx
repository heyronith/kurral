import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import { useTheme } from '../hooks/useTheme';
import { pushNotificationService } from '../services/pushNotificationService';
import { linking } from './linking';

const RootNavigator = () => {
  const { user, setUser, isHydrated, setHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    const unsubscribe = authService.subscribe((u) => {
      setUser(u);
      setLoading(false);
    });
    setHydrated(true);
    return unsubscribe;
  }, [setUser, setHydrated]);

  // Handle Push Notifications registration when user is logged in
  useEffect(() => {
    if (user?.id) {
      pushNotificationService.registerForPushNotificationsAsync(user.id);

      const cleanup = pushNotificationService.setupListeners((data) => {
        console.log('[RootNavigator] Notification tapped with data:', data);
        // Deep linking configuration in NavigationContainer will handle navigation
        // If data contains a URL or postId we can navigate manually if needed
      });

      return cleanup;
    }
  }, [user?.id]);

  if (loading || !isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // If user exists but onboarding not completed, route to onboarding navigator
  if (user && user.onboardingCompleted === false) {
    return (
      <NavigationContainer linking={linking}>
        <OnboardingNavigator />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;

