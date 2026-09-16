import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Animated,
  Pressable,
  Easing,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2; // Accounting for paddings and gap

// ---------- Spring configs ----------
const CARD_SPRING = { damping: 22, stiffness: 260, mass: 0.8 };
const PRESS_SPRING = { damping: 18, stiffness: 380, mass: 0.7 };
const BADGE_SPRING = { damping: 14, stiffness: 340, mass: 0.6 };

// ---------- Animated counter hook ----------
const useCountAnimation = (targetValue, duration = 900, delay = 300) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (targetValue == null) return;
    animValue.setValue(0);
    const listener = animValue.addListener(({ value }) => {
      setDisplayValue(Math.round(value));
    });
    const timeout = setTimeout(() => {
      Animated.timing(animValue, {
        toValue: targetValue,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => {
      animValue.removeListener(listener);
      clearTimeout(timeout);
    };
  }, [targetValue]);

  return displayValue;
};

// ---------- Animated stat card (no entrance animation — instant render) ----------
const StatCard = React.memo(({ icon, label, value, tint, iconColor }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={21} color={iconColor} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
});

// ---------- Animated quick action ----------
const QuickAction = React.memo(({ icon, label, onPress, badge, image }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);

  const scale = useSharedValue(1);
  const badgeScale = useSharedValue(badge ? 0 : 1);

  // Animate badge in on mount if present
  useEffect(() => {
    if (badge) {
      badgeScale.value = withDelay(
        600,
        withSequence(
          withSpring(1.25, BADGE_SPRING),
          withSpring(1, BADGE_SPRING)
        )
      );
    }
  }, [badge]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.88, PRESS_SPRING);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1.04, PRESS_SPRING, () => {
      scale.value = withSpring(1, PRESS_SPRING);
    });
  }, []);

  return (
    <Pressable
      style={styles.quickAction}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Reanimated.View style={[styles.quickActionIconWrap, containerStyle]}>
        {image ? (
          <Image source={image} style={styles.quickActionImage} resizeMode="contain" />
        ) : (
          <Ionicons name={icon} size={26} color={colors.primary} />
        )}
        {badge && (
          <Reanimated.View style={[styles.quickActionBadge, badgeStyle]}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </Reanimated.View>
        )}
      </Reanimated.View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
});

