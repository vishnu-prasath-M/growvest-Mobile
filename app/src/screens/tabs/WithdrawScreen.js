import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { userService } from '../../services/userService';
import { withdrawalService } from '../../services/withdrawalService';
import { investmentService } from '../../services/investmentService';
import { colors } from '../../theme/theme';
import { mapProfileToWithdrawUser } from '../../utils/userBalances';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { Portal } from 'react-native-paper';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

const WithdrawScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawType, setWithdrawType] = useState('saving');
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [emailRequiredModalVisible, setEmailRequiredModalVisible] = useState(false);
  const [investments, setInvestments] = useState([]);

  const fetchUserData = async () => {
    try {
      const profile = await userService.getUserProfile();
      setUserData(mapProfileToWithdrawUser(profile));
      
      const allInvestments = await investmentService.getInvestments();
      const userInvestments = allInvestments.filter(inv =>
        inv.userEmail === profile.email || inv.mobileNumber === profile.mobileNumber
      );
      // Filter only duration-based investments
      const durationPlanTypes = ['15_days', '1_month', '3_months', '6_months', '1_year'];
      const durationInvests = userInvestments.filter(inv => durationPlanTypes.includes(inv.type));
      setInvestments(durationInvests);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPlanDisplayName = (type) => {
    if (type === 'saving') return 'Saving Deposit';
    if (type === 'fixed') return 'Fixed Deposit';
    if (type === '15_days') return '15 Days Plan';
    if (type === '1_month') return '1 Month Plan';
    if (type === '3_months') return '3 Months Plan';
    if (type === '6_months') return '6 Months Plan';
    if (type === '1_year') return '1 Year Plan';
    return 'Investment';
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  // Polling for auto-updating UI
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchUserData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const openWithdrawModal = (type) => {
    setWithdrawType(type);
    setAmount('');
    setUpiId('');
    setWithdrawModalVisible(true);
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    const availableBalance = withdrawType === 'saving' ? userData?.savingBalance : userData?.fixedBalance;
    if (parseFloat(amount) > availableBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    if (!upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }
    
    // Check if user has email before proceeding
    if (!userData?.email || !userData.email.trim()) {
      setWithdrawModalVisible(false);
      setEmailRequiredModalVisible(true);
      return;
    }
    
    setWithdrawing(true);
    try {
      await withdrawalService.createWithdrawal({
        amount: parseFloat(amount),
        upiId,
        userName: userData?.name || userData?.username,
        userEmail: userData?.email,
        withdrawType,
      });
      Alert.alert('Success', 'Withdrawal request submitted successfully');
      setWithdrawModalVisible(false);
      fetchUserData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit withdrawal request');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerPlaceholder, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.headerSub}>Withdraw</Text>
          <Text style={styles.headerTitle}>Move money out</Text>
        </View>
        <SkeletonLoader variant="form" />
      </View>
    );
  }

  const availableToWithdraw = userData?.availableToWithdraw || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.headerSub}>Withdraw</Text>
        <Text style={styles.headerTitle}>Move money out</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, colors.secondary]}
          />
        }
      >
        {/* Available Balance Hero Card */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBlobGold} />
            <Text style={styles.heroLabel}>Available Balance</Text>
            <Text style={styles.heroAmount}>{formatCurrency(availableToWithdraw)}</Text>
            <Text style={styles.heroNote}>Instant withdrawal • No fees</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12, marginTop: 12 }}>
              <View>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' }}>Savings</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F8FAF9' }}>{formatCurrency(userData?.savingBalance)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' }}>Chit Winning</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.gold }}>{formatCurrency(userData?.totalChitWinningAmount || userData?.winningAmount)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' }}>Fixed</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#F8FAF9' }}>{formatCurrency(userData?.fixedBalance)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Balance Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose account</Text>

          {/* Saving */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardLeft}>
              <View style={[styles.balanceIconBox, { backgroundColor: colors.successLight }]}>
                <MaterialCommunityIcons name="piggy-bank" size={24} color={colors.success} />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceCardLabel}>Saving Balance</Text>
                <Text style={styles.balanceCardAmount}>{formatCurrency(userData?.savingBalance)}</Text>
                <Text style={styles.balanceCardRate}>Withdraw anytime</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.withdrawActionBtn}
              activeOpacity={0.85}
              onPress={() => openWithdrawModal('saving')}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.withdrawActionGradient}
              >
                <Text style={styles.withdrawActionText}>Withdraw</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Fixed */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceCardLeft}>
              <View style={[styles.balanceIconBox, { backgroundColor: colors.primaryLight }]}>
                <MaterialCommunityIcons name="lock-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceCardLabel}>Fixed Balance</Text>
                <Text style={styles.balanceCardAmount}>{formatCurrency(userData?.fixedBalance)}</Text>
                <Text style={styles.balanceCardRate}>After lock period</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.withdrawActionBtn}
              activeOpacity={0.85}
              onPress={() => openWithdrawModal('fixed')}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.withdrawActionGradient}
              >
                <Text style={styles.withdrawActionText}>Withdraw</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Duration-based Plans Status */}
        {investments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Duration Investment Plans</Text>
            {investments.map((inv) => {
              const isMatured = new Date() >= new Date(inv.maturityDate);
              const totalInterest = inv.totalInterest || (inv.amount * inv.interestRate / 100);
              const totalVal = inv.amount + totalInterest;
              return (
                <View key={inv._id} style={styles.planStatusCard}>
                  <View style={styles.planStatusTop}>
                    <View style={styles.planStatusInfo}>
                      <Text style={styles.planStatusName}>{getPlanDisplayName(inv.type)}</Text>
                      <Text style={styles.planStatusSub}>
                        {formatCurrency(inv.amount)} + {formatCurrency(totalInterest)} Interest
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, isMatured ? styles.statusBadgeMatured : styles.statusBadgeLocked]}>
                      <MaterialCommunityIcons name={isMatured ? 'check-circle' : 'lock'} size={14} color={isMatured ? '#065F46' : '#B45309'} />
                      <Text style={[styles.statusBadgeText, { color: isMatured ? '#065F46' : '#B45309' }]}>
                        {isMatured ? 'Matured' : 'Locked'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.planStatusDivider} />
                  <Text style={styles.planStatusFooter}>
                    {isMatured 
                      ? 'Withdrawal Available (Merged in Saving Balance)' 
                      : `Withdrawal available after ${new Date(inv.maturityDate).toLocaleDateString('en-IN')}`
                    }
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
          <Text style={styles.securityText}>Protected by 256-bit encryption. Funds arrive within 24-48 hours.</Text>
        </View>

        {/* Rules Card */}
        <View style={styles.rulesCard}>
          <View style={styles.rulesHeader}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
            <Text style={styles.rulesTitle}>Withdrawal Rules</Text>
          </View>
          {[
            'Saving deposits: Withdraw anytime',
            'Fixed deposits: Withdraw after 1 year lock period',
            'Withdrawals processed within 24-48 hours',
          ].map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <View style={styles.ruleDot} />
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrapper}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setWithdrawModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                Withdraw from {withdrawType === 'saving' ? 'Saving' : 'Fixed'}
              </Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Balance display */}
            <View style={styles.modalBalanceBox}>
              <Text style={styles.modalBalanceLabel}>Available Balance</Text>
              <Text style={styles.modalBalanceAmount}>
                {formatCurrency(withdrawType === 'saving' ? userData?.savingBalance : userData?.fixedBalance)}
              </Text>
            </View>

            {/* Amount input */}
            <Text style={styles.inputLabel}>Amount to Withdraw</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.border}
              />
            </View>

            {/* Quick amounts */}
            <View style={styles.quickAmountRow}>
              {QUICK_AMOUNTS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.quickAmountChip}
                  onPress={() => setAmount(String(q))}
                >
                  <Text style={styles.quickAmountText}>+₹{q.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* UPI input */}
            <Text style={[styles.inputLabel, { marginTop: 16 }]}>UPI ID</Text>
            <View style={styles.upiInputRow}>
              <MaterialCommunityIcons name="bank" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.upiInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="yourname@upi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setWithdrawModalVisible(false)}
                disabled={withdrawing}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtnOuter, withdrawing && styles.submitBtnDisabled]}
                onPress={handleWithdraw}
                disabled={withdrawing}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtnGradient}
                >
                  {!withdrawing && <MaterialCommunityIcons name="check-circle" size={18} color={colors.white} />}
                  <Text style={styles.submitBtnText}>{withdrawing ? 'Processing...' : 'Submit'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Required Modal */}
      <Modal
        visible={emailRequiredModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailRequiredModalVisible(false)}
      >
        <View style={styles.modalWrapper}>
          <View style={styles.modalOverlay} onTouchStart={() => setEmailRequiredModalVisible(false)} />
          <View style={styles.emailModalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.emailModalContent}>
              <MaterialCommunityIcons name="email-alert" size={48} color={colors.warning} style={styles.emailModalIcon} />
              <Text style={styles.emailModalTitle}>Email Required</Text>
              <Text style={styles.emailModalText}>
                An email address is required to submit a withdrawal request.
              </Text>
              <Text style={styles.emailModalSubText}>
                Please update your email in your Profile before continuing.
              </Text>
              <View style={styles.emailModalActions}>
                <TouchableOpacity
                  style={styles.emailModalCancelBtn}
                  onPress={() => setEmailRequiredModalVisible(false)}
                >
                  <Text style={styles.emailModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.emailModalUpdateBtn}
                  onPress={() => {
                    setEmailRequiredModalVisible(false);
                    navigation.navigate('Profile');
                  }}
                >
                  <LinearGradient
                    colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emailModalUpdateBtnGradient}
                  >
                    <Text style={styles.emailModalUpdateText}>Update Profile</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
  scrollContent: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },
  headerPlaceholder: { paddingHorizontal: 20, paddingBottom: 16 },

  // Page Header
  pageHeader: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.background },
  headerSub: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.8, marginTop: 2 },

  // Hero Card
  heroOuter: { marginHorizontal: 20, marginBottom: 8 },
  heroCard: {
    borderRadius: 28, padding: 24, overflow: 'hidden',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28, shadowRadius: 40, elevation: 20,
  },
  heroBlobGold: {
    position: 'absolute', bottom: -30, right: -20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(212,168,67,0.18)',
  },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' },
  heroAmount: { fontSize: 38, fontWeight: '800', color: '#F8FAF9', letterSpacing: -1.5, marginTop: 8 },
  heroNote: { fontSize: 12, color: colors.gold, fontWeight: '600', marginTop: 6 },

  // Section
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 },

  // Balance Cards
  balanceCard: {
    backgroundColor: colors.surface, borderRadius: 20,
    padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  balanceCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  balanceIconBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  balanceInfo: { flex: 1 },
  balanceCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  balanceCardAmount: { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 2 },
  balanceCardRate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  withdrawActionBtn: { marginLeft: 12 },
  withdrawActionGradient: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  withdrawActionText: { fontSize: 13, fontWeight: '700', color: '#F8FAF9' },

  // Security Notice
  securityNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: colors.accent, borderRadius: 14,
    padding: 12,
  },
  securityText: { flex: 1, fontSize: 12, color: colors.accentFg, lineHeight: 17 },

  // Rules Card
  rulesCard: {
    margin: 16, backgroundColor: colors.surface, borderRadius: 20, padding: 16,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rulesTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  ruleDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.primary, marginTop: 6, marginRight: 10,
  },
  ruleText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  // Modal
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20,
  },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center',
  },
  modalBalanceBox: {
    backgroundColor: colors.primaryLight, borderRadius: 14,
    padding: 14, marginBottom: 20,
  },
  modalBalanceLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  modalBalanceAmount: { fontSize: 22, fontWeight: '700', color: colors.primary, letterSpacing: -0.5, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  amountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 14,
    paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: colors.border,
    marginBottom: 12,
  },
  currencySymbol: { fontSize: 22, fontWeight: '700', color: colors.textSecondary, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text, padding: 0 },
  quickAmountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAmountChip: {
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  quickAmountText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  upiInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 14,
    paddingHorizontal: 14, height: 50,
    borderWidth: 1.5, borderColor: colors.border, gap: 8,
  },
  upiInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  submitBtnOuter: { flex: 1.5 },
  submitBtnGradient: {
    height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8,
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  // Email Required Modal
  emailModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  emailModalContent: { alignItems: 'center', paddingTop: 10 },
  emailModalIcon: { marginBottom: 16 },
  emailModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emailModalText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  emailModalSubText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  emailModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  emailModalCancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  emailModalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  emailModalUpdateBtn: { flex: 1.5 },
  emailModalUpdateBtnGradient: {
    height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  emailModalUpdateText: { fontSize: 15, fontWeight: '700', color: colors.white },
  
  // Plan Status Cards
  planStatusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...colors.shadow.card,
  },
  planStatusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planStatusInfo: {
    flex: 1,
  },
  planStatusName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  planStatusSub: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusBadgeMatured: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeLocked: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  planStatusDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  planStatusFooter: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default WithdrawScreen;