import app from '../firebase';
import { getMessaging, getToken, deleteToken, isSupported, } from 'firebase/messaging';
import { notificationService } from './notificationService';
/**
 * Service to manage browser push notifications (Firebase Cloud Messaging)
 * - Requests permission
 * - Registers service worker
 * - Retrieves and stores FCM token in Firestore
 * - Cleans up tokens when needed
 */
class PushNotificationService {
    constructor() {
        Object.defineProperty(this, "messaging", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "registration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    async ensureSupported() {
        const supported = await isSupported();
        if (!supported) {
            throw new Error('Push notifications are not supported in this browser.');
        }
    }
    async ensureMessaging() {
        if (this.messaging)
            return this.messaging;
        this.messaging = getMessaging(app);
        return this.messaging;
    }
    async ensureServiceWorker() {
        if (this.registration)
            return this.registration;
        // Register the custom service worker that handles push events
        this.registration = await navigator.serviceWorker.register('/sw.js');
        return this.registration;
    }
    /**
     * Request browser permission and register push token for the user
     */
    async registerPush(userId) {
        await this.ensureSupported();
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Notification permission was not granted.');
        }
        const messaging = await this.ensureMessaging();
        const registration = await this.ensureServiceWorker();
        const vapidKey = import.meta.env?.VITE_FIREBASE_VAPID_KEY || '';
        if (!vapidKey) {
            throw new Error('VAPID key is missing (VITE_FIREBASE_VAPID_KEY).');
        }
        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        });
        if (!token) {
            throw new Error('Failed to retrieve FCM token.');
        }
        await notificationService.savePushToken(userId, token);
        return token;
    }
    /**
     * Remove the current device token for the user
     */
    async unregisterPush(userId) {
        await this.ensureSupported();
        const messaging = await this.ensureMessaging();
        const registration = await this.ensureServiceWorker();
        const token = await getToken(messaging, {
            vapidKey: import.meta.env?.VITE_FIREBASE_VAPID_KEY || '',
            serviceWorkerRegistration: registration,
        });
        if (token) {
            await deleteToken(messaging);
            await notificationService.removePushToken(userId, token);
        }
    }
    /**
     * Quick status helper
     */
    getPermissionStatus() {
        return Notification.permission;
    }
}
export const pushNotificationService = new PushNotificationService();
