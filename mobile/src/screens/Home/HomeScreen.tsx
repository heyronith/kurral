import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFeedStore } from '../../stores/useFeedStore';
import LatestFeed from './LatestFeed';
import ForYouFeed from './ForYouFeed';
import { DEFAULT_FOR_YOU_CONFIG } from '../../types';
import ComposeFab from '../../components/Composer/ComposeFab';

const HomeScreen = () => {
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

  const forYouConfig = useMemo(
    () => user?.forYouConfig ?? DEFAULT_FOR_YOU_CONFIG,
    [user?.forYouConfig]
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>
            Hey, {user?.name?.split(' ')[0] || 'there'} 👋
          </Text>
          <Text style={styles.subhead}>Catch up on what’s happening</Text>
        </View>
        <TouchableOpacity style={styles.logout} onPress={authService.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
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
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.switchButton,
            activeFeed === 'forYou' && styles.switchButtonActive,
          ]}
          onPress={() => setActiveFeed('forYou')}
        >
          <Text
            style={[
              styles.switchText,
              activeFeed === 'forYou' && styles.switchTextActive,
            ]}
          >
            Curated Kurals
          </Text>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcome: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  subhead: {
    marginTop: 4,
    color: colors.light.textMuted,
    fontSize: 14,
  },
  logout: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  logoutText: {
    color: colors.light.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  feedSwitch: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
});

export default HomeScreen;

