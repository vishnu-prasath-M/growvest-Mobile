import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppUpdate } from '../context/AppUpdateContext';
import { useTheme } from '../context/ThemeContext';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export const AppUpdateModal = () => {
  const {
    updateInfo,
    isModalVisible,
    isDownloading,
    downloadProgress,
    downloadStats,
    downloadError,
    startUpdate,
    downloadViaBrowser,
    dismissModal,
  } = useAppUpdate();

  const { isDarkMode } = useTheme();
  const { width, height } = useWindowDimensions();

  if (!updateInfo || !isModalVisible) return null;

  const currentVer = updateInfo.currentVersion || '1.2.0';
  const latestVer = updateInfo.latestVersion || '1.2.1';
  const percentNumber = Math.round((downloadProgress || 0) * 100);

  return (
    <Modal
      visible={isModalVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={dismissModal}
    >
      <View style={[styles.modalRoot, { width, height }]}>
        {/* Dimmed Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={isDownloading ? undefined : dismissModal}
        />

        {/* Centered Modal Card */}
        <View
          style={[
            styles.dialogCard,
            {
              backgroundColor: isDarkMode ? '#141E18' : '#FFFFFF',
              borderColor: isDarkMode ? '#224231' : '#E2E8F0',
            },
          ]}
        >
          {/* Header Icon */}
          <View style={styles.headerRow}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <MaterialCommunityIcons name="rocket-launch-outline" size={28} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.title, { color: isDarkMode ? '#F1F5F9' : '#0F172A' }]}>
                Update Available!
              </Text>
              <Text style={[styles.subtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                A newer version of Growvest is ready
              </Text>
            </View>
          </View>

          {/* Version Pills */}
          <View
            style={[
              styles.versionBanner,
              {
                backgroundColor: isDarkMode ? '#0A2B1A' : '#ECFDF5',
                borderColor: isDarkMode ? '#134E2E' : '#A7F3D0',
              },
            ]}
          >
            <View style={styles.verCol}>
              <Text style={[styles.verLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                Current
              </Text>
              <Text style={[styles.verVal, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
                v{currentVer}
              </Text>
            </View>
            <MaterialCommunityIcons name="arrow-right-bold" size={20} color="#10B981" />
            <View style={styles.verCol}>
              <Text style={[styles.verLabel, { color: '#059669' }]}>New Version</Text>
              <Text style={[styles.verVal, { color: '#10B981', fontWeight: '800' }]}>
                v{latestVer}
              </Text>
            </View>
          </View>

          {/* Release Notes */}
          {Boolean(updateInfo.releaseNotes) && (
            <View style={styles.notesBox}>
              <Text style={[styles.notesHeader, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
                What's New:
              </Text>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <Text style={[styles.notesText, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
                  {updateInfo.releaseNotes}
                </Text>
              </ScrollView>
            </View>
          )}

          {/* Downloading Progress Section */}
          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressText, { color: isDarkMode ? '#E2E8F0' : '#1E293B' }]}>
                  {percentNumber >= 100 ? 'Finalizing install...' : `Downloading... ${percentNumber}%`}
                </Text>
                {downloadStats.totalBytes > 0 && (
                  <Text style={[styles.progressSubtext, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                    {formatBytes(downloadStats.bytesWritten)} / {formatBytes(downloadStats.totalBytes)}
                  </Text>
                )}
              </View>

              {/* Progress Bar Track */}
              <View style={[styles.progressTrack, { backgroundColor: isDarkMode ? '#1E382A' : '#E2E8F0' }]}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${Math.min(Math.max(percentNumber, 5), 100)}%` },
                  ]}
                />
              </View>

              <View style={styles.installHintRow}>
                <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 6 }} />
                <Text style={[styles.installHint, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Android package installer will prompt automatically once downloaded
                </Text>
              </View>
            </View>
          ) : null}

          {/* Error Message */}
          {Boolean(downloadError) && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>
                {downloadError}. Try downloading via browser.
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.btnStack}>
            {!isDownloading ? (
              <TouchableOpacity
                style={styles.primaryBtnOuter}
                activeOpacity={0.88}
                onPress={startUpdate}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtnGradient}
                >
                  <MaterialCommunityIcons name="download" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Update Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {/* Fallback Browser Button */}
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                {
                  borderColor: isDarkMode ? '#224231' : '#CBD5E1',
                  backgroundColor: isDarkMode ? '#0D2116' : '#F8FAFC',
                },
              ]}
              activeOpacity={0.75}
              onPress={downloadViaBrowser}
            >
              <MaterialCommunityIcons
                name="open-in-new"
                size={16}
                color={isDarkMode ? '#A7F3D0' : '#047857'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.secondaryBtnText, { color: isDarkMode ? '#A7F3D0' : '#047857' }]}>
                Download via Browser
              </Text>
            </TouchableOpacity>

            {/* Later Button */}
            {!isDownloading && (
              <TouchableOpacity
                style={styles.laterBtn}
                activeOpacity={0.6}
                onPress={dismissModal}
              >
                <Text style={[styles.laterBtnText, { color: isDarkMode ? '#64748B' : '#94A3B8' }]}>
                  Remind Me Later
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  dialogCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
    zIndex: 1000000,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  versionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  verCol: {
    alignItems: 'center',
  },
  verLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  verVal: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  notesBox: {
    marginBottom: 16,
    maxHeight: 100,
  },
  notesHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesScroll: {
    maxHeight: 75,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressSubtext: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  installHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  installHint: {
    fontSize: 11,
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  btnStack: {
    gap: 10,
    marginTop: 4,
  },
  primaryBtnOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  laterBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default AppUpdateModal;
