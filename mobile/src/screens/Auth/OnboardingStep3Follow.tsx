import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import { userService } from '../../services/userService';
import { useUserStore } from '../../stores/useUserStore';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import type { User } from '../../types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Step3Follow'>;

const OnboardingStep3Follow = ({ navigation, route }: Props) => {
  const { interests, currentUserId, onComplete } = route.params;
  const { followUser, isFollowing } = useUserStore();
  const [followSuggestions, setFollowSuggestions] = useState<User[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadSuggestions = async () => {
      if (!interests || interests.length === 0 || !currentUserId) {
        setSuggestionsLoading(false);
        return;
      }

      setSuggestionsLoading(true);
      try {
        const results = await userService.getUsersWithSimilarInterests(
          interests,
          currentUserId,
          6
        );
        setFollowSuggestions(results);
      } catch (error) {
        console.error('[OnboardingStep3] Error loading follow suggestions:', error);
        setFollowSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    loadSuggestions();
  }, [interests, currentUserId]);

  const handleFollow = async (userId: string) => {
    try {
      await followUser(userId);
      setFollowingIds((prev) => new Set([...prev, userId]));
    } catch (error) {
      console.error('[OnboardingStep3] Failed to follow user:', error);
    }
  };

  const handleSkip = () => {
    // Complete onboarding without requiring follows (auto-follow will handle minimum)
    onComplete();
  };

  const handleComplete = () => {
    // Complete onboarding
    onComplete();
  };

  const isUserFollowing = (userId: string): boolean => {
    return followingIds.has(userId) || isFollowing(userId);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>Step 3 of 3</Text>
          <Text style={styles.title}>Follow People</Text>
          <Text style={styles.subtitle}>
            Discover people who share your interests
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {suggestionsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.light.accent} />
              <Text style={styles.loadingText}>Loading suggestions...</Text>
            </View>
          ) : followSuggestions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No suggestions available right now. You can continue and follow people later.
              </Text>
            </View>
          ) : (
            <View style={styles.suggestionsContainer}>
              {followSuggestions.map((person) => {
                const following = isUserFollowing(person.id);
                const similarityMeta = (person as any)._similarityMetadata;
                const interestsMatched = similarityMeta?.matchingInterests || [];

                return (
                  <View key={person.id} style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{person.name || person.displayName}</Text>
                        <Text style={styles.userHandle}>@{person.handle}</Text>
                        {interestsMatched.length > 0 && (
                          <View style={styles.matchedInterests}>
                            {interestsMatched.slice(0, 3).map((interest: string, index: number) => (
                              <View key={`${person.id}-${interest}-${index}`} style={styles.interestTag}>
                                <Text style={styles.interestTagText}>{interest}</Text>
                              </View>
                            ))}
                            {interestsMatched.length > 3 && (
                              <Text style={styles.moreInterests}>
                                +{interestsMatched.length - 3} more
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.followButton,
                          following && styles.followButtonFollowing,
                        ]}
                        onPress={() => handleFollow(person.id)}
                      >
                        <Text
                          style={[
                            styles.followButtonText,
                            following && styles.followButtonTextFollowing,
                          ]}
                        >
                          {following ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {person.bio && (
                      <Text style={styles.userBio}>{person.bio}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <PrimaryButton
              title="Complete Setup"
              onPress={handleComplete}
              style={styles.completeButton}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.light.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.light.textMuted,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  suggestionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  userCard: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 16,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  userHandle: {
    fontSize: 14,
    color: colors.light.textMuted,
    marginBottom: 8,
  },
  matchedInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  interestTag: {
    backgroundColor: `${colors.light.accent}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  interestTagText: {
    fontSize: 10,
    color: colors.light.accent,
    fontWeight: '600',
  },
  moreInterests: {
    fontSize: 10,
    color: colors.light.textMuted,
  },
  followButton: {
    backgroundColor: colors.light.accent,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followButtonFollowing: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  followButtonTextFollowing: {
    color: colors.light.textMuted,
  },
  userBio: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: colors.light.textMuted,
    fontWeight: '600',
    fontSize: 16,
  },
  completeButton: {
    marginTop: 0,
  },
});

export default OnboardingStep3Follow;

