import { create } from 'zustand';
import type { User } from '../types';
import { userService } from '../services/userService';
import { useAuthStore } from './useAuthStore';

const USER_CACHE_TTL_MS = 5 * 60 * 1000;

interface UserState {
  users: Record<string, User>; // Cache of users by ID
  userFetchTimestamps: Record<string, number>;
  getUser: (userId: string) => User | undefined;
  loadUser: (userId: string) => Promise<void>;
  addUser: (user: User) => void;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  bookmarkChirp: (chirpId: string) => Promise<void>;
  unbookmarkChirp: (chirpId: string) => Promise<void>;
  isBookmarked: (chirpId: string) => boolean;
  updateInterests: (interests: string[]) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: {},
  userFetchTimestamps: {},

  getUser: (userId: string) => {
    // First check cache
    const cached = get().users[userId];
    if (cached) return cached;

    // Check if current user matches
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id === userId) {
      // Add to cache if not already there
      if (!get().users[userId]) {
        set((state) => ({
          users: { ...state.users, [userId]: currentUser },
          userFetchTimestamps: { ...state.userFetchTimestamps, [userId]: Date.now() },
        }));
      }
      return currentUser;
    }

    return undefined;
  },

  loadUser: async (userId: string) => {
    const { users, userFetchTimestamps } = get();
    const cachedUser = users[userId];
    const lastFetched = userFetchTimestamps[userId];
    
    // Return if cached and fresh
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
      console.error('[useUserStore] Error loading user:', error);
    }
  },

  addUser: (user: User) =>
    set((state) => ({
      users: { ...state.users, [user.id]: user },
      userFetchTimestamps: { ...state.userFetchTimestamps, [user.id]: Date.now() },
    })),

  followUser: async (userId: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    if (!currentUser.following.includes(userId)) {
      const newFollowing = [...currentUser.following, userId];
      const updatedUser = { ...currentUser, following: newFollowing };

      // Optimistic update
      useAuthStore.getState().setUser(updatedUser);
      set((state) => ({
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
        console.error('[useUserStore] Error following user:', error);
        // Revert on error
        useAuthStore.getState().setUser(currentUser);
        set((state) => ({
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
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const newFollowing = currentUser.following.filter((id) => id !== userId);
    const updatedUser = { ...currentUser, following: newFollowing };

    // Optimistic update
    useAuthStore.getState().setUser(updatedUser);
    set((state) => ({
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
      console.error('[useUserStore] Error unfollowing user:', error);
      // Revert on error
      useAuthStore.getState().setUser(currentUser);
      set((state) => ({
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

  isFollowing: (userId: string) => {
    const currentUser = useAuthStore.getState().user;
    return currentUser?.following.includes(userId) ?? false;
  },

  bookmarkChirp: async (chirpId: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const bookmarks = currentUser.bookmarks || [];
    if (!bookmarks.includes(chirpId)) {
      const newBookmarks = [...bookmarks, chirpId];
      const updatedUser = { ...currentUser, bookmarks: newBookmarks };

      // Optimistic update
      useAuthStore.getState().setUser(updatedUser);
      set((state) => ({
        users: {
          ...state.users,
          [currentUser.id]: updatedUser,
        },
        userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
      }));

      // Persist to Firestore
      try {
        await userService.updateBookmarks(currentUser.id, newBookmarks);
      } catch (error) {
        console.error('[useUserStore] Error bookmarking chirp:', error);
        // Revert on error
        useAuthStore.getState().setUser(currentUser);
        set((state) => ({
          users: {
            ...state.users,
            [currentUser.id]: currentUser,
          },
          userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
        }));
      }
    }
  },

  unbookmarkChirp: async (chirpId: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const bookmarks = currentUser.bookmarks || [];
    const newBookmarks = bookmarks.filter((id) => id !== chirpId);
    const updatedUser = { ...currentUser, bookmarks: newBookmarks };

    // Optimistic update
    useAuthStore.getState().setUser(updatedUser);
    set((state) => ({
      users: {
        ...state.users,
        [currentUser.id]: updatedUser,
      },
      userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
    }));

    // Persist to Firestore
    try {
      await userService.updateBookmarks(currentUser.id, newBookmarks);
    } catch (error) {
      console.error('[useUserStore] Error unbookmarking chirp:', error);
      // Revert on error
      useAuthStore.getState().setUser(currentUser);
      set((state) => ({
        users: {
          ...state.users,
          [currentUser.id]: currentUser,
        },
        userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
      }));
    }
  },

  isBookmarked: (chirpId: string) => {
    const currentUser = useAuthStore.getState().user;
    return currentUser?.bookmarks?.includes(chirpId) ?? false;
  },

  updateInterests: async (interests: string[]) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const updatedUser = { ...currentUser, interests };

    // Optimistic update
    useAuthStore.getState().setUser(updatedUser);
    set((state) => ({
      users: {
        ...state.users,
        [currentUser.id]: updatedUser,
      },
      userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
    }));

    // Persist to Firestore
    try {
      await userService.updateUser(currentUser.id, { interests });
    } catch (error) {
      console.error('[useUserStore] Error updating interests:', error);
      // Revert on error
      useAuthStore.getState().setUser(currentUser);
      set((state) => ({
        users: {
          ...state.users,
          [currentUser.id]: currentUser,
        },
        userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
      }));
      throw error;
    }
  },
}));

