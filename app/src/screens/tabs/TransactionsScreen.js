import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { transactionService } from '../../services/transactionService';
import { authService } from '../../services/authService';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const TransactionsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const canGoBack = navigation?.canGoBack?.() ?? false;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'paid':
      case 'approved':
        return colors.success;
      case 'pending':
      case 'requested':
        return colors.warning;
      case 'rejected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'completed':
      case 'paid':
      case 'approved':
        return colors.successLight;
      case 'pending':
      case 'requested':
        return colors.warningLight;
      case 'rejected':
        return '#fef2f2';
      default:
        return '#f3f4f6';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'paid':
      case 'approved':
        return 'check-circle';
      case 'pending':
      case 'requested':
        return 'clock-outline';
      case 'rejected':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getTypeIcon = (type) => {
    return type === 'investment' ? 'chart-line' : 'bank-transfer-out';
  };

  const getTypeColor = (type) => {
    return type === 'investment' ? colors.primary : '#16a34a';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <MaterialCommunityIcons name="swap-horizontal-bold" size={40} color={colors.primaryLight} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={[styles.screenHeader, { paddingTop: insets.top }]}>
        {canGoBack ? (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.screenTitle}>Transactions</Text>
        <Text style={styles.screenSubtitle}>
          {transactions.length > 0 
            ? `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`
            : 'Your transaction history'}
        </Text>
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
        {transactions.length > 0 ? (
          transactions.map((transaction, index) => (
            <View key={transaction._id} style={styles.transactionCard}>
              <View style={styles.transactionTop}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.typeIconWrapper, { backgroundColor: getTypeColor(transaction.type) + '15' }]}>
                    <MaterialCommunityIcons 
                      name={getTypeIcon(transaction.type)} 
                      size={22} 
                      color={getTypeColor(transaction.type)} 
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionType}>
                      {transaction.type === 'investment' ? 'Investment Deposit' : 'Withdrawal'}
                    </Text>
                    <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
                  </View>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'investment' ? colors.primary : colors.success }
                  ]}>
                    {transaction.type === 'investment' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.transactionBottom}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(transaction.status) }]}>
                  <MaterialCommunityIcons 
                    name={getStatusIcon(transaction.status)} 
                    size={12} 
                    color={getStatusColor(transaction.status)} 
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(transaction.status) }]}>
                    {(transaction.status).charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Text>
                </View>
                {transaction.description && (
                  <Text style={styles.description} numberOfLines={1}>
                    {transaction.description}
                  </Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons name="swap-horizontal-bold" size={56} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your investment and withdrawal transactions will appear here
            </Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body1,
    color: colors.textTertiary,
    marginTop: 12,
  },
  screenHeader: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: -8,
  },
  screenTitle: {
    ...typography.h2,
    marginBottom: 4,
  },
  screenSubtitle: {
    ...typography.body2,
  },
  transactionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...colors.shadow.card,
  },
  transactionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  transactionBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...colors.shadow.card,
  },
  emptyTitle: {
    ...typography.h4,
    marginBottom: 8,
  },
  emptySubtitle: {
    ...typography.body2,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default TransactionsScreen;