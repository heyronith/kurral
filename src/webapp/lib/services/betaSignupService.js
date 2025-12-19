// Beta signup service for storing beta signup submissions
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
export const betaSignupService = {
    /**
     * Submit beta signup form
     * @param name - The name of the person signing up
     * @param email - The email address
     * @param expectedHandle - Optional preferred username/handle
     * @returns Promise that resolves when beta signup is saved
     */
    async submitBetaSignup(name, email, expectedHandle) {
        try {
            if (!name || !name.trim()) {
                throw new Error('Name cannot be empty');
            }
            if (!email || !email.trim()) {
                throw new Error('Email cannot be empty');
            }
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                throw new Error('Please enter a valid email address');
            }
            // Validate name length
            const trimmedName = name.trim();
            if (trimmedName.length > 200) {
                throw new Error('Name must be 200 characters or less');
            }
            // Validate handle if provided
            if (expectedHandle) {
                const trimmedHandle = expectedHandle.trim().toLowerCase();
                if (trimmedHandle.length < 3) {
                    throw new Error('Handle must be at least 3 characters');
                }
                if (trimmedHandle.length > 30) {
                    throw new Error('Handle must be 30 characters or less');
                }
                if (!/^[a-z0-9_]+$/.test(trimmedHandle)) {
                    throw new Error('Handle can only contain letters, numbers, and underscores');
                }
            }
            const signupData = {
                name: trimmedName,
                email: email.trim().toLowerCase(),
                createdAt: Timestamp.now(),
                status: 'pending',
            };
            // Only include optional fields if they have values
            if (expectedHandle && expectedHandle.trim()) {
                signupData.expectedHandle = expectedHandle.trim().toLowerCase();
            }
            await addDoc(collection(db, 'betaSignups'), signupData);
        }
        catch (error) {
            console.error('Error submitting beta signup:', error);
            throw error;
        }
    },
};
