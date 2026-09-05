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
import { API_ENDPOINTS } from '../../config/api';
import { colors } from '../../theme/theme';
import { mapProfileToWithdrawUser } from '../../utils/userBalances';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import DepositDetailModal from '../../components/DepositDetailModal';
import { useTheme } from '../../context/ThemeContext';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

const WithdrawScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [bankInfo, setBankInfo] = useState(null);
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
      const [profile, user, kycRes] = await Promise.all([
        userService.getUserProfile().catch(() => null),
        authService.getUserData().catch(() => null),
        api.get(API_ENDPOINTS.KYC_STATUS).catch(() => null),
      ]);
      const currentUser = profile || user;
      if (currentUser) {
        setUserData(mapProfileToWithdrawUser(currentUser));
      }
      if (kycRes?.data?.data) {
        setBankInfo(kycRes.data.data);
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
    return 'Investment Plan';
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
    return `₹${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrencyNoDecimals = (amount) => {
    return `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;
  };

  // ── Calculation of Available To Withdraw Breakdown ─────────────────────────
  const investmentEarnings = investments.reduce((sum, inv) => {
    if (inv.isPocketMoney) return sum;
    if (inv.isChit) {
      return sum + (inv.hasWon && inv.withdrawalStatus !== 'completed' ? (Number(inv.winningAmount) || 0) : 0);
    }
    const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
    const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
    if (isMatured && !isWithdrawn && inv.status === 'approved') {
      return sum + (Number(inv.maturityAmount) || (Number(inv.amount) + (Number(inv.totalInterest) || 0)));
    }
    const intendedDate = inv.intendedWithdrawalDate || inv.selectedWithdrawalDate;
    const isEarlyUnlocked = intendedDate && new Date() >= new Date(intendedDate) && !isWithdrawn && inv.status === 'approved';
    if (isEarlyUnlocked && !isMatured) {
      return sum + (Number(inv.earlyPrincipalOnlyAmount) || Number(inv.amount) || 0);
    }
    return sum;
  }, 0);

  const pocketMoneyEarnings = investments
    .filter(i => i.isPocketMoney)
    .reduce((sum, pm) => {
      return sum + (Number(pm.totalPaidOut) || (Number(pm.payoutAmount) * Number(pm.payoutCount)) || 0);
    }, 0);

  const totalAvailableToWithdraw = userData?.availableToWithdraw > 0
    ? Number(userData.availableToWithdraw)
    : (investmentEarnings + pocketMoneyEarnings);

  const openWithdrawModal = (type) => {
    setWithdrawType(type);
    const targetInv = investments.find(inv => String(inv._id) === String(type));
    if (targetInv) {
      const defaultAmt = targetInv.availableToWithdraw || targetInv.earlyPrincipalOnlyAmount || targetInv.amount || 0;
      setAmount(String(defaultAmt || ''));
    }
    if (bankInfo?.upiId) {
      setUpiId(bankInfo.upiId);
    } else if (userData?.upiId) {
      setUpiId(userData.upiId);
    }
    setWithdrawModalVisible(true);
  };

  const handleMainWithdrawRequest = () => {
    const numAmt = parseFloat(amount);
    if (!amount || isNaN(numAmt) || numAmt <= 0) {
      Alert.alert('Enter Amount', 'Please enter a valid amount to withdraw.');
      return;
    }
    if (totalAvailableToWithdraw <= 0) {
      Alert.alert('No Available Balance', 'You currently do not have any matured investments or unlocked earnings ready to withdraw.');
      return;
    }
    if (numAmt > totalAvailableToWithdraw) {
      Alert.alert('Exceeds Balance', `The entered amount exceeds your available to withdraw balance of ${formatCurrency(totalAvailableToWithdraw)}.`);
      return;
    }
    if (!bankInfo?.accountNumber && !bankInfo?.upiId && !userData?.upiId) {
      Alert.alert(
        'Bank Account Required',
        'Please link your Bank Account or UPI ID before requesting a withdrawal.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Bank Details', onPress: () => navigation.navigate('BankDetails') },
        ]
      );
      return;
    }

    // Pre-populate UPI / Bank ID
    setUpiId(bankInfo?.upiId || userData?.upiId || `${bankInfo?.accountNumber || 'bank'}@upi`);

    // Match matured investment if available or general
    const maturedInv = investments.find(inv => {
      const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
      const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
      return isMatured && !isWithdrawn && inv.status === 'approved';
    });

    if (maturedInv) {
      setWithdrawType(maturedInv._id);
    } else {
      setWithdrawType('saving');
    }

    setWithdrawModalVisible(true);
  };

  const handleWithdraw = async () => {
    if (!upiId || !upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID or Bank account identifier');
      return;
    }
    
    setWithdrawing(true);
    try {
      if (withdrawType && withdrawType !== 'saving' && withdrawType !== 'fixed') {
        const res = await investmentService.withdrawInvestment(withdrawType, upiId.trim());
        Alert.alert(
          'Withdrawal Requested ⏳',
          res?.message || 'Your withdrawal request has been submitted and is pending admin approval.',
          [{ text: 'OK' }]
        );
      } else {
        const res = await withdrawalService.createWithdrawal({
          amount: parseFloat(amount),
          upiId: upiId.trim(),
          userName: userData?.name || userData?.username || 'User',
          userEmail: userData?.email || userData?.mobileNumber || '',
          withdrawType,
        });
        Alert.alert('Success', res?.message || 'Withdrawal request submitted successfully');
      }
      setWithdrawModalVisible(false);
      setAmount('');
      fetchUserData();
    } catch (error) {
      const errMsg = error?.response?.data?.message || error?.message || error?.error || (typeof error === 'string' ? error : 'Failed to process withdrawal request');
      Alert.alert('Withdrawal Failed', errMsg);
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

  // Display user bank account formatting
  const bankDisplayTitle = bankInfo?.bankName
    ? `${bankInfo.bankName} •••• ${bankInfo.accountNumber ? String(bankInfo.accountNumber).slice(-4) : '••••'}`
    : (userData?.upiId ? `UPI: ${userData.upiId}` : 'Add Bank Account / UPI');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 20 }]}>
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
        {/* ── Top Available to Withdraw Card (Exact Reference UI) ── */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={['#0E3D23', '#144A2D', '#1B5B38']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlobGold} />
            <Text style={styles.heroLabel}>Available to withdraw</Text>
            <Text style={styles.heroAmount}>{formatCurrency(totalAvailableToWithdraw)}</Text>

            <View style={styles.heroDivider} />

            {/* Breakdown Rows */}
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Investment earnings</Text>
              <Text style={styles.breakdownValue}>{formatCurrencyNoDecimals(investmentEarnings)}</Text>
            </View>

            <View style={[styles.breakdownRow, { marginTop: 6 }]}>
              <Text style={styles.breakdownLabel}>Pocket Money</Text>
              <Text style={styles.breakdownValue}>{formatCurrencyNoDecimals(pocketMoneyEarnings)}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Withdrawal Form Section ── */}
        <View style={styles.section}>
          <Text style={styles.formSectionLabel}>Amount</Text>

          {/* Amount Input Card */}
          <View style={styles.amountInputCard}>
            <View style={styles.amountLeft}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountTextInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              />
            </View>

            <TouchableOpacity
              style={styles.availableBadge}
              activeOpacity={0.7}
              onPress={() => setAmount(String(totalAvailableToWithdraw > 0 ? totalAvailableToWithdraw : ''))}
            >
              <Text style={styles.availableBadgeLabel}>Available</Text>
              <Text style={styles.availableBadgeValue}>{formatCurrencyNoDecimals(totalAvailableToWithdraw)}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Amounts Chips */}
          <View style={styles.quickChipsContainer}>
            {QUICK_AMOUNTS.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.quickChip}
                onPress={() => setAmount(String(q))}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>+₹{q.toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
            {totalAvailableToWithdraw > 0 && (
              <TouchableOpacity
                style={[styles.quickChip, styles.quickChipMax]}
                onPress={() => setAmount(String(totalAvailableToWithdraw))}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipMaxText}>Max</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bank Account / UPI Card */}
          <TouchableOpacity
            style={styles.bankAccountCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('BankDetails')}
          >
            <View style={styles.bankMintIconBox}>
              <MaterialCommunityIcons name="bank-outline" size={20} color={isDarkMode ? '#34D399' : '#0E3D23'} />
            </View>
            <View style={styles.bankInfoContent}>
              <Text style={styles.bankLabel}>Bank account / UPI</Text>
              <Text style={styles.bankTitle} numberOfLines={1}>{bankDisplayTitle}</Text>
            </View>
            {bankInfo?.bankName ? (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? '#6B7280' : '#8E9486'} />
            )}
          </TouchableOpacity>

          {/* Request Withdrawal Button */}
          <TouchableOpacity
            style={styles.requestBtnOuter}
            activeOpacity={0.85}
            onPress={handleMainWithdrawRequest}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.requestBtnGradient}
            >
              <MaterialCommunityIcons name="arrow-top-right" size={18} color="#FFFFFF" />
              <Text style={styles.requestBtnText}>Request Withdrawal</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.securityFooterNote}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color={isDarkMode ? '#34D399' : '#0E3D23'} />
            <Text style={styles.securityFooterText}>
              Withdrawals are processed only for eligible balances.
            </Text>
          </View>
        </View>

        {/* ── My Investments Overview List (Clean & Interactive) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>My Investments</Text>
            <Text style={styles.sectionHeaderCount}>{investments.length} Total</Text>
          </View>

          {investments.length === 0 ? (
            <View style={styles.emptyInvestmentsCard}>
              <MaterialCommunityIcons name="finance" size={36} color={themeColors.textTertiary} />
              <Text style={styles.emptyInvestmentsText}>
                No active investments found. Explore plans to start earning!
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => navigation.navigate('Investments')}
              >
                <Text style={styles.exploreBtnText}>Explore Plans</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.investmentsGroupCard}>
              {investments.map((inv, idx) => {
                const isWithdrawn = inv.status === 'withdrawn' || inv.withdrawalStatus === 'withdrawn';
                const isPocketMoney = inv.isPocketMoney === true;
                const isChit = inv.isChit === true;
                const isMatured = inv.maturityDate && new Date() >= new Date(inv.maturityDate);
                const isFullEligible = inv.isEligibleForFullBenefits === true || isMatured;

                // Title & subtitle
                let planTitle = getPlanDisplayName(inv.type);
                let planSubtitle = `Invested: ${formatCurrency(inv.amount)} • ${inv.interestRate || 12}% p.a.`;
                let iconName = 'trending-up';
                let badgeLabel = isWithdrawn ? 'WITHDRAWN' : isFullEligible ? 'MATURED' : 'ACTIVE';
                let badgeBg = isWithdrawn ? (isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9') : isFullEligible ? '#DCFCE7' : '#FEF3C7';
                let badgeColor = isWithdrawn ? (isDarkMode ? '#9CA3AF' : '#64748B') : isFullEligible ? '#059669' : '#D97706';

                if (isPocketMoney) {
                  planTitle = 'Pocket Money Plan';
                  planSubtitle = `Invested: ${formatCurrency(inv.investedAmount)} • ${inv.frequency || 'Daily'}`;
                  iconName = 'wallet-giftcard';
                  badgeLabel = inv.status === 'completed' ? 'COMPLETED' : 'ACTIVE';
                  badgeBg = inv.status === 'completed' ? '#DCFCE7' : '#FEF3C7';
                  badgeColor = inv.status === 'completed' ? '#059669' : '#D97706';
                } else if (isChit) {
                  planTitle = inv.chitName || 'Chit Fund Plan';
                  planSubtitle = `Paid: ${formatCurrency(inv.amount)} • Wk ${inv.currentWeek || 1}/${inv.totalWeeks || 10}`;
                  iconName = 'account-group-outline';
                  badgeLabel = inv.hasWon ? 'AUCTION WON' : 'ACTIVE CHIT';
                  badgeBg = inv.hasWon ? '#DCFCE7' : '#FEF3C7';
                  badgeColor = inv.hasWon ? '#059669' : '#D97706';
                }

                return (
                  <View key={String(inv._id || idx)}>
                    {idx > 0 && <View style={styles.cardDivider} />}
                    <TouchableOpacity
                      style={styles.investmentOverviewRow}
                      activeOpacity={0.7}
                      onPress={() => setSelectedDeposit(inv)}
                    >
                      <View style={styles.invMintIconBox}>
                        <MaterialCommunityIcons name={iconName} size={20} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                      </View>

                      <View style={styles.invTextContent}>
                        <Text style={styles.invTitleText} numberOfLines={1}>{planTitle}</Text>
                        <Text style={styles.invSubText} numberOfLines={1}>{planSubtitle}</Text>
                      </View>

                      <View style={[styles.invBadgePill, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.invBadgePillText, { color: badgeColor }]}>{badgeLabel}</Text>
                      </View>

                      <MaterialCommunityIcons name="chevron-right" size={20} color={isDarkMode ? '#6B7280' : '#8E9486'} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Withdraw Modal Confirmation / Input ── */}
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
              <Text style={styles.modalTitle}>Confirm Withdrawal</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Balance Box */}
            <View style={styles.modalBalanceBox}>
              <Text style={styles.modalBalanceLabel}>Eligible Available Balance</Text>
              <Text style={styles.modalBalanceAmount}>{formatCurrency(totalAvailableToWithdraw)}</Text>
            </View>

            {/* Amount Input */}
            <Text style={styles.inputLabel}>Withdrawal Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={themeColors.textMuted}
              />
            </View>

            {/* UPI / Bank Input */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Payout UPI ID / Bank Identifier</Text>
            <View style={styles.upiInputRow}>
              <MaterialCommunityIcons name="bank" size={18} color={themeColors.textMuted} />
              <TextInput
                style={styles.upiInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="yourname@upi or bank details"
                placeholderTextColor={themeColors.textMuted}
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
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtnGradient}
                >
                  {!withdrawing && <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />}
                  <Text style={styles.submitBtnText}>{withdrawing ? 'Processing...' : 'Submit Request'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Deposit Detail Modal Popup ── */}
      <DepositDetailModal
        visible={!!selectedDeposit}
        item={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
        onWithdraw={(inv) => {
          setSelectedDeposit(null);
          openWithdrawModal(inv._id);
        }}
      />
    </View>
  );
};

