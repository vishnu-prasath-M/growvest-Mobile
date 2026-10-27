import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import appUpdateService from '../services/appUpdateService';

const AppUpdateContext = createContext(null);

export const AppUpdateProvider = ({ children }) => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStats, setDownloadStats] = useState({ bytesWritten: 0, totalBytes: 0 });
  const [downloadError, setDownloadError] = useState(null);
  const hasAutoCheckedRef = useRef(false);

  // Check for updates
  const checkForUpdates = useCallback(async (isManual = false) => {
    if (isChecking) return;
    setIsChecking(true);
    setDownloadError(null);

    try {
      const result = await appUpdateService.checkForUpdate();

      if (result.isUpdateAvailable) {
        setUpdateInfo(result);
        setIsModalVisible(true);
      } else if (isManual) {
        Alert.alert(
          'Up to Date! 🎉',
          `You are using the latest version of Growvest (v${result.currentVersion}).`,
          [{ text: 'Great' }]
        );
      }
      return result;
    } catch (err) {
      console.warn('[AppUpdateContext] Check error:', err.message);
      if (isManual) {
        Alert.alert('Update Check Failed', 'Unable to check for updates. Please check your internet connection.');
      }
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  // Auto check once on app launch after a 3-second gentle delay
  useEffect(() => {
    if (hasAutoCheckedRef.current) return;
    hasAutoCheckedRef.current = true;

    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // Start downloading and triggering install
  const startUpdate = useCallback(async () => {
    if (!updateInfo || !updateInfo.downloadUrl || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStats({ bytesWritten: 0, totalBytes: 0 });
    setDownloadError(null);

    try {
      await appUpdateService.downloadAndInstall(updateInfo.downloadUrl, updateInfo.latestVersion, (progressData) => {
        setDownloadProgress(progressData.progress);
        setDownloadStats({
          bytesWritten: progressData.bytesWritten,
          totalBytes: progressData.totalBytes,
        });
      });
      // Once intent is triggered, close modal after short delay
      setTimeout(() => {
        setIsDownloading(false);
        setIsModalVisible(false);
      }, 1500);
    } catch (err) {
      console.error('[AppUpdateContext] Download error:', err);
      setDownloadError(err.message || 'Download failed');
      setIsDownloading(false);
    }
  }, [updateInfo, isDownloading]);

  // Download via browser fallback
  const downloadViaBrowser = useCallback(async () => {
    if (updateInfo?.downloadUrl) {
      await appUpdateService.openInBrowser(updateInfo.downloadUrl);
      setIsModalVisible(false);
    }
  }, [updateInfo]);

  const dismissModal = useCallback(() => {
    if (isDownloading) return; // Prevent dismissing during active download
    setIsModalVisible(false);
  }, [isDownloading]);

  const value = {
    updateInfo,
    isModalVisible,
    isChecking,
    isDownloading,
    downloadProgress,
    downloadStats,
    downloadError,
    checkForUpdates,
    startUpdate,
    downloadViaBrowser,
    dismissModal,
    currentVersion: appUpdateService.getCurrentVersion(),
  };

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
};

export const useAppUpdate = () => {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within an AppUpdateProvider');
  }
  return context;
};
