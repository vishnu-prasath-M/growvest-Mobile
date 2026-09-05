import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';

const { height } = Dimensions.get('window');

const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

const getPasswordStrength = (pass) => {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  return score; // 0 to 4
};

const ResetPasswordScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);

  // Read token/email from deep link route params
  const rawToken = route?.params?.token || '';
  const rawEmail = route?.params?.email || '';

  const [token] = useState(rawToken);
  const [email] = useState(rawEmail);

  // States
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [invalidReason, setInvalidReason] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [resetSuccess, setResetSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setInvalidReason('No reset token provided. Please request a new link.');
      return;
    }

    let isMounted = true;
    const verifyToken = async () => {
      try {
        const res = await api.get(API_ENDPOINTS.VERIFY_RESET_TOKEN(token));
        if (isMounted) {
          if (res.data?.valid) {
            setTokenValid(true);
          } else {
            setTokenValid(false);
            setInvalidReason(res.data?.message || 'This reset link is invalid or has expired.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setTokenValid(false);
          const msg = err.response?.data?.message || 'This reset link is invalid or has expired.';
          setInvalidReason(msg);
        }
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    verifyToken();
    return () => { isMounted = false; };
  }, [token]);

  const strength = getPasswordStrength(password);

  const validate = () => {
    const newErrors = {};
    if (!password) {
      newErrors.password = 'New password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }
    if (!confirm) {
      newErrors.confirm = 'Please confirm your password.';
    } else if (password !== confirm) {
      newErrors.confirm = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.RESET_PASSWORD, {
        token,
        newPassword: password,
      });
      setResetSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password. Please try again.';
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.headerGradientBg}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          bounces={true}
        >
          {/* Header */}
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerArea}
          >
            <View style={styles.blobTopRight} />
            <View style={styles.blobBottomGold} />

            <View style={styles.logoWrapper}>
              <MaterialCommunityIcons name="shield-key-outline" size={40} color="#ffffff" />
            </View>
            <Text style={styles.appName}>Set New Password</Text>
            <Text style={styles.tagline}>Create a strong, secure password for your account.</Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {verifying ? (
              <View style={styles.centeredState}>
                <ActivityIndicator size="large" color={themeColors.primary || colors.primary} />
                <Text style={styles.verifyingText}>Verifying your reset link...</Text>
              </View>
            ) : !tokenValid ? (
              /* Invalid / Expired Token State */
              <View style={styles.centeredState}>
                <View style={styles.errorIconWrapper}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
                </View>
                <Text style={styles.invalidTitle}>Link Invalid or Expired</Text>
                <Text style={styles.invalidMessage}>{invalidReason}</Text>
                <TouchableOpacity
                  style={styles.requestNewBtn}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                    style={styles.requestNewGradient}
                  >
                    <Text style={styles.requestNewText}>Request New Link</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backToLoginTextBtn}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.backToLoginTextOnly}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            ) : resetSuccess ? (
              /* Success State */
              <View style={styles.centeredState}>
                <View style={styles.successIconWrapper}>
                  <MaterialCommunityIcons name="check-circle-outline" size={56} color="#10b981" />
                </View>
                <Text style={styles.invalidTitle}>Password Reset Complete!</Text>
                <Text style={styles.invalidMessage}>
                  Your password has been updated successfully. You can now sign in with your new credentials.
                </Text>
                <TouchableOpacity
                  style={styles.requestNewBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                    style={styles.requestNewGradient}
                  >
                    <Text style={styles.requestNewText}>Sign In Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              /* Active Form */
              <>
                <View style={styles.welcomeSection}>
                  <Text style={styles.welcomeTitle}>New Password</Text>
                  {!!email && <Text style={styles.welcomeSubtitle}>Resetting password for {email}</Text>}
                </View>

                {!!errors.form && (
                  <View style={styles.formErrorBanner}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color={colors.error} />
                    <Text style={styles.formErrorText}>{errors.form}</Text>
                  </View>
                )}

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
                    mode="flat"
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    placeholder="Min. 8 characters"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showPassword}
                    error={!!errors.password}
                    left={<TextInput.Icon icon="lock-outline" color={colors.textMuted} />}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowPassword(!showPassword)}
                        color={colors.textMuted}
                      />
                    }
                  />
                  {/* Strength Bar */}
                  {!!password && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthTrack}>
                        <View
                          style={[
                            styles.strengthFill,
                            {
                              width: `${(strength / 4) * 100}%`,
                              backgroundColor: STRENGTH_COLORS[strength - 1] || '#9ca3af',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength - 1] || '#9ca3af' }]}>
                        {STRENGTH_LABELS[strength - 1] || ''}
                      </Text>
                    </View>
                  )}
                  {!!errors.password && (
                    <View style={styles.errorRow}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.error} />
                      <Text style={styles.errorText}>{errors.password}</Text>
                    </View>
                  )}
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <TextInput
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: undefined })); }}
                    mode="flat"
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    placeholder="Re-enter new password"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showConfirm}
                    error={!!errors.confirm}
                    left={<TextInput.Icon icon="lock-check-outline" color={colors.textMuted} />}
                    right={
                      <TextInput.Icon
                        icon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                        onPress={() => setShowConfirm(!showConfirm)}
                        color={colors.textMuted}
                      />
                    }
                  />
                  {!!errors.confirm && (
                    <View style={styles.errorRow}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.error} />
                      <Text style={styles.errorText}>{errors.confirm}</Text>
                    </View>
                  )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  activeOpacity={0.85}
                  onPress={handleReset}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitBtnGradient}
                  >
                    {loading ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.submitBtnText}>Resetting...</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>Update Password</Text>
                        <MaterialCommunityIcons name="check" size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView style={styles.safeAreaBottom} edges={['bottom']} />
    </View>
  );
};

