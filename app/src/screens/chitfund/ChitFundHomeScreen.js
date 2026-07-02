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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 64) / 2;

const ChitFundHomeScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || '0'}`;
  };

  const StatCard = ({ icon, label, value, color, bgColor, accent }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent || colors.text }]}>{value}</Text>
    </View>
  );

  const QuickAction = ({ icon, label, gradient, onPress, badge }) => (
    <TouchableOpacity style={styles.quickAction} activeOpacity={0.85} onPress={onPress}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickActionGradient}
      >
        <MaterialCommunityIcons name={icon} size={26} color={colors.white} />
      </LinearGradient>
      <Text style={styles.quickActionLabel}>{label}</Text>
      {badge && (
        <View style={styles.quickActionBadge}>
          <Text style={styles.quickActionBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View>
          <Text style={styles.greeting}>Chit Fund</Text>
          <Text style={styles.subtitle}>Your savings community</Text>
        </View>
        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => navigation.navigate('ChitSupport')}
        >
          <MaterialCommunityIcons name="headset" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {loading || !dashboard ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Dashboard...</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Premium Hero */}
          <View style={styles.heroContainer}>
            <LinearGradient
              colors={['#064e3b', '#065f46', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons name="cash-multiple" size={28} color="rgba(255,255,255,0.9)" />
                </View>
                <View style={styles.heroBadge}>
                  <MaterialCommunityIcons name="shield-check" size={12} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.heroBadgeText}>Active</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>Active Chits</Text>
              <Text style={styles.heroCount}>{dashboard.activeChits}</Text>
              <View style={styles.heroDivider} />
              <View style={styles.heroRow}>
                <View style={styles.heroItem}>
                  <Text style={styles.heroItemLabel}>Total Paid</Text>
                  <Text style={styles.heroItemValue}>{formatCurrency(dashboard.totalPaid)}</Text>
                </View>
                <View style={styles.heroDividerV} />
                <View style={styles.heroItem}>
                  <Text style={styles.heroItemLabel}>Dividend</Text>
                  <Text style={styles.heroItemValue}>{formatCurrency(dashboard.totalDividend)}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="account-group"
              label="Joined Chits"
              value={dashboard.myJoinedChits.toString()}
              color="#2563eb"
              bgColor="#dbeafe"
            />
            <StatCard
              icon="calendar-clock"
              label="Next Due"
              value={formatCurrency(dashboard.upcomingDue)}
              color="#ca8a04"
              bgColor="#fef9c3"
            />
            <StatCard
              icon="gavel"
              label="Auction Date"
              value={dashboard.nextAuctionDate?.slice(5) || 'N/A'}
              color="#7c3aed"
              bgColor="#ede9fe"
            />
            <StatCard
              icon="trophy-outline"
              label="Winning Status"
              value={dashboard.winningStatus}
              color="#16a34a"
              bgColor="#dcfce7"
            />
          </View>

          {/* Available Chits Banner */}
          <TouchableOpacity
            style={styles.availableBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExploreChits')}
          >
            <View style={styles.availableBannerLeft}>
              <View style={styles.availableIconWrap}>
                <MaterialCommunityIcons name="treasure-chest" size={28} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.availableTitle}>{dashboard.availableChits} Chits Available</Text>
                <Text style={styles.availableSub}>Explore and join new chit funds</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <QuickAction
                icon="compass"
                label="Explore"
                gradient={['#064e3b', '#065f46']}
                onPress={() => navigation.navigate('ExploreChits')}
              />
              <QuickAction
                icon="account-cash"
                label="My Chits"
                gradient={['#047857', '#059669']}
                onPress={() => navigation.navigate('MyChits')}
              />
              <QuickAction
                icon="cash-check"
                label="Pay Due"
                gradient={['#1e40af', '#2563eb']}
                onPress={() => navigation.navigate('MonthlyDue')}
                badge="1"
              />
              <QuickAction
                icon="gavel"
                label="Auction"
                gradient={['#7c3aed', '#8b5cf6']}
                onPress={() => navigation.navigate('Auction')}
              />
              <QuickAction
                icon="history"
                label="History"
                gradient={['#b45309', '#d97706']}
                onPress={() => navigation.navigate('PaymentHistory')}
              />
              <QuickAction
                icon="headset"
                label="Support"
                gradient={['#be185d', '#db2777']}
                onPress={() => navigation.navigate('ChitSupport')}
              />
            </View>
          </View>

            <View style={{ height: 100 }} />
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  supportBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Hero
  heroContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    ...colors.shadow.elevated,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroCount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
    marginBottom: 20,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroItem: {
    flex: 1,
  },
  heroItemLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroItemValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
  heroDividerV: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 10,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    ...colors.shadow.card,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  // Available Banner
  availableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  availableBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availableIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  availableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  availableSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Quick Actions
  quickActionsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: (SCREEN_WIDTH - 64) / 3,
    alignItems: 'center',
    position: 'relative',
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...colors.shadow.button,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: colors.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  }
});

export default ChitFundHomeScreen;