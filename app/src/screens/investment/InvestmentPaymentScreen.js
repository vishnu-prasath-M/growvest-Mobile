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
import { useTheme } from '../../context/ThemeContext';

const InvestmentPaymentScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const { amount, type, userData, frequency } = route.params;
  const [loading, setLoading] = useState(false);

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

  const handlePayNow = async () => {
    await executeRazorpayPayment({
      amount,
      paymentType: type === 'pocket_money' ? 'pocket_money' : 'investment',
      payloadData: type === 'pocket_money' ? { amount, type, frequency } : { amount, type },
      user: userData,
      setLoading,
      onSuccess: (response) => {
        Alert.alert(
          'Payment Successful! 🎉',
          type === 'pocket_money'
            ? `Your ₹${amount} Pocket Money Plan has been verified and activated.`
            : `Your ₹${amount} ${getPlanDisplayName(type)} has been verified and automatically approved.`,
          [
            {
              text: 'View Dashboard',
              onPress: () => {
                navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
              },
            },
          ]
        );
      },
      onFailure: (error) => {
        console.error('[InvestmentPayment] Payment failed:', error);
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
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons
              name={type === 'pocket_money' ? 'wallet-giftcard' : type === 'saving' ? 'piggy-bank' : 'lock'}
              size={28}
              color={type === 'pocket_money' ? colors.primary : type === 'saving' ? colors.saving : colors.fixed}
            />
            <Text style={styles.summaryType}>
              {type === 'pocket_money' ? 'Pocket Money Plan' : getPlanDisplayName(type)}
            </Text>
          </View>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryAmountLabel}>Total Amount</Text>
            <Text style={styles.summaryAmountValue}>{formatCurrency(amount)}</Text>
          </View>
        </View>

        {/* Razorpay Banner */}
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

        {/* Pay Button */}
        <TouchableOpacity
          style={styles.payBtn}
          activeOpacity={0.85}
          onPress={handlePayNow}
          disabled={loading}
        >
          <LinearGradient
            colors={['#0E3D23', '#1A5C39']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="lock-check" size={20} color={colors.white} />
                <Text style={styles.payBtnText}>Pay {formatCurrency(amount)} with Razorpay</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Cancel Payment</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
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
  summaryAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryAmountLabel: { fontSize: 14, color: colors.textMuted },
  summaryAmountValue: { fontSize: 24, fontWeight: '800', color: colors.primary },

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