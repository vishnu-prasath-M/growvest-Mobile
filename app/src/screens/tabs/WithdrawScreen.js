import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { userService } from '../../services/userService';
import { authService } from '../../services/authService';
import { withdrawalService } from '../../services/withdrawalService';
import { investmentService } from '../../services/investmentService';
import { chitFundService } from '../../services/chitFundService';
import api from '../../services/apiService';
import { colors } from '../../theme/theme';
import { mapProfileToWithdrawUser } from '../../utils/userBalances';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { Portal } from 'react-native-paper';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import DepositDetailModal from '../../components/DepositDetailModal';
import { useTheme } from '../../context/ThemeContext';

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

const WithdrawScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawType, setWithdrawType] = useState('saving');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [emailRequiredModalVisible, setEmailRequiredModalVisible] = useState(false);
  const [investments, setInvestments] = useState([]);

  const fetchUserData = async () => {
    try {
      const [profile, user] = await Promise.all([
        userService.getUserProfile().catch(() => null),
        authService.getUserData().catch(() => null),
      ]);
      const currentUser = profile || user;
      if (currentUser) {
        setUserData(mapProfileToWithdrawUser(currentUser));
      }

      // Fetch all investment types in parallel
      const [allInvestments, myChits, pocketMoneyRes] = await Promise.all([
        investmentService.getInvestments().catch(() => []),
        chitFundService.getMyChits().catch(() => []),
        api.get('/pocket-money/my').catch(() => ({ data: [] })),
      ]);

      // Savings/Fixed investments — already scoped to logged-in user by backend
      const validInvestments = (allInvestments || []).filter(inv => inv.status !== 'rejected');

      // Chit Fund memberships
      const activeChitItems = (myChits || []).filter(c => c.status === 'active' || c.status === 'approved').map(c => ({
        _id: c._id,
        chitId: c.chitId?._id || c.chitId || c._id,
        isChit: true,
        type: 'chit',
        chitName: c.chitName || 'Chit Fund Plan',
        amount: c.totalPaid || (Number(c.paidWeeks || 0) * Number(c.weeklyAmount || 0)),
        weeklyAmount: c.weeklyAmount || 0,
        currentWeek: c.currentWeek || 1,
        totalWeeks: c.totalWeeks || 10,
        hasWon: c.hasWon || false,
        winningAmount: c.winningAmount || 0,
        status: 'approved',
        joinedAt: c.joinedAt,
      }));

      // Pocket Money investments
      const pocketMoneyPlans = (pocketMoneyRes?.data || []);
      const pocketMoneyItems = pocketMoneyPlans
        .filter(pm => pm.status === 'active' || pm.status === 'completed')
        .map(pm => ({
          _id: pm._id,
          isPocketMoney: true,
          type: 'pocket_money',
          amount: pm.investedAmount || 0,
          investedAmount: pm.investedAmount || 0,
          remainingAmount: pm.remainingAmount || 0,
          totalPaidOut: pm.totalPaidOut || 0,
          payoutAmount: pm.payoutAmount || 0,
          payoutCount: pm.payoutCount || 0,
          frequency: pm.frequency || 'daily',
          nextPayoutDate: pm.nextPayoutDate,
          finalPayoutDate: pm.finalPayoutDate,
          status: pm.status,
          startDate: pm.startDate,
          bonusAmount: pm.bonusAmount || 0,
          totalFinalValue: pm.totalFinalValue || 0,
        }));

      setInvestments([...validInvestments, ...activeChitItems, ...pocketMoneyItems]);
    } catch (error) {
      console.error('Error fetching user profile & investments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPlanDisplayName = (type) => {
    if (type === 'saving') return 'Saving Deposit';
    if (type === 'fixed') return 'Fixed Deposit';
    if (type === '15_days') return '15 Days Plan';
    if (type === '1_month') return '1 Month Plan';
    if (type === '3_months') return '3 Months Plan';
    if (type === '6_months') return '6 Months Plan';
    if (type === '1_year') return '1 Year Plan';
    return 'Investment';
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  // Polling for auto-updating UI
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchUserData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const openWithdrawModal = (type) => {
    setWithdrawType(type);
    setAmount('');
    setUpiId('');
    setWithdrawModalVisible(true);
  };

  const handleWithdraw = async () => {
    if (!upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }
    
    // Check if user has email before proceeding
    if (!userData?.email || !userData.email.trim()) {
      setWithdrawModalVisible(false);
      setEmailRequiredModalVisible(true);
      return;
    }
    
    setWithdrawing(true);
    try {
      if (withdrawType && withdrawType !== 'saving' && withdrawType !== 'fixed') {
        await investmentService.withdrawInvestment(withdrawType, upiId);
        Alert.alert('Withdrawal Successful 🎉', 'Your matured investment payout has been processed.');
      } else {
        await withdrawalService.createWithdrawal({
          amount: parseFloat(amount),
          upiId,
          userName: userData?.name || userData?.username,
          userEmail: userData?.email,
          withdrawType,
        });
        Alert.alert('Success', 'Withdrawal request submitted successfully');
      }
      setWithdrawModalVisible(false);
      fetchUserData();
    } catch (error) {
      Alert.alert('Withdrawal Failed', error.message || error.toString() || 'Failed to process withdrawal request');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerPlaceholder, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.headerSub}>Withdraw</Text>
          <Text style={styles.headerTitle}>Move money out</Text>
        </View>
        <SkeletonLoader variant="form" />
      </View>
    );
  }

  // ── Totals for Top Hero Card ─────────────────────────────────────────────
  const totalInvestedValue = investments
    .filter(i => !['withdrawn', 'rejected'].includes(i.status))
    .reduce((sum, inv) => {
      if (inv.isPocketMoney) return sum + (inv.investedAmount || 0);
      if (inv.isChit) return sum + (inv.amount || 0);
      return sum + (inv.amount || 0);
    }, 0);

  const activeInvestmentsCount = investments.filter(i => !['withdrawn', 'rejected'].includes(i.status)).length;

  // availableToWithdraw: only matured savings + won chit auction payouts
  const availableToWithdrawValue = investments.reduce((acc, inv) => {
    if (inv.isPocketMoney) return acc; // Paid directly to user by Admin
    if (inv.isChit) return acc + (inv.hasWon && inv.withdrawalStatus !== 'completed' ? (inv.winningAmount || 0) : 0);
    // Savings/fixed: matured and not withdrawn
    const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
    const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
    if (isMatured && !isWithdrawn && inv.status === 'approved') {
      return acc + (inv.maturityAmount || (inv.amount + (inv.totalInterest || 0)));
    }
    return acc;
  }, 0);

  // Earliest unlock date among locked savings plans
  const lockedPlans = investments.filter(i => !i.isPocketMoney && !i.isChit && i.maturityDate && new Date() < new Date(i.maturityDate) && !['withdrawn', 'rejected'].includes(i.status));
  const nextUnlockMs = lockedPlans.length > 0 ? Math.min(...lockedPlans.map(i => new Date(i.maturityDate).getTime())) : null;
  const nextUnlockStr = nextUnlockMs ? new Date(nextUnlockMs).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.headerSub}>Withdraw</Text>
        <Text style={styles.headerTitle}>Move money out</Text>
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
        {/* Hero Card */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlobGold} />
            <Text style={styles.heroLabel}>Total Investments Value</Text>
            <Text style={styles.heroAmount}>{formatCurrency(totalInvestedValue)}</Text>
            <Text style={styles.heroNote}>Direct UPI Payouts • Bank Level Security</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12, marginTop: 12 }}>
              <View>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' }}>Active Investments</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F8FAF9' }}>{activeInvestmentsCount}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' }}>
                  {availableToWithdrawValue > 0 ? 'Available to Withdraw' : '🔒 Locked'}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: availableToWithdrawValue > 0 ? colors.gold : 'rgba(255,255,255,0.6)' }}>
                  {availableToWithdrawValue > 0 ? formatCurrency(availableToWithdrawValue) : nextUnlockStr ? `Unlocks ${nextUnlockStr}` : 'No matured plans'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* My Investments List */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>My Investments</Text>

          {investments.length === 0 ? (
            <View style={[styles.balanceCard, { flexDirection: 'column', padding: 24, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }]}>
              <MaterialCommunityIcons name="finance" size={40} color={themeColors.textTertiary} />
              <Text style={{ color: themeColors.textSecondary, marginTop: 10, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                No active investments found. Invest in a plan to earn high returns!
              </Text>
              <TouchableOpacity
                style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: themeColors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}
                onPress={() => navigation.navigate('Investments')}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Explore Plans</Text>
              </TouchableOpacity>
            </View>
          ) : (
            investments.map((inv) => {
              // ── POCKET MONEY CARD ─────────────────────────────────────────
              if (inv.isPocketMoney) {
                const totalPayouts = 10;
                const completedPayouts = inv.payoutCount || 0;
                const progressPct = Math.min(100, (completedPayouts / totalPayouts) * 100);
                const isCompleted = inv.status === 'completed';
                const freqLabel = inv.frequency === 'daily' ? 'Daily' : inv.frequency === 'every_2_days' ? 'Every 2 Days' : 'Weekly';
                const nextDate = inv.nextPayoutDate
                  ? new Date(inv.nextPayoutDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'N/A';
                return (
                  <TouchableOpacity
                    key={String(inv._id)}
                    style={styles.planStatusCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('PocketMoney')}
                  >
                    <View style={styles.planStatusTop}>
                      <View style={styles.planStatusInfo}>
                        <Text style={styles.planStatusName}>💼 Pocket Money</Text>
                        <Text style={styles.planStatusSub}>
                          {freqLabel} · {completedPayouts}/{totalPayouts} payouts released
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, isCompleted ? styles.statusBadgeMatured : styles.statusBadgeLocked]}>
                        <MaterialCommunityIcons
                          name={isCompleted ? 'check-circle' : 'piggy-bank'}
                          size={14}
                          color={isCompleted ? '#065F46' : '#B45309'}
                        />
                        <Text style={[styles.statusBadgeText, { color: isCompleted ? '#065F46' : '#B45309' }]}>
                          {isCompleted ? 'COMPLETED' : 'ACTIVE'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.planStatusDivider} />

                    {/* Progress bar */}
                    <View style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Progress</Text>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>{completedPayouts}/{totalPayouts} payouts</Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: themeColors.surface2, borderRadius: 3 }}>
                        <View style={{ height: 6, width: `${progressPct}%`, backgroundColor: '#1A5C39', borderRadius: 3 }} />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Invested</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.text }}>{formatCurrency(inv.investedAmount)}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Released</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A5C39' }}>{formatCurrency(inv.totalPaidOut)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Remaining</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.text }}>{formatCurrency(inv.remainingAmount)}</Text>
                      </View>
                    </View>

                    {!isCompleted && (
                      <View style={{ backgroundColor: themeColors.surface2, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary }}>
                          🗓 Next payout eligible: {nextDate}
                        </Text>
                        <Text style={{ fontSize: 11, color: themeColors.textTertiary, marginTop: 4, textAlign: 'center' }}>
                          Go to Pocket Money screen to request your next payout
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }

              if (inv.isChit) {
                const isWinner = inv.hasWon;
                const winningAmt = inv.winningAmount || 0;
                return (
                  <TouchableOpacity
                    key={inv._id}
                    style={styles.planStatusCard}
                    activeOpacity={0.88}
                    onPress={() => navigation.navigate('ChitDetails', { chitId: inv.chitId || inv._id })}
                  >
                    <View style={styles.planStatusTop}>
                      <View style={styles.planStatusInfo}>
                        <Text style={styles.planStatusName}>{inv.chitName}</Text>
                        <Text style={styles.planStatusSub}>
                          Paid: {formatCurrency(inv.amount)} • Week {inv.currentWeek}/{inv.totalWeeks} (₹{inv.weeklyAmount}/wk)
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        isWinner ? styles.statusBadgeMatured : styles.statusBadgeLocked
                      ]}>
                        <MaterialCommunityIcons 
                          name={isWinner ? 'trophy' : 'cash-check'} 
                          size={14} 
                          color={isWinner ? '#065F46' : '#047857'} 
                        />
                        <Text style={[
                          styles.statusBadgeText, 
                          { color: isWinner ? '#065F46' : '#047857' }
                        ]}>
                          {isWinner ? 'AUCTION WON' : 'ACTIVE CHIT'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.planStatusDivider} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 }}>
                      <View>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Category</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.text }}>Chit Fund</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Available to Withdraw</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: isWinner ? themeColors.primary : themeColors.textSecondary }}>
                          {isWinner ? formatCurrency(winningAmt) : '₹0.00'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      {isWinner ? (
                        <TouchableOpacity
                          style={styles.withdrawActionBtn}
                          activeOpacity={0.85}
                          onPress={() => navigation.navigate('ChitFundHome')}
                        >
                          <LinearGradient
                            colors={['#0E3D23', '#1A5C39']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.withdrawActionGradient}
                          >
                            <MaterialCommunityIcons name="trophy" size={16} color="#fff" />
                            <Text style={styles.withdrawActionText}>Claim Payout {formatCurrency(winningAmt)}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ backgroundColor: themeColors.surface2, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary }}>
                            ✓ Active Chit Member • Pot payout available upon winning auction
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }

              // ── SAVINGS / FIXED CARD ──────────────────────────────────────
              const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
              const isFullEligible = inv.isEligibleForFullBenefits === true;
              const principalAmt = inv.earlyPrincipalOnlyAmount || inv.amount || 0;
              const fullAmt = inv.fullBenefitAmount || inv.availableToWithdraw || principalAmt;
              const withdrawableAmt = inv.availableToWithdraw || (isFullEligible ? fullAmt : principalAmt);
              
              const benefitDateStr = inv.benefitEligibilityDate
                ? new Date(inv.benefitEligibilityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'N/A';

              return (
                <TouchableOpacity
                  key={inv._id}
                  style={styles.planStatusCard}
                  activeOpacity={0.88}
                  onPress={() => setSelectedDeposit(inv)}
                >
                  <View style={styles.planStatusTop}>
                    <View style={styles.planStatusInfo}>
                      <Text style={styles.planStatusName}>{getPlanDisplayName(inv.type)}</Text>
                      <Text style={styles.planStatusSub}>
                        Invested: {formatCurrency(inv.amount)} • Rate: {inv.interestRate}%
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      isWithdrawn ? { backgroundColor: themeColors.surface2 } :
                      isFullEligible ? styles.statusBadgeMatured : styles.statusBadgeLocked
                    ]}>
                      <MaterialCommunityIcons 
                        name={isWithdrawn ? 'check-all' : isFullEligible ? 'check-circle' : 'alert-circle'} 
                        size={14} 
                        color={isWithdrawn ? themeColors.textTertiary : isFullEligible ? '#065F46' : '#B45309'} 
                      />
                      <Text style={[
                        styles.statusBadgeText, 
                        { color: isWithdrawn ? themeColors.textTertiary : isFullEligible ? '#065F46' : '#B45309' }
                      ]}>
                        {isWithdrawn ? 'WITHDRAWN' : isFullEligible ? 'FULL BENEFITS ELIGIBLE' : 'EARLY (PRINCIPAL ONLY)'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.planStatusDivider} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 }}>
                    <View>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>5th-Week Benefit Date</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.text }}>{benefitDateStr}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Available to Withdraw</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: themeColors.primary }}>
                        {formatCurrency(withdrawableAmt)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    {isWithdrawn ? (
                      <View style={{ backgroundColor: themeColors.surface2, padding: 10, borderRadius: 10, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary }}>
                          ✓ Payout of {formatCurrency(withdrawableAmt)} has been processed.
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.withdrawActionBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                          setWithdrawType(inv._id);
                          setAmount(String(withdrawableAmt));
                          openWithdrawModal(inv._id);
                        }}
                      >
                        <LinearGradient
                          colors={['#0E3D23', '#1A5C39']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.withdrawActionGradient}
                        >
                          <MaterialCommunityIcons name="cash-fast" size={16} color="#fff" />
                          <Text style={styles.withdrawActionText}>
                            {isFullEligible
                              ? `Withdraw Full Amount (${formatCurrency(fullAmt)})`
                              : `Early Withdraw Principal Only (${formatCurrency(principalAmt)})`}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {!isFullEligible && !isWithdrawn && (
                      <Text style={{ fontSize: 11, color: '#B45309', marginTop: 6, textAlign: 'center', fontStyle: 'italic' }}>
                        🔒 Interest & extra benefits are locked until 5th-week eligibility date ({benefitDateStr}).
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
          <Text style={styles.securityText}>Protected by 256-bit encryption. Funds arrive directly to your account.</Text>
        </View>

        {/* Rules Card */}
        <View style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
            <Text style={styles.rulesTitle}>Investment Withdrawal Rules</Text>
          </View>
          {[
            'Duration plans: 15 Days, 1 Month, 3 Months, 6 Months, 1 Year',
            'Full maturity payout (principal + interest) unlocked upon maturity date',
            'Withdrawal requests are processed securely to your registered UPI ID',
          ].map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <View style={styles.ruleDot} />
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrapper}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setWithdrawModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                Withdraw from {withdrawType === 'saving' ? 'Saving' : 'Fixed'}
              </Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Balance display */}
            <View style={styles.modalBalanceBox}>
              <Text style={styles.modalBalanceLabel}>Available Balance</Text>
              <Text style={styles.modalBalanceAmount}>
                {formatCurrency(withdrawType === 'saving' ? userData?.savingBalance : userData?.fixedBalance)}
              </Text>
            </View>

            {/* Amount input */}
            <Text style={styles.inputLabel}>Amount to Withdraw</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.border}
              />
            </View>

            {/* Quick amounts */}
            <View style={styles.quickAmountRow}>
              {QUICK_AMOUNTS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.quickAmountChip}
                  onPress={() => setAmount(String(q))}
                >
                  <Text style={styles.quickAmountText}>+₹{q.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* UPI input */}
            <Text style={[styles.inputLabel, { marginTop: 16 }]}>UPI ID</Text>
            <View style={styles.upiInputRow}>
              <MaterialCommunityIcons name="bank" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.upiInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="yourname@upi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setWithdrawModalVisible(false)}
                disabled={withdrawing}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtnOuter, withdrawing && styles.submitBtnDisabled]}
                onPress={handleWithdraw}
                disabled={withdrawing}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtnGradient}
                >
                  {!withdrawing && <MaterialCommunityIcons name="check-circle" size={18} color={colors.white} />}
                  <Text style={styles.submitBtnText}>{withdrawing ? 'Processing...' : 'Submit'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Required Modal */}
      <Modal
        visible={emailRequiredModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailRequiredModalVisible(false)}
      >
        <View style={styles.modalWrapper}>
          <View style={styles.modalOverlay} onTouchStart={() => setEmailRequiredModalVisible(false)} />
          <View style={styles.emailModalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.emailModalContent}>
              <MaterialCommunityIcons name="email-alert" size={48} color={colors.warning} style={styles.emailModalIcon} />
              <Text style={styles.emailModalTitle}>Email Required</Text>
              <Text style={styles.emailModalText}>
                An email address is required to submit a withdrawal request.
              </Text>
              <Text style={styles.emailModalSubText}>
                Please update your email in your Profile before continuing.
              </Text>
              <View style={styles.emailModalActions}>
                <TouchableOpacity
                  style={styles.emailModalCancelBtn}
                  onPress={() => setEmailRequiredModalVisible(false)}
                >
                  <Text style={styles.emailModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emailModalUpdateBtn}
                  onPress={() => {
                    setEmailRequiredModalVisible(false);
                    navigation.navigate('Profile');
                  }}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emailModalUpdateBtnGradient}
                  >
                    <Text style={styles.emailModalUpdateText}>Update Profile</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Deposit Detail Modal */}
      <DepositDetailModal
        visible={!!selectedDeposit}
        item={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
        onWithdraw={(inv) => handleWithdrawSubmit(inv)}
      />
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
  headerPlaceholder: { paddingHorizontal: 20, paddingBottom: 16 },

  // Page Header
  pageHeader: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.background },
  headerSub: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginTop: 2 },

  // Hero Card
  heroOuter: { marginHorizontal: 20, marginBottom: 8 },
  heroCard: {
    borderRadius: 28, padding: 24, overflow: 'hidden',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28, shadowRadius: 40, elevation: 20,
  },
  heroBlobGold: {
    position: 'absolute', bottom: -30, right: -20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(212,168,67,0.18)',
  },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' },
  heroAmount: { fontSize: 38, fontWeight: '800', color: '#F8FAF9', letterSpacing: -1.5, marginTop: 8 },
  heroNote: { fontSize: 12, color: colors.gold, fontWeight: '600', marginTop: 6 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 },

  // Balance Cards
  balanceCard: {
    backgroundColor: colors.surface, borderRadius: 20,
    padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  balanceCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  balanceIconBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  balanceInfo: { flex: 1 },
  balanceCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  balanceCardAmount: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 2 },
  balanceCardRate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  withdrawActionBtn: { marginLeft: 12 },
  withdrawActionGradient: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  withdrawActionText: { fontSize: 13, fontWeight: '700', color: '#F8FAF9' },

  // Security Notice
  securityNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.accent, borderRadius: 14,
    padding: 12,
  },
  securityText: { flex: 1, fontSize: 12, color: colors.accentFg, lineHeight: 17 },

  // Rules Card
  rulesCard: {
    margin: 16, backgroundColor: colors.surface, borderRadius: 20, padding: 16,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rulesTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  ruleDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.primary, marginTop: 6, marginRight: 10,
  },
  ruleText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  // Modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20,
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center',
  },
  modalBalanceBox: {
    backgroundColor: colors.primaryLight, borderRadius: 14,
    padding: 14, marginBottom: 20,
  },
  modalBalanceLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  modalBalanceAmount: { fontSize: 22, fontWeight: '700', color: colors.primary, letterSpacing: -0.5, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 14,
    paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: colors.border,
    marginBottom: 12,
  },
  currencySymbol: { fontSize: 22, fontWeight: '700', color: colors.textSecondary, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text, padding: 0 },
  quickAmountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAmountChip: {
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  quickAmountText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  upiInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 14,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1.5, borderColor: colors.border, gap: 8,
  },
  upiInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  submitBtnOuter: { flex: 1.5 },
  submitBtnGradient: {
    height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8,
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  // Email Required Modal
  emailModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  emailModalContent: { alignItems: 'center', paddingTop: 10 },
  emailModalIcon: { marginBottom: 16 },
  emailModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emailModalText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  emailModalSubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  emailModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  emailModalCancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  emailModalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emailModalUpdateBtn: { flex: 1.5 },
  emailModalUpdateBtnGradient: {
    height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  emailModalUpdateText: { fontSize: 15, fontWeight: '700', color: colors.white },
  
  // Plan Status Cards
  planStatusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...colors.shadow.card,
  },
  planStatusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planStatusInfo: {
    flex: 1,
  },
  planStatusName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  planStatusSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusBadgeMatured: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeLocked: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planStatusDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  planStatusFooter: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default WithdrawScreen;