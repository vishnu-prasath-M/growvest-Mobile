import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * DepositDetailModal
 *
 * Detailed breakdown modal for Savings / Fixed / Duration deposits.
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
  const isFixed = item.type === 'fixed';
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
  }

  const principal = Number(item.amount || item.investedAmount) || 0;
  const rate = Number(item.interestRate) || 12;
  const dailyInterest = (principal * rate) / 100 / 365;
  const accrued = Number(item.accruedInterest || item.interestEarned) || 0;
  const maturityAmount = Number(item.maturityAmount) || (principal + (item.totalInterest || 0));

  let iconName = 'trending-up';
  if (isSaving) iconName = 'piggy-bank-outline';
  else if (isFixed) iconName = 'lock-outline';
  else if (item._itemType === 'chit') iconName = 'account-group-outline';
  else if (item._itemType === 'pocket_money') iconName = 'wallet-giftcard';

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIconWrap}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={22}
                    color={isDarkMode ? '#34D399' : '#0E3D23'}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.displayName || 'Investment Details'}
                  </Text>
                  {item.ref ? (
                    <Text style={styles.refText}>Ref ID: {item.ref}</Text>
                  ) : (
                    <Text style={styles.refText}>{isSaving ? 'Savings Plan' : 'Fixed Duration Plan'}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea}>
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
                    size={18}
                    color={isDarkMode ? '#34D399' : '#0E3D23'}
                  />
                  <Text style={styles.statusNote}>
                    {isWithdrawn
                      ? 'Already withdrawn to your verified bank account.'
                      : isMatured
                      ? 'Plan matured — ready for instant withdrawal or reinvestment.'
                      : isPending
                      ? 'Payment awaiting admin approval.'
                      : `Principal locked with guaranteed returns until ${formatDate(item.maturityDate)}.`}
                  </Text>
                </View>

                {/* 2x2 Metric Tiles */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricTile}>
                    <View style={styles.tileHeader}>
                      <MaterialCommunityIcons name="percent-outline" size={16} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                      <Text style={styles.tileLabel}>Interest Rate</Text>
                    </View>
                    <Text style={styles.tileValue}>{rate}% p.a.</Text>
                  </View>

                  <View style={styles.metricTile}>
                    <View style={styles.tileHeader}>
                      <MaterialCommunityIcons name="cash-fast" size={16} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                      <Text style={styles.tileLabel}>Daily Earnings</Text>
                    </View>
                    <Text style={styles.tileValue}>{formatCurrency(dailyInterest)}/d</Text>
                  </View>

                  <View style={styles.metricTile}>
                    <View style={styles.tileHeader}>
                      <MaterialCommunityIcons name="trending-up" size={16} color={isDarkMode ? '#34D399' : '#0E3D23'} />
                      <Text style={styles.tileLabel}>Accrued Interest</Text>
                    </View>
                    <Text style={[styles.tileValue, { color: isDarkMode ? '#34D399' : '#059669' }]}>
                      +{formatCurrency(accrued)}
                    </Text>
                  </View>

                  <View style={styles.metricTile}>
                    <View style={styles.tileHeader}>
                      <MaterialCommunityIcons name="trophy-outline" size={16} color="#F59E0B" />
                      <Text style={styles.tileLabel}>Maturity Payout</Text>
                    </View>
                    <Text style={[styles.tileValue, { color: '#F59E0B' }]}>
                      {formatCurrency(maturityAmount)}
                    </Text>
                  </View>
                </View>

                {/* Timeline Box */}
                <View style={styles.timelineBox}>
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineItem}>
                      <Text style={styles.timelineLabel}>START DATE</Text>
                      <Text style={styles.timelineValue}>{formatDate(item.startDate)}</Text>
                    </View>
                    {item.maturityDate ? (
                      <>
                        <MaterialCommunityIcons name="arrow-right" size={16} color={themeColors.textMuted} />
                        <View style={[styles.timelineItem, { alignItems: 'flex-end' }]}>
                          <Text style={styles.timelineLabel}>MATURITY DATE</Text>
                          <Text style={styles.timelineValue}>{formatDate(item.maturityDate)}</Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>
              </ScrollView>

              {/* Actions Footer */}
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    card: {
      width: '100%',
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
      maxHeight: Dimensions.get('window').height * 0.85,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.text,
      letterSpacing: -0.4,
    },
    refText: {
      fontSize: 12,
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
      marginBottom: 10,
    },

    // Hero Principal Card
    heroCardOuter: {
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 12,
    },
    heroCard: {
      padding: 16,
      borderRadius: 20,
      position: 'relative',
    },
    heroBlob: {
      position: 'absolute',
      right: -20,
      bottom: -20,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(212,168,67,0.14)',
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLabel: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '600',
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
      fontSize: 28,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.6,
      marginTop: 4,
    },

    // Status Banner
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F0F4EC',
      padding: 12,
      borderRadius: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E6EAE0',
    },
    statusNote: {
      flex: 1,
      fontSize: 12,
      color: themeColors.textSecondary,
      fontWeight: '500',
      lineHeight: 16,
    },

    // 2x2 Metrics Grid
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    metricTile: {
      width: (SCREEN_WIDTH - 50) / 2,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ECEFE6',
    },
    tileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    tileLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.textMuted,
    },
    tileValue: {
      fontSize: 15,
      fontWeight: '800',
      color: themeColors.text,
      letterSpacing: -0.3,
    },

    // Timeline Box
    timelineBox: {
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF8',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#ECEFE6',
      marginBottom: 10,
    },
    timelineRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    timelineItem: {
      flex: 1,
    },
    timelineLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.textMuted,
      letterSpacing: 0.5,
    },
    timelineValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text,
      marginTop: 2,
    },

    // Actions
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    dismissBtn: {
      flex: 1,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ECEFE6',
    },
    dismissBtnText: {
      fontSize: 15,
      fontWeight: '600',
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
