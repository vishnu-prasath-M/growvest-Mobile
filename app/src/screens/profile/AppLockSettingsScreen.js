import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppLock } from '../../context/AppLockContext';
import { appLockService } from '../../services/appLockService';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIMEOUT_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '30 Seconds (Default)', value: 30000 },
  { label: '1 Minute', value: 60000 },
  { label: '5 Minutes', value: 300000 },
];

export default function AppLockSettingsScreen({ navigation }) {
  const { colors: themeColors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const {
    isAppLockEnabled,
    isBiometricEnabled,
    pinLength: currentPinLength,
    lockTimeout,
    biometricInfo,
    refreshLockPreferences,
  } = useAppLock();

  const userId = user?._id || user?.id;

  // Setup / Change PIN Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('setup'); // 'setup' | 'change' | 'verify_disable'
  const [step, setStep] = useState(1); // 1: enter (or current), 2: confirm (or new), 3: confirm new

  const [selectedLength, setSelectedLength] = useState(4);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinFirst, setPinFirst] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  // Biometric prompt modal after initial setup
  const [promptBiometricVisible, setPromptBiometricVisible] = useState(false);

  // Disable Confirmation Modal
  const [disableModalVisible, setDisableModalVisible] = useState(false);

  const resetPinInputs = () => {
    setPinCurrent('');
    setPinFirst('');
    setPinConfirm('');
    setPinError('');
    setStep(1);
  };

  /**
   * Handle App Lock Switch Toggle
   */
  const handleToggleLock = (value) => {
    if (value) {
      // User wants to enable App Lock -> Open Setup Wizard
      resetPinInputs();
      setSelectedLength(4);
      setModalMode('setup');
      setModalVisible(true);
    } else {
      // User wants to disable App Lock -> Must verify current PIN or Biometrics first
      resetPinInputs();
      setModalMode('verify_disable');
      setModalVisible(true);
    }
  };

  /**
   * Handle Key Press inside Setup/Change/Verify Modal
   */
  const handleKeyPress = async (digit) => {
    setPinError('');

    if (modalMode === 'setup') {
      if (step === 1) {
        const next = pinFirst + digit;
        if (next.length <= selectedLength) {
          setPinFirst(next);
          if (next.length === selectedLength) {
            // Move to confirm step
            setTimeout(() => setStep(2), 150);
          }
        }
      } else if (step === 2) {
        const next = pinConfirm + digit;
        if (next.length <= selectedLength) {
          setPinConfirm(next);
          if (next.length === selectedLength) {
            // Check match
            if (next === pinFirst) {
              // Save PIN
              await appLockService.setAppLockPin(userId, next, isBiometricEnabled);
              await refreshLockPreferences();
              setModalVisible(false);
              resetPinInputs();

              // If device supports biometrics, offer immediate toggle
              if (biometricInfo.hasHardware && biometricInfo.isEnrolled) {
                setPromptBiometricVisible(true);
              } else {
                Alert.alert('Success', 'App Lock enabled successfully.');
              }
            } else {
              setPinError('PINs do not match. Please try again.');
              setPinConfirm('');
            }
          }
        }
      }
    } else if (modalMode === 'change') {
      const len = currentPinLength || 4;
      if (step === 1) {
        // Verify current PIN
        const next = pinCurrent + digit;
        if (next.length <= len) {
          setPinCurrent(next);
          if (next.length === len) {
            const isValid = await appLockService.verifyPin(userId, next);
            if (isValid) {
              setTimeout(() => {
                setStep(2);
                setPinError('');
              }, 150);
            } else {
              setPinError('Current PIN is incorrect');
              setPinCurrent('');
            }
          }
        }
      } else if (step === 2) {
        // Enter new PIN
        const next = pinFirst + digit;
        if (next.length <= selectedLength) {
          setPinFirst(next);
          if (next.length === selectedLength) {
            setTimeout(() => setStep(3), 150);
          }
        }
      } else if (step === 3) {
        // Confirm new PIN
        const next = pinConfirm + digit;
        if (next.length <= selectedLength) {
          setPinConfirm(next);
          if (next.length === selectedLength) {
            if (next === pinFirst) {
              await appLockService.setAppLockPin(userId, next, isBiometricEnabled);
              await refreshLockPreferences();
              setModalVisible(false);
              resetPinInputs();
              Alert.alert('Success', 'PIN updated successfully.');
            } else {
              setPinError('PINs do not match. Please try again.');
              setPinConfirm('');
            }
          }
        }
      }
    } else if (modalMode === 'verify_disable') {
      const len = currentPinLength || 4;
      const next = pinCurrent + digit;
      if (next.length <= len) {
        setPinCurrent(next);
        if (next.length === len) {
          const isValid = await appLockService.verifyPin(userId, next);
          if (isValid) {
            setModalVisible(false);
            resetPinInputs();
            setDisableModalVisible(true);
          } else {
            setPinError('Incorrect PIN');
            setPinCurrent('');
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setPinError('');
    if (modalMode === 'setup') {
      if (step === 1) setPinFirst((p) => p.slice(0, -1));
      if (step === 2) setPinConfirm((p) => p.slice(0, -1));
    } else if (modalMode === 'change') {
      if (step === 1) setPinCurrent((p) => p.slice(0, -1));
      if (step === 2) setPinFirst((p) => p.slice(0, -1));
      if (step === 3) setPinConfirm((p) => p.slice(0, -1));
    } else if (modalMode === 'verify_disable') {
      setPinCurrent((p) => p.slice(0, -1));
    }
  };

  /**
   * Biometric verification during disable flow
   */
  const handleBiometricVerifyForDisable = async () => {
    if (!biometricInfo.hasHardware || !biometricInfo.isEnrolled) return;
    const result = await appLockService.authenticateWithBiometrics('Verify biometric to disable App Lock');
    if (result.success) {
      setModalVisible(false);
      resetPinInputs();
      setDisableModalVisible(true);
    }
  };

  /**
   * Confirm Disable App Lock
   */
  const handleConfirmDisable = async () => {
    await appLockService.disableAppLock(userId);
    await refreshLockPreferences();
    setDisableModalVisible(false);
    Alert.alert('Disabled', 'App Lock has been disabled.');
  };

  /**
   * Toggle Biometrics
   */
  const handleToggleBiometric = async (value) => {
    if (!biometricInfo.hasHardware) {
      Alert.alert('Not Supported', 'Biometric authentication is not supported on this device.');
      return;
    }
    if (!biometricInfo.isEnrolled) {
      Alert.alert('Not Configured', 'Please set up a Fingerprint or Face lock in your device settings first.');
      return;
    }

    await appLockService.setBiometricEnabled(userId, value);
    await refreshLockPreferences();
  };

  /**
   * Change Lock Timeout
   */
  const handleSelectTimeout = async (val) => {
    await appLockService.setLockTimeout(userId, val);
    await refreshLockPreferences();
  };

  // Compute active PIN length for current step
  const activeTargetLength =
    modalMode === 'verify_disable' || (modalMode === 'change' && step === 1)
      ? currentPinLength || 4
      : selectedLength;

  const currentEnteredValue =
    modalMode === 'setup'
      ? step === 1
        ? pinFirst
        : pinConfirm
      : modalMode === 'change'
      ? step === 1
        ? pinCurrent
        : step === 2
        ? pinFirst
        : pinConfirm
      : pinCurrent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>App Lock</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <LinearGradient
          colors={['#0E3D23', '#1A5C39']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIconCircle}>
            <MaterialCommunityIcons name="shield-lock-outline" size={28} color="#0E3D23" />
          </View>
          <Text style={styles.heroTitle}>Growvest Device Protection</Text>
          <Text style={styles.heroSubtitle}>
            Protect your investments, wallet balance, and transactions with a local PIN or biometric unlock.
          </Text>
        </LinearGradient>

        {/* Master Switch Card */}
        <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
          <View style={styles.rowBetween}>
            <View style={styles.iconLabelGroup}>
              <View style={[styles.iconBox, { backgroundColor: isAppLockEnabled ? '#DCFCE7' : '#F1F5F9' }]}>
                <MaterialCommunityIcons
                  name={isAppLockEnabled ? 'lock' : 'lock-open-outline'}
                  size={20}
                  color={isAppLockEnabled ? '#16A34A' : '#64748B'}
                />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: themeColors.text }]}>App Lock</Text>
                <Text style={styles.rowSubtitle}>
                  {isAppLockEnabled ? 'App is protected' : 'App opens without authentication'}
                </Text>
              </View>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={handleToggleLock}
              trackColor={{ false: '#E2E8F0', true: '#16A34A' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Extended Settings (Only visible if enabled) */}
        {isAppLockEnabled && (
          <>
            {/* PIN & Biometric Settings Group */}
            <Text style={styles.sectionHeader}>SECURITY METHOD</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              {/* Change PIN Option */}
              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                onPress={() => {
                  resetPinInputs();
                  setSelectedLength(currentPinLength || 4);
                  setModalMode('change');
                  setModalVisible(true);
                }}
              >
                <View style={styles.iconLabelGroup}>
                  <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                    <MaterialCommunityIcons name="form-textbox-password" size={20} color="#0284C7" />
                  </View>
                  <View>
                    <Text style={[styles.rowTitle, { color: themeColors.text }]}>Change App Lock PIN</Text>
                    <Text style={styles.rowSubtitle}>{currentPinLength}-digit PIN active</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Biometric Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.iconLabelGroup}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor:
                          biometricInfo.hasHardware && biometricInfo.isEnrolled
                            ? '#FEF3C7'
                            : '#F1F5F9',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={biometricInfo.biometryType === 'Face' ? 'face-recognition' : 'fingerprint'}
                      size={20}
                      color={
                        biometricInfo.hasHardware && biometricInfo.isEnrolled
                          ? '#D97706'
                          : '#94A3B8'
                      }
                    />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.rowTitle, { color: themeColors.text }]}>
                      {biometricInfo.label || 'Biometric Unlock'}
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      {!biometricInfo.hasHardware
                        ? 'Biometric authentication is not available on this device'
                        : !biometricInfo.isEnrolled
                        ? 'No biometrics enrolled in device settings'
                        : `Unlock using ${biometricInfo.biometryType || 'Fingerprint'}`}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isBiometricEnabled && biometricInfo.hasHardware && biometricInfo.isEnrolled}
                  onValueChange={handleToggleBiometric}
                  disabled={!biometricInfo.hasHardware || !biometricInfo.isEnrolled}
                  trackColor={{ false: '#E2E8F0', true: '#16A34A' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Auto Lock Timeout Group */}
            <Text style={styles.sectionHeader}>AUTO-LOCK TIMEOUT</Text>
            <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
              {TIMEOUT_OPTIONS.map((opt, idx) => {
                const isSelected = lockTimeout === opt.value;
                return (
                  <View key={opt.value}>
                    {idx > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={styles.settingRow}
                      activeOpacity={0.7}
                      onPress={() => handleSelectTimeout(opt.value)}
                    >
                      <View style={styles.iconLabelGroup}>
                        <View
                          style={[
                            styles.iconBox,
                            { backgroundColor: isSelected ? '#DCFCE7' : '#F8FAFC' },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="timer-outline"
                            size={20}
                            color={isSelected ? '#16A34A' : '#64748B'}
                          />
                        </View>
                        <Text
                          style={[
                            styles.rowTitle,
                            { color: isSelected ? '#16A34A' : themeColors.text, fontWeight: isSelected ? '700' : '500' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={20} color="#16A34A" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Security Info Card */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="shield-check" size={20} color="#16A34A" />
          <Text style={styles.infoText}>
            App Lock is stored locally on this device using hardware encryption. Your PIN is never sent to our servers.
          </Text>
        </View>
      </ScrollView>

      {/* Setup / Change / Verify PIN Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSafeArea} edges={['bottom']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setModalVisible(false);
                  resetPinInputs();
                }}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>
                {modalMode === 'setup'
                  ? step === 1
                    ? 'Set App Lock PIN'
                    : 'Confirm App Lock PIN'
                  : modalMode === 'change'
                  ? step === 1
                    ? 'Enter Current PIN'
                    : step === 2
                    ? 'Enter New PIN'
                    : 'Confirm New PIN'
                  : 'Verify Current PIN'}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* PIN Length Selector (Only on Setup Step 1) */}
            {modalMode === 'setup' && step === 1 && (
              <View style={styles.lengthSelector}>
                <TouchableOpacity
                  style={[styles.lengthBtn, selectedLength === 4 && styles.lengthBtnActive]}
                  onPress={() => {
                    setSelectedLength(4);
                    setPinFirst('');
                  }}
                >
                  <Text style={[styles.lengthText, selectedLength === 4 && styles.lengthTextActive]}>
                    4-Digit PIN
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.lengthBtn, selectedLength === 6 && styles.lengthBtnActive]}
                  onPress={() => {
                    setSelectedLength(6);
                    setPinFirst('');
                  }}
                >
                  <Text style={[styles.lengthText, selectedLength === 6 && styles.lengthTextActive]}>
                    6-Digit PIN
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Subtitle */}
            <Text style={styles.modalSubtitle}>
              {modalMode === 'setup'
                ? step === 1
                  ? `Enter a ${selectedLength}-digit security PIN`
                  : 'Re-enter your PIN to confirm'
                : modalMode === 'change'
                ? step === 1
                  ? 'Enter your current PIN to continue'
                  : step === 2
                  ? `Enter your new ${selectedLength}-digit PIN`
                  : 'Re-enter your new PIN to confirm'
                : 'Enter your PIN to disable App Lock'}
            </Text>

            {/* PIN Dots */}
            <View style={styles.dotsRow}>
              {Array.from({ length: activeTargetLength }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < currentEnteredValue.length && styles.dotFilled,
                    pinError ? styles.dotError : null,
                  ]}
                />
              ))}
            </View>

            {/* Error Message */}
            <View style={styles.errorContainer}>
              {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
            </View>

            {/* Keypad */}
            <View style={styles.keypad}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
              ].map((row, rIdx) => (
                <View key={rIdx} style={styles.keyRow}>
                  {row.map((digit) => (
                    <TouchableOpacity
                      key={digit}
                      style={styles.keyButton}
                      activeOpacity={0.65}
                      onPress={() => handleKeyPress(digit)}
                    >
                      <Text style={styles.keyText}>{digit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              <View style={styles.keyRow}>
                {/* Biometric shortcut for verify_disable */}
                {modalMode === 'verify_disable' && isBiometricEnabled && biometricInfo.hasHardware ? (
                  <TouchableOpacity
                    style={styles.keyButtonSpecial}
                    onPress={handleBiometricVerifyForDisable}
                  >
                    <MaterialCommunityIcons
                      name={biometricInfo.biometryType === 'Face' ? 'face-recognition' : 'fingerprint'}
                      size={28}
                      color="#E8D083"
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.keyButtonSpecial} />
                )}

                <TouchableOpacity
                  style={styles.keyButton}
                  activeOpacity={0.65}
                  onPress={() => handleKeyPress('0')}
                >
                  <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.keyButtonSpecial}
                  activeOpacity={0.65}
                  onPress={handleDelete}
                >
                  <Ionicons name="backspace-outline" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Biometric Prompt Offer Modal after successful PIN setup */}
      <Modal visible={promptBiometricVisible} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBox}>
              <MaterialCommunityIcons
                name={biometricInfo.biometryType === 'Face' ? 'face-recognition' : 'fingerprint'}
                size={32}
                color="#0E3D23"
              />
            </View>
            <Text style={styles.confirmTitle}>Enable {biometricInfo.label || 'Biometrics'}?</Text>
            <Text style={styles.confirmSubtitle}>
              Would you like to use your {biometricInfo.biometryType || 'fingerprint'} for faster unlock?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setPromptBiometricVisible(false)}
              >
                <Text style={styles.confirmTextCancel}>PIN Only</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtnAction}
                onPress={async () => {
                  await appLockService.setBiometricEnabled(userId, true);
                  await refreshLockPreferences();
                  setPromptBiometricVisible(false);
                  Alert.alert('Success', 'App Lock and Biometric unlock enabled!');
                }}
              >
                <Text style={styles.confirmTextAction}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disable App Lock Confirmation Modal */}
      <Modal visible={disableModalVisible} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={[styles.confirmIconBox, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="shield-off-outline" size={32} color="#DC2626" />
            </View>
            <Text style={styles.confirmTitle}>Disable App Lock?</Text>
            <Text style={styles.confirmSubtitle}>
              Your app will open without requiring PIN or biometric verification.
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmBtnCancel}
                onPress={() => setDisableModalVisible(false)}
              >
                <Text style={styles.confirmTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtnAction, { backgroundColor: '#DC2626' }]}
                onPress={handleConfirmDisable}
              >
                <Text style={styles.confirmTextAction}>Disable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 4,
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginLeft: 4,
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#071F12',
  },
  modalSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lengthSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 4,
    marginVertical: 10,
  },
  lengthBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  lengthBtnActive: {
    backgroundColor: '#0E3D23',
  },
  lengthText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  lengthTextActive: {
    color: '#E8D083',
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#E8D083',
    borderColor: '#E8D083',
    transform: [{ scale: 1.15 }],
  },
  dotError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorContainer: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    marginVertical: 10,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  keyButtonSpecial: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  confirmIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtnCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTextCancel: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtnAction: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0E3D23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTextAction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
