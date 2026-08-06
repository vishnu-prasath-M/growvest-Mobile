import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { transactionService } from '../../services/transactionService';
import { authService } from '../../services/authService';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';
import StatusChip from '../../components/StatusChip';
import { generateAndShareTransactionStatement } from '../../utils/pdfGenerator';

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Transactions' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'investment', label: 'Investment Deposits' },
  { id: 'withdrawal', label: 'Withdrawals' },
  { id: 'chit_join', label: 'Chit Join' },
  { id: 'chit_payment', label: 'Monthly Due Payments' },
  { id: 'chit_winning', label: 'Chit Winning Credit' },
  { id: 'fixed', label: 'Fixed Deposit' },
  { id: 'savings', label: 'Savings Deposit' },
  { id: 'approved', label: 'Success' },
  { id: 'pending', label: 'Pending' },
  { id: 'rejected', label: 'Failed' },
];

const TransactionsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const canGoBack = navigation?.canGoBack?.() ?? false;
  const [currentUser, setCurrentUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const fetchTransactions = async () => {
    try {
      const user = await authService.getUserData();
      setCurrentUser(user);
      const data = await transactionService.getMyTransactions();
      const userTransactions = Array.isArray(data)
        ? data.filter(
            (tx) =>
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
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'paid' || s === 'approved') return 'Success';
    if (s === 'rejected' || s === 'failed') return 'Failed';
    return 'Pending';
  };

  const getTransactionLabel = (tx) => {
    if (tx.type === 'investment') {
      if (tx.description && tx.description.toLowerCase().includes('saving')) return 'Savings Deposit';
      if (tx.description && tx.description.toLowerCase().includes('fixed')) return 'Fixed Deposit';
      return 'Investment Deposit';
    }
    const map = {
      chit_join: 'Chit Fund Join',
      chit_payment: 'Monthly Due Payment',
      chit_winning: 'Chit Winning Credit',
      withdrawal: 'Withdrawal',
    };
    return map[tx.type] || tx.type;
  };

  const isInvestmentType = (type) => {
    return ['investment', 'chit_join', 'chit_payment', 'chit_winning'].includes(type);
  };

  // Combined Search + Filter logic
  const filteredTxns = transactions.filter((tx) => {
    const statusLabel = getStatusLabel(tx.status).toLowerCase();
    const txLabel = getTransactionLabel(tx).toLowerCase();
    const desc = (tx.description || '').toLowerCase();

    // Filter check
    if (selectedFilter !== 'all') {
      const txDate = new Date(tx.createdAt);
      const today = new Date();

      if (selectedFilter === 'last_week') {
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);
        if (txDate < lastWeek) return false;
      } else if (selectedFilter === 'last_month') {
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        if (txDate < lastMonth) return false;
      } else if (selectedFilter === 'last_3_months') {
        const last3Months = new Date();
        last3Months.setMonth(today.getMonth() - 3);
        if (txDate < last3Months) return false;
      } else if (selectedFilter === 'investment' && tx.type !== 'investment') return false;
      else if (selectedFilter === 'withdrawal' && tx.type !== 'withdrawal') return false;
      else if (selectedFilter === 'chit_join' && tx.type !== 'chit_join') return false;
      else if (selectedFilter === 'chit_payment' && tx.type !== 'chit_payment') return false;
      else if (selectedFilter === 'fixed' && !(tx.type === 'investment' && desc.includes('fixed'))) return false;
      else if (selectedFilter === 'savings' && !(tx.type === 'investment' && desc.includes('saving'))) return false;
      else if (selectedFilter === 'approved' && statusLabel !== 'success') return false;
      else if (selectedFilter === 'pending' && statusLabel !== 'pending') return false;
      else if (selectedFilter === 'rejected' && statusLabel !== 'failed') return false;
    }

    // Search query check
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const dateStr = formatDate(tx.createdAt).toLowerCase();
      const amountStr = String(tx.amount || '');
      const refStr = String(tx.referenceId || tx._id || '').toLowerCase();
      const matches =
        txLabel.includes(q) ||
        desc.includes(q) ||
        dateStr.includes(q) ||
        amountStr.includes(q) ||
        refStr.includes(q);
      if (!matches) return false;
    }

    return true;
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

  const handleDownloadStatement = async () => {
    if (filteredTxns.length === 0) {
      Alert.alert('No Transactions', 'There are no transactions to generate a statement.');
      return;
    }
    setDownloadingPdf(true);
    await generateAndShareTransactionStatement(currentUser, filteredTxns);
    setDownloadingPdf(false);
  };

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

  const activeFilterLabel = FILTER_OPTIONS.find((f) => f.id === selectedFilter)?.label || 'All';

  return (
    <View style={styles.container}>
      <TopBar title="Transactions" navigation={navigation} showBack={canGoBack} />

      {/* Search Bar & Filter Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, selectedFilter !== 'all' && styles.filterBtnActive]}
          activeOpacity={0.8}
          onPress={() => setFilterModalVisible(true)}
        >
          <MaterialCommunityIcons
            name="tune"
            size={18}
            color={selectedFilter !== 'all' ? colors.white : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Active Filter Indicator */}
      {selectedFilter !== 'all' && (
        <View style={styles.activeFilterChipRow}>
          <Text style={styles.activeFilterChipLabel}>Filter: {activeFilterLabel}</Text>
          <TouchableOpacity onPress={() => setSelectedFilter('all')} style={styles.resetFilterBtn}>
            <MaterialCommunityIcons name="close" size={14} color={colors.primary} />
            <Text style={styles.resetFilterText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

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
                    const isInvestment = isInvestmentType(tx.type);
                    const statusLabel = getStatusLabel(tx.status);
                    const txLabel = getTransactionLabel(tx);
                    return (
                      <View key={tx._id}>
                        {i > 0 && <View style={styles.rowDivider} />}
                        <View style={styles.txRow}>
                          <View
                            style={[
                              styles.txIconCircle,
                              isInvestment ? styles.txIconCredit : styles.txIconDebit,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={isInvestment ? 'arrow-up-right' : 'arrow-down-left'}
                              size={18}
                              color={isInvestment ? colors.success : colors.text}
                            />
                          </View>
                          <View style={styles.txInfo}>
                            <Text style={styles.txTitle} numberOfLines={1}>
                              {txLabel}
                            </Text>
                            <Text style={styles.txSub}>{formatDate(tx.createdAt)}</Text>
                          </View>
                          <View style={styles.txRight}>
                            <Text
                              style={[
                                styles.txAmount,
                                isInvestment ? styles.txAmountCredit : styles.txAmountDebit,
                              ]}
                            >
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
            <TouchableOpacity
              style={styles.downloadBtn}
              activeOpacity={0.85}
              onPress={handleDownloadStatement}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <MaterialCommunityIcons name="receipt" size={16} color={colors.white} />
                  <Text style={styles.downloadBtnText}>Download statement</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="swap-horizontal-bold" size={52} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptyBody}>
              {selectedFilter !== 'all' || searchQuery
                ? 'No transactions match your search or filter criteria.'
                : 'Your investment and withdrawal transactions will appear here.'}
            </Text>
            {(selectedFilter !== 'all' || searchQuery) && (
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={() => {
                  setSelectedFilter('all');
                  setSearchQuery('');
                }}
              >
                <Text style={styles.emptyResetBtnText}>Reset Filter & Search</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {FILTER_OPTIONS.map((opt) => {
                const isSelected = selectedFilter === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.filterOptionRow, isSelected && styles.filterOptionRowSelected]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedFilter(opt.id);
                      setFilterModalVisible(false);
                    }}
                  >
                    <Text style={[styles.filterOptionText, isSelected && styles.filterOptionTextSelected]}>
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => {
                  setSelectedFilter('all');
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.modalResetBtnText}>Reset Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },

  // Search
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
  },

  activeFilterChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  activeFilterChipLabel: { fontSize: 13, fontWeight: '700', color: colors.primary },
  resetFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetFilterText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  // Groups
  group: { paddingHorizontal: 16, marginBottom: 20 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: colors.primary,
    borderRadius: 999,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  downloadBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyResetBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primaryLight, borderRadius: 20 },
  emptyResetBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalCloseBtn: { padding: 4 },
  modalBody: { paddingHorizontal: 16, paddingTop: 8 },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginVertical: 2,
  },
  filterOptionRowSelected: { backgroundColor: colors.primaryLight },
  filterOptionText: { fontSize: 15, fontWeight: '500', color: colors.text },
  filterOptionTextSelected: { fontWeight: '700', color: colors.primary },
  modalFooter: { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight },
  modalResetBtn: { alignItems: 'center', paddingVertical: 12 },
  modalResetBtnText: { fontSize: 14, fontWeight: '700', color: colors.error },
});

export default TransactionsScreen;