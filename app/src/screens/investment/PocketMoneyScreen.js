import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import { kycService } from '../../services/kycService';
import KycRequiredModal from '../../components/KycRequiredModal';

const PocketMoneyScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const [pocketPlans, setPocketPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payoutStatuses, setPayoutStatuses] = useState({}); // Map of plan._id -> 'available' | 'requested' | 'released'
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [kycModalVisible, setKycModalVisible] = useState(false);

  const handleRequestPayout = async (planId, payoutAmt) => {
    try {
      if (!planId) return;
      const res = await api.post(`/pocket-money/request-payout/${planId}`);
      if (res && res.data) {
        Alert.alert('Request Sent', `Your payout request of ₹${payoutAmt} has been sent to Admin. You will be notified once released!`);
        setPayoutStatuses((prev) => ({ ...prev, [planId]: 'requested' }));
        loadData();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to request payout. Try again tomorrow.';
      Alert.alert('Request Failed', msg);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch pocket money plans (enriched per plan with todayPayoutStatus)
      const plansRes = await api.get('/pocket-money/my');
      if (plansRes && plansRes.data && Array.isArray(plansRes.data)) {
        setPocketPlans(plansRes.data);

        const statusMap = {};
        plansRes.data.forEach((p) => {
          if (p && p._id) {
            statusMap[p._id] = p.todayPayoutStatus || 'available';
          }
        });
        setPayoutStatuses(statusMap);

        const active = plansRes.data.filter((p) => p && p.status === 'active');
        if (active.length > 0) {
          setSelectedPlanId((prev) => (prev && active.some(p => p._id === prev) ? prev : active[0]._id));
        }
      }

      // Fetch transaction list
      const txRes = await api.get('/transactions/my');
      if (txRes && txRes.data && Array.isArray(txRes.data)) {
        const pocketTxs = txRes.data.filter(
          (tx) => tx && (tx.type === 'pocket_money_payout' || tx.type === 'pocket_money_invest')
        );
        setTransactions(pocketTxs);
      }
    } catch (error) {
      console.error('Error loading Pocket Money data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const getCompletedPlans = () => {
    return pocketPlans.filter((p) => p && p.status === 'completed');
  };

  const formatCurrency = (val) => {
    return `₹${(val || 0).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const activePlans = pocketPlans.filter((p) => p && p.status === 'active');
  const activePlan = activePlans.find(p => p._id === selectedPlanId) || (activePlans.length > 0 ? activePlans[0] : null);
  const completedPlans = getCompletedPlans();

  const handleInvestMore = () => {
    navigation.navigate('PocketMoneyAmount');
  };

  return (
    <View style={styles.container}>
      <TopBar title="Pocket Money" navigation={navigation} showBack />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColors.primary]} />
        }
      >
        {/* Active Plans Card List */}
        {activePlans.length > 0 ? (
          activePlans.map((plan, planIdx) => {
            const currentStatus = payoutStatuses[plan._id] || plan.todayPayoutStatus || 'available';
            const paidOut = plan.totalPaidOut || 0;
            const invested = plan.investedAmount || 1;
            const progressPercent = Math.min(100, Math.max(0, (paidOut / invested) * 100));

            return (
              <View key={plan._id || String(planIdx)} style={styles.activeCardOuter}>
                <LinearGradient
                  colors={isDarkMode ? ['#121F17', '#1A3324'] : ['#0E3D23', '#1C6B3F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeCardGradient}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>ACTIVE PLAN {activePlans.length > 1 ? `#${planIdx + 1}` : ''}</Text>
                    </View>
                    <Text style={styles.frequencyText}>{plan.frequency?.toUpperCase()}</Text>
                  </View>

                  <Text style={styles.activeAmountLabel}>Invested Amount</Text>
                  <Text style={styles.activeAmount}>{formatCurrency(plan.investedAmount)}</Text>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${progressPercent}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressLabelText}>Released: {formatCurrency(plan.totalPaidOut)}</Text>
                      <Text style={styles.progressLabelText}>Remaining: {formatCurrency(plan.remainingAmount)}</Text>
                    </View>
                  </View>

                  {/* Payout Request Section (Per-Investment Status) */}
                  <View style={styles.requestSection}>
                    {currentStatus === 'available' ? (
                      <TouchableOpacity
                        style={styles.requestBtn}
                        activeOpacity={0.8}
                        onPress={() => handleRequestPayout(plan._id, plan.payoutAmount)}
                      >
                        <MaterialCommunityIcons name="hand-coin" size={20} color={colors.primary} />
                        <Text style={styles.requestBtnText}>Request Today's Payout (₹{plan.payoutAmount})</Text>
                      </TouchableOpacity>
                    ) : currentStatus === 'requested' ? (
                      <View style={styles.statusPillPending}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color="#B45309" style={{ marginRight: 6 }} />
                        <Text style={styles.statusTextPending}>Payout Requested (Pending Approval)</Text>
                      </View>
                    ) : currentStatus === 'upcoming' ? (
                      <View style={[styles.statusPillPending, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                        <Text style={[styles.statusTextPending, { color: '#374151' }]}>Next Payout Scheduled ({formatDate(plan.nextPayoutDate)})</Text>
                      </View>
                    ) : (
                      <View style={styles.statusPillSuccess}>
                        <MaterialCommunityIcons name="check-circle-outline" size={16} color="#065F46" style={{ marginRight: 6 }} />
                        <Text style={styles.statusTextSuccess}>Today's Payout Released (Paid Out)</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.footerCol}>
                      <Text style={styles.footerLabel}>Next Release</Text>
                      <Text style={styles.footerVal}>{formatCurrency(plan.payoutAmount)}</Text>
                    </View>
                    <View style={styles.footerCol}>
                      <Text style={styles.footerLabel}>Release Date</Text>
                      <Text style={styles.footerVal}>{formatDate(plan.nextPayoutDate)}</Text>
                    </View>
                    <View style={styles.footerCol}>
                      <Text style={styles.footerLabel}>Progress</Text>
                      <Text style={styles.footerVal}>{plan.payoutCount || 0}/10</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            );
          })
        ) : (
          /* Empty State */
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="wallet-giftcard" size={64} color={themeColors.primary} />
            <Text style={styles.emptyTitle}>No Active Pocket Money Plan</Text>
            <Text style={styles.emptyDesc}>
              Setup a Pocket Money plan to automatically release funds into your wallet balance daily, every 2 days, or weekly.
            </Text>
            <TouchableOpacity
              style={styles.startBtn}
              activeOpacity={0.8}
              onPress={handleInvestMore}
            >
              <Text style={styles.startBtnText}>Start Pocket Money Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* More Investment Button (Shown whenever user has plans) */}
        {pocketPlans.length > 0 && (
          <TouchableOpacity
            style={styles.investMoreBtn}
            activeOpacity={0.85}
            onPress={handleInvestMore}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.investMoreGradient}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.investMoreText}>More Investment</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Active Plan Detail Specs */}
        {activePlan && (
          <View style={styles.detailsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.detailsTitle}>Investment Details</Text>
              {activePlans.length > 1 && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: themeColors.primary }}>
                  Viewing Plan #{activePlans.findIndex(p => p._id === activePlan._id) + 1}
                </Text>
              )}
            </View>

            {activePlans.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {activePlans.map((p, idx) => {
                  const isSelected = p._id === activePlan._id;
                  return (
                    <TouchableOpacity
                      key={p._id}
                      onPress={() => setSelectedPlanId(p._id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor: isSelected ? themeColors.primary : themeColors.surface,
                        borderWidth: 1,
                        borderColor: isSelected ? themeColors.primary : themeColors.border,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#FFFFFF' : themeColors.text }}>
                        Plan #{idx + 1} ({formatCurrency(p.investedAmount)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            
            {[
              { label: 'Original Investment', value: formatCurrency(activePlan.investedAmount) },
              { label: 'Payout Frequency', value: activePlan.frequency === 'daily' ? 'Daily' : activePlan.frequency === 'every_2_days' ? 'Every 2 Days' : 'Weekly' },
              { label: 'Regular Payout Amount', value: formatCurrency(activePlan.payoutAmount) },
              { 
                label: '6% Bonus Amount', 
                value: formatCurrency(activePlan.bonusAmount),
                badge: activePlan.bonusReleased ? 'Released' : 'Locked',
                badgeColor: activePlan.bonusReleased ? '#065F46' : '#B45309',
                badgeBg: activePlan.bonusReleased ? '#D1FAE5' : '#FEF3C7',
              },
              { label: 'Total Final Value', value: formatCurrency(activePlan.totalFinalValue || ((activePlan.investedAmount || 0) * 1.06)) },
              { label: 'Payouts Completed', value: `${activePlan.payoutCount || 0} Completed` },
              { label: 'Remaining Payouts', value: `${Math.max(0, 10 - (activePlan.payoutCount || 0))} Remaining` },
              { label: 'Next Payout Date', value: formatDate(activePlan.nextPayoutDate) },
              { label: 'Final Payout Date', value: formatDate(activePlan.finalPayoutDate || activePlan.completedAt) },
              { 
                label: 'Bonus Status', 
                value: activePlan.bonusReleased ? 'Released (Paid with Final Payout)' : 'Locked until Payout #10',
                valueColor: activePlan.bonusReleased ? themeColors.success : '#B45309',
              },
            ].map((detail, idx) => (
              <View key={idx} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {detail.badge && (
                    <View style={{ backgroundColor: detail.badgeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: detail.badgeColor }}>{detail.badge}</Text>
                    </View>
                  )}
                  <Text style={[styles.detailValue, detail.valueColor && { color: detail.valueColor }]}>{detail.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* History / Transactions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Release History</Text>
          {transactions.length > 0 ? (
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <View key={tx._id} style={styles.txItem}>
                  <View
                    style={[
                      styles.txIconContainer,
                      {
                        backgroundColor:
                          tx.type === 'pocket_money_payout'
                            ? isDarkMode
                              ? 'rgba(74,222,128,0.1)'
                              : 'rgba(21,128,61,0.1)'
                            : isDarkMode
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(220,38,38,0.1)',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={tx.type === 'pocket_money_payout' ? 'cash-receive' : 'cash-send'}
                      size={22}
                      color={tx.type === 'pocket_money_payout' ? themeColors.success : themeColors.error}
                    />
                  </View>
                  <View style={styles.txContent}>
                    <Text style={styles.txTitle}>
                      {tx.type === 'pocket_money_payout' ? 'Pocket Money Released' : 'Pocket Money Invested'}
                    </Text>
                    <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'pocket_money_payout' ? themeColors.success : themeColors.text },
                    ]}
                  >
                    {tx.type === 'pocket_money_payout' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noHistory}>
              <MaterialCommunityIcons name="history" size={32} color={themeColors.textTertiary} />
              <Text style={styles.noHistoryText}>No pocket money payouts processed yet.</Text>
            </View>
          )}
        </View>

        {/* Completed Plans Section */}
        {completedPlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed Plans</Text>
            <View style={styles.completedList}>
              {completedPlans.map((plan) => (
                <View key={plan._id} style={styles.completedItem}>
                  <View style={styles.completedHeader}>
                    <Text style={styles.completedName}>₹{(plan.investedAmount || 0).toLocaleString('en-IN')} Plan</Text>
                    <Text style={styles.completedStatus}>COMPLETED</Text>
                  </View>
                  <Text style={styles.completedMeta}>
                    Frequency: {plan.frequency} • Completed: {formatDate(plan.completedAt || plan.updatedAt)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* KYC Required Modal */}
      <KycRequiredModal
        visible={kycModalVisible}
        onClose={() => setKycModalVisible(false)}
        onVerify={() => {
          setKycModalVisible(false);
          navigation.navigate('KYC');
        }}
      />
    </View>
  );
};

const getStyles = (colors, isDarkMode) =>
  StyleSheet.create({
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
    activeCardOuter: {
      margin: 20,
      borderRadius: 24,
      overflow: 'hidden',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDarkMode ? 0.3 : 0.15,
      shadowRadius: 12,
    },
    activeCardGradient: {
      padding: 24,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    cardBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    cardBadgeText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    frequencyText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    activeAmountLabel: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 4,
    },
    activeAmount: {
      color: colors.white,
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 20,
    },
    progressContainer: {
      marginBottom: 24,
    },
    progressBarBg: {
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 4,
      marginBottom: 8,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.white,
      borderRadius: 4,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressLabelText: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 12,
      fontWeight: '600',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.15)',
      paddingTop: 16,
    },
    requestSection: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 16,
      padding: 12,
      marginBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requestBtn: {
      backgroundColor: colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      width: '100%',
    },
    requestBtnText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
      marginLeft: 8,
    },
    statusPillPending: {
      backgroundColor: '#FEF3C7',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      width: '100%',
    },
    statusTextPending: {
      color: '#B45309',
      fontWeight: '700',
      fontSize: 13,
    },
    statusPillSuccess: {
      backgroundColor: '#D1FAE5',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      width: '100%',
    },
    statusTextSuccess: {
      color: '#065F46',
      fontWeight: '700',
      fontSize: 13,
    },
    footerCol: {
      alignItems: 'center',
    },
    footerLabel: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 4,
    },
    footerVal: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyCard: {
      margin: 20,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      ...colors.shadow.card,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
      paddingHorizontal: 12,
    },
    startBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 16,
      ...colors.shadow.button,
    },
    startBtnText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    section: {
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
      marginTop: 10,
    },
    txList: {
      gap: 12,
    },
    txItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...colors.shadow.card,
    },
    txIconContainer: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    txContent: {
      flex: 1,
    },
    txTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    txDate: {
      fontSize: 12,
      color: colors.textTertiary,
      fontWeight: '500',
    },
    txAmount: {
      fontSize: 15,
      fontWeight: '700',
    },
    noHistory: {
      alignItems: 'center',
      paddingVertical: 32,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    noHistoryText: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 8,
      fontWeight: '500',
    },
    completedList: {
      gap: 10,
    },
    completedItem: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    completedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    completedName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    completedStatus: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.success,
      backgroundColor: colors.successLight,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    completedMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    detailsCard: {
      backgroundColor: colors.surface,
      marginHorizontal: 20,
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...colors.shadow.card,
    },
    detailsTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    detailLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    investMoreBtn: {
      marginHorizontal: 20,
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    investMoreGradient: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    investMoreText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
  });

export default PocketMoneyScreen;
