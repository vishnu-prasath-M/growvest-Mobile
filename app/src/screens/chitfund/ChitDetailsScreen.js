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
        chitFundService.getDividends().catch(() => []), // or getDividends(chitId) if supported
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
    { key: 'auction', label: 'Auction', icon: 'gavel' },
    { key: 'winners', label: 'Winners', icon: 'trophy' },
    { key: 'dividends', label: 'Dividends', icon: 'gift' },
    { key: 'rules', label: 'Rules', icon: 'book-open-variant' },
    { key: 'faq', label: 'FAQ', icon: 'frequently-asked-questions' },
    { key: 'support', label: 'Support', icon: 'headset' },
  ];

  const renderOverview = () => (
    <View>
      <View style={styles.overviewHero}>
        <LinearGradient colors={['#064e3b', '#065f46', '#047857']} style={styles.overviewHeroInner}>
          <Text style={styles.overviewHeroName}>{chit.name}</Text>
          <Text style={styles.overviewHeroDesc}>{chit.description}</Text>
          <View style={styles.overviewHeroRow}>
            <View style={styles.overviewHeroItem}>
              <Text style={styles.overviewHeroLabel}>Monthly</Text>
              <Text style={styles.overviewHeroValue}>{formatCurrency(chit.monthlyAmount)}</Text>
            </View>
            <View style={styles.overviewHeroItem}>
              <Text style={styles.overviewHeroLabel}>Duration</Text>
              <Text style={styles.overviewHeroValue}>{chit.duration}mo</Text>
            </View>
            <View style={styles.overviewHeroItem}>
              <Text style={styles.overviewHeroLabel}>Total Pot</Text>
              <Text style={styles.overviewHeroValue}>{formatCurrency(chit.totalPot)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Logged-in User Chit Action Details */}
      {(() => {
        const myMembership = myChits.find(m => m.chitId === chit._id) || chit.myMembership;
        const totalMembers = chit.totalMembers || 0;
        const availableSlots = chit.availableSlots || 0;
        const filledMembers = Math.max(0, totalMembers - availableSlots);
        const remainingSlots = availableSlots;

        if (myMembership) {
          const userJoinedDate = myMembership.joinedAt 
            ? new Date(myMembership.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'N/A';
          const installmentsPaid = myMembership.currentMonth || 0;
          const remainingInstallments = Math.max(0, (chit.duration || 0) - installmentsPaid);
          const totalPaid = myMembership.totalPaid || 0;
          const remainingAmount = Math.max(0, (chit.totalPot || 0) - totalPaid);
          const nextDueStr = myMembership.nextDueDate || 'N/A';
          const dueStatus = myMembership.pendingInstallments > 0 ? 'Pending' : 'Paid';

          return (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>My Chit Status & Action Details</Text>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chit ID</Text>
                <Text style={styles.detailValue}>{chit._id}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Chit Value</Text>
                <Text style={styles.detailValue}>{formatCurrency(chit.totalPot)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Monthly Installment</Text>
                <Text style={styles.detailValue}>{formatCurrency(chit.monthlyAmount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Members</Text>
                <Text style={styles.detailValue}>{totalMembers}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Filled Members</Text>
                <Text style={styles.detailValue}>{filledMembers}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Remaining Slots</Text>
                <Text style={[styles.detailValue, remainingSlots > 0 ? { color: colors.success } : { color: colors.error }]}>
                  {remainingSlots}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>User Join Date</Text>
                <Text style={styles.detailValue}>{userJoinedDate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Month Number</Text>
                <Text style={styles.detailValue}>Month {installmentsPaid} of {chit.duration}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Next Due Date</Text>
                <Text style={styles.detailValue}>{nextDueStr}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Due Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: dueStatus === 'Paid' ? colors.successLight : '#fef9c3' }]}>
                  <Text style={[styles.statusText, { color: dueStatus === 'Paid' ? colors.success : colors.warning }]}>
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
                <Text style={styles.detailLabel}>Installments Paid</Text>
                <Text style={styles.detailValue}>{installmentsPaid} Months</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Remaining Installments</Text>
                <Text style={styles.detailValue}>{remainingInstallments} Months</Text>
              </View>

              {/* Winning Status Banner */}
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                {myMembership.hasWon ? (
                  <View style={{ backgroundColor: colors.successLight, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.success }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <MaterialCommunityIcons name="trophy" size={24} color={colors.success} />
                      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success }}>AUCTION WINNER</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Winning Amount</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.success }}>{formatCurrency(myMembership.winningAmount || chit.totalPot)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Winning Date</Text>
                      <Text style={styles.detailValue}>
                        {myMembership.winningDate ? new Date(myMembership.winningDate).toLocaleDateString('en-IN') : 'Confirmed'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount Credited</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.success }}>✔ Credited to Wallet</Text>
                    </View>
                    {myMembership.winningTransactionRef ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Txn Reference</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{myMembership.winningTransactionRef}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.background, padding: 14, borderRadius: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                      ⏳ Waiting for Winning Turn
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }

        return (
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
              <Text style={styles.detailLabel}>Start Date</Text>
              <Text style={styles.detailValue}>{chit.startDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>End Date</Text>
              <Text style={styles.detailValue}>{chit.endDate}</Text>
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

  const renderPayments = () => (
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
                <Text style={styles.paymentMonth}>Month {payment.month}</Text>
                <Text style={styles.paymentDate}>Amount: {formatCurrency(payment.amount)}</Text>
              </View>
            </View>
            <View style={styles.paymentRight}>
              <Text style={styles.paymentAmount}>{formatCurrency(payment.amount + (payment.lateFee || 0))}</Text>
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

  const renderAuction = () => {
    return (
      <View>
        <View style={styles.sectionCard}>
          <View style={styles.auctionHeader}>
            <MaterialCommunityIcons name="gavel" size={28} color={colors.primary} />
            <Text style={styles.sectionTitle}>Auction Information</Text>
          </View>
          {auction ? (
            <>
              <View style={styles.auctionCountdown}>
                <Text style={styles.auctionCountdownLabel}>Next Auction</Text>
                <Text style={styles.auctionCountdownDate}>{auction.auctionDate}</Text>
                <View style={styles.countdownBadge}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.white} />
                  <Text style={styles.countdownText}>{auction.countdown || 'Soon'}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Month</Text>
                <Text style={styles.detailValue}>Month {auction.month}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Participants</Text>
                <Text style={styles.detailValue}>{auction.participants || chit.totalMembers}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: colors.infoLight }]}>
                  <Text style={[styles.statusText, { color: colors.info }]}>
                    {auction.status?.charAt(0).toUpperCase() + auction.status?.slice(1) || 'Pending'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.comingSoonBanner}>
              <MaterialCommunityIcons name="clock-fast" size={20} color={colors.info} />
              <Text style={styles.comingSoonText}>Auction details will be available soon.</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderWinners = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Winner History</Text>
      {winners.length === 0 ? (
        <Text style={{color: colors.textSecondary}}>No winners yet.</Text>
      ) : (
        winners.map((winner, index) => (
          <View key={winner._id} style={[styles.winnerRow, index < winners.length - 1 && styles.memberRowBorder]}>
            <View style={styles.winnerLeft}>
              <View style={styles.winnerRank}>
                <Text style={styles.winnerRankText}>{winner.month}</Text>
              </View>
              <View>
                <Text style={styles.winnerName}>{winner.user?.username || 'Unknown'}</Text>
                <Text style={styles.winnerMonth}>Month {winner.month}</Text>
              </View>
            </View>
            <View style={styles.winnerRight}>
              <Text style={styles.winnerAmount}>{formatCurrency(winner.winningAmount)}</Text>
              <Text style={styles.winnerDiscount}>-{formatCurrency(winner.discount)} discount</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderDividends = () => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Dividend History</Text>
      {dividends.length === 0 ? (
        <Text style={{color: colors.textSecondary}}>No dividends distributed yet.</Text>
      ) : (
        dividends.map((div) => (
          <View key={div._id} style={styles.paymentRow}>
            <View style={styles.paymentLeft}>
              <View style={[styles.paymentDot, { backgroundColor: div.status === 'credited' ? colors.success : colors.textTertiary }]} />
              <View>
                <Text style={styles.paymentMonth}>Month {div.month}</Text>
                <Text style={styles.paymentDate}>{div.creditedAt || 'Pending'}</Text>
              </View>
            </View>
            <View style={styles.paymentRight}>
              <Text style={styles.paymentAmount}>{formatCurrency(div.amount)}</Text>
              <View style={[styles.paymentStatusBadge, { backgroundColor: div.status === 'credited' ? colors.successLight : '#f3f4f6' }]}>
                <Text style={[styles.paymentStatusText, { color: div.status === 'credited' ? colors.success : colors.textTertiary }]}>
                  {div.status.charAt(0).toUpperCase() + div.status.slice(1)}
                </Text>
              </View>
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

  // Filter available tabs based on approval status
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
    if (isPendingApproval && ['members', 'payments', 'auction', 'winners', 'dividends'].includes(activeTab)) {
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
      case 'auction': return renderAuction();
      case 'winners': return renderWinners();
      case 'dividends': return renderDividends();
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
  overviewHeroName: { fontSize: 24, fontWeight: '700', color: colors.white, marginBottom: 6 },
  overviewHeroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 20 },
  overviewHeroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  overviewHeroItem: { alignItems: 'center', flex: 1 },
  overviewHeroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  overviewHeroValue: { fontSize: 18, fontWeight: '700', color: colors.white },
  // Section Card
  sectionCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  // Features
  featureList: { gap: 12 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureItemText: { fontSize: 14, color: colors.text },
  // Join Button
  joinNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, gap: 8,
    ...colors.shadow.button, marginBottom: 16,
  },
  joinNowBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  joinNowBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
  joinNowBtnTextDisabled: { color: '#64748B' },
  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  memberNumber: { fontSize: 12, color: colors.textSecondary },
  memberJoinDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  memberStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  memberWon: { backgroundColor: colors.successLight },
  memberNotWon: { backgroundColor: '#f3f4f6' },
  memberStatusText: { fontSize: 11, fontWeight: '700' },
  // Payments
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentDot: { width: 10, height: 10, borderRadius: 5 },
  paymentMonth: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  paymentDate: { fontSize: 11, color: colors.textSecondary },
  paymentRight: { alignItems: 'flex-end' },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  paymentStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  paymentStatusText: { fontSize: 10, fontWeight: '700' },
  // Auction
  auctionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  auctionCountdown: { alignItems: 'center', paddingVertical: 20, marginBottom: 16, backgroundColor: colors.primaryLight, borderRadius: 16 },
  auctionCountdownLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  auctionCountdownDate: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  countdownText: { fontSize: 14, fontWeight: '700', color: colors.white },
  comingSoonBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.infoLight, padding: 14, borderRadius: 12, marginTop: 16, gap: 10 },
  comingSoonText: { fontSize: 13, color: colors.info, fontWeight: '500', flex: 1 },
  // Winners
  winnerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  winnerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  winnerRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
  winnerRankText: { fontSize: 13, fontWeight: '700', color: '#d97706' },
  winnerName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  winnerMonth: { fontSize: 12, color: colors.textSecondary },
  winnerRight: { alignItems: 'flex-end' },
  winnerAmount: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  winnerDiscount: { fontSize: 11, color: colors.success },
  // Rule Link
  ruleLink: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.background, borderRadius: 14, gap: 14 },
  ruleLinkText: { flex: 1 },
  ruleLinkTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  ruleLinkSub: { fontSize: 12, color: colors.textSecondary },
});

export default ChitDetailsScreen;