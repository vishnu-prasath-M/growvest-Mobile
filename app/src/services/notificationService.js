import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './apiService';
import { Platform } from 'react-native';

// Global handler ensuring notifications ALWAYS show pop-up alert & play sound when app is OPEN (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEVICE_TOKEN_KEY = 'deviceToken';
const LAST_SEEN_TIMESTAMP_KEY = 'lastSeenNotificationTimestamp';
const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

let pollingInterval = null;
let currentUserId = null;
let lastPolledTime = Date.now();

// Immediately create high-importance Android Notification Channel on module load
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#085428',
    sound: 'default',
    showBadge: true,
  }).catch((err) => console.warn('[NotificationService] Channel setup warning:', err));
}

async function showLocalNotification(title, body, data = {}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'Growvest',
        body: body || 'You have a new update.',
        sound: 'default',
        badge: 1,
        data,
      },
      trigger: null,
    });
    console.log('[NotificationService] Local notification displayed:', title);
  } catch (error) {
    console.error('[NotificationService] Error showing local notification:', error);
  }
}

async function pollForNotifications() {
  if (!currentUserId) return;

  try {
    const savedTimeStr = await AsyncStorage.getItem(LAST_SEEN_TIMESTAMP_KEY);
    const lastSeenTime = savedTimeStr ? parseInt(savedTimeStr, 10) : lastPolledTime;

    const response = await api.get('/notifications');
    const allNotifications = response.data?.notifications || [];

    if (allNotifications.length === 0) return;

    // Filter only notifications created AFTER our last seen timestamp
    const brandNewNotifications = allNotifications.filter(n => {
      const createdTime = new Date(n.createdAt).getTime();
      return createdTime > lastSeenTime;
    });

    // Update last seen timestamp to NOW
    const nowTime = Date.now();
    await AsyncStorage.setItem(LAST_SEEN_TIMESTAMP_KEY, nowTime.toString());
    lastPolledTime = nowTime;

    // If initial baseline was just set or no new notifications, exit
    if (!savedTimeStr || brandNewNotifications.length === 0) {
      return;
    }

    // Show only brand new notifications (max 3 at once to prevent spam)
    const toShow = brandNewNotifications.slice(0, 3).reverse();
    for (const notif of toShow) {
      await showLocalNotification(notif.title, notif.description, { notifId: notif._id });
    }
  } catch (error) {
    // Silently fail - polling is best-effort
  }
}

export const notificationService = {
  async requestPermission() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      // ignore
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#085428',
        sound: 'default',
        showBadge: true,
      });
    }

    if (!Device.isDevice) {
      console.log('[NotificationService] Must use physical device for push notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Failed to get push token for push notification!');
      return false;
    }

    return true;
  },

  async getDeviceToken() {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        Constants.manifest?.extra?.eas?.projectId ||
        'f4211c90-3448-400b-9e0c-82933dd6dbed';

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      
      return token.data;
    } catch (error) {
      console.error('[NotificationService] Error getting device token:', error);
      return null;
    }
  },

  async registerDevice(userId, username) {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return null;
      }

      const deviceToken = await this.getDeviceToken();
      if (!deviceToken) {
        return null;
      }

      const isStandalone = Constants.appOwnership === 'standalone' || Constants.executionEnvironment === 'standalone' || !__DEV__;

      await api.post('/users/register-device', {
        userId,
        username,
        deviceToken,
        platform: Platform.OS,
        isStandalone,
      });

      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
      console.log(`[NotificationService] Device registered successfully (Standalone: ${isStandalone})`);
      
      // Start polling for server-side notifications
      this.startPolling(userId);
      
      return deviceToken;
    } catch (error) {
      console.error('[NotificationService] Error registering device:', error);
      return null;
    }
  },

  async unregisterDevice() {
    try {
      this.stopPolling();
      const deviceToken = await this.getStoredToken();
      if (deviceToken) {
        await api.post('/users/unregister-device', { deviceToken }).catch(() => {});
        await this.clearStoredToken();
      }
      console.log('[NotificationService] Device unregistered successfully on logout');
    } catch (error) {
      console.warn('[NotificationService] Error unregistering device:', error);
    }
  },

  startPolling(userId) {
    this.stopPolling();
    currentUserId = userId;
    lastPolledTime = Date.now();
    AsyncStorage.setItem(LAST_SEEN_TIMESTAMP_KEY, Date.now().toString());
    
    // Start interval polling
    pollingInterval = setInterval(pollForNotifications, POLL_INTERVAL_MS);
    console.log('[NotificationService] Started clean polling for notifications');
  },

  stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      currentUserId = null;
      console.log('[NotificationService] Stopped polling for notifications');
    }
  },

  async sendWelcomeNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Welcome 🎉',
          body: 'Welcome to Growvest. We\'re happy to have you with us.',
          sound: 'default',
          badge: 1,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending welcome notification:', error);
    }
  },

  async getStoredToken() {
    return await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  },

  async clearStoredToken() {
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
  },

  setupNotificationListeners(navigateFn) {
    // 1. Listen for incoming notifications when app is OPEN (foreground)
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[NotificationService] Foreground notification received:', notification?.request?.content?.title);
    });

    // 2. Listen for tapping on notification banners (background/closed)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data?.screen && typeof navigateFn === 'function') {
          navigateFn(data.screen, data.params || {});
        }
      } catch (err) {
        console.warn('[NotificationService] Error handling notification response:', err);
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  },
};
