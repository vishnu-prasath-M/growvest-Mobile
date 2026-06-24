import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors, typography } from '../../theme/theme';
import logo from '../../../assets/growvest-logo.png';

const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();

  const validateForm = () => {
    const newErrors = {};
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(mobileNumber.trim())) {
      newErrors.mobileNumber = 'Invalid mobile number (10 digits required)';
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
        email: email || undefined,
        password,
      });
      await login(res.token, res);
    } catch (error) {
      Alert.alert('Signup Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo & Branding */}
        <View style={styles.logoSection}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Growvest</Text>
          <Text style={styles.tagline}>Smart Investment Platform</Text>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Create Account</Text>
          <Text style={styles.welcomeSubtitle}>Start your investment journey</Text>
        </View>

        {/* Form */}
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
              left={<TextInput.Icon icon="account" color={colors.textSecondary} />}
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
              left={<TextInput.Icon icon="phone" color={colors.textSecondary} />}
            />
            {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email (Optional)</Text>
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
              left={<TextInput.Icon icon="email" color={colors.textSecondary} />}
            />
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
              placeholder="Create a password (min 6 chars)"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              error={!!errors.password}
              left={<TextInput.Icon icon="lock" color={colors.textSecondary} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                  color={colors.textSecondary}
                />
              }
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.signupBtnText}>Creating account...</Text>
            ) : (
              <>
                <Text style={styles.signupBtnText}>Create Account</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  welcomeSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    ...typography.h2,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    ...typography.body2,
  },
  formSection: {
    gap: 0,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  signupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    marginTop: 8,
    gap: 8,
    ...colors.shadow.button,
  },
  signupBtnDisabled: {
    opacity: 0.6,
  },
  signupBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default SignupScreen;