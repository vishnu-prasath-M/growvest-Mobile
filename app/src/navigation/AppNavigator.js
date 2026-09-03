import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator, Image } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/theme';
import { useTheme } from '../context/ThemeContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import KYCScreen from '../screens/auth/KYCScreen';
import BankDetailsScreen from '../screens/auth/BankDetailsScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

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
import PocketMoneyScreen from '../screens/investment/PocketMoneyScreen';
import PocketMoneyAmountScreen from '../screens/investment/PocketMoneyAmountScreen';

// SIP Screens
import SIPDashboardScreen from '../screens/sip/SIPDashboardScreen';
import CreateSIPScreen from '../screens/sip/CreateSIPScreen';
import SIPDetailsScreen from '../screens/sip/SIPDetailsScreen';

// Investment List Screen
import InvestmentsScreen from '../screens/tabs/InvestmentsScreen';
import WalletScreen from '../screens/wallet/WalletScreen';
import ReferralScreen from '../screens/referral/ReferralScreen';

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
import AppLockSettingsScreen from '../screens/profile/AppLockSettingsScreen';
import NotificationsScreen from '../screens/tabs/NotificationsScreen';
import { notificationService } from '../services/notificationService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const SCREEN_WIDTH = Dimensions.get('window').width;

// ---------- Tab Configuration ----------
const TABS = [
  {
    name: 'Home',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    name: 'History',
    label: 'History',
    activeIcon: 'time',
    inactiveIcon: 'time-outline',
  },
  {
    name: 'Withdraw',
    label: 'Withdrawal',
    activeIcon: 'arrow-up-circle',
    inactiveIcon: 'arrow-up-circle-outline',
  },
  {
    name: 'Profile',
    label: 'Profile',
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
  },
];

// ---------- Spring Config ----------
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: false,
};

const LABEL_SPRING = {
  damping: 22,
  stiffness: 320,
  mass: 0.6,
};

// ---------- Individual Tab Item ----------
const TabItem = React.memo(({ tab, index, focused, onPress }) => {
  const { colors: themeColors } = useTheme();
  const scale = useSharedValue(focused ? 1 : 0.88);
  const iconOpacity = useSharedValue(focused ? 1 : 0.5);
  const labelOpacity = useSharedValue(focused ? 1 : 0);
  const labelScale = useSharedValue(focused ? 1 : 0.8);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1, LABEL_SPRING);
      iconOpacity.value = withTiming(1, { duration: 200 });
      labelOpacity.value = withTiming(1, { duration: 220 });
      labelScale.value = withSpring(1, LABEL_SPRING);
    } else {
      scale.value = withSpring(0.92, LABEL_SPRING);
      iconOpacity.value = withTiming(1, { duration: 180 });
      labelOpacity.value = withTiming(0, { duration: 150 });
      labelScale.value = withSpring(0.9, LABEL_SPRING);
    }
  }, [focused]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: iconOpacity.value,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ scale: labelScale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.82, { damping: 15, stiffness: 500 }, () => {
      scale.value = withSpring(focused ? 1 : 0.88, LABEL_SPRING);
    });
    onPress();
  }, [focused, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={tabStyles.tabItem}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[tabStyles.tabItemInner, containerStyle]}>
        <Ionicons
          name={focused ? tab.activeIcon : tab.inactiveIcon}
          size={22}
          color={focused ? themeColors.primaryFg : themeColors.textSecondary}
        />
        {focused && (
          <Animated.Text style={[tabStyles.activeLabel, labelStyle]}>
            {tab.label}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
});

