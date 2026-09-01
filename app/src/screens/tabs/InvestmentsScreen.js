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
import { authService } from '../../services/authService';
import api from '../../services/apiService';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';
import StatusChip from '../../components/StatusChip';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';
import DepositDetailModal from '../../components/DepositDetailModal';

// All investment types shown on this screen
const FILTERS = ['All', 'Active', 'Pending'];

const InvestmentsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  // Combined list of all investment types
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedDeposit, setSelectedDeposit] = useState(null);

  const fetchAllInvestments = async () => {
    try {
      // Fetch ALL investment types in parallel — all come from backend/DB
      const [savingsRes, myChitsRes, pocketMoneyRes] = await Promise.allSettled([
        investmentService.getInvestments(),
        chitFundService.getMyChits(),
        api.get('/pocket-money/my'),
      ]);

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
          displayName: 'Pocket Money',
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
      return item.hasWon ? 'Won' : 'Active';
    }
    if (item._itemType === 'pocket_money') {
      if (item.status === 'completed') return 'Completed';
      return 'Active';
    }
    // Savings/Fixed
    if (item.status === 'pending') return 'Pending';
    if (item.status === 'rejected') return 'Failed';
    if (item.status === 'withdrawn') return 'Withdrawn';
    if (item.status === 'approved') {
      const isDuration = ['15_days', '1_month', '3_months', '6_months', '1_year'].includes(item.type);
      if (isDuration) {
        return item.maturityDate && new Date() >= new Date(item.maturityDate) ? 'Matured' : 'Locked';
      }
      return 'Active';
    }
    return 'Pending';
  };

  const filteredItems = allItems.filter((item) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return item.status === 'approved' || item.status === 'active';
    if (activeFilter === 'Pending') return item.status === 'pending';
    return true;
  });

  // Summary totals
  const totalInvested = allItems.reduce((s, i) => {
    if (i._itemType === 'savings') return s + (i.status !== 'rejected' ? (i.amount || 0) : 0);
    if (i._itemType === 'chit') return s + (i.amount || 0);
    if (i._itemType === 'pocket_money') return s + (i.investedAmount || 0);
    return s;
  }, 0);

  const totalEarned = allItems.reduce((s, i) => s + (i.interestEarned || 0), 0);
  const activePlans = allItems.filter((i) => i.status === 'approved' || i.status === 'active').length;

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
        {/* Summary Banner */}
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

        {/* Filter Chips */}
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

        {/* Investment Cards */}
        <View style={styles.cardsList}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const statusLabel = getStatusLabel(item);

              // ── CHIT FUND CARD ────────────────────────────────────────────
              if (item._itemType === 'chit') {
                return (
                  <TouchableOpacity
                    key={String(item._id)}
                    style={styles.investCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('ChitDetails', { chitId: item.chitId || item._id })}
                  >
                    <View style={styles.investCardTop}>
                      <View style={[styles.investIcon, { backgroundColor: '#E8F5E9' }]}>
                        <MaterialCommunityIcons name="handshake-outline" size={22} color="#1A5C39" />
                      </View>
                      <View style={styles.investCardInfo}>
                        <View style={styles.investNameRow}>
                          <Text style={styles.investName} numberOfLines={1}>{item.displayName}</Text>
                          <StatusChip status={statusLabel} />
                        </View>
                        <Text style={styles.investRate}>
                          Week {item.paidWeeks}/{item.totalWeeks} • ₹{item.weeklyAmount}/wk
                        </Text>
                      </View>
                      <Text style={styles.investAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                    <View style={styles.investDateRow}>
                      <View style={styles.investDateItem}>
                        <MaterialCommunityIcons name="calendar-start" size={13} color={colors.textMuted} />
                        <Text style={styles.investDateText}>Joined: {formatDate(item.joinedAt)}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>View Details →</Text>
                      </View>
                    </View>
                    {item.hasWon && (
                      <View style={[styles.investEarningsRow, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.investEarningsLabel, { color: '#1A5C39' }]}>🏆 Auction Won</Text>
                        <Text style={[styles.investEarningsValue, { color: '#1A5C39' }]}>+{formatCurrency(item.winningAmount)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }

              // ── POCKET MONEY CARD ────────────────────────────────────────
              if (item._itemType === 'pocket_money') {
                const freqLabel = item.frequency === 'daily' ? 'Daily'
                  : item.frequency === 'every_2_days' ? 'Every 2 Days' : 'Weekly';
                const progressPct = Math.min(100, ((item.payoutCount || 0) / 10) * 100);
                return (
                  <TouchableOpacity
                    key={String(item._id)}
                    style={styles.investCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('PocketMoney')}
                  >
                    <View style={styles.investCardTop}>
                      <View style={[styles.investIcon, { backgroundColor: '#FFF8E1' }]}>
                        <MaterialCommunityIcons name="piggy-bank-outline" size={22} color="#B45309" />
                      </View>
                      <View style={styles.investCardInfo}>
                        <View style={styles.investNameRow}>
                          <Text style={styles.investName} numberOfLines={1}>{item.displayName}</Text>
                          <StatusChip status={statusLabel} />
                        </View>
                        <Text style={styles.investRate}>
                          {freqLabel} • {item.payoutCount || 0}/10 payouts released
                        </Text>
                      </View>
                      <Text style={styles.investAmount}>{formatCurrency(item.investedAmount)}</Text>
                    </View>

                    {/* Progress bar */}
                    <View style={{ marginTop: 10 }}>
                      <View style={{ height: 5, backgroundColor: themeColors.surface2, borderRadius: 3 }}>
                        <View style={{ height: 5, width: `${progressPct}%`, backgroundColor: '#1A5C39', borderRadius: 3 }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                          Released: {formatCurrency(item.totalPaidOut)}
                        </Text>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                          Remaining: {formatCurrency(item.remainingAmount)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.investDateRow}>
                      <View style={styles.investDateItem}>
                        <MaterialCommunityIcons name="calendar-start" size={13} color={colors.textMuted} />
                        <Text style={styles.investDateText}>Started: {formatDate(item.startDate)}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>Manage Payouts →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              // ── SAVINGS / FIXED / DURATION PLAN CARD ─────────────────────
              const isSaving = item.type === 'saving';
              return (
                <TouchableOpacity
                  key={item._id}
                  style={styles.investCard}
                  activeOpacity={0.88}
                  onPress={() => setSelectedDeposit(item)}
                >
                  <View style={styles.investCardTop}>
                    <View style={[styles.investIcon, isSaving ? styles.investIconSaving : styles.investIconFixed]}>
                      <MaterialCommunityIcons
                        name={isSaving ? 'piggy-bank' : 'lock-outline'}
                        size={22}
                        color={isSaving ? colors.success : colors.primary}
                      />
                    </View>
                    <View style={styles.investCardInfo}>
                      <View style={styles.investNameRow}>
                        <Text style={styles.investName} numberOfLines={1}>
                          {item.displayName}
                        </Text>
                        <StatusChip status={statusLabel} />
                      </View>
                      <Text style={styles.investRate}>
                        {item.interestRate}%{['saving', 'fixed'].includes(item.type) ? ' p.a.' : ''}{item.ref ? ` • Ref: ${item.ref}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.investAmount}>{formatCurrency(item.amount)}</Text>
                  </View>

                  {/* Date row */}
                  <View style={styles.investDateRow}>
                    <View style={styles.investDateItem}>
                      <MaterialCommunityIcons name="calendar-start" size={13} color={colors.textMuted} />
                      <Text style={styles.investDateText}>{formatDate(item.startDate)}</Text>
                    </View>
                    {item.maturityDate && (
                      <>
                        <Text style={styles.investDateArrow}>→</Text>
                        <View style={styles.investDateItem}>
                          <MaterialCommunityIcons name="calendar-end" size={13} color={colors.textMuted} />
                          <Text style={styles.investDateText}>{formatDate(item.maturityDate)}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Earnings */}
                  {(item.interestEarned || 0) > 0 && (
                    <View style={styles.investEarningsRow}>
                      <Text style={styles.investEarningsLabel}>Interest earned</Text>
                      <Text style={styles.investEarningsValue}>+{formatCurrency(item.interestEarned)}</Text>
                    </View>
                  )}

                  {/* Reinvest quick button if matured */}
                  {item.maturityDate && new Date() >= new Date(item.maturityDate) && item.status === 'approved' && (
                    <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' }}>
                      <Text style={{ fontSize: 11, color: '#065F46', fontWeight: '700' }}>✅ Plan Matured</Text>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          navigation.navigate('InvestmentAmount', { initialPlan: item.type, initialAmount: String(item.amount) });
                        }}
                        style={{ backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 }}
                      >
                        <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: '800' }}>Reinvest ↺</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <MaterialCommunityIcons name="chart-box-outline" size={48} color={colors.border} />
              </View>
              <Text style={styles.emptyTitle}>No Investments Found</Text>
              <Text style={styles.emptyBody}>
                {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} investments` : 'Start investing to see your plans here'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Deposit Detail Breakdown Modal */}
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

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Banner
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
  filterScroll: { marginBottom: 4 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  filterChip: {
    backgroundColor: colors.surface, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  filterChipActive: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  filterChipTextActive: { fontSize: 13, fontWeight: '700', color: '#F8FAF9' },

  // Cards
  cardsList: { paddingHorizontal: 16 },
  investCard: {
    backgroundColor: colors.surface, borderRadius: 24, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  investCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  investIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  investIconSaving: { backgroundColor: colors.successLight },
  investIconFixed: { backgroundColor: colors.primaryLight },
  investCardInfo: { flex: 1, minWidth: 0 },
  investNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  investName: { fontSize: 14, fontWeight: '700', color: colors.text },
  investRate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  investAmount: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  investDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  investDateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  investDateText: { fontSize: 12, color: colors.textMuted },
  investDateArrow: { fontSize: 12, color: colors.textMuted, flex: 1, textAlign: 'center' },
  investEarningsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 8,
    backgroundColor: colors.successLight, borderRadius: 10, padding: 8,
  },
  investEarningsLabel: { fontSize: 12, color: colors.success, fontWeight: '600' },
  investEarningsValue: { fontSize: 14, fontWeight: '800', color: colors.success },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});

export default InvestmentsScreen;