// Beta signup service for storing beta signup submissions
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
export const betaSignupService = {
    /**
     * Submit beta signup form
     * @param email - The email address
     * @returns Promise that resolves when beta signup is saved
     */
    async submitBetaSignup(email) {
        try {
            if (!email || !email.trim()) {
                throw new Error('Email cannot be empty');
            }
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                throw new Error('Please enter a valid email address');
            }
            const signupData = {
                email: email.trim().toLowerCase(),
                createdAt: Timestamp.now(),
                status: 'pending',
            };
            await addDoc(collection(db, 'betaSignups'), signupData);
        }
        catch (error) {
            logger.error('Error submitting beta signup:', error);
            throw error;
        }
    },
};
