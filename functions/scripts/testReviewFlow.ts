import * as admin from 'firebase-admin';
import { processReviewContext } from '../src/services/reviewService';
import { chirpService } from '../src/services/firestoreService';
import type { PostReviewContext } from '../src/types';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('🧪 Starting Review Flow End-to-End Test\n');

    try {
        // --- SCENARIO 1: VALIDATION FLOW ---
        console.log('--- SCENARIO 1: Validation Flow (Threshold 3) ---');
        const chirpIdValid = `test-chirp-valid-${Date.now()}`;

        // 1. Create Test Chirp
        console.log(`Step 1: Creating test chirp '${chirpIdValid}' with status 'needs_review'`);
        await db.collection('chirps').doc(chirpIdValid).set({
            authorId: 'test-author',
            text: 'This is a test chirp for validation flow.',
            factCheckStatus: 'needs_review',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            commentCount: 0,
            reachMode: 'forAll',
            topic: 'general'
        });

        // 2. Submit Reviews
        for (let i = 1; i <= 3; i++) {
            const reviewId = `review-val-${i}-${chirpIdValid}`;
            const review: PostReviewContext = {
                id: reviewId,
                chirpId: chirpIdValid,
                submittedBy: `user-validator-${i}`,
                action: 'validate',
                sources: ['https://example.com/source'],
                context: `Validation review ${i}`,
                createdAt: new Date()
            };

            console.log(`Step 2.${i}: Submitting 'validate' review...`);

            // Write to Firestore (simulating client action)
            await db.collection('postReviews').doc(reviewId).set({
                ...review,
                createdAt: admin.firestore.Timestamp.fromDate(review.createdAt)
            });

            // Simulate Cloud Function Trigger
            console.log(`   -> Triggering processReviewContext...`);
            await processReviewContext(review);

            // Verify Status
            const updatedChirp = await chirpService.getChirp(chirpIdValid);
            const status = updatedChirp?.factCheckStatus;
            console.log(`   -> Current Chirp Status: '${status}'`);

            if (i < 3) {
                if (status !== 'needs_review') {
                    console.error(`❌ FAILURE: Status changed prematurely to '${status}' at review ${i}`);
                } else {
                    console.log(`   ✅ Status remains 'needs_review' (Threshold not met)`);
                }
            } else {
                if (status === 'clean') {
                    console.log(`✅ SUCCESS: Status updated to 'clean' after 3rd validation.`);
                } else {
                    console.error(`❌ FAILURE: Status is '${status}', expected 'clean'.`);
                }
            }
            // Small delay to ensure consistency
            await delay(500);
        }


        console.log('\n');


        // --- SCENARIO 2: INVALIDATION FLOW ---
        console.log('--- SCENARIO 2: Invalidation Flow (Threshold 3) ---');
        const chirpIdInvalid = `test-chirp-invalid-${Date.now()}`;

        // 1. Create Test Chirp
        console.log(`Step 1: Creating test chirp '${chirpIdInvalid}' with status 'needs_review'`);
        await db.collection('chirps').doc(chirpIdInvalid).set({
            authorId: 'test-author',
            text: 'This is a test chirp for invalidation flow.',
            factCheckStatus: 'needs_review',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            commentCount: 0,
            reachMode: 'forAll',
            topic: 'general'
        });

        // 2. Submit Reviews
        for (let i = 1; i <= 3; i++) {
            const reviewId = `review-inval-${i}-${chirpIdInvalid}`;
            const review: PostReviewContext = {
                id: reviewId,
                chirpId: chirpIdInvalid,
                submittedBy: `user-invalidator-${i}`,
                action: 'invalidate',
                sources: ['https://example.com/debunk'],
                context: `Invalidation review ${i}`,
                createdAt: new Date()
            };

            console.log(`Step 2.${i}: Submitting 'invalidate' review...`);

            // Write to Firestore
            await db.collection('postReviews').doc(reviewId).set({
                ...review,
                createdAt: admin.firestore.Timestamp.fromDate(review.createdAt)
            });

            // Simulate Trigger
            console.log(`   -> Triggering processReviewContext...`);
            await processReviewContext(review);

            // Verify Status
            const updatedChirp = await chirpService.getChirp(chirpIdInvalid);
            const status = updatedChirp?.factCheckStatus;
            console.log(`   -> Current Chirp Status: '${status}'`);

            if (i < 3) {
                if (status !== 'needs_review') {
                    console.error(`❌ FAILURE: Status changed prematurely to '${status}' at review ${i}`);
                } else {
                    console.log(`   ✅ Status remains 'needs_review' (Threshold not met)`);
                }
            } else {
                if (status === 'blocked') {
                    console.log(`✅ SUCCESS: Status updated to 'blocked' after 3rd invalidation.`);
                } else {
                    console.error(`❌ FAILURE: Status is '${status}', expected 'blocked'.`);
                }
            }
            await delay(500);
        }

        console.log('\n🧹 Cleaning up test data...');
        await db.collection('chirps').doc(chirpIdValid).delete();
        await db.collection('chirps').doc(chirpIdInvalid).delete();
        // Skip deleting reviews for brevity, but noted.

        console.log('✅ Test Execution Completed.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test Script Error:', error);
        process.exit(1);
    }
}

runTest();
