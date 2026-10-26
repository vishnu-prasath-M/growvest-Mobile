import { Platform, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import api from './apiService';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';

/**
 * Compare two semver strings: v1 and v2.
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v2 is newer)
 *   0 if equal
 */
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;

  const clean1 = v1.toString().trim().replace(/^v/i, '');
  const clean2 = v2.toString().trim().replace(/^v/i, '');

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // If numbers match but string differs (e.g., build timestamps)
  if (clean1 !== clean2) return 1;
  return 0;
}

export const appUpdateService = {
  /**
   * Get currently installed app version
   */
  getCurrentVersion() {
    return Constants.expoConfig?.version || '1.0.0';
  },

  /**
   * Check if a newer version APK is available on the server
   */
  async checkForUpdate() {
    const currentVersion = this.getCurrentVersion();

    try {
      const response = await api.get(API_ENDPOINTS.APK_INFO);
      const data = response.data;

      if (!data || !data.hasActiveApk || !data.downloadUrl) {
        return {
          isUpdateAvailable: false,
          currentVersion,
          message: 'Your app is up to date!',
        };
      }

      const serverVersion = (data.version || '1.0.0').toString().trim().replace(/^v/i, '');
      const isNewer = compareVersions(serverVersion, currentVersion) > 0;

      // Ensure download URL is full URL
      let resolvedDownloadUrl = data.downloadUrl.trim();
      if (resolvedDownloadUrl.startsWith('/')) {
        const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
        resolvedDownloadUrl = `${serverOrigin}${resolvedDownloadUrl}`;
      }

      return {
        isUpdateAvailable: isNewer,
        currentVersion,
        latestVersion: serverVersion,
        downloadUrl: resolvedDownloadUrl,
        fileName: data.fileName || `Growvest v${serverVersion}.apk`,
        fileSize: data.fileSize || 0,
        releaseNotes: data.releaseNotes || 'Includes new features, improvements, and stability updates.',
        uploadedAt: data.uploadedAt,
      };
    } catch (error) {
      console.warn('[AppUpdateService] Error checking for updates:', error.message);
      return {
        isUpdateAvailable: false,
        currentVersion,
        error: error.message,
      };
    }
  },

  /**
   * Download APK with real-time progress and trigger native Android installer
   */
  async downloadAndInstall(downloadUrl, onProgress = () => {}) {
    if (!downloadUrl) throw new Error('Download URL is required');

    const fileName = 'Growvest_Update.apk';
    const localUri = `${FileSystem.cacheDirectory}${fileName}`;

    try {
      // 1. Remove old APK cache if present
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      }

      // 2. Start resumable download
      let lastReportTime = 0;
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
        {},
        (downloadProgress) => {
          const now = Date.now();
          // Throttle callbacks to 100ms for smooth UI rendering
          if (now - lastReportTime > 100 || downloadProgress.totalBytesWritten === downloadProgress.totalBytesExpectedToWrite) {
            lastReportTime = now;
            const expected = downloadProgress.totalBytesExpectedToWrite;
            const written = downloadProgress.totalBytesWritten;
            const percent = expected > 0 ? written / expected : 0;

            onProgress({
              progress: Math.min(Math.max(percent, 0), 1),
              bytesWritten: written,
              totalBytes: expected,
            });
          }
        }
      );

      const downloadResult = await downloadResumable.downloadAsync();
      if (!downloadResult || !downloadResult.uri) {
        throw new Error('Download failed: file not received');
      }

      // 3. Launch Android Package Installer
      if (Platform.OS === 'android') {
        try {
          const IntentLauncher = require('expo-intent-launcher');
          const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
            type: 'application/vnd.android.package-archive',
          });

          return { success: true, method: 'intent' };
        } catch (intentErr) {
          console.warn('[AppUpdateService] Native installer launch failed, opening via browser fallback:', intentErr);
          await Linking.openURL(downloadUrl);
          return { success: true, method: 'browser_fallback' };
        }
      } else {
        await Linking.openURL(downloadUrl);
        return { success: true, method: 'browser' };
      }
    } catch (err) {
      console.error('[AppUpdateService] downloadAndInstall error:', err);
      throw err;
    }
  },

  /**
   * Fallback direct browser download
   */
  async openInBrowser(downloadUrl) {
    if (downloadUrl) {
      await Linking.openURL(downloadUrl);
    }
  },
};

export default appUpdateService;
