// Feedback service for storing user feedback
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
export const feedbackService = {
    /**
     * Submit user feedback
     * @param userId - The ID of the user submitting feedback
     * @param text - The feedback text
     * @returns Promise that resolves when feedback is saved
     */
    async submitFeedback(userId, text) {
        try {
            if (!text || !text.trim()) {
                throw new Error('Feedback text cannot be empty');
            }
            const feedbackData = {
                userId,
                text: text.trim(),
                createdAt: Timestamp.now(),
            };
            await addDoc(collection(db, 'feedback'), feedbackData);
        }
        catch (error) {
            console.error('Error submitting feedback:', error);
            throw error;
        }
    },
};
