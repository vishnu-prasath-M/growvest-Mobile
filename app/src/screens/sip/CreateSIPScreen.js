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

// Frequency Definitions
const FREQUENCIES = [
  { id: 'daily', label: 'Daily', sub: 'Every day', icon: 'calendar-today' },
  { id: 'weekly', label: 'Weekly', sub: 'Every week', icon: 'calendar-week' },
  { id: 'monthly', label: 'Monthly', sub: 'Every month', icon: 'calendar-month' },
];

const PRESETS_BY_FREQ = {
  daily: [100, 200, 500, 1000],
  weekly: [250, 500, 1000, 2000],
  monthly: [500, 1000, 2000, 5000],
};

const WEEK_DAYS = [
  { id: 'Monday', short: 'Mon' },
  { id: 'Tuesday', short: 'Tue' },
  { id: 'Wednesday', short: 'Wed' },
  { id: 'Thursday', short: 'Thu' },
  { id: 'Friday', short: 'Fri' },
  { id: 'Saturday', short: 'Sat' },
  { id: 'Sunday', short: 'Sun' },
];

const MONTH_DATES = [1, 5, 10, 15, 20, 25];

const DURATIONS_BY_FREQ = {
  daily: [
    { count: 30, label: '30 Days', sub: '1 Month' },
    { count: 60, label: '60 Days', sub: '2 Months' },
    { count: 90, label: '90 Days', sub: '3 Months' },
    { count: 180, label: '180 Days', sub: '6 Months' },
    { count: 365, label: '365 Days', sub: '1 Year' },
  ],
  weekly: [
    { count: 12, label: '12 Weeks', sub: '~3 Months' },
    { count: 24, label: '24 Weeks', sub: '~6 Months' },
    { count: 52, label: '52 Weeks', sub: '1 Year' },
  ],
  monthly: [
    { count: 6, label: '6 Months', sub: '6 Installments' },
    { count: 12, label: '12 Months', sub: '12 Installments' },
    { count: 24, label: '24 Months', sub: '24 Installments' },
    { count: 36, label: '36 Months', sub: '36 Installments' },
  ],
};

const CreateSIPScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const isDark = Boolean(isDarkMode);
  const insets = useScreenInsets(16);
  const styles = React.useMemo(() => getStyles(themeColors, isDark), [themeColors, isDark]);

  // Form State
  const [selectedFrequency, setSelectedFrequency] = useState('monthly');
  const [selectedAmount, setSelectedAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [selectedDayName, setSelectedDayName] = useState('Monday');
  const [selectedMonthDate, setSelectedMonthDate] = useState(10);
  const [selectedDurationCount, setSelectedDurationCount] = useState(12);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Switch frequency
  const handleFrequencyChange = (freq) => {
    setSelectedFrequency(freq);
    setIsCustom(false);
    setCustomAmount('');

    if (freq === 'daily') {
      setSelectedAmount(100);
      setSelectedDurationCount(30);
    } else if (freq === 'weekly') {
      setSelectedAmount(500);
      setSelectedDurationCount(12);
    } else {
      setSelectedAmount(1000);
      setSelectedDurationCount(12);
    }
  };

  const currentAmount = isCustom ? Number(customAmount) || 0 : selectedAmount;
  const totalPlanned = currentAmount * selectedDurationCount;

  const calculateEndDate = () => {
    const d = new Date();
    if (selectedFrequency === 'daily') {
      d.setDate(d.getDate() + (selectedDurationCount - 1));
    } else if (selectedFrequency === 'weekly') {
      d.setDate(d.getDate() + (selectedDurationCount - 1) * 7);
    } else {
      d.setMonth(d.getMonth() + selectedDurationCount);
    }
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
        frequency: selectedFrequency,
        sipDate: selectedFrequency === 'monthly' ? selectedMonthDate : 1,
        sipDayName: selectedFrequency === 'weekly' ? selectedDayName : undefined,
        durationCount: selectedDurationCount,
        durationMonths:
          selectedFrequency === 'monthly'
            ? selectedDurationCount
            : selectedFrequency === 'weekly'
            ? Math.max(1, Math.round(selectedDurationCount / 4))
            : Math.max(1, Math.round(selectedDurationCount / 30)),
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
                `Your ${selectedFrequency.toUpperCase()} SIP plan (${sip.sipId}) is now active with your first contribution of ₹${currentAmount.toLocaleString('en-IN')} paid.`,
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

  const activePresets = PRESETS_BY_FREQ[selectedFrequency] || PRESETS_BY_FREQ.monthly;
  const activeDurations = DURATIONS_BY_FREQ[selectedFrequency] || DURATIONS_BY_FREQ.monthly;

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
              Choose Daily, Weekly, or Monthly contributions to build your wealth effortlessly.
            </Text>
          </View>
        </View>

        {/* Section 0: Frequency Selection */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Contribution Frequency</Text>
              <Text style={styles.cardSubtitle}>How often would you like to invest?</Text>
            </View>
          </View>

          <View style={styles.freqRow}>
            {FREQUENCIES.map((freq) => {
              const active = selectedFrequency === freq.id;
              return (
                <TouchableOpacity
                  key={freq.id}
                  style={[styles.freqChip, active && styles.freqChipActive]}
                  activeOpacity={0.8}
                  onPress={() => handleFrequencyChange(freq.id)}
                >
                  <MaterialCommunityIcons
                    name={freq.icon}
                    size={20}
                    color={active ? '#085428' : themeColors.textMuted || '#64748B'}
                  />
                  <Text style={[styles.freqChipText, active && styles.freqChipTextActive]}>
                    {freq.label}
                  </Text>
                  <Text style={[styles.freqChipSub, active && styles.freqChipSubActive]}>
                    {freq.sub}
                  </Text>
                  {active && (
                    <View style={styles.freqBadgeActive}>
                      <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 1: Contribution Amount */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>
                {selectedFrequency === 'daily'
                  ? 'Daily Contribution'
                  : selectedFrequency === 'weekly'
                  ? 'Weekly Contribution'
                  : 'Monthly Contribution'}
              </Text>
              <Text style={styles.cardSubtitle}>
                Amount you will contribute per {selectedFrequency === 'daily' ? 'day' : selectedFrequency === 'weekly' ? 'week' : 'month'}
              </Text>
            </View>
          </View>

          {/* Quick Presets Grid */}
          <View style={styles.presetsGrid}>
            {activePresets.map((amt) => {
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
              placeholder="e.g. 1500"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={customAmount}
              onChangeText={handleCustomChange}
            />
          </View>
        </View>

        {/* Section 2: Schedule / Timing */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>
                {selectedFrequency === 'daily'
                  ? 'Daily Schedule'
                  : selectedFrequency === 'weekly'
                  ? 'Preferred Weekly Day'
                  : 'Monthly SIP Date'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {selectedFrequency === 'daily'
                  ? 'Contributions are due every single calendar day'
                  : selectedFrequency === 'weekly'
                  ? 'Select the day of week for your weekly contribution'
                  : 'Day of month when installment is due'}
              </Text>
            </View>
          </View>

          {selectedFrequency === 'daily' ? (
            <View style={styles.dailyScheduleBox}>
              <MaterialCommunityIcons name="clock-fast" size={24} color="#085428" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.dailyScheduleTitle}>Daily Recurring Schedule</Text>
                <Text style={styles.dailyScheduleSub}>
                  Starts today. Each contribution is auto-scheduled every 24 hours.
                </Text>
              </View>
            </View>
          ) : selectedFrequency === 'weekly' ? (
            <View style={styles.weekDaysGrid}>
              {WEEK_DAYS.map((day) => {
                const active = selectedDayName === day.id;
                return (
                  <TouchableOpacity
                    key={day.id}
                    style={[styles.weekDayChip, active && styles.weekDayChipActive]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDayName(day.id)}
                  >
                    <Text style={[styles.weekDayText, active && styles.weekDayTextActive]}>
                      {day.short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.datesGrid}>
              {MONTH_DATES.map((day) => {
                const active = selectedMonthDate === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedMonthDate(day)}
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
          )}
        </View>

        {/* Section 3: Duration */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>4</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Investment Duration</Text>
              <Text style={styles.cardSubtitle}>Total commitment period</Text>
            </View>
          </View>

          <View style={styles.durationsGrid}>
            {activeDurations.map((dur) => {
              const active = selectedDurationCount === dur.count;
              return (
                <TouchableOpacity
                  key={dur.count}
                  style={[styles.durationChip, active && styles.durationChipActive]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedDurationCount(dur.count)}
                >
                  <Text style={[styles.durationChipText, active && styles.durationChipTextActive]}>
                    {dur.label}
                  </Text>
                  <Text style={[styles.durationChipSub, active && styles.durationChipSubActive]}>
                    {dur.sub}
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
            <Text style={styles.summaryLabel}>Frequency</Text>
            <Text style={[styles.summaryValue, { textTransform: 'capitalize' }]}>{selectedFrequency}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {selectedFrequency === 'daily'
                ? 'Daily Installment'
                : selectedFrequency === 'weekly'
                ? 'Weekly Installment'
                : 'Monthly Installment'}
            </Text>
            <Text style={styles.summaryValue}>₹{currentAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Schedule</Text>
            <Text style={styles.summaryValue}>
              {selectedFrequency === 'daily'
                ? 'Every day'
                : selectedFrequency === 'weekly'
                ? `Every ${selectedDayName}`
                : `${selectedMonthDate}th of every month`}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Installments</Text>
            <Text style={styles.summaryValue}>{selectedDurationCount} Contributions</Text>
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

            <Text style={styles.modalTitle}>Confirm {selectedFrequency.toUpperCase()} SIP Plan</Text>
            <Text style={styles.modalSubtitle}>
              You will contribute ₹{currentAmount.toLocaleString('en-IN')} {selectedFrequency === 'daily' ? 'every day' : selectedFrequency === 'weekly' ? `every ${selectedDayName}` : `every month on the ${selectedMonthDate}th`} for {selectedDurationCount} contributions.
            </Text>

            <View style={styles.modalBreakdown}>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalBreakdownLabel}>Frequency</Text>
                <Text style={[styles.modalBreakdownValue, { textTransform: 'capitalize' }]}>{selectedFrequency}</Text>
              </View>
              <View style={styles.modalBreakdownRow}>
                <Text style={styles.modalBreakdownLabel}>Per Contribution</Text>
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
      backgroundColor: themeColors.background || (isDark ? '#08120B' : '#F8FAFC'),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
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
      backgroundColor: isDark ? '#14291D' : '#DCFCE7',
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0',
    },
    bannerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? '#0E1E15' : '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#085428',
      marginBottom: 2,
    },
    bannerSubtitle: {
      fontSize: 12,
      color: isDark ? '#A7F3D0' : '#15803D',
      lineHeight: 16,
    },
    card: {
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
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
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    cardSubtitle: {
      fontSize: 12,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      marginTop: 2,
    },
    freqRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
    },
    freqChip: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: isDark ? '#14291D' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
      position: 'relative',
    },
    freqChipActive: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
      borderColor: '#085428',
    },
    freqChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
      marginTop: 4,
    },
    freqChipTextActive: {
      color: isDark ? '#34D399' : '#085428',
    },
    freqChipSub: {
      fontSize: 10,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      marginTop: 2,
    },
    freqChipSubActive: {
      color: isDark ? '#A7F3D0' : '#15803D',
      fontWeight: '600',
    },
    freqBadgeActive: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#085428',
      alignItems: 'center',
      justifyContent: 'center',
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
      backgroundColor: isDark ? '#14291D' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
      position: 'relative',
    },
    presetChipActive: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
      borderColor: '#085428',
    },
    presetChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    presetChipTextActive: {
      color: isDark ? '#34D399' : '#085428',
    },
    presetCheck: {
      position: 'absolute',
      top: 4,
      right: 4,
    },
    customLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      marginBottom: 6,
    },
    customInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#14291D' : '#F8FAFC',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 48,
    },
    customInputActive: {
      borderColor: '#085428',
      backgroundColor: isDark ? '#14291D' : '#FFFFFF',
    },
    rupeeSymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#94A3B8'),
      marginRight: 6,
    },
    customInput: {
      flex: 1,
      height: '100%',
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    dailyScheduleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#14291D' : '#F0FDF4',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0',
    },
    dailyScheduleTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#085428',
      marginBottom: 2,
    },
    dailyScheduleSub: {
      fontSize: 11,
      color: isDark ? '#A7F3D0' : '#166534',
      lineHeight: 15,
    },
    weekDaysGrid: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'space-between',
    },
    weekDayChip: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: isDark ? '#14291D' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    weekDayChipActive: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
      borderColor: '#085428',
    },
    weekDayText: {
      fontSize: 12,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    weekDayTextActive: {
      color: isDark ? '#34D399' : '#085428',
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
      backgroundColor: isDark ? '#14291D' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    dateChipActive: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
      borderColor: '#085428',
    },
    dateChipText: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    dateChipTextActive: {
      color: isDark ? '#34D399' : '#085428',
    },
    dateChipSub: {
      fontSize: 10,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#94A3B8'),
      marginTop: 2,
    },
    dateChipSubActive: {
      color: isDark ? '#A7F3D0' : '#15803D',
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
      backgroundColor: isDark ? '#14291D' : '#F1F5F9',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    durationChipActive: {
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
      borderColor: '#085428',
    },
    durationChipText: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    durationChipTextActive: {
      color: isDark ? '#34D399' : '#085428',
    },
    durationChipSub: {
      fontSize: 10,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#94A3B8'),
      marginTop: 2,
    },
    durationChipSubActive: {
      color: isDark ? '#A7F3D0' : '#15803D',
      fontWeight: '600',
    },
    summaryCard: {
      backgroundColor: isDark ? '#0E1E15' : '#F8FAFC',
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    summaryCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    summaryDivider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
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
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    summaryValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
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
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    },
    modalIconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 18,
    },
    modalBreakdown: {
      width: '100%',
      backgroundColor: isDark ? '#14291D' : '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
    },
    modalBreakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 4,
    },
    modalBreakdownLabel: {
      fontSize: 13,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    modalBreakdownValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    mandateNotice: {
      fontSize: 11,
      color: isDark ? '#FBBF24' : '#D97706',
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
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    modalCancelBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#E2E8F0' : '#0F172A',
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
