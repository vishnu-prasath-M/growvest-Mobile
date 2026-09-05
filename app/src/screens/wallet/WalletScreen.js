import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const WalletScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);
  const [coinBalance, setCoinBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWalletData = async () => {
    try {
      const res = await api.get('/wallet/coins');
      if (res && res.data) {
        setCoinBalance(res.data.coinBalance || 0);
        setTransactions(res.data.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching coin wallet:', err);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <TopBar title="Coin Wallet" navigation={navigation} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Coin Hero Card */}
        <View style={styles.heroOuter}>
          <LinearGradient
            colors={isDarkMode ? ['#121F17', '#1A3324'] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>Total Rewards Balance</Text>
              <View style={styles.coinBadge}>
                <Text style={styles.coinBadgeText}>COINS</Text>
              </View>
            </View>

            <View style={styles.amountRow}>
              <Text style={styles.coinIcon}>🪙</Text>
              <Text style={styles.coinValue}>{(coinBalance || 0).toLocaleString('en-IN')}</Text>
              <Text style={styles.coinUnit}>Coins</Text>
            </View>

            <Text style={styles.heroNote}>
              Coins are earned from successful referrals & rewards. Stored safely in your account.
            </Text>
          </LinearGradient>
        </View>

        {/* Quick Info Referral Banner */}
        <TouchableOpacity
          style={styles.referralBanner}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Referral')}
        >
          <View style={styles.bannerIconWrap}>
            <MaterialCommunityIcons name="gift-outline" size={22} color={isDarkMode ? '#34D399' : '#0E3D23'} />
          </View>
          <View style={styles.bannerTextContent}>
            <Text style={styles.bannerTitle}>Earn More Coins</Text>
            <Text style={styles.bannerSub}>Invite friends and earn +100 Coins on every successful investment!</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>

        {/* Coin Transaction History Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>COIN TRANSACTION HISTORY</Text>
            {transactions.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{transactions.length} Records</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : transactions.length > 0 ? (
            <View style={styles.historyGroupCard}>
              {transactions.map((tx, idx) => {
                const coinAmount = Number(tx.coins !== undefined ? tx.coins : tx.amount) || 0;
                const isPositive = coinAmount >= 0;
                const formattedAmount = isPositive ? `+${coinAmount}` : `${coinAmount}`;
                const rupeeValue = (tx.rupeeValue !== undefined ? tx.rupeeValue : (Math.abs(coinAmount) * 0.05)).toFixed(2);

                return (
                  <View key={String(tx._id || idx)}>
                    {idx > 0 && <View style={styles.cardDivider} />}
                    <View style={styles.txRow}>
                      {/* Coin Emoji Icon Container */}
                      <View style={styles.coinEmojiBox}>
                        <Text style={styles.coinEmoji}>🪙</Text>
                      </View>

                      {/* Details Column */}
                      <View style={styles.txContent}>
                        <Text style={styles.txTitle} numberOfLines={1}>
                          {tx.description || 'Reward Coins'}
                        </Text>
                        <View style={styles.txMetaRow}>
                          <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                          <Text style={styles.txDot}>•</Text>
                          <Text style={styles.txStatusText}>
                            {tx.status || 'Completed'}
                          </Text>
                        </View>
                      </View>

                      {/* Coin Amount & Rupee Value */}
                      <View style={styles.txRight}>
                        <Text style={[styles.txAmountText, { color: isPositive ? (isDarkMode ? '#34D399' : '#059669') : '#EF4444' }]}>
                          {formattedAmount} Coins
                        </Text>
                        <Text style={styles.txRupeeValue}>≈ ₹{rupeeValue}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Text style={{ fontSize: 28 }}>🪙</Text>
              </View>
              <Text style={styles.emptyTitle}>No Coin Transactions Yet</Text>
              <Text style={styles.emptySub}>
                Share your referral link with friends to earn your first 100 reward coins!
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
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
    heroOuter: {
      paddingHorizontal: 20,
      marginTop: 16,
      marginBottom: 16,
    },
    heroCard: {
      borderRadius: 24,
      padding: 24,
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
      marginBottom: 12,
    },
    heroLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    coinBadge: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    coinBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FDE047',
      letterSpacing: 0.5,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 12,
    },
    coinIcon: {
      fontSize: 28,
    },
    coinValue: {
      fontSize: 36,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -1,
    },
    coinUnit: {
      fontSize: 16,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.8)',
    },
    heroNote: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.75)',
      lineHeight: 18,
    },
    // Referral Banner
    referralBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 14,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F4F9F4',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E0EAE0',
    },
    bannerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bannerTextContent: {
      flex: 1,
      minWidth: 0,
    },
    bannerTitle: {
      fontSize: 14.5,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 2,
    },
    bannerSub: {
      fontSize: 11.5,
      color: themeColors.textSecondary,
      lineHeight: 16,
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
      marginBottom: 12,
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
    loadingBox: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    // Grouped Card Layout (Modern Unique Design)
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
      paddingVertical: 14,
      gap: 12,
    },
    coinEmojiBox: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    coinEmoji: {
      fontSize: 20,
    },
    txContent: {
      flex: 1,
      minWidth: 0,
    },
    txTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 3,
    },
    txMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    txDate: {
      fontSize: 11.5,
      color: themeColors.textSecondary,
      fontWeight: '500',
    },
    txDot: {
      fontSize: 10,
      color: themeColors.textMuted || '#9CA3AF',
    },
    txStatusText: {
      fontSize: 11,
      fontWeight: '600',
      color: isDarkMode ? '#34D399' : '#059669',
      textTransform: 'capitalize',
    },
    txRight: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    txAmountText: {
      fontSize: 14.5,
      fontWeight: '800',
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    txRupeeValue: {
      fontSize: 11,
      color: themeColors.textMuted || '#9CA3AF',
      fontWeight: '600',
    },
    cardDivider: {
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#EFF1E9',
      marginHorizontal: 16,
    },
    // Empty State
    emptyCard: {
      padding: 32,
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    },
    emptyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 6,
    },
    emptySub: {
      fontSize: 12,
      color: themeColors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 12,
    },
  });

export default WalletScreen;
