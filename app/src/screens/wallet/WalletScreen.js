import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

const WalletScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);

  const [cashBalance, setCashBalance] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinRupeeValue, setCoinRupeeValue] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'credits' | 'debits'

  // Add Money Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState('1000');
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [hasClaimedDaily, setHasClaimedDaily] = useState(false);

  const fetchWalletData = async () => {
    try {
      // 1. Try cash wallet overview endpoint
      const res = await api.get('/wallet/overview').catch(() => null);
      if (res && res.data && res.data.success) {
        setCashBalance(Number(res.data.cashBalance ?? res.data.balance) || 0);
        setCoinBalance(Number(res.data.coinBalance) || 0);
        setCoinRupeeValue(Number(res.data.coinRupeeValue) || Number(((res.data.coinBalance || 0) * 0.05).toFixed(2)));
        setHasClaimedDaily(Boolean(res.data.hasClaimedDailyToday));
        setTransactions(res.data.transactions || []);
      } else {
        // Fallback: user profile & coin wallet
        const [userRes, coinRes] = await Promise.all([
          api.get('/users/profile').catch(() => null),
          api.get('/wallet/coins').catch(() => null),
        ]);
        if (userRes?.data?.user) {
          setCashBalance(Number(userRes.data.user.balance) || 0);
        }
        if (coinRes?.data) {
          setCoinBalance(Number(coinRes.data.coinBalance) || 0);
          setCoinRupeeValue(Number(coinRes.data.rupeeValue) || 0);
          setHasClaimedDaily(coinRes.data.hasClaimedDailyToday || false);
        }
      }
    } catch (err) {
      console.error('[WalletScreen] Error fetching wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWalletData();
  }, []);

  const handleProceedAddMoney = () => {
    const numAmount = Math.round(Number(addAmount));
    if (!numAmount || numAmount < 10) {
      Alert.alert('Invalid Amount', 'Please enter a valid top-up amount of at least ₹10.');
      return;
    }

    setShowAddModal(false);
    navigation.navigate('ManualUpiPayment', {
      amount: numAmount,
      paymentType: 'wallet_topup',
      payloadData: { amount: numAmount },
      title: 'Wallet Top-Up',
      returnScreen: 'Wallet',
    });
  };

  const handleClaimDailyLogin = async () => {
    if (hasClaimedDaily || claimingDaily) return;
    setClaimingDaily(true);
    try {
      const res = await api.post('/wallet/daily-login');
      if (res && res.data && res.data.success) {
        setHasClaimedDaily(true);
        Alert.alert('🎉 Daily Reward Claimed!', res.data.message || '+10 Coins added to your rewards!');
        fetchWalletData();
      } else {
        Alert.alert('Notice', res?.data?.message || 'Daily reward already claimed today.');
      }
    } catch (err) {
      Alert.alert('Notice', err?.response?.data?.message || 'Daily reward already claimed for today.');
      setHasClaimedDaily(true);
    } finally {
      setClaimingDaily(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const isCredit = ['wallet_topup', 'pocket_money_payout', 'chit_winning', 'chit_settlement', 'chit_payout'].includes(tx.type);
    if (activeTab === 'credits') return isCredit;
    if (activeTab === 'debits') return !isCredit;
    return true;
  });

  return (
    <View style={styles.container}>
      <TopBar title="Growvest Wallet" navigation={navigation} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* ================================================================= */}
        {/* 1. PRIMARY CASH WALLET HERO CARD                                  */}
        {/* ================================================================= */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={isDarkMode ? ['#0B2B18', '#114B29', '#1A6E3D'] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cashHeroCard}
          >
            <View style={styles.heroTop}>
              <View style={styles.walletHeaderLeft}>
                <MaterialCommunityIcons name="wallet" size={17} color="#D4AF37" />
                <Text style={styles.cashHeroLabel}>AVAILABLE CASH</Text>
              </View>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>INSTANT PAY</Text>
              </View>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.cashAmountValue}>
                {(cashBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            <Text style={styles.cashHeroSub}>
              Use for investments, chit fund dues, daily SIP autopay & instant withdrawals.
            </Text>

            {/* Quick Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.addMoneyBtn}
                activeOpacity={0.85}
                onPress={() => setShowAddModal(true)}
              >
                <MaterialCommunityIcons name="plus-circle" size={18} color="#0E3D23" />
                <Text style={styles.addMoneyText}>Add Money</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.withdrawBtn}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('MainTabs', { screen: 'Withdraw', params: { initialCategory: 'wallet' } })}
              >
                <MaterialCommunityIcons name="arrow-top-right-bold-box-outline" size={18} color="#FFFFFF" />
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ================================================================= */}
        {/* 2. REWARDS / COIN WALLET CARD (PRESERVED)                        */}
        {/* ================================================================= */}
        <View style={styles.rewardsCardOuter}>
          <View style={styles.rewardsCard}>
            <View style={styles.rewardsHeader}>
              <View style={styles.rewardsTitleRow}>
                <View style={styles.coinBadge}>
                  <Text style={styles.coinBadgeIcon}>🪙</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rewardsTitle}>Reward Coins</Text>
                  <Text style={styles.rewardsSubtitle} numberOfLines={1} ellipsizeMode="tail">
                    1 Coin = ₹0.05 • Referral & daily login
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.referralLink}
                onPress={() => navigation.navigate('Referral')}
              >
                <Text style={styles.referralLinkText}>Earn More</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.rewardsBottom}>
              <View>
                <Text style={styles.coinAmountText}>
                  {(coinBalance || 0).toLocaleString('en-IN')} <Text style={{ fontSize: 13, fontWeight: '600' }}>Coins</Text>
                </Text>
                <Text style={styles.coinRupeeSub}>≈ ₹{coinRupeeValue} Value</Text>
              </View>

              <TouchableOpacity
                style={[styles.dailyClaimBtn, hasClaimedDaily && styles.dailyClaimBtnDone]}
                activeOpacity={0.8}
                disabled={hasClaimedDaily || claimingDaily}
                onPress={handleClaimDailyLogin}
              >
                {claimingDaily ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={hasClaimedDaily ? 'check-circle' : 'gift-outline'}
                      size={15}
                      color={hasClaimedDaily ? '#059669' : '#FFFFFF'}
                    />
                    <Text style={[styles.dailyClaimText, hasClaimedDaily && styles.dailyClaimTextDone]}>
                      {hasClaimedDaily ? 'Claimed Today' : 'Daily +10 Coins'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 3. TRANSACTION HISTORY SECTION                                    */}
        {/* ================================================================= */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>WALLET TRANSACTIONS</Text>
            {transactions.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{transactions.length} Records</Text>
              </View>
            )}
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'credits' && styles.tabBtnActive]}
              onPress={() => setActiveTab('credits')}
            >
              <Text style={[styles.tabText, activeTab === 'credits' && styles.tabTextActive]}>Credits (+)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'debits' && styles.tabBtnActive]}
              onPress={() => setActiveTab('debits')}
            >
              <Text style={[styles.tabText, activeTab === 'debits' && styles.tabTextActive]}>Debits (-)</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : filteredTransactions.length > 0 ? (
            <View style={styles.historyGroupCard}>
              {filteredTransactions.map((tx, idx) => {
                const isCredit = ['wallet_topup', 'pocket_money_payout', 'chit_winning', 'chit_settlement', 'chit_payout'].includes(tx.type);
                const isDebit = !isCredit;
                const formattedAmount = `${isCredit ? '+' : '-'}₹${Number(tx.amount || 0).toLocaleString('en-IN')}`;

                let iconName = 'wallet-outline';
                let iconColor = isCredit ? '#059669' : '#DC2626';
                if (tx.type === 'wallet_topup') iconName = 'wallet-plus-outline';
                else if (tx.type === 'wallet_debit') iconName = 'credit-card-fast-outline';
                else if (tx.type === 'investment') iconName = 'chart-line';
                else if (tx.type?.startsWith('chit')) iconName = 'account-group-outline';
                else if (tx.type?.startsWith('sip')) iconName = 'calendar-clock';
                else if (tx.type === 'withdrawal') iconName = 'arrow-top-right';

                return (
                  <View key={String(tx._id || idx)}>
                    {idx > 0 && <View style={styles.cardDivider} />}
                    <View style={styles.txRow}>
                      <View style={[styles.txIconBox, { backgroundColor: isCredit ? (isDarkMode ? 'rgba(5, 150, 105, 0.15)' : '#DCFCE7') : (isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#FEE2E2') }]}>
                        <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
                      </View>

                      <View style={styles.txContent}>
                        <Text style={styles.txTitle} numberOfLines={1}>
                          {tx.description || tx.type?.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        <View style={styles.txMetaRow}>
                          <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                          <Text style={styles.txDot}>•</Text>
                          <Text style={[styles.txStatusText, { color: tx.status === 'approved' || tx.status === 'paid' ? '#059669' : '#D97706' }]}>
                            {tx.status || 'Completed'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.txRight}>
                        <Text style={[styles.txAmountText, { color: isCredit ? (isDarkMode ? '#34D399' : '#059669') : (isDarkMode ? '#F87171' : '#DC2626') }]}>
                          {formattedAmount}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="wallet-outline" size={28} color={themeColors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No Wallet Transactions Yet</Text>
              <Text style={styles.emptySub}>
                Add money to your wallet to start investing, joining chits, and setting up daily SIPs instantly!
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ================================================================= */}
      {/* 4. ADD MONEY TOP-UP MODAL                                         */}
      {/* ================================================================= */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <MaterialCommunityIcons name="wallet-plus" size={22} color={colors.primary} />
                <Text style={styles.modalTitle}>Add Money to Wallet</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Top up your cash balance to invest seamlessly without entering bank details every time.
            </Text>

            {/* Amount Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={addAmount}
                onChangeText={setAddAmount}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={themeColors.textSecondary}
              />
            </View>

            {/* Quick Presets */}
            <View style={styles.presetRow}>
              {PRESET_AMOUNTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.presetBtn, addAmount === String(p) && styles.presetBtnActive]}
                  onPress={() => setAddAmount(String(p))}
                >
                  <Text style={[styles.presetText, addAmount === String(p) && styles.presetTextActive]}>
                    +₹{p.toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.proceedBtn}
              activeOpacity={0.85}
              onPress={handleProceedAddMoney}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.proceedGradient}
              >
                <MaterialCommunityIcons name="shield-check" size={18} color="#FFFFFF" />
                <Text style={styles.proceedBtnText}>
                  Proceed to Pay ₹{Number(addAmount || 0).toLocaleString('en-IN')} via UPI
                </Text>
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
      paddingBottom: 24,
    },
    // Primary Cash Hero Card
    heroOuter: {
      paddingHorizontal: 20,
      marginTop: 16,
      marginBottom: 14,
    },
    cashHeroCard: {
      borderRadius: 24,
      padding: 22,
      elevation: 6,
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
    },
    heroTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    walletHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cashHeroLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.8,
    },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      flexShrink: 0,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34D399',
    },
    activePillText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#A7F3D0',
      letterSpacing: 0.4,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
      marginBottom: 8,
    },
    currencySymbol: {
      fontSize: 26,
      fontWeight: '700',
      color: '#D4AF37',
    },
    cashAmountValue: {
      fontSize: 36,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    cashHeroSub: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.75)',
      lineHeight: 18,
      marginBottom: 18,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
    },
    addMoneyBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#D4AF37',
      paddingVertical: 12,
      borderRadius: 14,
    },
    addMoneyText: {
      fontSize: 13.5,
      fontWeight: '800',
      color: '#0E3D23',
    },
    withdrawBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      paddingVertical: 12,
      borderRadius: 14,
    },
    withdrawBtnText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // Rewards / Coin Card
    rewardsCardOuter: {
      paddingHorizontal: 20,
      marginBottom: 18,
    },
    rewardsCard: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
      padding: 16,
    },
    rewardsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    rewardsTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    coinBadge: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    coinBadgeIcon: {
      fontSize: 18,
    },
    rewardsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text,
    },
    rewardsSubtitle: {
      fontSize: 11,
      color: themeColors.textSecondary,
    },
    referralLink: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    referralLinkText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    rewardsBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#EFF1E9',
    },
    coinAmountText: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.text,
    },
    coinRupeeSub: {
      fontSize: 11.5,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    dailyClaimBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
    },
    dailyClaimBtnDone: {
      backgroundColor: isDarkMode ? 'rgba(5, 150, 105, 0.18)' : '#DCFCE7',
      borderWidth: 1,
      borderColor: '#059669',
    },
    dailyClaimText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dailyClaimTextDone: {
      color: '#059669',
    },
    // Transaction History Section
    sectionContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionHeaderTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: themeColors.textTertiary || '#8E9486',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    countBadge: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#EFF3EB',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    tabBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#EFF2EB',
    },
    tabBtnActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    tabTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    loadingBox: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    historyGroupCard: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
      overflow: 'hidden',
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 12,
    },
    txIconBox: {
      width: 40,
      height: 40,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
    },
    txContent: {
      flex: 1,
      minWidth: 0,
    },
    txTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 2,
    },
    txMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    txDate: {
      fontSize: 11,
      color: themeColors.textSecondary,
    },
    txDot: {
      fontSize: 10,
      color: themeColors.textSecondary,
    },
    txStatusText: {
      fontSize: 10.5,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    txRight: {
      alignItems: 'flex-end',
    },
    txAmountText: {
      fontSize: 14.5,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    cardDivider: {
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#EFF1E9',
      marginHorizontal: 16,
    },
    emptyCard: {
      padding: 32,
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    },
    emptyIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#EFF3EB',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    emptyTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 4,
    },
    emptySub: {
      fontSize: 11.5,
      color: themeColors.textSecondary,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: 14,
    },
    // Top-up Modal Sheet
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: themeColors.surface || (isDarkMode ? '#1E2922' : '#FFFFFF'),
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: themeColors.text,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalDesc: {
      fontSize: 12,
      color: themeColors.textSecondary,
      lineHeight: 17,
      marginBottom: 18,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F4F7F4',
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 14,
    },
    currencyPrefix: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.primary,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 24,
      fontWeight: '800',
      color: themeColors.text,
      padding: 0,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    presetBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E0EAE0',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#FAFCFA',
    },
    presetBtnActive: {
      borderColor: colors.primary,
      backgroundColor: isDarkMode ? 'rgba(14, 61, 35, 0.4)' : '#E3F6EC',
    },
    presetText: {
      fontSize: 12,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    presetTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    proceedBtn: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    proceedGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    proceedBtnText: {
      fontSize: 14.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });

export default WalletScreen;
