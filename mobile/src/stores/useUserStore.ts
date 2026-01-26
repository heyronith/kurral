import { create } from 'zustand';
import type { User, BookmarkFolder } from '../types';
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
  bookmarkChirp: (chirpId: string, folderId?: string) => Promise<void>;
  unbookmarkChirp: (chirpId: string) => Promise<void>;
  isBookmarked: (chirpId: string) => boolean;
  createBookmarkFolder: (folderName: string) => Promise<string>;
  getBookmarkFolders: () => BookmarkFolder[];
  addBookmarkToFolder: (chirpId: string, folderId: string) => Promise<void>;
  updateInterests: (interests: string[]) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: {},
  userFetchTimestamps: {},

  getUser: (userId: string) => {
    // First check cache
    const cached = get().users[userId];
    if (cached) return cached;

    // Check if current user matches (return without updating cache to avoid setState during render)
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id === userId) {
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

  bookmarkChirp: async (chirpId: string, folderId?: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    // If folderId is provided, use folder system
    if (folderId) {
      const folders = currentUser.bookmarkFolders || [];
      const folderIndex = folders.findIndex((f) => f.id === folderId);
      
      if (folderIndex >= 0) {
        const folder = folders[folderIndex];
        if (!folder.chirpIds.includes(chirpId)) {
          const updatedFolders = [...folders];
          updatedFolders[folderIndex] = {
            ...folder,
            chirpIds: [...folder.chirpIds, chirpId],
          };
          const updatedUser = { ...currentUser, bookmarkFolders: updatedFolders };

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
            await userService.updateBookmarkFolders(currentUser.id, updatedFolders);
          } catch (error) {
            console.error('[useUserStore] Error bookmarking chirp to folder:', error);
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
      }
      return;
    }

    // Legacy: fallback to old bookmarks array (for backward compatibility)
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

    // Remove from folders first
    const folders = currentUser.bookmarkFolders || [];
    let updatedFolders = folders.map((folder) => ({
      ...folder,
      chirpIds: folder.chirpIds.filter((id) => id !== chirpId),
    }));

    // Also remove from legacy bookmarks array
    const bookmarks = currentUser.bookmarks || [];
    const newBookmarks = bookmarks.filter((id) => id !== chirpId);

    const updatedUser = {
      ...currentUser,
      bookmarkFolders: updatedFolders,
      bookmarks: newBookmarks,
    };

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
      await userService.updateBookmarkFolders(currentUser.id, updatedFolders);
      if (newBookmarks.length !== bookmarks.length) {
        await userService.updateBookmarks(currentUser.id, newBookmarks);
      }
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
    if (!currentUser) return false;
    
    // Check in folders first
    const folders = currentUser.bookmarkFolders || [];
    const inFolder = folders.some((folder) => folder.chirpIds.includes(chirpId));
    if (inFolder) return true;
    
    // Fallback to legacy bookmarks array
    return currentUser.bookmarks?.includes(chirpId) ?? false;
  },

  createBookmarkFolder: async (folderName: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) throw new Error('User not logged in');

    const folders = currentUser.bookmarkFolders || [];
    const newFolder: BookmarkFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: folderName,
      chirpIds: [],
      createdAt: new Date(),
    };

    const updatedFolders = [...folders, newFolder];
    const updatedUser = { ...currentUser, bookmarkFolders: updatedFolders };

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
      await userService.updateBookmarkFolders(currentUser.id, updatedFolders);
      return newFolder.id;
    } catch (error) {
      console.error('[useUserStore] Error creating bookmark folder:', error);
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

  getBookmarkFolders: () => {
    const currentUser = useAuthStore.getState().user;
    return currentUser?.bookmarkFolders || [];
  },

  addBookmarkToFolder: async (chirpId: string, folderId: string) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    const folders = currentUser.bookmarkFolders || [];
    const folderIndex = folders.findIndex((f) => f.id === folderId);
    
    if (folderIndex >= 0) {
      const folder = folders[folderIndex];
      if (!folder.chirpIds.includes(chirpId)) {
        const updatedFolders = [...folders];
        updatedFolders[folderIndex] = {
          ...folder,
          chirpIds: [...folder.chirpIds, chirpId],
        };
        const updatedUser = { ...currentUser, bookmarkFolders: updatedFolders };

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
          await userService.updateBookmarkFolders(currentUser.id, updatedFolders);
        } catch (error) {
          console.error('[useUserStore] Error adding bookmark to folder:', error);
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
    }
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

