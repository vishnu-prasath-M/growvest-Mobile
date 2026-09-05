import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * DepositDetailModal
 *
 * Premium detailed breakdown bottom-sheet modal for Investments.
 */
const DepositDetailModal = ({ visible, item, onClose, onWithdraw, onReinvest }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);

  if (!visible || !item) return null;

  const formatCurrency = (val) =>
    `₹${(Number(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isSaving = item.type === 'saving';
  const isFixed = item.type === 'fixed' || item.type === '15_days' || item.type === '1_month' || item.type === '3_months' || item.type === '6_months' || item.type === '1_year';
  const isChit = item._itemType === 'chit' || item.isChit;
  const isPocketMoney = item._itemType === 'pocket_money' || item.isPocketMoney;

  const isMatured = item.maturityDate && new Date() >= new Date(item.maturityDate);
  const isWithdrawn = item.status === 'withdrawn' || item.withdrawalStatus === 'withdrawn';
  const isPending = item.status === 'pending';

  let statusLabel = 'ACTIVE';
  let badgeBg = isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7';
  let badgeColor = isDarkMode ? '#34D399' : '#059669';

  if (isWithdrawn) {
    statusLabel = 'WITHDRAWN';
    badgeBg = isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
    badgeColor = isDarkMode ? '#9CA3AF' : '#64748B';
  } else if (isMatured && item.status === 'approved') {
    statusLabel = 'MATURED';
    badgeBg = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7';
    badgeColor = isDarkMode ? '#34D399' : '#059669';
  } else if (isPending) {
    statusLabel = 'PENDING';
    badgeBg = isDarkMode ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7';
    badgeColor = isDarkMode ? '#FBBF24' : '#D97706';
  } else if (item.status === 'rejected') {
    statusLabel = 'FAILED';
    badgeBg = isDarkMode ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2';
    badgeColor = isDarkMode ? '#F87171' : '#DC2626';
  } else if (isChit && item.hasWon) {
    statusLabel = 'AUCTION WON';
    badgeBg = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7';
    badgeColor = isDarkMode ? '#34D399' : '#059669';
  } else if (isPocketMoney && item.status === 'completed') {
    statusLabel = 'COMPLETED';
    badgeBg = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7';
    badgeColor = isDarkMode ? '#34D399' : '#059669';
  }

  const principal = Number(item.amount || item.investedAmount) || 0;
  const rate = Number(item.interestRate) || 12;
  const dailyInterest = (principal * rate) / 100 / 365;
  const accrued = Number(item.accruedInterest || item.interestEarned) || 0;
  const maturityAmount = Number(item.maturityAmount) || (principal + (item.totalInterest || 0));

  let iconName = 'trending-up';
  if (isSaving) iconName = 'piggy-bank-outline';
  else if (isChit) iconName = 'account-group-outline';
  else if (isPocketMoney) iconName = 'wallet-giftcard';
  else iconName = 'lock-outline';

  const planTitle = item.displayName || item.chitName || (isSaving ? 'Savings Plan' : isChit ? 'Chit Fund Plan' : isPocketMoney ? 'Pocket Money' : 'Fixed Deposit');
  const refId = item.ref || item.refId || (item._id ? `INV-${String(item._id).slice(-6).toUpperCase()}` : null);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop for dismiss */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.card}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <MaterialCommunityIcons
                name={iconName}
                size={20}
                color={isDarkMode ? '#34D399' : '#0E3D23'}
              />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {planTitle}
              </Text>
              <Text style={styles.refText}>
                {refId ? `Ref ID: ${refId}` : (isSaving ? 'Flexible Savings' : 'Guaranteed Returns')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            overScrollMode="always"
          >
            {/* Hero Principal Card */}
            <View style={styles.heroCardOuter}>
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroBlob} />
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroLabel}>Principal Invested</Text>
                  <View style={[styles.heroBadgePill, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.heroBadgeText, { color: badgeColor }]}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.heroAmount}>{formatCurrency(principal)}</Text>
              </LinearGradient>
            </View>

            {/* Status Notice Banner */}
            <View style={styles.statusBox}>
              <MaterialCommunityIcons
                name={isWithdrawn ? 'check-all' : isMatured ? 'check-circle' : isPending ? 'clock-outline' : 'shield-lock-outline'}
                size={16}
                color={isDarkMode ? '#34D399' : '#0E3D23'}
              />
              <Text style={styles.statusNote}>
                {isWithdrawn
                  ? 'Already withdrawn to your verified bank account.'
                  : isMatured
                  ? 'Plan matured — ready for instant withdrawal or reinvestment.'
                  : isPending
                  ? 'Payment awaiting admin approval.'
                  : item.maturityDate
                  ? `Principal locked with guaranteed returns until ${formatDate(item.maturityDate)}.`
                  : 'Active investment earning daily returns.'}
              </Text>
            </View>

            {/* Grouped Details Card (Modern unified card matching Profile & Settings design) */}
            <View style={styles.groupedCard}>
              {/* Interest Rate */}
              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialCommunityIcons name="percent-outline" size={16} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                  </View>
                  <Text style={styles.cardRowLabel}>Interest Rate</Text>
                </View>
                <Text style={styles.cardRowValue}>{rate}% p.a.</Text>
              </View>

              <View style={styles.rowDivider} />

              {/* Daily Earnings */}
              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialCommunityIcons name="cash-fast" size={16} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                  </View>
                  <Text style={styles.cardRowLabel}>Daily Earnings</Text>
                </View>
                <Text style={styles.cardRowValue}>{formatCurrency(dailyInterest)}/day</Text>
              </View>

              <View style={styles.rowDivider} />

              {/* Accrued Interest */}
              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialCommunityIcons name="trending-up" size={16} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                  </View>
                  <Text style={styles.cardRowLabel}>Accrued Interest</Text>
                </View>
                <Text style={[styles.cardRowValue, { color: isDarkMode ? '#34D399' : '#059669' }]}>
                  +{formatCurrency(accrued)}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              {/* Maturity Payout */}
              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialCommunityIcons name="trophy-outline" size={16} color="#F59E0B" />
                  </View>
                  <Text style={styles.cardRowLabel}>Maturity Payout</Text>
                </View>
                <Text style={[styles.cardRowValue, { color: '#F59E0B' }]}>
                  {formatCurrency(maturityAmount)}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              {/* Start Date */}
              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialCommunityIcons name="calendar-start" size={16} color={themeColors.textMuted} />
                  </View>
                  <Text style={styles.cardRowLabel}>Start Date</Text>
                </View>
                <Text style={styles.cardRowValue}>{formatDate(item.startDate || item.joinedAt || item.createdAt)}</Text>
              </View>

              {item.maturityDate ? (
                <>
                  <View style={styles.rowDivider} />
                  {/* Maturity Date */}
                  <View style={styles.cardRow}>
                    <View style={styles.cardRowLeft}>
                      <View style={styles.rowIconWrap}>
                        <MaterialCommunityIcons name="calendar-check" size={16} color={themeColors.textMuted} />
                      </View>
                      <Text style={styles.cardRowLabel}>Maturity Date</Text>
                    </View>
                    <Text style={styles.cardRowValue}>{formatDate(item.maturityDate)}</Text>
                  </View>
                </>
              ) : null}

              {/* Payout Destination */}
              <View style={styles.rowDivider} />
              <View style={styles.cardRow}>
                <View style={styles.cardRowLeft}>
                  <View style={styles.rowIconWrap}>
                    <MaterialCommunityIcons name="bank-outline" size={16} color={themeColors.textMuted} />
                  </View>
                  <Text style={styles.cardRowLabel}>Payout Target</Text>
                </View>
                <Text style={styles.cardRowValue}>Verified Bank Account</Text>
              </View>
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Actions Footer (Fixed at bottom for instant access) */}
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={onClose} style={styles.dismissBtn} activeOpacity={0.7}>
              <Text style={styles.dismissBtnText}>Close</Text>
            </TouchableOpacity>

            {isMatured && onReinvest ? (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onReinvest(item);
                }}
                style={styles.reinvestBtn}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.btnText}>Reinvest</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            {isMatured && !isWithdrawn && onWithdraw ? (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onWithdraw(item);
                }}
                style={styles.withdrawBtn}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnGradient}
                >
                  <MaterialCommunityIcons name="cash-multiple" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.btnText}>Withdraw</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    card: {
      width: '100%',
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
      maxHeight: SCREEN_HEIGHT * 0.85,
      display: 'flex',
      flexDirection: 'column',
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.18)' : '#D1D5DB',
      alignSelf: 'center',
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    headerIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: themeColors.text,
      letterSpacing: -0.3,
    },
    refText: {
      fontSize: 11,
      color: themeColors.textMuted,
      marginTop: 2,
      fontWeight: '500',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F0F2EB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollArea: {
      flexGrow: 0,
      flexShrink: 1,
      marginBottom: 12,
    },
    scrollContent: {
      paddingBottom: 4,
    },

    // Hero Principal Card
    heroCardOuter: {
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: 10,
    },
    heroCard: {
      paddingHorizontal: 18,
      paddingVertical: 16,
      borderRadius: 18,
      position: 'relative',
    },
    heroBlob: {
      position: 'absolute',
      right: -20,
      bottom: -20,
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(212,168,67,0.14)',
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.82)',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    heroBadgePill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    heroBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    heroAmount: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.6,
      marginTop: 4,
    },

    // Status Banner
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F0F4EC',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E6EAE0',
    },
    statusNote: {
      flex: 1,
      fontSize: 11.5,
      color: themeColors.textSecondary,
      fontWeight: '500',
      lineHeight: 16,
    },

    // Unified Grouped Details Card (Consistent with Profile & Settings Cards)
    groupedCard: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
      overflow: 'hidden',
    },
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    cardRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    rowIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#EFF3EB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardRowLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    cardRowValue: {
      fontSize: 13.5,
      fontWeight: '700',
      color: themeColors.text,
      textAlign: 'right',
    },
    rowDivider: {
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#EFF1E9',
      marginHorizontal: 14,
    },

    // Actions
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      paddingTop: 4,
    },
    dismissBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
      backgroundColor: themeColors.surface,
    },
    dismissBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.textSecondary,
    },
    reinvestBtn: {
      flex: 1.2,
      height: 48,
      borderRadius: 16,
      overflow: 'hidden',
    },
    withdrawBtn: {
      flex: 1.2,
      height: 48,
      borderRadius: 16,
      overflow: 'hidden',
    },
    btnGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    btnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default DepositDetailModal;
