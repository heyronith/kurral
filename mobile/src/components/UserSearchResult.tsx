import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { HomeStackParamList } from '../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { User } from '../types';
import { colors } from '../theme/colors';
import { useUserStore } from '../stores/useUserStore';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

interface UserSearchResultProps {
  user: User;
}

const getInitial = (value?: string) => value?.charAt(0)?.toUpperCase() || 'U';

const UserSearchResult: React.FC<UserSearchResultProps> = ({ user }) => {
  const navigation = useNavigation<NavigationProp>();
  const currentUser = useUserStore((state) => state.currentUser);
  const followUser = useUserStore((state) => state.followUser);
  const unfollowUser = useUserStore((state) => state.unfollowUser);
  
  const isFollowing = currentUser?.following?.includes(user.id) ?? false;
  const isCurrentUser = currentUser?.id === user.id;

  const handleFollow = async () => {
    if (isFollowing) {
      await unfollowUser(user.id);
    } else {
      await followUser(user.id);
    }
  };

  const handlePress = () => {
    // Navigate to profile - this would need ProfileScreen to accept userId param
    // For now, just show user info
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>{getInitial(user.name || user.displayName)}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {user.displayName || user.name || 'Unknown User'}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{user.handle || user.userId || 'unknown'}
        </Text>
        {user.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}
      </View>
      
      {!isCurrentUser && (
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={handleFollow}
          activeOpacity={0.7}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.light.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  handle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginBottom: 4,
  },
  bio: {
    fontSize: 13,
    color: colors.light.textSecondary,
    lineHeight: 18,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.light.accent,
  },
  followingButton: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: colors.light.textPrimary,
  },
});

export default UserSearchResult;

