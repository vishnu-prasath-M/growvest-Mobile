import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  Animated,
  Modal,
  Platform,
  StatusBar,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { dashboardService } from '../../services/dashboardService';
import { authService } from '../../services/authService';
import { colors, typography, spacing } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import KycRequiredModal from '../../components/KycRequiredModal';
import { kycService } from '../../services/kycService';
import { notificationService } from '../../services/notificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TIPS = [
  { title: 'Invest consistently', body: 'Regular investments in small amounts can build significant wealth over time.' },
  { title: 'Diversify your portfolio', body: 'Spread your investments across different assets to reduce risk.' },
  { title: 'Avoid emotional investing', body: 'Make investment decisions based on research, not emotions or market hype.' },
  { title: 'Save before spending', body: 'Pay yourself first by saving a portion of your income before expenses.' },
  { title: 'Review your investments monthly', body: 'Regular reviews help you stay on track with your financial goals.' },
  { title: 'Build emergency savings', body: 'Keep 3-6 months of expenses in a liquid savings account for emergencies.' },
  { title: 'Think long term', body: 'Successful investing is about patience and long-term perspective.' },
  { title: 'Keep your KYC updated', body: 'Complete KYC verification to unlock all investment features.' },
  { title: 'Start early', body: 'The power of compound interest works best when you start early.' },
  { title: 'Set clear goals', body: 'Define your financial goals to create a focused investment strategy.' },
  { title: 'Monitor fees', body: 'Be aware of investment fees and choose cost-effective options.' },
  { title: 'Stay informed', body: 'Keep learning about personal finance and investment options.' },
];

const getTipOfTheDay = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const tipIndex = dayOfYear % TIPS.length;
  return TIPS[tipIndex];
};

