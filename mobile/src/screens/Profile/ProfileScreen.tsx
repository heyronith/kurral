import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { ProfileStackParamList, HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/userService';
import { chirpService } from '../../services/chirpService';
import { storageService } from '../../services/storageService';
import { filterChirpsForViewer } from '../../utils/chirpVisibility';
import ChirpCard from '../../components/ChirpCard';
import FollowersFollowingModal from '../../components/FollowersFollowingModal';
import EditProfileModal from '../../components/EditProfileModal';
import { colors } from '../../theme/colors';
import type { User, Chirp } from '../../types';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList> & NativeStackNavigationProp<HomeStackParamList>;
type RouteProp = {
  key: string;
  name: string;
  params?: { userId?: string };
};

// Kurral Score helpers
const getKurralTier = (score: number): string => {
  if (score >= 88) return 'Excellent';
  if (score >= 77) return 'Good';
  if (score >= 65) return 'Fair';
  if (score >= 53) return 'Poor';
  return 'Very Poor';
};

const getScoreColor = (score: number): string => {
  if (score >= 88) return '#10B981'; // green
  if (score >= 77) return '#3B82F6'; // blue
  if (score >= 65) return '#F59E0B'; // yellow
  if (score >= 53) return '#F97316'; // orange
  return '#EF4444'; // red
};

// Simple kurralScore initialization (can be enhanced later)
const initializeKurralScore = async (userId: string): Promise<void> => {
  const user = await userService.getUser(userId);
  if (!user || user.kurralScore) return;

  // Simple initialization - can be enhanced with full service later
  const valueStats = user.valueStats;
  const totalRollingValue = (valueStats?.postValue30d ?? 0) + (valueStats?.commentValue30d ?? 0);
  
  // Default starting score calculation (simplified)
  const initialScore = Math.min(100, Math.max(0, 50 + Math.floor(totalRollingValue / 10)));
  
  await userService.updateUser(userId, {
    kurralScore: {
      score: initialScore,
      lastUpdated: new Date(),
      components: {
        qualityHistory: 50,
        violationHistory: 0,
        engagementQuality: 40,
        consistency: Math.min(100, Math.floor(totalRollingValue / 5)),
        communityTrust: 100,
      },
      history: [],
    },
  });
};

const ProfileScreen = () => {
  const route = useRoute<RouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { user: currentUser } = useAuthStore();
  const { getUser, loadUser, followUser, unfollowUser, isFollowing, addUser } = useUserStore();

  const userId = route.params?.userId || currentUser?.id;
  const isOwnProfile = currentUser?.id === userId;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userChirps, setUserChirps] = useState<Chirp[]>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [showCoverOverlay, setShowCoverOverlay] = useState(false);
  const [showAvatarOverlay, setShowAvatarOverlay] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        let user: User | null | undefined;

        // Try to get from cache first
        user = getUser(userId);
        
        if (!user) {
          // Load from Firestore
          user = await userService.getUser(userId);
        }

        if (user) {
          // Initialize kurralScore if user doesn't have it yet
          if (!user.kurralScore) {
            try {
              await initializeKurralScore(user.id);
              // Reload user to get updated kurralScore
              const updatedUser = await userService.getUser(user.id);
              if (updatedUser) {
                user = updatedUser;
              }
            } catch (error) {
              console.error('Error initializing kurralScore:', error);
            }
          }
          setProfileUser(user);
          addUser(user);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId, getUser, addUser]);

  useEffect(() => {
    const loadContent = async () => {
      if (!profileUser) return;

      try {
        setIsLoadingContent(true);
        const chirps = await chirpService.getChirpsByAuthor(profileUser.id);
        const allowBlocked = currentUser?.id === profileUser.id;
        const visibleChirps = filterChirpsForViewer(
          chirps,
          currentUser?.id,
          allowBlocked ? { profileOwnerId: profileUser.id } : undefined
        );
        setUserChirps(visibleChirps);
        
        // Load authors for chirps
        const authorIds = new Set(chirps.map(c => c.authorId));
        for (const authorId of authorIds) {
          await loadUser(authorId);
        }

        // Calculate followers count (users who follow this profile user)
        // For now, use the following array length as approximation
        // In production, you'd query Firestore for users who have this userId in their following array
        setFollowersCount(profileUser.following?.length || 0);
      } catch (error) {
        console.error('Error loading content:', error);
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [profileUser, loadUser, currentUser?.id]);

  const handleFollow = async () => {
    if (!profileUser || !currentUser) return;
    
    if (isFollowing(profileUser.id)) {
      await unfollowUser(profileUser.id);
    } else {
      await followUser(profileUser.id);
    }
  };

  const handleProfileUpdate = async (updatedUser: User) => {
    setProfileUser(updatedUser);
    addUser(updatedUser);
  };

  const handleProfilePictureChange = async () => {
    if (!profileUser || !isOwnProfile) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'We need media permissions to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Profile picture must be less than 2MB');
      return;
    }

    setUploadingProfilePicture(true);
    try {
      // Delete old profile picture if it exists
      if (profileUser.profilePictureUrl) {
        try {
          await storageService.deleteImage(profileUser.profilePictureUrl);
        } catch (deleteError) {
          console.warn('Failed to delete old profile picture:', deleteError);
        }
      }

      const downloadURL = await storageService.uploadProfilePicture(asset.uri, profileUser.id);
      
      // Update user in Firestore
      await userService.updateUser(profileUser.id, {
        profilePictureUrl: downloadURL,
      });

      // Reload updated user
      const updatedUser = await userService.getUser(profileUser.id);
      if (updatedUser) {
        handleProfileUpdate(updatedUser);
      }
    } catch (uploadError: any) {
      console.error('Error uploading profile picture:', uploadError);
      Alert.alert('Error', uploadError.message || 'Failed to upload profile picture');
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const handleCoverPhotoChange = async () => {
    if (!profileUser || !isOwnProfile) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'We need media permissions to change your cover photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 3 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Cover photo must be less than 3MB');
      return;
    }

    setUploadingCoverPhoto(true);
    try {
      // Delete old cover photo if it exists
      if (profileUser.coverPhotoUrl) {
        try {
          await storageService.deleteImage(profileUser.coverPhotoUrl);
        } catch (deleteError) {
          console.warn('Failed to delete old cover photo:', deleteError);
        }
      }

      const downloadURL = await storageService.uploadCoverPhoto(asset.uri, profileUser.id);
      
      // Update user in Firestore
      await userService.updateUser(profileUser.id, {
        coverPhotoUrl: downloadURL,
      });

      // Reload updated user
      const updatedUser = await userService.getUser(profileUser.id);
      if (updatedUser) {
        handleProfileUpdate(updatedUser);
      }
    } catch (uploadError: any) {
      console.error('Error uploading cover photo:', uploadError);
      Alert.alert('Error', uploadError.message || 'Failed to upload cover photo');
    } finally {
      setUploadingCoverPhoto(false);
    }
  };


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profileUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>User not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.errorLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const following = isFollowing(profileUser.id);
  const displayName = profileUser.displayName || profileUser.name;
  const userHandle = profileUser.userId || profileUser.handle;
  const kurralScoreValue = profileUser.kurralScore?.score ?? null;
  const accountAgeDays = Math.floor(
    (Date.now() - profileUser.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const meetsScoreThreshold = kurralScoreValue !== null && kurralScoreValue >= 77;
  const meetsAccountAgeThreshold = accountAgeDays >= 30;
  const isMonetizationEligible = meetsScoreThreshold && meetsAccountAgeThreshold;

  const initials = displayName
    .split(' ')
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <TouchableOpacity
          style={styles.coverContainer}
          onPress={isOwnProfile ? handleCoverPhotoChange : undefined}
          onPressIn={() => isOwnProfile && setShowCoverOverlay(true)}
          onPressOut={() => setShowCoverOverlay(false)}
          disabled={!isOwnProfile || uploadingCoverPhoto}
          activeOpacity={1}
        >
          {profileUser.coverPhotoUrl ? (
            <Image
              source={{ uri: profileUser.coverPhotoUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          {isOwnProfile && (showCoverOverlay || uploadingCoverPhoto) && (
            <View style={styles.coverOverlay}>
              {uploadingCoverPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.coverOverlayText}>Change Cover</Text>
              )}
            </View>
          )}
          {/* Kurral Score Bar */}
          {kurralScoreValue !== null && (
            <View style={styles.scoreBarContainer}>
              <View
                style={[
                  styles.scoreBar,
                  { width: `${Math.max(5, kurralScoreValue)}%`, backgroundColor: getScoreColor(kurralScoreValue) },
                ]}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Edit Profile Button (Gear Icon) - Only for own profile */}
        {isOwnProfile && (
          <View style={styles.gearButtonContainer}>
            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => setIsEditModalOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={24} color={colors.light.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Header */}
      <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={isOwnProfile ? handleProfilePictureChange : undefined}
              onPressIn={() => isOwnProfile && setShowAvatarOverlay(true)}
              onPressOut={() => setShowAvatarOverlay(false)}
              disabled={!isOwnProfile || uploadingProfilePicture}
              activeOpacity={1}
            >
              <View style={styles.avatarWrapper}>
                {profileUser.profilePictureUrl ? (
                  <Image
                    source={{ uri: profileUser.profilePictureUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                {isOwnProfile && (showAvatarOverlay || uploadingProfilePicture) && (
                  <View style={styles.avatarOverlay}>
                    {uploadingProfilePicture ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.avatarOverlayText}>Change Photo</Text>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
            {isMonetizationEligible && (
              <View style={styles.verifiedBadge}>
                <View style={styles.verifiedDot} />
              </View>
            )}
      </View>

          {/* Name & Handle */}
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.handle}>@{userHandle}</Text>
      </View>

          {/* Bio */}
          {profileUser.bio && (
            <Text style={styles.bio}>{profileUser.bio}</Text>
          )}

          {/* Context Pills */}
          <View style={styles.pillsContainer}>
            {profileUser.location && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{profileUser.location}</Text>
              </View>
            )}
            {profileUser.url && (
              <TouchableOpacity style={styles.pill}>
                <Text style={styles.pillText}>{profileUser.url.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                Joined {new Date(profileUser.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
        </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => setFollowingModalOpen(true)}
            >
              <Text style={styles.statNumber}>{profileUser.following?.length || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => setFollowersModalOpen(true)}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userChirps.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
      </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {!isOwnProfile && currentUser ? (
              <TouchableOpacity
                style={[styles.followButton, following && styles.followButtonActive]}
                onPress={handleFollow}
              >
                <Text style={[styles.followButtonText, following && styles.followButtonTextActive]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
      </TouchableOpacity>
            ) : null}

            {/* Kurral Score Indicator - Clickable for own profile */}
            {kurralScoreValue !== null && isOwnProfile && (
              <TouchableOpacity
                style={styles.scoreIndicator}
                onPress={() => navigation.navigate('Dashboard' as never)}
                activeOpacity={0.7}
              >
                <View style={[styles.scoreDot, { backgroundColor: getScoreColor(kurralScoreValue) }]} />
                <Text style={styles.scoreText}>{getKurralTier(kurralScoreValue)}</Text>
              </TouchableOpacity>
            )}
            {kurralScoreValue !== null && !isOwnProfile && (
              <View style={styles.scoreIndicator}>
                <View style={[styles.scoreDot, { backgroundColor: getScoreColor(kurralScoreValue) }]} />
                <Text style={styles.scoreText}>{getKurralTier(kurralScoreValue)}</Text>
              </View>
            )}
          </View>

          {/* Interests */}
          {profileUser.interests && profileUser.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              <Text style={styles.interestsTitle}>Interest Signals</Text>
              <View style={styles.interestsList}>
                {profileUser.interests.map((interest) => (
                  <View key={interest} style={styles.interestTag}>
                    <Text style={styles.interestText}>#{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Posts Feed */}
        <View style={styles.postsContainer}>
          <Text style={styles.postsTitle}>Recent Posts</Text>
          
          {isLoadingContent ? (
            <View style={styles.loadingContentContainer}>
              <ActivityIndicator size="small" color={colors.light.accent} />
            </View>
          ) : userChirps.length > 0 ? (
            <View style={styles.chirpsList}>
              {userChirps.map((chirp) => (
                <ChirpCard key={chirp.id} chirp={chirp} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          )}
    </View>
      </ScrollView>

      {/* Modals */}
      {profileUser && (
        <>
          <EditProfileModal
            visible={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            user={profileUser}
            onUpdate={handleProfileUpdate}
          />
          <FollowersFollowingModal
            visible={followersModalOpen}
            onClose={() => setFollowersModalOpen(false)}
            userId={profileUser.id}
            mode="followers"
          />
          <FollowersFollowingModal
            visible={followingModalOpen}
            onClose={() => setFollowingModalOpen(false)}
            userId={profileUser.id}
            mode="following"
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.light.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 12,
  },
  errorLink: {
    color: colors.light.accent,
    fontSize: 14,
  },
  coverContainer: {
    width: '100%',
    height: 200,
    backgroundColor: colors.light.backgroundElevated,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.light.backgroundElevated,
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gearButtonContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  gearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scoreBar: {
    height: '100%',
  },
  header: {
    padding: 16,
    paddingTop: 0,
  },
  avatarContainer: {
    marginTop: -60,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.light.background,
  },
  avatarPlaceholder: {
    backgroundColor: colors.light.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.light.accent,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlayText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.light.background,
  },
  nameContainer: {
    marginBottom: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  handle: {
    fontSize: 16,
    color: colors.light.textMuted,
  },
  bio: {
    fontSize: 15,
    color: colors.light.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.light.backgroundElevated,
  },
  pillText: {
    fontSize: 12,
    color: colors.light.textMuted,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.light.textMuted,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.light.border,
    marginRight: 24,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  followButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.light.accent,
  },
  followButtonActive: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  followButtonTextActive: {
    color: colors.light.textMuted,
  },
  scoreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
  },
  interestsContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  interestsTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.light.textMuted,
    marginBottom: 8,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textSecondary,
  },
  postsContainer: {
    padding: 16,
    paddingTop: 0,
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 16,
  },
  loadingContentContainer: {
    padding: 32,
    alignItems: 'center',
  },
  chirpsList: {
    gap: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderStyle: 'dashed',
    backgroundColor: colors.light.backgroundElevated,
  },
  emptyText: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
});

export default ProfileScreen;