// ---------- Premium Floating Tab Bar ----------
const PrimeTabBar = ({ state, descriptors, navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const dynamicPillStyle = {
    backgroundColor: isDarkMode ? 'rgba(18,24,20,0.95)' : 'rgba(255,255,255,0.95)',
    borderColor: isDarkMode ? 'rgba(24,36,28,0.8)' : 'rgba(255,255,255,0.8)',
    shadowColor: isDarkMode ? '#000000' : '#0E3D23',
  };
  const tabCount = TABS.length;
  const containerWidth = useSharedValue(0);

  const pillPosition = useSharedValue(state.index);
  const prevIndex = useRef(state.index);

  useEffect(() => {
    if (prevIndex.current !== state.index) {
      pillPosition.value = withSpring(state.index, SPRING_CONFIG);
      prevIndex.current = state.index;
    }
  }, [state.index]);

  const onContainerLayout = useCallback((e) => {
    containerWidth.value = e.nativeEvent.layout.width;
  }, []);

  // FIXED: Adjusted size to remain strictly inside its slot container without clipping
  const pillStyle = useAnimatedStyle(() => {
    const horizontalMargin = 4;
    const slotWidth = containerWidth.value / tabCount;
    const pillWidth = slotWidth - horizontalMargin * 2;
    const translateX = pillPosition.value * slotWidth + horizontalMargin;

    return {
      transform: [{ translateX }],
      width: pillWidth,
    };
  });

  return (
    <View style={tabStyles.outerContainer} pointerEvents="box-none">
      <View style={[tabStyles.pill, dynamicPillStyle]} onLayout={onContainerLayout}>
        {/* Sliding gradient pill indicator */}
        <Animated.View style={[tabStyles.slidingPillWrapper, pillStyle]} pointerEvents="none">
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={tabStyles.slidingPill}
          />
        </Animated.View>

        {/* Tab items rendered on top */}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS.find(t => t.name === route.name) || TABS[0];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              tab={tab}
              index={index}
              focused={focused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
};

// ---------- Updated Styles ----------
const tabStyles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    height: 64,
    width: '100%',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  slidingPillWrapper: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    borderRadius: 999,
  },
  slidingPill: {
    flex: 1,
    borderRadius: 999,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  tabItemInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 2,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAF9',
    letterSpacing: -0.2,
  },
});

// ---------- Tab Navigator with cross-fade between screens ----------
const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <PrimeTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="History"
        component={TransactionsScreen}
        options={{ tabBarLabel: 'History' }}
      />
      <Tab.Screen name="Withdraw" component={WithdrawScreen} options={{ tabBarLabel: 'Withdrawal' }} />
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
      <Image
        source={require('../../assets/growvest-logo.png')}
        style={{ width: 64, height: 64, borderRadius: 16 }}
      />
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

// ---------- iOS-style spring screen transition ----------
const screenTransitionOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: colors.background },
  cardStyleInterpolator: ({ current, next, layouts }) => {
    const { progress } = current;
    const { screen } = layouts;

    return {
      cardStyle: {
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [screen.width, 0],
              extrapolate: 'clamp',
            }),
          },
        ],
      },
      overlayStyle: {
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.15],
          extrapolate: 'clamp',
        }),
      },
    };
  },
  transitionSpec: {
    open: {
      animation: 'spring',
      config: {
        stiffness: 300,
        damping: 36,
        mass: 0.9,
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      },
    },
    close: {
      animation: 'spring',
      config: {
        stiffness: 320,
        damping: 38,
        mass: 0.8,
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      },
    },
  },
};

// ---------- Main Navigator ----------
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    notificationService.requestPermission();

    const handleDeepLink = async (url) => {
      if (!url) return;
      try {
        const match = url.match(/\/ref\/([A-Za-z0-9]+)/);
        if (match && match[1]) {
          const code = match[1].toUpperCase();
          await AsyncStorage.setItem('pendingReferralCode', code);
          console.log('[DeepLink] Stored pending referral code:', code);
        }
      } catch (e) {
        console.warn('[DeepLink Error]', e.message);
      }
    };

    const Linking = require('react-native').Linking;
    Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    return () => {
      if (subscription && subscription.remove) subscription.remove();
    };
  }, []);

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
          <Stack.Screen name="PocketMoney" component={PocketMoneyScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PocketMoneyAmount" component={PocketMoneyAmountScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SIPDashboard" component={SIPDashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="CreateSIP" component={CreateSIPScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SIPDetails" component={SIPDetailsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Investments" component={InvestmentsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Wallet" component={WalletScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: false }} />
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
          <Stack.Screen name="AppLockSettings" component={AppLockSettingsScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;