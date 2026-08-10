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
import { authService } from '../../services/authService';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';
import StatusChip from '../../components/StatusChip';
import { SkeletonLoader } from '../../components/SkeletonLoader';

const FILTERS = ['All', 'Fixed', 'Saving', 'Pending'];

const InvestmentsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const fetchInvestments = async () => {
    try {
      const user = await authService.getUserData();
      const allInvestments = await investmentService.getInvestments();
      const userInvestments = allInvestments.filter(inv =>
        inv.userEmail === user?.email || inv.mobileNumber === user?.mobileNumber
      );
      setInvestments(userInvestments);
    } catch (error) {
      console.error('Error fetching investments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchInvestments(); }, []));

  // Polling for auto-updating UI
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchInvestments();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchInvestments(); };

  const formatCurrency = (amount) =>
    `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusLabel = (status) => {
    const map = { approved: 'Active', pending: 'Pending', rejected: 'Failed', withdrawn: 'Withdrawn' };
    return map[status] || 'Pending';
  };

  const filteredInvestments = investments.filter((inv) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Fixed') return inv.type === 'fixed';
    if (activeFilter === 'Saving') return inv.type === 'saving';
    if (activeFilter === 'Pending') return inv.status === 'pending';
    return true;
  });

  const totalInvested = investments.reduce((s, i) => s + (i.amount || 0), 0);
  const totalEarned = investments.reduce((s, i) => s + (i.interestEarned || 0), 0);
  const activePlans = investments.filter((i) => i.status === 'approved').length;

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
            <Text style={styles.bannerLabel}>Total Invested</Text>
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
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.8}
            >
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
          {filteredInvestments.length > 0 ? (
            filteredInvestments.map((inv) => {
              const isSaving = inv.type === 'saving';
              const statusLabel = getStatusLabel(inv.status);
              return (
                <View key={inv._id} style={styles.investCard}>
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
                          {isSaving ? 'Saving Deposit' : 'Fixed Deposit'}
                        </Text>
                        <StatusChip status={statusLabel} />
                      </View>
                      <Text style={styles.investRate}>
                        {inv.interestRate}% p.a.{inv.ref ? ` • Ref: ${inv.ref}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.investAmount}>{formatCurrency(inv.amount)}</Text>
                  </View>

                  {/* Date row */}
                  <View style={styles.investDateRow}>
                    <View style={styles.investDateItem}>
                      <MaterialCommunityIcons name="calendar-start" size={13} color={colors.textMuted} />
                      <Text style={styles.investDateText}>{formatDate(inv.startDate)}</Text>
                    </View>
                    {inv.maturityDate && (
                      <>
                        <Text style={styles.investDateArrow}>→</Text>
                        <View style={styles.investDateItem}>
                          <MaterialCommunityIcons name="calendar-end" size={13} color={colors.textMuted} />
                          <Text style={styles.investDateText}>{formatDate(inv.maturityDate)}</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Earnings */}
                  {(inv.interestEarned || 0) > 0 && (
                    <View style={styles.investEarningsRow}>
                      <Text style={styles.investEarningsLabel}>Interest earned</Text>
                      <Text style={styles.investEarningsValue}>+{formatCurrency(inv.interestEarned)}</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <MaterialCommunityIcons name="chart-box-outline" size={48} color={colors.border} />
              </View>
              <Text style={styles.emptyTitle}>No Investments Found</Text>
              <Text style={styles.emptyBody}>
                {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} deposits` : 'Start investing to see your deposits here'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },

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