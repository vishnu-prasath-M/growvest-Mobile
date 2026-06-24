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
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Card, Button, TextInput, Portal, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { dashboardService } from '../../services/dashboardService';
import { withdrawalService } from '../../services/withdrawalService';
import { colors, typography } from '../../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WithdrawScreen = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawType, setWithdrawType] = useState('saving');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchUserData = async () => {
    try {
      const data = await dashboardService.getDashboard();
      // The dashboard API returns data with balances
      const userInfo = {
        ...(data?.user || {}),
        savingBalance: data?.balances?.savingBalance || 0,
        fixedBalance: data?.balances?.fixedBalance || 0,
        availableToWithdraw: data?.balances?.availableToWithdraw || 0,
        totalBalance: data?.balances?.totalBalance || 0,
        totalInterest: data?.balances?.totalInterest || 0,
      };
      setUserData(userInfo);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

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
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const availableBalance = withdrawType === 'saving' 
      ? userData?.savingBalance 
      : userData?.fixedBalance;

    if (parseFloat(amount) > availableBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (!upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }

    setWithdrawing(true);
    try {
      await withdrawalService.createWithdrawal({
        amount: parseFloat(amount),
        upiId,
        userName: userData?.name || userData?.username,
        userEmail: userData?.email,
        withdrawType,
      });
      Alert.alert('Success', 'Withdrawal request submitted successfully');
      setWithdrawModalVisible(false);
      fetchUserData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit withdrawal request');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <MaterialCommunityIcons name="bank-transfer-out" size={40} color={colors.primaryLight} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Withdraw Funds</Text>
        <Text style={styles.screenSubtitle}>Request withdrawal from your deposits</Text>
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
        {/* Withdrawable Amount Banner */}
        <View style={styles.withdrawableBanner}>
          <MaterialCommunityIcons name="cash-multiple" size={28} color={colors.success} />
          <View style={styles.withdrawableText}>
            <Text style={styles.withdrawableLabel}>Total Withdrawable Amount</Text>
            <Text style={styles.withdrawableValue}>{formatCurrency(userData?.availableToWithdraw)}</Text>
          </View>
        </View>

        {/* Balance Cards */}
        <View style={styles.balancesSection}>
          <Text style={styles.sectionTitle}>Your Balances</Text>
          
          {/* Saving Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardLeft}>
              <View style={[styles.balanceIconWrapper, { backgroundColor: colors.savingLight }]}>
                <MaterialCommunityIcons name="piggy-bank" size={28} color={colors.saving} />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Saving Balance</Text>
                <Text style={styles.balanceAmount}>{formatCurrency(userData?.savingBalance)}</Text>
                <Text style={styles.balanceRate}>12% p.a. interest</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.withdrawBtn, { backgroundColor: colors.saving }]}
              activeOpacity={0.85}
              onPress={() => openWithdrawModal('saving')}
            >
              <MaterialCommunityIcons name="bank-transfer-out" size={18} color={colors.white} />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          {/* Fixed Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardLeft}>
              <View style={[styles.balanceIconWrapper, { backgroundColor: colors.fixedLight }]}>
                <MaterialCommunityIcons name="lock" size={28} color={colors.fixed} />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Fixed Balance</Text>
                <Text style={styles.balanceAmount}>{formatCurrency(userData?.fixedBalance)}</Text>
                <Text style={styles.balanceRate}>24% p.a. interest</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.withdrawBtn, { backgroundColor: colors.fixed }]}
              activeOpacity={0.85}
              onPress={() => openWithdrawModal('fixed')}
            >
              <MaterialCommunityIcons name="bank-transfer-out" size={18} color={colors.white} />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeaderContainer}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.info} />
            <Text style={styles.infoTitle}>Withdrawal Rules</Text>
          </View>
          <View style={styles.infoContent}>
            <View style={styles.infoRow}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Saving deposits: Withdraw anytime</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Fixed deposits: Withdraw after 1 year lock period</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Withdrawals processed within 24-48 hours</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Withdraw Modal */}
      <Portal>
        <Modal
          visible={withdrawModalVisible}
          onDismiss={() => setWithdrawModalVisible(false)}
          contentContainerStyle={styles.modalOverlay}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Withdraw from {withdrawType === 'saving' ? 'Saving' : 'Fixed'}
                </Text>
                <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBalanceDisplay}>
                <Text style={styles.modalBalanceLabel}>Available Balance</Text>
                <Text style={styles.modalBalanceAmount}>
                  {formatCurrency(withdrawType === 'saving' ? userData?.savingBalance : userData?.fixedBalance)}
                </Text>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Amount to Withdraw</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    mode="flat"
                    keyboardType="numeric"
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={colors.border}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                  />
                </View>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>UPI ID</Text>
                <TextInput
                  value={upiId}
                  onChangeText={setUpiId}
                  mode="outlined"
                  style={styles.upiInput}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                  placeholder="yourname@upi"
                  placeholderTextColor={colors.textTertiary}
                  left={<TextInput.Icon icon="bank" color={colors.textSecondary} />}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setWithdrawModalVisible(false)}
                  disabled={withdrawing}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, withdrawing && styles.submitBtnDisabled]}
                  onPress={handleWithdraw}
                  disabled={withdrawing}
                  activeOpacity={0.85}
                >
                  {withdrawing ? (
                    <Text style={styles.submitBtnText}>Processing...</Text>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />
                      <Text style={styles.submitBtnText}>Submit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Portal>
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
    ...typography.body1,
    color: colors.textTertiary,
    marginTop: 12,
  },
  screenHeader: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  screenTitle: {
    ...typography.h2,
    marginBottom: 4,
  },
  screenSubtitle: {
    ...typography.body2,
  },
  // Withdrawable Banner
  withdrawableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  withdrawableText: {
    marginLeft: 16,
    flex: 1,
  },
  withdrawableLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  withdrawableValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: -0.5,
  },
  // Balances
  balancesSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: 12,
  },
  balanceCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...colors.shadow.card,
  },
  balanceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  balanceRate: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  withdrawBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  // Info Card
  infoCard: {
    margin: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    ...colors.shadow.card,
  },
  infoHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 10,
  },
  infoContent: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 10,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    ...typography.h3,
  },
  modalBalanceDisplay: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalBalanceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  modalBalanceAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    height: 56,
    backgroundColor: 'transparent',
    padding: 0,
  },
  upiInput: {
    backgroundColor: colors.background,
    height: 52,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    ...colors.shadow.button,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});

export default WithdrawScreen;