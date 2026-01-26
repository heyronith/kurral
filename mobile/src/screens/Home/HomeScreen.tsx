import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFeedStore } from '../../stores/useFeedStore';
import LatestFeed from './LatestFeed';
import ForYouFeed from './ForYouFeed';
import { DEFAULT_FOR_YOU_CONFIG } from '../../types';
import ComposeFab from '../../components/Composer/ComposeFab';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConfigStore } from '../../stores/useConfigStore';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

const LAST_VIEWED_KEY = 'lastViewedFeedTimestamp';

// Get time-based greeting
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  } else if (hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
};

const HomeScreen = () => {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/79478aa2-e9cd-47a0-9d85-d37e8b5e454c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'mobile/src/screens/Home/HomeScreen.tsx:34',message:'HomeScreen mounted',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'home-render'})}).catch(()=>{});
  }, []);
  // #endregion
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const {
    activeFeed,
    setActiveFeed,
    latest,
    forYou,
    latestLoading,
    forYouLoading,
    startLatestListener,
    startForYouListener,
    refreshLatest,
    refreshForYou,
  } = useFeedStore();
  const [newKuralsCount, setNewKuralsCount] = useState(0);
  const { forYouConfig, initializeConfig } = useConfigStore();

  // Initialize config from user when user changes
  useEffect(() => {
    if (user) {
      initializeConfig(user);
    }
  }, [user?.id, initializeConfig]);

  // Calculate new Kurals count based on last viewed timestamp
  useEffect(() => {
    const calculateNewKurals = async () => {
      try {
        const lastViewedStr = await AsyncStorage.getItem(LAST_VIEWED_KEY);
        const lastViewed = lastViewedStr ? parseInt(lastViewedStr, 10) : null;
        
        if (!lastViewed) {
          // First time viewing, set current time and show 0
          await AsyncStorage.setItem(LAST_VIEWED_KEY, Date.now().toString());
          setNewKuralsCount(0);
          return;
        }

        // Count Kurals created after last viewed time
        const activeFeedChirps = activeFeed === 'latest' ? latest : forYou;
        const newCount = activeFeedChirps.filter(
          (chirp) => chirp.createdAt.getTime() > lastViewed
        ).length;
        
        setNewKuralsCount(newCount);
      } catch (error) {
        console.error('Error calculating new Kurals:', error);
        setNewKuralsCount(0);
      }
    };

    calculateNewKurals();
  }, [latest, forYou, activeFeed]);

  // Update last viewed timestamp when feed changes or component mounts
  useEffect(() => {
    const updateLastViewed = async () => {
      try {
        await AsyncStorage.setItem(LAST_VIEWED_KEY, Date.now().toString());
        setNewKuralsCount(0);
      } catch (error) {
        console.error('Error updating last viewed timestamp:', error);
      }
    };

    // Update after a short delay to allow user to see the count
    const timer = setTimeout(updateLastViewed, 2000);
    return () => clearTimeout(timer);
  }, [activeFeed]);

  // Initialize config when user loads
  useEffect(() => {
    if (user) {
      initializeConfig(user);
    }
  }, [user?.id, initializeConfig]);

  // Start feed listeners when user or config changes
  useEffect(() => {
    if (!user?.id) return;

    const followingIds = user.following || [];
    const stopLatest = startLatestListener(followingIds, user.id);
    const stopForYou = startForYouListener(user.id, forYouConfig);

    return () => {
      stopLatest?.();
      stopForYou?.();
    };
  }, [startLatestListener, startForYouListener, user?.id, user?.following, forYouConfig]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const dynamicStyles = getStyles(colors);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={{ flex: 1 }}>
      <View style={dynamicStyles.headerContainer}>
      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerLeft}>
            <View style={dynamicStyles.greetingRow}>
              <Text style={dynamicStyles.greetingText}>
                <Text style={dynamicStyles.greetingTime}>{getGreeting()}</Text>
                <Text style={dynamicStyles.greetingName}>, {firstName}</Text>
          </Text>
              {newKuralsCount > 0 && (
                <View style={dynamicStyles.badge}>
                  <Text style={dynamicStyles.badgeText}>{newKuralsCount}</Text>
                </View>
              )}
            </View>
          <Text style={dynamicStyles.subhead}>
            {newKuralsCount > 0
                ? `${newKuralsCount} new Kural${newKuralsCount !== 1 ? 's' : ''} waiting`
              : "Catch up on what's happening"}
          </Text>
        </View>
        <TouchableOpacity
            style={[
              dynamicStyles.profileButton,
              user?.profilePictureUrl && dynamicStyles.profileButtonWithImage,
            ]}
            onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
            {user?.profilePictureUrl ? (
              <Image
                source={{ uri: user.profilePictureUrl }}
                style={dynamicStyles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={dynamicStyles.profilePlaceholder}>
                <Text style={dynamicStyles.profileInitials}>{userInitials}</Text>
              </View>
            )}
        </TouchableOpacity>
        </View>
      </View>

      <View style={dynamicStyles.feedSwitch}>
        <TouchableOpacity
          style={[
            dynamicStyles.switchButton,
            dynamicStyles.switchButtonSpacing,
            activeFeed === 'latest' && dynamicStyles.switchButtonActive,
          ]}
          onPress={() => setActiveFeed('latest')}
        >
          <Text
            style={[
              dynamicStyles.switchText,
              activeFeed === 'latest' && dynamicStyles.switchTextActive,
            ]}
          >
            Following
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            dynamicStyles.switchButton,
            dynamicStyles.switchButtonSpacing,
            activeFeed === 'forYou' && dynamicStyles.switchButtonActive,
          ]}
          onPress={() => setActiveFeed('forYou')}
        >
          <View style={dynamicStyles.switchButtonContent}>
            <Text
              style={[
                dynamicStyles.switchText,
                activeFeed === 'forYou' && dynamicStyles.switchTextActive,
              ]}
            >
              Kurals
            </Text>
            {activeFeed === 'forYou' && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('ForYouControls');
                }}
                style={dynamicStyles.gearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="settings-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Bookmarks')}
          style={dynamicStyles.bookmarkButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="bookmark-outline" 
            size={20} 
            color={activeFeed === 'forYou' ? colors.accent : colors.textMuted} 
          />
        </TouchableOpacity>
      </View>

      {activeFeed === 'latest' ? (
        <LatestFeed
          chirps={latest}
          loading={latestLoading}
          onRefresh={() => {
            if (user?.id) {
              const followingIds = user.following || [];
              refreshLatest(followingIds, user.id);
            }
          }}
        />
      ) : (
        <ForYouFeed
          chirps={forYou}
          loading={forYouLoading}
          onRefresh={() => {
            if (user?.id) {
              refreshForYou(user.id, forYouConfig);
            }
          }}
          currentUser={user}
          forYouConfig={forYouConfig}
        />
      )}
      </View>
      <ComposeFab />
    </SafeAreaView>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  greetingTime: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  subhead: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1.5,
    borderColor: colors.accent + '33',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  profileButtonWithImage: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  feedSwitch: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  switchButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.accent + '14',
  },
  switchButtonSpacing: {
    marginRight: 8,
  },
  switchButtonActive: {
    backgroundColor: colors.accent,
  },
  switchText: {
    fontWeight: '700',
    color: colors.accent,
  },
  switchTextActive: {
    color: '#fff',
  },
  switchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gearButton: {
    padding: 2,
    marginLeft: 4,
  },
  bookmarkButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;

