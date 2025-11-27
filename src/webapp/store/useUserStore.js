import { create } from 'zustand';
import { userService } from '../lib/firestore';
import { notificationService } from '../lib/services/notificationService';
const USER_CACHE_TTL_MS = 5 * 60 * 1000;
export const useUserStore = create((set, get) => ({
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
    addUser: (user) => set((state) => ({
        users: { ...state.users, [user.id]: user },
        userFetchTimestamps: { ...state.userFetchTimestamps, [user.id]: Date.now() },
    })),
    getUser: (userId) => get().users[userId],
    loadUser: async (userId) => {
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
        }
        catch (error) {
            console.error('Error loading user:', error);
        }
    },
    followUser: async (userId) => {
        const currentUser = get().currentUser;
        if (!currentUser)
            return;
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
            }
            catch (error) {
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
    unfollowUser: async (userId) => {
        const currentUser = get().currentUser;
        if (!currentUser)
            return;
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
        }
        catch (error) {
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
    bookmarkChirp: async (chirpId) => {
        const currentUser = get().currentUser;
        if (!currentUser)
            return;
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
                    userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
                }));
            }
            catch (error) {
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
    unbookmarkChirp: async (chirpId) => {
        const currentUser = get().currentUser;
        if (!currentUser)
            return;
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
                userFetchTimestamps: { ...state.userFetchTimestamps, [currentUser.id]: Date.now() },
            }));
        }
        catch (error) {
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
    isBookmarked: (chirpId) => {
        const currentUser = get().currentUser;
        return currentUser?.bookmarks?.includes(chirpId) ?? false;
    },
    updateInterests: async (interests) => {
        const currentUser = get().currentUser;
        if (!currentUser)
            return;
        const normalized = Array.from(new Set(interests
            .map((interest) => interest.trim().toLowerCase())
            .filter(Boolean)));
        const previousUser = currentUser;
        const updatedUser = {
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
        }
        catch (error) {
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
