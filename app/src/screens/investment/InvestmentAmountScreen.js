import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../services/authService';
import { investmentService } from '../../services/investmentService';
import { colors, typography } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import KycRequiredModal from '../../components/KycRequiredModal';
import { kycService } from '../../services/kycService';

const InvestmentAmountScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const [amount, setAmount] = useState('');
  const [investmentType, setInvestmentType] = useState('1_year');
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [kycModalVisible, setKycModalVisible] = useState(false);

  useEffect(() => {
    loadUserData();
    loadPlans();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await authService.getUserData();
      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadPlans = async () => {
    try {
      const fetchedPlans = await investmentService.getPlans();
      setPlans(fetchedPlans);
      if (fetchedPlans && fetchedPlans.length > 0) {
        // Default to the 1 Year plan (last in the array usually)
        const yearPlan = fetchedPlans.find(p => p.id === '1_year') || fetchedPlans[fetchedPlans.length - 1];
        setInvestmentType(yearPlan.id);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      // Fallback config if API fails
      const fallbackPlans = [
        { id: '15_days', name: '15 Days Plan', durationDays: 15, interestRate: 12, label: '15 Days', desc: 'Locked for 15 days, 12% returns', icon: 'clock-outline' },
        { id: '1_month', name: '1 Month Plan', durationDays: 30, interestRate: 15, label: '1 Month', desc: 'Locked for 30 days, 15% returns', icon: 'calendar' },
        { id: '3_months', name: '3 Months Plan', durationDays: 90, interestRate: 18, label: '3 Months', desc: 'Locked for 90 days, 18% returns', icon: 'calendar-range' },
        { id: '6_months', name: '6 Months Plan', durationDays: 180, interestRate: 20, label: '6 Months', desc: 'Locked for 180 days, 20% returns', icon: 'calendar-clock' },
        { id: '1_year', name: '1 Year Plan', durationDays: 365, interestRate: 24, label: '1 Year', desc: 'Locked for 365 days, 24% returns', icon: 'lock' },
      ];
      setPlans(fallbackPlans);
      setInvestmentType('1_year');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleAmountChange = (text) => {
    const numericValue = text.replace(/[^\d.]/g, '');
    setAmount(numericValue);
  };

  const handleContinue = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) < 100) {
      Alert.alert('Error', 'Minimum investment amount is ₹100');
      return;
    }

    // KYC Check
    const isSubmitted = await kycService.isKYCSubmittedForInvestment();
    if (!isSubmitted) {
      setKycModalVisible(true);
      return;
    }

    if (!userData?.email) {
      setShowEmailModal(true);
      return;
    }

    navigation.navigate('InvestmentPayment', {
      amount: parseFloat(amount),
      type: investmentType,
      userData,
      selectedWithdrawalDate,
      benefitEligibilityDate: fifthWeekDate.toISOString(),
    });
  };

  const getSelectedPlan = () => {
    return plans.find(p => p.id === investmentType) || null;
  };

  const getInterestRate = () => {
    const plan = getSelectedPlan();
    return plan ? `${plan.interestRate}%` : '0%';
  };

  const getLockPeriod = () => {
    const plan = getSelectedPlan();
    return plan ? `${plan.durationDays} Days` : 'No lock period';
  };

  const calculateInterest = () => {
    const amt = parseFloat(amount) || 0;
    const plan = getSelectedPlan();
    if (!plan) return 0;
    const daily = (amt * plan.interestRate) / 100 / 365;
    return daily * plan.durationDays;
  };

  const calculateDailyInterest = () => {
    const amt = parseFloat(amount) || 0;
    const plan = getSelectedPlan();
    if (!plan) return 0;
    return (amt * plan.interestRate) / 100 / 365;
  };

  const calculateMaturityAmount = () => {
    const amt = parseFloat(amount) || 0;
    return amt + calculateInterest();
  };

  return (
    <View style={styles.container}>
      <TopBar title="New Investment" navigation={navigation} showBack={navigation?.canGoBack?.() ?? false} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Investment Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Investment Plan</Text>
          {loadingPlans ? (
            <ActivityIndicator size="large" color={themeColors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.typeCards}>
              {plans.map((plan) => {
                const isActive = investmentType === plan.id;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.typeCard,
                      isActive && styles.typeCardActive,
                      { borderColor: isActive ? themeColors.primary : themeColors.border }
                    ]}
                    activeOpacity={0.85}
                    onPress={() => setInvestmentType(plan.id)}
                  >
                    <View style={[styles.typeRadio, isActive && { borderColor: themeColors.primary }]}>
                      {isActive && <View style={[styles.typeRadioInner, { backgroundColor: themeColors.primary }]} />}
                    </View>
                    <View style={styles.typeContent}>
                      <Text style={styles.typeTitle}>{plan.name}</Text>
                      <Text style={styles.typeDesc}>{plan.desc}</Text>
                      <View style={[styles.typeRateBadge, { backgroundColor: themeColors.primaryLight }]}>
                        <Text style={[styles.typeRateText, { color: themeColors.primary }]}>{plan.interestRate}% Returns</Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name={plan.icon || 'lock'} size={32} color={themeColors.primary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Investment Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencyPrefix}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              mode="flat"
              keyboardType="numeric"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={themeColors.textTertiary}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              textColor={themeColors.text}
            />
          </View>
          <Text style={styles.minAmount}>Minimum: ₹100</Text>
        </View>

        {/* Intended Withdrawal Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Intended Withdrawal Date</Text>
          <View style={styles.datePickerRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Selected Withdrawal Date</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text, marginTop: 2 }}>
                {new Date(selectedWithdrawalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeDateBtn}
              onPress={() => setDatePickerModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-edit" size={20} color={themeColors.primary} />
              <Text style={{ color: themeColors.primary, fontWeight: '700', fontSize: 13, marginLeft: 4 }}>Change Date</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5-Week Benefit Rule Explanation Box */}
        <View style={styles.ruleCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="alert-decagram" size={20} color="#D97706" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: themeColors.text }}>Withdrawal & 5-Week Benefit Rule</Text>
          </View>
          
          <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
            • <Text style={{ fontWeight: '700', color: themeColors.text }}>Intended Withdrawal Date:</Text> {new Date(selectedWithdrawalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 8 }}>
            • <Text style={{ fontWeight: '700', color: themeColors.primary }}>5th-Week Benefit Eligibility Date:</Text> {fifthWeekDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>

          <View style={styles.ruleWarningBox}>
            <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 17 }}>
              ⚠️ <Text style={{ fontWeight: '700' }}>Important:</Text> If you withdraw BEFORE the 5th-week benefit eligibility date ({fifthWeekDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })), ONLY your original invested principal amount (₹{parseFloat(amount || 0).toLocaleString('en-IN')}) will be available for withdrawal. Interest/earnings and extra benefits will not be included.
            </Text>
            <Text style={{ fontSize: 12, color: '#065F46', lineHeight: 17, marginTop: 6 }}>
              ✓ If you wait until the 5th-week eligibility date ({fifthWeekDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) and complete the required 5th-week payment, your applicable interest, earnings, and benefits will become eligible for withdrawal.
            </Text>
          </View>
        </View>

        {/* Investment Summary */}
        {amount && parseFloat(amount) > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Investment Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Plan</Text>
              <Text style={[styles.summaryValue, { color: themeColors.primary, fontWeight: '700' }]}>
                {getSelectedPlan()?.name || 'Selected Plan'}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Investment Amount</Text>
              <Text style={styles.summaryAmount}>
                ₹{parseFloat(amount).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Interest Rate</Text>
              <Text style={[styles.summaryValue, { color: themeColors.success, fontWeight: '700' }]}>{getInterestRate()}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Investment Duration</Text>
              <Text style={styles.summaryValue}>{getLockPeriod()}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Interest</Text>
              <Text style={[styles.summaryValue, { color: themeColors.success, fontWeight: '700' }]}>
                ₹{calculateInterest().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Daily Interest</Text>
              <Text style={[styles.summaryValue, { color: themeColors.primary, fontWeight: '700' }]}>
                ₹{calculateDailyInterest().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / day
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Lock Period</Text>
              <Text style={styles.summaryValue}>{getLockPeriod()}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Withdrawal Available</Text>
              <Text style={[styles.summaryValue, { fontWeight: '700' }]}>After {getLockPeriod()}</Text>
            </View>

            <View style={styles.summaryHighlightRow}>
              <Text style={styles.summaryHighlightLabel}>Maturity Amount</Text>
              <Text style={[styles.summaryHighlightValue, { color: themeColors.success }]}>
                ₹{calculateMaturityAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        {/* Info Points */}
        <View style={styles.infoContainer}>
          {[
            { icon: 'check-circle', text: 'Interest calculated daily' },
            { icon: 'check-circle', text: 'No hidden charges' },
            { icon: 'check-circle', text: 'Secure and regulated' },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              <MaterialCommunityIcons name={item.icon} size={18} color={themeColors.success || colors.success} />
              <Text style={styles.infoText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, (!amount || parseFloat(amount) <= 0) && styles.continueBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleContinue}
          disabled={!amount || parseFloat(amount) <= 0}
        >
          <Text style={styles.continueBtnText}>Continue to Payment</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={themeColors.white || colors.white} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Email Required Modal */}
      <Modal visible={showEmailModal} transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Email Required</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary || colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>
              Your email address is required before making investments or payments. Please update your email in your Profile.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEmailModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtnOuter}
                onPress={() => {
                  setShowEmailModal(false);
                  navigation.navigate('Profile');
                }}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>Update Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* KYC Required Modal */}
      <KycRequiredModal
        visible={kycModalVisible}
        onClose={() => setKycModalVisible(false)}
        onNavigateToKYC={() => navigation.navigate('KYC')}
      />
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 14,
  },
  // Type Cards
  typeCards: {
    gap: 10,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...colors.shadow.card,
  },
  typeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeCardActiveFixed: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  typeContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  typeDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  typeRateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.savingLight,
  },
  typeRateText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.saving,
  },
  // Amount
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 64,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...colors.shadow.card,
  },
  currencyPrefix: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    height: 64,
    backgroundColor: 'transparent',
    padding: 0,
  },
  minAmount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    marginHorizontal: 4,
  },
  // Date Picker & Rule Card
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  ruleCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  ruleWarningBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  // Summary
  summaryContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...colors.shadow.card,
  },
  summaryTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },
  summaryHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: colors.successLight,
  },
  summaryHighlightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  summaryHighlightValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Info
  infoContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 10,
    fontWeight: '500',
  },
  // Continue Button
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    gap: 8,
    ...colors.shadow.button,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...colors.shadow.card,
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', backgroundColor: colors.surface, borderRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  modalText: { fontSize: 15, color: colors.textSecondary, marginBottom: 24, lineHeight: 22 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modalSaveBtnOuter: { flex: 1 },
  modalSaveGradient: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: colors.white },
});

export default InvestmentAmountScreen;