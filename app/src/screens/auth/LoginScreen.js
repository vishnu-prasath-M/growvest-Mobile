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
  Keyboard,
  StatusBar,
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

const LoginScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setScrollEnabled(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setScrollEnabled(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await authService.login(email, password);
      await login(res.token, res);
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0E3D23" />
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={scrollEnabled}
            bounces={false}
          >
            {/* Gradient Top Section */}
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerArea}
            >
              <View style={styles.blobTopRight} />
              <View style={styles.blobBottomGold} />

              <View style={styles.logoWrapper}>
                <Image
                  source={require('../../../assets/growvest-logo.png')}
                  style={{ width: 56, height: 56, borderRadius: 14 }}
                />
              </View>
              <Text style={styles.appName}>Growvest</Text>
              <Text style={styles.tagline}>Premium Investments</Text>
            </LinearGradient>

            {/* Form Section (Surface Card overlapping header) */}
            <View style={styles.formCard}>
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>Welcome Back</Text>
                <Text style={styles.welcomeSubtitle}>Sign in to your account</Text>
              </View>

              <View style={styles.formSection}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email Address or Mobile Number</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    mode="flat"
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    placeholder="Enter your email or Phone Number"
                    placeholderTextColor={colors.textTertiary}
                    error={!!errors.email}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                    placeholder="Enter your password"
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

                <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.8} onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginBtnOuter, loading && styles.loginBtnDisabled]}
                  activeOpacity={0.85}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.loginBtnGradient}
                  >
                    {loading ? (
                      <Text style={styles.loginBtnText}>Signing in...</Text>
                    ) : (
                      <>
                        <Text style={styles.loginBtnText}>Sign In</Text>
                        <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.signupRow}>
                  <Text style={styles.signupText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.7}>
                    <Text style={styles.signupLink}>Create one</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <SafeAreaView style={styles.safeAreaBottom} edges={['bottom']} />
    </View>
  );
};

const getStyles = (themeColors) => StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: themeColors.surface || colors.surface },
  safeAreaTop: { flex: 1, backgroundColor: '#0E3D23' },
  safeAreaBottom: { backgroundColor: themeColors.surface || colors.surface },
  container: { flex: 1, backgroundColor: themeColors.surface || colors.surface },
  scrollContent: { flexGrow: 1, backgroundColor: themeColors.surface || colors.surface },

  // Header Area
  headerArea: {
    height: height * 0.36,
    paddingTop: Platform.OS === 'android' ? 30 : 40,
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
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 28, fontWeight: '800', color: colors.primaryFg, letterSpacing: -1 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, letterSpacing: 0.5 },

  // Form Card
  formCard: {
    backgroundColor: themeColors.surface || colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -28, flex: 1,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
    minHeight: height * 0.68,
  },
  welcomeSection: { marginBottom: 20 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: themeColors.text || colors.text, letterSpacing: -0.5, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, color: themeColors.textMuted || colors.textMuted },

  formSection: { gap: 0 },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text || colors.text, marginBottom: 8 },
  input: {
    backgroundColor: themeColors.background || colors.background,
    borderRadius: 16, height: 56, paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: themeColors.border || colors.border,
    fontSize: 15,
  },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4, fontWeight: '500' },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, paddingVertical: 4 },
  forgotText: { fontSize: 13, fontWeight: '600', color: themeColors.primary || colors.primary },

  loginBtnOuter: { shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  loginBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  signupText: { fontSize: 14, color: themeColors.textSecondary || colors.textSecondary },
  signupLink: { fontSize: 14, fontWeight: '700', color: themeColors.primary || colors.primary },
});

export default LoginScreen;