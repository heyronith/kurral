import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
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
  const navigation = useNavigation<NavigationProp>();
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
      <View style={styles.headerContainer}>
        <View style={styles.headerGradient} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <View style={styles.greetingRow}>
              <Text style={styles.greetingText}>
                <Text style={styles.greetingTime}>{getGreeting()}</Text>
                <Text style={styles.greetingName}>, {firstName}</Text>
          </Text>
              {newKuralsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{newKuralsCount}</Text>
                </View>
              )}
            </View>
          <Text style={styles.subhead}>
            {newKuralsCount > 0
                ? `${newKuralsCount} new Kural${newKuralsCount !== 1 ? 's' : ''} waiting`
              : "Catch up on what's happening"}
          </Text>
        </View>
        <TouchableOpacity
            style={[
              styles.profileButton,
              user?.profilePictureUrl && styles.profileButtonWithImage,
            ]}
            onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
            {user?.profilePictureUrl ? (
              <Image
                source={{ uri: user.profilePictureUrl }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitials}>{userInitials}</Text>
              </View>
            )}
        </TouchableOpacity>
        </View>
      </View>

      <View style={styles.feedSwitch}>
        <TouchableOpacity
          style={[
            styles.switchButton,
            styles.switchButtonSpacing,
            activeFeed === 'latest' && styles.switchButtonActive,
          ]}
          onPress={() => setActiveFeed('latest')}
        >
          <Text
            style={[
              styles.switchText,
              activeFeed === 'latest' && styles.switchTextActive,
            ]}
          >
            Following
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.switchButton,
            styles.switchButtonSpacing,
            activeFeed === 'forYou' && styles.switchButtonActive,
          ]}
          onPress={() => setActiveFeed('forYou')}
        >
          <View style={styles.switchButtonContent}>
            <Text
              style={[
                styles.switchText,
                activeFeed === 'forYou' && styles.switchTextActive,
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
                style={styles.gearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="settings-outline" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Bookmarks')}
          style={styles.bookmarkButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="bookmark-outline" 
            size={20} 
            color={activeFeed === 'forYou' ? colors.light.accent : colors.light.textMuted} 
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.light.background,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: `${colors.light.accent}08`,
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
    color: colors.light.textPrimary,
  },
  greetingTime: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.light.textPrimary,
    textTransform: 'capitalize',
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.light.accent,
  },
  badge: {
    backgroundColor: colors.light.accent,
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
    color: colors.light.textMuted,
    lineHeight: 20,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1.5,
    borderColor: `${colors.light.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 2,
    overflow: 'hidden',
  },
  profileButtonWithImage: {
    borderWidth: 2,
    borderColor: colors.light.border,
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
    backgroundColor: colors.light.accent,
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
    backgroundColor: '#EFE9FB',
  },
  switchButtonSpacing: {
    marginRight: 8,
  },
  switchButtonActive: {
    backgroundColor: colors.light.accent,
  },
  switchText: {
    fontWeight: '700',
    color: colors.light.accent,
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

