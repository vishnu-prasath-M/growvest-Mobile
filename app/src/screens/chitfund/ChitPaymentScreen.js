import React, { useState, useEffect } from 'react';
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
import { authService } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';

const ChitPaymentScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const { chitId, memberId, month, amount, lateFee = 0, type, chitName, returnScreen } = route.params;
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  const totalAmount = amount + lateFee;

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

  const handleRazorpayPay = async () => {
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

    await executeRazorpayPayment({
      amount: totalAmount,
      paymentType,
      payloadData,
      user: userData,
      setLoading,
      onSuccess: (response) => {
        const nextScreen = returnScreen || 'MyChits';
        navigation.replace('PaymentSuccess', {
          title: type === 'join' ? 'Chit Joined Successfully!' : 'Chit Due Paid!',
          message:
            type === 'join'
              ? 'Your Razorpay payment was verified and your Chit membership is now active.'
              : `Your monthly due for Month ${month} has been verified and recorded.`,
          nextScreen,
          amount: totalAmount,
          type: 'due',
        });
      },
      onFailure: (error) => {
        console.error('[ChitPayment] Payment failed:', error);
      },
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
                {type === 'join' ? `Join Chit - ${chitName}` : `Chit Payment - Month ${month}`}
              </Text>
            </View>
            <View style={styles.summaryAmountRow}>
              <Text style={styles.summaryAmountLabel}>Amount to Pay</Text>
              <Text style={styles.summaryAmountValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Razorpay Section */}
        <View style={styles.razorpayCard}>
          <View style={styles.razorpayHeader}>
            <MaterialCommunityIcons name="shield-check" size={24} color={colors.primary} />
            <Text style={styles.razorpayTitle}>Razorpay Secure Gateway</Text>
          </View>
          <Text style={styles.razorpayDesc}>
            Pay securely using UPI, Credit/Debit Card, Netbanking or Wallets. Your Chit membership/installment will be automatically verified and updated.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
              <Text style={styles.featureText}>Automatic instant activation</Text>
            </View>
            <View style={styles.featureRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
              <Text style={styles.featureText}>Official digital payment receipt</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.payBtn}
          activeOpacity={0.85}
          onPress={handleRazorpayPay}
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
                <Text style={styles.payBtnText}>Pay {formatCurrency(totalAmount)} with Razorpay</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
});

export default ChitPaymentScreen;
