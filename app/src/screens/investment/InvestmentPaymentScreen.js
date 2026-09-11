import React, { useState } from 'react';
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
import { colors } from '../../theme/theme';
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

  const handlePayNow = async () => {
    // KYC Check when clicking Pay with Razorpay button
    const isSubmitted = await kycService.isKYCSubmittedForInvestment();
    if (!isSubmitted) {
      setKycModalVisible(true);
      return;
    }
    await executeRazorpayPayment({
      amount,
      paymentType: type === 'pocket_money' ? 'pocket_money' : 'investment',
      payloadData: type === 'pocket_money'
        ? { amount, type, frequency }
        : { amount, type, selectedWithdrawalDate, benefitEligibilityDate },
      user: userData,
      setLoading,
      onSuccess: (response) => {
        showAlert(
          'success',
          'Payment Successful! 🎉',
          type === 'pocket_money'
            ? `Your ₹${amount} Pocket Money Plan has been verified and activated.`
            : `Your ₹${amount} ${getPlanDisplayName(type)} has been verified and automatically approved.`,
          'View Dashboard',
          () => {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          }
        );
      },
      onFailure: (error) => {
        console.error('[InvestmentPayment] Payment failed or cancelled:', error);
        showAlert(
          'warning',
          'Payment Cancelled',
          'Payment was not completed. Your investment has not been created.',
          'OK',
          () => navigation.goBack()
        );
      },
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

        {/* Reinvestment Transfer Card vs Razorpay Banner */}
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
          /* Razorpay Secure Checkout Card (Untouched for standard investments) */
          <View style={styles.razorpayCard}>
            <View style={styles.razorpayHeader}>
              <MaterialCommunityIcons name="shield-check" size={24} color={colors.primary} />
              <Text style={styles.razorpayTitle}>Razorpay Secure Checkout</Text>
            </View>
            <Text style={styles.razorpayDesc}>
              Instant payment processing via UPI, Credit/Debit Card, Netbanking & Wallets. Your deposit will be automatically verified and credited to your account.
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>Instant automatic approval</Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>256-bit bank-grade encryption</Text>
              </View>
              <View style={styles.featureRow}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.featureText}>Zero transaction fee</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.payBtn}
          activeOpacity={0.85}
          onPress={isReinvestment ? handleConfirmReinvestment : handlePayNow}
          disabled={loading}
        >
          <LinearGradient
            colors={isReinvestment ? ['#059669', '#047857'] : ['#0E3D23', '#1A5C39']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name={isReinvestment ? 'refresh-circle' : 'lock-check'} size={22} color={colors.white} />
                <Text style={styles.payBtnText}>
                  {isReinvestment ? `Confirm Reinvestment (${formatCurrency(amount)})` : `Pay ${formatCurrency(amount)} with Razorpay`}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

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
});

export default InvestmentPaymentScreen;