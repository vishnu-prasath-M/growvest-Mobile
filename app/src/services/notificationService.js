import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './apiService';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const DEVICE_TOKEN_KEY = 'deviceToken';
const LAST_SEEN_NOTIF_KEY = 'lastSeenNotificationId';
const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds for instant delivery

let pollingInterval = null;
let currentUserId = null;

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
    console.log('[NotificationService] Local system notification dispatched:', title);
  } catch (error) {
    console.error('[NotificationService] Error showing local notification:', error);
  }
}

async function pollForNotifications() {
  if (!currentUserId) return;

  try {
    const lastSeenId = await AsyncStorage.getItem(LAST_SEEN_NOTIF_KEY);
    
    const response = await api.get('/notifications');
    const allNotifications = response.data?.notifications || [];

    if (allNotifications.length === 0) return;

    // On FIRST poll (no lastSeenId stored), silently set the baseline to the
    // current latest notification and return WITHOUT showing any alerts.
    // This prevents all historical notifications from firing at once on login.
    if (!lastSeenId) {
      await AsyncStorage.setItem(LAST_SEEN_NOTIF_KEY, allNotifications[0]._id);
      console.log('[NotificationService] Baseline set to latest notification, no alerts fired on first poll.');
      return;
    }

    // Find which notifications are NEW since last seen
    const lastSeenIndex = allNotifications.findIndex(n => n._id === lastSeenId);
    if (lastSeenIndex <= 0) {
      if (lastSeenIndex < 0) {
        await AsyncStorage.setItem(LAST_SEEN_NOTIF_KEY, allNotifications[0]._id);
      }
      return;
    }

    // Everything BEFORE lastSeenIndex is newer than what we last saw
    const newNotifications = allNotifications.slice(0, lastSeenIndex);

    // Update last seen to the newest notification immediately
    const newestId = allNotifications[0]?._id;
    if (newestId) {
      await AsyncStorage.setItem(LAST_SEEN_NOTIF_KEY, newestId);
    }

    // Show notifications oldest-first so they appear in order
    for (const notif of newNotifications.reverse()) {
      await showLocalNotification(notif.title, notif.description, { notifId: notif._id });
    }
  } catch (error) {
    // Silently fail - polling is best-effort
  }
}

export const notificationService = {
  async requestPermission() {
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

    // Schedule native daily local notifications directly in Android OS
    this.scheduleDailyLocalNotifications();

    return true;
  },

  /**
   * Schedules recurring daily local notifications directly in Android OS.
   * Runs natively on the device even when the app is closed or killed!
   */
  async scheduleDailyLocalNotifications() {
    try {
      // Cancel existing scheduled notifications to prevent duplicates
      await Notifications.cancelAllScheduledNotificationsAsync();

      // 1. Morning Pocket Money & Investment Payout Alert (9:00 AM IST)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💰 Daily Pocket Money Ready!',
          body: 'Your daily payout and returns are ready to claim! Log in now to check your balance.',
          sound: 'default',
          badge: 1,
          data: { screen: 'PocketMoney' },
        },
        trigger: {
          hour: 9,
          minute: 0,
          repeats: true,
        },
      });

      // 2. Evening Wealth & Chit Fund Reminder (6:00 PM IST)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📈 Grow Your Money Every Day!',
          body: 'Check today\'s earnings, claim coin rewards, and explore high-yield chit funds on Growvest!',
          sound: 'default',
          badge: 1,
          data: { screen: 'Home' },
        },
        trigger: {
          hour: 18,
          minute: 0,
          repeats: true,
        },
      });

      console.log('[NotificationService] Natively scheduled daily local notifications for 9:00 AM & 6:00 PM IST.');
    } catch (error) {
      console.error('[NotificationService] Error scheduling daily local notifications:', error);
    }
  },

  async getDeviceToken() {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        console.log('[NotificationService] No EAS project ID found');
        return null;
      }

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

      await api.post('/users/register-device', {
        userId,
        username,
        deviceToken,
        platform: Platform.OS,
      });

      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
      console.log('[NotificationService] Device registered successfully:', deviceToken);
      
      // Start polling for server-side notifications
      this.startPolling(userId);
      
      return deviceToken;
    } catch (error) {
      console.error('[NotificationService] Error registering device:', error);
      return null;
    }
  },

  startPolling(userId) {
    this.stopPolling();
    currentUserId = userId;
    
    // Poll immediately on start
    pollForNotifications();
    
    // Then poll at regular intervals
    pollingInterval = setInterval(pollForNotifications, POLL_INTERVAL_MS);
    console.log('[NotificationService] Started polling for notifications');
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
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data;
        if (data?.screen && typeof navigateFn === 'function') {
          navigateFn(data.screen, data.params || {});
        }
      } catch (err) {
        console.warn('[NotificationService] Error handling notification response:', err);
      }
    });

    return () => subscription.remove();
  },
};
