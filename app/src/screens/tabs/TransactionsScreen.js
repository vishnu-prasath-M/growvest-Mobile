import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { transactionService } from '../../services/transactionService';
import { authService } from '../../services/authService';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';
import StatusChip from '../../components/StatusChip';

const TransactionsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const canGoBack = navigation?.canGoBack?.() ?? false;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransactions = async () => {
    try {
      const user = await authService.getUserData();
      const data = await transactionService.getMyTransactions();
      const userTransactions = Array.isArray(data)
        ? data.filter((tx) =>
            (user?._id && String(tx.userId) === String(user._id)) ||
            (user?.email && tx.userEmail?.toLowerCase() === user.email.toLowerCase()) ||
            (user?.mobileNumber && tx.mobileNumber === user.mobileNumber)
          )
        : [];
      setTransactions(userTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusLabel = (status) => {
    const map = { completed: 'Success', paid: 'Success', approved: 'Success', pending: 'Pending', requested: 'Pending', rejected: 'Failed' };
    return map[status] || 'Pending';
  };

  const filteredTxns = transactions.filter((tx) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const label = tx.type === 'investment' ? 'investment deposit' : 'withdrawal';
    return label.includes(q) || formatDate(tx.createdAt).toLowerCase().includes(q);
  });

  // Group by time
  const grouped = (() => {
    const groups = {};
    filteredTxns.forEach((tx) => {
      const label = formatDate(tx.createdAt);
      const key = label === 'Today' || label === 'Yesterday' ? label : 'Earlier';
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    const order = ['Today', 'Yesterday', 'Earlier'];
    return order.filter((k) => groups[k]).map((k) => ({ date: k, items: groups[k] }));
  })();

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar title="Transactions" navigation={navigation} showBack={canGoBack} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconBox}>
            <MaterialCommunityIcons name="swap-horizontal-bold" size={36} color={colors.border} />
          </View>
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar title="Transactions" navigation={navigation} showBack={canGoBack} />

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
          <MaterialCommunityIcons name="tune" size={18} color={colors.text} />
        </TouchableOpacity>
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
        {filteredTxns.length > 0 ? (
          <>
            {grouped.map((group) => (
              <View key={group.date} style={styles.group}>
                <Text style={styles.groupLabel}>{group.date}</Text>
                <View style={styles.groupCard}>
                  {group.items.map((tx, i) => {
                    const isInvestment = tx.type === 'investment';
                    const statusLabel = getStatusLabel(tx.status);
                    return (
                      <View key={tx._id}>
                        {i > 0 && <View style={styles.rowDivider} />}
                        <View style={styles.txRow}>
                          <View style={[styles.txIconCircle, isInvestment ? styles.txIconCredit : styles.txIconDebit]}>
                            <MaterialCommunityIcons
                              name={isInvestment ? 'arrow-up-right' : 'arrow-down-left'}
                              size={18}
                              color={isInvestment ? colors.success : colors.text}
                            />
                          </View>
                          <View style={styles.txInfo}>
                            <Text style={styles.txTitle} numberOfLines={1}>
                              {isInvestment ? 'Investment Deposit' : 'Withdrawal'}
                            </Text>
                            <Text style={styles.txSub}>{formatDate(tx.createdAt)}</Text>
                          </View>
                          <View style={styles.txRight}>
                            <Text style={[styles.txAmount, isInvestment ? styles.txAmountCredit : styles.txAmountDebit]}>
                              {isInvestment ? '+' : '−'} {formatCurrency(tx.amount)}
                            </Text>
                            <StatusChip status={statusLabel} style={{ marginTop: 3, alignSelf: 'flex-end' }} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Download Statement */}
            <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.85}>
              <MaterialCommunityIcons name="receipt" size={16} color={colors.text} />
              <Text style={styles.downloadBtnText}>Download statement</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="swap-horizontal-bold" size={52} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptyBody}>
              Your investment and withdrawal transactions will appear here
            </Text>
          </View>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },

  // Search
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 11, gap: 8,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  filterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  // Groups
  group: { paddingHorizontal: 16, marginBottom: 20 },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, opacity: 0.6, marginHorizontal: 16 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  txIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txIconCredit: { backgroundColor: colors.successLight },
  txIconDebit: { backgroundColor: colors.accent },
  txInfo: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  txSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountCredit: { color: colors.success },
  txAmountDebit: { color: colors.text },

  // Download
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 4, paddingVertical: 14,
    backgroundColor: colors.surface, borderRadius: 999,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  downloadBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});

export default TransactionsScreen;