import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { colors } from '../../theme/theme';
import { sipService } from '../../services/sipService';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { openRazorpayCheckout } from '../../services/razorpayHandler';

const SIPDetailsScreen = ({ route, navigation }) => {
  const { sipId, sipRefId } = route.params || {};
  const { colors: themeColors, isDark } = useTheme();
  const insets = useScreenInsets(16);
  const styles = React.useMemo(() => getStyles(themeColors, isDark), [themeColors, isDark]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sip, setSip] = useState(null);
  const [contributions, setContributions] = useState([]);

  // Withdrawal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawUpi, setWithdrawUpi] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Cancel state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Installment payment state
  const [payingContributionId, setPayingContributionId] = useState(null);

  const loadSIPDetails = async () => {
    try {
      const data = await sipService.getSIPById(sipId || sipRefId);
      if (data?.success) {
        setSip(data.data);
        setContributions(data.data?.contributions || []);
      }
    } catch (error) {
      console.warn('[SIPDetails] Error loading details:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSIPDetails();
    }, [sipId, sipRefId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSIPDetails();
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Pay / Retry a specific installment
  const handlePayInstallment = async (contrib) => {
    try {
      setPayingContributionId(contrib._id);
      const res = await sipService.payInstallment(sip._id, contrib._id);

      if (!res?.success) {
        throw new Error(res?.message || 'Failed to create payment order');
      }

      const { orderId, amount, keyId, isSimulated } = res;

      await openRazorpayCheckout({
        orderId,
        amount,
        keyId,
        name: 'Growvest SIP',
        description: `SIP Installment #${contrib.installmentNumber} for ${sip.sipId}`,
        isSimulated,
        onSuccess: async (paymentData) => {
          try {
            const verifyRes = await sipService.verifyPayment({
              ...paymentData,
              sipId: sip._id,
              contributionId: contrib._id,
              installmentNumber: contrib.installmentNumber,
            });

            if (verifyRes?.success) {
              Alert.alert('Payment Successful', `Contribution #${contrib.installmentNumber} has been verified and marked as Paid.`);
              loadSIPDetails();
            } else {
              Alert.alert('Verification', verifyRes?.message || 'Payment received. Updating status shortly.');
              loadSIPDetails();
            }
          } catch (vErr) {
            Alert.alert('Error', 'Payment verification failed.');
          } finally {
            setPayingContributionId(null);
          }
        },
        onError: () => {
          setPayingContributionId(null);
          Alert.alert('Payment Cancelled', 'You can retry paying your due installment anytime.');
        },
      });
    } catch (error) {
      setPayingContributionId(null);
      Alert.alert('Error', error?.message || 'Failed to initiate installment payment.');
    }
  };

  // Withdraw from this SIP
  const handleWithdraw = async () => {
    const numAmt = Number(withdrawAmount);
    if (!numAmt || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }

    if (!withdrawUpi.trim()) {
      Alert.alert('Invalid UPI ID', 'Please enter your UPI ID (e.g. name@okhdfcbank).');
      return;
    }

    const available = sip?.availablePrincipal || 0;
    if (numAmt > available) {
      Alert.alert('Insufficient Balance', `Available balance for ${sip.sipId} is ₹${available.toLocaleString('en-IN')}`);
      return;
    }

    try {
      setWithdrawing(true);
      const res = await sipService.withdrawSIP(sip._id, numAmt, withdrawUpi.trim());
      if (res?.success) {
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setWithdrawUpi('');
        Alert.alert(
          'Withdrawal Requested',
          `Your withdrawal request of ₹${numAmt.toLocaleString('en-IN')} from ${sip.sipId} has been submitted for admin processing.`
        );
        loadSIPDetails();
      } else {
        Alert.alert('Withdrawal Failed', res?.message || 'Could not submit withdrawal request.');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Withdrawal request failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  // Cancel SIP
  const handleCancelSIP = async () => {
    try {
      setCancelling(true);
      const res = await sipService.cancelSIP(sip._id);
      if (res?.success) {
        setShowCancelModal(false);
        Alert.alert(
          'SIP Cancelled',
          `Future contributions for ${sip.sipId} have been stopped. Your existing paid balance of ₹${sip.totalPaidAmount.toLocaleString('en-IN')} remains completely safe.`
        );
        loadSIPDetails();
      } else {
        Alert.alert('Error', res?.message || 'Could not cancel SIP.');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background || '#F8FAFC' }}>
        <SkeletonLoader variant="list" count={4} />
      </View>
    );
  }

  if (!sip) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SIP Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: themeColors.textMuted }}>SIP Plan not found.</Text>
        </View>
      </View>
    );
  }

  const progress =
    sip.totalContributions > 0
      ? Math.min(100, Math.round((sip.contributionsCompleted / sip.totalContributions) * 100))
      : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SIP Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#085428']} />}
      >
        {/* SIP Hero Card */}
        <LinearGradient
          colors={['#085428', '#0A6C35', '#043417']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroIdLabel}>SIP ID</Text>
              <Text style={styles.heroIdValue}>{sip.sipId}</Text>
            </View>
            <View style={styles.heroStatusBadge}>
              <Text style={styles.heroStatusText}>{(sip.status || 'Active').toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.heroAmountRow}>
            <View>
              <Text style={styles.heroSubLabel}>
                {`${(sip.frequency || 'monthly').toUpperCase()} CONTRIBUTION`}
              </Text>
              <Text style={styles.heroBigAmount}>{formatCurrency(sip.amount)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroSubLabel}>TOTAL PAID</Text>
              <Text style={styles.heroBigAmount}>{formatCurrency(sip.totalPaidAmount)}</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.heroProgressWrap}>
            <View style={styles.heroProgressHeader}>
              <Text style={styles.heroProgressText}>
                {sip.contributionsCompleted} of {sip.totalContributions} Contributions Completed
              </Text>
              <Text style={styles.heroProgressPercent}>{progress}%</Text>
            </View>
            <View style={styles.heroProgressBarBg}>
              <View style={[styles.heroProgressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroFooterGrid}>
            <View style={styles.heroFooterItem}>
              <Text style={styles.heroFooterLabel}>Schedule</Text>
              <Text style={styles.heroFooterValue}>
                {sip.frequency === 'daily'
                  ? 'Every day'
                  : sip.frequency === 'weekly'
                  ? `Every ${sip.sipDayName || 'week'}`
                  : `${sip.sipDate}th monthly`}
              </Text>
            </View>
            <View style={styles.heroFooterItem}>
              <Text style={styles.heroFooterLabel}>Start Date</Text>
              <Text style={styles.heroFooterValue}>{formatDate(sip.startDate)}</Text>
            </View>
            <View style={styles.heroFooterItem}>
              <Text style={styles.heroFooterLabel}>End Date</Text>
              <Text style={styles.heroFooterValue}>{formatDate(sip.endDate)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Plan Parameters Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Plan Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Frequency</Text>
            <Text style={[styles.breakdownValue, { textTransform: 'capitalize' }]}>
              {sip.frequency || 'monthly'}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Total Planned Contribution</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(sip.totalPlannedAmount)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Total Amount Paid</Text>
            <Text style={[styles.breakdownValue, { color: '#085428' }]}>
              {formatCurrency(sip.totalPaidAmount)}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Remaining Contribution</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrency(Math.max(0, sip.totalPlannedAmount - sip.totalPaidAmount))}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Withdrawn Principal</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(sip.withdrawnAmount)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Available to Withdraw</Text>
            <Text style={[styles.breakdownValue, { color: '#085428', fontWeight: '800' }]}>
              {formatCurrency(sip.availablePrincipal)}
            </Text>
          </View>
        </View>

        {/* Action Buttons: Withdraw & Cancel */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.withdrawBtn, (sip.availablePrincipal || 0) <= 0 && { opacity: 0.5 }]}
            activeOpacity={0.8}
            disabled={(sip.availablePrincipal || 0) <= 0}
            onPress={() => setShowWithdrawModal(true)}
          >
            <MaterialCommunityIcons name="bank-transfer-out" size={18} color="#FFFFFF" />
            <Text style={styles.withdrawBtnText}>Withdraw from SIP</Text>
          </TouchableOpacity>

          {sip.status === 'active' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={() => setShowCancelModal(true)}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.cancelBtnText}>Cancel SIP</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contribution History Ledger */}
        <View style={styles.ledgerHeaderRow}>
          <Text style={styles.ledgerTitle}>Contribution History</Text>
          <Text style={styles.ledgerCount}>
            {contributions.filter((c) => c.paymentStatus === 'paid').length} / {contributions.length} Paid
          </Text>
        </View>

        {contributions.map((c) => {
          const isPaid = c.paymentStatus === 'paid';
          const isFailed = c.paymentStatus === 'failed';
          const isPending = c.paymentStatus === 'pending';
          const isPayingThis = payingContributionId === c._id;

          return (
            <View key={c._id} style={styles.contribCard}>
              <View style={styles.contribHeader}>
                <View style={styles.contribIconWrap}>
                  <MaterialCommunityIcons
                    name={isPaid ? 'check-circle' : isFailed ? 'alert-circle' : 'clock-outline'}
                    size={20}
                    color={isPaid ? '#15803D' : isFailed ? '#B91C1C' : '#D97706'}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.contribTitle}>Contribution #{c.installmentNumber}</Text>
                  <Text style={styles.contribSubtitle}>
                    Due: {formatDate(c.dueDate)} {isPaid ? `• Paid: ${formatDate(c.paidAt)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.contribAmount}>{formatCurrency(c.amount)}</Text>
                  <View
                    style={[
                      styles.contribBadge,
                      {
                        backgroundColor: isPaid ? '#DCFCE7' : isFailed ? '#FEE2E2' : '#FEF3C7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.contribBadgeText,
                        { color: isPaid ? '#15803D' : isFailed ? '#B91C1C' : '#B45309' },
                      ]}
                    >
                      {isPaid ? 'Paid' : isFailed ? 'Failed' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Reference ID if paid */}
              {isPaid && c.receiptId && (
                <View style={styles.contribRefRow}>
                  <Text style={styles.contribRefLabel}>Receipt:</Text>
                  <Text style={styles.contribRefVal}>{c.receiptId}</Text>
                  {c.paymentId && <Text style={styles.contribRefVal}>({c.paymentId})</Text>}
                </View>
              )}

              {/* Action for pending / failed contributions */}
              {(isPending || isFailed) && sip.status === 'active' && (
                <View style={styles.contribActionRow}>
                  <TouchableOpacity
                    style={styles.payContribBtn}
                    activeOpacity={0.85}
                    disabled={isPayingThis}
                    onPress={() => handlePayInstallment(c)}
                  >
                    {isPayingThis ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="credit-card-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.payContribBtnText}>
                          {isFailed ? 'Retry Payment' : 'Pay Now'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="bank-transfer-out" size={32} color="#085428" />
            </View>

            <Text style={styles.modalTitle}>Withdraw from SIP</Text>
            <Text style={styles.modalSubtitle}>
              Withdraw available principal from {sip.sipId}.
            </Text>

            <View style={styles.availableBox}>
              <Text style={styles.availableLabel}>Available to Withdraw</Text>
              <Text style={styles.availableAmount}>{formatCurrency(sip.availablePrincipal)}</Text>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter withdrawal amount (₹)"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Enter UPI ID (e.g. name@okaxis)"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              value={withdrawUpi}
              onChangeText={setWithdrawUpi}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, withdrawing && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={withdrawing}
                onPress={handleWithdraw}
              >
                {withdrawing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Request Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="alert-outline" size={32} color="#B91C1C" />
            </View>

            <Text style={styles.modalTitle}>Cancel this SIP?</Text>
            <Text style={styles.modalSubtitle}>
              Cancelling will stop all future scheduled contributions for {sip.sipId}. Your already invested amount of {formatCurrency(sip.totalPaidAmount)} remains completely safe in your portfolio.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Keep Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#B91C1C' }, cancelling && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={cancelling}
                onPress={handleCancelSIP}
              >
                {cancelling ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    heroCard: {
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    heroIdLabel: {
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: '600',
    },
    heroIdValue: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    heroStatusBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    heroStatusText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    heroAmountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    heroSubLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#93C5FD',
      marginBottom: 2,
    },
    heroBigAmount: {
      fontSize: 22,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    heroProgressWrap: {
      marginBottom: 10,
    },
    heroProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    heroProgressText: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.85)',
      fontWeight: '600',
    },
    heroProgressPercent: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    heroProgressBarBg: {
      height: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    heroProgressBarFill: {
      height: '100%',
      backgroundColor: '#34D399',
      borderRadius: 3,
    },
    heroDivider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      marginVertical: 12,
    },
    heroFooterGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    heroFooterItem: {
      flex: 1,
    },
    heroFooterLabel: {
      fontSize: 10,
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: 2,
    },
    heroFooterValue: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    card: {
      backgroundColor: themeColors.surface || '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    cardSectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
      marginBottom: 12,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    breakdownLabel: {
      fontSize: 13,
      color: themeColors.textMuted || '#64748B',
    },
    breakdownValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    withdrawBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#085428',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
    },
    withdrawBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    cancelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#1E293B' : '#FEE2E2',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 4,
    },
    cancelBtnText: {
      color: '#B91C1C',
      fontSize: 13,
      fontWeight: '700',
    },
    ledgerHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    ledgerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    ledgerCount: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textMuted || '#64748B',
    },
    contribCard: {
      backgroundColor: themeColors.surface || '#FFFFFF',
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
    },
    contribHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contribIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    contribTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    contribSubtitle: {
      fontSize: 12,
      color: themeColors.textMuted || '#64748B',
      marginTop: 2,
    },
    contribAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text || '#0F172A',
    },
    contribBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      marginTop: 4,
    },
    contribBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    contribRefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#F1F5F9',
      gap: 4,
    },
    contribRefLabel: {
      fontSize: 11,
      color: themeColors.textMuted || '#94A3B8',
    },
    contribRefVal: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.text || '#0F172A',
    },
    contribActionRow: {
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#F1F5F9',
    },
    payContribBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#085428',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6,
    },
    payContribBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
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
      width: 56,
      height: 56,
      borderRadius: 28,
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
    availableBox: {
      width: '100%',
      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 14,
    },
    availableLabel: {
      fontSize: 12,
      color: themeColors.textMuted || '#64748B',
      marginBottom: 2,
    },
    availableAmount: {
      fontSize: 20,
      fontWeight: '800',
      color: '#085428',
    },
    modalInput: {
      width: '100%',
      height: 46,
      borderWidth: 1,
      borderColor: isDark ? '#334155' : '#E2E8F0',
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: themeColors.text || '#0F172A',
      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
      marginBottom: 12,
    },
    modalBtnRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      marginTop: 6,
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

export default SIPDetailsScreen;
