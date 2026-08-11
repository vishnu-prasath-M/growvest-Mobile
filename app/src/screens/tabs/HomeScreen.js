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
import { SkeletonLoader } from '../../components/SkeletonLoader';

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
  const [investModalVisible, setInvestModalVisible] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchUserAndDashboard = async () => {
    try {
      if (authUser?.name || authUser?.username) {
        setUserName(authUser.name || authUser.username || '');
      } else {
        const userData = await authService.getUserData();
        if (userData?.username || userData?.name) {
          setUserName(userData?.name || userData?.username || '');
        }
      }

      try {
        const freshUser = await authService.refreshUserProfile();
        if (freshUser?.name || freshUser?.username) {
          setUserName(freshUser.name || freshUser.username || '');
          await updateUser(freshUser);
        }
      } catch (profileError) {
        console.warn('Could not refresh profile for home greeting:', profileError?.message || profileError);
      }

      const data = await dashboardService.getDashboard();
      setDashboardData(data);

      if (data?.user?.name || data?.user?.username) {
        setUserName(data?.user?.name || data?.user?.username);
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

  const quickActions = [
    { label: 'New Investment', icon: 'plus-circle', onPress: () => setInvestModalVisible(true) },
    { label: 'My Investments', icon: 'briefcase', onPress: () => navigation.navigate('Investments') },
    { label: 'Withdraw', icon: 'bank-transfer-out', onPress: () => navigation.navigate('Withdraw') },
    { label: 'History', icon: 'receipt', onPress: () => navigation.navigate('Transactions') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0E3D23" />
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
          <SafeAreaView style={[styles.header]}>
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
                style={styles.themeBtn}
                onPress={toggleTheme}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name={isDarkMode ? "weather-sunny" : "weather-night"} 
                  size={22} 
                  color={themeColors.text} 
                />
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
          </SafeAreaView>

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
                  <View style={styles.eyeBtn}>
                    <MaterialCommunityIcons name="eye-outline" size={16} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>

                <Text style={styles.balanceAmount}>
                  {formatCurrency(balances?.totalBalance)}
                </Text>
                <View style={styles.balanceTrend}>
                  <MaterialCommunityIcons name="trending-up" size={14} color={colors.gold} />
                  <Text style={styles.balanceTrendText}>Growing your wealth</Text>
                </View>

                {/* Stats grid */}
                <View style={styles.statsRow}>
                  {[
                    { icon: 'piggy-bank-outline', label: 'Savings', value: formatCurrency(balances?.savingBalance) },
                    { icon: 'lock-outline', label: 'Fixed', value: formatCurrency(balances?.fixedBalance) },
                    { icon: 'cash-multiple', label: 'Earnings', value: formatCurrency(balances?.totalInterest) },
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
                  <View style={[styles.qaIconBox, a.label === 'New Investment' && styles.qaIconBoxPrimary]}>
                    {a.label === 'New Investment' ? (
                      <LinearGradient
                        colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.qaIconGradient}
                      >
                        <MaterialCommunityIcons name={a.icon} size={22} color="#F8FAF9" />
                      </LinearGradient>
                    ) : (
                      <View style={styles.qaIconSurface}>
                        <MaterialCommunityIcons name={a.icon} size={22} color={colors.primary} />
                      </View>
                    )}
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
                <Text style={styles.summaryCardValueLight}>{formatCurrency(balances?.availableToWithdraw)}</Text>
                <Text style={styles.summaryCardTrendGold}>Ready to withdraw</Text>
              </LinearGradient>
              <View style={[styles.summaryCard, styles.summaryCardSurface]}>
                <Text style={styles.summaryCardLabel}>Total Earned</Text>
                <Text style={styles.summaryCardValue}>{formatCurrency(balances?.totalInterest)}</Text>
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
              <View style={styles.tipAmbient} />
              <View style={styles.tipInner}>
                <LinearGradient
                  colors={['#E8D083', '#C89A30']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tipIconBox}
                >
                  <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.goldFg} />
                </LinearGradient>
                <View style={styles.tipText}>
                  <Text style={styles.tipCategory}>Tip of the day</Text>
                  <Text style={styles.tipTitle}>{tipOfTheDay.title}</Text>
                  <Text style={styles.tipBody}>
                    {tipOfTheDay.body}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ height: 110 }} />
        </Animated.View>
      </ScrollView>

      {/* ── Invest Now Modal ── */}
      <Modal
        visible={investModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvestModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setInvestModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invest Now</Text>
              <TouchableOpacity onPress={() => setInvestModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { icon: 'chart-line-variant', label: 'New Investment', sub: 'Start a new deposit', colors: ['#0E3D23', '#1A5C39'], screen: 'InvestmentAmount' },
              { icon: 'account-cash', label: 'My Investments', sub: 'View your deposits', colors: ['#1A5C39', '#2E8B5A'], screen: 'Investments' },
              { icon: 'cash-multiple', label: 'Chit Fund', sub: 'Join a savings community', colors: ['#0E3D23', '#1A5C39'], screen: 'ChitFundHome' },
              { icon: 'wallet-giftcard', label: 'Pocket Money', sub: 'Setup regular release payouts', colors: ['#1A5C39', '#2E8B5A'], screen: 'PocketMoney' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.modalOption}
                activeOpacity={0.85}
                onPress={() => {
                  setInvestModalVisible(false);
                  navigation.navigate(opt.screen);
                }}
              >
                <LinearGradient
                  colors={opt.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalOptionGradient}
                >
                  <MaterialCommunityIcons name={opt.icon} size={26} color={colors.white} />
                </LinearGradient>
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>{opt.label}</Text>
                  <Text style={styles.modalOptionSub}>{opt.sub}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
    marginTop: -20,
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
  qaIconBox: { width: 56, height: 56 },
  qaIconBoxPrimary: {},
  qaIconGradient: {
    width: 56, height: 56, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  qaIconSurface: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  qaLabel: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 14 },

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
    backgroundColor: colors.surface, borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  tipAmbient: {
    position: 'absolute', top: -20, right: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(212,168,67,0.12)',
  },
  tipInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 14 },
  tipIconBox: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#C89A30', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  tipText: { flex: 1 },
  tipCategory: { fontSize: 10, color: colors.gold, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 4 },
  tipBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 4 },

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
  modalOptionGradient: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  modalOptionText: { flex: 1 },
  modalOptionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  modalOptionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

export default HomeScreen;
