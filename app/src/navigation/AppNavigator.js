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

// Chit Fund Screens
import ChitFundHomeScreen from '../screens/chitfund/ChitFundHomeScreen';
import ExploreChitsScreen from '../screens/chitfund/ExploreChitsScreen';
import MyChitsScreen from '../screens/chitfund/MyChitsScreen';
import ChitDetailsScreen from '../screens/chitfund/ChitDetailsScreen';
import JoinChitScreen from '../screens/chitfund/JoinChitScreen';
import ChitPaymentScreen from '../screens/chitfund/ChitPaymentScreen';
import ChitPaymentStatusScreen from '../screens/chitfund/ChitPaymentStatusScreen';
import PaymentSuccessScreen from '../screens/chitfund/PaymentSuccessScreen';
import PaymentFailedScreen from '../screens/chitfund/PaymentFailedScreen';
import MonthlyDueScreen from '../screens/chitfund/MonthlyDueScreen';
import AuctionScreen from '../screens/chitfund/AuctionScreen';
import WinnerHistoryScreen from '../screens/chitfund/WinnerHistoryScreen';
import DividendHistoryScreen from '../screens/chitfund/DividendHistoryScreen';
import PaymentHistoryScreen from '../screens/chitfund/PaymentHistoryScreen';
import ReceiptsScreen from '../screens/chitfund/ReceiptsScreen';
import RulesScreen from '../screens/chitfund/RulesScreen';
import FAQScreen from '../screens/chitfund/FAQScreen';
import SupportScreen from '../screens/chitfund/SupportScreen';

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

          {/* Chit Fund Screens */}
          <Stack.Screen 
            name="ChitFundHome" 
            component={ChitFundHomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ExploreChits" 
            component={ExploreChitsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="MyChits" 
            component={MyChitsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChitDetails" 
            component={ChitDetailsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="JoinChit" 
            component={JoinChitScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChitPayment" 
            component={ChitPaymentScreen}
            options={stackHeaderOptions('Payment')}
          />
          <Stack.Screen 
            name="ChitPaymentStatus" 
            component={ChitPaymentStatusScreen}
            options={stackHeaderOptions('Status')}
          />
          <Stack.Screen 
            name="PaymentSuccess" 
            component={PaymentSuccessScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaymentFailed" 
            component={PaymentFailedScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="MonthlyDue" 
            component={MonthlyDueScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Auction" 
            component={AuctionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="WinnerHistory" 
            component={WinnerHistoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DividendHistory" 
            component={DividendHistoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PaymentHistory" 
            component={PaymentHistoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Receipts" 
            component={ReceiptsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChitRules" 
            component={RulesScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChitFAQ" 
            component={FAQScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChitSupport" 
            component={SupportScreen}
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