import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { userService } from './userService';

// Configure notification behavior for when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const pushNotificationService = {
    /**
     * Request permissions and register push token
     */
    async registerForPushNotificationsAsync(userId: string): Promise<string | undefined> {
        if (!Device.isDevice) {
            console.log('[PushNotificationService] Push notifications require a physical device');
            return undefined;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[PushNotificationService] Permission not granted for push notifications');
                return undefined;
            }

            // Get Expo Push Token
            const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.owner;
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            const token = tokenData.data;

            console.log('[PushNotificationService] Registered with token:', token);

            // Save token to Firestore
            const deviceName = Device.deviceName || 'unknown device';
            await userService.registerPushToken(userId, token, deviceName);

            // Platform specific configuration
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            return token;
        } catch (error) {
            console.error('[PushNotificationService] Error registering for push notifications:', error);
            return undefined;
        }
    },

    /**
     * Setup listeners for incoming notifications
     */
    setupListeners(onNotificationTapped: (data: any) => void) {
        // Listen for notifications while the app is running
        const notificationListener = Notifications.addNotificationReceivedListener(notification => {
            console.log('[PushNotificationService] Notification received:', notification);
        });

        // Listen for users tapping on a notification
        const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            console.log('[PushNotificationService] Notification tapped:', data);
            onNotificationTapped(data);
        });

        return () => {
            notificationListener.remove();
            responseListener.remove();
        };
    },

    /**
     * Set badge count
     */
    async setBadgeCount(count: number): Promise<void> {
        if (Platform.OS !== 'web') {
            await Notifications.setBadgeCountAsync(count);
        }
    },
};
