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
} from 'react-native';
import { Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { dashboardService } from '../../services/dashboardService';
import { authService } from '../../services/authService';
import { colors, typography, spacing } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const { user: authUser, updateUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  
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

  useFocusEffect(
    useCallback(() => {
      fetchUserAndDashboard();
    }, [authUser?.username, authUser?.name, authUser?.mobileNumber])
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [dashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserAndDashboard();
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <MaterialCommunityIcons name="leaf" size={48} color={colors.primaryLight} />
          <Text style={styles.loadingText}>Growvest</Text>
        </View>
      </View>
    );
  }

  const userData = dashboardData?.user;
  const balances = dashboardData?.balances;
  const pendingRequests = dashboardData?.stats?.pendingRequests || 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingLabel}>Good Morning,</Text>
          <Text style={styles.username} numberOfLines={1}>
            {userName || userData?.username || 'Investor'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.avatarButton}
        >
          <View style={[styles.avatar, styles.avatarWithShadow]}>
            <Text style={styles.avatarText}>
              {(userName || userData?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

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
          {/* Current Balance - Premium Hero Card */}
          <View style={styles.balanceHeroContainer}>
            <LinearGradient
              colors={['#064e3b', '#065f46', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceHero}
            >
              <View style={styles.balanceHeroInner}>
                <View style={styles.balanceHeaderRow}>
                  <Text style={styles.balanceLabel}>Total Balance</Text>
                  <View style={styles.balanceBadge}>
                    <MaterialCommunityIcons name="shield-check" size={12} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.balanceBadgeText}>Secure</Text>
                  </View>
                </View>
                <Text style={styles.balanceAmount}>
                  {formatCurrency(balances?.totalBalance)}
                </Text>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceRow}>
                  <View style={styles.balanceItem}>
                    <View style={styles.balanceItemIcon}>
                      <MaterialCommunityIcons name="piggy-bank-outline" size={20} color="rgba(255,255,255,0.9)" />
                    </View>
                    <View style={styles.balanceItemText}>
                      <Text style={styles.balanceItemLabel}>Saving</Text>
                      <Text style={styles.balanceItemValue}>
                        {formatCurrency(balances?.savingBalance)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.balanceDividerVertical} />
                  <View style={styles.balanceItem}>
                    <View style={styles.balanceItemIcon}>
                      <MaterialCommunityIcons name="lock-open-outline" size={20} color="rgba(255,255,255,0.9)" />
                    </View>
                    <View style={styles.balanceItemText}>
                      <Text style={styles.balanceItemLabel}>Fixed</Text>
                      <Text style={styles.balanceItemValue}>
                        {formatCurrency(balances?.fixedBalance)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.summaryCardPremium, { marginRight: 6 }]}>
                <View style={[styles.summaryIconWrapper, { backgroundColor: '#dcfce7' }]}>
                  <MaterialCommunityIcons name="cash-fast" size={24} color="#16a34a" />
                </View>
                <Text style={styles.summaryLabel}>Available to Withdraw</Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>
                  {formatCurrency(balances?.availableToWithdraw)}
                </Text>
                <View style={styles.summaryTrend}>
                  <MaterialCommunityIcons name="arrow-up-right" size={12} color="#16a34a" />
                  <Text style={styles.summaryTrendText}>Ready</Text>
                </View>
              </View>
              <View style={[styles.summaryCard, styles.summaryCardPremium, { marginLeft: 6 }]}>
                <View style={[styles.summaryIconWrapper, { backgroundColor: '#dbeafe' }]}>
                  <MaterialCommunityIcons name="chart-line-variant" size={24} color="#2563eb" />
                </View>
                <Text style={styles.summaryLabel}>Total Earnings</Text>
                <Text style={[styles.summaryValue, { color: '#2563eb' }]}>
                  {formatCurrency(balances?.totalInterest)}
                </Text>
                <View style={styles.summaryTrend}>
                  <MaterialCommunityIcons name="trending-up" size={12} color="#2563eb" />
                  <Text style={styles.summaryTrendText}>Growing</Text>
                </View>
              </View>
            </View>
            
            {pendingRequests > 0 && (
              <View style={[styles.pendingCard, styles.pendingCardPremium]}>
                <View style={styles.pendingIconWrapper}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={colors.warning} />
                </View>
                <View style={styles.pendingText}>
                  <Text style={styles.pendingLabel}>Pending Requests</Text>
                  <Text style={styles.pendingCount}>{pendingRequests}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </View>
            )}
          </View>

          {/* Badges */}
          <View style={styles.badgesContainer}>
            <View style={[styles.badge, { backgroundColor: colors.savingLight }]}>
              <MaterialCommunityIcons name="piggy-bank" size={18} color={colors.saving} />
              <Text style={[styles.badgeText, { color: colors.saving }]}>Saving - 12% p.a.</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.fixedLight }]}>
              <MaterialCommunityIcons name="lock" size={18} color={colors.fixed} />
              <Text style={[styles.badgeText, { color: colors.fixed }]}>Fixed - 24% p.a.</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('InvestmentAmount')}
              >
                <LinearGradient
                  colors={['#064e3b', '#065f46']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.quickActionGradient}
                >
                  <MaterialCommunityIcons name="chart-line-variant" size={28} color={colors.white} />
                </LinearGradient>
                <Text style={styles.quickActionTitle}>Invest Now</Text>
                <Text style={styles.quickActionSub}>Start earning</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Withdraw')}
              >
                <LinearGradient
                  colors={['#047857', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.quickActionGradient}
                >
                  <MaterialCommunityIcons name="cash-fast" size={28} color={colors.white} />
                </LinearGradient>
                <Text style={styles.quickActionTitle}>Withdraw</Text>
                <Text style={styles.quickActionSub}>Access funds</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Transactions')}
              >
                <LinearGradient
                  colors={['#1e40af', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.quickActionGradient}
                >
                  <MaterialCommunityIcons name="history" size={28} color={colors.white} />
                </LinearGradient>
                <Text style={styles.quickActionTitle}>History</Text>
                <Text style={styles.quickActionSub}>Transactions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom spacer for tab bar */}
          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    ...typography.h2,
    color: colors.primary,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: colors.background,
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  greetingLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  username: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  avatarButton: {
    padding: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...colors.shadow.button,
  },
  avatarWithShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  // Balance Hero Card
  balanceHeroContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
  },
  balanceHero: {
    borderRadius: 24,
    overflow: 'hidden',
    ...colors.shadow.elevated,
  },
  balanceHeroInner: {
    padding: 24,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  balanceBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1.5,
    marginBottom: 24,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  balanceItemText: {
    flex: 1,
  },
  balanceItemLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  balanceItemValue: {
    fontSize: 18,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  balanceDividerVertical: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 16,
  },
  // Summary Cards
  summaryGrid: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    ...colors.shadow.card,
  },
  summaryCardPremium: {
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  summaryIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  summaryTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryTrendText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  pendingCardPremium: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  pendingIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pendingText: {
    flex: 1,
  },
  pendingLabel: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '600',
    marginBottom: 2,
  },
  pendingCount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.warning,
  },
  // Badges
  badgesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
  },
  badgeText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  // Quick Actions
  quickActionsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...colors.shadow.button,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  quickActionSub: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});

export default HomeScreen;