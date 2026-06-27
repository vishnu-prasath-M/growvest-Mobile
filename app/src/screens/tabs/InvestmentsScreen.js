import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { investmentService } from '../../services/investmentService';
import { authService } from '../../services/authService';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const InvestmentsScreen = () => {
  const insets = useScreenInsets(8);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);

  const fetchInvestments = async () => {
    try {
      const user = await authService.getUserData();
      setUserData(user);
      
      const allInvestments = await investmentService.getInvestments();
      
      // Filter investments for current user
      const userInvestments = allInvestments.filter(inv => 
        inv.userEmail === user?.email || inv.mobileNumber === user?.mobileNumber
      );
      
      setInvestments(userInvestments);
    } catch (error) {
      console.error('Error fetching investments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInvestments();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvestments();
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'rejected':
        return colors.error;
      case 'withdrawn':
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'approved':
        return colors.successLight;
      case 'pending':
        return colors.warningLight;
      case 'rejected':
        return '#fef2f2';
      case 'withdrawn':
        return '#f3f4f6';
      default:
        return '#f3f4f6';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return 'check-circle';
      case 'pending':
        return 'clock-outline';
      case 'rejected':
        return 'close-circle';
      case 'withdrawn':
        return 'bank-transfer-out';
      default:
        return 'help-circle';
    }
  };

  const savingInvestments = investments.filter(inv => inv.type === 'saving');
  const fixedInvestments = investments.filter(inv => inv.type === 'fixed');

  const renderInvestmentCard = (investment) => (
    <View key={investment._id} style={styles.investmentCard}>
      <View style={styles.cardTop}>
        <View style={styles.cardTypeSection}>
          <View style={[styles.typeBadge, { 
            backgroundColor: investment.type === 'saving' ? colors.savingLight : colors.fixedLight 
          }]}>
            <MaterialCommunityIcons 
              name={investment.type === 'saving' ? 'piggy-bank' : 'lock'} 
              size={16} 
              color={investment.type === 'saving' ? colors.saving : colors.fixed} 
            />
            <Text style={[styles.typeText, { 
              color: investment.type === 'saving' ? colors.saving : colors.fixed 
            }]}>
              {investment.type === 'saving' ? 'Saving' : 'Fixed'} Deposit
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: getStatusBg(investment.status) }]}>
            <MaterialCommunityIcons 
              name={getStatusIcon(investment.status)} 
              size={12} 
              color={getStatusColor(investment.status)} 
            />
            <Text style={[styles.statusText, { color: getStatusColor(investment.status) }]}>
              {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Invested Amount</Text>
          <Text style={styles.cardValue}>{formatCurrency(investment.amount)}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Interest Earned</Text>
          <Text style={[styles.cardValue, { color: colors.success }]}>
            +{formatCurrency(investment.interestEarned || 0)}
          </Text>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardRow}>
          <Text style={styles.cardLabelBold}>Current Balance</Text>
          <Text style={[styles.cardValueBold, { color: colors.primary }]}>
            {formatCurrency(investment.amount + (investment.interestEarned || 0))}
          </Text>
        </View>
        <View style={styles.cardRowSmall}>
          <Text style={styles.cardLabelSmall}>Interest Rate</Text>
          <Text style={styles.cardValueSmall}>{investment.interestRate}% p.a.</Text>
        </View>
        <View style={styles.cardRowSmall}>
          <Text style={styles.cardLabelSmall}>Start Date</Text>
          <Text style={styles.cardValueSmall}>{formatDate(investment.startDate)}</Text>
        </View>
        {investment.ref && (
          <View style={styles.cardRowSmall}>
            <Text style={styles.cardLabelSmall}>Reference</Text>
            <Text style={styles.cardValueSmall}>{investment.ref}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderSection = (title, items, emptyIcon, emptyText) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length > 0 ? (
        items.map(renderInvestmentCard)
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name={emptyIcon} size={40} color={colors.border} />
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <MaterialCommunityIcons name="chart-box-outline" size={40} color={colors.primaryLight} />
          <Text style={styles.loadingText}>Loading investments...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.screenHeader, { paddingTop: insets.top }]}>
        <Text style={styles.screenTitle}>My Investments</Text>
        <Text style={styles.screenSubtitle}>
          {investments.length > 0 
            ? `${investments.length} active deposit${investments.length !== 1 ? 's' : ''}`
            : 'Your investment portfolio'}
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
        {renderSection('Saving Deposits', savingInvestments, 'piggy-bank-outline', 'No active saving deposits')}
        {renderSection('Fixed Deposits', fixedInvestments, 'lock-open-outline', 'No active fixed deposits')}
        
        {investments.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons name="chart-box-outline" size={56} color={colors.border} />
            </View>
            <Text style={styles.emptyStateTitle}>No Active Deposits</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start investing to see your deposits here and earn competitive returns
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
    paddingBottom: 20,
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
  screenTitle: {
    ...typography.h2,
    marginBottom: 4,
  },
  screenSubtitle: {
    ...typography.body2,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: 12,
  },
  investmentCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...colors.shadow.card,
  },
  cardTop: {
    padding: 16,
    paddingBottom: 0,
  },
  cardTypeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardBody: {
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 8,
  },
  cardLabelBold: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  cardValueBold: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  cardLabelSmall: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  cardValueSmall: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    ...colors.shadow.card,
  },
  emptyText: {
    ...typography.body2,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
  emptyStateTitle: {
    ...typography.h4,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    ...typography.body2,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default InvestmentsScreen;