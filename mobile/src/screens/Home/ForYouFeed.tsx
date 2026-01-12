import React, { useMemo, useEffect } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ChirpCard from '../../components/ChirpCard';
import type { Chirp, User, ForYouConfig } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { generateForYouFeed } from '../../lib/algorithm';
import { useUserStore } from '../../stores/useUserStore';

type Props = {
  chirps: Chirp[]; // All chirps - algorithm will filter/score
  loading: boolean;
  onRefresh: () => void;
  currentUser: User | null;
  forYouConfig: ForYouConfig;
};

const ForYouFeed: React.FC<Props> = ({ chirps, loading, onRefresh, currentUser, forYouConfig }) => {
  const { colors } = useTheme();
  const { getUser, loadUser } = useUserStore();

  // Get author function for algorithm
  const getAuthor = (userId: string): User | undefined => {
    return getUser(userId);
  };

  // Apply For You algorithm (same as webapp)
  const scoredChirps = useMemo(() => {
    if (!currentUser) return [];
    return generateForYouFeed(chirps, currentUser, forYouConfig, getAuthor);
  }, [chirps, currentUser, forYouConfig, getAuthor]);

  // Extract just the chirps from scored results
  const feedChirps = scoredChirps.map((scored) => scored.chirp);

  // Preload authors for visible chirps
  useEffect(() => {
    const authorIds = new Set<string>();
    feedChirps.forEach((chirp) => {
      if (chirp.authorId && !getUser(chirp.authorId)) {
        authorIds.add(chirp.authorId);
      }
    });

    // Load all missing authors
    authorIds.forEach((authorId) => {
      loadUser(authorId);
    });
  }, [feedChirps, getUser, loadUser]);

  return (
    <FlatList
      data={feedChirps}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
      renderItem={({ item }) => <ChirpCard chirp={item} />}
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No recommendations yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Follow topics and people to see personalized chirps here.
          </Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});

export default ForYouFeed;


