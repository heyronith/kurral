import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { chirpService } from '../../services/chirpService';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import ChirpCard from '../../components/ChirpCard';
import { useTheme } from '../../hooks/useTheme';
import type { Chirp, BookmarkFolder } from '../../types';

const BookmarksScreen = () => {
  const { colors } = useTheme();
  const { user: currentUser } = useAuthStore();
  const { loadUser, getBookmarkFolders } = useUserStore();
  const [bookmarkedChirps, setBookmarkedChirps] = useState<Chirp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const loadBookmarks = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      let bookmarkIds: string[] = [];

      // If a folder is selected, load from that folder
      if (selectedFolderId) {
        const folders = getBookmarkFolders();
        const folder = folders.find((f) => f.id === selectedFolderId);
        if (folder) {
          bookmarkIds = folder.chirpIds;
        }
      } else {
        // Load from all folders
        const folders = getBookmarkFolders();
        const folderBookmarkIds = folders.flatMap((f) => f.chirpIds);
        
        // Also include legacy bookmarks
        const legacyBookmarks = currentUser.bookmarks || [];
        
        // Combine and deduplicate
        const allBookmarkIds = [...new Set([...folderBookmarkIds, ...legacyBookmarks])];
        bookmarkIds = allBookmarkIds;
      }

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
  }, [currentUser?.bookmarks, currentUser?.bookmarkFolders, currentUser?.id, selectedFolderId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadBookmarks();
  };

  const dynamicStyles = getStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={dynamicStyles.container} edges={['top']}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Bookmarks</Text>
        </View>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={dynamicStyles.loadingText}>Loading bookmarks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const folders = getBookmarkFolders();
  const totalBookmarks = folders.reduce((sum, f) => sum + f.chirpIds.length, 0) + (currentUser?.bookmarks?.length || 0);

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Bookmarks</Text>
        <Text style={dynamicStyles.headerSubtitle}>
          {selectedFolderId
            ? folders.find((f) => f.id === selectedFolderId)?.name || 'Folder'
            : totalBookmarks === 0
            ? 'No bookmarks yet'
            : `${totalBookmarks} ${totalBookmarks === 1 ? 'bookmark' : 'bookmarks'}`}
        </Text>
      </View>

      {/* Folder List */}
      {folders.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={dynamicStyles.foldersScroll}
          contentContainerStyle={dynamicStyles.foldersScrollContent}
        >
          <TouchableOpacity
            onPress={() => setSelectedFolderId(null)}
            style={[
              dynamicStyles.folderChip,
              selectedFolderId === null && dynamicStyles.folderChipActive,
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="bookmarks"
              size={16}
              color={selectedFolderId === null ? '#fff' : colors.textMuted}
            />
            <Text
              style={[
                dynamicStyles.folderChipText,
                selectedFolderId === null && dynamicStyles.folderChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {folders.map((folder) => (
            <TouchableOpacity
              key={folder.id}
              onPress={() => setSelectedFolderId(folder.id)}
              style={[
                dynamicStyles.folderChip,
                selectedFolderId === folder.id && dynamicStyles.folderChipActive,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name="folder"
                size={16}
                color={selectedFolderId === folder.id ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  dynamicStyles.folderChipText,
                  selectedFolderId === folder.id && dynamicStyles.folderChipTextActive,
                ]}
              >
                {folder.name}
              </Text>
              <Text
                style={[
                  dynamicStyles.folderChipCount,
                  selectedFolderId === folder.id && dynamicStyles.folderChipCountActive,
                ]}
              >
                {folder.chirpIds.length}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        style={dynamicStyles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {bookmarkedChirps.length === 0 ? (
          <View style={dynamicStyles.emptyContainer}>
            <Text style={dynamicStyles.emptyText}>
              {selectedFolderId
                ? 'No bookmarks in this folder yet.'
                : "You haven't bookmarked any posts yet."}
            </Text>
            <Text style={dynamicStyles.emptySubtext}>
              {selectedFolderId
                ? 'Bookmark posts to save them to folders.'
                : 'Bookmark posts to save them for later.'}
            </Text>
          </View>
        ) : (
          <View style={dynamicStyles.chirpsList}>
            {bookmarkedChirps.map((chirp) => (
              <ChirpCard key={chirp.id} chirp={chirp} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
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
    color: colors.textMuted,
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
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  chirpsList: {
    gap: 12,
  },
  foldersScroll: {
    maxHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  foldersScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.border + '33',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  folderChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  folderChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  folderChipTextActive: {
    color: '#fff',
  },
  folderChipCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    backgroundColor: colors.border + '80',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  folderChipCountActive: {
    color: colors.accent,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});

export default BookmarksScreen;

