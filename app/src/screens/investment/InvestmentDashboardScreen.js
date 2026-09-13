import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { investmentService } from '../../services/investmentService';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import DepositDetailModal from '../../components/DepositDetailModal';

const getPlanDisplayName = (type) => {
  const map = {
    '15_days': '15 Days Plan',
    '1_month': '1 Month Plan',
    '3_months': '3 Months Plan',
    '6_months': '6 Months Plan',
    '1_year': '1 Year Plan',
    'saving': 'Saving Deposit',
    'fixed': 'Fixed Deposit',
  };
  return map[type] || (type ? type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Investment Plan');
};

const InvestmentDashboardScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const isDark = Boolean(isDarkMode);
  const insets = useScreenInsets(16);
  const styles = useMemo(() => getStyles(themeColors, isDark), [themeColors, isDark]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    totalInvested: 0,
    activeCount: 0,
    totalEarned: 0,
    dailyInterest: 0,
  });
  const [investments, setInvestments] = useState([]);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  const loadData = async () => {
    try {
      const [summaryData, investmentsData] = await Promise.allSettled([
        investmentService.getInvestmentSummary(),
        investmentService.getInvestments(),
      ]);

      let loadedInvestments = [];
      if (investmentsData.status === 'fulfilled' && Array.isArray(investmentsData.value)) {
        loadedInvestments = investmentsData.value;
        setInvestments(loadedInvestments);
      }

      if (summaryData.status === 'fulfilled' && summaryData.value) {
        setSummary(summaryData.value);
      } else {
        // Fallback calculation directly from loaded investments
        const activeOnly = loadedInvestments.filter(
          (i) => (i.status === 'approved' || i.status === 'active') &&
            i.status !== 'withdrawn' &&
            i.withdrawalStatus !== 'withdrawn' &&
            i.status !== 'reinvested' &&
            i.withdrawalStatus !== 'reinvested'
        );
        const totalInvested = activeOnly.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const dailyInterest = activeOnly.reduce((acc, curr) => acc + (Number(curr.dailyInterest) || 0), 0);
        const totalEarned = activeOnly.reduce((acc, curr) => acc + (Number(curr.interestEarned) || 0), 0);

        setSummary({
          totalInvested,
          activeCount: activeOnly.length,
          totalEarned,
          dailyInterest,
        });
      }
    } catch (error) {
      console.warn('[InvestmentDashboard] Error loading data:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusLabel = (item) => {
    if (item.status === 'reinvested' || item.withdrawalStatus === 'reinvested') return 'REINVESTED';
    if (item.status === 'pending') return 'PENDING';
    if (item.status === 'rejected') return 'FAILED';
    if (item.status === 'withdrawn' || item.withdrawalStatus === 'withdrawn') return 'WITHDRAWN';
    if (item.status === 'approved' || item.status === 'active') {
      const isDuration = ['15_days', '1_month', '3_months', '6_months', '1_year'].includes(item.type);
      if (isDuration) {
        return item.maturityDate && new Date() >= new Date(item.maturityDate) ? 'MATURED' : 'ACTIVE';
      }
      return 'ACTIVE';
    }
    return (item.status || 'ACTIVE').toUpperCase();
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'REINVESTED':
        return {
          bg: isDark ? 'rgba(59, 130, 246, 0.18)' : '#DBEAFE',
          text: isDark ? '#60A5FA' : '#2563EB',
          icon: 'refresh',
        };
      case 'MATURED':
        return {
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
          text: isDark ? '#34D399' : '#059669',
          icon: 'check-circle-outline',
        };
      case 'ACTIVE':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
          text: isDark ? '#FBBF24' : '#D97706',
          icon: 'clock-outline',
        };
      case 'WITHDRAWN':
        return {
          bg: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
          text: isDark ? '#9CA3AF' : '#64748B',
          icon: 'check-all',
        };
      default:
        return {
          bg: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F1F5F9',
          text: isDark ? '#CBD5E1' : '#475569',
          icon: 'information-outline',
        };
    }
  };

  const filteredInvestments = useMemo(() => {
    return investments.filter((item) => {
      const status = getStatusLabel(item);
      if (activeFilter === 'Active') return status === 'ACTIVE';
      if (activeFilter === 'Matured') return status === 'MATURED';
      return true;
    });
  }, [investments, activeFilter]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Investment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#085428']} />}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Investment Plans</Text>
          <Text style={styles.mainSubtitle}>
            Grow your money with high-yield fixed return plans and guaranteed daily interest payouts.
          </Text>
        </View>

        {/* Hero Summary Card */}
        <LinearGradient
          colors={isDark ? ['#085428', '#0A6C35', '#043417'] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>TOTAL INVESTED</Text>
              <Text style={styles.heroAmount}>{formatCurrency(summary.totalInvested)}</Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="chart-line" size={18} color="#E8D083" />
              <Text style={styles.heroBadgeText}>{summary.activeCount || 0} Active</Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Active Plans</Text>
              <Text style={styles.heroStatValue}>{summary.activeCount || 0}</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Daily Returns</Text>
              <Text style={styles.heroStatValue}>
                {summary.dailyInterest > 0
                  ? `₹${Number(summary.dailyInterest).toFixed(2)}/day`
                  : '₹0.00'}
              </Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Earned Interest</Text>
              <Text style={[styles.heroStatValue, { color: '#FCD34D' }]}>
                ₹{Number(summary.totalEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.startBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('InvestmentAmount')}
        >
          <LinearGradient
            colors={['#085428', '#0A6C35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startBtnGradient}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.startBtnText}>Start New Investment</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Section Header & Filters */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Investments</Text>
          <Text style={styles.sectionCount}>{investments.length} Plans</Text>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {['All', 'Active', 'Matured'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
              activeOpacity={0.7}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Investments List */}
        {loading ? (
          <SkeletonLoader variant="list" count={3} />
        ) : filteredInvestments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="finance" size={48} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilter !== 'All' ? `No ${activeFilter} Investments` : 'No Investments Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter !== 'All'
                ? `You currently do not have any ${activeFilter.toLowerCase()} investment plans.`
                : 'Start a high-yield fixed return plan to earn daily interest and grow your capital.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('InvestmentAmount')}
            >
              <Text style={styles.emptyActionBtnText}>+ Start New Investment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredInvestments.map((item) => {
            const status = getStatusLabel(item);
            const badge = getStatusBadgeStyle(status);
            const planTitle = getPlanDisplayName(item.type);
            const refId = item.ref || item.refId || (item._id ? `INV-${String(item._id).slice(-6).toUpperCase()}` : '');

            return (
              <TouchableOpacity
                key={String(item._id)}
                style={styles.invCard}
                activeOpacity={0.85}
                onPress={() => setSelectedDeposit(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <MaterialCommunityIcons name="trending-up" size={20} color={isDark ? '#34D399' : '#0E3D23'} />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{planTitle}</Text>
                    <Text style={styles.cardSubText}>Ref: {refId}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <MaterialCommunityIcons name={badge.icon} size={12} color={badge.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{status}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardDetailsRow}>
                  <View style={styles.cardDetailItem}>
                    <Text style={styles.cardDetailLabel}>INVESTED</Text>
                    <Text style={styles.cardDetailValue}>{formatCurrency(item.amount)}</Text>
                  </View>
                  <View style={styles.cardDetailItem}>
                    <Text style={styles.cardDetailLabel}>INTEREST RATE</Text>
                    <Text style={styles.cardDetailValue}>{item.interestRate || 12}% p.a.</Text>
                  </View>
                  <View style={styles.cardDetailItem}>
                    <Text style={styles.cardDetailLabel}>MATURITY</Text>
                    <Text style={styles.cardDetailValue}>{formatDate(item.maturityDate)}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailsText}>View Details & Breakdown</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#085428" />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Deposit Detail Popup Modal */}
      <DepositDetailModal
        visible={!!selectedDeposit}
        item={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
        onWithdraw={() => navigation.navigate('Withdraw')}
        onReinvest={(item) => {
          const principal = Number(item.amount || item.investedAmount) || 0;
          const rate = Number(item.interestRate) || 12;
          const durationDays = Number(item.durationDays) || 365;
          const dailyInterest = (principal * rate) / 100 / 365;
          const totalInterest = dailyInterest * durationDays;
          const maturedAmount = Number(item.maturityAmount) || (principal + (item.totalInterest || totalInterest));
          const sourceRef = item.ref || item.refId || (item._id ? `INV-${String(item._id).slice(-6).toUpperCase()}` : '');

          navigation.navigate('InvestmentAmount', {
            isReinvestment: true,
            sourceInvestmentId: item._id,
            sourceRef,
            initialPlan: item.type,
            initialAmount: String(Number(maturedAmount.toFixed(2))),
            maturedAmount: Number(maturedAmount.toFixed(2)),
          });
        }}
      />
    </View>
  );
};

const getStyles = (themeColors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background || (isDark ? '#08120B' : '#F8FAFC'),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    titleSection: {
      marginBottom: 16,
    },
    mainTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
      marginBottom: 4,
    },
    mainSubtitle: {
      fontSize: 14,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      lineHeight: 20,
    },
    heroCard: {
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    heroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: 'rgba(255, 255, 255, 0.8)',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    heroAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    heroBadgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    heroDivider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      marginVertical: 14,
    },
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    heroStatItem: {
      flex: 1,
    },
    heroStatLabel: {
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: 2,
    },
    heroStatValue: {
      fontSize: 13.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    startBtn: {
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 20,
      shadowColor: '#085428',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    startBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    startBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    filterPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
    },
    filterPillActive: {
      backgroundColor: '#085428',
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    filterPillTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    invCard: {
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(52, 211, 153, 0.12)' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardHeaderText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
      marginBottom: 2,
    },
    cardSubText: {
      fontSize: 12,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    cardDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
      marginVertical: 12,
    },
    cardDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cardDetailItem: {
      flex: 1,
    },
    cardDetailLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    cardDetailValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
    },
    viewDetailsText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#085428',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
      marginTop: 8,
    },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 13,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    emptyActionBtn: {
      backgroundColor: '#085428',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    emptyActionBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
  });

export default InvestmentDashboardScreen;
