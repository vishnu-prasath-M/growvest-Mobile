import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { chitFundService } from '../../services/chitFundService';

const ChitPaymentStatusScreen = ({ navigation, route }) => {
  const { chitId, memberId, month, amount, lateFee, type, chitName, returnScreen } = route.params;
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value) =>
    `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  const submitPayment = async () => {
    setLoading(true);
    try {
      const payload = { chitId, memberId, month, amount, lateFee };
      console.log('[ChitPaymentStatus] Submitting payment payload:', payload);
      if (type === 'join') {
        // The member was already created in JoinChit, now we create a payment record
        const result = await chitFundService.makePayment(payload);
        console.log('[ChitPaymentStatus] Payment result:', result);
        navigation.replace('PaymentSuccess', {
          title: 'Join Request Submitted!',
          message: 'Your payment and join request are pending admin verification.',
          nextScreen: 'ChitFund',
        });
      } else {
        const result = await chitFundService.makePayment(payload);
        console.log('[ChitPaymentStatus] Payment result:', result);
        // If returnScreen is specified, go back there; otherwise go to MyChits
        const nextScreen = returnScreen || 'MyChits';
        navigation.replace('PaymentSuccess', {
          title: 'Payment Submitted!',
          message: 'Your chit payment has been recorded and is pending verification.',
          nextScreen,
          amount,
          type: 'due',
        });
      }
    } catch (error) {
      const status = error.response?.status;
      const serverMessage = error.response?.data?.message;
      console.error('[ChitPaymentStatus] Error submitting payment. Status:', status, 'Message:', serverMessage, 'Error:', error.message);
      // Show the real server error message, not just a generic one
      const displayMessage = serverMessage || error.message || 'We could not record your payment.';
      navigation.replace('PaymentFailed', {
        title: 'Submission Failed',
        message: `${displayMessage}${status ? ` (Status: ${status})` : ''}`,
        nextScreen: 'ChitFund',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    Alert.alert(
      'Confirm Submission',
      'Please ensure you have completed the UPI payment before submitting.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit Payment', onPress: submitPayment },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Success Header */}
        <View style={styles.successSection}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.successIconRing}
          >
            <MaterialCommunityIcons name="check" size={48} color={colors.gold} />
          </LinearGradient>
          <Text style={styles.successTitle}>Payment Completed?</Text>
          <Text style={styles.successSubtitle}>
            If you have completed the payment on your UPI app, please confirm below to record your payment.
          </Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Transaction Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{type === 'join' ? 'Join Chit' : `Month ${month} Payment`}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Chit Fund</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{chitName}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Paid</Text>
            <Text style={[styles.detailValue, { color: colors.primary, fontSize: 20 }]}>{formatCurrency(amount + lateFee)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backBtnText}>Not Yet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtnOuter, loading && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={loading}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.confirmBtnGradient}
            >
              <Text style={styles.confirmBtnText}>{loading ? 'Processing...' : 'Confirm Payment'}</Text>
              {!loading && <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 40 },
  
  successSection: { alignItems: 'center', paddingVertical: 20, marginBottom: 20 },
  successIconRing: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  
  detailsCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, marginBottom: 40, shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  detailsTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  detailLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 16, color: colors.text, fontWeight: '800', flex: 1, textAlign: 'right' },
  detailDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: 12 },
  
  buttonRow: { flexDirection: 'row', gap: 12 },
  backBtn: { flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  confirmBtnOuter: { flex: 1.5, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  confirmBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 16, gap: 8 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});

export default ChitPaymentStatusScreen;
