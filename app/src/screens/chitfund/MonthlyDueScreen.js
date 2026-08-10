import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';
import { authService } from '../../services/authService';
import { SkeletonLoader } from '../../components/SkeletonLoader';

const MonthlyDueScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedChit, setSelectedChit] = useState(null);
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderChit, setReminderChit] = useState(null);

  const handleSetReminder = async (type) => {
    try {
      setShowReminderModal(false);
      
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable notifications in settings to receive reminders.');
        return;
      }

      // Clear any previously scheduled local notifications to stop loops/duplicates
      await Notifications.cancelAllScheduledNotificationsAsync();

      const now = new Date();
      let targetDate = new Date();
      let timeLabel = "";
      let trigger = null;

      if (type === '10_seconds') {
        timeLabel = "in 10 seconds";
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(now.getTime() + 10 * 1000),
          repeats: false,
        };
      } else if (type === 'tomorrow_morning') {
        // Tomorrow at 9:00 AM
        targetDate.setDate(now.getDate() + 1);
        targetDate.setHours(9, 0, 0, 0);
        timeLabel = "tomorrow morning at 9:00 AM";
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          repeats: false,
        };
      } else if (type === 'two_days') {
        // 2 days from now at 9:00 AM
        targetDate.setDate(now.getDate() + 2);
        targetDate.setHours(9, 0, 0, 0);
        timeLabel = "in 2 days at 9:00 AM";
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          repeats: false,
        };
      } else if (type === 'due_date') {
        // 9:00 AM on the due date
        const joinedDate = new Date(reminderChit?.joinedAt);
        targetDate = new Date(joinedDate);
        targetDate.setMonth(joinedDate.getMonth() + (reminderChit?.nextUnpaidMonth - 1));
        targetDate.setDate(1);
        targetDate.setHours(9, 0, 0, 0);
        timeLabel = `on your Due Date (${reminderChit?.nextDueDateFormatted} at 9:00 AM)`;
        
        // Fallback if calculated due date has already passed
        if (targetDate.getTime() <= now.getTime()) {
          targetDate = new Date(now.getTime() + 10 * 1000); // 10 seconds from now
          timeLabel = "in 10 seconds (as your due date is in the past)";
        }

        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          repeats: false,
        };
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 Growvest Due Reminder',
          body: `Reminder: Your monthly due of ${formatCurrency(reminderChit?.nextDueAmount)} for "${reminderChit?.chitName}" is due soon.`,
          sound: 'default',
          data: { screen: 'MonthlyDue' },
        },
        trigger,
      });

      Alert.alert(
        'Reminder Set',
        `We'll send you a notification ${timeLabel} to remind you of this due.`
      );
    } catch (error) {
      console.error('Error setting reminder:', error);
      Alert.alert('Error', 'Failed to set reminder. Please try again.');
    }
  };

  const fetchMyChits = async () => {
    try {
      const data = await chitFundService.getMyChits();
      // Get payment history to check which months are paid
      const allPayments = await chitFundService.getPaymentHistory();
      
      // Build a map of paid months per chit
      const paidMonthsMap = {};
      allPayments.forEach(p => {
        const chitId = p.chitId;
        if (!paidMonthsMap[chitId]) paidMonthsMap[chitId] = new Set();
        if (p.status === 'paid' || p.status === 'approved') {
          paidMonthsMap[chitId].add(p.month);
        }
      });

      // Enrich chits with payment status (filter ONLY active memberships)
      const activeOnly = data.filter(c => c.status === 'active');
      const enriched = activeOnly.map(c => {
        const paidMonths = paidMonthsMap[c.chitId] || new Set();
        const currentMonthDue = c.currentMonth + 1;
        const isCurrentPaid = paidMonths.has(currentMonthDue);
        
        // Calculate next unpaid month
        let nextUnpaidMonth = currentMonthDue;
        while (paidMonths.has(nextUnpaidMonth) && nextUnpaidMonth <= c.duration) {
          nextUnpaidMonth++;
        }
        
        const isFullyPaid = nextUnpaidMonth > c.duration;
        const isClosed = c.status === 'closed' || c.status === 'completed' || c.status === 'archived';
        
        // Calculate next due date
        const joinedDate = new Date(c.joinedAt);
        const nextDue = new Date(joinedDate);
        nextDue.setMonth(joinedDate.getMonth() + (nextUnpaidMonth - 1));
        nextDue.setDate(1);
        
        // Calculate remaining days
        const today = new Date();
        const diffTime = nextDue.getTime() - today.getTime();
        const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
          ...c,
          isCurrentPaid,
          isFullyPaid,
          isClosed,
          nextUnpaidMonth,
          nextDueDateFormatted: nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          remainingDays: remainingDays > 0 ? remainingDays : 0,
          isOverdue: remainingDays < 0,
        };
      });

      setChits(enriched);
    } catch (error) {
      console.error('Error fetching chits for dues:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMyChits();
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const user = await authService.getUserData();
      setUserData(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const handlePayNow = (chit) => {
    if (!userData?.email) {
      setShowEmailModal(true);
      return;
    }
    setSelectedChit(chit);
    setShowConfirm(true);
  };

  const handlePaymentSuccess = () => {
    setShowConfirm(false);
    // Navigate to MyChits -> ChitDetails -> MonthlyDue
    navigation.navigate('ChitPayment', {
      chitId: selectedChit?.chitId,
      memberId: selectedChit?._id,
      month: selectedChit?.nextUnpaidMonth || (selectedChit?.currentMonth || 0) + 1,
      amount: selectedChit?.nextDueAmount,
      lateFee: 0,
      type: 'due',
      chitName: selectedChit?.chitName,
      returnScreen: 'MonthlyDue',
    });
  };

  const renderChitCard = (chit) => {
    const isPaid = chit.isCurrentPaid || chit.isFullyPaid;
    const isClosed = chit.isClosed;
    
    // Determine whether the NEXT installment is actually due today or overdue
    // (so we only show Pay Now when the due date has arrived)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse nextDueDateFormatted back to a Date for comparison
    // nextUnpaidMonth is already calculated in fetchMyChits
    const joinedDate = new Date(chit.joinedAt);
    const nextDueDate = new Date(joinedDate);
    nextDueDate.setMonth(joinedDate.getMonth() + (chit.nextUnpaidMonth - 1));
    nextDueDate.setDate(1);
    nextDueDate.setHours(0, 0, 0, 0);
    
    // Can pay ONLY if:
    // 1. Not already fully paid / closed
    // 2. The next unpaid month has NOT already been paid
    // 3. Today is within 5 days of nextDueDate (or overdue)
    const diffTime = nextDueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Enable Pay Now only when within 5 days of due date (daysUntilDue <= 5)
    const isWithin5DaysWindow = daysUntilDue <= 5;
    const canPay = !isPaid && !isClosed && !chit.isFullyPaid && isWithin5DaysWindow;
    
    // Next installment is pending (future cycle beyond 5 days)
    const nextInstallmentPending = !isPaid && !isClosed && !chit.isFullyPaid && !isWithin5DaysWindow;

    return (
      <View key={chit._id} style={styles.dueCard}>
        <View style={styles.dueCardHeader}>
          <View style={[styles.dueIconWrap, isPaid && { backgroundColor: colors.successLight }]}>
            <MaterialCommunityIcons 
              name={isPaid ? "check-circle" : isClosed ? "lock" : "calendar-clock"} 
              size={24} 
              color={isPaid ? colors.success : isClosed ? colors.textTertiary : colors.primary} 
            />
          </View>
          <View style={styles.dueInfo}>
            <Text style={styles.dueChitName}>{chit.chitName}</Text>
            <Text style={styles.dueChitDetail}>
              {isClosed ? 'Chit Closed' : `Month ${chit.currentMonth} of ${chit.duration}`}
            </Text>
          </View>
        </View>

        <View style={styles.dueDivider} />

        {isPaid ? (
          <>
            <View style={styles.paidSection}>
              <View style={styles.paidBadge}>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
                <Text style={styles.paidText}>✓ Month {chit.currentMonth} Paid</Text>
              </View>

              {chit.isFullyPaid ? (
                <View style={styles.fullyPaidBanner}>
                  <MaterialCommunityIcons name="trophy" size={20} color={colors.gold} />
                  <Text style={styles.fullyPaidText}>All installments completed!</Text>
                </View>
              ) : chit.nextUnpaidMonth <= chit.duration ? (
                // Show next due info (next installment is scheduled but not yet payable)
                <>
                  <View style={styles.dueAmountRow}>
                    <View>
                      <Text style={styles.dueLabel}>Next Due Date</Text>
                      <Text style={styles.dueDate}>{chit.nextDueDateFormatted}</Text>
                    </View>
                    <View style={styles.dueDateWrap}>
                      <Text style={styles.dueLabel}>Remaining Days</Text>
                      <Text style={[styles.remainingDays, chit.isOverdue && { color: colors.error }]}>
                        {chit.isOverdue ? 'Overdue' : `${chit.remainingDays} days`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.dueAmountRow}>
                    <View>
                      <Text style={styles.dueLabel}>Next Installment</Text>
                      <Text style={styles.dueAmount}>{formatCurrency(chit.nextDueAmount)}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>

            {/* Show Pay Now ONLY when next installment due date has arrived */}
            {nextInstallmentDueNow && (
              <View style={styles.dueActions}>
                <TouchableOpacity
                  style={styles.payNowBtnEnabled}
                  activeOpacity={0.85}
                  onPress={() => handlePayNow(chit)}
                >
                  <Text style={styles.payNowBtnText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Waiting for next cycle — show disabled state */}
            {nextInstallmentPending && (
              <View style={styles.dueActions}>
                <View style={[styles.payNowBtnEnabled, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.payNowBtnText, { color: colors.textMuted }]}>
                    Next due in {chit.remainingDays} days
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : isClosed ? (
          <View style={styles.closedSection}>
            <View style={styles.closedBadge}>
              <MaterialCommunityIcons name="lock" size={20} color={colors.textTertiary} />
              <Text style={styles.closedText}>Chit Closed</Text>
            </View>
            <TouchableOpacity style={styles.closedBtn} disabled>
              <Text style={styles.closedBtnText}>Chit Closed</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.dueAmountRow}>
              <View>
                <Text style={styles.dueLabel}>
                  {chit.pendingInstallments > 1 ? `Due (${chit.pendingInstallments} months)` : 'Current Due'}
                </Text>
                <Text style={styles.dueAmount}>{formatCurrency(chit.nextDueAmount)}</Text>
              </View>
              <View style={styles.dueDateWrap}>
                <Text style={styles.dueLabel}>Due Date</Text>
                <Text style={styles.dueDate}>{chit.nextDueDateFormatted}</Text>
              </View>
            </View>

            <View style={styles.dueAmountRow}>
              <View>
                <Text style={styles.dueLabel}>Remaining Days</Text>
                <Text style={[styles.remainingDays, chit.isOverdue && { color: colors.error }]}>
                  {chit.isOverdue ? 'Overdue' : `${chit.remainingDays} days`}
                </Text>
              </View>
            </View>

            <View style={styles.lateFeeRow}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.lateFeeText}>Late fee of ₹10/day applies after due date</Text>
            </View>

            <View style={styles.dueActions}>
              {canPay ? (
                <>
                  <TouchableOpacity
                    style={styles.payNowBtnEnabled}
                    activeOpacity={0.85}
                    onPress={() => handlePayNow(chit)}
                  >
                    <Text style={styles.payNowBtnText}>Pay Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reminderBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      setReminderChit(chit);
                      setShowReminderModal(true);
                    }}
                  >
                    <MaterialCommunityIcons name="bell-outline" size={20} color={colors.primary} />
                    <Text style={styles.reminderBtnText}>Remind</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={[styles.payNowBtnEnabled, { backgroundColor: colors.muted, flex: 1 }]}>
                  <Text style={[styles.payNowBtnText, { color: colors.textMuted }]}>
                    🔒 Next due in {chit.remainingDays} days
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Dues</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonLoader variant="list" count={4} />
        ) : chits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You have no upcoming dues!</Text>
          </View>
        ) : (
          chits.map(renderChitCard)
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showConfirm} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowConfirm(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons name="cash-check" size={44} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Amount</Text>
              <Text style={styles.modalValue}>{formatCurrency(selectedChit?.nextDueAmount)}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Late Fee</Text>
              <Text style={styles.modalValue}>₹0</Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalRow}>
              <Text style={styles.modalTotalLabel}>Total</Text>
              <Text style={styles.modalTotalValue}>{formatCurrency(selectedChit?.nextDueAmount)}</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.payBtn}
                onPress={handlePaymentSuccess}
              >
                <Text style={styles.payBtnText}>Pay {formatCurrency(selectedChit?.nextDueAmount)}</Text>
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
              <Text style={styles.modalTitleEmail}>Email Required</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTextEmail}>
              Your email address is required before making payments. Please update your email in your Profile.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtnEmail} onPress={() => setShowEmailModal(false)}>
                <Text style={styles.cancelBtnTextEmail}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.payBtnOuterEmail}
                onPress={() => {
                  setShowEmailModal(false);
                  navigation.navigate('Profile');
                }}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.payBtnGradientEmail}
                >
                  <Text style={styles.payBtnTextEmail}>Update Profile</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reminder Modal */}
      <Modal visible={showReminderModal} transparent animationType="fade" onRequestClose={() => setShowReminderModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReminderModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleEmail}>Set Reminder</Text>
              <TouchableOpacity onPress={() => setShowReminderModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTextEmail}>
              Set a local notification reminder for your upcoming installment of {formatCurrency(reminderChit?.nextDueAmount)} for "{reminderChit?.chitName}".
            </Text>
            
            <View style={styles.reminderOptions}>
              <TouchableOpacity style={styles.reminderOptionBtn} activeOpacity={0.7} onPress={() => handleSetReminder('10_seconds')}>
                <MaterialCommunityIcons name="alarm" size={20} color={colors.primary} />
                <Text style={styles.reminderOptionText}>In 10 seconds (Test Demo)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.reminderOptionBtn} activeOpacity={0.7} onPress={() => handleSetReminder('tomorrow_morning')}>
                <MaterialCommunityIcons name="weather-sunny" size={20} color={colors.primary} />
                <Text style={styles.reminderOptionText}>Tomorrow morning (9:00 AM)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.reminderOptionBtn} activeOpacity={0.7} onPress={() => handleSetReminder('two_days')}>
                <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary} />
                <Text style={styles.reminderOptionText}>In 2 Days</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.reminderOptionBtn} activeOpacity={0.7} onPress={() => handleSetReminder('due_date')}>
                <MaterialCommunityIcons name="alert-decagram-outline" size={20} color={colors.primary} />
                <Text style={styles.reminderOptionText}>On Due Date ({reminderChit?.nextDueDateFormatted})</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setShowReminderModal(false)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
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
  dueCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  dueCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dueIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  dueInfo: { flex: 1 },
  dueChitName: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 2 },
  dueChitDetail: { fontSize: 12, color: colors.textSecondary },
  dueDivider: { height: 1, backgroundColor: colors.borderLight, marginBottom: 16 },
  dueAmountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dueLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  dueAmount: { fontSize: 28, fontWeight: '800', color: colors.text },
  dueDate: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'right' },
  dueDateWrap: { alignItems: 'flex-end' },
  remainingDays: { fontSize: 16, fontWeight: '700', color: colors.primary, textAlign: 'right' },
  lateFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, padding: 10, backgroundColor: '#fef9c3', borderRadius: 10 },
  lateFeeText: { fontSize: 12, color: colors.warning, fontWeight: '500', flex: 1 },
  dueActions: { flexDirection: 'row', gap: 12 },
  payNowBtnEnabled: { flex: 2, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', ...colors.shadow.button },
  payNowBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  reminderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingVertical: 14, borderRadius: 14 },
  reminderBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  // Paid section
  paidSection: { marginBottom: 16 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: colors.successLight, borderRadius: 12, marginBottom: 16 },
  paidText: { fontSize: 18, fontWeight: '800', color: colors.success },
  fullyPaidBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#fef3c7', borderRadius: 12 },
  fullyPaidText: { fontSize: 14, fontWeight: '700', color: '#d97706' },
  // Closed section
  closedSection: { alignItems: 'center', marginBottom: 16 },
  closedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 12, marginBottom: 16 },
  closedText: { fontSize: 16, fontWeight: '700', color: colors.textTertiary },
  closedBtn: { backgroundColor: colors.muted, paddingVertical: 14, borderRadius: 14, alignItems: 'center', width: '100%' },
  closedBtnText: { fontSize: 16, fontWeight: '700', color: colors.textTertiary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: colors.white, borderRadius: 24, padding: 24, ...colors.shadow.elevated },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 20 },
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
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  // Email Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitleEmail: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  modalTextEmail: { fontSize: 15, color: colors.textSecondary, marginBottom: 24, lineHeight: 22 },
  cancelBtnEmail: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnTextEmail: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  payBtnOuterEmail: { flex: 1 },
  payBtnGradientEmail: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  payBtnTextEmail: { fontSize: 15, fontWeight: '700', color: colors.white },
  reminderOptions: { gap: 10, marginVertical: 10 },
  reminderOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.primaryLight, borderRadius: 14 },
  reminderOptionText: { fontSize: 14, fontWeight: '600', color: colors.text },
});

export default MonthlyDueScreen;