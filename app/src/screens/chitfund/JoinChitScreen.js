import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const JoinChitScreen = ({ navigation, route }) => {
  const insets = useScreenInsets(8);
  const { chitId } = route.params || {};
  const [chit, setChit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

  React.useEffect(() => {
    fetchChitDetails();
  }, []);

  const fetchChitDetails = async () => {
    try {
      const data = await chitFundService.getChitById(chitId);
      setChit(data);
    } catch (error) {
      console.error('Error fetching chit details:', error);
      Alert.alert('Error', 'Failed to load chit details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!agreed) return;
    setProcessing(true);
    try {
      // 1. Create join request (pending member & transaction on server)
      const res = await chitFundService.joinChit({ chitId });
      
      // 2. Navigate to Payment screen to complete UPI payment
      setShowConfirm(false);
      navigation.replace('ChitPayment', {
        chitId: chit._id,
        memberId: res.member._id,
        month: 1,
        amount: chit.monthlyAmount,
        lateFee: 0,
        type: 'join',
        chitName: chit.name,
      });
    } catch (error) {
      console.error('Error joining chit:', error);
      Alert.alert('Error', error.message || 'Failed to join chit fund');
      setShowConfirm(false);
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !chit) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;
  const processingFeeAmount = (chit.monthlyAmount * (chit.processingFee || 2)) / 100;
  const totalPayable = chit.monthlyAmount + processingFeeAmount;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join {chit.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Plan Summary */}
        <View style={styles.summaryCard}>
          <LinearGradient colors={['#064e3b', '#065f46', '#047857']} style={styles.summaryCardInner}>
            <Text style={styles.summaryTitle}>{chit.name}</Text>
            <Text style={styles.summaryDesc}>{chit.description}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Monthly</Text>
                <Text style={styles.summaryValue}>{formatCurrency(chit.monthlyAmount)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{chit.duration}mo</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Members</Text>
                <Text style={styles.summaryValue}>{chit.totalMembers}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Fee Details */}
        <View style={styles.feeCard}>
          <Text style={styles.feeTitle}>Payment Summary</Text>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Monthly Installment</Text>
            <Text style={styles.feeValue}>{formatCurrency(chit.monthlyAmount)}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Processing Fee ({chit.processingFee}%)</Text>
            <Text style={styles.feeValue}>{formatCurrency(processingFeeAmount)}</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <Text style={styles.feeTotalLabel}>Total Payable</Text>
            <Text style={styles.feeTotalValue}>{formatCurrency(totalPayable)}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.termsCard}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>
            By joining this chit fund, you agree to pay the monthly installment on or before the due date each month. 
            Late payments will incur additional fees as per the chit fund rules. You also agree to participate in 
            monthly auctions and accept the dividend distribution as per the scheme.
          </Text>
        </View>

        {/* Declaration */}
        <TouchableOpacity style={styles.declarationRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.85}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
            {agreed && <MaterialCommunityIcons name="check" size={16} color={colors.white} />}
          </View>
          <Text style={styles.declarationText}>
            I have read and agree to the{' '}
            <Text style={styles.declarationLink}>Terms & Conditions</Text> and{' '}
            <Text style={styles.declarationLink}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Proceed Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.proceedBtn, !agreed && styles.proceedBtnDisabled]}
          activeOpacity={0.85}
          disabled={!agreed}
          onPress={() => setShowConfirm(true)}
        >
          <Text style={[styles.proceedBtnText, !agreed && styles.proceedBtnTextDisabled]}>
            Proceed to Pay {formatCurrency(totalPayable)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowConfirm(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="cash-check" size={48} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <Text style={styles.modalSubtitle}>Please verify the payment details</Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Monthly Due</Text>
              <Text style={styles.modalValue}>{formatCurrency(chit.monthlyAmount)}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Processing Fee</Text>
              <Text style={styles.modalValue}>{formatCurrency(processingFeeAmount)}</Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalRow}>
              <Text style={styles.modalTotalLabel}>Total</Text>
              <Text style={styles.modalTotalValue}>{formatCurrency(totalPayable)}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payBtn, processing && { opacity: 0.7 }]}
                disabled={processing}
                onPress={handleJoin}
              >
                <Text style={styles.payBtnText}>
                  {processing ? 'Processing...' : `Pay ${formatCurrency(totalPayable)}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  // Summary
  summaryCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, ...colors.shadow.elevated },
  summaryCardInner: { padding: 24 },
  summaryTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
  summaryDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.white },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  // Fee
  feeCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  feeTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  feeLabel: { fontSize: 14, color: colors.textSecondary },
  feeValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  feeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  feeTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  feeTotalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  // Terms
  termsCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  termsTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  termsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  // Declaration
  declarationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  declarationText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  declarationLink: { color: colors.primary, fontWeight: '600' },
  // Bottom
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.borderLight },
  proceedBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', ...colors.shadow.button },
  proceedBtnDisabled: { backgroundColor: colors.border, ...colors.shadow.card },
  proceedBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  proceedBtnTextDisabled: { color: colors.textTertiary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.white, borderRadius: 24, padding: 24, ...colors.shadow.elevated },
  modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalLabel: { fontSize: 14, color: colors.textSecondary },
  modalValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  modalTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  modalTotalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  payBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', ...colors.shadow.button },
  payBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});

export default JoinChitScreen;