import { create } from 'zustand';
import type { User } from '../types';
import { userService } from '../lib/firestore';
import { notificationService } from '../lib/services/notificationService';

interface UserState {
  currentUser: User | null;
  users: Record<string, User>; // Cache of users by ID
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
  isLoading: false,

  setCurrentUser: (user) => {
    set({ currentUser: user });
    if (user) {
      // Add to cache
      set((state) => ({
        users: { ...state.users, [user.id]: user },
      }));
    }
  },

  addUser: (user) =>
    set((state) => ({
      users: { ...state.users, [user.id]: user },
    })),

  getUser: (userId) => get().users[userId],

  loadUser: async (userId: string) => {
    const cached = get().users[userId];
    if (cached) return;

    try {
      const user = await userService.getUser(userId);
      if (user) {
        set((state) => ({
          users: { ...state.users, [userId]: user },
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
      
      // Optimistic update
      set({
        currentUser: {
          ...currentUser,
          following: newFollowing,
        },
      });

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
        set({
          currentUser: {
            ...currentUser,
            following: currentUser.following,
          },
        });
      }
    }
  },

  unfollowUser: async (userId: string) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    const newFollowing = currentUser.following.filter((id) => id !== userId);
    
    // Optimistic update
    set({
      currentUser: {
        ...currentUser,
        following: newFollowing,
      },
    });

    // Persist to Firestore
    try {
      await userService.updateFollowing(currentUser.id, newFollowing);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      // Revert on error
      set({
        currentUser: {
          ...currentUser,
          following: currentUser.following,
        },
      });
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
        // Update cache
        set((state) => ({
          users: {
            ...state.users,
            [currentUser.id]: {
              ...currentUser,
              bookmarks: newBookmarks,
            },
          },
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
      // Update cache
      set((state) => ({
        users: {
          ...state.users,
          [currentUser.id]: {
            ...currentUser,
            bookmarks: newBookmarks,
          },
        },
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
      }));
    }
  },
}));