// ---------- Main Screen ----------
const ChitFundHomeScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);


  const fetchDashboard = useCallback(async () => {
    try {
      const data = await chitFundService.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Error fetching chit dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Refresh dashboard whenever this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  // Polling for auto-updating UI (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboard();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  // Animated counter for active chits
  const animatedChitCount = useCountAnimation(dashboard?.activeChits, 600, 0);

  // Banner/support button press animation
  const bannerScale = useSharedValue(1);
  const bannerPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bannerScale.value }],
  }));

  if (loading || !dashboard) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View>
            <Text style={styles.greeting}>Chit Funds</Text>
            <Text style={styles.subtitle}>Your savings community</Text>
          </View>
        </View>
        <SkeletonLoader variant="dashboard" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View>
          <Text style={styles.greeting}>Chit Funds</Text>
          <Text style={styles.subtitle}>Your savings community</Text>
        </View>
        <Pressable
          style={styles.supportBtn}
          onPress={() => navigation.navigate('ChitSupport')}
          onPressIn={() => { bannerScale.value = withSpring(0.92, PRESS_SPRING); }}
          onPressOut={() => { bannerScale.value = withSpring(1, PRESS_SPRING); }}
        >
          <Reanimated.View style={bannerPressStyle}>
            <Ionicons name="headset-outline" size={22} color={colors.primary} />
          </Reanimated.View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {false ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Dashboard...</Text>
          </View>
        ) : (
          <>
            {/* Premium Hero */}
            <View style={styles.heroOuter}>
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroBlob} />

                <View style={styles.heroTop}>
                  <View style={styles.heroIconBadgeWrap}>
                    <Ionicons name="wallet-outline" size={24} color={colors.gold} />
                  </View>
                  <View style={styles.heroStatusPill}>
                    <View style={styles.heroStatusDot} />
                    <Text style={styles.heroStatusText}>{dashboard.activeChits || 0} Active</Text>
                  </View>
                </View>

                <Text style={styles.heroTitle}>Total Chit Invested</Text>
                {/* Invested amount from database */}
                <Text style={styles.heroCount}>{formatCurrency(dashboard.totalPaid)}</Text>

                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Active Chits</Text>
                    <Text style={styles.heroStatValue}>{dashboard.activeChits || 0}</Text>
                  </View>
                  <View style={styles.heroDividerV} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Dividend Earned</Text>
                    <Text style={[styles.heroStatValue, { color: colors.gold }]}>
                      {formatCurrency(dashboard.totalDividend)}
                    </Text>
                  </View>
                  <View style={styles.heroDividerV} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Next Due</Text>
                    <Text style={styles.heroStatValue}>
                      {formatCurrency(dashboard.upcomingDue || 0)}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Urgent / Next Due Payment Banner (if due > 0) */}
            {dashboard.upcomingDue > 0 && (
              <View style={styles.dueBannerOuter}>
                <Pressable
                  style={styles.dueBannerCard}
                  onPress={() => navigation.navigate('MonthlyDue')}
                >
                  <LinearGradient
                    colors={['#FFFBEB', '#FEF3C7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.dueBannerGradient}
                  >
                    <View style={styles.dueBannerLeft}>
                      <View style={styles.dueIconWrap}>
                        <Ionicons name="calendar" size={22} color="#D97706" />
                        <View style={styles.duePulseDot} />
                      </View>
                      <View style={styles.dueTextWrap}>
                        <View style={styles.dueTitleRow}>
                          <Text style={styles.dueTitle}>Upcoming Installment Due</Text>
                          <View style={styles.dueBadgePill}>
                            <Text style={styles.dueBadgeText}>
                              {dashboard.pendingDueCount || 1} PENDING
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.dueAmount}>{formatCurrency(dashboard.upcomingDue)}</Text>
                        <Text style={styles.dueSubText}>
                          {dashboard.nextDueDate ? `Due by ${dashboard.nextDueDate}` : 'Pay before next auction'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dueActionBtn}>
                      <Text style={styles.dueActionText}>Pay Now</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            {/* Quick Actions Hub (4 Grid) */}
            <View style={{ marginTop: 8 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={styles.quickActionsGrid}>
                <QuickAction
                  image={require('../../../assets/compass.png')}
                  label="Explore"
                  onPress={() => navigation.navigate('ExploreChits')}
                />
                <QuickAction
                  image={require('../../../assets/my-chits.png')}
                  label="My Chits"
                  onPress={() => navigation.navigate('MyChits')}
                  badge={dashboard.activeChits > 0 ? dashboard.activeChits : null}
                />
                <QuickAction
                  image={require('../../../assets/due.png')}
                  label="Pay Due"
                  onPress={() => navigation.navigate('MonthlyDue')}
                  badge={dashboard.upcomingDue > 0 ? (dashboard.pendingDueCount || '!') : null}
                />
                <QuickAction
                  image={require('../../../assets/auction.png')}
                  label="Auctions"
                  onPress={() => navigation.navigate('WinnerHistory')}
                  badge="LIVE"
                />
              </View>
            </View>

            {/* Chit Intelligence & Yield Advantage (Unique Circular Dial Cards) */}
            <View style={{ marginTop: 12 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chit Intelligence</Text>
                <Text style={styles.sectionSubtitle}>Why community chits beat regular savings</Text>
              </View>

              <View style={styles.uniqueChitGrid}>
                {/* Card 1: Dividend Yield Advantage */}
                <Pressable
                  style={styles.uniqueChitCard}
                  onPress={() => navigation.navigate('DividendHistory')}
                >
                  <LinearGradient
                    colors={['#FFFFFF', '#F2FAF5', '#E6F7EE']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.uniqueChitGradient}
                  >
                    <View style={styles.uniqueChitAmbientCircle} />
                    <View style={styles.uniqueChitRow}>
                      <View style={styles.uniqueChitDialOuter}>
                        <View style={styles.uniqueChitDialInner}>
                          <Ionicons name="trending-up" size={16} color="#059669" />
                          <Text style={styles.uniqueChitDialText}>12%</Text>
                        </View>
                      </View>
                      <View style={styles.uniqueChitBody}>
                        <View style={styles.uniqueChitHeaderRow}>
                          <Text style={styles.uniqueChitTag}>DIVIDEND BONUS</Text>
                          <Ionicons name="arrow-forward" size={14} color="#059669" />
                        </View>
                        <Text style={styles.uniqueChitTitle}>Monthly Dividend Pool</Text>
                        <Text style={styles.uniqueChitDesc}>
                          Non-bidding members receive equal shares of auction discount credited directly back.
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>

                {/* Card 2: 0% Interest Borrowing */}
                <Pressable
                  style={styles.uniqueChitCard}
                  onPress={() => navigation.navigate('ChitRules')}
                >
                  <LinearGradient
                    colors={['#FFFFFF', '#F0F7FB', '#E2F0F9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.uniqueChitGradient}
                  >
                    <View style={[styles.uniqueChitAmbientCircle, { backgroundColor: 'rgba(2, 132, 199, 0.08)' }]} />
                    <View style={styles.uniqueChitRow}>
                      <View style={[styles.uniqueChitDialOuter, { borderColor: 'rgba(2, 132, 199, 0.35)', backgroundColor: 'rgba(2, 132, 199, 0.06)' }]}>
                        <View style={[styles.uniqueChitDialInner, { borderColor: '#0284C7', backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                          <Ionicons name="shield-checkmark" size={16} color="#0284C7" />
                          <Text style={[styles.uniqueChitDialText, { color: '#0284C7' }]}>0%</Text>
                        </View>
                      </View>
                      <View style={styles.uniqueChitBody}>
                        <View style={styles.uniqueChitHeaderRow}>
                          <Text style={[styles.uniqueChitTag, { color: '#0284C7' }]}>EMERGENCY POT</Text>
                          <Ionicons name="arrow-forward" size={14} color="#0284C7" />
                        </View>
                        <Text style={styles.uniqueChitTitle}>Zero Interest Liquidity</Text>
                        <Text style={styles.uniqueChitDesc}>
                          Bid in the monthly auction whenever you need urgent cash without bank loan paperwork.
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>

            {/* Chit Records & Hub (2x2 Modern Cards) */}
            <View style={{ marginTop: 20 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chit Services & Records</Text>
              </View>

              <View style={styles.toolsGrid}>
                {/* 1. Winner Gallery */}
                <Pressable
                  style={styles.toolCard}
                  onPress={() => navigation.navigate('WinnerHistory')}
                >
                  <View style={[styles.toolIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="trophy-outline" size={22} color="#D97706" />
                  </View>
                  <Text style={styles.toolTitle}>Winner Gallery</Text>
                  <Text style={styles.toolSub}>Auction winners & payouts</Text>
                  <View style={styles.toolArrow}>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>

                {/* 2. Dividend History */}
                <Pressable
                  style={styles.toolCard}
                  onPress={() => navigation.navigate('DividendHistory')}
                >
                  <View style={[styles.toolIconWrap, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="gift-outline" size={22} color="#059669" />
                  </View>
                  <Text style={styles.toolTitle}>Dividend Log</Text>
                  <Text style={styles.toolSub}>Track dividend returns</Text>
                  <View style={styles.toolArrow}>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>

                {/* 3. Receipts */}
                <Pressable
                  style={styles.toolCard}
                  onPress={() => navigation.navigate('Receipts')}
                >
                  <View style={[styles.toolIconWrap, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="receipt-outline" size={22} color="#0284C7" />
                  </View>
                  <Text style={styles.toolTitle}>Payment Receipts</Text>
                  <Text style={styles.toolSub}>Download invoices</Text>
                  <View style={styles.toolArrow}>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>

                {/* 4. Chit Rules */}
                <Pressable
                  style={styles.toolCard}
                  onPress={() => navigation.navigate('ChitRules')}
                >
                  <View style={[styles.toolIconWrap, { backgroundColor: '#EDE9FE' }]}>
                    <Ionicons name="book-outline" size={22} color="#7C3AED" />
                  </View>
                  <Text style={styles.toolTitle}>Rules & Caps</Text>
                  <Text style={styles.toolSub}>Chit acts & commission</Text>
                  <View style={styles.toolArrow}>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>
              </View>
            </View>

            {/* How Chit Bidding Works (3-Step Timeline) */}
            <View style={{ marginTop: 24 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>How Chit Bidding Works</Text>
                <Text style={styles.sectionSubtitle}>Simple 3-step community cycle</Text>
              </View>

              <View style={styles.stepsCardOuter}>
                <View style={styles.stepsCard}>
                  {/* Step 1 */}
                  <View style={styles.stepItem}>
                    <View style={styles.stepIndicatorCol}>
                      <View style={[styles.stepNode, { backgroundColor: '#059669' }]}>
                        <Text style={styles.stepNodeNumber}>1</Text>
                      </View>
                      <View style={styles.stepLine} />
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>Monthly Pot Pooling</Text>
                      <Text style={styles.stepDesc}>
                        Members deposit equal monthly installments to form a collective lump-sum prize pot.
                      </Text>
                    </View>
                  </View>

                  {/* Step 2 */}
                  <View style={styles.stepItem}>
                    <View style={styles.stepIndicatorCol}>
                      <View style={[styles.stepNode, { backgroundColor: '#0284C7' }]}>
                        <Text style={styles.stepNodeNumber}>2</Text>
                      </View>
                      <View style={styles.stepLine} />
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>Reverse Live Auction</Text>
                      <Text style={styles.stepDesc}>
                        Members in need of funds bid a discount. The lowest bidder wins the prize pool instantly.
                      </Text>
                    </View>
                  </View>

                  {/* Step 3 */}
                  <View style={styles.stepItem}>
                    <View style={styles.stepIndicatorCol}>
                      <View style={[styles.stepNode, { backgroundColor: '#D97706' }]}>
                        <Text style={styles.stepNodeNumber}>3</Text>
                      </View>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>Equal Dividend Payout</Text>
                      <Text style={styles.stepDesc}>
                        The auction discount is shared equally among all non-winning members as dividend earnings!
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Trust & FAQ Footer Banner */}
            <View style={styles.trustBannerOuter}>
              <Pressable
                style={styles.trustBannerCard}
                onPress={() => navigation.navigate('ChitFAQ')}
              >
                <View style={styles.trustBannerLeft}>
                  <View style={styles.trustIconWrap}>
                    <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustTitle}>100% Regulated & Secure</Text>
                    <Text style={styles.trustSub}>
                      Governed by state Chit Fund Acts with transparent digital ledgers.
                    </Text>
                  </View>
                </View>
                <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
              </Pressable>
            </View>

            <View style={{ height: 110 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  supportBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  // Hero
  heroOuter: { paddingHorizontal: 20, marginBottom: 16 },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#1A5C39',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  heroBlob: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(212,168,67,0.15)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconBadgeWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  heroStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroCount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 16,
  },
  heroStatItem: { flex: 1 },
  heroStatLabel: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  heroStatValue: { fontSize: 15, fontWeight: '700', color: colors.white },
  heroDividerV: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 10,
  },

  // Available Banner
  availableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  availableBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  availableIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  availableTextWrap: { flex: 1 },
  availableTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  availableSub: { fontSize: 13, color: colors.textMuted },

  // Sections
  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sectionSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontWeight: '500' },

  // Due Banner
  dueBannerOuter: { paddingHorizontal: 20, marginBottom: 16 },
  dueBannerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  dueBannerGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  dueIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  duePulseDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dueTextWrap: { flex: 1 },
  dueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  dueTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  dueBadgePill: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dueBadgeText: { fontSize: 8.5, fontWeight: '800', color: '#DC2626' },
  dueAmount: { fontSize: 20, fontWeight: '900', color: '#78350F', letterSpacing: -0.5 },
  dueSubText: { fontSize: 11.5, color: '#B45309', marginTop: 1, fontWeight: '500' },
  dueActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  dueActionText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quickAction: { width: '25%', alignItems: 'center', marginBottom: 12 },
  quickActionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  quickActionLabel: { fontSize: 11.5, fontWeight: '700', color: colors.text },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  quickActionBadgeText: { fontSize: 9.5, fontWeight: '800', color: colors.white },
  quickActionImage: {
    width: 32,
    height: 32,
  },

  // Unique Chit Intelligence Cards
  uniqueChitGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  uniqueChitCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.18)',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  uniqueChitGradient: {
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  uniqueChitAmbientCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  uniqueChitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  uniqueChitDialOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uniqueChitDialInner: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uniqueChitDialText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#047857',
    marginTop: 1,
  },
  uniqueChitBody: {
    flex: 1,
  },
  uniqueChitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  uniqueChitTag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.8,
  },
  uniqueChitTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  uniqueChitDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16.5,
  },

  // Chit Services & Tools (2x2 Grid)
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  toolCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  toolSub: {
    fontSize: 11.5,
    color: colors.textMuted,
    fontWeight: '500',
  },
  toolArrow: {
    position: 'absolute',
    top: 16,
    right: 14,
  },

  // How Chit Bidding Works
  stepsCardOuter: {
    paddingHorizontal: 20,
  },
  stepsCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 14,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  stepNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNodeNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginTop: 6,
  },
  stepContent: {
    flex: 1,
    paddingTop: 3,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16.5,
  },

  // Trust & Security Banner
  trustBannerOuter: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  trustBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  trustBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  trustIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 1,
  },
  trustSub: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 14,
  },

  // Stats Grid (Legacy / fallback)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

  // Loading
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 14 },
});

export default ChitFundHomeScreen;