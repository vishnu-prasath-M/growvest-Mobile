import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../context/ThemeContext';
import { chitFundService } from '../../services/chitFundService';
import { authService } from '../../services/authService';

const JoinChitScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const { chitId } = route.params || {};
  const [chit, setChit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userData, setUserData] = useState(null);

  React.useEffect(() => {
    fetchChitDetails();
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await authService.getUserData();
      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

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
      const res = await chitFundService.joinChit({ chitId });
      setShowConfirm(false);
      const baseAmount = chit.isWeekly ? (chit.weeklyAmount || chit.monthlyAmount) : chit.monthlyAmount;
      navigation.replace('ChitPayment', {
        chitId: chit._id,
        month: 1,
        amount: baseAmount,
        lateFee: 0,
        type: 'join',
        chitName: chit.name,
      });
    } catch (error) {
      console.error('Error joining chit:', error);
      console.error('Error response:', error.response?.data);
      const serverMsg = error.response?.data?.message || error.message || 'Failed to join chit fund';
      Alert.alert('Unable to Join', serverMsg);
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

  // Check if user already has a membership (pending or active)
  const alreadyJoined = chit.myMembership && chit.myMembership.status !== 'cancelled';

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;
  const isWeekly = chit.isWeekly || false;
  const baseAmount = isWeekly ? (chit.weeklyAmount || chit.monthlyAmount) : chit.monthlyAmount;
  const processingFeeAmount = 0; // Processing Fee is ₹0
  const totalPayable = baseAmount;

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
          <LinearGradient colors={['#0E3D23', '#1A5C39', '#2E8B5A']} style={styles.summaryCardInner}>
            <View style={styles.blobTopRight} />
            <Text style={styles.summaryTitle}>{chit.name}</Text>
            <Text style={styles.summaryDesc}>{chit.description}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{isWeekly ? 'Weekly' : 'Monthly'}</Text>
                <Text style={styles.summaryValue}>{formatCurrency(baseAmount)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{isWeekly ? `${chit.totalWeeks || chit.duration}w` : `${chit.duration}mo`}</Text>
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
            <Text style={styles.feeLabel}>{isWeekly ? 'First Week Installment' : 'First Month Installment'}</Text>
            <Text style={styles.feeValue}>{formatCurrency(baseAmount)}</Text>
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
        {alreadyJoined ? (
          <View style={[styles.proceedBtnOuter, styles.proceedBtnDisabled]}>
            <View style={[styles.proceedBtnGradient, { backgroundColor: colors.muted, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[styles.proceedBtnText, { color: colors.textTertiary }]}>
                ✓ Already Joined
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.proceedBtnOuter, !agreed && styles.proceedBtnDisabled]}
            activeOpacity={0.85}
            disabled={!agreed}
            onPress={() => {
              if (!userData?.email) {
                setShowEmailModal(true);
              } else {
                setShowConfirm(true);
              }
            }}
          >
            <LinearGradient
              colors={agreed ? ['#0E3D23', '#1A5C39', '#2E8B5A'] : [colors.muted, colors.muted]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.proceedBtnGradient}
            >
              <Text style={[styles.proceedBtnText, !agreed && styles.proceedBtnTextDisabled]}>
                Proceed to Pay {formatCurrency(totalPayable)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Confirmation Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowConfirm(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="cash-check" size={40} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <Text style={styles.modalSubtitle}>Please verify the payment details</Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{isWeekly ? 'Week 1 Due' : 'Month 1 Due'}</Text>
              <Text style={styles.modalValue}>{formatCurrency(baseAmount)}</Text>
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
                style={styles.payBtnOuter}
                disabled={processing}
                onPress={handleJoin}
              >
                <LinearGradient
                  colors={processing ? [colors.muted, colors.muted] : ['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.payBtnGradient}
                >
                  <Text style={styles.payBtnText}>
                    {processing ? 'Processing...' : `Pay ${formatCurrency(totalPayable)}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Email Required Modal */}
      <Modal visible={showEmailModal} transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Email Required</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>
              Your email address is required before joining a chit fund. Please update your email in your Profile.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEmailModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.payBtnOuter}
                onPress={() => {
                  setShowEmailModal(false);
                  navigation.navigate('Profile');
                }}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.payBtnGradient}
                >
                  <Text style={styles.payBtnText}>Update Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  
  // Summary
  summaryCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 16, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  summaryCardInner: { padding: 24, position: 'relative' },
  blobTopRight: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.06)' },
  summaryTitle: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4, letterSpacing: -0.5 },
  summaryDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '700', color: colors.white },
  summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  
  // Fee
  feeCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  feeTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  feeLabel: { fontSize: 14, color: colors.textSecondary },
  feeValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  feeDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  feeTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  feeTotalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  
  // Terms
  termsCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  termsTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  termsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  
  // Declaration
  declarationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  declarationText: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  declarationLink: { color: colors.primary, fontWeight: '600' },
  
  // Bottom
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  proceedBtnOuter: { shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  proceedBtnGradient: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  proceedBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  proceedBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  proceedBtnTextDisabled: { color: colors.textTertiary },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.surface, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4, letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  modalLabel: { fontSize: 14, color: colors.textSecondary },
  modalValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  modalDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  modalTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  modalTotalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  payBtnOuter: { flex: 1.5 },
  payBtnGradient: { height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  payBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  modalText: { fontSize: 15, color: colors.textSecondary, marginBottom: 24, lineHeight: 22 },
});

export default JoinChitScreen;