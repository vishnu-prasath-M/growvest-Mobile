import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash screen from auto-hiding so we control when to hide it
SplashScreen.preventAutoHideAsync().catch(() => {
  // Silently ignore if splash-screen module is not available
});

import React, { Component, ErrorInfo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { theme } from './src/theme/theme';
import { AuthProvider } from './src/context/AuthContext';
import { DailyRewardProvider } from './src/context/DailyRewardContext';
import { AppLockProvider } from './src/context/AppLockContext';
import { AppLockOverlay } from './src/components/AppLockOverlay';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { FeedbackProvider } from './src/context/FeedbackContext';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    // Hide splash screen so the error UI is visible
    SplashScreen.hideAsync().catch(() => {});
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.toString() || 'Unknown error'}
          </Text>
          <Text style={styles.errorDetail}>
            {this.state.errorInfo?.componentStack || ''}
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { theme: activeTheme, isDarkMode } = useTheme();

  // Hide the native splash screen once the React tree is mounted and attach notification tap listener
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    // Attach listener for tapping on push notifications
    const { notificationService } = require('./src/services/notificationService');
    const { navigate } = require('./src/navigation/navigationRef');
    const cleanup = notificationService.setupNotificationListeners(navigate);

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={activeTheme}>
        <AuthProvider>
          <DailyRewardProvider>
            <AppLockProvider>
              <NavigationContainer
                ref={navigationRef}
                linking={{
                  prefixes: [
                    'growvest://',
                    'https://growvest-mobile.onrender.com',
                  ],
                  config: {
                    screens: {
                      // Deep link: growvest://reset-password?token=XXX
                      // or https://growvest-mobile.onrender.com/reset-password?token=XXX
                      ResetPassword: {
                        path: 'reset-password',
                        parse: { token: (token) => token },
                      },
                      ForgotPassword: 'forgot-password',
                      Login: 'login',
                      Signup: 'signup',
                    },
                  },
                }}
                theme={{
                  colors: {
                    primary: activeTheme.colors.primary,
                    background: activeTheme.colors.background,
                    card: activeTheme.colors.surface,
                    text: activeTheme.colors.text,
                    border: activeTheme.colors.border,
                    notification: activeTheme.colors.primary,
                  },
                  dark: isDarkMode,
                }}
              >
                <StatusBar style={isDarkMode ? 'light' : 'dark'} />
                <AppNavigator />
              </NavigationContainer>
              <AppLockOverlay />
            </AppLockProvider>
          </DailyRewardProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FeedbackProvider>
          <AppContent />
        </FeedbackProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorDetail: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  resetButton: {
    backgroundColor: '#085428',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
