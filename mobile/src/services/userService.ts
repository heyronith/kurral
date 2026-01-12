import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  deleteDoc,
  deleteField,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import type { User } from '../types';

const USERS_COLLECTION = 'users';

export const userService = {
  async getUser(id: string): Promise<User | null> {
    const ref = doc(db, USERS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      ...data,
      id: snap.id,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    } as User;
  },

  async createUser(user: User): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, user.id);
    await setDoc(ref, {
      ...user,
      createdAt: user.createdAt ?? new Date(),
    });
  },

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, id);
    await updateDoc(ref, updates as any);
  },

  async updateFollowing(userId: string, followingIds: string[]): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId);
    await updateDoc(ref, { following: followingIds });
  },

  async updateBookmarks(userId: string, bookmarkIds: string[]): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId);
    await updateDoc(ref, { bookmarks: bookmarkIds });
  },

  async updateBookmarkFolders(userId: string, folders: any[]): Promise<void> {
    const ref = doc(db, USERS_COLLECTION, userId);
    await updateDoc(ref, { bookmarkFolders: folders });
  },

  async getUserByHandle(handle: string): Promise<User | null> {
    const normalized = handle.trim().toLowerCase();
    if (!normalized) return null;

    const q = query(
      collection(db, USERS_COLLECTION),
      where('handle', '==', normalized),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data() as any;
    if (data.deleted === true) return null;
    return {
      ...data,
      id: snapshot.docs[0].id,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    } as User;
  },

  async searchUsers(searchQuery: string, limitCount: number = 5): Promise<User[]> {
    const term = searchQuery.trim().toLowerCase();

    // Empty query returns recent users
    if (!term) {
      try {
        const recentQuery = query(
          collection(db, USERS_COLLECTION),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
        const snapshot = await getDocs(recentQuery);
        return snapshot.docs
          .filter((docSnap) => docSnap.data().deleted !== true)
          .map((docSnap) => {
            const data = docSnap.data() as any;
            return {
              ...data,
              id: docSnap.id,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            } as User;
          });
      } catch (error) {
        console.error('[userService] failed to load recent users', error);
        return [];
      }
    }

    try {
      // Primary: handle prefix search (Firestore supports >= and < for prefix)
      const nextTerm = term.slice(0, -1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1);
      const handleQuery = query(
        collection(db, USERS_COLLECTION),
        where('handle', '>=', term),
        where('handle', '<', nextTerm),
        limit(limitCount)
      );

      const snapshot = await getDocs(handleQuery);
      const candidates = snapshot.docs
        .filter((docSnap) => docSnap.data().deleted !== true)
        .map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          } as User;
        });

      // If not enough, fall back to recent users and filter client-side
      if (candidates.length < limitCount) {
        try {
          const recentQuery = query(
            collection(db, USERS_COLLECTION),
            orderBy('createdAt', 'desc'),
            limit(limitCount * 2)
          );
          const recentSnap = await getDocs(recentQuery);
          recentSnap.docs.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data.deleted === true) return;
            const name = `${data.name || ''}`.toLowerCase();
            const handleVal = `${data.handle || ''}`.toLowerCase();
            if (name.includes(term) || handleVal.includes(term)) {
              const user: User = {
                ...data,
                id: docSnap.id,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
              };
              if (!candidates.find((u) => u.id === user.id)) {
                candidates.push(user);
              }
            }
          });
        } catch (fallbackErr) {
          console.warn('[userService] fallback recent search failed', fallbackErr);
        }
      }

      return candidates.slice(0, limitCount);
    } catch (error) {
      console.error('[userService] searchUsers failed', error);
      return [];
    }
  },

  /**
   * Delete user account and all associated data
   * This performs a soft delete (marks account as deleted) and removes all user data
   * Note: Firebase Auth account deletion requires Admin SDK and will be handled separately
   */
  async deleteAccount(userId: string): Promise<{
    chirpsDeleted: number;
    commentsDeleted: number;
    imagesDeleted: number;
    referencesCleaned: number;
    success: boolean;
  }> {
    let chirpsDeleted = 0;
    let commentsDeleted = 0;
    let imagesDeleted = 0;
    let referencesCleaned = 0;
    const deletedChirpIds: string[] = [];

    try {
      // Step 1: Check if user exists and is not already deleted
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      if (userData.deleted === true) {
        throw new Error('User account is already deleted');
      }

      const user = userData as any;

      // Step 2: Collect all chirp IDs and image URLs before deletion
      const imageUrls: string[] = [];

      // Collect profile images
      if (user.profilePictureUrl) imageUrls.push(user.profilePictureUrl);
      if (user.coverPhotoUrl) imageUrls.push(user.coverPhotoUrl);

      // Step 3: Delete all user's chirps (with pagination)
      let lastChirpDoc: any = null;
      let hasMoreChirps = true;

      while (hasMoreChirps) {
        try {
          let chirpsQuery;
          if (lastChirpDoc) {
            chirpsQuery = query(
              collection(db, 'chirps'),
              where('authorId', '==', userId),
              orderBy('createdAt', 'desc'),
              startAfter(lastChirpDoc),
              limit(500)
            );
          } else {
            chirpsQuery = query(
              collection(db, 'chirps'),
              where('authorId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(500)
            );
          }

          const chirpsSnapshot = await getDocs(chirpsQuery);

          if (chirpsSnapshot.empty) {
            hasMoreChirps = false;
            break;
          }

          // Collect chirp IDs and image URLs
          chirpsSnapshot.docs.forEach((docSnap) => {
            deletedChirpIds.push(docSnap.id);
            const data = docSnap.data();
            if (data.imageUrl) {
              imageUrls.push(data.imageUrl);
            }
          });

          // Delete chirps in batch
          const batch = writeBatch(db);
          chirpsSnapshot.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();

          chirpsDeleted += chirpsSnapshot.docs.length;
          lastChirpDoc = chirpsSnapshot.docs[chirpsSnapshot.docs.length - 1];

          // If we got less than 500, we're done
          if (chirpsSnapshot.docs.length < 500) {
            hasMoreChirps = false;
          }
        } catch (error: any) {
          // Handle missing index error - try without orderBy
          if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.warn('Index missing for chirps query, trying without orderBy');
            try {
              const fallbackQuery = query(
                collection(db, 'chirps'),
                where('authorId', '==', userId),
                limit(500)
              );
              const fallbackSnapshot = await getDocs(fallbackQuery);

              if (fallbackSnapshot.empty) {
                hasMoreChirps = false;
                break;
              }

              fallbackSnapshot.docs.forEach((docSnap) => {
                deletedChirpIds.push(docSnap.id);
                const data = docSnap.data();
                if (data.imageUrl) {
                  imageUrls.push(data.imageUrl);
                }
              });

              const batch = writeBatch(db);
              fallbackSnapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
              });
              await batch.commit();

              chirpsDeleted += fallbackSnapshot.docs.length;

              if (fallbackSnapshot.docs.length < 500) {
                hasMoreChirps = false;
              } else {
                lastChirpDoc = fallbackSnapshot.docs[fallbackSnapshot.docs.length - 1];
              }
            } catch (fallbackError) {
              console.error('Error in fallback chirp deletion:', fallbackError);
              hasMoreChirps = false;
            }
          } else {
            throw error;
          }
        }
      }

      // Step 4: Delete all user's comments (with pagination)
      let lastCommentDoc: any = null;
      let hasMoreComments = true;

      while (hasMoreComments) {
        try {
          let commentsQuery;
          if (lastCommentDoc) {
            commentsQuery = query(
              collection(db, 'comments'),
              where('authorId', '==', userId),
              orderBy('createdAt', 'desc'),
              startAfter(lastCommentDoc),
              limit(500)
            );
          } else {
            commentsQuery = query(
              collection(db, 'comments'),
              where('authorId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(500)
            );
          }

          const commentsSnapshot = await getDocs(commentsQuery);

          if (commentsSnapshot.empty) {
            hasMoreComments = false;
            break;
          }

          // Collect image URLs from comments
          commentsSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.imageUrl) {
              imageUrls.push(data.imageUrl);
            }
          });

          // Delete comments in batch
          const batch = writeBatch(db);
          commentsSnapshot.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();

          commentsDeleted += commentsSnapshot.docs.length;
          lastCommentDoc = commentsSnapshot.docs[commentsSnapshot.docs.length - 1];

          // If we got less than 500, we're done
          if (commentsSnapshot.docs.length < 500) {
            hasMoreComments = false;
          }
        } catch (error: any) {
          // Handle missing index error - try without orderBy
          if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.warn('Index missing for comments query, trying without orderBy');
            try {
              const fallbackQuery = query(
                collection(db, 'comments'),
                where('authorId', '==', userId),
                limit(500)
              );
              const fallbackSnapshot = await getDocs(fallbackQuery);

              if (fallbackSnapshot.empty) {
                hasMoreComments = false;
                break;
              }

              fallbackSnapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.imageUrl) {
                  imageUrls.push(data.imageUrl);
                }
              });

              const batch = writeBatch(db);
              fallbackSnapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
              });
              await batch.commit();

              commentsDeleted += fallbackSnapshot.docs.length;

              if (fallbackSnapshot.docs.length < 500) {
                hasMoreComments = false;
              } else {
                lastCommentDoc = fallbackSnapshot.docs[fallbackSnapshot.docs.length - 1];
              }
            } catch (fallbackError) {
              console.error('Error in fallback comment deletion:', fallbackError);
              hasMoreComments = false;
            }
          } else {
            throw error;
          }
        }
      }

      // Step 5: Remove user from others' following lists
      try {
        const followersQuery = query(
          collection(db, 'users'),
          where('following', 'array-contains', userId),
          limit(500)
        );
        const followersSnapshot = await getDocs(followersQuery);

        if (!followersSnapshot.empty) {
          const updateBatch = writeBatch(db);
          followersSnapshot.docs.forEach((userDoc) => {
            const userData = userDoc.data();
            const following = userData.following || [];
            const updatedFollowing = following.filter((id: string) => id !== userId);
            if (updatedFollowing.length !== following.length) {
              updateBatch.update(userDoc.ref, { following: updatedFollowing });
              referencesCleaned++;
            }
          });
          if (followersSnapshot.docs.length > 0) {
            await updateBatch.commit();
          }
        }
      } catch (error) {
        console.warn('Failed to clean up following references:', error);
        // Continue even if this fails
      }

      // Step 6: Remove deleted chirp IDs from others' bookmarks
      if (deletedChirpIds.length > 0) {
        try {
          // Process in chunks of 10 (Firestore array-contains-any limit)
          const chunkSize = 10;
          for (let i = 0; i < deletedChirpIds.length; i += chunkSize) {
            const chunk = deletedChirpIds.slice(i, i + chunkSize);

            const bookmarkQuery = query(
              collection(db, 'users'),
              where('bookmarks', 'array-contains-any', chunk),
              limit(500)
            );

            const bookmarkSnapshot = await getDocs(bookmarkQuery);

            if (!bookmarkSnapshot.empty) {
              const updateBatch = writeBatch(db);
              bookmarkSnapshot.docs.forEach((userDoc) => {
                const userData = userDoc.data();
                const bookmarks = userData.bookmarks || [];
                const updatedBookmarks = bookmarks.filter((id: string) => !chunk.includes(id));
                if (updatedBookmarks.length !== bookmarks.length) {
                  updateBatch.update(userDoc.ref, { bookmarks: updatedBookmarks });
                  referencesCleaned++;
                }
              });

              if (bookmarkSnapshot.docs.length > 0) {
                await updateBatch.commit();
              }
            }
          }
        } catch (error: any) {
          if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.warn('Index missing for bookmarks cleanup - this is non-critical, continuing');
          } else {
            console.warn('Failed to clean up bookmarks:', error);
          }
          // Continue even if this fails
        }
      }

      // Step 7: Delete all images from Storage
      if (imageUrls.length > 0) {
        const { deleteImage } = await import('./storageService');
        // Process images in batches of 10
        const imageBatchSize = 10;
        for (let i = 0; i < imageUrls.length; i += imageBatchSize) {
          const batch = imageUrls.slice(i, i + imageBatchSize);
          await Promise.all(
            batch.map(async (imageUrl) => {
              try {
                await deleteImage(imageUrl);
                imagesDeleted++;
              } catch (error) {
                console.warn('Failed to delete image:', imageUrl, error);
              }
            })
          );
        }
      }

      // Step 8: Delete user's notification preferences (subcollection)
      try {
        const prefsRef = doc(db, 'users', userId, 'preferences', 'notifications');
        const prefsDoc = await getDoc(prefsRef);
        if (prefsDoc.exists()) {
          await deleteDoc(prefsRef);
        }
      } catch (error) {
        console.warn('Failed to delete notification preferences:', error);
        // Continue even if this fails
      }

      // Step 9: Delete user's push tokens (subcollection)
      try {
        const pushTokensRef = collection(db, 'users', userId, 'pushTokens');
        const tokensSnapshot = await getDocs(pushTokensRef);
        if (!tokensSnapshot.empty) {
          const deleteBatch = writeBatch(db);
          tokensSnapshot.docs.forEach((tokenDoc) => {
            deleteBatch.delete(tokenDoc.ref);
          });
          await deleteBatch.commit();
        }
      } catch (error) {
        console.warn('Failed to delete push tokens:', error);
        // Continue even if this fails
      }

      // Step 10: Mark account as deleted (soft delete) - This is the final step
      await updateDoc(doc(db, 'users', userId), {
        deleted: true,
        deletedAt: Timestamp.now(),
        // Clear sensitive data but keep ID for reference
        email: deleteField(),
        name: '[Deleted User]',
        handle: `deleted_${userId.slice(0, 8)}`,
        displayName: '[Deleted User]',
        bio: deleteField(),
        url: deleteField(),
        location: deleteField(),
        profilePictureUrl: deleteField(),
        coverPhotoUrl: deleteField(),
        interests: [],
        semanticTopics: [],
        following: [],
        bookmarks: [],
      });

      return {
        chirpsDeleted,
        commentsDeleted,
        imagesDeleted,
        referencesCleaned,
        success: true,
      };
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  },

  async getUsersWithSimilarInterests(
    userInterests: string[],
    excludeUserId: string,
    limitCount: number = 10
  ): Promise<User[]> {
    if (!userInterests || userInterests.length === 0) {
      return [];
    }

    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          } as User;
        })
        .filter((user) => user.id !== excludeUserId && user.interests && user.interests.length > 0);

      const normalizedUserInterests = userInterests.map((i) => i.toLowerCase());
      
      const usersWithSimilarity = allUsers.map((user) => {
        const normalizedOtherInterests = (user.interests || []).map((i) => i.toLowerCase());
        
        const exactMatches: string[] = [];
        const partialMatches: string[] = [];
        
        normalizedUserInterests.forEach((interest) => {
          const exactMatch = normalizedOtherInterests.find((otherInterest) => interest === otherInterest);
          if (exactMatch) {
            exactMatches.push(exactMatch);
          } else {
            const partialMatch = normalizedOtherInterests.find((otherInterest) => 
              interest.includes(otherInterest) || otherInterest.includes(interest)
            );
            if (partialMatch) {
              partialMatches.push(partialMatch);
            }
          }
        });

        const totalMatches = exactMatches.length + partialMatches.length;
        const overlap = [...exactMatches, ...partialMatches];
        const similarity = totalMatches / Math.max(normalizedUserInterests.length, normalizedOtherInterests.length);

        return {
          user,
          similarity,
          overlapCount: totalMatches,
          matchingInterests: overlap,
        };
      });

      usersWithSimilarity.sort((a, b) => {
        if (b.similarity !== a.similarity) {
          return b.similarity - a.similarity;
        }
        return b.overlapCount - a.overlapCount;
      });

      const topMatches = usersWithSimilarity
        .filter((item) => item.similarity > 0)
        .slice(0, limitCount);

      return topMatches.map((item) => {
        const userWithMetadata = item.user as User & {
          _similarityMetadata?: {
            similarity: number;
            overlapCount: number;
            matchingInterests: string[];
          };
        };
        userWithMetadata._similarityMetadata = {
          similarity: item.similarity,
          overlapCount: item.overlapCount,
          matchingInterests: item.matchingInterests,
        };
        return userWithMetadata as User;
      });
    } catch (error) {
      console.error('[userService] Error getting users with similar interests:', error);
      return [];
    }
  },

  async getPopularAccounts(limitCount: number = 5): Promise<User[]> {
    try {
      // Get recent chirps to determine popular accounts
      const recentChirpsQuery = query(
        collection(db, 'chirps'),
        orderBy('createdAt', 'desc'),
        limit(150)
      );
      const chirpsSnapshot = await getDocs(recentChirpsQuery);
      
      const authorStats = new Map<string, { count: number; lastPosted: Date }>();
      
      chirpsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const authorId = data.authorId;
        if (!authorId) return;
        
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const existing = authorStats.get(authorId);
        
        if (!existing) {
          authorStats.set(authorId, { count: 1, lastPosted: createdAt });
        } else {
          existing.count += 1;
          if (createdAt > existing.lastPosted) {
            existing.lastPosted = createdAt;
          }
        }
      });
      
      const sortedAuthorIds = Array.from(authorStats.entries())
        .sort(([, a], [, b]) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.lastPosted.getTime() - a.lastPosted.getTime();
        })
        .map(([authorId]) => authorId)
        .slice(0, limitCount);
      
      if (sortedAuthorIds.length === 0) {
        return [];
      }
      
      const userSnapshots = await Promise.all(
        sortedAuthorIds.map((authorId) => getDoc(doc(db, USERS_COLLECTION, authorId)))
      );
      
      return userSnapshots
        .filter((snap) => snap.exists())
        .map((snap) => {
          const data = snap.data() as any;
          return {
            ...data,
            id: snap.id,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          } as User;
        });
    } catch (error) {
      console.error('[userService] Error fetching popular accounts:', error);
      return [];
    }
  },

  async autoFollowAccounts(userId: string, accountIds: string[]): Promise<User | null> {
    if (accountIds.length === 0) {
      return this.getUser(userId);
    }
    
    try {
      const userSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
      if (!userSnap.exists()) {
        return null;
      }
      
      const currentUserData = userSnap.data() as any;
      const currentFollowing = currentUserData.following || [];
      const currentAutoFollowed = currentUserData.autoFollowedAccounts || [];
      
      const toFollow = Array.from(
        new Set(
          accountIds.filter(
            (id) => id !== userId && !currentFollowing.includes(id)
          )
        )
      );
      
      if (toFollow.length === 0) {
        return {
          ...currentUserData,
          id: userSnap.id,
          createdAt: currentUserData.createdAt?.toDate ? currentUserData.createdAt.toDate() : new Date(),
        } as User;
      }
      
      const newFollowing = Array.from(new Set([...currentFollowing, ...toFollow]));
      const newAutoFollowed = Array.from(new Set([...currentAutoFollowed, ...toFollow]));
      
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        following: newFollowing,
        autoFollowedAccounts: newAutoFollowed,
      });
      
      const refreshed = await getDoc(doc(db, USERS_COLLECTION, userId));
      if (!refreshed.exists()) {
        return {
          ...currentUserData,
          id: userSnap.id,
          createdAt: currentUserData.createdAt?.toDate ? currentUserData.createdAt.toDate() : new Date(),
        } as User;
      }
      
      const refreshedData = refreshed.data() as any;
      return {
        ...refreshedData,
        id: refreshed.id,
        createdAt: refreshedData.createdAt?.toDate ? refreshedData.createdAt.toDate() : new Date(),
      } as User;
    } catch (error) {
      console.error('[userService] Error auto-following accounts:', error);
      return null;
    }
  },
};

