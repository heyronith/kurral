import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { ProfileStackParamList } from '../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { User } from '../types';
import { useUserStore } from '../stores/useUserStore';
import { useAuthStore } from '../stores/useAuthStore';
import { userService } from '../services/userService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors } from '../theme/colors';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

interface FollowersFollowingModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  mode: 'followers' | 'following';
}

// Helper to convert Firestore timestamp to Date
const toDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

// Helper to convert Firestore user doc to User type
const userFromFirestoreDoc = (doc: any): User => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    handle: data.handle,
    email: data.email,
    createdAt: toDate(data.createdAt),
    following: data.following || [],
    bookmarks: data.bookmarks || [],
    interests: data.interests || [],
    displayName: data.displayName,
    userId: data.userId,
    topics: data.topics || [],
    bio: data.bio,
    url: data.url,
    location: data.location,
    onboardingCompleted: data.onboardingCompleted || false,
    profilePictureUrl: data.profilePictureUrl,
    coverPhotoUrl: data.coverPhotoUrl,
    reputation: data.reputation || {},
    valueStats: data.valueStats
      ? {
          postValue30d: data.valueStats.postValue30d || 0,
          commentValue30d: data.valueStats.commentValue30d || 0,
          lifetimePostValue: data.valueStats.lifetimePostValue,
          lifetimeCommentValue: data.valueStats.lifetimeCommentValue,
          lastUpdated: toDate(data.valueStats.lastUpdated),
        }
      : undefined,
    kurralScore: data.kurralScore
      ? {
          score: data.kurralScore.score || 0,
          lastUpdated: toDate(data.kurralScore.lastUpdated),
          components: data.kurralScore.components || {
            qualityHistory: 0,
            violationHistory: 0,
            engagementQuality: 0,
            consistency: 0,
            communityTrust: 0,
          },
          history: data.kurralScore.history || [],
        }
      : undefined,
    forYouConfig: data.forYouConfig || undefined,
  };
};

const FollowersFollowingModal: React.FC<FollowersFollowingModalProps> = ({
  visible,
  onClose,
  userId,
  mode,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const { users, loadUser, followUser, unfollowUser, isFollowing, addUser } = useUserStore();
  const { user: currentUser } = useAuthStore();
  const [userList, setUserList] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        if (mode === 'following') {
          // Get the profile user to see who they're following
          const profileUser = await userService.getUser(userId);
          if (profileUser && profileUser.following) {
            // Load all users that the profile user is following
            const followingUsers = await Promise.all(
              profileUser.following.map(async (id) => {
                // Try to get from cache first
                let user: User | undefined = users[id];
                if (!user) {
                  user = await userService.getUser(id) || undefined;
                }
                return user;
              })
            );
            setUserList(followingUsers.filter((u): u is User => u !== undefined && u !== null));
          } else {
            setUserList([]);
          }
        } else {
          // For followers, query Firestore for all users who follow this userId
          try {
            const q = query(
              collection(db, 'users'),
              where('following', 'array-contains', userId)
            );
            const snapshot = await getDocs(q);
            const followers = snapshot.docs.map(userFromFirestoreDoc);
            setUserList(followers);
          } catch (error) {
            console.error('Error querying followers from Firestore:', error);
            // Fallback to cached users
            const allUsers = Object.values(users);
            const followers = allUsers.filter(
              (user) => user.following && user.following.includes(userId)
            );
            setUserList(followers);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${mode}:`, error);
        setUserList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [visible, userId, mode, users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return userList;

    const query = searchQuery.toLowerCase();
    return userList.filter((user) => {
      const name = (user.displayName || user.name || '').toLowerCase();
      const handle = (user.userId || user.handle || '').toLowerCase();
      return name.includes(query) || handle.includes(query);
    });
  }, [userList, searchQuery]);

  const handleFollow = async (targetUserId: string) => {
    if (isFollowing(targetUserId)) {
      await unfollowUser(targetUserId);
    } else {
      await followUser(targetUserId);
    }
  };

  const handleUserPress = (user: User) => {
    onClose();
    // Navigate to profile - will need to update navigation
    navigation.navigate('ProfileMain', { userId: user.id });
  };

  const getInitials = (user: User): string => {
    const displayName = user.displayName || user.name || '';
    return displayName
      .split(' ')
      .map((part) => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const renderUserItem = ({ item: user }: { item: User }) => {
    const isCurrentUserProfile = currentUser?.id === user.id;
    const following = isFollowing(user.id);
    const displayName = user.displayName || user.name;
    const userHandle = user.userId || user.handle;
    const initials = getInitials(user);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleUserPress(user)}
        activeOpacity={0.7}
      >
        <View style={styles.userContent}>
          {user.profilePictureUrl ? (
            <Image
              source={{ uri: user.profilePictureUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.userHandle} numberOfLines={1}>
              @{userHandle}
            </Text>
          </View>
        </View>
        {!isCurrentUserProfile && currentUser && (
          <TouchableOpacity
            onPress={() => handleFollow(user.id)}
            style={[
              styles.followButton,
              following && styles.followButtonActive,
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.followButtonText,
                following && styles.followButtonTextActive,
              ]}
            >
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {mode === 'following' ? 'Following' : 'Followers'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${mode}...`}
              placeholderTextColor={colors.light.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* User List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.light.accent} />
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? `No ${mode} match your search` : `No ${mode} yet`}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 'auto',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.light.textMuted,
    lineHeight: 24,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  searchInput: {
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.light.textPrimary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.light.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.light.accent,
    fontWeight: '700',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.light.accent,
  },
  followButtonActive: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  followButtonTextActive: {
    color: colors.light.textMuted,
  },
});

export default FollowersFollowingModal;

