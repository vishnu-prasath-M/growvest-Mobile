import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/theme';
import api from '../../services/apiService';
import { executeRazorpayPayment } from '../../services/razorpayHandler';
import { investmentService } from '../../services/investmentService';
import { useTheme } from '../../context/ThemeContext';
import KycRequiredModal from '../../components/KycRequiredModal';
import ModernAlertModal from '../../components/ModernAlertModal';
import { kycService } from '../../services/kycService';

const InvestmentPaymentScreen = ({ navigation, route }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const {
    amount,
    type,
    userData,
    frequency,
    selectedWithdrawalDate,
    benefitEligibilityDate,
    isReinvestment,
    sourceInvestmentId,
    sourceRef,
  } = route.params;

  const [loading, setLoading] = useState(false);
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [fetchingWallet, setFetchingWallet] = useState(true);

  const fetchWalletBalance = async () => {
    try {
      const res = await api.get('/wallet/balance').catch(() => null);
      if (res && res.data && typeof res.data.balance === 'number') {
        setWalletBalance(res.data.balance);
      } else {
        const userRes = await api.get('/users/profile').catch(() => null);
        if (userRes?.data?.user?.balance !== undefined) {
          setWalletBalance(Number(userRes.data.user.balance) || 0);
        }
      }
    } catch (err) {
      console.warn('[InvestmentPayment] Error fetching wallet:', err.message);
    } finally {
      setFetchingWallet(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWalletBalance();
    }, [])
  );

  // Modern Alert Modal state
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    primaryText: 'OK',
    onPrimary: null,
  });

  const showAlert = (alertType, title, message, primaryText = 'OK', onPrimary = null) => {
    setAlertConfig({
      visible: true,
      type: alertType,
      title,
      message,
      primaryText,
      onPrimary: () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        if (onPrimary) onPrimary();
      },
    });
  };

  const formatCurrency = (value) => {
    return `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const getPlanDisplayName = (planType) => {
    if (planType === 'saving') return 'Saving Deposit';
    if (planType === 'fixed') return 'Fixed Deposit';
    if (planType === '15_days') return '15 Days Plan';
    if (planType === '1_month') return '1 Month Plan';
    if (planType === '3_months') return '3 Months Plan';
    if (planType === '6_months') return '6 Months Plan';
    if (planType === '1_year') return '1 Year Plan';
    return 'Investment';
  };

  const handleConfirmReinvestment = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await investmentService.reinvestInvestment({
        sourceInvestmentId,
        amount: Number(amount),
        type,
        selectedWithdrawalDate,
        intendedWithdrawalDate: selectedWithdrawalDate,
      });

      showAlert(
        'success',
        'Reinvestment Successful! 🎉',
        `Your ₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been successfully reinvested into ${getPlanDisplayName(type)}. No external payment was required.`,
        'View My Investments',
        () => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Investments' }] } }],
          });
        }
      );
    } catch (error) {
      console.error('[InvestmentPayment] Reinvestment failed:', error);
      showAlert(
        'error',
        'Reinvestment Failed',
        error?.message || error || 'Could not complete reinvestment. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePayFromWallet = async () => {
    const isSubmitted = await kycService.isKYCSubmittedForInvestment();
    if (!isSubmitted) {
      setKycModalVisible(true);
      return;
    }

    if (walletBalance < amount) {
      showAlert(
        'error',
        'Insufficient Wallet Balance',
        `Your wallet balance is ₹${walletBalance.toLocaleString('en-IN')}, but ₹${amount.toLocaleString('en-IN')} is required. Please top up your wallet.`
      );
      return;
    }

    setLoading(true);
    try {
      const paymentType = type === 'pocket_money' ? 'pocket_money' : 'investment';
      const payloadData = type === 'pocket_money'
        ? { amount, type, frequency }
        : { amount, type, selectedWithdrawalDate, benefitEligibilityDate };
      const title = type === 'pocket_money' ? 'Pocket Money Plan' : getPlanDisplayName(type);

      const res = await api.post('/wallet/pay', {
        amount,
        paymentType,
        payloadData,
        title,
      });

      if (res?.data?.success) {
        showAlert(
          'success',
          'Payment Successful! 🎉',
          `₹${amount.toLocaleString('en-IN')} paid directly from your Growvest Wallet. Your ${title} has been successfully activated!`,
          'View My Investments',
          () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Investments' }] } }],
            });
          }
        );
      } else {
        throw new Error(res?.data?.message || 'Payment failed');
      }
    } catch (err) {
      console.error('[InvestmentPayment] Wallet pay error:', err);
      showAlert(
        'error',
        'Payment Failed',
        err?.response?.data?.message || err.message || 'Could not complete payment from wallet.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTopupDeficit = () => {
    const deficit = Math.max(10, Math.ceil(amount - walletBalance));
    navigation.navigate('ManualUpiPayment', {
      amount: deficit,
      paymentType: 'wallet_topup',
      payloadData: { amount: deficit },
      title: 'Wallet Top-Up',
      returnScreen: 'InvestmentPayment',
    });
  };

  const handlePayNow = async () => {
    // KYC Check before proceeding to payment
    const isSubmitted = await kycService.isKYCSubmittedForInvestment();
    if (!isSubmitted) {
      setKycModalVisible(true);
      return;
    }

    navigation.navigate('ManualUpiPayment', {
      amount,
      paymentType: type === 'pocket_money' ? 'pocket_money' : 'investment',
      payloadData: type === 'pocket_money'
        ? { amount, type, frequency }
        : { amount, type, selectedWithdrawalDate, benefitEligibilityDate },
      title: type === 'pocket_money' ? 'Pocket Money Plan' : getPlanDisplayName(type),
      returnScreen: 'MainTabs',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment / Reinvestment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons
              name={isReinvestment ? 'refresh-circle' : type === 'pocket_money' ? 'wallet-giftcard' : type === 'saving' ? 'piggy-bank' : 'lock'}
              size={28}
              color={isReinvestment ? '#059669' : type === 'pocket_money' ? colors.primary : type === 'saving' ? colors.saving : colors.fixed}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryType}>
                {type === 'pocket_money' ? 'Pocket Money Plan' : getPlanDisplayName(type)}
              </Text>
              {isReinvestment ? (
                <Text style={styles.reinvestSubtitle}>
                  Funded via Matured Investment {sourceRef ? `(${sourceRef})` : ''}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryAmountLabel}>{isReinvestment ? 'Reinvest Amount' : 'Total Amount'}</Text>
            <Text style={[styles.summaryAmountValue, isReinvestment && { color: isDarkMode ? '#34D399' : '#059669' }]}>
              {formatCurrency(amount)}
            </Text>
          </View>
        </View>

        {/* Reinvestment Transfer Card vs Wallet Payment Card */}
        {isReinvestment ? (
          <View style={styles.reinvestDetailCard}>
            <View style={styles.reinvestDetailHeader}>
              <MaterialCommunityIcons name="shield-check" size={24} color={isDarkMode ? '#34D399' : '#059669'} />
              <Text style={styles.reinvestDetailTitle}>Internal Matured Reinvestment</Text>
            </View>
            <Text style={styles.reinvestDetailDesc}>
              This investment will be funded 100% internally from your already-earned matured payout. No external payment will be created and your bank/UPI will not be charged.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>Funded from matured balance (Principal + Interest)</Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>Instant automatic activation & approval</Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>Zero payment fees • No bank account deduction</Text>
              </View>
            </View>
          </View>
        ) : (
          /* GROWVEST WALLET PAYMENT CARD */
          <View style={styles.walletCheckoutCard}>
            <View style={styles.walletCardHeader}>
              <View style={styles.walletIconBox}>
                <MaterialCommunityIcons name="wallet" size={24} color="#D4AF37" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walletCardTitle}>Growvest Wallet</Text>
                <Text style={styles.walletBalanceSub}>
                  Available: <Text style={styles.walletBalanceBold}>₹{Number(walletBalance || 0).toLocaleString('en-IN')}</Text>
                </Text>
              </View>

              <View style={[styles.balanceStatusBadge, (walletBalance || 0) >= amount ? styles.balanceStatusSuccess : styles.balanceStatusWarning]}>
                <Text style={[styles.balanceStatusText, (walletBalance || 0) >= amount ? styles.balanceStatusTextSuccess : styles.balanceStatusTextWarning]}>
                  {(walletBalance || 0) >= amount ? 'SUFFICIENT' : 'LOW BALANCE'}
                </Text>
              </View>
            </View>

            {(walletBalance || 0) >= amount ? (
              <View style={styles.sufficientInfoBox}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#059669" />
                <Text style={styles.sufficientInfoText}>
                  Instant 1-tap activation. ₹{Number(amount).toLocaleString('en-IN')} will be debited directly from your wallet balance.
                </Text>
              </View>
            ) : (
              <View style={styles.insufficientBox}>
                <View style={styles.insufficientWarningRow}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.insufficientTitle}>Insufficient Wallet Balance</Text>
                </View>
                <Text style={styles.insufficientDesc}>
                  You need <Text style={{ fontWeight: '800', color: themeColors.text }}>₹{Math.max(0, Math.ceil(amount - (walletBalance || 0))).toLocaleString('en-IN')}</Text> more in your wallet to complete this investment.
                </Text>
                <TouchableOpacity
                  style={styles.topupDeficitBtn}
                  activeOpacity={0.85}
                  onPress={handleTopupDeficit}
                >
                  <MaterialCommunityIcons name="plus-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.topupDeficitText}>Add ₹{Math.max(0, Math.ceil(amount - (walletBalance || 0))).toLocaleString('en-IN')} to Wallet</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.payBtn}
          activeOpacity={0.85}
          onPress={
            isReinvestment
              ? handleConfirmReinvestment
              : (walletBalance || 0) >= amount
              ? handlePayFromWallet
              : handleTopupDeficit
          }
          disabled={loading}
        >
          <LinearGradient
            colors={
              isReinvestment || (walletBalance || 0) >= amount
                ? ['#0E3D23', '#1A5C39']
                : ['#B45309', '#D97706']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={isReinvestment ? 'refresh-circle' : (walletBalance || 0) >= amount ? 'wallet-outline' : 'plus-circle'}
                  size={22}
                  color={colors.white}
                />
                <Text style={styles.payBtnText}>
                  {isReinvestment
                    ? `Confirm Reinvestment (${formatCurrency(amount)})`
                    : (walletBalance || 0) >= amount
                    ? `Pay ${formatCurrency(amount)} from Wallet`
                    : `Add ₹${Math.max(0, Math.ceil(amount - (walletBalance || 0))).toLocaleString('en-IN')} to Wallet`}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Alternative: Direct UPI Payment link */}
        {!isReinvestment && (
          <TouchableOpacity
            style={styles.directUpiLink}
            onPress={handlePayNow}
            disabled={loading}
          >
            <Text style={styles.directUpiText}>Or Pay Directly via UPI (GPay / PhonePe / Paytm)</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.backBtnText}>{isReinvestment ? 'Cancel' : 'Cancel Payment'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <KycRequiredModal
        visible={kycModalVisible}
        onClose={() => setKycModalVisible(false)}
        onNavigateToKYC={() => navigation.navigate('KYC')}
      />

      {/* Modern Alert Modal */}
      <ModernAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        primaryButtonText={alertConfig.primaryText}
        onPrimaryPress={alertConfig.onPrimary}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const getStyles = (colors, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  summaryType: { fontSize: 18, fontWeight: '700', color: colors.text },
  reinvestSubtitle: { fontSize: 12, fontWeight: '600', color: isDarkMode ? '#34D399' : '#059669', marginTop: 2 },
  summaryAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryAmountLabel: { fontSize: 14, color: colors.textMuted },
  summaryAmountValue: { fontSize: 24, fontWeight: '800', color: colors.primary },

  reinvestDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(52, 211, 153, 0.3)' : '#A7F3D0',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  reinvestDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reinvestDetailTitle: { fontSize: 16, fontWeight: '700', color: isDarkMode ? '#34D399' : '#065F46' },
  reinvestDetailDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 16 },

  razorpayCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  razorpayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  razorpayTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  razorpayDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 16 },
  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, fontWeight: '500', color: colors.text },

  payBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  payGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  payBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },

  // Growvest Wallet Checkout Card Styles
  walletCheckoutCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(212, 175, 55, 0.3)' : '#FDE68A',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  walletCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  walletIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: isDarkMode ? 'rgba(212, 175, 55, 0.15)' : '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  walletBalanceSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  walletBalanceBold: {
    fontWeight: '800',
    color: colors.primary,
  },
  balanceStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  balanceStatusSuccess: {
    backgroundColor: isDarkMode ? 'rgba(5, 150, 105, 0.18)' : '#DCFCE7',
  },
  balanceStatusWarning: {
    backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.18)' : '#FEE2E2',
  },
  balanceStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  balanceStatusTextSuccess: {
    color: '#059669',
  },
  balanceStatusTextWarning: {
    color: '#DC2626',
  },
  sufficientInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDarkMode ? 'rgba(5, 150, 105, 0.08)' : '#F0FDF4',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(5, 150, 105, 0.2)' : '#BBF7D0',
  },
  sufficientInfoText: {
    fontSize: 12.5,
    color: isDarkMode ? '#34D399' : '#166534',
    flex: 1,
    lineHeight: 17,
    fontWeight: '500',
  },
  insufficientBox: {
    backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.08)' : '#FEF2F2',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(220, 38, 38, 0.2)' : '#FECACA',
  },
  insufficientWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  insufficientTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  insufficientDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 12,
  },
  topupDeficitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
  },
  topupDeficitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  directUpiLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  directUpiText: {
    fontSize: 12.5,
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default InvestmentPaymentScreen;