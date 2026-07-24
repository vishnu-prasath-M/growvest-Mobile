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
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';
import { colors } from '../../theme/theme';

const { height } = Dimensions.get('window');

// Password strength scorer (0-4)
const getPasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

const STRENGTH_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];

const ResetPasswordScreen = ({ navigation, route }) => {
  const token = route?.params?.token || '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenEmail, setTokenEmail] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenError('Invalid reset link. Please request a new one.');
      return;
    }
    (async () => {
      try {
        const res = await api.get(API_ENDPOINTS.VERIFY_RESET_TOKEN(token));
        if (res.data.valid) {
          setTokenValid(true);
          setTokenEmail(res.data.email || '');
        } else {
          setTokenError(res.data.message || 'This link is invalid or has expired.');
        }
      } catch {
        setTokenError('This reset link is invalid or has expired. Please request a new one.');
      } finally {
        setVerifying(false);
      }
    })();
  }, [token]);

  const validate = () => {
    const newErrors = {};
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!confirm) newErrors.confirm = 'Please confirm your password';
    else if (password !== confirm) newErrors.confirm = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.RESET_PASSWORD, { token, password });
      setSuccess(true);
    } catch (error) {
      const msg = error.response?.data?.message || 'Something went wrong. Please try again.';
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (verifying) {
      return (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.verifyingText}>Verifying reset link...</Text>
        </View>
      );
    }

    if (!tokenValid) {
      return (
        <View style={styles.centeredState}>
          <View style={styles.errorIconWrapper}>
            <MaterialCommunityIcons name="link-off" size={48} color={colors.error} />
          </View>
          <Text style={styles.errorStateTitle}>Link Expired</Text>
          <Text style={styles.errorStateMsg}>{tokenError}</Text>
          <TouchableOpacity
            style={styles.requestNewBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.requestNewBtnGradient}
            >
              <Text style={styles.requestNewBtnText}>Request New Link</Text>
              <MaterialCommunityIcons name="email-sync-outline" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (success) {
      return (
        <View style={styles.centeredState}>
          <View style={styles.successIconWrapper}>
            <LinearGradient colors={['#d1fae5', '#a7f3d0']} style={styles.successIconBg}>
              <MaterialCommunityIcons name="check-circle-outline" size={56} color="#065f46" />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successMsg}>
            Your password has been updated successfully.{'\n'}
            You can now log in with your new password.
          </Text>
          <TouchableOpacity
            style={styles.loginNowBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginNowGradient}
            >
              <Text style={styles.loginNowText}>Log In Now</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Set New Password</Text>
          <Text style={styles.welcomeSubtitle}>
            Creating a new password for{'\n'}
            <Text style={styles.emailHighlight}>{tokenEmail}</Text>
          </Text>
        </View>

        {/* Form-level error */}
        {!!errors.form && (
          <View style={styles.formErrorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.formErrorText}>{errors.form}</Text>
          </View>
        )}

        <View style={styles.formSection}>
          {/* New Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined, form: undefined })); }}
              mode="flat"
              style={styles.input}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              placeholder="Enter new password"
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
            {/* Strength bar */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarTrack}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        width: `${strength * 25}%`,
                        backgroundColor: STRENGTH_COLORS[strength - 1] || '#e5e7eb',
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
            {/* Rules hint */}
            <Text style={styles.hintText}>
              Min. 8 chars • Include uppercase, number, and symbol for a strong password.
            </Text>
          </View>

          {/* Confirm Password */}
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

          {/* Submit */}
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
                  <Text style={styles.submitBtnText}>Reset Password</Text>
                  <MaterialCommunityIcons name="lock-reset" size={18} color="#fff" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color={colors.primary} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Gradient Header */}
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerArea}
          >
            <View style={styles.blobTopRight} />
            <View style={styles.blobBottomGold} />
            <View style={styles.logoWrapper}>
              <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.primaryFg} />
            </View>
            <Text style={styles.appName}>Growvest</Text>
            <Text style={styles.tagline}>Secure Password Reset</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            {renderContent()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0E3D23' },
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, minHeight: height },

  headerArea: {
    height: height * 0.35,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
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
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -40, flex: 1,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },

  centeredState: { flex: 1, alignItems: 'center', paddingTop: 20, paddingBottom: 32 },
  verifyingText: { fontSize: 14, color: colors.textMuted, marginTop: 16, fontWeight: '500' },

  errorIconWrapper: {
    width: 96, height: 96, borderRadius: 24,
    backgroundColor: colors.errorLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  errorStateTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  errorStateMsg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 28, paddingHorizontal: 16 },

  requestNewBtn: { width: '100%', marginBottom: 16 },
  requestNewBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14, gap: 8,
  },
  requestNewBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  successIconWrapper: { marginBottom: 20 },
  successIconBg: {
    width: 104, height: 104, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 10 },
  successMsg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  loginNowBtn: { width: '100%' },
  loginNowGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 16, gap: 8,
  },
  loginNowText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  welcomeSection: { marginBottom: 24 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  emailHighlight: { fontWeight: '700', color: colors.text },

  formErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.errorLight, borderRadius: 12, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: colors.error + '40',
  },
  formErrorText: { flex: 1, fontSize: 13, color: colors.error, fontWeight: '500', lineHeight: 18 },

  formSection: { gap: 0 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16, height: 56, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.border, fontSize: 15,
  },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthBarTrack: { flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', width: 40, textAlign: 'right' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  errorText: { fontSize: 12, color: colors.error, fontWeight: '500' },
  hintText: { fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 16 },

  submitBtn: {
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10, marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  backToLoginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 20, paddingVertical: 8,
  },
  backToLoginText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});

export default ResetPasswordScreen;
