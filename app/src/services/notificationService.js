import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import api from './apiService';
import { API_ENDPOINTS } from '../config/api';
import { DEFAULT_NOTIFICATION_CHANNEL } from '../constants/notificationChannels';
import { navigateFromNotification } from '../navigation/notificationNavigation';
import { navigationRef } from '../navigation/navigationRef';
import {
  getNotificationEnvironment,
  isPhysicalDevice,
  supportsNativeFcm,
} from '../utils/notificationSupport';

const FCM_TOKEN_STORAGE_KEY = 'fcmToken';

export const NOTIFICATION_TYPES = {
  INVESTMENT_APPROVED: 'investment_approved',
  INVESTMENT_REJECTED: 'investment_rejected',
  INVESTMENT_PENDING: 'investment_pending',
  WITHDRAWAL_APPROVED: 'withdrawal_approved',
  WITHDRAWAL_REJECTED: 'withdrawal_rejected',
  WITHDRAWAL_PAID: 'withdrawal_paid',
  WITHDRAWAL_PENDING: 'withdrawal_pending',
  PAYMENT_REJECTED: 'payment_rejected',
  NEW_DEPOSIT: 'new_deposit',
  ADMIN_ANNOUNCEMENT: 'admin_announcement',
};

let listeners = [];
let appStateSubscription = null;
let isInitialized = false;
let handlerConfigured = false;

