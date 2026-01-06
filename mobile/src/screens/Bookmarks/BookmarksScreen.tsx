import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { chirpService } from '../../services/chirpService';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import ChirpCard from '../../components/ChirpCard';
import { colors } from '../../theme/colors';
import type { Chirp } from '../../types';

const BookmarksScreen = () => {
  const { user: currentUser } = useAuthStore();
  const { loadUser } = useUserStore();
  const [bookmarkedChirps, setBookmarkedChirps] = useState<Chirp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBookmarks = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      const bookmarkIds = currentUser.bookmarks || [];
      
      if (bookmarkIds.length === 0) {
        setBookmarkedChirps([]);
        setIsLoading(false);
        return;
      }

      // Load all bookmarked chirps
      const chirps = await Promise.all(
        bookmarkIds.map((id) => chirpService.getChirp(id))
      );

      // Filter out nulls and sort by creation date (newest first)
      const validChirps = chirps
        .filter((chirp): chirp is Chirp => chirp !== null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const visibleChirps = filterChirpsForViewer(validChirps, currentUser?.id);

      setBookmarkedChirps(visibleChirps);

      // Load authors for chirps
      const authorIds = new Set(validChirps.map((c) => c.authorId));
      for (const authorId of authorIds) {
        await loadUser(authorId);
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadBookmarks();
    }
  }, [currentUser?.bookmarks, currentUser?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadBookmarks();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bookmarks</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.loadingText}>Loading bookmarks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookmarks</Text>
        <Text style={styles.headerSubtitle}>
          {bookmarkedChirps.length === 0
            ? 'No bookmarks yet'
            : `${bookmarkedChirps.length} ${bookmarkedChirps.length === 1 ? 'bookmark' : 'bookmarks'}`}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.light.accent}
          />
        }
      >
        {bookmarkedChirps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't bookmarked any posts yet.</Text>
            <Text style={styles.emptySubtext}>Bookmark posts to save them for later.</Text>
          </View>
        ) : (
          <View style={styles.chirpsList}>
            {bookmarkedChirps.map((chirp) => (
              <ChirpCard key={chirp.id} chirp={chirp} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.light.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.light.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  chirpsList: {
    gap: 12,
  },
});

export default BookmarksScreen;

