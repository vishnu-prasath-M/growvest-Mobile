import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppLock } from '../context/AppLockContext';
import { appLockService } from '../services/appLockService';
import { useAuth } from '../context/AuthContext';
import api from '../services/apiService';
import { API_ENDPOINTS } from '../config/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const AppLockOverlay = () => {
  const {
    isLocked,
    isBiometricEnabled,
    pinLength,
    biometricInfo,
    activeUserId,
    unlock,
    refreshLockPreferences,
  } = useAppLock();
  const { user, logout } = useAuth();

  const [enteredPin, setEnteredPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Forgot PIN Modal state
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  /**
   * Biometric Unlock Action
   */
  const handleBiometricUnlock = useCallback(async () => {
    if (!isBiometricEnabled || !biometricInfo.hasHardware || !biometricInfo.isEnrolled) {
      return;
    }

    setErrorMessage('');
    const result = await appLockService.authenticateWithBiometrics(
      `Unlock Growvest with ${biometricInfo.label || 'Biometrics'}`
    );

    if (result.success) {
      setEnteredPin('');
      unlock();
    } else if (result.error && result.error !== 'user_cancel' && result.error !== 'app_cancel') {
      setErrorMessage('Biometric verification failed. Please enter your PIN.');
    }
  }, [isBiometricEnabled, biometricInfo, unlock]);

  // Automatically prompt for Biometrics when lock screen appears
  useEffect(() => {
    if (isLocked && isBiometricEnabled) {
      const timer = setTimeout(() => {
        handleBiometricUnlock();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isLocked, isBiometricEnabled, handleBiometricUnlock]);

  /**
   * PIN Keypad Handler
   */
  const handleKeyPress = (digit) => {
    if (enteredPin.length >= pinLength || isVerifying) return;
    setErrorMessage('');
    const newPin = enteredPin + digit;
    setEnteredPin(newPin);

    if (newPin.length === pinLength) {
      verifyEnteredPin(newPin);
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setErrorMessage('');
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  /**
   * Verify entered PIN against stored salted hash
   */
  const verifyEnteredPin = async (pinToVerify) => {
    setIsVerifying(true);
    const userId = activeUserId || (await appLockService.getActiveUserId());
    const isValid = await appLockService.verifyPin(userId, pinToVerify);

    if (isValid) {
      setEnteredPin('');
      setIsVerifying(false);
      unlock();
    } else {
      triggerShake();
      setErrorMessage('Incorrect PIN. Please try again.');
      setEnteredPin('');
      setIsVerifying(false);
    }
  };

  /**
   * Forgot PIN - Verify Growvest Account Password
   */
  const handleVerifyAccountPassword = async () => {
    if (!accountPassword.trim()) {
      setForgotError('Please enter your account password');
      return;
    }

    setVerifyingPassword(true);
    setForgotError('');

    try {
      const emailOrUsername = user?.email || user?.username;
      if (!emailOrUsername) {
        throw new Error('User session not found. Please log in again.');
      }

      // Re-authenticate against Growvest login endpoint
      const response = await api.post(API_ENDPOINTS.LOGIN, {
        email: emailOrUsername,
        password: accountPassword.trim(),
      });

      if (response.data && response.data.token) {
        // Successful account re-authentication
        const userId = activeUserId || user?._id || user?.id;
        await appLockService.disableAppLock(userId);
        await refreshLockPreferences();

        setForgotModalVisible(false);
        setAccountPassword('');
        setEnteredPin('');
        unlock();
      } else {
        setForgotError('Invalid account password');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err?.message || 'Password verification failed';
      setForgotError(msg);
    } finally {
      setVerifyingPassword(false);
    }
  };

  if (!isLocked) {
    return null;
  }

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#071F12" />
      <LinearGradient
        colors={['#071F12', '#0E3D23', '#134E2C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Header & Logo */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <LinearGradient
                colors={['#E8D083', '#C89A30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoRing}
              >
                <View style={styles.logoInner}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={32} color="#0E3D23" />
                </View>
              </LinearGradient>
            </View>
            <Text style={styles.appTitle}>Growvest</Text>
            <Text style={styles.subtitle}>Enter your {pinLength}-digit App Lock PIN</Text>
          </View>

          {/* PIN Dots Display */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: pinLength }).map((_, index) => {
              const isFilled = index < enteredPin.length;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isFilled && styles.dotFilled,
                    errorMessage ? styles.dotError : null,
                  ]}
                />
              );
            })}
          </Animated.View>

          {/* Error Message */}
          <View style={styles.errorContainer}>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : isVerifying ? (
              <ActivityIndicator size="small" color="#E8D083" />
            ) : null}
          </View>

          {/* Keypad Grid */}
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

            {/* Bottom Row: Biometrics, 0, Backspace */}
            <View style={styles.keyRow}>
              {/* Biometrics Key */}
              {isBiometricEnabled && biometricInfo.hasHardware && biometricInfo.isEnrolled ? (
                <TouchableOpacity
                  style={styles.keyButtonSpecial}
                  activeOpacity={0.65}
                  onPress={handleBiometricUnlock}
                >
                  <MaterialCommunityIcons
                    name={biometricInfo.biometryType === 'Face' ? 'face-recognition' : 'fingerprint'}
                    size={30}
                    color="#E8D083"
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.keyButtonSpecial} />
              )}

              {/* 0 Key */}
              <TouchableOpacity
                style={styles.keyButton}
                activeOpacity={0.65}
                onPress={() => handleKeyPress('0')}
              >
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>

              {/* Delete Key */}
              <TouchableOpacity
                style={styles.keyButtonSpecial}
                activeOpacity={0.65}
                onPress={handleDelete}
              >
                <Ionicons name="backspace-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.forgotBtn}
              activeOpacity={0.7}
              onPress={() => {
                setForgotError('');
                setAccountPassword('');
                setForgotModalVisible(true);
              }}
            >
              <Text style={styles.forgotText}>Forgot App Lock PIN?</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Forgot PIN Modal (Verify Account Password) */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <MaterialCommunityIcons name="lock-reset" size={24} color="#0E3D23" />
              </View>
              <Text style={styles.modalTitle}>Reset App Lock PIN</Text>
              <Text style={styles.modalSubtitle}>
                Enter your Growvest account password to securely verify your identity and reset your PIN.
              </Text>
            </View>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Account Password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={accountPassword}
                onChangeText={(t) => {
                  setAccountPassword(t);
                  setForgotError('');
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {forgotError ? <Text style={styles.forgotErrorText}>{forgotError}</Text> : null}

            <View style={styles.modalActionButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setForgotModalVisible(false);
                  setAccountPassword('');
                  setForgotError('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, verifyingPassword && styles.disabledBtn]}
                onPress={handleVerifyAccountPassword}
                disabled={verifyingPassword}
              >
                {verifyingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Verify & Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoWrapper: {
    marginBottom: 16,
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#E8D083',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logoInner: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 18,
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
    height: 24,
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
  bottomActions: {
    alignItems: 'center',
    marginBottom: 10,
  },
  forgotBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  forgotText: {
    color: '#E8D083',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    elevation: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 8,
  },
  forgotErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0E3D23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
