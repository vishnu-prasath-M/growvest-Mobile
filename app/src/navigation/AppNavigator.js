import React from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/theme';
import { ActivityIndicator } from 'react-native';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import KYCScreen from '../screens/auth/KYCScreen';
import BankDetailsScreen from '../screens/auth/BankDetailsScreen';

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

// Investment List Screen
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
import NotificationsScreen from '../screens/tabs/NotificationsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ---------- Premium Floating Tab Bar ----------
const TAB_ICONS = {
  Home: { active: 'home-variant', inactive: 'home-variant-outline' },
  ChitFund: { active: 'layers', inactive: 'layers-outline' },
  Withdraw: { active: 'bank-transfer-out', inactive: 'bank-transfer-out' },
  Profile: { active: 'account', inactive: 'account-outline' },
};

const TAB_LABELS = {
  Home: 'Home',
  ChitFund: 'Chit Fund',
  Withdraw: 'Withdraw',
  Profile: 'Profile',
};

const PrimeTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={tabStyles.outerContainer} pointerEvents="box-none">
      <View style={tabStyles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const iconSet = TAB_ICONS[route.name] || { active: 'help-circle', inactive: 'help-circle-outline' };
          const label = TAB_LABELS[route.name] || route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (focused) {
            return (
              <LinearGradient
                key={route.key}
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={tabStyles.activeTab}
              >
                <MaterialCommunityIcons
                  name={iconSet.active}
                  size={22}
                  color={colors.primaryFg}
                  onPress={onPress}
                />
                <Text style={tabStyles.activeLabel} onPress={onPress}>{label}</Text>
              </LinearGradient>
            );
          }

          return (
            <View key={route.key} style={tabStyles.inactiveTab}>
              <MaterialCommunityIcons
                name={iconSet.inactive}
                size={22}
                color={colors.textMuted}
                onPress={onPress}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

const tabStyles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: '100%',
    justifyContent: 'space-between',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  activeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 7,
    shadowColor: '#1A5C39',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 3,
    maxWidth: 160,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAF9',
    letterSpacing: -0.3,
  },
  inactiveTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 3,
  },
});

// ---------- Tab Navigator ----------
const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <PrimeTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="ChitFund" component={ChitFundScreen} options={{ tabBarLabel: 'Chit Fund' }} />
      <Tab.Screen name="Withdraw" component={WithdrawScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// ---------- Splash ----------
const SplashScreen = () => (
  <LinearGradient
    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={splashStyles.container}
  >
    <View style={splashStyles.iconWrapper}>
      <MaterialCommunityIcons name="leaf" size={56} color="rgba(255,255,255,0.9)" />
    </View>
    <Text style={splashStyles.title}>Growvest</Text>
    <Text style={splashStyles.subtitle}>Premium Investments</Text>
    <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={{ marginTop: 32 }} />
  </LinearGradient>
);

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F8FAF9',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    letterSpacing: 0.3,
  },
});

// ---------- Main Navigator ----------
const screenTransitionOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: colors.background },
  // Smooth slide-from-right animation for stack screens
  cardStyleInterpolator: ({ current: { progress }, layouts: { screen } }) => ({
    cardStyle: {
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [screen.width * 0.3, 0],
          }),
        },
      ],
      opacity: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1],
      }),
    },
  }),
  transitionSpec: {
    open: {
      animation: 'timing',
      config: { duration: 280, useNativeDriver: true },
    },
    close: {
      animation: 'timing',
      config: { duration: 200, useNativeDriver: true },
    },
  },
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={screenTransitionOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="InvestmentAmount" component={InvestmentAmountScreen} options={{ headerShown: false }} />
          <Stack.Screen name="InvestmentPayment" component={InvestmentPaymentScreen} options={{ headerShown: false }} />
          <Stack.Screen name="InvestmentStatus" component={InvestmentStatusScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Investments" component={InvestmentsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AboutUs" component={AboutUsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />

          {/* Chit Fund Screens */}
          <Stack.Screen name="ChitFundHome" component={ChitFundHomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ExploreChits" component={ExploreChitsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MyChits" component={MyChitsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChitDetails" component={ChitDetailsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="JoinChit" component={JoinChitScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChitPayment" component={ChitPaymentScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChitPaymentStatus" component={ChitPaymentStatusScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentFailed" component={PaymentFailedScreen} options={{ headerShown: false }} />
          <Stack.Screen name="MonthlyDue" component={MonthlyDueScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Auction" component={AuctionScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WinnerHistory" component={WinnerHistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="DividendHistory" component={DividendHistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Receipts" component={ReceiptsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChitRules" component={RulesScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChitFAQ" component={FAQScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChitSupport" component={SupportScreen} options={{ headerShown: false }} />
          <Stack.Screen name="KYC" component={KYCScreen} options={{ headerShown: false }} />
          <Stack.Screen name="BankDetails" component={BankDetailsScreen} options={{ headerShown: false }} />
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

export default AppNavigator;