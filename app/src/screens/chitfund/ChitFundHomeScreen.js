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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
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
const QuickAction = React.memo(({ icon, label, onPress, badge }) => {
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
        <Ionicons name={icon} size={26} color={colors.primary} />
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
                    <Text style={styles.heroStatusText}>Active</Text>
                  </View>
                </View>

                <Text style={styles.heroTitle}>Active Chits</Text>
                {/* Animated counter */}
                <Text style={styles.heroCount}>{animatedChitCount}</Text>

                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Total Paid</Text>
                    <Text style={styles.heroStatValue}>{formatCurrency(dashboard.totalPaid)}</Text>
                  </View>
                  <View style={styles.heroDividerV} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatLabel}>Dividend Earned</Text>
                    <Text style={[styles.heroStatValue, { color: colors.gold }]}>
                      {formatCurrency(dashboard.totalDividend)}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Available Banner */}
            <Pressable
              style={styles.availableBanner}
              onPress={() => navigation.navigate('ExploreChits')}
              onPressIn={() => { bannerScale.value = withSpring(0.97, PRESS_SPRING); }}
              onPressOut={() => { bannerScale.value = withSpring(1, PRESS_SPRING); }}
            >
                <View style={styles.availableBannerLeft}>
                  <View style={styles.availableIconWrap}>
                    <Ionicons name="layers-outline" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.availableTextWrap}>
                    <Text style={styles.availableTitle}>
                      {dashboard.availableChits} New Chits Available
                    </Text>
                    <Text style={styles.availableSub}>Explore and join new groups</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward-outline" size={22} color={colors.textSecondary} />
            </Pressable>

            {/* Quick Actions + Stats */}
            <View>
              {/* Quick Actions Grid */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={styles.quickActionsGrid}>
                <QuickAction
                  icon="compass-outline"
                  label="Explore"
                  onPress={() => navigation.navigate('ExploreChits')}
                />
                <QuickAction
                  icon="people-outline"
                  label="My Chits"
                  onPress={() => navigation.navigate('MyChits')}
                />
                <QuickAction
                  icon="card-outline"
                  label="Pay Due"
                  onPress={() => navigation.navigate('MonthlyDue')}
                  badge={dashboard.upcomingDue > 0 ? dashboard.pendingDueCount || '!' : null}
                />
                <QuickAction
                  icon="hammer-outline"
                  label="Auction"
                  onPress={() => navigation.navigate('Auction')}
                />
              </View>

              {/* Stats Grid */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Overview</Text>
              </View>
              <View style={styles.statsGrid}>
                <StatCard
                  icon="people-circle-outline"
                  label="Joined Chits"
                  value={dashboard.myJoinedChits.toString()}
                  tint={colors.primaryLight}
                  iconColor={colors.primary}
                />
                <StatCard
                  icon="calendar-outline"
                  label="Next Due"
                  value={formatCurrency(dashboard.upcomingDue)}
                  tint="#fef3c7"
                  iconColor="#d97706"
                />
                <StatCard
                  icon="hammer-outline"
                  label="Auction Date"
                  value={dashboard.nextAuctionDate?.slice(5) || 'N/A'}
                  tint="#ede9fe"
                  iconColor="#7c3aed"
                />
                <StatCard
                  icon="trophy-outline"
                  label="Winning Status"
                  value={dashboard.winningStatus}
                  tint={colors.successLight}
                  iconColor={colors.success}
                />
              </View>
            </View>

            <View style={{ height: 110 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 48,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
    marginBottom: 24,
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
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroStatValue: { fontSize: 18, fontWeight: '700', color: colors.white },
  heroDividerV: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 20,
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
  sectionHeader: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  quickAction: { width: '25%', alignItems: 'center', marginBottom: 16 },
  quickActionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.surface,
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
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  quickActionBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },

  // Stats Grid
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