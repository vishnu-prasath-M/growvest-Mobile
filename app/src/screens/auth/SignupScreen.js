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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

import AsyncStorage from '@react-native-async-storage/async-storage';

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
        if (savedCode) {
          setReferralCode(savedCode.trim().toUpperCase());
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Gradient Top Section */}
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

          {/* Form Section (Surface Card) */}
          <View style={styles.formCard}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Create Account</Text>
              <Text style={styles.welcomeSubtitle}>Start your investment journey</Text>
            </View>

            <View style={styles.formSection}>
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
                  error={!!errors.mobileNumber}
                  keyboardType="phone-pad"
                  maxLength={10}
                  left={<TextInput.Icon icon="phone-outline" color={colors.textMuted} />}
                />
                {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}
              </View>

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
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={!!errors.email}
                  left={<TextInput.Icon icon="email-outline" color={colors.textMuted} />}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

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

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Referral Code (Optional)</Text>
                <TextInput
                  value={referralCode}
                  onChangeText={setReferralCode}
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
    </SafeAreaView>
  );
};

const getStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0E3D23' }, // match gradient top
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // Header Area
  headerArea: {
    height: height * 0.32,
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
  logoWrapper: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 28, fontWeight: '800', color: colors.primaryFg, letterSpacing: -1 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, letterSpacing: 0.5 },

  // Form Card
  formCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -40, flex: 1,
    paddingHorizontal: 24, paddingTop: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 15,
  },
  welcomeSection: { marginBottom: 24 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: colors.textMuted },

  formSection: { gap: 0 },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16, height: 56, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.border,
    fontSize: 15,
  },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4, fontWeight: '500' },

  signupBtnOuter: { marginTop: 12, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  signupBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 32, marginBottom: 32 },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

export default SignupScreen;