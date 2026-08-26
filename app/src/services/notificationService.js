import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './apiService';
import { Platform } from 'react-native';

// Ensures notifications show as banners even when app is OPEN (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
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

    // Do NOT block on !Device.isDevice — real phones with Expo Go return Device.isDevice=true.
    // The old guard was wrongly returning false on valid physical devices.
    if (!Device.isDevice) {
      console.warn('[NotificationService] Not a physical device - push tokens may not work on simulator');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[NotificationService] Push permission not granted - status:', finalStatus);
      return false;
    }

    console.log('[NotificationService] Push permission GRANTED');
    return true;
  },

  async getDeviceToken() {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      Constants.manifest?.extra?.eas?.projectId ||
      'f4211c90-3448-400b-9e0c-82933dd6dbed';

    console.log('[NotificationService] Getting push token, projectId:', projectId);

    // Strategy 1: Expo Push Token (works in Expo Go AND EAS/standalone via Expo FCM gateway)
    try {
      const expoTokenObj = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = expoTokenObj?.data;
      if (token) {
        console.log('[NotificationService] Got Expo Push Token:', token);
        return { token, type: 'expo' };
      }
    } catch (err) {
      console.warn('[NotificationService] getExpoPushTokenAsync failed:', err?.message);
    }

    // Strategy 2: Native FCM device token (standalone APK fallback)
    try {
      const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
      const token = deviceTokenObj?.data;
      if (token) {
        console.log('[NotificationService] Got Native FCM Token:', token);
        return { token, type: 'fcm' };
      }
    } catch (err) {
      console.warn('[NotificationService] getDevicePushTokenAsync failed:', err?.message);
    }

    console.error('[NotificationService] FAILED to get any push token');
    return null;
  },

  async registerDevice(userId, username) {
    try {
      console.log('[NotificationService] Starting device registration for userId:', userId);

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('[NotificationService] Skipping registration - no permission');
        return null;
      }

      const tokenResult = await this.getDeviceToken();
      if (!tokenResult) {
        console.error('[NotificationService] Skipping registration - no push token obtained');
        return null;
      }

      const { token: deviceToken, type: tokenType } = tokenResult;
      const isStandalone = Constants.appOwnership === 'standalone' ||
        Constants.executionEnvironment === 'standalone' ||
        !__DEV__;

      console.log('[NotificationService] Sending token to server:', {
        userId, tokenType, isStandalone, tokenPrefix: deviceToken.substring(0, 30),
      });

      const response = await api.post('/users/register-device', {
        userId, username, deviceToken, platform: Platform.OS, isStandalone, tokenType,
      });

      console.log('[NotificationService] Token saved to DB:', response.data?.message);
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
      this.startPolling(userId);
      return deviceToken;
    } catch (error) {
      console.error('[NotificationService] registerDevice error:', error?.response?.data || error?.message);
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
