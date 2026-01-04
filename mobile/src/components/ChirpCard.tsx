import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AppStackParamList } from '../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Chirp, User } from '../types';
import { colors } from '../theme/colors';
import { useUserStore } from '../stores/useUserStore';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const formatTimeAgo = (date: Date) => {
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
};

const getInitial = (value?: string) =>
  value?.charAt(0)?.toUpperCase() || 'U';

type Props = {
  chirp: Chirp;
};

const ChirpCard: React.FC<Props> = ({ chirp }) => {
  const navigation = useNavigation<NavigationProp>();
  const loadUser = useUserStore((state) => state.loadUser);
  
  // Subscribe to user from store (will update reactively)
  const author = useUserStore((state) => state.users[chirp.authorId]);

  // Load author if not in cache
  useEffect(() => {
    if (!author) {
      loadUser(chirp.authorId);
    }
  }, [chirp.authorId, author, loadUser]);

  const createdAt =
    chirp.createdAt instanceof Date
      ? chirp.createdAt
      : new Date(chirp.createdAt);
  const topicLabel = chirp.topic || 'general';
  
  // Use author info if available, fallback to defaults
  const displayName = author?.name || 'Unknown User';
  const displayHandle = author?.handle || chirp.authorId?.slice(0, 8) || 'unknown';
  const avatarLetter = getInitial(author?.name || author?.handle || chirp.authorId);

  const renderFormattedText = () => {
    const source = chirp.formattedText || chirp.text;
    let output = source;
    output = output.replace(/<br\s*\/?>/gi, '\n');
    output = output.replace(/<a[^>]*data-mention="([^"]+)"[^>]*>.*?<\/a>/gi, '@$1');
    output = output.replace(/<\/?strong>/gi, '');
    output = output.replace(/<\/?em>/gi, '');
    output = output.replace(/<\/?[^>]+>/g, '');
    return output;
  };

  const handleCardPress = () => {
    navigation.navigate('PostDetail', { postId: chirp.id });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handleCardPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {author?.profilePictureUrl ? (
            <Image
              source={{ uri: author.profilePictureUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.author}>{displayName}</Text>
          <Text style={styles.handle}>
            @{displayHandle} · {formatTimeAgo(createdAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.body}>{renderFormattedText()}</Text>

      {chirp.imageUrl ? (
        <Image
          source={{ uri: chirp.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.footer}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>#{topicLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {chirp.scheduledAt && chirp.scheduledAt > new Date() && (
            <Text style={styles.metaText}>Scheduled</Text>
          )}
        <Text style={styles.metaText}>
            {chirp.commentCount ?? 0}{' '}
            {(chirp.commentCount ?? 0) === 1 ? 'comment' : 'comments'}
        </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    marginLeft: 10,
  },
  author: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  handle: {
    fontSize: 13,
    color: colors.light.textMuted,
    marginTop: 2,
  },
  body: {
    fontSize: 15,
    color: colors.light.textSecondary,
    lineHeight: 22,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#f2f2f2',
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  badgeText: {
    color: colors.light.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  metaText: {
    color: colors.light.textMuted,
    fontSize: 13,
  },
});

export default ChirpCard;


