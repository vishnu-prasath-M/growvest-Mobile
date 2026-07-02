import React from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, typography } from '../theme/theme';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Tab Screens
import HomeScreen from '../screens/tabs/HomeScreen';
import ChitFundScreen from '../screens/tabs/ChitFundScreen';
import TransactionsScreen from '../screens/tabs/TransactionsScreen';
import WithdrawScreen from '../screens/tabs/WithdrawScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';

// Investment Flow Screens
import InvestmentAmountScreen from '../screens/investment/InvestmentAmountScreen';
import InvestmentPaymentScreen from '../screens/investment/InvestmentPaymentScreen';
import InvestmentStatusScreen from '../screens/investment/InvestmentStatusScreen';

// Investment List Screen (used from modal)
import InvestmentsScreen from '../screens/tabs/InvestmentsScreen';

// Additional Screens
import AboutUsScreen from '../screens/tabs/AboutUsScreen';
import TermsScreen from '../screens/tabs/TermsScreen';
import PrivacyScreen from '../screens/tabs/PrivacyScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused, color }) => {
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconActive]}>
      <MaterialCommunityIcons name={name} size={focused ? 26 : 24} color={color} />
    </View>
  );
};

const getTabIconName = (routeName, focused) => {
  const icons = {
    Home: focused ? 'home-variant' : 'home-variant-outline',
    ChitFund: focused ? 'cash-multiple' : 'cash-multiple',
    Withdraw: focused ? 'cash-fast' : 'cash-fast',
    Profile: focused ? 'account' : 'account-outline',
  };
  return icons[routeName] || 'help-circle';
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <TabIcon 
            name={getTabIconName(route.name, focused)} 
            focused={focused} 
            color={color} 
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 0,
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 16,
          right: 16,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.white,
          borderTopWidth: 0,
          ...colors.shadow.tab,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 8 : 8,
          paddingHorizontal: 8,
        },
        tabBarItemStyle: {
          padding: 4,
          borderRadius: 12,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="ChitFund" component={ChitFundScreen} options={{ tabBarLabel: 'Chit Fund' }} />
      <Tab.Screen name="Withdraw" component={WithdrawScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const SplashScreen = () => (
  <View style={styles.splashContainer}>
    <MaterialCommunityIcons name="leaf" size={64} color="#25b053" />
    <Text style={styles.splashTitle}>Growvest</Text>
    <ActivityIndicator size="large" color="#25b053" style={{ marginTop: 20 }} />
  </View>
);

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  const screenOptions = {
    headerShown: false,
    cardStyle: { backgroundColor: colors.background },
    cardStyleInterpolator: ({ current: { progress } }) => ({
      cardStyle: {
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    }),
  };

  const stackHeaderOptions = (title) => ({
    headerShown: true,
    title,
    headerTintColor: colors.primary,
    headerTitleStyle: { 
      color: colors.text, 
      fontWeight: '600',
      fontSize: 18,
    },
    headerStyle: {
      backgroundColor: colors.white,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
    },
    headerBackTitleVisible: false,
  });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen 
            name="Transactions" 
            component={TransactionsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="InvestmentAmount" 
            component={InvestmentAmountScreen}
            options={stackHeaderOptions('Invest Now')}
          />
          <Stack.Screen 
            name="InvestmentPayment" 
            component={InvestmentPaymentScreen}
            options={stackHeaderOptions('Payment')}
          />
          <Stack.Screen 
            name="InvestmentStatus" 
            component={InvestmentStatusScreen}
            options={stackHeaderOptions('Status')}
          />
          <Stack.Screen 
            name="Investments" 
            component={InvestmentsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="AboutUs" 
            component={AboutUsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Terms" 
            component={TermsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Privacy" 
            component={PrivacyScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIconContainer: {
    width: 36,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primaryLight,
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#25b053',
    marginTop: 12,
  },
});

export default AppNavigator;