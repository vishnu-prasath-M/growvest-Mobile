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

const ForgotPasswordScreen = ({ navigation }) => {
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
    } catch (error) {
      const msg = error.response?.data?.message || 'Something went wrong. Please try again.';
      setEmailError(msg);
    } finally {
      setLoading(false);
    }
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
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <View style={styles.logoWrapper}>
              <MaterialCommunityIcons name="lock-reset" size={40} color={colors.primaryFg} />
            </View>
            <Text style={styles.appName}>Forgot Password</Text>
            <Text style={styles.tagline}>We'll send a reset link to your email</Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {!submitted ? (
              <>
                <View style={styles.welcomeSection}>
                  <Text style={styles.welcomeTitle}>Reset Password</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Enter your registered email address to receive a password reset link.
                  </Text>
                </View>

                {/* Info Banner */}
                <View style={styles.infoBanner}>
                  <MaterialCommunityIcons name="email-outline" size={18} color="#1A5C39" />
                  <Text style={styles.infoText}>
                    Enter your registered email address. Since passwords are account-based, email is the supported recovery method.
                  </Text>
                </View>

                <View style={styles.formSection}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      value={email}
                      onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                      mode="flat"
                      style={styles.input}
                      underlineColor="transparent"
                      activeUnderlineColor="transparent"
                      placeholder="Enter your registered email"
                      placeholderTextColor={colors.textTertiary}
                      error={!!emailError}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      returnKeyType="send"
                      onSubmitEditing={handleSend}
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
                    <MaterialCommunityIcons name="arrow-left" size={16} color={colors.primary} />
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
                  <View style={styles.tipRow}>
                    <MaterialCommunityIcons name="shield-check-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.tipText}>The link is single-use only for security.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={() => { setSubmitted(false); setEmailError(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resendBtnText}>Didn't receive it? Try again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backToLoginFull}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.backToLoginGradient}
                  >
                    <MaterialCommunityIcons name="arrow-left" size={18} color="#fff" />
                    <Text style={styles.backToLoginFullText}>Back to Login</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
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

  // Header
  headerArea: {
    height: height * 0.38,
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
  backBtn: {
    position: 'absolute', top: Platform.OS === 'android' ? 44 : 56, left: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoWrapper: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 26, fontWeight: '800', color: colors.primaryFg, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },

  // Form Card
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -40, flex: 1,
    paddingHorizontal: 24, paddingTop: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  welcomeSection: { marginBottom: 20 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#d1fae5', borderRadius: 14,
    padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: '#6ee7b7',
  },
  infoText: { flex: 1, fontSize: 13, color: '#065f46', lineHeight: 18, fontWeight: '500' },

  formSection: { gap: 0 },
  inputContainer: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16, height: 56, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.border,
    fontSize: 15,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  errorText: { fontSize: 12, color: colors.error, fontWeight: '500' },

  submitBtn: {
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  backToLogin: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 20, paddingVertical: 8,
  },
  backToLoginText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  // Success state
  successContainer: { alignItems: 'center', paddingTop: 16, paddingBottom: 32 },
  successIconWrapper: { marginBottom: 20 },
  successIconBg: {
    width: 100, height: 100, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 10 },
  successMessage: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successEmail: { fontWeight: '700', color: colors.text },
  successTips: { width: '100%', gap: 10, marginBottom: 28 },
  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.background, borderRadius: 12, padding: 12,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  resendBtn: { paddingVertical: 8, marginBottom: 16 },
  resendBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  backToLoginFull: { width: '100%' },
  backToLoginGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14, gap: 8,
  },
  backToLoginFullText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default ForgotPasswordScreen;
