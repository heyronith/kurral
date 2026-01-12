import React, { useEffect } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ChirpCard from '../../components/ChirpCard';
import type { Chirp } from '../../types';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/useUserStore';

type Props = {
  chirps: Chirp[];
  loading: boolean;
  onRefresh: () => void;
};

const LatestFeed: React.FC<Props> = ({ chirps, loading, onRefresh }) => {
  const { colors } = useTheme();
  const { loadUser, getUser } = useUserStore();

  // Preload authors for visible chirps
  useEffect(() => {
    const authorIds = new Set<string>();
    chirps.forEach((chirp) => {
      if (chirp.authorId && !getUser(chirp.authorId)) {
        authorIds.add(chirp.authorId);
      }
    });

    // Load all missing authors
    authorIds.forEach((authorId) => {
      loadUser(authorId);
    });
  }, [chirps, getUser, loadUser]);

  return (
    <FlatList
      data={chirps}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
      renderItem={({ item }) => <ChirpCard chirp={item} />}
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No posts yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Follow some users to see their posts here.
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

export default LatestFeed;


