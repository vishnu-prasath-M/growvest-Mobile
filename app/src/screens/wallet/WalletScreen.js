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

const WalletScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
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

        {/* Quick Info Banner */}
        <TouchableOpacity
          style={styles.referralBanner}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('Referral')}
        >
          <View style={styles.bannerIconWrap}>
            <MaterialCommunityIcons name="gift-outline" size={24} color="#1A5C39" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Earn More Coins</Text>
            <Text style={styles.bannerSub}>Invite friends and earn +100 Coins on every successful investment!</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textSecondary} />
        </TouchableOpacity>

        {/* Transactions History Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Coin Transaction History</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : transactions.length > 0 ? (
          <View style={styles.txList}>
            {transactions.map((tx) => (
              <View key={tx._id} style={styles.txCard}>
                <View style={styles.txIconWrap}>
                  <MaterialCommunityIcons name="star-circle" size={24} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc}>{tx.description || 'Coin Reward'}</Text>
                  <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                </View>
                <Text style={styles.txAmount}>+{tx.amount} Coins</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="database-remove-outline" size={44} color={themeColors.textSecondary} />
            <Text style={styles.emptyTitle}>No Coin Transactions Yet</Text>
            <Text style={styles.emptySub}>
              Share your referral link with friends to earn your first 100 reward coins!
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
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
    referralBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 16,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#E8F5E9',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(14,61,35,0.1)',
    },
    bannerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
    },
    bannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 2,
    },
    bannerSub: {
      fontSize: 12,
      color: themeColors.textSecondary,
      lineHeight: 16,
    },
    sectionHeader: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: themeColors.text,
    },
    loadingBox: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    txList: {
      paddingHorizontal: 20,
      gap: 10,
    },
    txCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: themeColors.surface || (isDarkMode ? '#141E18' : '#FFFFFF'),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    txIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#FEF3C7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    txDesc: {
      fontSize: 14,
      fontWeight: '700',
      color: themeColors.text,
    },
    txDate: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    txAmount: {
      fontSize: 14,
      fontWeight: '800',
      color: '#1A5C39',
    },
    emptyCard: {
      marginHorizontal: 20,
      padding: 32,
      alignItems: 'center',
      backgroundColor: themeColors.surface2 || (isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF9'),
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 12,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
  });

export default WalletScreen;
