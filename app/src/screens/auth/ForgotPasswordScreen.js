import React, { useState } from 'react';
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

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email address is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.FORGOT_PASSWORD, { email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Something went wrong. Please try again.';
      setEmailError(msg);
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

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.logoWrapper}>
              <MaterialCommunityIcons name="lock-reset" size={40} color="#ffffff" />
            </View>
            <Text style={styles.appName}>Forgot Password?</Text>
            <Text style={styles.tagline}>
              No worries! Enter your email and we'll send reset instructions.
            </Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {!submitted ? (
              <>
                <View style={styles.welcomeSection}>
                  <Text style={styles.welcomeTitle}>Reset Password</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Enter the email address associated with your Growvest account.
                  </Text>
                </View>

                <View style={styles.infoBanner}>
                  <MaterialCommunityIcons name="information-outline" size={20} color="#065f46" />
                  <Text style={styles.infoText}>
                    We will send a password reset link to your email address. Please check your spam folder if you don't see it.
                  </Text>
                </View>

                <View style={styles.formSection}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      value={email}
                      onChangeText={(v) => {
                        setEmail(v);
                        if (emailError) setEmailError('');
                      }}
                      mode="flat"
                      style={styles.input}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      placeholder="Enter your registered email"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      error={!!emailError}
                      left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
                    />
                    {!!emailError && (
                      <View style={styles.errorRow}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.error} />
                        <Text style={styles.errorText}>{emailError}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                    activeOpacity={0.85}
                    onPress={handleSend}
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
                          <Text style={styles.submitBtnText}>Sending...</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.submitBtnText}>Send Reset Link</Text>
                          <MaterialCommunityIcons name="send" size={18} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backToLogin}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="arrow-left" size={16} color={themeColors.primary || colors.primary} />
                    <Text style={styles.backToLoginText}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Success State */
              <View style={styles.successContainer}>
                <View style={styles.successIconWrapper}>
                  <LinearGradient
                    colors={['#d1fae5', '#a7f3d0']}
                    style={styles.successIconBg}
                  >
                    <MaterialCommunityIcons name="email-check-outline" size={48} color="#065f46" />
                  </LinearGradient>
                </View>
                <Text style={styles.successTitle}>Check Your Email</Text>
                <Text style={styles.successMessage}>
                  We've sent a password reset link to{'\n'}
                  <Text style={styles.successEmail}>{email.trim().toLowerCase()}</Text>
                </Text>
                <View style={styles.successTips}>
                  <View style={styles.tipRow}>
                    <MaterialCommunityIcons name="clock-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.tipText}>The link expires in 15 minutes.</Text>
                  </View>
                  <View style={styles.tipRow}>
                    <MaterialCommunityIcons name="email-search-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.tipText}>Check your spam or junk folder if you don't see it.</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={() => {
                    setSubmitted(false);
                    handleSend();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendBtnText}>Didn't receive email? Resend</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backToLoginSuccess}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backToLoginSuccessText}>Return to Sign In</Text>
                </TouchableOpacity>
              </View>
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

  // Header
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
  backBtn: {
    position: 'absolute', top: Platform.OS === 'android' ? 36 : 52, left: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoWrapper: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 26, fontWeight: '800', color: colors.primaryFg, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  // Form Card
  formCard: {
    backgroundColor: themeColors.surface || colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -28, flex: 1,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 50,
    minHeight: height * 0.68,
  },
  welcomeSection: { marginBottom: 18 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: themeColors.text || colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: themeColors.textMuted || colors.textMuted, lineHeight: 20 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#d1fae5', borderRadius: 14,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#6ee7b7',
  },
  infoText: { flex: 1, fontSize: 13, color: '#065f46', lineHeight: 18, fontWeight: '500' },

  formSection: { gap: 0 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text || colors.text, marginBottom: 8 },
  input: {
    backgroundColor: themeColors.background || colors.background,
    borderRadius: 16, height: 56, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: themeColors.border || colors.border,
    fontSize: 15,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  errorText: { fontSize: 12, color: colors.error, fontWeight: '500' },

  submitBtn: {
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10, marginBottom: 16,
  },
  submitBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  backToLogin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  backToLoginText: { fontSize: 14, fontWeight: '700', color: themeColors.primary || colors.primary },

  // Success state styles
  successContainer: { alignItems: 'center', paddingVertical: 10 },
  successIconWrapper: { marginBottom: 20 },
  successIconBg: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: themeColors.text || colors.text, marginBottom: 8 },
  successMessage: {
    fontSize: 14, color: themeColors.textMuted || colors.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  successEmail: { fontWeight: '700', color: themeColors.text || colors.text },
  successTips: {
    backgroundColor: themeColors.background || colors.background, borderRadius: 16,
    padding: 16, width: '100%', gap: 10, marginBottom: 24,
    borderWidth: 1, borderColor: themeColors.border || colors.border,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { fontSize: 13, color: themeColors.textMuted || colors.textMuted, flex: 1 },
  resendBtn: { marginBottom: 16, paddingVertical: 8 },
  resendBtnText: { fontSize: 14, fontWeight: '600', color: themeColors.primary || colors.primary, textAlign: 'center' },
  backToLoginSuccess: {
    backgroundColor: themeColors.primary || colors.primary, borderRadius: 16,
    height: 52, width: '100%', justifyContent: 'center', alignItems: 'center',
  },
  backToLoginSuccessText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default ForgotPasswordScreen;
