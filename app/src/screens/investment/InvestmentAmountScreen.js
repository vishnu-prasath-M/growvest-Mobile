import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../services/authService';
import { colors, typography } from '../../theme/theme';
import TopBar from '../../components/TopBar';

const InvestmentAmountScreen = ({ navigation, route }) => {
  const [amount, setAmount] = useState('');
  const [investmentType, setInvestmentType] = useState('saving');
  const [userData, setUserData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
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

  const formatCurrency = (value) => {
    if (!value) return '₹0';
    const numValue = parseFloat(value.replace(/[^\d.]/g, ''));
    return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleAmountChange = (text) => {
    const numericValue = text.replace(/[^\d.]/g, '');
    setAmount(numericValue);
  };

  const handleContinue = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) < 1000) {
      Alert.alert('Error', 'Minimum investment amount is ₹1,000');
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
    });
  };

  const getInterestRate = () => {
    return investmentType === 'fixed' ? '24% p.a.' : '12% p.a.';
  };

  const getLockPeriod = () => {
    return investmentType === 'fixed' ? '1 year' : 'No lock period';
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
          <Text style={styles.sectionTitle}>Investment Type</Text>
          <View style={styles.typeCards}>
            <TouchableOpacity
              style={[
                styles.typeCard,
                investmentType === 'saving' && styles.typeCardActive,
                { borderColor: investmentType === 'saving' ? colors.saving : colors.border }
              ]}
              activeOpacity={0.85}
              onPress={() => setInvestmentType('saving')}
            >
              <View style={[styles.typeRadio, investmentType === 'saving' && { borderColor: colors.saving }]}>
                {investmentType === 'saving' && <View style={[styles.typeRadioInner, { backgroundColor: colors.saving }]} />}
              </View>
              <View style={styles.typeContent}>
                <Text style={styles.typeTitle}>Saving Deposit</Text>
                <Text style={styles.typeDesc}>Flexible withdrawals, 12% p.a.</Text>
                <View style={styles.typeRateBadge}>
                  <Text style={styles.typeRateText}>12% p.a.</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="piggy-bank" size={32} color={colors.saving} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeCard,
                investmentType === 'fixed' && styles.typeCardActiveFixed,
                { borderColor: investmentType === 'fixed' ? colors.fixed : colors.border }
              ]}
              activeOpacity={0.85}
              onPress={() => setInvestmentType('fixed')}
            >
              <View style={[styles.typeRadio, investmentType === 'fixed' && { borderColor: colors.fixed }]}>
                {investmentType === 'fixed' && <View style={[styles.typeRadioInner, { backgroundColor: colors.fixed }]} />}
              </View>
              <View style={styles.typeContent}>
                <Text style={styles.typeTitle}>Fixed Deposit</Text>
                <Text style={styles.typeDesc}>1-year lock period, 24% p.a.</Text>
                <View style={[styles.typeRateBadge, { backgroundColor: colors.fixedLight }]}>
                  <Text style={[styles.typeRateText, { color: colors.fixed }]}>24% p.a.</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="lock" size={32} color={colors.fixed} />
            </TouchableOpacity>
          </View>
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
              placeholderTextColor={colors.border}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
            />
          </View>
          <Text style={styles.minAmount}>Minimum: ₹1,000</Text>
        </View>

        {/* Investment Summary */}
        {amount && parseFloat(amount) > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Investment Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={[styles.summaryValue, { 
                color: investmentType === 'saving' ? colors.saving : colors.fixed 
              }]}>
                {investmentType === 'saving' ? 'Saving Deposit' : 'Fixed Deposit'}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryAmount}>
                ₹{parseFloat(amount).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Interest Rate</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{getInterestRate()}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Lock Period</Text>
              <Text style={styles.summaryValue}>{getLockPeriod()}</Text>
            </View>

            <View style={styles.summaryHighlightRow}>
              <Text style={styles.summaryHighlightLabel}>Expected Returns (1 year)</Text>
              <Text style={[styles.summaryHighlightValue, { color: colors.success }]}>
                +₹{((parseFloat(amount) * (investmentType === 'fixed' ? 0.24 : 0.12)).toFixed(0)).toLocaleString('en-IN')}
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
              <MaterialCommunityIcons name={item.icon} size={18} color={colors.success} />
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
          <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />
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
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
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
    </View>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: 14,
  },
  // Type Cards
  typeCards: {
    gap: 10,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    ...colors.shadow.card,
  },
  typeCardActive: {
    borderColor: colors.saving,
    backgroundColor: '#f0fdf4',
  },
  typeCardActiveFixed: {
    borderColor: colors.fixed,
    backgroundColor: '#f0fdf4',
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
    backgroundColor: colors.white,
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
    color: colors.textTertiary,
    marginTop: 8,
    fontWeight: '500',
  },
  // Summary
  summaryContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    ...colors.shadow.card,
  },
  summaryTitle: {
    ...typography.h4,
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