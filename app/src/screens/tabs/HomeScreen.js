import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
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

const MARKET_INSIGHTS = [
  { icon: 'trending-up', label: 'FD Rates', value: '7.5% p.a.', trend: 'up', color: '#2D9A5A' },
  { icon: 'bank', label: 'SIP Avg Return', value: '12% p.a.', trend: 'up', color: '#1A5C39' },
  { icon: 'chart-line', label: 'Inflation', value: '5.1%', trend: 'down', color: '#D94F2B' },
  { icon: 'currency-inr', label: 'USD/INR', value: '₹84.2', trend: 'neutral', color: '#C68E0A' },
];

const getTipOfTheDay = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return TIPS[dayOfYear % TIPS.length];
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const getTransactionIcon = (type) => {
  switch (type) {
    case 'investment': return { icon: 'trending-up', color: '#1A5C39', bg: '#E8F5EE' };
    case 'withdrawal': return { icon: 'bank-transfer-out', color: '#D94F2B', bg: '#FDEAE5' };
    case 'interest': return { icon: 'cash-plus', color: '#2D9A5A', bg: '#D6F0E2' };
    case 'referral': return { icon: 'gift-outline', color: '#C68E0A', bg: '#FEF3C2' };
    case 'chit_join': return { icon: 'account-group', color: '#2563eb', bg: '#dbeafe' };
    case 'chit_payment': return { icon: 'calendar-check', color: '#7c3aed', bg: '#ede9fe' };
    default: return { icon: 'swap-horizontal', color: '#7B8794', bg: '#F2F4F6' };
  }
};

