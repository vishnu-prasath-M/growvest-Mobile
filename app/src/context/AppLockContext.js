import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { appLockService } from '../services/appLockService';
import { useAuth } from './AuthContext';

const AppLockContext = createContext();

export const AppLockProvider = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [pinLength, setPinLength] = useState(4);
  const [lockTimeout, setLockTimeout] = useState(30000); // Default: 30 seconds grace period
  const [biometricInfo, setBiometricInfo] = useState({
    hasHardware: false,
    isEnrolled: false,
    biometryType: null,
    label: 'Biometric',
  });
  const [isReady, setIsReady] = useState(false);

  const backgroundTimeRef = useRef(null);
  const activeUserIdRef = useRef(null);

  // Keep active user ID ref updated
  useEffect(() => {
    const currentId = user?._id || user?.id || null;
    activeUserIdRef.current = currentId;
    if (currentId) {
      appLockService.setActiveUserId(currentId);
    }
  }, [user]);

  /**
   * Fast Initial Boot Load (Local storage only, zero network latency)
   */
  const loadInitialLockState = useCallback(async () => {
    try {
      // 1. Get last active user ID from fast local storage
      const lastUserId = await appLockService.getActiveUserId();
      const currentUserId = user?._id || user?.id || lastUserId;
      activeUserIdRef.current = currentUserId;

      // 2. Check biometric hardware
      const bio = await appLockService.checkBiometrics();
      setBiometricInfo(bio);

      // 3. Check if lock is enabled for this user
      if (currentUserId) {
        const [enabled, bioEnabled, len, timeout] = await Promise.all([
          appLockService.isAppLockEnabled(currentUserId),
          appLockService.isBiometricEnabled(currentUserId),
          appLockService.getPinLength(currentUserId),
          appLockService.getLockTimeout(currentUserId),
        ]);

        setIsAppLockEnabled(enabled);
        setIsBiometricEnabled(bioEnabled);
        setPinLength(len);
        setLockTimeout(timeout);

        if (enabled) {
          // Immediately engage lock screen on app start
          setIsLocked(true);
        }
      }
    } catch (err) {
      console.warn('[AppLockContext] Error during initial lock check:', err?.message || err);
    } finally {
      setIsReady(true);
    }
  }, [user]);

  useEffect(() => {
    loadInitialLockState();
  }, [loadInitialLockState]);

  // Sync state whenever auth user changes (login / logout)
  useEffect(() => {
    const syncUserLock = async () => {
      const currentUserId = user?._id || user?.id;
      if (!currentUserId) {
        // User logged out
        setIsLocked(false);
        setIsAppLockEnabled(false);
        setIsBiometricEnabled(false);
        return;
      }

      try {
        const [enabled, bioEnabled, len, timeout] = await Promise.all([
          appLockService.isAppLockEnabled(currentUserId),
          appLockService.isBiometricEnabled(currentUserId),
          appLockService.getPinLength(currentUserId),
          appLockService.getLockTimeout(currentUserId),
        ]);

        setIsAppLockEnabled(enabled);
        setIsBiometricEnabled(bioEnabled);
        setPinLength(len);
        setLockTimeout(timeout);
      } catch (err) {
        console.warn('[AppLockContext] Error syncing user lock:', err);
      }
    };

    if (isReady) {
      syncUserLock();
    }
  }, [user, isReady]);

  /**
   * AppState Background / Inactivity Timer Listener with Grace Period
   */
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      const currentUserId = activeUserIdRef.current;
      if (!currentUserId) return;

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Record timestamp when app enters background
        backgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active') {
        const lastBg = backgroundTimeRef.current;
        backgroundTimeRef.current = null;

        if (lastBg) {
          const elapsed = Date.now() - lastBg;
          // Check if App Lock is enabled and elapsed time exceeds grace period
          const enabled = await appLockService.isAppLockEnabled(currentUserId);
          const timeout = await appLockService.getLockTimeout(currentUserId);

          if (enabled && elapsed >= timeout) {
            console.log(`[AppLockContext] Inactivity timeout reached (${elapsed}ms >= ${timeout}ms). Locking app.`);
            setIsLocked(true);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Unlock action
   */
  const unlock = useCallback(() => {
    setIsLocked(false);
    backgroundTimeRef.current = null;
  }, []);

  /**
   * Force lock action
   */
  const lock = useCallback(() => {
    if (isAppLockEnabled) {
      setIsLocked(true);
    }
  }, [isAppLockEnabled]);

  /**
   * Refresh preferences after user updates PIN or settings
   */
  const refreshLockPreferences = useCallback(async () => {
    const currentUserId = user?._id || user?.id || (await appLockService.getActiveUserId());
    if (!currentUserId) return;

    try {
      const [enabled, bioEnabled, len, timeout, bio] = await Promise.all([
        appLockService.isAppLockEnabled(currentUserId),
        appLockService.isBiometricEnabled(currentUserId),
        appLockService.getPinLength(currentUserId),
        appLockService.getLockTimeout(currentUserId),
        appLockService.checkBiometrics(),
      ]);

      setIsAppLockEnabled(enabled);
      setIsBiometricEnabled(bioEnabled);
      setPinLength(len);
      setLockTimeout(timeout);
      setBiometricInfo(bio);
    } catch (err) {
      console.warn('[AppLockContext] Failed to refresh lock preferences:', err);
    }
  }, [user]);

  return (
    <AppLockContext.Provider
      value={{
        isLocked,
        isAppLockEnabled,
        isBiometricEnabled,
        pinLength,
        lockTimeout,
        biometricInfo,
        isReady,
        activeUserId: user?._id || user?.id,
        unlock,
        lock,
        refreshLockPreferences,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = () => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};