const getStyles = (themeColors) => StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: themeColors.surface || colors.surface },
  headerSafeArea: { backgroundColor: '#0E3D23' },
  headerGradientBg: { height: 0 },
  safeAreaBottom: { backgroundColor: themeColors.surface || colors.surface },
  keyboardView: { flex: 1, backgroundColor: themeColors.surface || colors.surface },
  scrollView: { flex: 1, backgroundColor: themeColors.surface || colors.surface },
  scrollContent: { flexGrow: 1, backgroundColor: themeColors.surface || colors.surface },

  headerArea: {
    height: height * 0.35,
    paddingTop: Platform.OS === 'android' ? 36 : 52,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  blobTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  blobBottomGold: {
    position: 'absolute', bottom: 40, left: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(212,168,67,0.18)',
  },
  logoWrapper: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },

  formCard: {
    backgroundColor: themeColors.surface || colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -28, flex: 1,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 50,
    minHeight: height * 0.68,
  },

  centeredState: { flex: 1, alignItems: 'center', paddingTop: 20, paddingBottom: 32 },
  verifyingText: { fontSize: 14, color: themeColors.textMuted || colors.textMuted, marginTop: 16, fontWeight: '500' },

  errorIconWrapper: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.errorLight || '#fee2e2',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  invalidTitle: { fontSize: 22, fontWeight: '800', color: themeColors.text || colors.text, marginBottom: 8, textAlign: 'center' },
  invalidMessage: {
    fontSize: 14, color: themeColors.textMuted || colors.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 16,
  },
  requestNewBtn: { width: '100%', marginBottom: 14 },
  requestNewGradient: {
    height: 54, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  requestNewText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  backToLoginTextBtn: { paddingVertical: 8 },
  backToLoginTextOnly: { fontSize: 14, fontWeight: '600', color: themeColors.primary || colors.primary },

  successIconWrapper: { marginBottom: 20 },

  welcomeSection: { marginBottom: 20 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: themeColors.text || colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: themeColors.textMuted || colors.textMuted },

  formErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fee2e2', borderRadius: 12,
    padding: 12, marginBottom: 16,
  },
  formErrorText: { fontSize: 13, color: colors.error, fontWeight: '500', flex: 1 },

  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text || colors.text, marginBottom: 6 },
  input: {
    backgroundColor: themeColors.background || colors.background,
    borderRadius: 16, height: 54, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: themeColors.border || colors.border,
    fontSize: 15,
  },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthTrack: { flex: 1, height: 4, backgroundColor: themeColors.border || colors.border, borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', width: 48, textAlign: 'right' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: colors.error, fontWeight: '500' },

  submitBtn: {
    marginTop: 12, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  submitBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default ResetPasswordScreen;
