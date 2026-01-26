import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import { useTheme } from '../hooks/useTheme';

const RootNavigator = () => {
  const { user, setUser, isHydrated, setHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mobile/src/navigation/RootNavigator.tsx:16',message:'RootNavigator state',data:{loading, isHydrated, hasUser: !!user, onboardingCompleted: user?.onboardingCompleted},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'nav-state'})}).catch(()=>{});
  }, [loading, isHydrated, user]);
  // #endregion

  useEffect(() => {
    const unsubscribe = authService.subscribe((u) => {
      setUser(u);
      setLoading(false);
    });
    setHydrated(true);
    return unsubscribe;
  }, [setUser, setHydrated]);

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
      <NavigationContainer>
        <OnboardingNavigator />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer
      onReady={() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mobile/src/navigation/RootNavigator.tsx:56',message:'NavigationContainer ready',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'nav-ready'})}).catch(()=>{});
        // #endregion
      }}
    >
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;