const HomeScreen = ({ navigation }) => {
  const { isDarkMode, toggleTheme, colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const { user: authUser, updateUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [coinsBalance, setCoinsBalance] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [kycStatusInfo, setKycStatusInfo] = useState({ status: 'not_submitted', rejectionReason: null });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Immediate cached state hydration on mount (0ms skeleton delay)
  useEffect(() => {
    const hydrateCached = async () => {
      try {
        if (authUser?.name || authUser?.username) {
          setUserName(authUser.name || authUser.username || '');
        }
        const cached = await AsyncStorage.getItem('cached_dashboard_data');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) {
            setDashboardData(parsed);
            if (parsed?.user?.name || parsed?.user?.username) {
              setUserName(parsed.user.name || parsed.user.username);
            }
            setLoading(false);
          }
        }
        const cachedCoins = await AsyncStorage.getItem('cached_coins_balance');
        if (cachedCoins != null) {
          setCoinsBalance(Number(cachedCoins) || 0);
        }
        const savedHide = await AsyncStorage.getItem('user_hide_balance');
        if (savedHide != null) {
          setHideBalance(savedHide === 'true');
        }
      } catch (err) {
        console.warn('[HomeScreen] Cache hydration error:', err);
      }
    };
    hydrateCached();
  }, [authUser]);

  const toggleHideBalance = () => {
    setHideBalance((prev) => {
      const next = !prev;
      AsyncStorage.setItem('user_hide_balance', String(next)).catch(() => {});
      return next;
    });
  };

  const fetchUserAndDashboard = async () => {
    try {
      if (authUser?.name || authUser?.username) {
        setUserName(authUser.name || authUser.username || '');
      }

      // Fetch Profile, Dashboard, and Coins concurrently in parallel
      const [freshUserRes, dataRes, coinsRes] = await Promise.allSettled([
        authService.refreshUserProfile().catch(() => null),
        dashboardService.getDashboard().catch(() => null),
        api.get('/wallet/coins').catch(() => null),
      ]);

      if (freshUserRes.status === 'fulfilled' && freshUserRes.value) {
        const freshUser = freshUserRes.value;
        if (freshUser?.name || freshUser?.username) {
          setUserName(freshUser.name || freshUser.username || '');
          updateUser(freshUser);
        }
      }

      if (dataRes.status === 'fulfilled' && dataRes.value) {
        const data = dataRes.value;
        setDashboardData(data);
        AsyncStorage.setItem('cached_dashboard_data', JSON.stringify(data)).catch(() => {});

        if (data?.user?.name || data?.user?.username) {
          setUserName(data.user.name || data.user.username);
        }

        if (data?.user?._id) {
          notificationService.registerDevice(data.user._id, data.user.username || data.user.name);
        }
      }

      if (coinsRes.status === 'fulfilled' && coinsRes.value?.data) {
        const cData = coinsRes.value.data;
        const coins = cData?.coinBalance ?? cData?.totalCoins ?? cData?.coins ?? 0;
        setCoinsBalance(coins);
        AsyncStorage.setItem('cached_coins_balance', String(coins)).catch(() => {});
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch unread notification count from MongoDB — dynamic badge
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.NOTIFICATION_UNREAD_COUNT);
      setUnreadNotifCount(response.data?.unreadCount ?? 0);
    } catch (err) {
      // Non-fatal — badge just stays at last known value
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserAndDashboard();
      fetchUnreadCount(); // Refresh badge on every screen focus
    }, [authUser?.username, authUser?.name, authUser?.mobileNumber])
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [dashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAndDashboard();
    fetchUnreadCount();
  };

  // Poll dashboard every 10s; poll unread count every 30s
  useEffect(() => {
    const dashInterval = setInterval(() => {
      fetchUserAndDashboard();
    }, 10000);
    const notifInterval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    return () => {
      clearInterval(dashInterval);
      clearInterval(notifInterval);
    };
  }, []);

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const getInitials = (name) => {
    if (!name) return 'GV';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonLoader variant="home" />
      </View>
    );
  }

  const userData = dashboardData?.user;
  const balances = dashboardData?.balances;
  const pendingRequests = dashboardData?.stats?.pendingRequests || 0;
  const displayName = userName || userData?.username || 'Investor';
  const initials = getInitials(displayName);
  const tipOfTheDay = getTipOfTheDay();

  // Lock / Availability helpers
  const isAvailable = (balances?.availableToWithdraw || 0) > 0;
  const nextUnlockDate = balances?.nextUnlockDate
    ? new Date(balances.nextUnlockDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const availableLabel = isAvailable
    ? formatCurrency(balances?.availableToWithdraw)
    : nextUnlockDate ? `Unlocks ${nextUnlockDate}` : '₹0.00';
  const availableIcon = isAvailable ? 'wallet-outline' : 'lock-outline';

  const quickActions = [
    {
      label: 'Investment',
      image: require('../../../assets/add.png'),
      onPress: () => navigation.navigate('InvestmentAmount'),
    },
    {
      label: 'SIP',
      image: require('../../../assets/earning.png'),
      onPress: () => navigation.navigate('SIPDashboard'),
    },
    {
      label: 'Chit Fund',
      image: require('../../../assets/my-chits.png'),
      onPress: () => navigation.navigate('ChitFundHome'),
    },
    {
      label: 'Pocket Money',
      image: require('../../../assets/pocket.png'),
      onPress: () => navigation.navigate('PocketMoney'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, colors.secondary]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarCircle}
              >
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
              <View style={styles.greetingStack}>
                <Text style={styles.greetingLabel}>Hello!</Text>
                <Text style={styles.greetingName} numberOfLines={1}>{displayName}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.walletHeaderBtn}
                onPress={() => navigation.navigate('Wallet')}
                activeOpacity={0.8}
              >
                {/* <MaterialCommunityIcons name="database" size={16} color="#F59E0B" /> */}
                <Text style={styles.walletCoinText}>🪙 {coinsBalance} Coins</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="bell-outline" size={22} color={themeColors.text} />
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Balance Card ── */}
          <View style={styles.balanceCardOuter}>
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              {/* Ambient blobs */}
              <View style={styles.blobTopRight} />
              <View style={styles.blobBottomGold} />

              <View style={styles.balanceCardInner}>
                <View style={styles.balanceTopRow}>
                  <Text style={styles.balanceLabelText}>Total Balance</Text>
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={toggleHideBalance}
                  >
                    <MaterialCommunityIcons
                      name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                      size={16}
                      color="rgba(255,255,255,0.9)"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.balanceAmount}>
                  {hideBalance ? '₹ ••••••' : formatCurrency(balances?.totalBalance)}
                </Text>
                <View style={styles.balanceTrend}>
                  <MaterialCommunityIcons name="trending-up" size={14} color={colors.gold} />
                  <Text style={styles.balanceTrendText}>Growing your wealth</Text>
                </View>

                {/* Stats grid */}
                <View style={styles.statsRow}>
                  {[
                    {
                      icon: 'trending-up',
                      label: 'EARNED',
                      value: hideBalance
                        ? '••••'
                        : balances?.dailyInterest
                        ? `${formatCurrency(balances.dailyInterest)}/day`
                        : formatCurrency(0),
                    },
                    {
                      icon: 'piggy-bank-outline',
                      label: 'POCKET MONEY',
                      value: hideBalance ? '••••' : formatCurrency(balances?.pocketMoneyRemaining ?? 0),
                    },
                  ].map((s) => (
                    <View key={s.label} style={styles.statPill}>
                      <MaterialCommunityIcons name={s.icon} size={16} color={colors.gold} />
                      <Text style={styles.statLabel}>{s.label}</Text>
                      <Text style={styles.statValue}>{s.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ── Quick Actions ── */}
          <View style={styles.section}>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.quickAction}
                  onPress={a.onPress}
                  activeOpacity={0.85}
                >
                  <View style={styles.qaIconSurface}>
                    <Image source={a.image} style={styles.quickActionImage} resizeMode="contain" />
                  </View>
                  <Text style={styles.qaLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Investment Summary ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Investment Summary</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Investments')} style={styles.viewAllBtn}>
                <Text style={styles.viewAllText}>View all</Text>
                <MaterialCommunityIcons name="chevron-right" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.summaryGrid}>
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.summaryCard, styles.summaryCardAccent]}
              >
                <Text style={styles.summaryCardLabelLight}>Available</Text>
                <Text style={styles.summaryCardValueLight}>
                  {formatCurrency(balances?.availableToWithdraw || 0)}
                </Text>
                <Text style={styles.summaryCardTrendGold}>
                  {isAvailable ? 'Ready to withdraw' : `🔒 Locked ${nextUnlockDate ? `(Unlocks ${nextUnlockDate})` : ''}`}
                </Text>
              </LinearGradient>
              <View style={[styles.summaryCard, styles.summaryCardSurface]}>
                <Text style={styles.summaryCardLabel}>Total Earned</Text>
                <Text style={styles.summaryCardValue}>{formatCurrency(balances?.totalInterestEarned ?? balances?.totalEarned ?? balances?.totalInterest)}</Text>
                <Text style={styles.summaryCardTrend}>Interest & returns</Text>
              </View>
            </View>
            {pendingRequests > 0 && (
              <View style={styles.pendingBanner}>
                <View style={styles.pendingIconBox}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={colors.warning} />
                </View>
                <View style={styles.pendingContent}>
                  <Text style={styles.pendingLabel}>Pending Requests</Text>
                  <Text style={styles.pendingCount}>{pendingRequests} awaiting</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            )}
          </View>

          {/* ── Tip Card ── */}
          <View style={[styles.section, { marginBottom: 4 }]}>
            <View style={styles.tipCard}>
              <ImageBackground
                source={require('../../../assets/tip-of-the-day-banner.jpg')}
                style={styles.tipCardBg}
                imageStyle={styles.tipCardImage}
                resizeMode="cover"
              >
                {/* Soft gradient overlay on right side to ensure text is crystal clear */}
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.85)']}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.tipInner}>
                  {/* Left spacer so 3D target on the left remains uncovered */}
                  <View style={styles.tipArtSpacer} />
                  
                  {/* Right Content */}
                  <View style={styles.tipText}>
                    <View style={styles.tipCategoryBadge}>
                      <MaterialCommunityIcons name="lightbulb-on" size={12} color="#92400E" style={{ marginRight: 4 }} />
                      <Text style={styles.tipCategory}>TIP OF THE DAY</Text>
                    </View>
                    <Text style={styles.tipTitle} numberOfLines={1}>{tipOfTheDay.title}</Text>
                    <Text style={styles.tipBody} numberOfLines={3}>
                      {tipOfTheDay.body}
                    </Text>
                  </View>
                </View>
              </ImageBackground>
            </View>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>

      {/* ── KYC Required Modal ── */}
      <KycRequiredModal
        visible={kycModalVisible}
        status={kycStatusInfo.status}
        rejectionReason={kycStatusInfo.rejectionReason}
        onClose={() => setKycModalVisible(false)}
        onNavigateToKYC={() => navigation.navigate('KYC')}
      />
    </SafeAreaView>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingIconWrapper: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  loadingTitle: { fontSize: 36, fontWeight: '800', color: '#F8FAF9', letterSpacing: -1 },
  loadingSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginTop: 0,
    paddingTop: 20,
    backgroundColor: colors.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  avatarInitials: { fontSize: 16, fontWeight: '700', color: '#F8FAF9' },
  greetingStack: { flex: 1 },
  greetingLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  greetingName: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  walletHeaderBtn: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletCoinText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  notifDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 2, borderColor: colors.surface,
  },
  notifBadge: {
    position: 'absolute', top: 5, right: 5,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.surface,
  },
  notifBadgeText: {
    fontSize: 9, fontWeight: '800', color: '#FFFFFF', lineHeight: 13,
  },

  // Balance Card
  balanceCardOuter: { marginHorizontal: 20, marginBottom: 8 },
  balanceCard: {
    borderRadius: 28, overflow: 'hidden',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28, shadowRadius: 40, elevation: 20,
  },
  blobTopRight: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  blobBottomGold: {
    position: 'absolute', bottom: -20, right: 20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(212,168,67,0.18)',
  },
  balanceCardInner: { padding: 24 },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabelText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  eyeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceAmount: { fontSize: 38, fontWeight: '800', color: '#F8FAF9', letterSpacing: -1.5, marginTop: 12 },
  balanceTrend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  balanceTrendText: { fontSize: 12, color: colors.gold, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  statPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16, padding: 12, gap: 4,
  },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '700', color: '#F8FAF9', letterSpacing: -0.3 },

  // Section
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Quick Actions
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAction: { alignItems: 'center', gap: 8, flex: 1 },
  qaIconBox: { 
    width: 56, 
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  qaIconSurface: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  qaLabel: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 14 },
  quickActionImage: { width: 34, height: 34 },

  // Summary Cards
  summaryGrid: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, borderRadius: 20, padding: 16 },
  summaryCardAccent: {
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  summaryCardSurface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  summaryCardLabelLight: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryCardValueLight: { fontSize: 20, fontWeight: '800', color: '#F8FAF9', letterSpacing: -0.5, marginTop: 6 },
  summaryCardTrendGold: { fontSize: 10, color: colors.gold, fontWeight: '600', marginTop: 4 },
  summaryCardLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryCardValue: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginTop: 6 },
  summaryCardTrend: { fontSize: 10, color: colors.success, fontWeight: '600', marginTop: 4 },

  // Pending Banner
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.warningLight, borderRadius: 16,
    padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: '#FDEBC4',
  },
  pendingIconBox: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#FEF3C2', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  pendingContent: { flex: 1 },
  pendingLabel: { fontSize: 13, fontWeight: '600', color: colors.warning },
  pendingCount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Tip Card
  tipCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(235, 215, 185, 0.4)',
    overflow: 'hidden',
    shadowColor: '#8C6D3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 1,
    backgroundColor: '#FDF7EC',
  },
  tipCardBg: {
    width: '100%',
    minHeight: 110,
    justifyContent: 'center',
  },
  tipCardImage: {
    borderRadius: 22,
  },
  tipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  tipArtSpacer: {
    width: 80, // Leaves the 3D target on the left uncovered
  },
  tipText: {
    flex: 1,
  },
  tipCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
  },
  tipCategory: {
    fontSize: 9.5,
    color: '#92400E',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A2E22',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  tipBody: {
    fontSize: 11.5,
    color: '#374151',
    lineHeight: 16,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '88%', backgroundColor: colors.surface,
    borderRadius: 28, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.2, shadowRadius: 48, elevation: 30,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  modalCloseBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.muted,
    justifyContent: 'center', alignItems: 'center',
  },
  modalOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 18,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderLight,
    gap: 14,
  },
  modalOptionImageWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  modalOptionImage: { width: 32, height: 32 },
  modalOptionText: { flex: 1 },
  modalOptionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  modalOptionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

export default HomeScreen;
