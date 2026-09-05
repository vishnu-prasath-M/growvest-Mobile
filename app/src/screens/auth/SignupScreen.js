import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Dimensions,
  Image,
  StatusBar,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const SignupScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    const checkPendingRefCode = async () => {
      try {
        const savedCode = await AsyncStorage.getItem('pendingReferralCode');
        if (savedCode && savedCode.trim()) {
          setReferralCode(savedCode.trim().toUpperCase());
          return;
        }

        // Auto-check clipboard for copied GV referral code
        if (Clipboard && Clipboard.getString) {
          const clipText = await Clipboard.getString();
          if (clipText && typeof clipText === 'string') {
            const match = clipText.match(/GV[A-Z0-9]{4}/i);
            if (match && match[0]) {
              setReferralCode(match[0].toUpperCase());
            }
          }
        }
      } catch (e) {
        console.warn('Error reading pending referral code:', e);
      }
    };
    checkPendingRefCode();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!username.trim()) newErrors.username = 'Username is required';
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(mobileNumber.trim())) {
      newErrors.mobileNumber = 'Invalid mobile number (10 digits required)';
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await authService.register({
        username,
        mobileNumber,
        email: email.trim(),
        password,
        referralCode: referralCode.trim(),
      });
      await login(res.token, res);
    } catch (error) {
      Alert.alert('Signup Failed', error.message || 'Something went wrong');
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
          {/* Top Header Card */}
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerArea}
          >
            <View style={styles.blobTopRight} />

            <View style={styles.logoWrapper}>
              <Image
                source={require('../../../assets/growvest-logo.png')}
                style={{ width: 48, height: 48, borderRadius: 12 }}
              />
            </View>
            <Text style={styles.appName}>Join Growvest</Text>
            <Text style={styles.tagline}>Smart Wealth Creation</Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Create Account</Text>
              <Text style={styles.welcomeSubtitle}>Start your investment journey</Text>
            </View>

            <View style={styles.formSection}>
              {/* Username */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  mode="flat"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholder="Choose a username"
                  placeholderTextColor={colors.textTertiary}
                  error={!!errors.username}
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="account-outline" color={colors.textMuted} />}
                />
                {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
              </View>

              {/* Mobile Number */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <TextInput
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  mode="flat"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={10}
                  error={!!errors.mobileNumber}
                  left={<TextInput.Icon icon="phone-outline" color={colors.textMuted} />}
                />
                {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  mode="flat"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={!!errors.email}
                  left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {/* Password */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  mode="flat"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholder="Create a password"
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
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Referral Code (Optional) */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Referral Code (Optional)</Text>
                <TextInput
                  value={referralCode}
                  onChangeText={(val) => setReferralCode(val.toUpperCase())}
                  mode="flat"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholder="Enter referral code if any"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="characters"
                  left={<TextInput.Icon icon="gift-outline" color={colors.textMuted} />}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.signupBtnOuter, loading && styles.signupBtnDisabled]}
                activeOpacity={0.85}
                onPress={handleSignup}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.signupBtnGradient}
                >
                  {loading ? (
                    <Text style={styles.signupBtnText}>Creating account...</Text>
                  ) : (
                    <>
                      <Text style={styles.signupBtnText}>Create Account</Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
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

  // Header Area
  headerArea: {
    height: height * 0.28,
    paddingTop: Platform.OS === 'android' ? 24 : 36,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  blobTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  logoWrapper: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  appName: { fontSize: 26, fontWeight: '800', color: colors.primaryFg, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Form Card
  formCard: {
    backgroundColor: themeColors.surface || colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -24, flex: 1,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 60,
    minHeight: height * 0.76,
  },
  welcomeSection: { marginBottom: 18 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: themeColors.text || colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: themeColors.textMuted || colors.textMuted },

  formSection: { gap: 0 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text || colors.text, marginBottom: 6 },
  input: {
    backgroundColor: themeColors.background || colors.background,
    borderRadius: 16, height: 54, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: themeColors.border || colors.border,
    fontSize: 15,
  },
  errorText: { fontSize: 12, color: colors.error, marginTop: 3, marginLeft: 4, fontWeight: '500' },

  signupBtnOuter: { marginTop: 10, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  signupBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { fontSize: 14, color: themeColors.textSecondary || colors.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '700', color: themeColors.primary || colors.primary },
});

export default SignupScreen;