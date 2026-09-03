import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { colors } from '../../theme/theme';
import { sipService } from '../../services/sipService';
import { openRazorpayCheckout } from '../../services/razorpayHandler';

const AMOUNT_PRESETS = [500, 1000, 2000, 5000];
const SIP_DATES = [1, 5, 10, 15, 20, 25];
const DURATIONS = [
  { months: 6, label: '6 Months' },
  { months: 12, label: '12 Months' },
  { months: 24, label: '24 Months' },
  { months: 36, label: '36 Months' },
];

const CreateSIPScreen = ({ navigation }) => {
  const { colors: themeColors, isDark } = useTheme();
  const insets = useScreenInsets(16);
  const styles = React.useMemo(() => getStyles(themeColors, isDark), [themeColors, isDark]);

  const [selectedAmount, setSelectedAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [selectedDate, setSelectedDate] = useState(10);
  const [selectedDuration, setSelectedDuration] = useState(12);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentAmount = isCustom ? Number(customAmount) || 0 : selectedAmount;
  const totalPlanned = currentAmount * selectedDuration;

  const calculateEndDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + selectedDuration);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSelectPreset = (amt) => {
    setSelectedAmount(amt);
    setIsCustom(false);
    setCustomAmount('');
  };

  const handleCustomChange = (val) => {
    const clean = val.replace(/[^0-9]/g, '');
    setCustomAmount(clean);
    setIsCustom(true);
  };

  const handleStartSIP = () => {
    if (currentAmount < 100) {
      Alert.alert('Invalid Amount', 'Minimum SIP contribution amount is ₹100.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmAndPay = async () => {
    try {
      setSubmitting(true);
      setShowConfirmModal(false);

      // 1. Create SIP & Order on backend
      const res = await sipService.createSIP({
        amount: currentAmount,
        sipDate: selectedDate,
        durationMonths: selectedDuration,
        frequency: 'monthly',
      });

      if (!res?.success) {
        throw new Error(res?.message || 'Failed to initialize SIP');
      }

      const { sip, firstContribution, orderId, amount, keyId, isSimulated } = res.data;

      // 2. Launch Razorpay Checkout
      await openRazorpayCheckout({
        orderId,
        amount,
        keyId,
        name: 'Growvest SIP',
        description: `Initial Contribution for ${sip.sipId}`,
        isSimulated,
        onSuccess: async (paymentData) => {
          try {
            // Verify payment
            const verifyRes = await sipService.verifyPayment({
              ...paymentData,
              sipId: sip._id,
              contributionId: firstContribution?._id,
              installmentNumber: 1,
            });

            if (verifyRes?.success) {
              Alert.alert(
                '🎉 SIP Created Successfully!',
                `Your SIP plan (${sip.sipId}) is now active with your first contribution of ₹${currentAmount.toLocaleString('en-IN')} paid.`,
                [
                  {
                    text: 'View SIP Details',
                    onPress: () =>
                      navigation.replace('SIPDetails', {
                        sipId: sip._id,
                        sipRefId: sip.sipId,
                      }),
                  },
                ]
              );
            } else {
              Alert.alert('Verification Issue', verifyRes?.message || 'Please check contribution status in SIP details.');
              navigation.replace('SIPDashboard');
            }
          } catch (vErr) {
            Alert.alert('Error', 'Payment verification encountered an issue. Our support team will confirm shortly.');
            navigation.replace('SIPDashboard');
          } finally {
            setSubmitting(false);
          }
        },
        onError: (err) => {
          setSubmitting(false);
          Alert.alert('Payment Cancelled', 'You can complete your first contribution anytime from your SIP dashboard.');
          navigation.replace('SIPDashboard');
        },
      });
    } catch (error) {
      setSubmitting(false);
      Alert.alert('Error', error?.message || 'Failed to create SIP. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text || '#0F172A'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start New SIP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerIconWrap}>
            <MaterialCommunityIcons name="calendar-sync" size={24} color="#085428" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bannerTitle}>Set Your Recurring Plan</Text>
            <Text style={styles.bannerSubtitle}>
              Select your preferred monthly amount, debit date, and duration.
            </Text>
          </View>
        </View>

        {/* Section 1: Monthly Amount */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Monthly Contribution</Text>
              <Text style={styles.cardSubtitle}>Amount you will invest each month</Text>
            </View>
          </View>

          {/* Quick Presets Grid */}
          <View style={styles.presetsGrid}>
            {AMOUNT_PRESETS.map((amt) => {
              const active = !isCustom && selectedAmount === amt;
              return (
                <TouchableOpacity
                  key={amt}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  activeOpacity={0.7}
                  onPress={() => handleSelectPreset(amt)}
                >
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                    ₹{amt.toLocaleString('en-IN')}
                  </Text>
                  {active && (
                    <MaterialCommunityIcons name="check-circle" size={14} color="#085428" style={styles.presetCheck} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Input */}
          <Text style={styles.customLabel}>Or enter custom amount:</Text>
          <View style={[styles.customInputContainer, isCustom && styles.customInputActive]}>
            <Text style={[styles.rupeeSymbol, isCustom && { color: '#085428' }]}>₹</Text>
            <TextInput
              style={styles.customInput}
              placeholder="e.g. 3500"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={customAmount}
              onChangeText={handleCustomChange}
            />
          </View>
        </View>

        {/* Section 2: SIP Date */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Monthly SIP Date</Text>
              <Text style={styles.cardSubtitle}>Day of month when installment is due</Text>
            </View>
          </View>

          <View style={styles.datesGrid}>
            {SIP_DATES.map((day) => {
              const active = selectedDate === day;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                    {day}th
                  </Text>
                  <Text style={[styles.dateChipSub, active && styles.dateChipSubActive]}>
                    monthly
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 3: Duration */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Duration</Text>
              <Text style={styles.cardSubtitle}>Total investment commitment tenure</Text>
            </View>
          </View>

          <View style={styles.durationsGrid}>
            {DURATIONS.map((dur) => {
              const active = selectedDuration === dur.months;
              return (
                <TouchableOpacity
                  key={dur.months}
                  style={[styles.durationChip, active && styles.durationChipActive]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedDuration(dur.months)}
                >
                  <Text style={[styles.durationChipText, active && styles.durationChipTextActive]}>
                    {dur.label}
                  </Text>
                  <Text style={[styles.durationChipSub, active && styles.durationChipSubActive]}>
                    {dur.months} Installments
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 4: Live Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons name="calculator-variant" size={20} color="#085428" />
            <Text style={styles.summaryCardTitle}>Plan Overview</Text>
          </View>
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monthly Installment</Text>
            <Text style={styles.summaryValue}>₹{currentAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Recurring Date</Text>
            <Text style={styles.summaryValue}>{selectedDate}th of every month</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{selectedDuration} Months</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Target Completion</Text>
            <Text style={styles.summaryValue}>{calculateEndDate()}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: '700', color: themeColors.text }]}>
              Total Planned Savings
            </Text>
            <Text style={[styles.summaryValue, { color: '#085428', fontSize: 18, fontWeight: '800' }]}>
              ₹{totalPlanned.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          activeOpacity={0.85}
          disabled={submitting}
          onPress={handleStartSIP}
        >
          <LinearGradient
            colors={['#085428', '#0A6C35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Review & Start SIP</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="shield-check" size={36} color="#085428" />
            </View>

            <Text style={styles.modalTitle}>Confirm SIP Plan</Text>
            <Text style={styles.modalSubtitle}>
              You will contribute ₹{currentAmount.toLocaleString('en-IN')} every month on the {selectedDate}th for {selectedDuration} months.
            </Text>

            <View style={styles.modalBreakdown}>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalBreakdownLabel}>Monthly Contribution</Text>
                <Text style={styles.modalBreakdownValue}>₹{currentAmount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalBreakdownLabel}>First Payment Today</Text>
                <Text style={[styles.modalBreakdownValue, { color: '#085428' }]}>
                  ₹{currentAmount.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalBreakdownLabel}>Total Planned</Text>
                <Text style={styles.modalBreakdownValue}>₹{totalPlanned.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <Text style={styles.mandateNotice}>
              Each upcoming SIP contribution will require payment through your preferred UPI / Netbanking method on the due date.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Modify</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                activeOpacity={0.85}
                onPress={handleConfirmAndPay}
              >
                <Text style={styles.modalConfirmBtnText}>Pay Contribution #1</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const getStyles = (themeColors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background || '#F8FAFC',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: themeColors.surface || '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#E2E8F0',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    bannerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#DCFCE7',
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
    },
    bannerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#085428',
      marginBottom: 2,
    },
    bannerSubtitle: {
      fontSize: 12,
      color: '#15803D',
      lineHeight: 16,
    },
    card: {
      backgroundColor: themeColors.surface || '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    stepBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#085428',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    cardSubtitle: {
      fontSize: 12,
      color: themeColors.textMuted || '#64748B',
      marginTop: 2,
    },
    presetsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 12,
    },
    presetChip: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
      position: 'relative',
    },
    presetChipActive: {
      backgroundColor: '#DCFCE7',
      borderColor: '#085428',
    },
    presetChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    presetChipTextActive: {
      color: '#085428',
    },
    presetCheck: {
      position: 'absolute',
      top: 4,
      right: 4,
    },
    customLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textMuted || '#64748B',
      marginBottom: 6,
    },
    customInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderWidth: 1.5,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 48,
    },
    customInputActive: {
      borderColor: '#085428',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    },
    rupeeSymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: themeColors.textMuted || '#94A3B8',
      marginRight: 6,
    },
    customInput: {
      flex: 1,
      height: '100%',
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    datesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-between',
    },
    dateChip: {
      width: '31%',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    dateChipActive: {
      backgroundColor: '#DCFCE7',
      borderColor: '#085428',
    },
    dateChipText: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    dateChipTextActive: {
      color: '#085428',
    },
    dateChipSub: {
      fontSize: 10,
      color: themeColors.textMuted || '#94A3B8',
      marginTop: 2,
    },
    dateChipSubActive: {
      color: '#15803D',
      fontWeight: '600',
    },
    durationsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-between',
    },
    durationChip: {
      width: '48%',
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    durationChipActive: {
      backgroundColor: '#DCFCE7',
      borderColor: '#085428',
    },
    durationChipText: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    durationChipTextActive: {
      color: '#085428',
    },
    durationChipSub: {
      fontSize: 10,
      color: themeColors.textMuted || '#94A3B8',
      marginTop: 2,
    },
    durationChipSubActive: {
      color: '#15803D',
      fontWeight: '600',
    },
    summaryCard: {
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    summaryCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    summaryDivider: {
      height: 1,
      backgroundColor: isDark ? '#334155' : '#E2E8F0',
      marginVertical: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    summaryLabel: {
      fontSize: 13,
      color: themeColors.textMuted || '#64748B',
    },
    summaryValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    submitBtn: {
      borderRadius: 14,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    submitGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      backgroundColor: themeColors.surface || '#FFFFFF',
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
    },
    modalIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.text || '#0F172A',
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: themeColors.textMuted || '#64748B',
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 18,
    },
    modalBreakdown: {
      width: '100%',
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      marginBottom: 12,
    },
    modalBreakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 4,
    },
    modalBreakdownLabel: {
      fontSize: 13,
      color: themeColors.textMuted || '#64748B',
    },
    modalBreakdownValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    mandateNotice: {
      fontSize: 11,
      color: '#D97706',
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 16,
    },
    modalBtnRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#E2E8F0',
    },
    modalCancelBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    modalConfirmBtn: {
      flex: 1.5,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: '#085428',
    },
    modalConfirmBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default CreateSIPScreen;
