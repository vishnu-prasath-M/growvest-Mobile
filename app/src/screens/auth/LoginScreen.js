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
  Dimensions,
} from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors, typography } from '../../theme/theme';
import logo from '../../../assets/growvest-logo.png';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    }
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
          <Text style={styles.welcomeTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeSubtitle}>Login to access your portfolio</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
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
              error={!!errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              left={<TextInput.Icon icon="account" color={colors.textSecondary} />}
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
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.loginBtnText}>Signing in...</Text>
            ) : (
              <>
                <Text style={styles.loginBtnText}>Login</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
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
    paddingTop: 80,
    marginBottom: 32,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
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
    marginBottom: 28,
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
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 14,
    height: 52,
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
  loginBtn: {
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
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default LoginScreen;