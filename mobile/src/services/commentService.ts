import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Comment, FirestoreComment, Claim, FactCheck } from '../types';

const COMMENTS_COLLECTION = 'comments';
const DEFAULT_LIMIT = 200;

const toComment = (
  snapshot: QuerySnapshot['docs'][number] | DocumentSnapshot
): Comment => {
  const data = snapshot.data() as FirestoreComment;

  return {
    ...data,
    id: snapshot.id,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    scheduledAt: data.scheduledAt?.toDate
      ? data.scheduledAt.toDate()
      : undefined,
    factCheckingStartedAt: data.factCheckingStartedAt?.toDate
      ? data.factCheckingStartedAt.toDate()
      : undefined,
  } as Comment;
};

export const commentService = {
  listen(
    chirpId: string,
    onUpdate: (comments: Comment[]) => void,
    onError?: (err: any) => void,
    max: number = DEFAULT_LIMIT
  ): () => void {
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where('chirpId', '==', chirpId),
      orderBy('createdAt', 'asc'),
      limit(max)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        onUpdate(snapshot.docs.map(toComment));
      },
      (err) => {
        console.error('[commentService] listen failed', err, { chirpId });
        onError?.(err);
      }
    );
  },

  async fetch(chirpId: string, max: number = DEFAULT_LIMIT): Promise<Comment[]> {
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where('chirpId', '==', chirpId),
      orderBy('createdAt', 'asc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map(toComment);
  },

  async add(
    chirpId: string,
    data: Omit<Comment, 'id' | 'createdAt'>
  ): Promise<string> {
    const ref = await addDoc(collection(db, COMMENTS_COLLECTION), {
      ...data,
      chirpId,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async remove(id: string): Promise<void> {
    const ref = doc(db, COMMENTS_COLLECTION, id);
    await deleteDoc(ref);
  },

  async getCommentsForChirp(chirpId: string): Promise<Comment[]> {
    return this.fetch(chirpId);
  },

  async updateCommentAnalytics(
    commentId: string,
    updates: {
      discussionRole?: Comment['discussionRole'];
      valueContribution?: any & { total: number };
      claims?: Claim[];
      factChecks?: FactCheck[];
      factCheckStatus?: 'clean' | 'needs_review' | 'blocked';
      factCheckingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
      factCheckingStartedAt?: Date;
    }
  ): Promise<void> {
    const commentRef = doc(db, COMMENTS_COLLECTION, commentId);
    const firestoreUpdates: Record<string, any> = {};
    
    if (updates.discussionRole) {
      firestoreUpdates.discussionRole = updates.discussionRole;
    }
    if (updates.valueContribution) {
      firestoreUpdates.valueContribution = updates.valueContribution;
    }
    if (updates.claims !== undefined) {
      firestoreUpdates.claims = updates.claims.map((claim) => ({
        ...claim,
        extractedAt: updates.claims?.[0]?.extractedAt ? Timestamp.fromDate(updates.claims[0].extractedAt) : undefined,
      }));
    }
    if (updates.factChecks !== undefined) {
      firestoreUpdates.factChecks = updates.factChecks.map((factCheck) => ({
        ...factCheck,
        checkedAt: factCheck.checkedAt ? Timestamp.fromDate(factCheck.checkedAt) : undefined,
      }));
    }
    if (updates.factCheckStatus !== undefined) {
      firestoreUpdates.factCheckStatus = updates.factCheckStatus;
    }
    if (updates.factCheckingStatus !== undefined) {
      firestoreUpdates.factCheckingStatus = updates.factCheckingStatus;
    }
    if (updates.factCheckingStartedAt !== undefined) {
      firestoreUpdates.factCheckingStartedAt = updates.factCheckingStartedAt 
        ? Timestamp.fromDate(updates.factCheckingStartedAt)
        : null;
    }
    
    await updateDoc(commentRef, firestoreUpdates);
  },
};


