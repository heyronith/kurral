import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where, } from 'firebase/firestore';
import { db } from '../firebase';
const toDate = (value) => {
    if (!value)
        return new Date();
    if (value?.toDate)
        return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
};
const toValueScore = (raw, fallbackDate) => {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const vector = {
        epistemic: Number(raw.epistemic ?? raw.scores?.epistemic ?? 0),
        insight: Number(raw.insight ?? raw.scores?.insight ?? 0),
        practical: Number(raw.practical ?? raw.scores?.practical ?? 0),
        relational: Number(raw.relational ?? raw.scores?.relational ?? 0),
        effort: Number(raw.effort ?? raw.scores?.effort ?? 0),
    };
    const total = Number(raw.total ?? 0);
    const confidence = Number(raw.confidence ?? 0.5);
    return {
        ...vector,
        total,
        confidence,
        updatedAt: raw.updatedAt ? toDate(raw.updatedAt) : fallbackDate,
        drivers: Array.isArray(raw.drivers)
            ? raw.drivers.filter((driver) => typeof driver === 'string')
            : undefined,
    };
};
const toDiscussionQuality = (raw) => {
    if (!raw || typeof raw !== 'object')
        return undefined;
    return {
        informativeness: Number(raw.informativeness ?? 0),
        reasoningDepth: Number(raw.reasoningDepth ?? 0),
        crossPerspective: Number(raw.crossPerspective ?? 0),
        civility: Number(raw.civility ?? 0),
        summary: raw.summary || '',
    };
};
const mapDocToChirp = (doc) => {
    const data = doc.data();
    const createdAt = toDate(data.createdAt ?? new Date());
    const scheduledAt = data.scheduledAt ? toDate(data.scheduledAt) : undefined;
    return {
        id: doc.id,
        authorId: data.authorId,
        text: data.text || '',
        topic: data.topic,
        semanticTopics: data.semanticTopics || [],
        entities: data.entities || [],
        intent: data.intent,
        analyzedAt: data.analyzedAt ? toDate(data.analyzedAt) : undefined,
        reachMode: data.reachMode,
        tunedAudience: data.tunedAudience,
        createdAt,
        rechirpOfId: data.rechirpOfId,
        commentCount: data.commentCount || 0,
        countryCode: data.countryCode,
        imageUrl: data.imageUrl,
        scheduledAt,
        formattedText: data.formattedText,
        contentEmbedding: data.contentEmbedding,
        valueScore: toValueScore(data.valueScore, createdAt),
        valueExplanation: data.valueExplanation,
        factCheckStatus: data.factCheckStatus,
        factChecks: data.factChecks,
        claims: data.claims,
        discussionQuality: toDiscussionQuality(data.discussionQuality),
    };
};
const getTimeframeStart = (timeframe) => {
    const now = Date.now();
    switch (timeframe) {
        case 'today':
            return new Date(now - 24 * 60 * 60 * 1000);
        case 'week':
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case 'month':
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case 'all':
        default:
            return null;
    }
};
const buildConstraints = (options) => {
    const constraints = [];
    const minValue = options.minValueThreshold ?? 0.5;
    constraints.push(where('valueScore.total', '>=', minValue));
    const timeframe = options.timeframe ?? 'week';
    const startDate = getTimeframeStart(timeframe);
    if (startDate) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)));
    }
    const interests = options.interests?.filter(Boolean) || [];
    if (interests.length > 0) {
        constraints.push(where('semanticTopics', 'array-contains-any', interests.slice(0, 10)));
    }
    constraints.push(orderBy('valueScore.total', 'desc'));
    constraints.push(orderBy('createdAt', 'desc'));
    if (options.startAfterDoc) {
        constraints.push(startAfter(options.startAfterDoc));
    }
    const finalLimit = options.limit ?? 20;
    constraints.push(limit(finalLimit));
    return constraints;
};
const filterVisible = (snapshot) => {
    const now = new Date();
    return snapshot.docs
        .map(mapDocToChirp)
        .filter((chirp) => {
        if (chirp.scheduledAt && chirp.scheduledAt > now) {
            return false;
        }
        return true;
    });
};
export const mostValuedService = {
    async getTopValuedPosts(timeframe = 'week', interests, minValueThreshold = 0.5, limitCount = 5) {
        const constraints = buildConstraints({
            timeframe,
            interests,
            minValueThreshold,
            limit: limitCount,
        });
        const snapshot = await getDocs(query(collection(db, 'chirps'), ...constraints));
        const posts = filterVisible(snapshot);
        const cursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        return { posts, cursor, hasMore: snapshot.docs.length === limitCount };
    },
    async getValuedPosts(options = {}) {
        const constraints = buildConstraints(options);
        const snapshot = await getDocs(query(collection(db, 'chirps'), ...constraints));
        const posts = filterVisible(snapshot);
        const cursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        const hasMore = snapshot.docs.length === (options.limit ?? 20);
        return { posts, cursor, hasMore };
    },
};
