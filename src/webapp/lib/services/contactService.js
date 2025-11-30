// Contact service for storing contact form submissions
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
export const contactService = {
    /**
     * Submit contact form
     * @param name - The name of the person submitting
     * @param email - The email address
     * @param message - The message content
     * @returns Promise that resolves when contact submission is saved
     */
    async submitContact(name, email, message) {
        try {
            if (!name || !name.trim()) {
                throw new Error('Name cannot be empty');
            }
            if (!email || !email.trim()) {
                throw new Error('Email cannot be empty');
            }
            if (!message || !message.trim()) {
                throw new Error('Message cannot be empty');
            }
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                throw new Error('Please enter a valid email address');
            }
            const contactData = {
                name: name.trim(),
                email: email.trim(),
                message: message.trim(),
                createdAt: Timestamp.now(),
            };
            await addDoc(collection(db, 'contactSubmissions'), contactData);
        }
        catch (error) {
            console.error('Error submitting contact form:', error);
            throw error;
        }
    },
};
