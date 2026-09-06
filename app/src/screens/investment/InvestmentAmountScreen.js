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
  Platform,
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
  
  const initialPlan = route.params?.initialPlan || route.params?.type || null;
  const initialAmount = route.params?.initialAmount || (route.params?.amount ? String(route.params.amount) : '');

  const [amount, setAmount] = useState(initialAmount);
  const [investmentType, setInvestmentType] = useState(initialPlan || '1_year');
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [kycStatusInfo, setKycStatusInfo] = useState({ status: 'not_submitted', rejectionReason: null });

  // Date-based withdrawal & 5-week benefit eligibility dates
  const today = new Date();
  const defaultWithdrawalDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
  const fifthWeekDate = new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000);

  const [selectedWithdrawalDate, setSelectedWithdrawalDate] = useState(defaultWithdrawalDate.toISOString().split('T')[0]);
  const [customDaysInput, setCustomDaysInput] = useState('365');
  const [datePickerModalVisible, setDatePickerModalVisible] = useState(false);

  useEffect(() => {
    loadUserData();
    loadPlans();
  }, []);

  useEffect(() => {
    if (route.params?.initialPlan) {
      setInvestmentType(route.params.initialPlan);
    }
    if (route.params?.initialAmount) {
      setAmount(String(route.params.initialAmount));
    }
  }, [route.params]);

  // Synchronize withdrawal date whenever investment plan changes
  useEffect(() => {
    if (plans.length > 0) {
      const plan = plans.find(p => p.id === investmentType);
      const days = plan?.durationDays || 365;
      const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      setSelectedWithdrawalDate(targetDate.toISOString().split('T')[0]);
      setCustomDaysInput(String(days));
    }
  }, [investmentType, plans]);

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
        if (!initialPlan) {
          const yearPlan = fetchedPlans.find(p => p.id === '1_year') || fetchedPlans[fetchedPlans.length - 1];
          setInvestmentType(yearPlan.id);
        }
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
      if (!initialPlan) setInvestmentType('1_year');
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

    const chosenDate = new Date(selectedWithdrawalDate);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    if (isNaN(chosenDate.getTime()) || chosenDate < todayMidnight) {
      Alert.alert('Invalid Date', 'Please choose a valid intended withdrawal date.');
      return;
    }

    // KYC Check — must be approved before investing
    const kycCheck = await kycService.checkInvestmentKYC();
    if (!kycCheck.allowed) {
      setKycStatusInfo({ status: kycCheck.status, rejectionReason: kycCheck.rejectionReason });
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
      intendedWithdrawalDate: selectedWithdrawalDate,
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
          <Text style={styles.sectionTitle}>Intended Withdrawal Timeline</Text>
          <TouchableOpacity
            style={styles.datePickerRowModern}
            onPress={() => setDatePickerModalVisible(true)}
            activeOpacity={0.88}
          >
            <View style={styles.datePickerIconBox}>
              <MaterialCommunityIcons name="calendar-clock" size={22} color={themeColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.datePickerLabel}>Target Withdrawal Date</Text>
              <Text style={styles.datePickerValue}>
                {new Date(selectedWithdrawalDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={styles.datePickerSub}>
                {(() => {
                  const selectedPlan = getSelectedPlan();
                  const maxDays = selectedPlan?.durationDays || 365;
                  const maturityDate = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
                  const isEarly = new Date(selectedWithdrawalDate) < new Date(maturityDate.toDateString());
                  return isEarly ? '⚡ Early Exit • Principal Only' : '💎 Full Maturity • Principal + Interest';
                })()}
              </Text>
            </View>
            <View style={styles.changeDateBtnModern}>
              <MaterialCommunityIcons name="calendar-edit" size={16} color={themeColors.primary} />
              <Text style={styles.changeDateBtnText}>Change</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Dynamic Plan Withdrawal Rule Policy Card */}
        {(() => {
          const selectedPlan = getSelectedPlan();
          const maxDays = selectedPlan?.durationDays || 365;
          const maturityDate = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
          const formattedMaturityDate = maturityDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          const formattedWithdrawalDate = new Date(selectedWithdrawalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          const isEarlyWithdrawal = new Date(selectedWithdrawalDate) < new Date(maturityDate.toDateString());
          const hasAmount = amount && parseFloat(amount) > 0;
          const formattedAmountText = hasAmount ? ` (₹${parseFloat(amount).toLocaleString('en-IN')})` : '';

          return (
            <View style={[
              styles.policyCardContainer,
              { backgroundColor: isEarlyWithdrawal ? '#FFFBEB' : '#ECFDF5', borderColor: isEarlyWithdrawal ? '#FDE68A' : '#A7F3D0' }
            ]}>
              <View style={styles.policyCardHeader}>
                <MaterialCommunityIcons 
                  name={isEarlyWithdrawal ? "alert-circle" : "check-decagram"} 
                  size={20} 
                  color={isEarlyWithdrawal ? "#D97706" : "#059669"} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={[styles.policyCardTitle, { color: isEarlyWithdrawal ? '#92400E' : '#065F46' }]}>
                  {isEarlyWithdrawal ? 'Early Exit Policy' : 'Maturity Payout Policy'}
                </Text>
              </View>

              <View style={styles.policyRowItem}>
                <MaterialCommunityIcons name="shield-lock-outline" size={16} color={isEarlyWithdrawal ? '#D97706' : '#059669'} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={[styles.policyRowText, { color: isEarlyWithdrawal ? '#92400E' : '#065F46' }]}>
                  <Text style={{ fontWeight: '700' }}>Lock Period:</Text> Locked until <Text style={{ fontWeight: '700' }}>{formattedWithdrawalDate}</Text>. Funds cannot be withdrawn prior.
                </Text>
              </View>

              <View style={styles.policyRowItem}>
                <MaterialCommunityIcons name={isEarlyWithdrawal ? "cash-refund" : "cash-multiple"} size={16} color={isEarlyWithdrawal ? '#D97706' : '#059669'} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={[styles.policyRowText, { color: isEarlyWithdrawal ? '#92400E' : '#065F46' }]}>
                  <Text style={{ fontWeight: '700' }}>Payout Eligibility:</Text> {isEarlyWithdrawal
                    ? `You will only receive your original principal amount${formattedAmountText}. Interest returns are not eligible on early exit.`
                    : `You will receive your full principal${formattedAmountText} + full ${selectedPlan?.interestRate}% interest returns upon completion (${formattedMaturityDate}).`}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Investment Summary */}
        {amount && parseFloat(amount) > 0 && (() => {
          const selectedPlan = getSelectedPlan();
          const maxDays = selectedPlan?.durationDays || 365;
          const maturityDate = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
          const isEarlyWithdrawal = new Date(selectedWithdrawalDate) < new Date(maturityDate.toDateString());

          return (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Investment Summary</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Selected Plan</Text>
                <Text style={[styles.summaryValue, { color: themeColors.primary, fontWeight: '700' }]}>
                  {selectedPlan?.name || 'Selected Plan'}
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
                <Text style={styles.summaryLabel}>Start Date</Text>
                <Text style={styles.summaryValue}>
                  {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Intended Withdrawal Date</Text>
                <Text style={[styles.summaryValue, { color: isEarlyWithdrawal ? '#D97706' : '#059669', fontWeight: '700' }]}>
                  {new Date(selectedWithdrawalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Plan Duration</Text>
                <Text style={styles.summaryValue}>{maxDays} Days</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Maturity Date</Text>
                <Text style={[styles.summaryValue, { fontWeight: '700', color: themeColors.primary }]}>
                  {maturityDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Interest Rate</Text>
                <Text style={[styles.summaryValue, { color: themeColors.success, fontWeight: '700' }]}>{getInterestRate()}</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Expected Interest</Text>
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

              <View style={[styles.summaryRow, { alignItems: 'flex-start' }]}>
                <Text style={styles.summaryLabel}>Withdrawal Eligibility</Text>
                <Text style={[styles.summaryValue, { color: isEarlyWithdrawal ? '#D97706' : '#059669', fontWeight: '700' }]}>
                  {isEarlyWithdrawal ? 'Early: Principal Only' : 'Full Return (Principal + Interest)'}
                </Text>
              </View>

              <View style={styles.summaryHighlightRow}>
                <Text style={styles.summaryHighlightLabel}>Maturity Amount</Text>
                <Text style={[styles.summaryHighlightValue, { color: themeColors.success }]}>
                  ₹{calculateMaturityAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          );
        })()}

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

      {/* Intended Withdrawal Date Selection Bottom Sheet Modal */}
      <Modal visible={datePickerModalVisible} transparent animationType="slide" onRequestClose={() => setDatePickerModalVisible(false)}>
        <View style={styles.modalBottomSheetOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject} 
            activeOpacity={1} 
            onPress={() => setDatePickerModalVisible(false)} 
          />
          <View style={styles.modalBottomSheetCard}>
            {/* Sheet Handle */}
            <View style={styles.modalSheetHandle} />

            {/* Header */}
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Choose Withdrawal Date</Text>
                <Text style={styles.modalSheetSubtitle}>Select when to unlock your funds</Text>
              </View>
              <TouchableOpacity onPress={() => setDatePickerModalVisible(false)} style={styles.modalSheetCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {(() => {
                const selectedPlan = getSelectedPlan();
                const maxDays = selectedPlan?.durationDays || 365;
                const currentDaysVal = Math.max(1, Math.min(maxDays, parseInt(customDaysInput, 10) || maxDays));
                const targetDateObj = new Date(today.getTime() + currentDaysVal * 24 * 60 * 60 * 1000);
                const formattedTargetDate = targetDateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                const isEarly = currentDaysVal < maxDays;
                const hasAmt = amount && parseFloat(amount) > 0;
                const numAmt = hasAmt ? parseFloat(amount) : 0;
                const formattedAmt = hasAmt ? `₹${numAmt.toLocaleString('en-IN')}` : '₹0.00';
                const estimatedInterest = hasAmt ? ((numAmt * (selectedPlan?.interestRate || 0)) / 100 / 365) * maxDays : 0;
                const formattedInterest = `₹${estimatedInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

                // Presets
                let presets = [];
                if (maxDays <= 15) presets = [5, 10, 15];
                else if (maxDays <= 30) presets = [7, 15, 21, 30];
                else if (maxDays <= 90) presets = [15, 30, 60, 90];
                else if (maxDays <= 180) presets = [30, 60, 120, 180];
                else presets = [30, 90, 180, 270, 365];

                return (
                  <View>
                    {/* Hero Card: Selected Date & Payout Matrix */}
                    <LinearGradient
                      colors={['#0E3D23', '#164E2D']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalHeroCard}
                    >
                      <View style={styles.modalHeroTopRow}>
                        <Text style={styles.modalHeroTag}>TARGET WITHDRAWAL DATE</Text>
                        <View style={[
                          styles.modalHeroBadge,
                          { backgroundColor: isEarly ? '#FEF3C7' : '#DCFCE7' }
                        ]}>
                          <MaterialCommunityIcons 
                            name={isEarly ? 'lightning-bolt' : 'check-decagram'} 
                            size={12} 
                            color={isEarly ? '#92400E' : '#065F46'} 
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[
                            styles.modalHeroBadgeText,
                            { color: isEarly ? '#92400E' : '#065F46' }
                          ]}>
                            {isEarly ? `Day ${currentDaysVal} (Early Exit)` : `${maxDays} Days (Maturity)`}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.modalHeroDateText}>
                        {formattedTargetDate}
                      </Text>

                      <View style={styles.modalHeroDivider} />

                      <View style={styles.modalHeroMetricsRow}>
                        <View style={styles.modalHeroMetricCol}>
                          <Text style={styles.modalHeroMetricLabel}>PRINCIPAL RETURN</Text>
                          <Text style={styles.modalHeroMetricValue}>{formattedAmt}</Text>
                          <Text style={styles.modalHeroMetricSubGreen}>✓ 100% Eligible</Text>
                        </View>

                        <View style={styles.modalHeroMetricDivider} />

                        <View style={styles.modalHeroMetricCol}>
                          <Text style={styles.modalHeroMetricLabel}>INTEREST RETURN</Text>
                          <Text style={styles.modalHeroMetricValue}>
                            {isEarly ? '₹0.00' : formattedInterest}
                          </Text>
                          <Text style={isEarly ? styles.modalHeroMetricSubAmber : styles.modalHeroMetricSubGreen}>
                            {isEarly ? `Locked (${maxDays}d term)` : '✓ Full Interest'}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>

                    {/* Section 1: Quick Select Duration Pills (Horizontal Scroll - Never Wraps or Stretches) */}
                    <Text style={styles.modalSectionTitle}>QUICK SELECT DURATION</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.modalPresetsScrollContent}
                    >
                      {presets.map((days) => {
                        const isSel = currentDaysVal === days;
                        const isMaturity = days >= maxDays;
                        return (
                          <TouchableOpacity
                            key={days}
                            style={[
                              styles.modalPresetPill,
                              isSel ? styles.modalPresetPillActive : styles.modalPresetPillInactive
                            ]}
                            activeOpacity={0.8}
                            onPress={() => {
                              setCustomDaysInput(String(days));
                              const d = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
                              setSelectedWithdrawalDate(d.toISOString().split('T')[0]);
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[
                                styles.modalPresetPillDays,
                                isSel ? { color: '#FFFFFF' } : { color: themeColors.text }
                              ]}>
                                {days} Days
                              </Text>
                              {isSel && (
                                <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" style={{ marginLeft: 3 }} />
                              )}
                            </View>
                            <Text style={[
                              styles.modalPresetPillSub,
                              isSel ? { color: '#A7F3D0' } : { color: themeColors.textTertiary }
                            ]}>
                              {isMaturity ? 'Full Maturity' : 'Early Exit'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Section 2: Custom Day Stepper & Visual Progress Slider */}
                    <Text style={styles.modalSectionTitle}>OR ADJUST NUMBER OF DAYS</Text>
                    <View style={styles.modalStepperContainer}>
                      <View style={styles.modalStepperRow}>
                        <TouchableOpacity
                          style={[
                            styles.modalStepperCircleBtn,
                            currentDaysVal <= 1 && styles.modalStepperCircleBtnDisabled
                          ]}
                          disabled={currentDaysVal <= 1}
                          onPress={() => {
                            const nextVal = Math.max(1, currentDaysVal - 1);
                            setCustomDaysInput(String(nextVal));
                            const d = new Date(today.getTime() + nextVal * 24 * 60 * 60 * 1000);
                            setSelectedWithdrawalDate(d.toISOString().split('T')[0]);
                          }}
                        >
                          <MaterialCommunityIcons 
                            name="minus" 
                            size={20} 
                            color={currentDaysVal <= 1 ? '#94A3B8' : '#0E3D23'} 
                          />
                        </TouchableOpacity>

                        <View style={styles.modalStepperCenterInfo}>
                          <Text style={styles.modalStepperDaysBig}>{currentDaysVal} Days</Text>
                          <Text style={styles.modalStepperHintText}>Min 1 Day • Max {maxDays} Days</Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.modalStepperCircleBtn,
                            currentDaysVal >= maxDays && styles.modalStepperCircleBtnDisabled
                          ]}
                          disabled={currentDaysVal >= maxDays}
                          onPress={() => {
                            const nextVal = Math.min(maxDays, currentDaysVal + 1);
                            setCustomDaysInput(String(nextVal));
                            const d = new Date(today.getTime() + nextVal * 24 * 60 * 60 * 1000);
                            setSelectedWithdrawalDate(d.toISOString().split('T')[0]);
                          }}
                        >
                          <MaterialCommunityIcons 
                            name="plus" 
                            size={20} 
                            color={currentDaysVal >= maxDays ? '#94A3B8' : '#0E3D23'} 
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Visual Timeline Track */}
                      <View style={styles.modalTimelineTrack}>
                        <View style={[styles.modalTimelineFill, { width: `${Math.min(100, Math.max(0, (currentDaysVal / maxDays) * 100))}%` }]} />
                      </View>
                    </View>

                    {/* Section 3: Simple, Clear Policy Note */}
                    <View style={[
                      styles.modalPolicyNoticeBox,
                      { backgroundColor: isEarly ? '#FFFBEB' : '#ECFDF5', borderColor: isEarly ? '#FDE68A' : '#A7F3D0' }
                    ]}>
                      <MaterialCommunityIcons
                        name={isEarly ? 'information' : 'shield-check'}
                        size={18}
                        color={isEarly ? '#D97706' : '#059669'}
                        style={{ marginRight: 8, marginTop: 1 }}
                      />
                      <Text style={[
                        styles.modalPolicyNoticeText,
                        { color: isEarly ? '#92400E' : '#065F46' }
                      ]}>
                        {isEarly ? (
                          <>
                            <Text style={{ fontWeight: '700' }}>Early Exit Rule:</Text> Withdrawing on {formattedTargetDate} unlocks your <Text style={{ fontWeight: '700' }}>full principal amount ({formattedAmt})</Text>. Interest returns require keeping the investment for full {maxDays} days.
                          </>
                        ) : (
                          <>
                            <Text style={{ fontWeight: '700' }}>Full Maturity Reward:</Text> You will receive your <Text style={{ fontWeight: '700' }}>100% principal ({formattedAmt}) + full {selectedPlan?.interestRate}% returns ({formattedInterest})</Text> on {formattedTargetDate}!
                          </>
                        )}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.modalSheetConfirmBtn}
              activeOpacity={0.88}
              onPress={() => {
                const selectedPlan = getSelectedPlan();
                const maxDays = selectedPlan?.durationDays || 365;
                const currentDaysVal = Math.max(1, Math.min(maxDays, parseInt(customDaysInput, 10) || maxDays));
                const targetDateObj = new Date(today.getTime() + currentDaysVal * 24 * 60 * 60 * 1000);
                setSelectedWithdrawalDate(targetDateObj.toISOString().split('T')[0]);
                setDatePickerModalVisible(false);
              }}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalSheetConfirmGradient}
              >
                <Text style={styles.modalSheetConfirmText}>Confirm Timeline</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
        status={kycStatusInfo.status}
        rejectionReason={kycStatusInfo.rejectionReason}
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
  // Date Picker Trigger & Policy Card Modern
  datePickerRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom:16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...colors.shadow.card,
  },
  datePickerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  datePickerLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  datePickerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  datePickerSub: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
    marginTop: 2,
  },
  changeDateBtnModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    gap: 4,
  },
  changeDateBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },

  // Policy Card Modern
  policyCardContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  policyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  policyCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  policyRowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  policyRowText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
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
    paddingVertical: 5,
    gap: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 0,
    maxWidth: '48%',
  },
  summaryValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  summaryAmount: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
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

  // Modern Bottom Sheet Modal Styles
  modalBottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBottomSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: '92%',
    ...colors.shadow.card,
  },
  modalSheetHandle: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalSheetSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  modalSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Hero Gradient Card
  modalHeroCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalHeroTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 0.5,
  },
  modalHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  modalHeroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  modalHeroDateText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  modalHeroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  modalHeroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeroMetricCol: {
    flex: 1,
  },
  modalHeroMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#A7F3D0',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  modalHeroMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  modalHeroMetricSubGreen: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6EE7B7',
    marginTop: 1,
  },
  modalHeroMetricSubAmber: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FDE68A',
    marginTop: 1,
  },
  modalHeroMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 12,
  },

  // Section Titles
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Horizontal Presets Scroll
  modalPresetsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    marginBottom: 16,
  },
  modalPresetPill: {
    width: 100,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPresetPillActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalPresetPillInactive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalPresetPillDays: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalPresetPillSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // Custom Stepper Container & Visual Timeline
  modalStepperContainer: {
    backgroundColor: colors.background,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 14,
  },
  modalStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalStepperCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...colors.shadow.card,
  },
  modalStepperCircleBtnDisabled: {
    opacity: 0.35,
  },
  modalStepperCenterInfo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStepperDaysBig: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalStepperHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
    marginTop: 2,
  },
  modalTimelineTrack: {
    height: 6,
    backgroundColor: colors.surface2 || '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  modalTimelineFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },

  // Policy Notice Box
  modalPolicyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalPolicyNoticeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },

  // Sheet Confirm Button
  modalSheetConfirmBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  modalSheetConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  modalSheetConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  // Email Modal
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