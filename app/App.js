import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import NotificationProvider from './src/providers/NotificationProvider';
import { theme } from './src/theme/theme';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NotificationProvider>
            <NavigationContainer
              ref={navigationRef}
              theme={{
                colors: {
                  primary: theme.colors.primary,
                  background: theme.colors.background,
                  card: theme.colors.surface,
                  text: theme.colors.text,
                  border: theme.colors.border,
                  notification: theme.colors.primary,
                },
                dark: false,
              }}
            >
              <StatusBar style="dark" />
              <AppNavigator />
            </NavigationContainer>
          </NotificationProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
