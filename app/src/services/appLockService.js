import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_STORE_PREFIX = 'gv_app_lock_';
const LAST_USER_KEY = 'growvest_last_active_user_id';

/**
 * Generate a random cryptographic hex salt
 */
const generateSalt = async () => {
  try {
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (err) {
    // Fallback pseudo-random salt if crypto random bytes fails
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }
};

/**
 * Hash a PIN using SHA-256 with a unique salt
 */
const hashPin = async (pin, salt) => {
  const combined = `${salt}__GROWVEST_SALT__${pin}`;
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
};

/**
 * Helper to build user-scoped secure keys
 */
const getKey = (name, userId) => {
  const safeId = userId || 'default';
  return `${SECURE_STORE_PREFIX}${name}_${safeId}`;
};

export const appLockService = {
  /**
   * Save the active user ID locally for zero-latency cold-start detection
   */
  setActiveUserId: async (userId) => {
    if (userId) {
      await AsyncStorage.setItem(LAST_USER_KEY, String(userId));
    } else {
      await AsyncStorage.removeItem(LAST_USER_KEY);
    }
  },

  /**
   * Get the last active user ID from fast local storage
   */
  getActiveUserId: async () => {
    try {
      return await AsyncStorage.getItem(LAST_USER_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Check device biometric capabilities dynamically
   */
  checkBiometrics: async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return {
          hasHardware: false,
          isEnrolled: false,
          biometryType: null,
          label: 'Biometric authentication is not supported on this device',
        };
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometryType = 'Biometric';
      let label = 'Fingerprint / Biometric';

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometryType = 'Face';
        label = 'Face Unlock';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometryType = 'Fingerprint';
        label = 'Fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometryType = 'Iris';
        label = 'Iris Scan';
      }

      return {
        hasHardware: true,
        isEnrolled,
        biometryType,
        label,
        supportedTypes,
      };
    } catch (error) {
      console.warn('[AppLockService] Biometric check error:', error?.message || error);
      return {
        hasHardware: false,
        isEnrolled: false,
        biometryType: null,
        label: 'Biometric authentication error',
      };
    }
  },

  /**
   * Trigger the native system biometric authentication prompt
   */
  authenticateWithBiometrics: async (promptMessage = 'Unlock Growvest') => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Use PIN',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: true, // We provide our own PIN keypad fallback
      });

      return {
        success: result.success === true,
        error: result.error || null,
        warning: result.warning || null,
      };
    } catch (error) {
      console.warn('[AppLockService] Biometric auth failed:', error?.message || error);
      return { success: false, error: error?.message || 'Biometric authentication failed' };
    }
  },

  /**
   * Check if App Lock is enabled for a given user
   */
  isAppLockEnabled: async (userId) => {
    try {
      const enabled = await SecureStore.getItemAsync(getKey('enabled', userId));
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Check if Biometric Unlock is enabled for a given user
   */
  isBiometricEnabled: async (userId) => {
    try {
      const enabled = await SecureStore.getItemAsync(getKey('biometric', userId));
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Set or update App Lock PIN and preferences
   */
  setAppLockPin: async (userId, pin, enableBiometric = false) => {
    if (!pin || (pin.length !== 4 && pin.length !== 6)) {
      throw new Error('PIN must be 4 or 6 digits');
    }

    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);

    // Save to SecureStore
    await Promise.all([
      SecureStore.setItemAsync(getKey('pin_hash', userId), hash),
      SecureStore.setItemAsync(getKey('pin_salt', userId), salt),
      SecureStore.setItemAsync(getKey('pin_length', userId), String(pin.length)),
      SecureStore.setItemAsync(getKey('enabled', userId), 'true'),
      SecureStore.setItemAsync(getKey('biometric', userId), enableBiometric ? 'true' : 'false'),
    ]);

    if (userId) {
      await appLockService.setActiveUserId(userId);
    }

    return true;
  },

  /**
   * Verify input PIN against stored salted hash
   */
  verifyPin: async (userId, inputPin) => {
    try {
      const [hash, salt] = await Promise.all([
        SecureStore.getItemAsync(getKey('pin_hash', userId)),
        SecureStore.getItemAsync(getKey('pin_salt', userId)),
      ]);

      if (!hash || !salt) {
        return false;
      }

      const inputHash = await hashPin(inputPin, salt);
      return inputHash === hash;
    } catch (error) {
      console.error('[AppLockService] Verify PIN error:', error);
      return false;
    }
  },

  /**
   * Get configured PIN length (4 or 6)
   */
  getPinLength: async (userId) => {
    try {
      const len = await SecureStore.getItemAsync(getKey('pin_length', userId));
      return len ? parseInt(len, 10) : 4;
    } catch {
      return 4;
    }
  },

  /**
   * Update Biometric toggle preference
   */
  setBiometricEnabled: async (userId, enabled) => {
    await SecureStore.setItemAsync(getKey('biometric', userId), enabled ? 'true' : 'false');
  },

  /**
   * Get configured lock timeout in milliseconds (default 30000ms / 30 seconds)
   */
  getLockTimeout: async (userId) => {
    try {
      const timeout = await SecureStore.getItemAsync(getKey('timeout', userId));
      return timeout ? parseInt(timeout, 10) : 30000;
    } catch {
      return 30000;
    }
  },

  /**
   * Set lock timeout in milliseconds
   */
  setLockTimeout: async (userId, timeoutMs) => {
    await SecureStore.setItemAsync(getKey('timeout', userId), String(timeoutMs));
  },

  /**
   * Completely disable App Lock for a user
   */
  disableAppLock: async (userId) => {
    await Promise.all([
      SecureStore.deleteItemAsync(getKey('pin_hash', userId)),
      SecureStore.deleteItemAsync(getKey('pin_salt', userId)),
      SecureStore.deleteItemAsync(getKey('pin_length', userId)),
      SecureStore.setItemAsync(getKey('enabled', userId), 'false'),
      SecureStore.setItemAsync(getKey('biometric', userId), 'false'),
    ]);
  },
};