const HomeScreen = ({ navigation }) => {
  const { isDarkMode, colors: themeColors } = useTheme();
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
  const slideAnim = useRef(new Animated.Value(30)).current;

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
        if (cachedCoins != null) setCoinsBalance(Number(cachedCoins) || 0);
        const savedHide = await AsyncStorage.getItem('user_hide_balance');
        if (savedHide != null) setHideBalance(savedHide === 'true');
      } catch (err) {}
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

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.NOTIFICATION_UNREAD_COUNT);
      setUnreadNotifCount(response.data?.unreadCount ?? 0);
    } catch (err) {}
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserAndDashboard();
      fetchUnreadCount();
    }, [authUser?.username, authUser?.name, authUser?.mobileNumber])
  );

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, dashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAndDashboard();
    fetchUnreadCount();
  };

  useEffect(() => {
    const dashInterval = setInterval(fetchUserAndDashboard, 10000);
    const notifInterval = setInterval(fetchUnreadCount, 30000);
    return () => { clearInterval(dashInterval); clearInterval(notifInterval); };
  }, []);

  const formatCurrency = (amount) =>
    `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatCurrencyCompact = (amount) => {
    if (!amount) return '₹0';
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toFixed(0)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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
  const stats = dashboardData?.stats || {};
  const recentTransactions = dashboardData?.recentTransactions || [];
  const recentInvestments = dashboardData?.recentInvestments || [];
  const pendingRequests = stats.pendingRequests || 0;
  const displayName = userName || userData?.username || 'Investor';
  const initials = getInitials(displayName);
  const tipOfTheDay = getTipOfTheDay();
  const greeting = getGreeting();

  const totalInvested = balances?.totalInvested || 0;
  const totalEarned = balances?.totalInterestEarned ?? balances?.totalEarned ?? balances?.totalInterest ?? 0;
  const returnPct = totalInvested > 0 ? ((totalEarned / totalInvested) * 100).toFixed(2) : '0.00';

  const quickActions = [
    { label: 'Investment', image: require('../../../assets/add.png'), onPress: () => navigation.navigate('InvestmentDashboard') },
    { label: 'SIP', image: require('../../../assets/earning.png'), onPress: () => navigation.navigate('SIPDashboard') },
    { label: 'Chit Fund', image: require('../../../assets/my-chits.png'), onPress: () => navigation.navigate('ChitFundHome') },
    { label: 'Pocket Money', image: require('../../../assets/pocket.png'), onPress: () => navigation.navigate('PocketMoney') },
  ];

  const activeInvestments = recentInvestments.filter(i => i.status === 'approved' || i.status === 'active');

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
            colors={[colors.primary]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.avatarCircle}
              >
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
              <View style={styles.greetingStack}>
                <Text style={styles.greetingLabel}>{greeting} 👋</Text>
                <Text style={styles.greetingName} numberOfLines={1}>{displayName}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.walletHeaderBtn}
                onPress={() => navigation.navigate('Wallet')}
                activeOpacity={0.8}
              >
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
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <View style={styles.blobTopRight} />
              <View style={styles.blobBottomGold} />

              <View style={styles.balanceCardInner}>
                <View style={styles.balanceTopRow}>
                  <TouchableOpacity
                    style={styles.balanceHeaderRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Investments')}
                  >
                    <Text style={styles.balanceLabelText}>Investment Summary</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
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

                <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {hideBalance ? '₹ ••••••' : formatCurrency(totalInvested)}
                </Text>
                <View style={styles.balanceTrend}>
                  <MaterialCommunityIcons name="trending-up" size={14} color={colors.gold} />
                  <Text style={styles.balanceTrendText}>
                    {hideBalance ? '••' : `+${returnPct}% total return`}
                  </Text>
                </View>

                <View style={styles.statsRow}>
                  {[
                    {
                      icon: 'wallet-outline',
                      label: 'AVAILABLE',
                      value: hideBalance ? '••••' : formatCurrency(balances?.availableToWithdraw || 0),
                      onPress: () => navigation.navigate('Withdraw'),
                    },
                    {
                      icon: 'trending-up',
                      label: 'EARNED/DAY',
                      value: hideBalance ? '••••' : balances?.dailyInterest
                        ? `${formatCurrency(balances.dailyInterest)}/day`
                        : formatCurrency(0),
                    },
                    {
                      icon: 'cash-check',
                      label: 'TOTAL EARNED',
                      value: hideBalance ? '••••' : formatCurrency(totalEarned),
                    },
                  ].map((s) => (
                    <TouchableOpacity
                      key={s.label}
                      style={styles.statPill}
                      activeOpacity={s.onPress ? 0.7 : 1}
                      onPress={s.onPress}
                      disabled={!s.onPress}
                    >
                      <MaterialCommunityIcons name={s.icon} size={15} color={colors.gold} />
                      <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
                      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                    </TouchableOpacity>
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

          {/* ── Pending Requests (if any) ── */}
          {pendingRequests > 0 && (
            <View style={[styles.section, { marginTop: 16 }]}>
              <TouchableOpacity
                style={styles.pendingBanner}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Withdraw')}
              >
                <View style={styles.pendingIconBox}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={colors.warning} />
                </View>
                <View style={styles.pendingContent}>
                  <Text style={styles.pendingLabel}>Pending Requests</Text>
                  <Text style={styles.pendingCount}>{pendingRequests} awaiting approval</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Portfolio Overview ── */}
          <View style={[styles.section, { marginTop: 24 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Portfolio Overview</Text>
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Investments')}>
                <Text style={styles.viewAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={14} color={themeColors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.portfolioGrid}>
              {/* Total Invested */}
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.portfolioCard, styles.portfolioCardLarge]}
              >
                <MaterialCommunityIcons name="briefcase-outline" size={22} color="rgba(255,255,255,0.8)" />
                <Text style={styles.portfolioCardLabel}>Total Invested</Text>
                <Text style={styles.portfolioCardValue}>
                  {hideBalance ? '₹ ••••' : formatCurrencyCompact(totalInvested)}
                </Text>
                <View style={styles.portfolioCardBadge}>
                  <Text style={styles.portfolioCardBadgeText}>
                    {stats.activeInvestmentsCount || 0} Active Plans
                  </Text>
                </View>
              </LinearGradient>

              <View style={styles.portfolioRightCol}>
                {/* Total Returns */}
                <TouchableOpacity
                  style={[styles.portfolioCard, styles.portfolioCardSmall, { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.borderLight }]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('Investments')}
                >
                  <MaterialCommunityIcons name="chart-areaspline" size={18} color="#2D9A5A" />
                  <Text style={[styles.portfolioCardLabel, { color: themeColors.textMuted }]}>Returns</Text>
                  <Text style={[styles.portfolioCardValue, { color: '#2D9A5A', fontSize: 18 }]}>
                    {hideBalance ? '••' : `+${returnPct}%`}
                  </Text>
                </TouchableOpacity>

                {/* Pocket Money */}
                <TouchableOpacity
                  style={[styles.portfolioCard, styles.portfolioCardSmall, { backgroundColor: '#FEF3C2', borderWidth: 1, borderColor: '#F5E5A0' }]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('PocketMoney')}
                >
                  <MaterialCommunityIcons name="wallet-outline" size={18} color="#C68E0A" />
                  <Text style={[styles.portfolioCardLabel, { color: '#92400E' }]}>Pocket Money</Text>
                  <Text style={[styles.portfolioCardValue, { color: '#92400E', fontSize: 18 }]}>
                    {hideBalance ? '••' : formatCurrencyCompact(stats.totalPocketRemaining || 0)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Active Investments ── */}
          {activeInvestments.length > 0 && (
            <View style={[styles.section, { marginTop: 24 }]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Plans</Text>
                <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Investments')}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <MaterialCommunityIcons name="chevron-right" size={14} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
              {activeInvestments.slice(0, 3).map((inv, idx) => {
                const progress = inv.duration > 0
                  ? Math.min(((Date.now() - new Date(inv.startDate)) / (inv.duration * 30 * 24 * 60 * 60 * 1000)) * 100, 100)
                  : 0;
                return (
                  <TouchableOpacity
                    key={inv._id || idx}
                    style={styles.investmentItem}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Investments')}
                  >
                    <View style={[styles.investmentIconBox, { backgroundColor: '#E8F5EE' }]}>
                      <MaterialCommunityIcons name="trending-up" size={20} color="#1A5C39" />
                    </View>
                    <View style={styles.investmentContent}>
                      <View style={styles.investmentTopRow}>
                        <Text style={styles.investmentTitle} numberOfLines={1}>
                          {inv.planName || inv.type || 'Investment Plan'}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: '#E8F5EE' }]}>
                          <View style={[styles.statusDot, { backgroundColor: '#2D9A5A' }]} />
                          <Text style={[styles.statusText, { color: '#1A5C39' }]}>Active</Text>
                        </View>
                      </View>
                      <View style={styles.investmentMeta}>
                        <Text style={styles.investmentAmount}>
                          {hideBalance ? '₹ ••••' : formatCurrency(inv.amount || 0)}
                        </Text>
                        <Text style={styles.investmentRate}>
                          {inv.interestRate || inv.returnRate || 0}% p.a.
                        </Text>
                      </View>
                      <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${progress.toFixed(0)}%` }]} />
                        </View>
                        <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Recent Transactions ── */}
          {recentTransactions.length > 0 && (
            <View style={[styles.section, { marginTop: 24 }]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('Transactions')}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <MaterialCommunityIcons name="chevron-right" size={14} color={themeColors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.transactionsCard}>
                {recentTransactions.slice(0, 5).map((tx, idx) => {
                  const iconInfo = getTransactionIcon(tx.type);
                  const isCredit = tx.transactionType === 'credit' || tx.amount > 0;
                  return (
                    <View key={tx._id || idx}>
                      <View style={styles.txItem}>
                        <View style={[styles.txIconBox, { backgroundColor: iconInfo.bg }]}>
                          <MaterialCommunityIcons name={iconInfo.icon} size={18} color={iconInfo.color} />
                        </View>
                        <View style={styles.txContent}>
                          <Text style={styles.txTitle} numberOfLines={1}>
                            {tx.description || tx.type?.replace(/_/g, ' ') || 'Transaction'}
                          </Text>
                          <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                        </View>
                        <Text style={[styles.txAmount, { color: isCredit ? '#2D9A5A' : '#D94F2B' }]}>
                          {isCredit ? '+' : '-'}{hideBalance ? '••••' : formatCurrencyCompact(Math.abs(tx.amount || 0))}
                        </Text>
                      </View>
                      {idx < Math.min(recentTransactions.length, 5) - 1 && <View style={styles.txDivider} />}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Empty state if no investments yet ── */}
          {activeInvestments.length === 0 && recentTransactions.length === 0 && (
            <View style={[styles.section, { marginTop: 24 }]}>
              <TouchableOpacity
                style={styles.emptyStartCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('InvestmentDashboard')}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.emptyStartGradient}
                >
                  <MaterialCommunityIcons name="sprout-outline" size={42} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.emptyStartTitle}>Start Your Investment Journey</Text>
                  <Text style={styles.emptyStartBody}>
                    Invest as little as ₹500 and watch your money grow every day.
                  </Text>
                  <View style={styles.emptyStartBtn}>
                    <Text style={styles.emptyStartBtnText}>Invest Now →</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Market Insights ── */}
          <View style={[styles.section, { marginTop: 24 }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Market Insights</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
            >
              {MARKET_INSIGHTS.map((item, idx) => (
                <View key={idx} style={styles.insightChip}>
                  <View style={[styles.insightIconBox, { backgroundColor: item.color + '18' }]}>
                    <MaterialCommunityIcons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={styles.insightLabel}>{item.label}</Text>
                  <Text style={[styles.insightValue, { color: item.color }]}>{item.value}</Text>
                  {item.trend !== 'neutral' && (
                    <MaterialCommunityIcons
                      name={item.trend === 'up' ? 'arrow-up-thin' : 'arrow-down-thin'}
                      size={14}
                      color={item.trend === 'up' ? '#2D9A5A' : '#D94F2B'}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Tip Card ── */}
          <View style={[styles.section, { marginTop: 24, marginBottom: 4 }]}>
            <View style={styles.tipCard}>
              <ImageBackground
                source={require('../../../assets/tip-of-the-day-banner.jpg')}
                style={styles.tipCardBg}
                imageStyle={styles.tipCardImage}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.85)']}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.tipInner}>
                  <View style={styles.tipArtSpacer} />
                  <View style={styles.tipText}>
                    <View style={styles.tipCategoryBadge}>
                      <MaterialCommunityIcons name="lightbulb-on" size={12} color="#92400E" style={{ marginRight: 4 }} />
                      <Text style={styles.tipCategory}>TIP OF THE DAY</Text>
                    </View>
                    <Text style={styles.tipTitle} numberOfLines={1}>{tipOfTheDay.title}</Text>
                    <Text style={styles.tipBody} numberOfLines={3}>{tipOfTheDay.body}</Text>
                  </View>
                </View>
              </ImageBackground>
            </View>
          </View>

          {/* ── Refer & Earn Banner ── */}
          <View style={[styles.section, { marginTop: 16 }]}>
            <TouchableOpacity
              style={styles.referralCard}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('Referral')}
            >
              <View style={styles.referralLeft}>
                <Text style={styles.referralEmoji}>🎁</Text>
                <View>
                  <Text style={styles.referralTitle}>Refer & Earn</Text>
                  <Text style={styles.referralBody}>Invite friends and earn Growvest coins together</Text>
                </View>
              </View>
              <View style={styles.referralArrow}>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#1A5C39" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </Animated.View>
      </ScrollView>

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

// ─── Styles ─────────────────────────────────────────────────────────────────
const { StyleSheet } = require('react-native');

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 20,
    backgroundColor: colors.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  walletCoinText: { fontSize: 13, fontWeight: '800', color: colors.text },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  notifBadge: {
    position: 'absolute', top: 5, right: 5,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.surface,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', lineHeight: 13 },

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
  balanceCardInner: { padding: 22 },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceLabelText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  eyeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  balanceAmount: { fontSize: 34, fontWeight: '800', color: '#F8FAF9', letterSpacing: -1.2, marginTop: 12 },
  balanceTrend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  balanceTrendText: { fontSize: 12, color: colors.gold, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  statPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, gap: 4,
  },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  statValue: { fontSize: 12, fontWeight: '700', color: '#F8FAF9', letterSpacing: -0.3 },

  // Section
  section: { paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Quick Actions
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  quickAction: { alignItems: 'center', gap: 8, flex: 1 },
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

  // Pending Banner
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.warningLight, borderRadius: 16,
    padding: 14,
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

  // Portfolio Overview Grid
  portfolioGrid: { flexDirection: 'row', gap: 12 },
  portfolioCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  portfolioCardLarge: {
    flex: 1.1,
    minHeight: 150,
    justifyContent: 'space-between',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  portfolioRightCol: { flex: 0.9, gap: 12 },
  portfolioCardSmall: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  portfolioCardLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8 },
  portfolioCardValue: { fontSize: 22, fontWeight: '800', color: '#F8FAF9', letterSpacing: -0.5, marginTop: 4 },
  portfolioCardBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 8,
  },
  portfolioCardBadgeText: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },

  // Active Investments
  investmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  investmentIconBox: {
    width: 42, height: 42, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  investmentContent: { flex: 1 },
  investmentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  investmentTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  investmentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  investmentAmount: { fontSize: 13, fontWeight: '700', color: colors.text },
  investmentRate: { fontSize: 11, color: '#2D9A5A', fontWeight: '600' },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: {
    flex: 1, height: 5, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#1A5C39', borderRadius: 4 },
  progressText: { fontSize: 10, color: colors.textMuted, fontWeight: '600', minWidth: 30, textAlign: 'right' },

  // Transactions
  transactionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  txItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  txIconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txContent: { flex: 1 },
  txTitle: { fontSize: 13, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  txDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  txDivider: { height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 },

  // Empty Start Card
  emptyStartCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 30, elevation: 14,
  },
  emptyStartGradient: {
    alignItems: 'center',
    padding: 32,
    gap: 10,
  },
  emptyStartTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAF9', textAlign: 'center', letterSpacing: -0.5 },
  emptyStartBody: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },
  emptyStartBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  emptyStartBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Market Insights
  insightChip: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    minWidth: 90,
    borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  insightIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  insightValue: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },

  // Tip Card
  tipCard: {
    borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(235, 215, 185, 0.4)',
    overflow: 'hidden',
    shadowColor: '#8C6D3B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 1,
    backgroundColor: '#FDF7EC',
  },
  tipCardBg: { width: '100%', minHeight: 110, justifyContent: 'center' },
  tipCardImage: { borderRadius: 22 },
  tipInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14, gap: 8,
  },
  tipArtSpacer: { width: 80 },
  tipText: { flex: 1 },
  tipCategoryBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginBottom: 4,
  },
  tipCategory: { fontSize: 9.5, color: '#92400E', fontWeight: '800', letterSpacing: 0.8 },
  tipTitle: { fontSize: 14, fontWeight: '800', color: '#1A2E22', letterSpacing: -0.2, marginBottom: 2 },
  tipBody: { fontSize: 11.5, color: '#374151', lineHeight: 16, fontWeight: '500' },

  // Referral Card
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5EE',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C4E0D2',
  },
  referralLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  referralEmoji: { fontSize: 28 },
  referralTitle: { fontSize: 14, fontWeight: '700', color: '#0E3D23' },
  referralBody: { fontSize: 12, color: '#1A5C39', marginTop: 2 },
  referralArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(26, 92, 57, 0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
});

export default HomeScreen;
