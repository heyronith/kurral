import { create } from 'zustand';
import type { User } from '../types';
import { userService, chirpService } from '../lib/firestore';
import { notificationService } from '../lib/services/notificationService';

const USER_CACHE_TTL_MS = 5 * 60 * 1000;

interface UserState {
  currentUser: User | null;
  users: Record<string, User>; // Cache of users by ID
  userFetchTimestamps: Record<string, number>;
  isLoading: boolean;
  setCurrentUser: (user: User | null) => void;
  addUser: (user: User) => void;
  getUser: (userId: string) => User | undefined;
  loadUser: (userId: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  bookmarkChirp: (chirpId: string) => Promise<void>;
  unbookmarkChirp: (chirpId: string) => Promise<void>;
  isBookmarked: (chirpId: string) => boolean;
  updateInterests: (interests: string[]) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  currentUser: null,
  users: {},
  userFetchTimestamps: {},
  isLoading: false,

  setCurrentUser: (user) => {
    if (!user) {
      set({ currentUser: null });
      return;
    }

      set((state) => ({
      currentUser: user,
        users: { ...state.users, [user.id]: user },
      userFetchTimestamps: { ...state.userFetchTimestamps, [user.id]: Date.now() },
      }));
  },

  addUser: (user) =>
    set((state) => ({
      users: { ...state.users, [user.id]: user },
      userFetchTimestamps: { ...state.userFetchTimestamps, [user.id]: Date.now() },
    })),

  getUser: (userId) => get().users[userId],

  loadUser: async (userId: string) => {
    const { users, userFetchTimestamps } = get();
    const cachedUser = users[userId];
    const lastFetched = userFetchTimestamps[userId];
    if (cachedUser && lastFetched && Date.now() - lastFetched < USER_CACHE_TTL_MS) {
      return;
    }

    try {
      const user = await userService.getUser(userId);
      if (user) {
        set((state) => ({
          users: { ...state.users, [userId]: user },
          userFetchTimestamps: { ...state.userFetchTimestamps, [userId]: Date.now() },
        }));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  },

  followUser: async (userId: string) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    if (!currentUser.following.includes(userId)) {
      const newFollowing = [...currentUser.following, userId];
      const updatedUser = { ...currentUser, following: newFollowing };
      
      // Optimistic update
      set((state) => ({
        currentUser: updatedUser,
        users: {
          ...state.users,
          [updatedUser.id]: updatedUser,
        },
        userFetchTimestamps: {
          ...state.userFetchTimestamps,
          [updatedUser.id]: Date.now(),
        },
      }));

      // Persist to Firestore
      try {
        await userService.updateFollowing(currentUser.id, newFollowing);
        
        // Create follow notification asynchronously
        notificationService.createNotification({
          userId: userId, // The user being followed
          type: 'follow',
          actorId: currentUser.id, // The follower
        }).catch(err => {
          // Silently fail - notification errors shouldn't block follows
          if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
            console.error('Error creating follow notification:', err);
          }
        });
      } catch (error) {
        console.error('Error following user:', error);
        // Revert on error
        set((state) => ({
          currentUser: currentUser,
          users: {
            ...state.users,
            [currentUser.id]: currentUser,
          },
          userFetchTimestamps: {
            ...state.userFetchTimestamps,
            [currentUser.id]: Date.now(),
          },
        }));
      }
    }
  },

  unfollowUser: async (userId: string) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    const newFollowing = currentUser.following.filter((id) => id !== userId);
    const updatedUser = { ...currentUser, following: newFollowing };
    
    // Optimistic update
    set((state) => ({
      currentUser: updatedUser,
      users: {
        ...state.users,
        [updatedUser.id]: updatedUser,
      },
      userFetchTimestamps: {
        ...state.userFetchTimestamps,
        [updatedUser.id]: Date.now(),
      },
    }));

    // Persist to Firestore
    try {
      await userService.updateFollowing(currentUser.id, newFollowing);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      // Revert on error
      set((state) => ({
        currentUser: currentUser,
        users: {
          ...state.users,
          [currentUser.id]: currentUser,
        },
        userFetchTimestamps: {
          ...state.userFetchTimestamps,
          [currentUser.id]: Date.now(),
        },
      }));
    }
  },

  isFollowing: (userId) => {
    const currentUser = get().currentUser;
    return currentUser?.following.includes(userId) ?? false;
  },

  bookmarkChirp: async (chirpId: string) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    const bookmarks = currentUser.bookmarks || [];
    if (!bookmarks.includes(chirpId)) {
      const newBookmarks = [...bookmarks, chirpId];
      
      // Optimistic update
      set({
        currentUser: {
          ...currentUser,
          bookmarks: newBookmarks,
        },
      });

      // Persist to Firestore
      try {
        await userService.updateBookmarks(currentUser.id, newBookmarks);
        // Update bookmark count on chirp (non-blocking)
        chirpService.updateBookmarkCount(chirpId, 1).catch(error => {
          console.error('Error updating bookmark count:', error);
        });
        // Update cache
        set((state) => ({
          users: {
            ...state.users,
            [currentUser.id]: {
              ...currentUser,
              bookmarks: newBookmarks,
            },
          },
          userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
        }));
      } catch (error) {
        console.error('Error bookmarking chirp:', error);
        // Revert on error
        set({
          currentUser: {
            ...currentUser,
            bookmarks: bookmarks,
          },
        });
      }
    }
  },

  unbookmarkChirp: async (chirpId: string) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    const bookmarks = currentUser.bookmarks || [];
    const newBookmarks = bookmarks.filter((id) => id !== chirpId);
    
    // Optimistic update
    set({
      currentUser: {
        ...currentUser,
        bookmarks: newBookmarks,
      },
    });

    // Persist to Firestore
    try {
      await userService.updateBookmarks(currentUser.id, newBookmarks);
      // Update bookmark count on chirp (non-blocking)
      chirpService.updateBookmarkCount(chirpId, -1).catch(error => {
        console.error('Error updating bookmark count:', error);
      });
      // Update cache
      set((state) => ({
        users: {
          ...state.users,
          [currentUser.id]: {
            ...currentUser,
            bookmarks: newBookmarks,
          },
        },
        userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
      }));
    } catch (error) {
      console.error('Error unbookmarking chirp:', error);
      // Revert on error
      set({
        currentUser: {
          ...currentUser,
          bookmarks: bookmarks,
        },
      });
    }
  },

  isBookmarked: (chirpId: string) => {
    const currentUser = get().currentUser;
    return currentUser?.bookmarks?.includes(chirpId) ?? false;
  },

  updateInterests: async (interests) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;

    const normalized = Array.from(
      new Set(
        interests
          .map((interest) => interest.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const previousUser = currentUser;
    const updatedUser: User = {
      ...currentUser,
      interests: normalized,
    };

    set((state) => ({
      currentUser: updatedUser,
      users: {
        ...state.users,
        [currentUser.id]: updatedUser,
      },
      userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
    }));

    try {
      await userService.updateUser(currentUser.id, { interests: normalized });
    } catch (error) {
      console.error('Error updating interests:', error);
      set((state) => ({
        currentUser: previousUser,
        users: {
          ...state.users,
          [previousUser.id]: previousUser,
        },
        userFetchTimestamps: { ...state.userFetchTimestamps, [previousUser.id]: Date.now() },
      }));
    }
  },
}));

