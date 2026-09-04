import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Share,
  Clipboard,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useDailyReward } from '../../context/DailyRewardContext';
import { colors } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import StatusChip from '../../components/StatusChip';

const ReferralScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  
  const {
    sessionSeconds,
    hasClaimedDaily: globalHasClaimedDaily,
    isClaiming: claimingDaily,
    claimReward,
  } = useDailyReward();

  const [walletData, setWalletData] = useState(null);
  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Withdrawal modal state
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawUpiId, setWithdrawUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Tab: 'overview' | 'history'
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAllData = async () => {
    try {
      const [walletRes, refRes] = await Promise.allSettled([
        api.get('/referral/coins'),
        api.get('/referral/info'),
      ]);

      if (walletRes.status === 'fulfilled' && walletRes.value?.data) {
        setWalletData(walletRes.value.data);
      }
      if (refRes.status === 'fulfilled' && refRes.value?.data) {
        setReferralInfo(refRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching referral & wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [globalHasClaimedDaily]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllData();
  }, []);

  const handleCopyCode = () => {
    const code = referralInfo?.referralCode;
    if (code) {
      Clipboard.setString(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    const link = referralInfo?.referralLink || `https://growvest-mobile.onrender.com/ref/${referralInfo?.referralCode || ''}`;
    if (link) {
      Clipboard.setString(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    try {
      const code = referralInfo?.referralCode || '';
      const link = referralInfo?.referralLink || `https://growvest-mobile.onrender.com/ref/${code}`;
      const message = `Join Growvest and earn with high-yield savings & chit funds!\n\nUse my referral code: ${code}\nLink: ${link}`;

      await Share.share({
        message,
        title: 'Growvest Referral Invitation',
        url: link,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleClaimDailyLogin = async () => {
    if (claimingDaily || hasClaimedDaily) return;
    const result = await claimReward(true);
    if (result?.success) {
      fetchAllData();
    } else if (result?.message) {
      Alert.alert('Notice', result.message);
      fetchAllData();
    }
  };

  const handleWithdrawCoins = async () => {
    if (!withdrawUpiId.trim() || !withdrawUpiId.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@okhdfcbank)');
      return;
    }

    setWithdrawing(true);
    try {
      const res = await api.post('/referral/withdraw-coins', {
        upiId: withdrawUpiId.trim(),
      });

      if (res.data) {
        Alert.alert(
          'Withdrawal Requested! 🚀',
          res.data.message || 'Your reward withdrawal request has been submitted successfully.'
        );
        setWithdrawModalVisible(false);
        setWithdrawUpiId('');
        fetchAllData();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit withdrawal request.';
      Alert.alert('Withdrawal Error', msg);
    } finally {
      setWithdrawing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const availableCoins = walletData?.availableCoins || 0;
  const rupeeValue = walletData?.rupeeValue || Number((availableCoins * 0.05).toFixed(2));
  const minThreshold = walletData?.minWithdrawalCoins || 1000;
  const minThresholdRupees = walletData?.minWithdrawalRupees || Number((minThreshold * 0.05).toFixed(2));
  const isUnlocked = walletData?.isUnlocked ?? (availableCoins >= minThreshold);
  const remainingToUnlock = walletData?.remainingCoinsToUnlock ?? Math.max(0, minThreshold - availableCoins);
  const progressPercent = walletData?.progressPercent ?? Math.min(100, Math.round((availableCoins / minThreshold) * 100));
  const hasClaimedDaily = globalHasClaimedDaily || (walletData?.hasClaimedDailyToday ?? false);

  const stats = referralInfo?.stats || {};
  const history = referralInfo?.history || [];
  const transactions = walletData?.transactions || [];

  return (
    <View style={styles.container}>
      <TopBar title="Refer & Earn Rewards" navigation={navigation} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* COIN WALLET HERO CARD */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={isDarkMode ? ['#121F17', '#1A3324'] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.walletHeader}>
              <View style={styles.heroBadge}>
                <MaterialCommunityIcons name="wallet-giftcard" size={14} color="#FBBF24" />
                <Text style={styles.heroBadgeText}>COINS WALLET</Text>
              </View>
              <View style={[styles.statusTag, isUnlocked ? styles.unlockedTag : styles.lockedTag]}>
                <MaterialCommunityIcons
                  name={isUnlocked ? 'lock-open-check' : 'lock'}
                  size={12}
                  color={isUnlocked ? '#10B981' : '#F59E0B'}
                />
                <Text style={[styles.statusTagText, { color: isUnlocked ? '#10B981' : '#F59E0B' }]}>
                  {isUnlocked ? 'Available to Withdraw' : 'Locked'}
                </Text>
              </View>
            </View>

            <View style={styles.coinBalanceRow}>
              <View>
                <Text style={styles.coinBalanceLabel}>Your Balance</Text>
                <Text style={styles.coinBalanceVal}>🪙 {availableCoins.toLocaleString('en-IN')} Coins</Text>
                <Text style={styles.rupeeEquivalent}>≈ ₹{rupeeValue.toFixed(2)} (20 Coins = ₹1)</Text>
              </View>

              {isUnlocked && (
                <TouchableOpacity
                  style={styles.withdrawHeroBtn}
                  activeOpacity={0.85}
                  onPress={() => setWithdrawModalVisible(true)}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.withdrawGradient}
                  >
                    <Text style={styles.withdrawBtnText}>Withdraw</Text>
                    <MaterialCommunityIcons name="arrow-right" size={14} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Threshold Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabelText}>
                  {isUnlocked
                    ? '🎉 Minimum threshold reached!'
                    : `Earn ${remainingToUnlock} more Coins to unlock withdrawal`}
                </Text>
                <Text style={styles.progressValueText}>{availableCoins} / {minThreshold}</Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>

              <Text style={styles.minThresholdHint}>
                Min. Withdrawal: {minThreshold} Coins (₹{minThresholdRupees.toFixed(2)})
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* DAILY LOGIN REWARD WIDGET */}
        <View style={styles.dailyCard}>
          <View style={styles.dailyLeft}>
            <View style={styles.dailyIconBox}>
              <MaterialCommunityIcons name="calendar-check" size={24} color="#1A5C39" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dailyTitle}>Daily Login Reward</Text>
              <Text style={styles.dailySub}>
                {hasClaimedDaily
                  ? '✓ Claimed +2 Coins today! Return tomorrow.'
                  : sessionSeconds >= 30
                  ? 'Ready to claim +2 Coins (₹0.10)!'
                  : `Active in app: ${sessionSeconds}s / 30s (claims automatically)`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.dailyClaimBtn,
              (hasClaimedDaily || sessionSeconds < 30) && styles.dailyClaimBtnDisabled,
            ]}
            disabled={hasClaimedDaily || sessionSeconds < 30 || claimingDaily}
            activeOpacity={0.8}
            onPress={handleClaimDailyLogin}
          >
            {claimingDaily ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.dailyClaimText}>
                {hasClaimedDaily ? 'Claimed' : '+2 Coins'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* TAB BUTTONS */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>
              Refer & Earn
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
              Rewards History ({transactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          <>
            {/* REFERRAL CODE & LINK CARD */}
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>Your Referral Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeVal}>{referralInfo?.referralCode || '—'}</Text>
                <TouchableOpacity style={styles.copyBtn} activeOpacity={0.8} onPress={handleCopyCode}>
                  <MaterialCommunityIcons
                    name={copiedCode ? 'check' : 'content-copy'}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.copyBtnText}>{copiedCode ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 14 }} />

              <Text style={styles.cardSectionLabel}>Your Referral Link</Text>
              <View style={styles.linkRow}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {referralInfo?.referralLink || 'https://growvest-mobile.onrender.com/ref/...'}
                </Text>
                <TouchableOpacity style={styles.copyLinkBtn} activeOpacity={0.8} onPress={handleCopyLink}>
                  <MaterialCommunityIcons
                    name={copiedLink ? 'check' : 'link-variant'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.copyLinkText}>{copiedLink ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.shareBtn} activeOpacity={0.88} onPress={handleNativeShare}>
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shareGradient}
                >
                  <MaterialCommunityIcons name="share-variant" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.shareText}>Share Referral Link</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* REFERRAL STATS */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats.totalInvited || 0}</Text>
                <Text style={styles.statLabel}>Invited</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats.registered || 0}</Text>
                <Text style={styles.statLabel}>Registered</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#1A5C39' }]}>{stats.successful || 0}</Text>
                <Text style={styles.statLabel}>Qualified</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#B45309' }]}>🪙 {availableCoins}</Text>
                <Text style={styles.statLabel}>Balance</Text>
              </View>
            </View>

            {/* REWARDS STRUCTURE BREAKDOWN */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎁 Rewards Breakdown</Text>
              
              <Text style={styles.subSectionTitle}>Referral Rewards (Per Friend - Up to 200 Coins):</Text>
              <View style={styles.milestoneList}>
                {[
                  { step: '1', title: 'Friend Signs Up', reward: '+20 Coins (₹1.00)', desc: 'Credited as soon as your friend registers with your code' },
                  { step: '2', title: 'KYC Approved', reward: '+30 Coins (₹1.50)', desc: 'Credited when your friend completes identity verification' },
                  { step: '3', title: 'First Investment', reward: '+50 Coins (₹2.50)', desc: 'Credited when your friend starts their first plan' },
                  { step: '4', title: 'Referral Milestone', reward: '+100 Coins (₹5.00)', desc: 'Credited upon successful referral qualification' },
                ].map((item) => (
                  <View key={item.step} style={styles.milestoneRow}>
                    <View style={styles.milestoneIcon}>
                      <Text style={styles.milestoneIconText}>{item.step}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.milestoneTitle}>{item.title}</Text>
                      <Text style={styles.milestoneDesc}>{item.desc}</Text>
                    </View>
                    <Text style={styles.milestoneReward}>{item.reward}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 16 }} />

              <Text style={styles.subSectionTitle}>First-Time User Rewards (150 Coins Total):</Text>
              <View style={styles.milestoneList}>
                {[
                  { title: '1st Savings/Fixed Plan', reward: '+50 Coins (₹2.50)' },
                  { title: '1st Chit Fund Join', reward: '+50 Coins (₹2.50)' },
                  { title: '1st Pocket Money Plan', reward: '+50 Coins (₹2.50)' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.firstTimeRow}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.firstTimeTitle}>{item.title}</Text>
                    <Text style={styles.firstTimeReward}>{item.reward}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* REFERRAL FRIENDS LIST */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Referred Friends ({history.length})</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
            ) : history.length > 0 ? (
              <View style={styles.historyList}>
                {history.map((item) => (
                  <View key={item._id} style={styles.historyCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyName}>{item.displayName}</Text>
                      <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <StatusChip status={item.status} />
                      {item.rewardCoins > 0 && (
                        <Text style={styles.historyReward}>+{item.rewardCoins} Coins</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No friends invited yet. Share your referral link above!</Text>
              </View>
            )}
          </>
        ) : (
          /* REWARDS / COIN TRANSACTIONS HISTORY */
          <View style={{ marginTop: 10 }}>
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <View key={tx._id} style={styles.txCard}>
                  <View style={styles.txIconBox}>
                    <MaterialCommunityIcons
                      name={tx.coins < 0 ? 'arrow-up-bold-circle' : 'plus-circle'}
                      size={24}
                      color={tx.coins < 0 ? '#EF4444' : '#10B981'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{tx.description || tx.type}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txCoins, { color: tx.coins < 0 ? '#EF4444' : '#10B981' }]}>
                      {tx.coins > 0 ? `+${tx.coins}` : `${tx.coins}`} Coins
                    </Text>
                    <Text style={styles.txRupees}>
                      {tx.coins > 0 ? `+₹${((tx.coins || 0) * 0.05).toFixed(2)}` : `-₹${(Math.abs(tx.coins || 0) * 0.05).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="history" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No coin transactions recorded yet.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* WITHDRAW REWARDS MODAL */}
      <Modal visible={withdrawModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Reward Coins</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSummaryBox}>
              <Text style={styles.modalSummaryLabel}>Available Reward Coins</Text>
              <Text style={styles.modalSummaryVal}>🪙 {availableCoins} Coins</Text>
              <Text style={styles.modalSummaryRupees}>Transfer Value: ₹{rupeeValue.toFixed(2)}</Text>
            </View>

            <Text style={styles.inputLabel}>Enter UPI ID</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. yourname@okhdfcbank"
              placeholderTextColor={colors.textTertiary}
              value={withdrawUpiId}
              onChangeText={setWithdrawUpiId}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.confirmWithdrawBtn, withdrawing && { opacity: 0.7 }]}
              disabled={withdrawing}
              activeOpacity={0.88}
              onPress={handleWithdrawCoins}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmWithdrawGradient}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmWithdrawText}>Confirm & Withdraw ₹{rupeeValue.toFixed(2)}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    heroOuter: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 16,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
    },
    heroCard: {
      padding: 20,
    },
    walletHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    heroBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 0.8,
    },
    statusTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    unlockedTag: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    lockedTag: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
    },
    statusTagText: {
      fontSize: 11,
      fontWeight: '700',
    },
    coinBalanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 16,
    },
    coinBalanceLabel: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
      fontWeight: '600',
    },
    coinBalanceVal: {
      color: '#FFFFFF',
      fontSize: 26,
      fontWeight: '900',
      marginTop: 2,
    },
    rupeeEquivalent: {
      color: '#FDE68A',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    withdrawHeroBtn: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    withdrawGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    withdrawBtnText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    progressContainer: {
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      padding: 12,
      borderRadius: 16,
    },
    progressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressLabelText: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    progressValueText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    progressBarTrack: {
      height: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#10B981',
      borderRadius: 3,
    },
    minThresholdHint: {
      color: 'rgba(255, 255, 255, 0.65)',
      fontSize: 10,
      marginTop: 6,
      textAlign: 'right',
    },
    dailyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.card,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: 16,
    },
    dailyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    dailyIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: 'rgba(26, 92, 57, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dailyTitle: {
      color: themeColors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    dailySub: {
      color: themeColors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    dailyClaimBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      marginLeft: 10,
    },
    dailyClaimBtnDisabled: {
      backgroundColor: themeColors.muted,
      opacity: 0.6,
    },
    dailyClaimText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: 'bold',
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: themeColors.card,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: 16,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
    },
    tabBtnText: {
      color: themeColors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    tabBtnTextActive: {
      color: '#FFFFFF',
    },
    card: {
      backgroundColor: themeColors.card,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: 16,
    },
    cardTitle: {
      color: themeColors.text,
      fontSize: 15,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    subSectionTitle: {
      color: themeColors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
    },
    cardSectionLabel: {
      color: themeColors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 6,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.background,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    codeVal: {
      color: '#D97706',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 2,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    copyBtnText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.background,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    linkText: {
      color: themeColors.text,
      fontSize: 12,
      flex: 1,
      marginRight: 8,
    },
    copyLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(26, 92, 57, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    copyLinkText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    shareBtn: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 14,
    },
    shareGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    shareText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: 'bold',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statBox: {
      flex: 1,
      backgroundColor: themeColors.card,
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
    },
    statVal: {
      color: themeColors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    statLabel: {
      color: themeColors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 2,
    },
    milestoneList: {
      gap: 10,
    },
    milestoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: themeColors.background,
      padding: 10,
      borderRadius: 12,
    },
    milestoneIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    milestoneIconText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: 'bold',
    },
    milestoneTitle: {
      color: themeColors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    milestoneDesc: {
      color: themeColors.textSecondary,
      fontSize: 10,
      marginTop: 1,
    },
    milestoneReward: {
      color: '#10B981',
      fontSize: 11,
      fontWeight: 'bold',
    },
    firstTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    firstTimeTitle: {
      color: themeColors.text,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    firstTimeReward: {
      color: '#10B981',
      fontSize: 11,
      fontWeight: 'bold',
    },
    sectionHeader: {
      marginBottom: 8,
    },
    sectionTitle: {
      color: themeColors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    historyList: {
      gap: 8,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.card,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    historyName: {
      color: themeColors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    historyDate: {
      color: themeColors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    historyReward: {
      color: '#10B981',
      fontSize: 11,
      fontWeight: 'bold',
    },
    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.card,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: 8,
      gap: 10,
    },
    txIconBox: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    txTitle: {
      color: themeColors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    txDate: {
      color: themeColors.textSecondary,
      fontSize: 10,
      marginTop: 2,
    },
    txCoins: {
      fontSize: 13,
      fontWeight: '800',
    },
    txRupees: {
      color: themeColors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
    },
    emptyCard: {
      backgroundColor: themeColors.card,
      padding: 30,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      color: themeColors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: themeColors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 36,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      color: themeColors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    modalSummaryBox: {
      backgroundColor: themeColors.background,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
      marginBottom: 16,
    },
    modalSummaryLabel: {
      color: themeColors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    modalSummaryVal: {
      color: '#D97706',
      fontSize: 22,
      fontWeight: '900',
      marginTop: 2,
    },
    modalSummaryRupees: {
      color: '#10B981',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    inputLabel: {
      color: themeColors.text,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    textInput: {
      backgroundColor: themeColors.background,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 12,
      padding: 12,
      color: themeColors.text,
      fontSize: 14,
      marginBottom: 16,
    },
    confirmWithdrawBtn: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    confirmWithdrawGradient: {
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmWithdrawText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });

export default ReferralScreen;
