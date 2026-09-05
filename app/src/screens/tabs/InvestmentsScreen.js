import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { investmentService } from '../../services/investmentService';
import { chitFundService } from '../../services/chitFundService';
import { userService } from '../../services/userService';
import api from '../../services/apiService';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';
import DepositDetailModal from '../../components/DepositDetailModal';

// All investment types shown on this screen
const FILTERS = ['All', 'Active', 'Pending'];

const InvestmentsScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);
  // Combined list of all investment types
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedDeposit, setSelectedDeposit] = useState(null);

  const [portfolioSummary, setPortfolioSummary] = useState(null);

  const fetchAllInvestments = async () => {
    try {
      // Fetch ALL investment types and portfolio summary in parallel
      const [savingsRes, myChitsRes, pocketMoneyRes, profileRes] = await Promise.allSettled([
        investmentService.getInvestments().catch(() => []),
        chitFundService.getMyChits().catch(() => []),
        api.get('/pocket-money/my').catch(() => ({ data: [] })),
        userService.getUserProfile().catch(() => null),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setPortfolioSummary(profileRes.value);
      }

      const savingsItems = (savingsRes.status === 'fulfilled' ? (savingsRes.value || []) : [])
        .map(inv => ({
          ...inv,
          _itemType: 'savings',
          displayName: getPlanDisplayName(inv.type),
        }));

      const chitItems = (myChitsRes.status === 'fulfilled' ? (myChitsRes.value || []) : [])
        .filter(c => c.status === 'active' || c.status === 'approved' || c.status === 'pending')
        .map(c => ({
          _id: c._id,
          chitId: c.chitId?._id || c.chitId || c._id,
          _itemType: 'chit',
          displayName: c.chitName || 'Chit Fund Plan',
          amount: c.totalPaid || (Number(c.paidWeeks || 0) * Number(c.weeklyAmount || 0)),
          weeklyAmount: c.weeklyAmount || 0,
          currentWeek: c.currentWeek || 1,
          totalWeeks: c.totalWeeks || 10,
          paidWeeks: c.paidWeeks || 1,
          status: c.status === 'active' ? 'approved' : c.status,
          joinedAt: c.joinedAt,
          hasWon: c.hasWon || false,
          winningAmount: c.winningAmount || 0,
        }));

      const pocketItems = ((pocketMoneyRes.status === 'fulfilled' ? pocketMoneyRes.value?.data : null) || [])
        .map(pm => ({
          _id: pm._id,
          _itemType: 'pocket_money',
          displayName: 'Pocket Money Plan',
          amount: pm.investedAmount || 0,
          investedAmount: pm.investedAmount || 0,
          remainingAmount: pm.remainingAmount || 0,
          totalPaidOut: pm.totalPaidOut || 0,
          payoutAmount: pm.payoutAmount || 0,
          payoutCount: pm.payoutCount || 0,
          frequency: pm.frequency,
          nextPayoutDate: pm.nextPayoutDate,
          status: pm.status === 'active' ? 'approved' : pm.status,
          startDate: pm.startDate,
        }));

      setAllItems([...savingsItems, ...chitItems, ...pocketItems]);
    } catch (error) {
      console.error('Error fetching all investments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAllInvestments(); }, []));

  React.useEffect(() => {
    const interval = setInterval(fetchAllInvestments, 15000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchAllInvestments(); };

  const formatCurrency = (amount) =>
    `₹${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusLabel = (item) => {
    if (item._itemType === 'chit') {
      return item.hasWon ? 'AUCTION WON' : 'ACTIVE';
    }
    if (item._itemType === 'pocket_money') {
      if (item.status === 'completed') return 'COMPLETED';
      return 'ACTIVE';
    }
    // Savings/Fixed
    if (item.status === 'pending') return 'PENDING';
    if (item.status === 'rejected') return 'FAILED';
    if (item.status === 'withdrawn') return 'WITHDRAWN';
    if (item.status === 'approved') {
      const isDuration = ['15_days', '1_month', '3_months', '6_months', '1_year'].includes(item.type);
      if (isDuration) {
        return item.maturityDate && new Date() >= new Date(item.maturityDate) ? 'MATURED' : 'LOCKED';
      }
      return 'ACTIVE';
    }
    return 'PENDING';
  };

  const filteredItems = allItems.filter((item) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return (item.status === 'approved' || item.status === 'active') && item.status !== 'withdrawn';
    if (activeFilter === 'Pending') return item.status === 'pending';
    return true;
  });

  // Summary totals — strictly excludes withdrawn investments
  const computedActiveInvested = allItems.reduce((s, i) => {
    if (i._itemType === 'savings') {
      const isWithdrawn = i.status === 'withdrawn' || i.withdrawalStatus === 'withdrawn';
      return s + (i.status === 'approved' && !isWithdrawn ? (i.amount || 0) : 0);
    }
    if (i._itemType === 'chit') {
      const isWithdrawn = i.hasWon && i.withdrawalStatus === 'completed';
      return s + ((i.status === 'approved' || i.status === 'active') && !isWithdrawn ? (i.amount || 0) : 0);
    }
    if (i._itemType === 'pocket_money') {
      return s + (i.status === 'active' ? (i.investedAmount || 0) : 0);
    }
    return s;
  }, 0);

  const totalInvested = portfolioSummary?.totalInvested != null
    ? portfolioSummary.totalInvested
    : computedActiveInvested;

  const totalEarned = portfolioSummary?.totalInterestEarned != null
    ? portfolioSummary.totalInterestEarned
    : allItems.reduce((s, i) => s + (i.interestEarned || 0), 0);

  const activePlans = allItems.filter((i) => (i.status === 'approved' || i.status === 'active') && i.status !== 'withdrawn').length;

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar title="My Investments" navigation={navigation} showBack={navigation?.canGoBack?.() ?? false} />
        <SkeletonLoader variant="list" count={4} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="My Investments" navigation={navigation} showBack={navigation?.canGoBack?.() ?? false} />

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
        {/* ── Main Summary Banner (Untouched Original) ── */}
        <View style={styles.bannerOuter}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerCard}
          >
            <View style={styles.bannerBlob} />
            <Text style={styles.bannerLabel}>Total Invested (All Types)</Text>
            <Text style={styles.bannerAmount}>{formatCurrency(totalInvested)}</Text>
            <View style={styles.bannerRow}>
              <View style={styles.bannerStat}>
                <MaterialCommunityIcons name="trending-up" size={14} color={colors.gold} />
                <Text style={styles.bannerStatText}>+{formatCurrency(totalEarned)}</Text>
              </View>
              <Text style={styles.bannerStatMuted}>{activePlans} active plan{activePlans !== 1 ? 's' : ''}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Filter Chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} onPress={() => setActiveFilter(f)} activeOpacity={0.8}>
              {activeFilter === f ? (
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.filterChipActive}
                >
                  <Text style={styles.filterChipTextActive}>{f}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{f}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Investments Grouped Cards (Profile/Withdraw UI Theme) ── */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>INVESTMENT PORTFOLIO</Text>
            <Text style={styles.sectionHeaderCount}>{filteredItems.length} Plans</Text>
          </View>

          {filteredItems.length > 0 ? (
            <View style={styles.investmentsGroupCard}>
              {filteredItems.map((item, idx) => {
                const statusLabel = getStatusLabel(item);

                let iconName = 'trending-up';
                let planSubtitle = `Invested: ${formatCurrency(item.amount)} • ${item.interestRate || 12}% p.a.`;
                let badgeBg = isDarkMode ? 'rgba(255,255,255,0.06)' : '#FEF3C7';
                let badgeColor = isDarkMode ? '#F59E0B' : '#D97706';

                if (statusLabel === 'MATURED' || statusLabel === 'AUCTION WON' || statusLabel === 'COMPLETED') {
                  badgeBg = isDarkMode ? 'rgba(16,185,129,0.2)' : '#DCFCE7';
                  badgeColor = isDarkMode ? '#34D399' : '#059669';
                } else if (statusLabel === 'ACTIVE') {
                  badgeBg = isDarkMode ? 'rgba(16,185,129,0.15)' : '#DCFCE7';
                  badgeColor = isDarkMode ? '#34D399' : '#059669';
                } else if (statusLabel === 'PENDING') {
                  badgeBg = isDarkMode ? 'rgba(245,158,11,0.18)' : '#FEF3C7';
                  badgeColor = isDarkMode ? '#FBBF24' : '#D97706';
                } else if (statusLabel === 'WITHDRAWN' || statusLabel === 'FAILED') {
                  badgeBg = isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
                  badgeColor = isDarkMode ? '#9CA3AF' : '#64748B';
                }

                if (item._itemType === 'chit') {
                  iconName = 'account-group-outline';
                  planSubtitle = `Paid: ${formatCurrency(item.amount)} • Wk ${item.paidWeeks || item.currentWeek}/${item.totalWeeks}`;
                } else if (item._itemType === 'pocket_money') {
                  iconName = 'wallet-giftcard';
                  const freqLabel = item.frequency === 'daily' ? 'Daily' : item.frequency === 'every_2_days' ? 'Every 2 Days' : 'Weekly';
                  planSubtitle = `Invested: ${formatCurrency(item.investedAmount || item.amount)} • ${freqLabel}`;
                } else if (item.type === 'fixed') {
                  iconName = 'lock-outline';
                }

                const handlePress = () => {
                  if (item._itemType === 'chit') {
                    navigation.navigate('ChitDetails', { chitId: item.chitId || item._id });
                  } else if (item._itemType === 'pocket_money') {
                    navigation.navigate('PocketMoney');
                  } else {
                    setSelectedDeposit(item);
                  }
                };

                return (
                  <View key={String(item._id || idx)}>
                    {idx > 0 && <View style={styles.cardDivider} />}
                    <TouchableOpacity
                      style={styles.investmentRow}
                      activeOpacity={0.7}
                      onPress={handlePress}
                    >
                      <View style={styles.mintIconBox}>
                        <MaterialCommunityIcons name={iconName} size={20} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                      </View>

                      <View style={styles.textContent}>
                        <Text style={styles.titleText} numberOfLines={1}>
                          {item.displayName}
                        </Text>
                        <Text style={styles.subText} numberOfLines={1}>
                          {planSubtitle}
                        </Text>
                      </View>

                      <View style={[styles.badgePill, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.badgePillText, { color: badgeColor }]}>
                          {statusLabel}
                        </Text>
                      </View>

                      <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? '#6B7280' : '#8E9486'} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="chart-box-outline" size={44} color={themeColors.textTertiary} />
              <Text style={styles.emptyTitle}>No Investments Found</Text>
              <Text style={styles.emptyBody}>
                {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} investments found in your account.` : 'Start investing in a plan to grow your wealth!'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Deposit Detail Breakdown Modal Popup */}
      <DepositDetailModal
        visible={!!selectedDeposit}
        item={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
        onWithdraw={() => navigation.navigate('Withdraw')}
        onReinvest={(item) => navigation.navigate('InvestmentAmount', { initialPlan: item.type, initialAmount: String(item.amount) })}
      />
    </View>
  );
};

function getPlanDisplayName(type) {
  if (type === 'saving') return 'Saving Deposit';
  if (type === 'fixed') return 'Fixed Deposit';
  if (type === '15_days') return '15 Days Plan';
  if (type === '1_month') return '1 Month Plan';
  if (type === '3_months') return '3 Months Plan';
  if (type === '6_months') return '6 Months Plan';
  if (type === '1_year') return '1 Year Plan';
  return 'Investment';
}

const getStyles = (themeColors, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Summary Banner (Untouched)
  bannerOuter: { margin: 16 },
  bannerCard: {
    borderRadius: 24, padding: 20, overflow: 'hidden',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24, shadowRadius: 32, elevation: 16,
  },
  bannerBlob: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(212,168,67,0.18)',
  },
  bannerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' },
  bannerAmount: { fontSize: 30, fontWeight: '800', color: '#F8FAF9', letterSpacing: -1, marginTop: 6 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  bannerStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerStatText: { fontSize: 13, fontWeight: '700', color: colors.gold },
  bannerStatMuted: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // Filters
  filterScroll: { marginBottom: 10 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  filterChip: {
    backgroundColor: themeColors.surface, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 9,
    borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04, shadowRadius: 6, elevation: 2,
  },
  filterChipActive: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: themeColors.textSecondary },
  filterChipTextActive: { fontSize: 13, fontWeight: '700', color: '#F8FAF9' },

  // Section Group Container (Profile/Withdraw theme)
  sectionContainer: { paddingHorizontal: 16, marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: isDarkMode ? '#9CA3AF' : '#686D62',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textMuted,
  },
  investmentsGroupCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#EFF1E9',
    marginHorizontal: 16,
  },
  investmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  mintIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: { flex: 1, minWidth: 0 },
  titleText: { fontSize: 15, fontWeight: '700', color: themeColors.text },
  subText: { fontSize: 12, fontWeight: '500', color: themeColors.textMuted, marginTop: 2 },
  badgePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 2,
  },
  badgePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Empty
  emptyCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: themeColors.text, marginTop: 10 },
  emptyBody: { fontSize: 13, color: themeColors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});

export default InvestmentsScreen;