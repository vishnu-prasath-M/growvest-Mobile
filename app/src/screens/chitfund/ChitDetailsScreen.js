import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../context/ThemeContext';
import { chitFundService } from '../../services/chitFundService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ChitDetailsScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const { chitId } = route.params || {};
  const { memberId } = route.params || {};
  const [activeTab, setActiveTab] = useState('overview');

  const [chit, setChit] = useState(null);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auction, setAuction] = useState(null);
  const [winners, setWinners] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [myChits, setMyChits] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetchData();
  }, [chitId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [chitData, membersData, paymentsData, auctionData, winnersData, dividendsData, myChitsData] = await Promise.all([
        chitFundService.getChitById(chitId),
        chitFundService.getChitMembers(chitId).catch(() => []),
        chitFundService.getPaymentHistory(chitId).catch(() => []),
        chitFundService.getAuction(chitId).catch(() => null),
        chitFundService.getWinners(chitId).catch(() => []),
        chitFundService.getDividends().catch(() => []),
        chitFundService.getMyChits().catch(() => []),
      ]);
      setChit(chitData);
      setMembers(membersData);
      setPayments(paymentsData);
      setAuction(auctionData);
      setWinners(winnersData);
      setDividends(dividendsData);
      setMyChits(myChitsData);
    } catch (error) {
      console.error('Error fetching chit details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'view-dashboard' },
    { key: 'members', label: 'Members', icon: 'account-group' },
    { key: 'payments', label: 'Payments', icon: 'cash-check' },
    { key: 'winners', label: 'Winners', icon: 'trophy' },
    { key: 'rules', label: 'Rules', icon: 'book-open-variant' },
    { key: 'faq', label: 'FAQ', icon: 'frequently-asked-questions' },
    { key: 'support', label: 'Support', icon: 'headset' },
  ];

  const getActionPercentage = (totalWeeks, week) => {
    if (totalWeeks === 10) {
      if (week >= 1 && week <= 4) return null;
      const schedule = { 5: 16, 6: 14, 7: 12, 8: 10, 9: 8, 10: 6 };
      return schedule[week] ?? 0;
    } else if (totalWeeks === 20) {
      if (week >= 1 && week <= 9) return null;
      const schedule = { 10: 28, 11: 26, 12: 24, 13: 22, 14: 20, 15: 18, 16: 16, 17: 14, 18: 12, 19: 10, 20: 8 };
      return schedule[week] ?? 0;
    }
    return 0;
  };

  const getWeeklyRowData = (weeklyAmount, totalWeeks, w) => {
    const totalContribution = weeklyAmount * totalWeeks;
    const actionPct = getActionPercentage(totalWeeks, w);
    
    if (actionPct === null) {
      return {
        week: w,
        weeklyPayment: weeklyAmount,
        priceAmount: null,
        dividend: null,
        actionPercentage: null,
        totalValue: null,
        isLocked: true
      };
    }
    
    const priceAmount = totalContribution - (totalContribution * actionPct / 100);
    const dividend = weeklyAmount * actionPct / 100;
    
    const totalDividend = totalWeeks === 10
      ? (weeklyAmount * 66 / 100)
      : (weeklyAmount * 198 / 100);
    const totalValue = priceAmount + totalDividend;
    const profitPercentage = ((totalValue / totalContribution) * 100).toFixed(1);
    
    return {
      week: w,
      weeklyPayment: weeklyAmount,
      priceAmount,
      dividend,
      actionPercentage: actionPct,
      totalValue,
      profitPercentage,
      isLocked: false
    };
  };

  const generateWeeklySchedule = (weeklyAmount, totalWeeks) => {
    const totalContribution = weeklyAmount * totalWeeks;
    const schedule = [];
    
    for (let w = 1; w <= totalWeeks; w++) {
      schedule.push(getWeeklyRowData(weeklyAmount, totalWeeks, w));
    }
    
    const settlementWeek = totalWeeks + 1;
    const totalDividend = totalWeeks === 10
      ? (weeklyAmount * 66 / 100)
      : (weeklyAmount * 198 / 100);
    const settlementAmount = totalContribution + totalDividend;
    
    schedule.push({
      week: settlementWeek,
      weeklyPayment: 0,
      priceAmount: null,
      dividend: totalDividend,
      actionPercentage: 0,
      totalValue: settlementAmount,
      profitPercentage: ((settlementAmount / totalContribution) * 100).toFixed(1),
      isSettlement: true
    });
    
    return { schedule, totalDividend, settlementAmount };
  };

  const handleWithdrawal = async (memberId) => {
    Alert.alert(
      'Confirm Payout Withdrawal',
      'Are you sure you want to withdraw your Chit payout now? You can only withdraw ONCE per Chit cycle.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            try {
              setLoading(true);
              const res = await chitFundService.withdrawChitPayout(memberId);
              Alert.alert('Success', res.message || 'Payout completed successfully!');
              fetchData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message || 'Withdrawal failed');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderWeeklyTable = () => {
    const isWeekly = chit?.isWeekly || false;
    if (!isWeekly) return null;
    
    const weeklyAmount = chit.weeklyAmount || chit.monthlyAmount || 200;
    const totalWeeks = chit.totalWeeks || chit.duration || 10;
    
    const myMembership = (memberId ? myChits.find(m => m._id === memberId) : null) || myChits.find(m => (m.chitId?._id || m.chitId) === chit._id) || chit.myMembership;
    const currentWeek = myMembership?.currentWeek || 0;
    
    const { schedule } = generateWeeklySchedule(weeklyAmount, totalWeeks);
    
    return (
      <View style={[styles.sectionCard, { paddingHorizontal: 8 }]}>
        <Text style={styles.sectionTitle}>Chit Fund Cycle Schedule</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Week</Text>
          <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Pay</Text>
          <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Price</Text>
          <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Div</Text>
          <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Act</Text>
          <Text style={[styles.tableHeaderCell, { width: '26%', textAlign: 'right' }]}>Total Value</Text>
        </View>
        
        {schedule.map((row) => {
          const isCurrent = row.week === currentWeek && !row.isSettlement;
          const isSettledRow = row.isSettlement;
          const rowStyle = isCurrent 
            ? [styles.tableRow, styles.tableRowCurrent]
            : isSettledRow
              ? [styles.tableRow, styles.tableRowSettled]
              : styles.tableRow;
              
          const cellColor = isCurrent 
            ? colors.primary 
            : isSettledRow
              ? '#d97706'
              : colors.text;
              
          return (
            <View key={row.week} style={rowStyle}>
              <Text style={[styles.tableCell, { width: '15%', fontWeight: '600', color: cellColor }]}>
                {row.isSettlement ? `${row.week} (Settle)` : row.week}
              </Text>
              <Text style={[styles.tableCell, { width: '15%', color: cellColor }]}>
                {row.weeklyPayment > 0 ? `₹${row.weeklyPayment}` : '-'}
              </Text>
              <Text style={[styles.tableCell, { width: '18%', color: cellColor }]}>
                {row.isLocked ? 'LOCKED' : row.priceAmount ? `₹${row.priceAmount}` : '-'}
              </Text>
              <Text style={[styles.tableCell, { width: '14%', color: cellColor }]}>
                {row.isLocked ? 'LOCKED' : `₹${row.dividend}`}
              </Text>
              <Text style={[styles.tableCell, { width: '12%', color: cellColor }]}>
                {row.isLocked ? 'LOCKED' : `${row.actionPercentage}%`}
              </Text>
              <Text style={[styles.tableCell, { width: '26%', textAlign: 'right', fontWeight: 'bold', color: cellColor }]}>
                {row.isLocked 
                  ? 'LOCKED' 
                  : `₹${row.totalValue.toLocaleString('en-IN')} (${row.profitPercentage}%)`}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderOverview = () => {
    const isWeekly = chit.isWeekly || false;
    const baseAmount = isWeekly ? (chit.weeklyAmount || 200) : chit.monthlyAmount;
    const totalPotVal = isWeekly ? (chit.totalContribution || 2000) : chit.totalPot;
    const durationLabel = isWeekly ? `${chit.totalWeeks || 10} Weeks` : `${chit.duration || 20} Months`;

    return (
      <View>
        <View style={styles.overviewHero}>
          <LinearGradient colors={['#064e3b', '#065f46', '#047857']} style={styles.overviewHeroInner}>
            <Text style={styles.overviewHeroName}>{chit.name}</Text>
            <Text style={styles.overviewHeroDesc}>{chit.description}</Text>
            <View style={styles.overviewHeroRow}>
              <View style={styles.overviewHeroItem}>
                <Text style={styles.overviewHeroLabel}>{isWeekly ? 'Weekly' : 'Monthly'}</Text>
                <Text style={styles.overviewHeroValue}>{formatCurrency(baseAmount)}</Text>
              </View>
              <View style={styles.overviewHeroItem}>
                <Text style={styles.overviewHeroLabel}>Duration</Text>
                <Text style={styles.overviewHeroValue}>{durationLabel}</Text>
              </View>
              <View style={styles.overviewHeroItem}>
                <Text style={styles.overviewHeroLabel}>Total Contribution</Text>
                <Text style={styles.overviewHeroValue}>{formatCurrency(totalPotVal)}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {(() => {
          const myMembership = (memberId ? myChits.find(m => m._id === memberId) : null) || myChits.find(m => (m.chitId?._id || m.chitId) === chit._id) || chit.myMembership;
          const totalMembers = chit.totalMembers || 0;
          const availableSlots = chit.availableSlots || 0;
          const filledMembers = Math.max(0, totalMembers - availableSlots);
          const remainingSlots = availableSlots;

          if (myMembership) {
            // ── PENDING: awaiting admin approval ──────────────────────────
            if (myMembership.status === 'pending') {
              return (
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <MaterialCommunityIcons name="clock-outline" size={28} color={themeColors.warning} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: themeColors.warning }}>Pending Admin Approval</Text>
                  </View>
                  <View style={{ backgroundColor: themeColors.warningLight, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: themeColors.warning }}>
                    <Text style={{ fontSize: 13, color: themeColors.text, lineHeight: 20 }}>
                      Your Chit Fund request has been submitted and is waiting for Admin approval.{'\n\n'}
                      Once approved, your membership will become active and you will receive a notification.
                    </Text>
                    <View style={{ marginTop: 12, gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '600' }}>Plan</Text>
                        <Text style={{ fontSize: 12, color: themeColors.text, fontWeight: '700' }}>{chit.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '600' }}>{isWeekly ? 'Weekly' : 'Monthly'} Amount</Text>
                        <Text style={{ fontSize: 12, color: themeColors.text, fontWeight: '700' }}>{formatCurrency(baseAmount)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '600' }}>Duration</Text>
                        <Text style={{ fontSize: 12, color: themeColors.text, fontWeight: '700' }}>{durationLabel}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '600' }}>Total Contribution</Text>
                        <Text style={{ fontSize: 12, color: themeColors.text, fontWeight: '700' }}>{formatCurrency(totalPotVal)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            }

            // ── REJECTED ────────────────────────────────────────────────
            if (myMembership.status === 'rejected') {
              return (
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <MaterialCommunityIcons name="close-circle-outline" size={28} color={themeColors.error} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: themeColors.error }}>Chit Request Rejected</Text>
                  </View>
                  <View style={{ backgroundColor: themeColors.errorLight, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: themeColors.error }}>
                    <Text style={{ fontSize: 13, color: themeColors.text, lineHeight: 20 }}>
                      {myMembership.rejectionReason
                        ? `Your Chit Fund request was not approved.\n\nReason: ${myMembership.rejectionReason}`
                        : 'Your Chit Fund request was not approved. Please contact support for more information.'}
                    </Text>
                  </View>
                </View>
              );
            }

            const userJoinedDate = myMembership.joinedAt 
              ? new Date(myMembership.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'N/A';
            
            const currentUnit = isWeekly ? (myMembership.currentWeek || 0) : (myMembership.currentMonth || 0);
            const totalUnits = isWeekly ? (chit.totalWeeks || 10) : (chit.duration || 20);
            const installmentsPaid = isWeekly ? (myMembership.paidWeeks || 0) : (myMembership.currentMonth || 0);
            const remainingInstallments = Math.max(0, totalUnits - currentUnit);
            
            const totalPaid = myMembership.totalPaid || 0;
            const remainingAmount = Math.max(0, totalPotVal - totalPaid);
            const nextDueStr = myMembership.nextDueDate || 'N/A';
            const dueStatus = myMembership.pendingInstallments > 0 ? 'Pending' : 'Paid';


            const eligibleStart = totalUnits === 10 ? 5 : 10;
            const isEligible = isWeekly && currentUnit >= eligibleStart;
            const isWithdrawn = myMembership.withdrawalStatus === 'completed';

            return (
              <View>
                {/* Penalty Alert Banner */}
                {myMembership.penaltiesUnpaid > 0 && (
                  <View style={styles.penaltyAlertCard}>
                    <MaterialCommunityIcons name="alert-circle" size={24} color={colors.error} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', color: colors.error }}>Overdue Penalty Applied</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>A ₹{myMembership.penaltiesUnpaid} overdue fee has been added to your dues. Please clear it immediately.</Text>
                    </View>
                  </View>
                )}

                {/* Payout & Withdrawal Action Card */}
                {isWeekly && (
                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Chit Fund Payout / Withdrawal</Text>
                    {isWithdrawn ? (
                      <View style={{ backgroundColor: themeColors.surface2, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: themeColors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <MaterialCommunityIcons name="check-decagram" size={24} color={themeColors.success} />
                          <Text style={{ fontSize: 15, fontWeight: '800', color: themeColors.success }}>Chit Amount Already Withdrawn</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Withdrawn In Week</Text>
                          <Text style={styles.detailValue}>Week {myMembership.withdrawalWeek}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Withdrawn Amount</Text>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: themeColors.success }}>{formatCurrency(myMembership.withdrawalAmount)}</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 10, lineHeight: 18 }}>
                          Your payout has been credited to your Growvest balance. Please continue paying the remaining weekly dues ({remainingInstallments} weeks left).
                        </Text>
                      </View>
                    ) : isEligible ? (
                      <View>
                        <View style={{ backgroundColor: themeColors.primaryLight, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: themeColors.primary, marginBottom: 16 }}>
                          <Text style={{ fontWeight: 'bold', color: themeColors.primary, fontSize: 14, marginBottom: 12 }}>Current Eligible Payout Breakdown (Week {currentUnit})</Text>
                          {(() => {
                            const row = getWeeklyRowData(baseAmount, totalUnits, currentUnit);
                            const totalDividend = totalUnits === 10 ? (baseAmount * 66 / 100) : (baseAmount * 198 / 100);
                            return (
                              <>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Price Amount</Text>
                                  <Text style={styles.detailValue}>{formatCurrency(row.priceAmount)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Share Dividend</Text>
                                  <Text style={styles.detailValue}>{formatCurrency(totalDividend)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Total Value (Withdrawal Amount)</Text>
                                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.primary }}>{formatCurrency(row.totalValue)}</Text>
                                </View>
                              </>
                            );
                          })()}
                        </View>
                        <TouchableOpacity
                          style={styles.withdrawBtn}
                          activeOpacity={0.85}
                          onPress={() => handleWithdrawal(myMembership._id)}
                        >
                          <MaterialCommunityIcons name="cash-fast" size={20} color={themeColors.white} />
                          <Text style={styles.joinNowBtnText}>Withdraw Payout</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: themeColors.surface2, padding: 14, borderRadius: 12, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary }}>
                          🔒 Payout locked until Week {eligibleStart}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Membership Details */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>My Chit Status & Details</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Chit ID</Text>
                    <Text style={styles.detailValue}>{chit._id}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Chit Value</Text>
                    <Text style={styles.detailValue}>{formatCurrency(totalPotVal)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{isWeekly ? 'Weekly Payment' : 'Monthly Payment'}</Text>
                    <Text style={styles.detailValue}>{formatCurrency(baseAmount)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>User Join Date</Text>
                    <Text style={styles.detailValue}>{userJoinedDate}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Week</Text>
                    <Text style={styles.detailValue}>Week {currentUnit} of {totalUnits}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Next Due Date</Text>
                    <Text style={styles.detailValue}>{nextDueStr}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due Status</Text>
                    <View style={[styles.statusBadge, { backgroundColor: dueStatus === 'Paid' ? themeColors.successLight : themeColors.warningLight }]}>
                      <Text style={[styles.statusText, { color: dueStatus === 'Paid' ? themeColors.success : themeColors.warning }]}>
                        {dueStatus}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Amount Paid</Text>
                    <Text style={styles.detailValue}>{formatCurrency(totalPaid)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Remaining Amount</Text>
                    <Text style={styles.detailValue}>{formatCurrency(remainingAmount)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Dues Paid</Text>
                    <Text style={styles.detailValue}>{installmentsPaid} of {totalUnits} {isWeekly ? 'Weeks' : 'Months'}</Text>
                  </View>
                </View>

                {renderWeeklyTable()}
              </View>
            );
          }

          return (
            <View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Plan Details</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Members</Text>
                  <Text style={styles.detailValue}>{totalMembers}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Filled Members</Text>
                  <Text style={styles.detailValue}>{filledMembers}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Available Slots</Text>
                  <Text style={[styles.detailValue, remainingSlots > 0 ? { color: colors.success } : { color: colors.error }]}>
                    {remainingSlots > 0 ? `${remainingSlots} Open` : 'Full'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Processing Fee</Text>
                  <Text style={styles.detailValue}>{chit.processingFee}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Schedule</Text>
                  <Text style={styles.detailValue}>{isWeekly ? 'Every Sunday' : 'Monthly'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: chit.status === 'active' ? colors.successLight : colors.infoLight }]}>
                    <Text style={[styles.statusText, { color: chit.status === 'active' ? colors.success : colors.info }]}>
                      {chit.status.charAt(0).toUpperCase() + chit.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
              
              {renderWeeklyTable()}
            </View>
          );
        })()}

        {chit.features && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featureList}>
              {chit.features.map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                  <Text style={styles.featureItemText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(() => {
          const isFull = chit.availableSlots <= 0;
          const hasJoined = myChits.some(m => m.chitId === chit._id);
          const isClosed = chit.status === 'closed' || chit.status === 'completed' || chit.status === 'archived';
          const isDisabled = isFull || hasJoined || isClosed;
          return (
            <TouchableOpacity
              style={[styles.joinNowBtn, isDisabled && styles.joinNowBtnDisabled]}
              activeOpacity={0.85}
              onPress={() => {
                if (isFull) {
                  Alert.alert('Slot Full', 'This Chit is already full.');
                } else if (!hasJoined && !isClosed) {
                  navigation.navigate('JoinChit', { chitId: chit._id });
                }
              }}
              disabled={isDisabled}
            >
              <Text style={[styles.joinNowBtnText, isDisabled && styles.joinNowBtnTextDisabled]}>
                {isFull ? 'Slot Full' : isClosed ? 'Closed' : hasJoined ? 'Already Joined' : 'Join This Chit'}
              </Text>
              {!isDisabled && <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />}
            </TouchableOpacity>
          );
        })()}
      </View>
    );
  };

  const renderMembers = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Members ({members.length})</Text>
      {members.length === 0 ? (
        <Text style={{color: colors.textSecondary}}>No members found.</Text>
      ) : (
        members.map((member, index) => {
          const displayName = member.isMe ? 'You' : (member.name || member.user?.name || member.user?.username || 'Unknown');
          const initial = member.avatarInitial || (displayName === 'You' ? member.user?.name?.charAt(0) || 'Y' : displayName.charAt(0).toUpperCase());
          const joinDate = member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          return (
            <View key={member._id} style={[styles.memberRow, index < members.length - 1 && styles.memberRowBorder]}>
              <View style={[styles.memberAvatar, member.isMe && { backgroundColor: colors.primary }]}>
                <Text style={[styles.memberAvatarText, member.isMe && { color: colors.white }]}>{initial}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {displayName}
                  {member.isMe && <Text style={{color: colors.primary, fontSize: 12, fontWeight: '600'}}> (You)</Text>}
                </Text>
                <Text style={styles.memberNumber}>Member #{member.memberNumber || index + 1}</Text>
                {joinDate ? <Text style={styles.memberJoinDate}>Joined {joinDate}</Text> : null}
              </View>
              <View style={[styles.memberStatus, member.hasWon ? styles.memberWon : styles.memberNotWon]}>
                <Text style={[styles.memberStatusText, { color: member.hasWon ? colors.success : colors.textTertiary }]}>
                  {member.hasWon ? 'Won' : member.status === 'active' ? 'Active' : member.status}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const renderPayments = () => {
    const isWeekly = chit?.isWeekly || false;
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Payment History</Text>
        {payments.length === 0 ? (
          <Text style={{color: colors.textSecondary}}>No payments found.</Text>
        ) : (
          payments.map((payment) => (
            <View key={payment._id} style={styles.paymentRow}>
              <View style={styles.paymentLeft}>
                <View style={[styles.paymentDot, { backgroundColor: payment.status === 'approved' || payment.status === 'paid' ? colors.success : colors.warning }]} />
                <View>
                  <Text style={styles.paymentMonth}>{isWeekly ? 'Week' : 'Month'} {payment.month}</Text>
                  <Text style={styles.paymentDate}>Base amount: {formatCurrency(payment.amount - (payment.lateFee || 0))}</Text>
                  {payment.lateFee > 0 && <Text style={{ fontSize: 11, color: colors.error }}>Penalty Applied: {formatCurrency(payment.lateFee)}</Text>}
                </View>
              </View>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                <View style={[styles.paymentStatusBadge, { backgroundColor: payment.status === 'approved' || payment.status === 'paid' ? colors.successLight : '#fef9c3' }]}>
                  <Text style={[styles.paymentStatusText, { color: payment.status === 'approved' || payment.status === 'paid' ? colors.success : colors.warning }]}>
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderWinners = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Winner / Payout History</Text>
      {winners.length === 0 ? (
        <Text style={{color: colors.textSecondary}}>No payouts claimed yet.</Text>
      ) : (
        winners.map((winner, index) => (
          <View key={winner._id} style={[styles.winnerRow, index < winners.length - 1 && styles.memberRowBorder]}>
            <View style={styles.winnerLeft}>
              <View style={styles.winnerRank}>
                <Text style={styles.winnerRankText}>{winner.month}</Text>
              </View>
              <View>
                <Text style={styles.winnerName}>{winner.user?.username || 'Unknown'}</Text>
                <Text style={styles.winnerMonth}>Week/Month {winner.month}</Text>
              </View>
            </View>
            <View style={styles.winnerRight}>
              <Text style={styles.winnerAmount}>{formatCurrency(winner.winningAmount)}</Text>
              <Text style={styles.winnerDiscount}>Payout Claimed</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderRules = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Rules & Guidelines</Text>
      <TouchableOpacity
        style={styles.ruleLink}
        onPress={() => navigation.navigate('ChitRules')}
      >
        <MaterialCommunityIcons name="book-open-variant" size={24} color={colors.primary} />
        <View style={styles.ruleLinkText}>
          <Text style={styles.ruleLinkTitle}>View Full Rules</Text>
          <Text style={styles.ruleLinkSub}>Complete chit fund terms & conditions</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderFaq = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      <TouchableOpacity
        style={styles.ruleLink}
        onPress={() => navigation.navigate('ChitFAQ')}
      >
        <MaterialCommunityIcons name="frequently-asked-questions" size={24} color={colors.primary} />
        <View style={styles.ruleLinkText}>
          <Text style={styles.ruleLinkTitle}>View FAQ</Text>
          <Text style={styles.ruleLinkSub}>Common questions about chit funds</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderSupport = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Need Help?</Text>
      <TouchableOpacity
        style={styles.ruleLink}
        onPress={() => navigation.navigate('ChitSupport')}
      >
        <MaterialCommunityIcons name="headset" size={24} color={colors.primary} />
        <View style={styles.ruleLinkText}>
          <Text style={styles.ruleLinkTitle}>Contact Support</Text>
          <Text style={styles.ruleLinkSub}>We're here to help you</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  const myMembership = myChits.find(m => m.chitId === chitId);
  const isPendingApproval = myMembership?.status === 'pending';

  const visibleTabs = isPendingApproval
    ? [
        { key: 'overview', label: 'Overview', icon: 'view-dashboard' },
        { key: 'rules', label: 'Rules', icon: 'book-open-variant' },
        { key: 'faq', label: 'FAQ', icon: 'frequently-asked-questions' },
        { key: 'support', label: 'Support', icon: 'headset' },
      ]
    : tabs;

  const renderPendingApprovalCard = () => (
    <View style={{ backgroundColor: '#fffbeb', borderColor: colors.warning, borderWidth: 1, padding: 18, borderRadius: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <MaterialCommunityIcons name="clock-outline" size={24} color={colors.warning} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.warning }}>Waiting for Admin Approval</Text>
      </View>
      <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
        Your Chit Fund joining request has been submitted successfully. Please wait until the administrator approves your request. You will be notified once your membership becomes active.
      </Text>
    </View>
  );

  const renderTabContent = () => {
    if (isPendingApproval && ['members', 'payments', 'winners'].includes(activeTab)) {
      return (
        <View style={styles.sectionCard}>
          {renderPendingApprovalCard()}
        </View>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <View>
            {isPendingApproval && renderPendingApprovalCard()}
            {renderOverview()}
          </View>
        );
      case 'members': return renderMembers();
      case 'payments': return renderPayments();
      case 'winners': return renderWinners();
      case 'rules': return renderRules();
      case 'faq': return renderFaq();
      case 'support': return renderSupport();
      default: return renderOverview();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{chit?.name || 'Chit Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading || !chit ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{color: colors.textSecondary}}>Loading...</Text>
        </View>
      ) : (
        <>
          {/* Tab Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
            {visibleTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <MaterialCommunityIcons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderTabContent()}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },
  // Tab Bar
  tabBar: { maxHeight: 48, marginBottom: 4 },
  tabBarContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: colors.textTertiary },
  tabLabelActive: { color: colors.primary },
  // Overview Hero
  overviewHero: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, ...colors.shadow.elevated },
  overviewHeroInner: { padding: 24 },
  overviewHeroName: { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: 6 },
  overviewHeroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 20 },
  overviewHeroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  overviewHeroItem: { alignItems: 'center', flex: 1 },
  overviewHeroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  overviewHeroValue: { fontSize: 16, fontWeight: '700', color: colors.white },
  // Section Card
  sectionCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: 13, color: colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  // Features
  featureList: { gap: 12 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureItemText: { fontSize: 13, color: colors.text },
  // Join Button
  joinNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, gap: 8,
    ...colors.shadow.button, marginBottom: 16,
  },
  joinNowBtnDisabled: {
    backgroundColor: colors.muted,
  },
  joinNowBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  joinNowBtnTextDisabled: { color: colors.textTertiary },
  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  memberNumber: { fontSize: 11, color: colors.textSecondary },
  memberJoinDate: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  memberStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  memberWon: { backgroundColor: colors.successLight },
  memberNotWon: { backgroundColor: colors.surface2 },
  memberStatusText: { fontSize: 10, fontWeight: '700' },
  // Payments
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentDot: { width: 10, height: 10, borderRadius: 5 },
  paymentMonth: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
  paymentDate: { fontSize: 10, color: colors.textSecondary },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  paymentStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  paymentStatusText: { fontSize: 9, fontWeight: '700' },
  // Winners
  winnerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  winnerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  winnerRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.goldLight, justifyContent: 'center', alignItems: 'center' },
  winnerRankText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  winnerName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  winnerMonth: { fontSize: 11, color: colors.textSecondary },
  winnerRight: { alignItems: 'flex-end' },
  winnerAmount: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  winnerDiscount: { fontSize: 10, color: colors.success },
  // Rule Link
  ruleLink: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.background, borderRadius: 14, gap: 14 },
  ruleLinkText: { flex: 1 },
  ruleLinkTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  ruleLinkSub: { fontSize: 11, color: colors.textSecondary },
  
  // Weekly Table styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primaryDark || colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center'
  },
  tableRowCurrent: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    marginVertical: 2
  },
  tableRowSettled: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    marginVertical: 2
  },
  tableCell: {
    fontSize: 11,
    color: colors.text,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    ...colors.shadow.button
  },
  penaltyAlertCard: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error,
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  }
});

export default ChitDetailsScreen;