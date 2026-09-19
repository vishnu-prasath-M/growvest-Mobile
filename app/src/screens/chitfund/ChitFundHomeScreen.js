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
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
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

            {/* Executive / Next Due Payment Card */}
            {dashboard.upcomingDue > 0 && (
              <View style={styles.dueCardOuter}>
                <Pressable
                  style={styles.dueCardPressable}
                  onPress={() => navigation.navigate('MonthlyDue')}
                >
                  <LinearGradient
                    colors={['#0F251A', '#163826', '#0B1E15']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dueCardGradient}
                  >
                    {/* Ambient Glow */}
                    <View style={styles.dueAmbientGlow} />

                    {/* Top Row: Tag & Due Date */}
                    <View style={styles.dueTopRow}>
                      <View style={styles.duePillWrap}>
                        <View style={styles.duePulseDot} />
                        <Text style={styles.duePillText}>INSTALLMENT DUE</Text>
                        {dashboard.pendingDueCount > 1 && (
                          <View style={styles.dueBadgePill}>
                            <Text style={styles.dueBadgeText}>
                              {dashboard.pendingDueCount} DUES
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.dueDateBadge}>
                        <Ionicons name="time-outline" size={12} color="#D4A843" />
                        <Text style={styles.dueDateText}>
                          {dashboard.nextDueDate ? `Due ${dashboard.nextDueDate}` : 'Pay on time'}
                        </Text>
                      </View>
                    </View>

                    {/* Main Row: Amount & Action */}
                    <View style={styles.dueMainRow}>
                      <View style={styles.dueAmountCol}>
                        <Text style={styles.dueLabel}>TOTAL AMOUNT DUE</Text>
                        <Text style={styles.dueAmount}>{formatCurrency(dashboard.upcomingDue)}</Text>
                        <Text style={styles.dueSubText}>Pay before cycle closes to earn dividends</Text>
                      </View>
                      <View style={styles.duePayButtonWrap}>
                        <LinearGradient
                          colors={['#E5B842', '#C69222']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.duePayButton}
                        >
                          <Text style={styles.duePayText}>Pay Now</Text>
                          <Ionicons name="arrow-forward" size={14} color="#082012" />
                        </LinearGradient>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            {/* Quick Actions Hub (Clean 3-grid) */}
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
              </View>
            </View>

            {/* Overview Section */}
            <View style={{ marginTop: 10 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Overview</Text>
              </View>
              <View style={styles.statsGrid}>
                <StatCard
                  icon="people-outline"
                  label="Joined Chits"
                  value={(dashboard.myJoinedChits || dashboard.activeChits || 0).toString()}
                  tint={colors.primaryLight}
                  iconColor={colors.primary}
                />
                <StatCard
                  icon="ribbon-outline"
                  label="Prize Status"
                  value={dashboard.winningStatus || 'Not Won Yet'}
                  tint={dashboard.winningStatus === 'Won' ? '#D1FAE5' : '#FEF3C7'}
                  iconColor={dashboard.winningStatus === 'Won' ? '#059669' : '#D97706'}
                />
              </View>
            </View>

            {/* How Chit Fund Works (Connected Stepper UI) */}
            <View style={styles.howItWorksOuter}>
              <View style={styles.howItWorksCard}>
                {/* Header */}
                <View style={styles.howItWorksHeader}>
                  <View style={styles.howItWorksHeaderLeft}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.howItWorksIconWrap}
                    >
                      <Ionicons name="git-network-outline" size={18} color="#FFFFFF" />
                    </LinearGradient>
                    <View>
                      <Text style={styles.howItWorksTitle}>How Chit Fund Works</Text>
                      <Text style={styles.howItWorksSubtitle}>Save, borrow & earn in 3 simple steps</Text>
                    </View>
                  </View>
                  <View style={styles.howItWorksStepBadge}>
                    <View style={styles.howItWorksDot} />
                    <Text style={styles.howItWorksBadgeText}>3 STEPS</Text>
                  </View>
                </View>

                {/* Connected Steps */}
                <View style={styles.stepperContainer}>
                  {/* Step 1 */}
                  <View style={styles.stepRow}>
                    <View style={styles.nodeColumn}>
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={styles.stepNode}
                      >
                        <Text style={styles.stepNodeText}>1</Text>
                      </LinearGradient>
                      <LinearGradient
                        colors={['#10B981', '#F59E0B']}
                        style={styles.connectingLine}
                      />
                    </View>
                    <View style={styles.stepContent}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepTitle}>Pool & Save</Text>
                        <View style={styles.stepChip}>
                          <Text style={styles.stepChipText}>Equal Dues</Text>
                        </View>
                      </View>
                      <Text style={styles.stepDesc}>
                        Verified members contribute a fixed installment every cycle into a common secured fund.
                      </Text>
                    </View>
                  </View>

                  {/* Step 2 */}
                  <View style={styles.stepRow}>
                    <View style={styles.nodeColumn}>
                      <LinearGradient
                        colors={['#F59E0B', '#D97706']}
                        style={styles.stepNode}
                      >
                        <Text style={styles.stepNodeText}>2</Text>
                      </LinearGradient>
                      <LinearGradient
                        colors={['#F59E0B', '#059669']}
                        style={styles.connectingLine}
                      />
                    </View>
                    <View style={styles.stepContent}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepTitle}>Reverse Auction</Text>
                        <View style={[styles.stepChip, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                          <Text style={[styles.stepChipText, { color: isDarkMode ? '#FBBF24' : '#D97706' }]}>Instant Cash</Text>
                        </View>
                      </View>
                      <Text style={styles.stepDesc}>
                        Need money urgently? Bid for the lowest discount to claim the entire prize pool with zero paperwork.
                      </Text>
                    </View>
                  </View>

                  {/* Step 3 */}
                  <View style={styles.stepRow}>
                    <View style={styles.nodeColumn}>
                      <LinearGradient
                        colors={['#059669', '#047857']}
                        style={styles.stepNode}
                      >
                        <Text style={styles.stepNodeText}>3</Text>
                      </LinearGradient>
                    </View>
                    <View style={styles.stepContent}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepTitle}>Win Pot & Dividends</Text>
                        <View style={styles.stepChip}>
                          <Text style={styles.stepChipText}>High Returns</Text>
                        </View>
                      </View>
                      <Text style={styles.stepDesc}>
                        The winning bidder receives the cash payout, while the auction discount is distributed equally to all members as dividend profit!
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Footer Action */}
                <Pressable
                  style={styles.howItWorksFooter}
                  onPress={() => navigation.navigate('ChitFAQ')}
                >
                  <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.howItWorksFooterText}>Read rules, bidding limits & FAQs</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </Pressable>
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
                    <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustTitle}>100% Regulated & Secure</Text>
                    <Text style={styles.trustSub}>
                      Governed by state Chit Fund Acts with transparent digital ledgers.
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>

            <View style={{ height: 110 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (colors, isDarkMode = false) => StyleSheet.create({
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

  // Sections
  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sectionSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontWeight: '500' },

  // Due Card (Executive Luxury Theme)
  dueCardOuter: { paddingHorizontal: 20, marginBottom: 16 },
  dueCardPressable: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(212, 168, 67, 0.35)',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  dueCardGradient: {
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  dueAmbientGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(212, 168, 67, 0.08)',
  },
  dueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  duePillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  duePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  duePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#D4A843',
    letterSpacing: 1.2,
  },
  dueBadgePill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dueBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 0.5,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  dueMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dueAmountCol: {
    flex: 1,
  },
  dueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  dueAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  dueSubText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 3,
  },
  duePayButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#D4A843',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  duePayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  duePayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#082012',
    letterSpacing: 0.2,
  },

  // Quick Actions (3 Grid)
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  quickAction: { width: '33.33%', alignItems: 'center', marginBottom: 12 },
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
  quickActionLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
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

  // How Chit Fund Works (Connected Stepper)
  howItWorksOuter: {
    paddingHorizontal: 20,
    marginTop: 18,
  },
  howItWorksCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(14, 61, 35, 0.1)',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDarkMode ? 0.25 : 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : colors.borderLight,
  },
  howItWorksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  howItWorksIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  howItWorksTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  howItWorksSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  howItWorksStepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
  },
  howItWorksDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  howItWorksBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  stepperContainer: {
    paddingLeft: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 26,
    marginRight: 12,
  },
  stepNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  stepNodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  connectingLine: {
    width: 2,
    height: 48,
    marginVertical: 3,
    borderRadius: 1,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 12,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  stepTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  stepChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
  },
  stepChipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#10B981',
  },
  stepDesc: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  howItWorksFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : colors.borderLight,
  },
  howItWorksFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // Trust & Security Banner
  trustBannerOuter: {
    paddingHorizontal: 20,
    marginTop: 16,
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