import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../types';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { userService } from '../lib/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
          score: data.kurralScore.score || 650,
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

interface FollowersFollowingModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  mode: 'followers' | 'following';
}

const FollowersFollowingModal = ({ open, onClose, userId, mode }: FollowersFollowingModalProps) => {
  const { users, loadUser, followUser, unfollowUser, isFollowing, currentUser } = useUserStore();
  const { theme } = useThemeStore();
  const [userList, setUserList] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;

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
  }, [open, userId, mode, users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return userList;

    const query = searchQuery.toLowerCase();
    return userList.filter((user) => {
      const name = (user.displayName || user.name || '').toLowerCase();
      const handle = (user.userId || user.handle || '').toLowerCase();
      return name.includes(query) || handle.includes(query);
    });
  }, [userList, searchQuery]);

  const handleFollow = async (targetUserId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFollowing(targetUserId)) {
      await unfollowUser(targetUserId);
    } else {
      await followUser(targetUserId);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-textPrimary">
            {mode === 'following' ? 'Following' : 'Followers'}
          </h2>
          <button
            onClick={onClose}
            className="text-textMuted hover:text-textPrimary transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <input
            type="text"
            placeholder={`Search ${mode}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-backgroundElevated border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-textMuted">Loading...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-textMuted">
              {searchQuery ? `No ${mode} match your search` : `No ${mode} yet`}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredUsers.map((user) => {
                const isCurrentUserProfile = currentUser?.id === user.id;
                const following = isFollowing(user.id);
                const displayName = user.displayName || user.name;
                const userHandle = user.userId || user.handle;
                const initials = displayName
                  .split(' ')
                  .map((part) => part[0]?.toUpperCase())
                  .join('')
                  .slice(0, 2);

                return (
                  <div
                    key={user.id}
                    className={`p-4 transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        to={`/profile/${user.id}`}
                        onClick={onClose}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        {user.profilePictureUrl ? (
                          <img
                            src={user.profilePictureUrl}
                            alt={displayName}
                            className="w-12 h-12 rounded-full object-cover border border-border/50 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-border/50 flex-shrink-0 text-primary font-semibold">
                            {initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-textPrimary truncate">
                            {displayName}
                          </div>
                          <div className="text-sm text-textMuted truncate">@{userHandle}</div>
                        </div>
                      </Link>
                      {!isCurrentUserProfile && currentUser && (
                        <button
                          onClick={(e) => handleFollow(user.id, e)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                            following
                              ? 'bg-backgroundElevated/80 text-textMuted border border-border/60 hover:bg-backgroundHover'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {following ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersFollowingModal;

