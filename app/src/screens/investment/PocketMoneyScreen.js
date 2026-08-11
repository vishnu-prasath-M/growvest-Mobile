import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import { authService } from '../../services/authService';

const API_URL = 'http://localhost:5000'; // Fallback URL, authService uses base URL

const PocketMoneyScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const [pocketPlans, setPocketPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch pocket money plans
      const plansRes = await authService.makeAuthenticatedRequest('/api/pocket-money/my', { method: 'GET' });
      if (plansRes) {
        setPocketPlans(plansRes);
      }

      // Fetch transaction list
      const txRes = await authService.makeAuthenticatedRequest('/api/transactions/my', { method: 'GET' });
      if (txRes && Array.isArray(txRes)) {
        const pocketTxs = txRes.filter(
          (tx) => tx.type === 'pocket_money_payout' || tx.type === 'pocket_money_invest'
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

  const getActivePlan = () => {
    return pocketPlans.find((p) => p.status === 'active');
  };

  const getCompletedPlans = () => {
    return pocketPlans.filter((p) => p.status === 'completed');
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

  const activePlan = getActivePlan();
  const completedPlans = getCompletedPlans();

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
        {/* Active Plan Card */}
        {activePlan ? (
          <View style={styles.activeCardOuter}>
            <LinearGradient
              colors={isDarkMode ? ['#121F17', '#1A3324'] : ['#0E3D23', '#1C6B3F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeCardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>ACTIVE PLAN</Text>
                </View>
                <Text style={styles.frequencyText}>{activePlan.frequency?.toUpperCase()}</Text>
              </View>

              <Text style={styles.activeAmountLabel}>Invested Amount</Text>
              <Text style={styles.activeAmount}>{formatCurrency(activePlan.investedAmount)}</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${(activePlan.totalPaidOut / activePlan.investedAmount) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressLabelText}>Released: {formatCurrency(activePlan.totalPaidOut)}</Text>
                  <Text style={styles.progressLabelText}>Remaining: {formatCurrency(activePlan.remainingAmount)}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.footerCol}>
                  <Text style={styles.footerLabel}>Next Release</Text>
                  <Text style={styles.footerVal}>{formatCurrency(activePlan.payoutAmount)}</Text>
                </View>
                <View style={styles.footerCol}>
                  <Text style={styles.footerLabel}>Release Date</Text>
                  <Text style={styles.footerVal}>{formatDate(activePlan.nextPayoutDate)}</Text>
                </View>
                <View style={styles.footerCol}>
                  <Text style={styles.footerLabel}>Progress</Text>
                  <Text style={styles.footerVal}>{activePlan.payoutCount}/10</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
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
              onPress={() => navigation.navigate('PocketMoneyAmount')}
            >
              <Text style={styles.startBtnText}>Start Pocket Money Plan</Text>
            </TouchableOpacity>
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
                    <Text style={styles.completedName}>₹{plan.investedAmount.toLocaleString('en-IN')} Plan</Text>
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
  });

export default PocketMoneyScreen;
