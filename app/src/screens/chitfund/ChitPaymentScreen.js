import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/theme';
import api from '../../services/apiService';
import { executeRazorpayPayment } from '../../services/razorpayHandler';
import { authService } from '../../services/authService';
import KycRequiredModal from '../../components/KycRequiredModal';
import { kycService } from '../../services/kycService';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';

const ChitPaymentScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const { showError } = useAlert();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const { chitId, memberId, month, amount, lateFee = 0, type, chitName, returnScreen, isWeekly } = route.params;
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const totalAmount = amount + lateFee;

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
      console.warn('[ChitPayment] Error fetching wallet:', err.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchWalletBalance();
    }, [])
  );

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await authService.getUserData();
      setUserData(user);
    } catch (e) {
      console.error('Error loading user data:', e);
    }
  };

  const formatCurrency = (value) =>
    `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  const handlePayFromWallet = async () => {
    const isSubmitted = await kycService.isKYCSubmittedForInvestment();
    if (!isSubmitted) {
      setKycModalVisible(true);
      return;
    }

    if (walletBalance < totalAmount) {
      Alert.alert(
        'Insufficient Wallet Balance',
        `Your wallet balance is ₹${walletBalance.toLocaleString('en-IN')}, but ₹${totalAmount.toLocaleString('en-IN')} is required. Please top up your wallet.`
      );
      return;
    }

    setLoading(true);
    try {
      const paymentType = type === 'join' ? 'chit_join' : 'chit_payment';
      const payloadData = {
        chitId,
        memberId,
        month,
        amount,
        lateFee,
        type,
        chitName,
      };
      const title = type === 'join' ? `Join Chit: ${chitName || 'Growvest Chit'}` : `Chit Due Month ${month}`;

      const res = await api.post('/wallet/pay', {
        amount: totalAmount,
        paymentType,
        payloadData,
        title,
      });

      if (res?.data?.success) {
        Alert.alert(
          'Payment Successful! 🎉',
          `₹${totalAmount.toLocaleString('en-IN')} paid directly from your Growvest Wallet!`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate(returnScreen || 'MyChits');
              },
            },
          ]
        );
      } else {
        throw new Error(res?.data?.message || 'Payment failed');
      }
    } catch (err) {
      console.error('[ChitPayment] Wallet pay error:', err);
      Alert.alert(
        'Payment Failed',
        err?.response?.data?.message || err.message || 'Could not complete payment from wallet.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTopupDeficit = () => {
    const deficit = Math.max(10, Math.ceil(totalAmount - walletBalance));
    navigation.navigate('ManualUpiPayment', {
      amount: deficit,
      paymentType: 'wallet_topup',
      payloadData: { amount: deficit },
      title: 'Top Up Wallet',
      returnScreen: 'ChitPayment',
    });
  };

  const handleRazorpayPay = async () => {
    // KYC Check
    const isSubmitted = await kycService.isKYCSubmittedForInvestment();
    if (!isSubmitted) {
      setKycModalVisible(true);
      return;
    }

    const paymentType = type === 'join' ? 'chit_join' : 'chit_payment';
    const payloadData = {
      chitId,
      memberId,
      month,
      amount,
      lateFee,
      type,
      chitName,
    };

    navigation.navigate('ManualUpiPayment', {
      amount: totalAmount,
      paymentType,
      payloadData,
      title: type === 'join' ? `Join Chit: ${chitName || 'Growvest Chit'}` : `Chit Due Month ${month}`,
      returnScreen: returnScreen || 'MyChits',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Payment Summary */}
        <View style={styles.summaryOuter}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.blobBottomLeft} />
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconWrap}>
                <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.gold} />
              </View>
              <Text style={styles.summaryType}>
                {type === 'join' ? `Join Chit - ${chitName}` : `Chit Payment - ${isWeekly ? 'Week' : 'Month'} ${month}`}
              </Text>
            </View>
            <View style={styles.summaryAmountRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryAmountLabel}>Amount to Pay</Text>
                {lateFee > 0 && (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                    (Due: {formatCurrency(amount)} + Late Fee: {formatCurrency(lateFee)})
                  </Text>
                )}
              </View>
              <Text style={styles.summaryAmountValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* GROWVEST WALLET PAYMENT CARD */}
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

            <View style={[styles.balanceStatusBadge, (walletBalance || 0) >= totalAmount ? styles.balanceStatusSuccess : styles.balanceStatusWarning]}>
              <Text style={[styles.balanceStatusText, (walletBalance || 0) >= totalAmount ? styles.balanceStatusTextSuccess : styles.balanceStatusTextWarning]}>
                {(walletBalance || 0) >= totalAmount ? 'SUFFICIENT' : 'LOW BALANCE'}
              </Text>
            </View>
          </View>

          {(walletBalance || 0) >= totalAmount ? (
            <View style={styles.sufficientInfoBox}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#059669" />
              <Text style={styles.sufficientInfoText}>
                Instant 1-tap deduction. ₹{Number(totalAmount).toLocaleString('en-IN')} will be debited directly from your wallet balance.
              </Text>
            </View>
          ) : (
            <View style={styles.insufficientBox}>
              <View style={styles.insufficientWarningRow}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.insufficientTitle}>Insufficient Wallet Balance</Text>
              </View>
              <Text style={styles.insufficientDesc}>
                You need <Text style={{ fontWeight: '800', color: themeColors.text }}>₹{Math.max(0, Math.ceil(totalAmount - (walletBalance || 0))).toLocaleString('en-IN')}</Text> more in your wallet to complete this chit payment.
              </Text>
              <TouchableOpacity
                style={styles.topupDeficitBtn}
                activeOpacity={0.85}
                onPress={handleTopupDeficit}
              >
                <MaterialCommunityIcons name="plus-circle" size={16} color="#FFFFFF" />
                <Text style={styles.topupDeficitText}>Add ₹{Math.max(0, Math.ceil(totalAmount - (walletBalance || 0))).toLocaleString('en-IN')} to Wallet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.payBtn}
          activeOpacity={0.85}
          onPress={(walletBalance || 0) >= totalAmount ? handlePayFromWallet : handleTopupDeficit}
          disabled={loading}
        >
          <LinearGradient
            colors={
              (walletBalance || 0) >= totalAmount
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
                  name={(walletBalance || 0) >= totalAmount ? 'wallet-outline' : 'plus-circle'}
                  size={20}
                  color={colors.white}
                />
                <Text style={styles.payBtnText}>
                  {(walletBalance || 0) >= totalAmount
                    ? `Pay ${formatCurrency(totalAmount)} from Wallet`
                    : `Add ₹${Math.max(0, Math.ceil(totalAmount - (walletBalance || 0))).toLocaleString('en-IN')} to Wallet`}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <KycRequiredModal
        visible={kycModalVisible}
        onClose={() => setKycModalVisible(false)}
        onNavigateToKYC={() => navigation.navigate('KYC')}
      />
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  
  // Summary
  summaryOuter: { marginBottom: 24, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  summaryCard: { borderRadius: 24, padding: 24, overflow: 'hidden', position: 'relative' },
  blobBottomLeft: { position: 'absolute', bottom: -40, left: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(212,168,67,0.1)' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  summaryIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  summaryType: { fontSize: 16, fontWeight: '700', color: colors.white, flex: 1 },
  summaryAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 16 },
  summaryAmountLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryAmountValue: { fontSize: 32, fontWeight: '800', color: colors.white, letterSpacing: -1 },

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
    borderColor: '#FDE68A',
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
    backgroundColor: '#FEF3C7',
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
    backgroundColor: '#DCFCE7',
  },
  balanceStatusWarning: {
    backgroundColor: '#FEE2E2',
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
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  sufficientInfoText: {
    fontSize: 12.5,
    color: '#166534',
    flex: 1,
    lineHeight: 17,
    fontWeight: '500',
  },
  insufficientBox: {
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
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

export default ChitPaymentScreen;
