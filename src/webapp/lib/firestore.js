// Firestore service layer - abstracts data access
// For MVP, we'll use mock data, but structure allows easy swap to Firestore
import { collection, query, where, orderBy, limit, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, increment, Timestamp, onSnapshot, deleteField, writeBatch, startAfter, } from 'firebase/firestore';
import { db } from './firebase';
import { notificationService } from './services/notificationService';
// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp) => {
    if (timestamp?.toDate) {
        return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    return new Date(timestamp);
};
const chunkArray = (items, chunkSize) => {
    if (chunkSize <= 0) {
        return [items];
    }
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};
const dedupeChirps = (chirps) => {
    const map = new Map();
    chirps.forEach((chirp) => {
        const existing = map.get(chirp.id);
        if (!existing || existing.createdAt < chirp.createdAt) {
            map.set(chirp.id, chirp);
        }
    });
    return Array.from(map.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};
const normalizeNumber = (value, fallback = 0) => {
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    return fallback;
};
const normalizeValueVector = (raw) => {
    if (!raw)
        return undefined;
    const vector = {
        epistemic: normalizeNumber(raw.epistemic),
        insight: normalizeNumber(raw.insight),
        practical: normalizeNumber(raw.practical),
        relational: normalizeNumber(raw.relational),
        effort: normalizeNumber(raw.effort),
    };
    const hasSignal = Object.values(vector).some((num) => num > 0);
    return hasSignal ? vector : undefined;
};
const normalizeClaims = (rawClaims, fallbackDate) => {
    if (!Array.isArray(rawClaims)) {
        return [];
    }
    return rawClaims
        .map((raw, index) => {
        if (!raw || typeof raw.text !== 'string') {
            return null;
        }
        const evidence = Array.isArray(raw.evidence)
            ? raw.evidence
                .filter((item) => item && typeof item.source === 'string' && typeof item.snippet === 'string')
                .map((item) => ({
                source: item.source,
                url: typeof item.url === 'string' ? item.url : undefined,
                snippet: item.snippet,
                quality: normalizeNumber(item.quality, 0.5),
            }))
            : undefined;
        return {
            id: raw.id || `claim-${index}`,
            text: raw.text,
            type: raw.type || 'fact',
            domain: raw.domain || 'general',
            riskLevel: raw.riskLevel || 'low',
            confidence: normalizeNumber(raw.confidence, 0.5),
            extractedAt: raw.extractedAt ? toDate(raw.extractedAt) : fallbackDate,
            evidence,
        };
    })
        .filter((claim) => Boolean(claim));
};
const normalizeFactChecks = (rawFactChecks, fallbackDate) => {
    if (!Array.isArray(rawFactChecks)) {
        return [];
    }
    return rawFactChecks
        .map((raw, index) => {
        if (!raw || typeof raw.claimId !== 'string') {
            return null;
        }
        const evidence = Array.isArray(raw.evidence)
            ? raw.evidence
                .filter((item) => item && typeof item.source === 'string' && typeof item.snippet === 'string')
                .map((item) => ({
                source: item.source,
                url: typeof item.url === 'string' ? item.url : undefined,
                snippet: item.snippet,
                quality: normalizeNumber(item.quality, 0.5),
            }))
            : [];
        return {
            id: raw.id || `fact-check-${index}`,
            claimId: raw.claimId,
            verdict: raw.verdict || 'unknown',
            confidence: normalizeNumber(raw.confidence, 0.5),
            evidence,
            caveats: Array.isArray(raw.caveats) ? raw.caveats.filter((c) => typeof c === 'string') : undefined,
            checkedAt: raw.checkedAt ? toDate(raw.checkedAt) : fallbackDate,
        };
    })
        .filter((factCheck) => Boolean(factCheck));
};
const normalizeValueScore = (raw, fallbackDate) => {
    const vector = normalizeValueVector(raw);
    if (!vector) {
        return undefined;
    }
    const total = normalizeNumber(raw.total, Object.values(vector).reduce((sum, val) => sum + val, 0));
    const confidence = normalizeNumber(raw.confidence, 0.5);
    return {
        ...vector,
        total,
        confidence,
        updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : fallbackDate,
        drivers: Array.isArray(raw.drivers) ? raw.drivers.filter((driver) => typeof driver === 'string') : undefined,
    };
};
const normalizeDiscussionQuality = (raw) => {
    if (!raw)
        return undefined;
    const quality = {
        informativeness: normalizeNumber(raw.informativeness),
        civility: normalizeNumber(raw.civility),
        reasoningDepth: normalizeNumber(raw.reasoningDepth),
        crossPerspective: normalizeNumber(raw.crossPerspective),
        summary: raw.summary || '',
    };
    const hasSignal = Object.values(quality).some((value) => (typeof value === 'number' ? value > 0 : Boolean(value)));
    return hasSignal ? quality : undefined;
};
const normalizeValueContribution = (raw) => {
    const vector = normalizeValueVector(raw);
    if (!vector)
        return undefined;
    const total = normalizeNumber(raw.total, Object.values(vector).reduce((sum, val) => sum + val, 0));
    return {
        ...vector,
        total,
    };
};
const timestampField = (value) => {
    if (!value)
        return undefined;
    return Timestamp.fromDate(value);
};
const serializeClaims = (claims) => {
    if (!claims || claims.length === 0)
        return undefined;
    return claims.map((claim) => ({
        ...claim,
        extractedAt: timestampField(claim.extractedAt),
        evidence: claim.evidence?.map((evidence) => ({
            ...evidence,
        })),
    }));
};
const serializeFactChecks = (factChecks) => {
    if (!factChecks || factChecks.length === 0)
        return undefined;
    return factChecks.map((factCheck) => ({
        ...factCheck,
        checkedAt: timestampField(factCheck.checkedAt),
        evidence: factCheck.evidence?.map((evidence) => ({
            ...evidence,
        })),
    }));
};
const serializeValueScore = (valueScore) => {
    if (!valueScore)
        return undefined;
    const { updatedAt, ...rest } = valueScore;
    return {
        ...rest,
        updatedAt: timestampField(updatedAt),
    };
};
const serializeDiscussionQuality = (quality) => {
    if (!quality)
        return undefined;
    return { ...quality };
};
const serializeValueContribution = (value) => {
    if (!value)
        return undefined;
    return { ...value };
};
// Convert Firestore document to app type
const chirpFromFirestore = (doc) => {
    const data = doc.data();
    const createdAt = toDate(data.createdAt);
    const claims = normalizeClaims(data.claims, createdAt);
    const factChecks = normalizeFactChecks(data.factChecks, createdAt);
    return {
        id: doc.id,
        authorId: data.authorId,
        text: data.text,
        topic: data.topic,
        semanticTopics: data.semanticTopics || [],
        entities: data.entities || [],
        intent: data.intent,
        analyzedAt: data.analyzedAt ? toDate(data.analyzedAt) : undefined,
        reachMode: data.reachMode,
        tunedAudience: data.tunedAudience,
        createdAt: toDate(data.createdAt),
        rechirpOfId: data.rechirpOfId,
        commentCount: data.commentCount || 0,
        countryCode: data.countryCode,
        imageUrl: data.imageUrl,
        scheduledAt: data.scheduledAt ? toDate(data.scheduledAt) : undefined,
        formattedText: data.formattedText,
        claims,
        factChecks,
        factCheckStatus: data.factCheckStatus,
        valueScore: normalizeValueScore(data.valueScore, createdAt),
        valueExplanation: data.valueExplanation,
        discussionQuality: normalizeDiscussionQuality(data.discussionQuality),
    };
};
const commentFromFirestore = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        chirpId: data.chirpId,
        authorId: data.authorId,
        text: data.text,
        createdAt: toDate(data.createdAt),
        parentCommentId: data.parentCommentId || undefined,
        replyToUserId: data.replyToUserId || undefined,
        depth: data.depth !== undefined ? data.depth : undefined,
        replyCount: data.replyCount || 0,
        discussionRole: data.discussionRole,
        valueContribution: normalizeValueContribution(data.valueContribution),
    };
};
const userFromFirestore = (doc) => {
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
                postValue30d: normalizeNumber(data.valueStats.postValue30d),
                commentValue30d: normalizeNumber(data.valueStats.commentValue30d),
                lifetimePostValue: normalizeNumber(data.valueStats.lifetimePostValue),
                lifetimeCommentValue: normalizeNumber(data.valueStats.lifetimeCommentValue),
                lastUpdated: data.valueStats.lastUpdated ? toDate(data.valueStats.lastUpdated) : toDate(data.createdAt),
            }
            : undefined,
    };
};
// Chirp operations
export const chirpService = {
    // Get chirps from followed users, sorted by createdAt DESC
    async getLatestChirps(followingIds, limitCount = 50) {
        if (followingIds.length === 0)
            return [];
        try {
            const constraints = [
                where('authorId', 'in', followingIds),
                orderBy('createdAt', 'desc'),
                limit(limitCount),
            ];
            const q = query(collection(db, 'chirps'), ...constraints);
            const snapshot = await getDocs(q);
            const now = new Date();
            return snapshot.docs
                .map(chirpFromFirestore)
                .filter(chirp => {
                // Filter out scheduled posts that haven't been published yet
                if (chirp.scheduledAt && chirp.scheduledAt > now) {
                    return false;
                }
                return true;
            });
        }
        catch (error) {
            console.error('Error fetching latest chirps:', error);
            return [];
        }
    },
    // Get all recent chirps (for For You feed candidate pool)
    async getRecentChirps(limitCount = 100) {
        try {
            const q = query(collection(db, 'chirps'), orderBy('createdAt', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            const now = new Date();
            return snapshot.docs
                .map(chirpFromFirestore)
                .filter(chirp => {
                // Filter out scheduled posts that haven't been published yet
                if (chirp.scheduledAt && chirp.scheduledAt > now) {
                    return false;
                }
                return true;
            });
        }
        catch (error) {
            console.error('Error fetching recent chirps:', error);
            return [];
        }
    },
    async getChirpsBySemanticTopics(topics, limitPerBatch = 50) {
        const normalizedTopics = Array.from(new Set(topics
            .map((topic) => topic?.trim().toLowerCase())
            .filter((topic) => Boolean(topic))));
        if (normalizedTopics.length === 0) {
            return [];
        }
        const batches = chunkArray(normalizedTopics, 10);
        const now = new Date();
        try {
            const results = await Promise.all(batches.map(async (batch) => {
                const q = query(collection(db, 'chirps'), where('semanticTopics', 'array-contains-any', batch), orderBy('createdAt', 'desc'), limit(limitPerBatch));
                const snapshot = await getDocs(q);
                return snapshot.docs
                    .map(chirpFromFirestore)
                    .filter((chirp) => {
                    if (chirp.scheduledAt && chirp.scheduledAt > now) {
                        return false;
                    }
                    return true;
                });
            }));
            return dedupeChirps(results.flat());
        }
        catch (error) {
            console.error('Error fetching semantic topic chirps:', error);
            return [];
        }
    },
    async getPersonalizedChirps(user, limitCount = 120) {
        const interests = user.interests || [];
        const followingIds = user.following || [];
        // If no personalization data exists, fall back to recent posts
        if (interests.length === 0 && followingIds.length === 0) {
            return this.getRecentChirps(limitCount);
        }
        const interestLimit = Math.max(Math.floor(limitCount * 0.6), 40);
        const followingLimit = Math.max(Math.floor(limitCount * 0.4), 40);
        try {
            const [interestChirps, followingChirps] = await Promise.all([
                interests.length > 0
                    ? this.getChirpsBySemanticTopics(interests, interestLimit)
                    : Promise.resolve([]),
                followingIds.length > 0
                    ? Promise.all(chunkArray(followingIds, 10).map((chunk) => this.getLatestChirps(chunk, Math.ceil(followingLimit / (chunk.length || 1))))).then((chunks) => dedupeChirps(chunks.flat()))
                    : Promise.resolve([]),
            ]);
            const combined = dedupeChirps([...interestChirps, ...followingChirps]);
            return combined.slice(0, limitCount);
        }
        catch (error) {
            console.error('Error fetching personalized chirps:', error);
            return this.getRecentChirps(limitCount);
        }
    },
    // Get chirps by author
    async getChirpsByAuthor(authorId, limitCount = 50) {
        try {
            const q = query(collection(db, 'chirps'), where('authorId', '==', authorId), orderBy('createdAt', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            const now = new Date();
            return snapshot.docs
                .map(chirpFromFirestore)
                .filter(chirp => {
                // Filter out scheduled posts that haven't been published yet
                if (chirp.scheduledAt && chirp.scheduledAt > now) {
                    return false;
                }
                return true;
            });
        }
        catch (error) {
            console.error('Error fetching chirps by author:', error);
            return [];
        }
    },
    // Get a single chirp by ID
    async getChirp(chirpId) {
        try {
            const docSnap = await getDoc(doc(db, 'chirps', chirpId));
            if (!docSnap.exists())
                return null;
            return chirpFromFirestore(docSnap);
        }
        catch (error) {
            console.error('Error fetching chirp:', error);
            return null;
        }
    },
    // Create a new chirp
    async createChirp(chirp) {
        try {
            // Remove undefined fields - Firestore doesn't allow undefined values
            const chirpData = {
                authorId: chirp.authorId,
                text: chirp.text,
                topic: chirp.topic,
                reachMode: chirp.reachMode,
                createdAt: Timestamp.now(),
                commentCount: 0,
            };
            // Only include tunedAudience if it exists and is not undefined
            if (chirp.tunedAudience) {
                chirpData.tunedAudience = chirp.tunedAudience;
            }
            // Only include rechirpOfId if it exists
            if (chirp.rechirpOfId) {
                chirpData.rechirpOfId = chirp.rechirpOfId;
            }
            // Include new optional fields
            if (chirp.imageUrl) {
                chirpData.imageUrl = chirp.imageUrl;
            }
            if (chirp.countryCode) {
                chirpData.countryCode = chirp.countryCode;
            }
            if (chirp.scheduledAt) {
                chirpData.scheduledAt = Timestamp.fromDate(chirp.scheduledAt);
            }
            if (chirp.formattedText) {
                chirpData.formattedText = chirp.formattedText;
            }
            if (chirp.semanticTopics && chirp.semanticTopics.length > 0) {
                chirpData.semanticTopics = chirp.semanticTopics;
            }
            if (chirp.entities && chirp.entities.length > 0) {
                chirpData.entities = chirp.entities;
            }
            if (chirp.intent) {
                chirpData.intent = chirp.intent;
            }
            if (chirp.analyzedAt) {
                chirpData.analyzedAt = Timestamp.fromDate(chirp.analyzedAt);
            }
            if (chirp.claims && chirp.claims.length > 0) {
                chirpData.claims = serializeClaims(chirp.claims);
            }
            if (chirp.factChecks && chirp.factChecks.length > 0) {
                chirpData.factChecks = serializeFactChecks(chirp.factChecks);
            }
            if (chirp.factCheckStatus) {
                chirpData.factCheckStatus = chirp.factCheckStatus;
            }
            if (chirp.valueScore) {
                chirpData.valueScore = serializeValueScore(chirp.valueScore);
            }
            if (chirp.valueExplanation) {
                chirpData.valueExplanation = chirp.valueExplanation;
            }
            if (chirp.discussionQuality) {
                chirpData.discussionQuality = serializeDiscussionQuality(chirp.discussionQuality);
            }
            const docRef = await addDoc(collection(db, 'chirps'), chirpData);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                throw new Error('Failed to create chirp');
            }
            const newChirp = chirpFromFirestore(docSnap);
            // Create notification if this is a rechirp
            if (chirp.rechirpOfId && chirp.authorId) {
                try {
                    const originalChirpDoc = await getDoc(doc(db, 'chirps', chirp.rechirpOfId));
                    const originalChirpData = originalChirpDoc.data();
                    if (originalChirpData && originalChirpData.authorId !== chirp.authorId) {
                        await notificationService.createNotification({
                            userId: originalChirpData.authorId,
                            type: 'rechirp',
                            actorId: chirp.authorId,
                            chirpId: chirp.rechirpOfId, // Original chirp ID
                            metadata: {
                                originalChirpId: chirp.rechirpOfId,
                            },
                        }).catch(err => {
                            // Silently fail - notification errors shouldn't block rechirps
                            if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                                console.error('Error creating rechirp notification:', err);
                            }
                        });
                    }
                }
                catch (notifError) {
                    // Don't let notification errors break rechirp creation
                    if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
                        console.error('Error creating rechirp notification:', notifError);
                    }
                }
            }
            return newChirp;
        }
        catch (error) {
            console.error('Error creating chirp:', error);
            throw error;
        }
    },
    async updateChirpInsights(chirpId, insights) {
        const updates = {};
        if (insights.claims !== undefined && insights.claims !== null) {
            const serialized = serializeClaims(insights.claims);
            if (serialized !== undefined && serialized !== null) {
                updates.claims = serialized;
            }
        }
        if (insights.factChecks !== undefined && insights.factChecks !== null) {
            const serialized = serializeFactChecks(insights.factChecks);
            if (serialized !== undefined && serialized !== null) {
                updates.factChecks = serialized;
            }
        }
        if (insights.factCheckStatus !== undefined && insights.factCheckStatus !== null) {
            updates.factCheckStatus = insights.factCheckStatus;
        }
        if (insights.valueScore !== undefined && insights.valueScore !== null) {
            const serialized = serializeValueScore(insights.valueScore);
            if (serialized !== undefined && serialized !== null) {
                updates.valueScore = serialized;
            }
        }
        if (typeof insights.valueExplanation === 'string' && insights.valueExplanation.trim().length > 0) {
            updates.valueExplanation = insights.valueExplanation;
        }
        if (insights.discussionQuality !== undefined && insights.discussionQuality !== null) {
            const serialized = serializeDiscussionQuality(insights.discussionQuality);
            if (serialized !== undefined && serialized !== null) {
                updates.discussionQuality = serialized;
            }
        }
        // Remove any undefined values from updates (safety check)
        Object.keys(updates).forEach(key => {
            if (updates[key] === undefined) {
                delete updates[key];
            }
        });
        if (Object.keys(updates).length === 0) {
            return;
        }
        await updateDoc(doc(db, 'chirps', chirpId), updates);
    },
    // Delete a chirp and all its comments
    async deleteChirp(chirpId, authorId) {
        try {
            // Verify the chirp exists and user is the author
            const chirpDoc = await getDoc(doc(db, 'chirps', chirpId));
            if (!chirpDoc.exists()) {
                throw new Error('Chirp not found');
            }
            const chirpData = chirpDoc.data();
            if (chirpData.authorId !== authorId) {
                throw new Error('Unauthorized: Only the author can delete this chirp');
            }
            // Get all comments for this chirp (including nested replies)
            const commentsQuery = query(collection(db, 'comments'), where('chirpId', '==', chirpId));
            const commentsSnapshot = await getDocs(commentsQuery);
            // Use batch to delete chirp and all comments atomically
            const batch = writeBatch(db);
            // Delete the chirp
            batch.delete(doc(db, 'chirps', chirpId));
            // Delete all comments
            commentsSnapshot.docs.forEach((commentDoc) => {
                batch.delete(commentDoc.ref);
            });
            await batch.commit();
        }
        catch (error) {
            console.error('Error deleting chirp:', error);
            throw error;
        }
    },
    // Process scheduled posts - checks for posts that should be published now
    // OPTIMIZED: Checks recent posts and processes any that have scheduledAt <= now
    // Note: We check posts created in the last 30 days to catch scheduled posts
    // that might have been created earlier but scheduled for later
    async processScheduledPosts() {
        try {
            const now = new Date();
            // Check posts created in the last 30 days
            // This covers most scheduled posts while still limiting the query scope
            // If a post was scheduled 30+ days ago, it will be checked when we process
            // older posts (or we can expand this window if needed)
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
            const q = query(collection(db, 'chirps'), where('createdAt', '>=', thirtyDaysAgoTimestamp), orderBy('createdAt', 'desc'), limit(200) // Check up to 200 recent posts for scheduled ones
            );
            const snapshot = await getDocs(q);
            // Early exit if no documents
            if (snapshot.empty) {
                return;
            }
            const batch = writeBatch(db);
            let hasUpdates = false;
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.scheduledAt) {
                    const scheduledAt = toDate(data.scheduledAt);
                    // If scheduled time has passed, remove the scheduledAt field to "publish" it
                    if (scheduledAt <= now) {
                        const docRef = doc(db, 'chirps', docSnap.id);
                        batch.update(docRef, {
                            scheduledAt: deleteField(),
                        });
                        hasUpdates = true;
                    }
                }
            });
            if (hasUpdates) {
                await batch.commit();
                console.log('[ScheduledPosts] Processed scheduled posts');
            }
        }
        catch (error) {
            // If query fails (e.g., no index), fall back to checking only when user has scheduled posts
            console.error('Error processing scheduled posts:', error);
        }
    },
};
// User operations
export const userService = {
    async getUser(userId) {
        try {
            const docSnap = await getDoc(doc(db, 'users', userId));
            if (!docSnap.exists())
                return null;
            return userFromFirestore(docSnap);
        }
        catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    },
    async getUserByHandle(handle) {
        try {
            const q = query(collection(db, 'users'), where('handle', '==', handle.toLowerCase()), limit(1));
            const snapshot = await getDocs(q);
            if (snapshot.empty)
                return null;
            return userFromFirestore(snapshot.docs[0]);
        }
        catch (error) {
            console.error('Error fetching user by handle:', error);
            return null;
        }
    },
    async createUser(user, userId) {
        try {
            const userData = {
                ...user,
                createdAt: Timestamp.now(),
                following: user.following || [],
                bookmarks: user.bookmarks || [],
                interests: user.interests || [],
            };
            if (userId) {
                // Create user with specific ID (for Firebase Auth UID)
                await setDoc(doc(db, 'users', userId), userData);
                const docSnap = await getDoc(doc(db, 'users', userId));
                if (!docSnap.exists()) {
                    throw new Error('Failed to create user');
                }
                return userFromFirestore(docSnap);
            }
            else {
                // Create user with auto-generated ID
                const docRef = await addDoc(collection(db, 'users'), userData);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) {
                    throw new Error('Failed to create user');
                }
                return userFromFirestore(docSnap);
            }
        }
        catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },
    async updateUser(userId, updates) {
        try {
            await updateDoc(doc(db, 'users', userId), updates);
        }
        catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    },
    async updateFollowing(userId, followingIds) {
        try {
            await updateDoc(doc(db, 'users', userId), { following: followingIds });
        }
        catch (error) {
            console.error('Error updating following:', error);
            throw error;
        }
    },
    async updateBookmarks(userId, bookmarkIds) {
        try {
            await updateDoc(doc(db, 'users', userId), { bookmarks: bookmarkIds });
        }
        catch (error) {
            console.error('Error updating bookmarks:', error);
            throw error;
        }
    },
    // Get users with similar interests (client-side matching)
    // Note: This works best with a limited set of users (e.g., from store cache)
    // For production, consider adding a Firestore index or separate interest index collection
    async getUsersWithSimilarInterests(userInterests, excludeUserId, limitCount = 10) {
        if (!userInterests || userInterests.length === 0) {
            return [];
        }
        try {
            // Get recent users (limit to 100 for performance)
            // Filter client-side for users with interests (Firestore doesn't support != [] queries)
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            const allUsers = snapshot.docs
                .map(userFromFirestore)
                .filter((user) => user.id !== excludeUserId && user.interests && user.interests.length > 0);
            // Calculate similarity for each user
            const normalizedUserInterests = userInterests.map((i) => i.toLowerCase());
            const usersWithSimilarity = allUsers.map((user) => {
                const normalizedOtherInterests = (user.interests || []).map((i) => i.toLowerCase());
                // Calculate overlap (matching interests) with exact matches
                const exactMatches = [];
                const partialMatches = [];
                normalizedUserInterests.forEach((interest) => {
                    const exactMatch = normalizedOtherInterests.find((otherInterest) => interest === otherInterest);
                    if (exactMatch) {
                        exactMatches.push(exactMatch);
                    }
                    else {
                        // Check for partial matches (substring)
                        const partialMatch = normalizedOtherInterests.find((otherInterest) => interest.includes(otherInterest) || otherInterest.includes(interest));
                        if (partialMatch) {
                            partialMatches.push(partialMatch);
                        }
                    }
                });
                const totalMatches = exactMatches.length + partialMatches.length;
                const overlap = [...exactMatches, ...partialMatches];
                // Similarity score: overlap count / max interests count (Jaccard-like)
                // Weight exact matches higher
                const similarity = totalMatches / Math.max(normalizedUserInterests.length, normalizedOtherInterests.length);
                return {
                    user,
                    similarity,
                    overlapCount: totalMatches,
                    matchingInterests: overlap, // Store matching interests for display
                };
            });
            // Sort by similarity (highest first), then by overlap count
            usersWithSimilarity.sort((a, b) => {
                if (b.similarity !== a.similarity) {
                    return b.similarity - a.similarity;
                }
                return b.overlapCount - a.overlapCount;
            });
            // Return top matches with similarity metadata
            const topMatches = usersWithSimilarity
                .filter((item) => item.similarity > 0) // Only users with at least one matching interest
                .slice(0, limitCount);
            // Attach similarity metadata to user object (for display in UI)
            // Using type assertion since we're adding temporary metadata for UI display
            return topMatches.map((item) => {
                const userWithMetadata = item.user;
                userWithMetadata._similarityMetadata = {
                    similarity: item.similarity,
                    overlapCount: item.overlapCount,
                    matchingInterests: item.matchingInterests,
                };
                return userWithMetadata;
            });
        }
        catch (error) {
            console.error('Error fetching users with similar interests:', error);
            // If query fails (e.g., no index), return empty array
            return [];
        }
    },
};
// Comment operations
export const commentService = {
    async getCommentsForChirp(chirpId) {
        try {
            const q = query(collection(db, 'comments'), where('chirpId', '==', chirpId), orderBy('createdAt', 'asc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(commentFromFirestore);
        }
        catch (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
    },
    async createComment(comment) {
        try {
            // Calculate depth if this is a reply
            let depth = 0;
            if (comment.parentCommentId) {
                // Get parent comment to calculate depth
                const parentDoc = await getDoc(doc(db, 'comments', comment.parentCommentId));
                if (!parentDoc.exists()) {
                    throw new Error('Parent comment not found');
                }
                const parentComment = commentFromFirestore(parentDoc);
                depth = (parentComment.depth || 0) + 1;
                // Limit nesting depth to prevent abuse
                if (depth > 10) {
                    throw new Error('Maximum reply depth exceeded');
                }
            }
            // Build comment data, excluding undefined fields
            const commentData = {
                chirpId: comment.chirpId,
                authorId: comment.authorId,
                text: comment.text,
                depth,
                replyCount: 0,
                createdAt: Timestamp.now(),
            };
            // Only include optional fields if they have values
            if (comment.parentCommentId) {
                commentData.parentCommentId = comment.parentCommentId;
            }
            if (comment.replyToUserId) {
                commentData.replyToUserId = comment.replyToUserId;
            }
            if (comment.discussionRole) {
                commentData.discussionRole = comment.discussionRole;
            }
            if (comment.valueContribution) {
                commentData.valueContribution = serializeValueContribution(comment.valueContribution);
            }
            const docRef = await addDoc(collection(db, 'comments'), commentData);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                throw new Error('Failed to create comment');
            }
            const newComment = commentFromFirestore(docSnap);
            // Use batch for atomic updates
            const batch = writeBatch(db);
            // If this is a top-level comment, increment chirp comment count
            if (!comment.parentCommentId) {
                batch.update(doc(db, 'chirps', comment.chirpId), {
                    commentCount: increment(1),
                });
            }
            // If this is a reply, increment parent comment's reply count
            if (comment.parentCommentId) {
                batch.update(doc(db, 'comments', comment.parentCommentId), {
                    replyCount: increment(1),
                });
            }
            await batch.commit();
            // Create notifications asynchronously (don't block comment creation)
            // Notify post author if this is a top-level comment
            if (!comment.parentCommentId) {
                try {
                    const chirpDoc = await getDoc(doc(db, 'chirps', comment.chirpId));
                    const chirpData = chirpDoc.data();
                    if (chirpData && chirpData.authorId !== comment.authorId) {
                        await notificationService.createNotification({
                            userId: chirpData.authorId,
                            type: 'comment',
                            actorId: comment.authorId,
                            chirpId: comment.chirpId,
                            commentId: newComment.id,
                        }).catch(err => {
                            // Silently fail - notification errors shouldn't block comments
                            if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                                console.error('Error creating comment notification:', err);
                            }
                        });
                    }
                }
                catch (notifError) {
                    // Don't let notification errors break comment creation
                    if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
                        console.error('Error creating comment notification:', notifError);
                    }
                }
            }
            else {
                // This is a reply - notify parent comment author
                try {
                    const parentCommentDoc = await getDoc(doc(db, 'comments', comment.parentCommentId));
                    const parentCommentData = parentCommentDoc.data();
                    if (parentCommentData && parentCommentData.authorId !== comment.authorId) {
                        // Get original chirp for metadata
                        const chirpDoc = await getDoc(doc(db, 'chirps', comment.chirpId));
                        const chirpData = chirpDoc.data();
                        await notificationService.createNotification({
                            userId: parentCommentData.authorId,
                            type: 'reply',
                            actorId: comment.authorId,
                            chirpId: comment.chirpId,
                            commentId: newComment.id,
                            metadata: {
                                parentCommentId: comment.parentCommentId,
                                originalPostAuthorId: chirpData?.authorId,
                            },
                        }).catch(err => {
                            // Silently fail - notification errors shouldn't block replies
                            if (!err.message?.includes('disabled') && !err.message?.includes('muted')) {
                                console.error('Error creating reply notification:', err);
                            }
                        });
                    }
                }
                catch (notifError) {
                    // Don't let notification errors break reply creation
                    if (!notifError.message?.includes('disabled') && !notifError.message?.includes('muted')) {
                        console.error('Error creating reply notification:', notifError);
                    }
                }
            }
            return newComment;
        }
        catch (error) {
            console.error('Error creating comment:', error);
            throw error;
        }
    },
    async getCommentsByAuthor(authorId, limitCount = 50) {
        try {
            const q = query(collection(db, 'comments'), where('authorId', '==', authorId), orderBy('createdAt', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(commentFromFirestore);
        }
        catch (error) {
            console.error('Error fetching comments by author:', error);
            return [];
        }
    },
    async updateCommentAnalytics(commentId, updates) {
        const firestoreUpdates = {};
        if (updates.discussionRole) {
            firestoreUpdates.discussionRole = updates.discussionRole;
        }
        if (updates.valueContribution) {
            firestoreUpdates.valueContribution = serializeValueContribution(updates.valueContribution);
        }
        if (Object.keys(firestoreUpdates).length === 0) {
            return;
        }
        await updateDoc(doc(db, 'comments', commentId), firestoreUpdates);
    },
    // Delete a comment and all its replies
    async deleteComment(commentId, authorId) {
        try {
            // Verify the comment exists and user is the author
            const commentDoc = await getDoc(doc(db, 'comments', commentId));
            if (!commentDoc.exists()) {
                throw new Error('Comment not found');
            }
            const commentData = commentDoc.data();
            if (commentData.authorId !== authorId) {
                throw new Error('Unauthorized: Only the author can delete this comment');
            }
            // Get all replies to this comment (recursively)
            const getAllReplies = async (parentId) => {
                const repliesQuery = query(collection(db, 'comments'), where('parentCommentId', '==', parentId));
                const repliesSnapshot = await getDocs(repliesQuery);
                const replyIds = [];
                for (const replyDoc of repliesSnapshot.docs) {
                    const replyId = replyDoc.id;
                    replyIds.push(replyId);
                    // Recursively get replies to this reply
                    const nestedReplies = await getAllReplies(replyId);
                    replyIds.push(...nestedReplies);
                }
                return replyIds;
            };
            const allReplyIds = await getAllReplies(commentId);
            // Use batch to delete comment and all replies atomically
            const batch = writeBatch(db);
            // Delete the main comment
            batch.delete(doc(db, 'comments', commentId));
            // Delete all replies
            allReplyIds.forEach((replyId) => {
                batch.delete(doc(db, 'comments', replyId));
            });
            // Update parent comment's replyCount if this is a reply
            if (commentData.parentCommentId) {
                const parentCommentDoc = await getDoc(doc(db, 'comments', commentData.parentCommentId));
                if (parentCommentDoc.exists()) {
                    const currentReplyCount = parentCommentDoc.data().replyCount || 0;
                    const newReplyCount = Math.max(0, currentReplyCount - 1);
                    batch.update(doc(db, 'comments', commentData.parentCommentId), {
                        replyCount: newReplyCount,
                    });
                }
            }
            else {
                // This is a top-level comment, decrement chirp's commentCount
                const chirpDoc = await getDoc(doc(db, 'chirps', commentData.chirpId));
                if (chirpDoc.exists()) {
                    const currentCommentCount = chirpDoc.data().commentCount || 0;
                    const newCommentCount = Math.max(0, currentCommentCount - 1);
                    batch.update(doc(db, 'chirps', commentData.chirpId), {
                        commentCount: newCommentCount,
                    });
                }
            }
            await batch.commit();
        }
        catch (error) {
            console.error('Error deleting comment:', error);
            throw error;
        }
    },
};
// Utility function to build comment tree from flat array
export const buildCommentTree = (comments) => {
    // Create a map of all comments by ID for quick lookup
    const commentMap = new Map();
    // Initialize all comments as tree nodes
    comments.forEach(comment => {
        commentMap.set(comment.id, {
            ...comment,
            replies: [],
        });
    });
    // Build the tree structure
    const rootComments = [];
    comments.forEach(comment => {
        const node = commentMap.get(comment.id);
        if (comment.parentCommentId) {
            // This is a reply - add it to parent's replies
            const parent = commentMap.get(comment.parentCommentId);
            if (parent) {
                parent.replies.push(node);
            }
            else {
                // Parent not found (shouldn't happen, but handle gracefully)
                rootComments.push(node);
            }
        }
        else {
            // This is a top-level comment
            rootComments.push(node);
        }
    });
    // Sort replies within each node by createdAt
    const sortReplies = (node) => {
        node.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        node.replies.forEach(sortReplies);
    };
    rootComments.forEach(sortReplies);
    // Sort root comments by createdAt
    rootComments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return rootComments;
};
// Real-time listeners
export const realtimeService = {
    // Subscribe to chirps from followed users
    subscribeToLatestChirps(followingIds, callback) {
        if (followingIds.length === 0) {
            callback([]);
            return () => { }; // Return no-op unsubscribe
        }
        const constraints = [
            where('authorId', 'in', followingIds),
            orderBy('createdAt', 'desc'),
            limit(50),
        ];
        const q = query(collection(db, 'chirps'), ...constraints);
        return onSnapshot(q, (snapshot) => {
            const now = new Date();
            const chirps = snapshot.docs
                .map(chirpFromFirestore)
                .filter(chirp => {
                // Filter out scheduled posts that haven't been published yet
                if (chirp.scheduledAt && chirp.scheduledAt > now) {
                    return false;
                }
                return true;
            });
            callback(chirps);
        }, (error) => {
            console.error('Error in latest chirps subscription:', error);
            callback([]);
        });
    },
    // Subscribe to all recent chirps (for For You feed)
    subscribeToRecentChirps(callback, limitCount = 100) {
        const q = query(collection(db, 'chirps'), orderBy('createdAt', 'desc'), limit(limitCount));
        return onSnapshot(q, (snapshot) => {
            const now = new Date();
            const chirps = snapshot.docs
                .map(chirpFromFirestore)
                .filter(chirp => {
                // Filter out scheduled posts that haven't been published yet
                if (chirp.scheduledAt && chirp.scheduledAt > now) {
                    return false;
                }
                return true;
            });
            callback(chirps);
        }, (error) => {
            console.error('Error in recent chirps subscription:', error);
            callback([]);
        });
    },
    subscribeToSemanticTopics(topics, callback, limitCount = 50) {
        const normalizedTopics = Array.from(new Set(topics
            .map((topic) => topic?.trim().toLowerCase())
            .filter((topic) => Boolean(topic))));
        if (normalizedTopics.length === 0) {
            callback([]);
            return null;
        }
        const batches = chunkArray(normalizedTopics, 10);
        const unsubscribes = [];
        batches.forEach((batch) => {
            const q = query(collection(db, 'chirps'), where('semanticTopics', 'array-contains-any', batch), orderBy('createdAt', 'desc'), limit(limitCount));
            const unsub = onSnapshot(q, (snapshot) => {
                const now = new Date();
                const chirps = snapshot.docs
                    .map(chirpFromFirestore)
                    .filter((chirp) => {
                    if (chirp.scheduledAt && chirp.scheduledAt > now) {
                        return false;
                    }
                    return true;
                });
                callback(chirps);
            }, (error) => {
                console.error('Error in semantic topics subscription:', error);
            });
            unsubscribes.push(unsub);
        });
        return () => {
            unsubscribes.forEach((unsub) => unsub());
        };
    },
    // Subscribe to comments for a chirp
    subscribeToComments(chirpId, callback) {
        const q = query(collection(db, 'comments'), where('chirpId', '==', chirpId), orderBy('createdAt', 'asc'));
        return onSnapshot(q, (snapshot) => {
            const comments = snapshot.docs.map(commentFromFirestore);
            callback(comments);
        }, (error) => {
            console.error('Error in comments subscription:', error);
            callback([]);
        });
    },
    // Subscribe to user updates
    subscribeToUser(userId, callback) {
        return onSnapshot(doc(db, 'users', userId), (docSnap) => {
            if (!docSnap.exists()) {
                callback(null);
                return;
            }
            callback(userFromFirestore(docSnap));
        }, (error) => {
            console.error('Error in user subscription:', error);
            callback(null);
        });
    },
};
// Helper to convert Firestore topic metadata
const topicMetadataFromFirestore = (doc) => {
    const data = doc.data();
    return {
        name: data.name || doc.id,
        postsLast48h: data.postsLast48h || 0,
        postsLast1h: data.postsLast1h || 0,
        postsLast4h: data.postsLast4h || 0,
        totalUsers: data.totalUsers || 0,
        lastEngagementUpdate: data.lastEngagementUpdate ? toDate(data.lastEngagementUpdate) : new Date(0),
        averageVelocity1h: data.averageVelocity1h || 0,
        isTrending: data.isTrending || false,
        lastNewsGeneratedAt: data.lastNewsGeneratedAt ? toDate(data.lastNewsGeneratedAt) : undefined,
    };
};
// Topic operations
export const topicService = {
    // Get topic metadata by name
    async getTopic(topicName) {
        try {
            const docSnap = await getDoc(doc(db, 'topics', topicName));
            if (!docSnap.exists()) {
                // Topic doesn't exist, create it with defaults
                await this.createTopic(topicName);
                const newDocSnap = await getDoc(doc(db, 'topics', topicName));
                if (!newDocSnap.exists())
                    return null;
                return topicMetadataFromFirestore(newDocSnap);
            }
            return topicMetadataFromFirestore(docSnap);
        }
        catch (error) {
            console.error('Error fetching topic:', error);
            return null;
        }
    },
    // Create topic with default values (only if it doesn't exist - prevents duplication/overwrite)
    async createTopic(topicName) {
        try {
            const topicRef = doc(db, 'topics', topicName);
            const topicSnap = await getDoc(topicRef);
            // Only create if it doesn't exist (prevents overwriting existing topic data)
            if (!topicSnap.exists()) {
                await setDoc(topicRef, {
                    name: topicName,
                    postsLast48h: 0,
                    postsLast1h: 0,
                    postsLast4h: 0,
                    totalUsers: 0,
                    lastEngagementUpdate: Timestamp.now(),
                    averageVelocity1h: 0,
                    isTrending: false,
                });
            }
            // If it already exists, silently return (no error, no overwrite)
        }
        catch (error) {
            console.error('Error creating topic:', error);
            // Don't throw - topic creation failure shouldn't break user flows
        }
    },
    // Get top engaged topics
    async getTopEngagedTopics(limitCount = 30) {
        try {
            const q = query(collection(db, 'topics'), orderBy('postsLast48h', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(topicMetadataFromFirestore);
        }
        catch (error) {
            console.error('Error fetching top engaged topics:', error);
            // If index doesn't exist, try without ordering
            try {
                const snapshot = await getDocs(collection(db, 'topics'));
                const topics = snapshot.docs.map(topicMetadataFromFirestore);
                return topics.sort((a, b) => b.postsLast48h - a.postsLast48h).slice(0, limitCount);
            }
            catch (fallbackError) {
                console.error('Error in fallback topic fetch:', fallbackError);
                return [];
            }
        }
    },
    // Get trending topics (with velocity spikes)
    async getTrendingTopics(limitCount = 10) {
        try {
            const q = query(collection(db, 'topics'), where('isTrending', '==', true), orderBy('postsLast1h', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(topicMetadataFromFirestore);
        }
        catch (error) {
            console.error('Error fetching trending topics:', error);
            // Fallback: get all topics and filter/sort manually
            try {
                const snapshot = await getDocs(collection(db, 'topics'));
                const topics = snapshot.docs
                    .map(topicMetadataFromFirestore)
                    .filter(t => t.isTrending)
                    .sort((a, b) => b.postsLast1h - a.postsLast1h)
                    .slice(0, limitCount);
                return topics;
            }
            catch (fallbackError) {
                console.error('Error in fallback trending topics fetch:', fallbackError);
                return [];
            }
        }
    },
    // Mark that AI news was generated for a topic
    async markNewsGenerated(topicName) {
        try {
            await updateDoc(doc(db, 'topics', topicName), {
                lastNewsGeneratedAt: Timestamp.now(),
            });
        }
        catch (error) {
            console.error('Error marking news generated for topic:', error);
        }
    },
    // Get topics for user (top 30 + user's topics)
    async getTopicsForUser(userTopics) {
        try {
            // Get top 30 engaged topics
            const top30 = await this.getTopEngagedTopics(30);
            // Get user's topics (if they exist)
            const userTopicMetadatas = [];
            for (const topicName of userTopics) {
                const topic = await this.getTopic(topicName);
                if (topic) {
                    userTopicMetadatas.push(topic);
                }
            }
            // Combine: top 30 + user's topics (remove duplicates)
            const combined = [...top30];
            const existingNames = new Set(top30.map(t => t.name));
            userTopicMetadatas.forEach(topic => {
                if (!existingNames.has(topic.name)) {
                    combined.push(topic);
                }
            });
            return combined;
        }
        catch (error) {
            console.error('Error fetching topics for user:', error);
            return [];
        }
    },
    // Refresh topic engagement (count posts in last 48 hours, 4 hours, and 1 hour)
    // OPTIMIZED: Uses batching and pagination for better performance
    async refreshTopicEngagement() {
        try {
            const now = Date.now();
            const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
            const fourHoursAgo = now - 4 * 60 * 60 * 1000;
            const oneHourAgo = now - 60 * 60 * 1000;
            const timestamp48h = Timestamp.fromMillis(fortyEightHoursAgo);
            // Count posts per topic for different time windows
            const topicCounts48h = {};
            const topicCounts4h = {};
            const topicCounts1h = {};
            // Process posts in batches to avoid memory issues
            const BATCH_SIZE = 500;
            let lastDoc = null;
            let hasMore = true;
            let totalProcessed = 0;
            while (hasMore) {
                let q;
                try {
                    if (lastDoc) {
                        q = query(collection(db, 'chirps'), where('createdAt', '>=', timestamp48h), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(BATCH_SIZE));
                    }
                    else {
                        q = query(collection(db, 'chirps'), where('createdAt', '>=', timestamp48h), orderBy('createdAt', 'desc'), limit(BATCH_SIZE));
                    }
                }
                catch (error) {
                    // Fallback if index doesn't exist
                    console.warn('Index for createdAt not found, fetching without orderBy:', error);
                    if (lastDoc) {
                        q = query(collection(db, 'chirps'), where('createdAt', '>=', timestamp48h), limit(BATCH_SIZE));
                    }
                    else {
                        q = query(collection(db, 'chirps'), where('createdAt', '>=', timestamp48h), limit(BATCH_SIZE));
                    }
                }
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    hasMore = false;
                    break;
                }
                snapshot.docs.forEach(doc => {
                    try {
                        const chirp = chirpFromFirestore(doc);
                        const topicName = chirp.topic;
                        const postTime = chirp.createdAt.getTime();
                        topicCounts48h[topicName] = (topicCounts48h[topicName] || 0) + 1;
                        if (postTime >= fourHoursAgo) {
                            topicCounts4h[topicName] = (topicCounts4h[topicName] || 0) + 1;
                        }
                        if (postTime >= oneHourAgo) {
                            topicCounts1h[topicName] = (topicCounts1h[topicName] || 0) + 1;
                        }
                    }
                    catch (error) {
                        console.error('Error processing chirp:', error);
                    }
                });
                totalProcessed += snapshot.docs.length;
                lastDoc = snapshot.docs[snapshot.docs.length - 1];
                hasMore = snapshot.docs.length === BATCH_SIZE;
            }
            console.log(`[TopicRefresh] Processed ${totalProcessed} posts for topic engagement`);
            // Update all topics with counts and calculate velocity (batched writes)
            const BATCH_WRITE_SIZE = 500; // Firestore limit
            const topicNames = Object.keys(topicCounts48h);
            const batches = [];
            for (let i = 0; i < topicNames.length; i += BATCH_WRITE_SIZE) {
                batches.push(topicNames.slice(i, i + BATCH_WRITE_SIZE));
            }
            for (const batch of batches) {
                const batchWrite = writeBatch(db);
                for (const topicName of batch) {
                    const topicRef = doc(db, 'topics', topicName);
                    const count48h = topicCounts48h[topicName] || 0;
                    const count4h = topicCounts4h[topicName] || 0;
                    const count1h = topicCounts1h[topicName] || 0;
                    // Calculate average velocity (posts per hour over last 4h)
                    const averageVelocity = count4h / 4;
                    // Detect spike: if current 1h rate is 2x the average
                    const isTrending = averageVelocity > 0 && count1h >= averageVelocity * 2;
                    batchWrite.set(topicRef, {
                        name: topicName,
                        postsLast48h: count48h,
                        postsLast4h: count4h,
                        postsLast1h: count1h,
                        averageVelocity1h: averageVelocity,
                        isTrending: isTrending,
                        lastEngagementUpdate: Timestamp.now(),
                    }, { merge: true });
                }
                await batchWrite.commit();
            }
            // Also update existing topics with 0 posts (they weren't in the query)
            // Process in batches to avoid loading all topics at once
            const allTopicNames = new Set(topicNames);
            let allTopicsLastDoc = null;
            let hasMoreTopics = true;
            while (hasMoreTopics) {
                const topicsQuery = allTopicsLastDoc
                    ? query(collection(db, 'topics'), startAfter(allTopicsLastDoc), limit(BATCH_SIZE))
                    : query(collection(db, 'topics'), limit(BATCH_SIZE));
                const topicsSnapshot = await getDocs(topicsQuery);
                if (topicsSnapshot.empty) {
                    hasMoreTopics = false;
                    break;
                }
                const zeroUpdateBatch = writeBatch(db);
                let hasZeroUpdates = false;
                topicsSnapshot.docs.forEach(docSnap => {
                    const topicName = docSnap.id;
                    if (!allTopicNames.has(topicName)) {
                        const topicRef = doc(db, 'topics', topicName);
                        zeroUpdateBatch.update(topicRef, {
                            postsLast48h: 0,
                            postsLast4h: 0,
                            postsLast1h: 0,
                            averageVelocity1h: 0,
                            isTrending: false,
                            lastEngagementUpdate: Timestamp.now(),
                        });
                        hasZeroUpdates = true;
                    }
                });
                if (hasZeroUpdates) {
                    await zeroUpdateBatch.commit();
                }
                allTopicsLastDoc = topicsSnapshot.docs[topicsSnapshot.docs.length - 1];
                hasMoreTopics = topicsSnapshot.docs.length === BATCH_SIZE;
            }
            console.log(`[TopicRefresh] Completed refresh for ${topicNames.length} topics`);
        }
        catch (error) {
            console.error('Error refreshing topic engagement:', error);
            throw error;
        }
    },
    // Increment topic engagement when chirp is created
    // FIXED: Now properly handles time-windowed metrics by triggering recalculation
    async incrementTopicEngagement(topicName) {
        try {
            const topicRef = doc(db, 'topics', topicName);
            const topicSnap = await getDoc(topicRef);
            const now = Timestamp.now();
            const nowMs = Date.now();
            if (topicSnap.exists()) {
                const data = topicSnap.data();
                const lastUpdate = data.lastEngagementUpdate?.toDate() || new Date(0);
                const hoursSinceUpdate = (nowMs - lastUpdate.getTime()) / (60 * 60 * 1000);
                // If it's been more than 1 hour since last update, we need to recalculate
                // to properly handle time-windowed metrics (decay old posts)
                if (hoursSinceUpdate >= 1) {
                    // Trigger a mini-refresh for this specific topic by querying its recent posts
                    await this.recalculateTopicMetrics(topicName);
                }
                else {
                    // Within the hour, just increment counters
                    // Note: This is approximate but acceptable for real-time updates
                    // Full refresh will correct any drift
                    await updateDoc(topicRef, {
                        postsLast48h: increment(1),
                        postsLast1h: increment(1),
                        postsLast4h: increment(1),
                        lastEngagementUpdate: now,
                    });
                    // Still recalculate velocity to update trending status
                    await this.recalculateVelocity(topicName);
                }
            }
            else {
                // Create topic if it doesn't exist
                await this.createTopic(topicName);
                await updateDoc(doc(db, 'topics', topicName), {
                    postsLast48h: 1,
                    postsLast1h: 1,
                    postsLast4h: 1,
                    lastEngagementUpdate: now,
                });
            }
        }
        catch (error) {
            console.error('Error incrementing topic engagement:', error);
            // Don't throw - engagement update shouldn't break chirp creation
        }
    },
    // Recalculate metrics for a specific topic (used when time windows need updating)
    async recalculateTopicMetrics(topicName) {
        try {
            const now = Date.now();
            const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
            const fourHoursAgo = now - 4 * 60 * 60 * 1000;
            const oneHourAgo = now - 60 * 60 * 1000;
            const timestamp48h = Timestamp.fromMillis(fortyEightHoursAgo);
            // Query posts for this specific topic
            let snapshot;
            try {
                const q = query(collection(db, 'chirps'), where('topic', '==', topicName), where('createdAt', '>=', timestamp48h), orderBy('createdAt', 'desc'));
                snapshot = await getDocs(q);
            }
            catch (error) {
                // Fallback if index doesn't exist
                const q2 = query(collection(db, 'chirps'), where('topic', '==', topicName), where('createdAt', '>=', timestamp48h));
                snapshot = await getDocs(q2);
            }
            let count48h = 0;
            let count4h = 0;
            let count1h = 0;
            snapshot.docs.forEach(doc => {
                try {
                    const chirp = chirpFromFirestore(doc);
                    const postTime = chirp.createdAt.getTime();
                    count48h++;
                    if (postTime >= fourHoursAgo) {
                        count4h++;
                    }
                    if (postTime >= oneHourAgo) {
                        count1h++;
                    }
                }
                catch (error) {
                    console.error('Error processing chirp in recalculateTopicMetrics:', error);
                }
            });
            // Calculate average velocity (posts per hour over last 4h)
            const averageVelocity = count4h / 4;
            // Detect spike: if current 1h rate is 2x the average
            const isTrending = averageVelocity > 0 && count1h >= averageVelocity * 2;
            const topicRef = doc(db, 'topics', topicName);
            await updateDoc(topicRef, {
                postsLast48h: count48h,
                postsLast4h: count4h,
                postsLast1h: count1h,
                averageVelocity1h: averageVelocity,
                isTrending: isTrending,
                lastEngagementUpdate: Timestamp.now(),
            });
        }
        catch (error) {
            console.error('Error recalculating topic metrics:', error);
            // Fallback to simple increment if recalculation fails
            try {
                const topicRef = doc(db, 'topics', topicName);
                await updateDoc(topicRef, {
                    postsLast48h: increment(1),
                    postsLast1h: increment(1),
                    postsLast4h: increment(1),
                    lastEngagementUpdate: Timestamp.now(),
                });
                await this.recalculateVelocity(topicName);
            }
            catch (fallbackError) {
                console.error('Error in fallback increment:', fallbackError);
            }
        }
    },
    // Recalculate velocity and detect spikes
    async recalculateVelocity(topicName) {
        try {
            const topicRef = doc(db, 'topics', topicName);
            const topicSnap = await getDoc(topicRef);
            if (!topicSnap.exists())
                return;
            const data = topicSnap.data();
            const postsLast1h = data.postsLast1h || 0;
            const postsLast4h = data.postsLast4h || 0;
            // Calculate average velocity (posts per hour over last 4h)
            const averageVelocity = postsLast4h / 4;
            // Detect spike: if current 1h rate is 2x the average
            const currentVelocity = postsLast1h;
            const isTrending = averageVelocity > 0 && currentVelocity >= averageVelocity * 2;
            await updateDoc(topicRef, {
                averageVelocity1h: averageVelocity,
                isTrending: isTrending,
            });
        }
        catch (error) {
            console.error('Error recalculating velocity:', error);
        }
    },
    // Increment user count for a topic (when user selects topic in profile)
    async incrementTopicUserCount(topicName) {
        try {
            const topicRef = doc(db, 'topics', topicName);
            const topicSnap = await getDoc(topicRef);
            if (topicSnap.exists()) {
                await updateDoc(topicRef, {
                    totalUsers: increment(1),
                });
            }
            else {
                // Create topic if it doesn't exist with 1 user
                await setDoc(topicRef, {
                    name: topicName,
                    postsLast48h: 0,
                    totalUsers: 1,
                    lastEngagementUpdate: Timestamp.now(),
                });
            }
        }
        catch (error) {
            console.error('Error incrementing topic user count:', error);
            // Don't throw - user count update shouldn't break user update
        }
    },
    // Decrement user count for a topic (when user removes topic from profile)
    async decrementTopicUserCount(topicName) {
        try {
            const topicRef = doc(db, 'topics', topicName);
            const topicSnap = await getDoc(topicRef);
            if (topicSnap.exists()) {
                const currentData = topicSnap.data();
                const currentCount = currentData?.totalUsers || 0;
                // Only decrement if count > 0
                if (currentCount > 0) {
                    await updateDoc(topicRef, {
                        totalUsers: Math.max(0, currentCount - 1),
                    });
                }
            }
        }
        catch (error) {
            console.error('Error decrementing topic user count:', error);
            // Don't throw - user count update shouldn't break user update
        }
    },
};
// Post Review Context operations - for users to add context to posts marked "needs_review"
export const reviewContextService = {
    async createReviewContext(chirpId, submittedBy, action, sources, context) {
        try {
            // Check if user already submitted a review for this chirp
            const existingQuery = query(collection(db, 'postReviews'), where('chirpId', '==', chirpId), where('submittedBy', '==', submittedBy));
            const existingSnapshot = await getDocs(existingQuery);
            if (!existingSnapshot.empty) {
                throw new Error('You have already submitted a review for this post');
            }
            // Create review context
            const reviewData = {
                chirpId,
                submittedBy,
                action,
                sources,
                createdAt: Timestamp.now(),
            };
            if (context && context.trim().length > 0) {
                reviewData.context = context.trim();
            }
            const docRef = await addDoc(collection(db, 'postReviews'), reviewData);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                throw new Error('Failed to create review context');
            }
            // Update chirp's factCheckStatus immediately based on action
            const newStatus = action === 'validate' ? 'clean' : 'blocked';
            try {
                await chirpService.updateChirpInsights(chirpId, {
                    factCheckStatus: newStatus,
                });
                console.log(`[ReviewContextService] Updated chirp ${chirpId} factCheckStatus to ${newStatus} based on ${action}`);
            }
            catch (updateError) {
                console.error('[ReviewContextService] Error updating chirp factCheckStatus:', updateError);
                // Don't throw - review context was created successfully, status update failure is not critical
            }
            return reviewContextFromFirestore(docSnap);
        }
        catch (error) {
            console.error('[ReviewContextService] Error creating review context:', error);
            throw error;
        }
    },
    async getReviewContextsForChirp(chirpId) {
        try {
            const q = query(collection(db, 'postReviews'), where('chirpId', '==', chirpId), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => reviewContextFromFirestore(doc));
        }
        catch (error) {
            console.error('[ReviewContextService] Error getting review contexts:', error);
            return [];
        }
    },
    async hasUserSubmittedContext(chirpId, userId) {
        try {
            const q = query(collection(db, 'postReviews'), where('chirpId', '==', chirpId), where('submittedBy', '==', userId));
            const snapshot = await getDocs(q);
            return !snapshot.empty;
        }
        catch (error) {
            console.error('[ReviewContextService] Error checking if user has submitted context:', error);
            return false;
        }
    },
};
// Convert Firestore document to PostReviewContext type
const reviewContextFromFirestore = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        chirpId: data.chirpId,
        submittedBy: data.submittedBy,
        action: data.action || 'validate', // Default for backwards compatibility
        sources: data.sources || [],
        context: data.context,
        createdAt: toDate(data.createdAt),
    };
};