const safeRun = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[notifications] ${label}:`, error?.message || error);
    return null;
  }
};

const configureNotificationHandler = () => {
  if (handlerConfigured) {
    return;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerConfigured = true;
  } catch (error) {
    console.warn('[notifications] handler setup failed:', error?.message || error);
  }
};

const getDeviceId = async () => {
  try {
    if (Platform.OS === 'android') {
      return Application.getAndroidId();
    }
    return await Application.getIosIdForVendorAsync();
  } catch {
    return null;
  }
};

const getStoredFcmToken = async () => AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);

const storeFcmToken = async (token) => {
  if (token) {
    await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  }
};

const clearStoredFcmToken = async () => {
  await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
};

const getNotificationMessage = (type, data = {}) => {
  const amount = data.amount ? `₹${data.amount}` : '';

  switch (type) {
    case NOTIFICATION_TYPES.INVESTMENT_APPROVED:
      return {
        title: 'Investment Approved',
        body: amount
          ? `Your investment of ${amount} has been approved.`
          : 'Your investment has been approved.',
      };
    case NOTIFICATION_TYPES.INVESTMENT_REJECTED:
      return {
        title: 'Investment Rejected',
        body: amount
          ? `Your investment of ${amount} was rejected.`
          : 'Your investment was rejected.',
      };
    case NOTIFICATION_TYPES.WITHDRAWAL_APPROVED:
    case NOTIFICATION_TYPES.WITHDRAWAL_PAID:
      return {
        title: 'Withdrawal Approved',
        body: amount
          ? `Your withdrawal of ${amount} has been processed.`
          : 'Your withdrawal has been processed.',
      };
    case NOTIFICATION_TYPES.WITHDRAWAL_REJECTED:
    case NOTIFICATION_TYPES.PAYMENT_REJECTED:
      return {
        title: 'Withdrawal Rejected',
        body: amount
          ? `Your withdrawal of ${amount} was rejected.`
          : 'Your withdrawal was rejected.',
      };
    case NOTIFICATION_TYPES.NEW_DEPOSIT:
      return {
        title: 'New Deposit',
        body: amount
          ? `A new deposit of ${amount} was recorded.`
          : 'A new deposit was recorded on your account.',
      };
    case NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT:
      return {
        title: data.title || 'Growvest Announcement',
        body: data.body || data.message || 'You have a new announcement.',
      };
    case NOTIFICATION_TYPES.INVESTMENT_PENDING:
      return {
        title: 'Investment Pending',
        body: amount
          ? `Your investment of ${amount} is pending approval.`
          : 'Your investment is pending approval.',
      };
    case NOTIFICATION_TYPES.WITHDRAWAL_PENDING:
      return {
        title: 'Withdrawal Pending',
        body: amount
          ? `Your withdrawal of ${amount} is being processed.`
          : 'Your withdrawal is being processed.',
      };
    default:
      return {
        title: data.title || 'Growvest',
        body: data.body || data.message || 'You have a new update.',
      };
  }
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL, {
    name: 'Growvest Notifications',
    description: 'Investment, withdrawal, and account updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#085428',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
};

const requestPermissions = async () => {
  if (!isPhysicalDevice()) {
    return false;
  }

  const settings = await Notifications.getPermissionsAsync();
  let finalStatus = settings.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = requested.status;
  }

  return finalStatus === 'granted';
};

const getFcmToken = async () => {
  if (!supportsNativeFcm()) {
    console.info(
      `[notifications] Skipping native FCM token in ${getNotificationEnvironment()} environment`
    );
    return null;
  }

  const granted = await requestPermissions();
  if (!granted) {
    return null;
  }

  await ensureAndroidChannel();

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  return tokenResponse?.data || null;
};

const presentLocalNotification = async (title, body, data = {}) => {
  if (!isPhysicalDevice()) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: DEFAULT_NOTIFICATION_CHANNEL } : {}),
    },
    trigger: null,
  });
  return true;
};

const handleIncomingNotification = async (notification) => {
  const content = notification.request.content;
  const data = content.data || {};
  const hasDisplayContent = Boolean(content.title || content.body);

  if (!hasDisplayContent && data.type) {
    const message = getNotificationMessage(data.type, data);
    await presentLocalNotification(message.title, message.body, data);
  }
};

const handleNotificationResponse = (response) => {
  const data = response?.notification?.request?.content?.data || {};

  const attemptNavigate = (retries = 0) => {
    if (navigationRef.isReady()) {
      navigateFromNotification(data);
      return;
    }

    if (retries < 20) {
      setTimeout(() => attemptNavigate(retries + 1), 100);
    }
  };

  attemptNavigate();
};

const syncTokenWithBackend = async () => {
  if (!supportsNativeFcm()) {
    return null;
  }

  try {
    const authToken = await AsyncStorage.getItem('userToken');
    if (!authToken) {
      return null;
    }

    const fcmToken = await getFcmToken();
    if (!fcmToken) {
      return null;
    }

    const deviceId = await getDeviceId();

    await api.put(API_ENDPOINTS.FCM_TOKEN, {
      fcmToken,
      platform: Platform.OS,
      deviceId,
    });
    await storeFcmToken(fcmToken);
    return fcmToken;
  } catch (error) {
    console.warn('FCM token sync failed:', error?.message || error);
    return null;
  }
};

const removeTokenFromBackend = async () => {
  if (!supportsNativeFcm()) {
    await clearStoredFcmToken();
    return;
  }

  try {
    const fcmToken = await getStoredFcmToken();
    if (!fcmToken) {
      return;
    }

    await api.delete(API_ENDPOINTS.FCM_TOKEN, { data: { fcmToken } });
  } catch (error) {
    console.warn('FCM token removal failed:', error?.message || error);
  } finally {
    await clearStoredFcmToken();
  }
};

const refreshTokenIfNeeded = async () => {
  if (!supportsNativeFcm()) {
    return;
  }

  const authToken = await AsyncStorage.getItem('userToken');
  if (!authToken) {
    return;
  }

  const currentToken = await getFcmToken();
  const storedToken = await getStoredFcmToken();

  if (currentToken && currentToken !== storedToken) {
    await syncTokenWithBackend();
  }
};

const cleanupListeners = () => {
  listeners.forEach((subscription) => subscription.remove());
  listeners = [];

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  isInitialized = false;
};

const initialize = async () => {
  if (isInitialized) {
    return { enabled: true, environment: getNotificationEnvironment() };
  }

  configureNotificationHandler();

  if (!isPhysicalDevice()) {
    isInitialized = true;
    return { enabled: false, environment: 'simulator' };
  }

  await safeRun('android channel setup', ensureAndroidChannel);
  await safeRun('permission request', requestPermissions);

  await safeRun('received listener', async () => {
    listeners.push(
      Notifications.addNotificationReceivedListener((notification) => {
        safeRun('incoming notification', () => handleIncomingNotification(notification));
      })
    );
  });

  await safeRun('response listener', async () => {
    listeners.push(
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response);
      })
    );
  });

  if (supportsNativeFcm()) {
    await safeRun('push token listener', async () => {
      listeners.push(
        Notifications.addPushTokenListener(async () => {
          await refreshTokenIfNeeded();
        })
      );
    });

    appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshTokenIfNeeded();
      }
    });

    const lastResponse = await Notifications.getLastNotificationResponseAsync();
    if (lastResponse) {
      handleNotificationResponse(lastResponse);
    }
  } else {
    console.info(
      '[notifications] Running without remote push in Expo Go. Use an EAS APK for FCM testing.'
    );
  }

  isInitialized = true;
  return {
    enabled: supportsNativeFcm(),
    environment: getNotificationEnvironment(),
  };
};

export const notificationService = {
  NOTIFICATION_TYPES,
  initialize,
  cleanup: cleanupListeners,
  requestPermissions,
  getFcmToken,
  getToken: getStoredFcmToken,
  saveToken: storeFcmToken,
  syncTokenWithBackend,
  removeTokenFromBackend,
  refreshTokenIfNeeded,
  presentLocalNotification,
  sendLocalNotification: presentLocalNotification,
  getNotificationMessage,
  notificationTypes: NOTIFICATION_TYPES,
  supportsNativeFcm,
  getNotificationEnvironment,
};
