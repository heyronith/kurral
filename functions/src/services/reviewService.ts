import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { chirpService } from './firestoreService';
import type { PostReviewContext } from '../types';

const db = admin.firestore();

// Threshold for consensus
const REVIEW_THRESHOLD = 3;

/**
 * Triggered when a new PostReviewContext is created.
 * Checks if enough reviews have been collected to make a decision.
 */
/**
 * Core logic to process a review context.
 * Separated for testing purposes.
 */
export const processReviewContext = async (review: PostReviewContext) => {
    const chirpId = review.chirpId;
    if (!chirpId) {
        console.error('Review context missing chirpId');
        return;
    }

    try {
        // Check current chirp status
        const chirp = await chirpService.getChirp(chirpId);
        if (!chirp) {
            console.error(`Chirp ${chirpId} not found`);
            return;
        }

        // Only act if currently needs_review
        if (chirp.factCheckStatus !== 'needs_review') {
            console.log(`Chirp ${chirpId} status is ${chirp.factCheckStatus}, skipping auto-resolution`);
            return;
        }

        // Fetch all reviews for this chirp
        const reviewsSnap = await db.collection('postReviews')
            .where('chirpId', '==', chirpId)
            // .get(); // Use get() directly if possible, or query
            .get();

        const reviews = reviewsSnap.docs.map(doc => doc.data() as PostReviewContext);

        const validateCount = reviews.filter(r => r.action === 'validate').length;
        const invalidateCount = reviews.filter(r => r.action === 'invalidate').length;

        console.log(`Chirp ${chirpId} reviews: ${validateCount} validate, ${invalidateCount} invalidate`);

        let newStatus: 'clean' | 'blocked' | null = null;
        let reason: string = '';

        if (validateCount >= REVIEW_THRESHOLD) {
            newStatus = 'clean';
            reason = `Verified by community (${validateCount} validations)`;
        } else if (invalidateCount >= REVIEW_THRESHOLD) {
            newStatus = 'blocked';
            reason = `Flagged by community (${invalidateCount} invalidations)`;
        }

        if (newStatus) {
            console.log(`Resolving chirp ${chirpId} to status: ${newStatus}`);

            await chirpService.updateChirpInsights(chirpId, {
                factCheckStatus: newStatus,
                factCheckingStatus: 'completed',
                valueExplanation: reason // Append reason to explanation? Or maybe we shouldn't overwrite?
            });

            // Here we would send a notification to the author
            // console.log(`Notifying author ${chirp.authorId} of resolution`);
        }

    } catch (error) {
        console.error(`Error processing review context for chirp ${chirpId}:`, error);
    }
};

/**
 * Triggered when a new PostReviewContext is created.
 * Checks if enough reviews have been collected to make a decision.
 */
export const onPostReviewContextCreated = functions.firestore.onDocumentCreated(
    'postReviews/{reviewId}',
    async (event) => {
        const snap = event.data;
        if (!snap) {
            console.log('No data associated with the event');
            return;
        }
        const review = snap.data() as PostReviewContext;
        await processReviewContext(review);
    }
);
