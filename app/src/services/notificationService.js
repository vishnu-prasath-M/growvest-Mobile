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

export const notificationService = {
  async requestPermission() {
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

      const response = await api.post('/api/users/register-device', {
        userId,
        username,
        deviceToken,
        platform: Platform.OS,
      });

      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
      console.log('[NotificationService] Device registered successfully');
      return deviceToken;
    } catch (error) {
      console.error('[NotificationService] Error registering device:', error);
      return null;
    }
  },

  async sendWelcomeNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Welcome 🎉',
          body: 'Welcome to Growvest. We\'re happy to have you with us.',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending welcome notification:', error);
    }
  },

  async sendInvestmentNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Investment Submitted 📈',
          body: 'Your investment request has been submitted successfully.',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending investment notification:', error);
    }
  },

  async sendWithdrawalNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Withdrawal Request 💸',
          body: 'Your withdrawal request has been submitted successfully.',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending withdrawal notification:', error);
    }
  },

  async sendChitJoinNotification(chitName) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Chit Fund Joined 🎯',
          body: `You have successfully joined ${chitName || 'the chit fund'}.`,
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending chit join notification:', error);
    }
  },

  async sendChitPaymentNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Payment Successful ✅',
          body: 'Your chit fund payment has been submitted successfully.',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending chit payment notification:', error);
    }
  },

  async sendKYCNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'KYC Submitted 📋',
          body: 'Your KYC documents have been submitted successfully. We will review them shortly.',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending KYC notification:', error);
    }
  },

  async sendProfileUpdateNotification(field) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Profile Updated ✨',
          body: `Your ${field || 'profile'} has been updated successfully.`,
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending profile update notification:', error);
    }
  },

  async sendBankDetailsNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bank Details Saved 🏦',
          body: 'Your bank details have been saved successfully.',
          sound: 'default',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[NotificationService] Error sending bank details notification:', error);
    }
  },

  async getStoredToken() {
    return await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  },

  async clearStoredToken() {
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
  },
};