const getStyles = (themeColors, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  headerPlaceholder: { paddingHorizontal: 20, paddingBottom: 16 },

  // Page Header
  pageHeader: { paddingHorizontal: 20, paddingBottom: 14, backgroundColor: themeColors.background },
  headerSub: { fontSize: 12, color: themeColors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: themeColors.text, letterSpacing: -0.6, marginTop: 2 },

  // Hero Card (Exact Matching Top Card)
  heroOuter: { marginHorizontal: 16, marginBottom: 12 },
  heroCard: {
    borderRadius: 24, padding: 22, overflow: 'hidden',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 24, elevation: 12,
  },
  heroBlobGold: {
    position: 'absolute', bottom: -30, right: -20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(212,168,67,0.14)',
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroAmount: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginTop: 6 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Section
  section: { paddingHorizontal: 16, marginTop: 14 },
  formSectionLabel: {
    fontSize: 12, fontWeight: '800', color: isDarkMode ? '#9CA3AF' : '#686D62',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, paddingHorizontal: 4,
  },

  // Amount Input Card
  amountInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: themeColors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  amountLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  currencyPrefix: { fontSize: 24, fontWeight: '700', color: isDarkMode ? '#9CA3AF' : '#6B7280', marginRight: 6 },
  amountTextInput: { flex: 1, fontSize: 24, fontWeight: '700', color: themeColors.text, padding: 0 },
  availableBadge: { alignItems: 'flex-end', paddingLeft: 8 },
  availableBadgeLabel: { fontSize: 11, fontWeight: '500', color: themeColors.textMuted },
  availableBadgeValue: { fontSize: 13, fontWeight: '700', color: themeColors.text, marginTop: 1 },

  // Quick Chips
  quickChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickChip: {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F0F2EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: themeColors.text },
  quickChipMax: { backgroundColor: isDarkMode ? 'rgba(16,185,129,0.2)' : '#DCFCE7' },
  quickChipMaxText: { fontSize: 12, fontWeight: '700', color: isDarkMode ? '#34D399' : '#0E3D23' },

  // Bank Account / UPI Card
  bankAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    marginBottom: 14,
  },
  bankMintIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankInfoContent: { flex: 1 },
  bankLabel: { fontSize: 11, fontWeight: '600', color: themeColors.textMuted },
  bankTitle: { fontSize: 15, fontWeight: '700', color: themeColors.text, marginTop: 2 },
  primaryBadge: {
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  primaryBadgeText: { fontSize: 11, fontWeight: '700', color: isDarkMode ? '#34D399' : '#065F46' },

  // Request Button
  requestBtnOuter: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 8,
  },
  requestBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  requestBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  securityFooterNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  securityFooterText: { fontSize: 11, color: themeColors.textMuted, textAlign: 'center' },

  // ── My Investments Overview Group ──
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
  investmentOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  invMintIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  invTextContent: { flex: 1, minWidth: 0 },
  invTitleText: { fontSize: 15, fontWeight: '700', color: themeColors.text },
  invSubText: { fontSize: 12, fontWeight: '500', color: themeColors.textMuted, marginTop: 2 },
  invBadgePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 2,
  },
  invBadgePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  emptyInvestmentsCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
  },
  emptyInvestmentsText: {
    fontSize: 13,
    color: themeColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  exploreBtn: {
    marginTop: 14,
    backgroundColor: '#0E3D23',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exploreBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: themeColors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
    alignSelf: 'center', marginBottom: 20,
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: themeColors.text, letterSpacing: -0.4 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F0F2EB',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBalanceBox: {
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    borderRadius: 16,
    padding: 14, marginBottom: 18,
  },
  modalBalanceLabel: { fontSize: 12, color: themeColors.textMuted, fontWeight: '500' },
  modalBalanceAmount: { fontSize: 22, fontWeight: '800', color: isDarkMode ? '#34D399' : '#0E3D23', letterSpacing: -0.5, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text, marginBottom: 8 },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: themeColors.background, borderRadius: 14,
    paddingHorizontal: 16, height: 54,
    borderWidth: 1.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    marginBottom: 8,
  },
  currencySymbol: { fontSize: 20, fontWeight: '700', color: themeColors.textMuted, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', color: themeColors.text, padding: 0 },
  upiInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: themeColors.background, borderRadius: 14,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6', gap: 8,
  },
  upiInput: { flex: 1, fontSize: 14, color: themeColors.text, padding: 0 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14,
    borderWidth: 1.5, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: themeColors.textSecondary },
  submitBtnOuter: { flex: 1.5 },
  submitBtnGradient: {
    height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

export default WithdrawScreen;