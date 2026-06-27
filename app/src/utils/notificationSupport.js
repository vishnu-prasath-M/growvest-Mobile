import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

export const isExpoGo = () =>
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const isPhysicalDevice = () => Device.isDevice;

/** Native FCM tokens require a dev client or production build — not Expo Go. */
export const supportsNativeFcm = () => isPhysicalDevice() && !isExpoGo();

export const getNotificationEnvironment = () => {
  if (!isPhysicalDevice()) {
    return 'simulator';
  }
  if (isExpoGo()) {
    return 'expo-go';
  }
  return 'standalone';
};
