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
} from 'firebase/firestore';
import { db } from '../config/firebase';
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
};

