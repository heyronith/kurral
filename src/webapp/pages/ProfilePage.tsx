import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { userService, chirpService } from '../lib/firestore';
import { uploadProfilePicture, uploadCoverPhoto, deleteImage } from '../lib/storage';
import type { User, Chirp } from '../types';
import ChirpCard from '../components/ChirpCard';
import AppLayout from '../components/AppLayout';
import EditProfileModal from '../components/EditProfileModal';

const ProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, getUser, loadUser, followUser, unfollowUser, isFollowing, setCurrentUser, addUser, users } = useUserStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userChirps, setUserChirps] = useState<Chirp[]>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [hoveringProfilePicture, setHoveringProfilePicture] = useState(false);
  const [hoveringCoverPhoto, setHoveringCoverPhoto] = useState(false);
  
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Try to get from cache first
        let user = getUser(userId);
        
        if (!user) {
          // Load from Firestore
          const firestoreUser = await userService.getUser(userId);
          if (firestoreUser) {
            user = firestoreUser;
          }
        }

        if (user) {
          setProfileUser(user);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId, getUser]);

  useEffect(() => {
    const loadContent = async () => {
      if (!profileUser) return;

      try {
        setIsLoadingContent(true);
        const chirps = await chirpService.getChirpsByAuthor(profileUser.id);
        setUserChirps(chirps);
        
        // Load authors for chirps
        const authorIds = new Set(chirps.map(c => c.authorId));
        for (const authorId of authorIds) {
          await loadUser(authorId);
        }

        // Calculate followers count (users who follow this profile user)
        const followers = Object.values(users).filter(user => 
          user.following && user.following.includes(profileUser.id)
        );
        setFollowersCount(followers.length);
      } catch (error) {
        console.error('Error loading content:', error);
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [profileUser, users, loadUser]);

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
    // Update in store cache
    addUser(updatedUser);
    // If it's the current user, update the current user in store
    if (currentUser && updatedUser.id === currentUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileUser || !isOwnProfile) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Profile picture must be less than 2MB');
      return;
    }

    setUploadingProfilePicture(true);
    try {
      // Delete old profile picture if it exists
      if (profileUser.profilePictureUrl) {
        try {
          await deleteImage(profileUser.profilePictureUrl);
        } catch (deleteError) {
          console.warn('Failed to delete old profile picture:', deleteError);
        }
      }

      const downloadURL = await uploadProfilePicture(file, profileUser.id);
      
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
      alert(uploadError.message || 'Failed to upload profile picture');
    } finally {
      setUploadingProfilePicture(false);
      if (profilePictureInputRef.current) {
        profilePictureInputRef.current.value = '';
      }
    }
  };

  const handleCoverPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileUser || !isOwnProfile) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('Cover photo must be less than 3MB');
      return;
    }

    setUploadingCoverPhoto(true);
    try {
      // Delete old cover photo if it exists
      if (profileUser.coverPhotoUrl) {
        try {
          await deleteImage(profileUser.coverPhotoUrl);
        } catch (deleteError) {
          console.warn('Failed to delete old cover photo:', deleteError);
        }
      }

      const downloadURL = await uploadCoverPhoto(file, profileUser.id);
      
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
      alert(uploadError.message || 'Failed to upload cover photo');
    } finally {
      setUploadingCoverPhoto(false);
      if (coverPhotoInputRef.current) {
        coverPhotoInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-textMuted">Loading...</div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-textPrimary mb-2">User not found</h1>
          <Link to="/app" className="text-primary hover:underline">
            Go back to app
          </Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profileUser.id;
  const following = isFollowing(profileUser.id);
  const displayName = profileUser.displayName || profileUser.name;
  const userHandle = profileUser.userId || profileUser.handle;

  const initials = displayName
    .split(' ')
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <AppLayout pageTitle="Profile" wrapContent={true}>
      {/* Profile Header */}
      <div className="border-b border-border">
        {/* Cover Photo */}
        <div 
          className="relative w-full h-48 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30 cursor-pointer group"
          onMouseEnter={() => isOwnProfile && setHoveringCoverPhoto(true)}
          onMouseLeave={() => setHoveringCoverPhoto(false)}
          onClick={() => isOwnProfile && coverPhotoInputRef.current?.click()}
        >
          {profileUser.coverPhotoUrl ? (
            <img
              src={profileUser.coverPhotoUrl}
              alt={`${displayName}'s cover photo`}
              className="w-full h-full object-cover"
            />
          ) : null}
          {isOwnProfile && (
            <>
              <div 
                className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${
                  hoveringCoverPhoto ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="text-white text-sm font-medium">
                  {uploadingCoverPhoto ? 'Uploading...' : 'Change cover photo'}
                </div>
              </div>
              <input
                ref={coverPhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverPhotoChange}
                className="hidden"
                disabled={uploadingCoverPhoto}
              />
            </>
          )}
        </div>

        {/* Profile Content - Compact Layout */}
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex flex-col items-start gap-3 flex-1 min-w-0">
              {/* Profile Picture */}
              <div 
                className="relative cursor-pointer group -mt-16 flex-shrink-0"
                onMouseEnter={() => isOwnProfile && setHoveringProfilePicture(true)}
                onMouseLeave={() => setHoveringProfilePicture(false)}
                onClick={() => isOwnProfile && profilePictureInputRef.current?.click()}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-background border-4 border-background overflow-hidden z-10 relative">
                  {profileUser.profilePictureUrl ? (
                    <img
                      src={profileUser.profilePictureUrl}
                      alt={`${displayName}'s profile picture`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/20 text-2xl font-semibold text-primary">
                      {initials}
                    </div>
                  )}
                  {isOwnProfile && (
                    <div 
                      className={`absolute inset-0 bg-black/60 rounded-full flex items-center justify-center transition-opacity duration-200 ${
                        hoveringProfilePicture ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <div className="text-white text-xs font-medium text-center px-2">
                        {uploadingProfilePicture ? 'Uploading...' : 'Change'}
                      </div>
                    </div>
                  )}
                </div>
                {isOwnProfile && (
                  <input
                    ref={profilePictureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                    disabled={uploadingProfilePicture}
                  />
                )}
              </div>
              
              {/* Name and Handle - Below profile picture */}
              <div className="flex-1 min-w-0 w-full relative z-10 -mt-12 pt-16">
                <h2 className="text-xl font-bold text-textPrimary mb-0.5">{displayName}</h2>
                <p className="text-sm text-textMuted mb-3">@{userHandle}</p>
                
                {/* Stats - Compact inline */}
                <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-textPrimary">{profileUser.following.length}</span>
                    <span className="text-textMuted">Following</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-textPrimary">{followersCount}</span>
                    <span className="text-textMuted">Followers</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-textPrimary">{userChirps.length}</span>
                    <span className="text-textMuted">Posts</span>
                  </div>
                </div>

                {/* Reputation by Domain */}
                {profileUser.reputation && Object.keys(profileUser.reputation).length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-textPrimary mb-2">Reputation by Domain</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(profileUser.reputation)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([domain, score]) => (
                          <div
                            key={domain}
                            className="px-2 py-1 bg-backgroundElevated/60 text-textPrimary rounded border border-border/50 text-xs"
                            title={`${domain}: ${(score * 100).toFixed(0)}`}
                          >
                            <span className="font-medium capitalize">{domain}</span>
                            <span className="ml-1 text-accent">{(score * 100).toFixed(0)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Bio - Compact */}
                {profileUser.bio && (
                  <p className="text-sm text-textPrimary mb-2 whitespace-pre-wrap">{profileUser.bio}</p>
                )}

                {/* Location and URL - Compact */}
                {(profileUser.location || profileUser.url) && (
                  <div className="flex flex-wrap gap-3 text-xs text-textMuted mb-2">
                    {profileUser.location && (
                      <span className="flex items-center gap-1">
                        <span>•</span>
                        <span>{profileUser.location}</span>
                      </span>
                    )}
                    {profileUser.url && (
                      <a
                        href={profileUser.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <span>🔗</span>
                        <span className="truncate max-w-[200px]">{profileUser.url.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Interests - Simplified inline */}
                {profileUser.interests && profileUser.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profileUser.interests.slice(0, 5).map((interest) => (
                      <span
                        key={interest}
                        className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs"
                        title={interest}
                      >
                        {interest}
                      </span>
                    ))}
                    {profileUser.interests.length > 5 && (
                      <span className="px-2 py-0.5 text-xs text-textMuted">
                        +{profileUser.interests.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
              
            {/* Action Button */}
            <div className="flex-shrink-0 pt-2 flex flex-col gap-2">
              {isOwnProfile && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-background/50 border border-border text-textPrimary hover:bg-background/70"
                >
                  Edit Profile
                </button>
              )}
              {!isOwnProfile && currentUser && (
                <button
                  onClick={handleFollow}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    following
                      ? 'bg-background/50 border border-border text-textPrimary hover:bg-background/70'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
              
              {/* Value Stats - Compact Card */}
              {profileUser.valueStats && (
                <div className="px-3 py-2 bg-accent/5 rounded-lg border border-accent/20 text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-textMuted">★</span>
                    <span className="font-semibold text-textPrimary">Value (30d)</span>
                  </div>
                  <div className="flex items-center gap-3 text-textMuted">
                    <span>
                      Posts: <span className="font-semibold text-textPrimary">
                        {(profileUser.valueStats.postValue30d * 100).toFixed(0)}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      Comments: <span className="font-semibold text-textPrimary">
                        {(profileUser.valueStats.commentValue30d * 100).toFixed(0)}
                      </span>
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-accent">
                      Total: {((profileUser.valueStats.postValue30d + profileUser.valueStats.commentValue30d) * 100).toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Posts Content - No tabs */}
      <div className="max-h-[calc(100vh-350px)] overflow-y-auto">
        {isLoadingContent ? (
          <div className="p-8 text-center text-textMuted">Loading...</div>
        ) : userChirps.length > 0 ? (
          userChirps.map((chirp) => (
            <ChirpCard key={chirp.id} chirp={chirp} />
          ))
        ) : (
          <div className="p-8 text-center text-textMuted">
            <p>No posts yet</p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {profileUser && (
        <EditProfileModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={profileUser}
          onUpdate={handleProfileUpdate}
        />
      )}
    </AppLayout>
  );
};

export default ProfilePage;
