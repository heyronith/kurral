import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import { colors } from '../theme/colors';
import OnboardingScreen from '../screens/Auth/OnboardingScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const OnboardingStack = createNativeStackNavigator();

const RootNavigator = () => {
  const { user, setUser, isHydrated, setHydrated } = useAuthStore();
  const [loading, setLoading] = useState(true);

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
          backgroundColor: colors.light.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.light.accent} />
      </View>
    );
  }

  // If user exists but onboarding not completed, route to onboarding screen
  if (user && user.onboardingCompleted === false) {
    return (
      <NavigationContainer>
        <OnboardingStack.Navigator
          screenOptions={{ headerShown: false, animation: 'fade' }}
        >
          <OnboardingStack.Screen
            name="Onboarding"
            component={OnboardingScreen}
          />
        </OnboardingStack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;

