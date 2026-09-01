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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import StatusChip from './StatusChip';

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
  const isMatured = item.maturityDate && new Date() >= new Date(item.maturityDate);
  const isWithdrawn = item.status === 'withdrawn' || item.withdrawalStatus === 'withdrawn';
  const isPending = item.status === 'pending';

  let statusText = 'Pending';
  if (isWithdrawn) statusText = 'Withdrawn';
  else if (isMatured && item.status === 'approved') statusText = 'Matured';
  else if (item.status === 'approved') statusText = 'Locked';
  else if (item.status === 'rejected') statusText = 'Failed';

  const principal = Number(item.amount) || 0;
  const rate = Number(item.interestRate) || 12;
  const dailyInterest = (principal * rate) / 100 / 365;
  const accrued = Number(item.accruedInterest || item.interestEarned) || 0;
  const maturityAmount = Number(item.maturityAmount) || (principal + (item.totalInterest || 0));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIconWrap}>
                  <MaterialCommunityIcons
                    name={isSaving ? 'piggy-bank' : 'lock-outline'}
                    size={24}
                    color="#1A5C39"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.displayName || 'Deposit Plan'}</Text>
                  {item.ref ? <Text style={styles.refText}>Ref: {item.ref}</Text> : null}
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <MaterialCommunityIcons name="close" size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {/* Status & Banner */}
                <View style={styles.statusBox}>
                  <StatusChip status={statusText} />
                  <Text style={styles.statusNote}>
                    {isWithdrawn
                      ? 'Already withdrawn to bank account'
                      : isMatured
                      ? '✅ Plan matured — ready for withdrawal or reinvestment'
                      : isPending
                      ? '⏳ Awaiting admin review'
                      : `🔒 Locked until ${formatDate(item.maturityDate)}`}
                  </Text>
                </View>

                {/* Amount Hero */}
                <View style={styles.amountHero}>
                  <Text style={styles.amountLabel}>Principal Investment</Text>
                  <Text style={styles.amountValue}>{formatCurrency(principal)}</Text>
                </View>

                {/* Detail Grid */}
                <View style={styles.grid}>
                  <View style={styles.gridRow}>
                    <Text style={styles.gridLabel}>Interest Rate</Text>
                    <Text style={styles.gridValue}>{rate}% p.a.</Text>
                  </View>

                  <View style={styles.gridRow}>
                    <Text style={styles.gridLabel}>Per-day Earnings</Text>
                    <Text style={styles.gridValue}>{formatCurrency(dailyInterest)}/day</Text>
                  </View>

                  <View style={styles.gridRow}>
                    <Text style={styles.gridLabel}>Accrued Interest So Far</Text>
                    <Text style={[styles.gridValue, { color: '#1A5C39', fontWeight: '800' }]}>
                      +{formatCurrency(accrued)}
                    </Text>
                  </View>

                  <View style={styles.gridRow}>
                    <Text style={styles.gridLabel}>Maturity Payout</Text>
                    <Text style={[styles.gridValue, { color: '#B45309', fontWeight: '800' }]}>
                      {formatCurrency(maturityAmount)}
                    </Text>
                  </View>
                </View>

                {/* Date Timeline */}
                <View style={styles.timeline}>
                  <View style={styles.timeItem}>
                    <MaterialCommunityIcons name="calendar-start" size={16} color={themeColors.textSecondary} />
                    <Text style={styles.timeLabel}>Start Date: {formatDate(item.startDate)}</Text>
                  </View>
                  {item.maturityDate ? (
                    <View style={styles.timeItem}>
                      <MaterialCommunityIcons name="calendar-end" size={16} color={themeColors.textSecondary} />
                      <Text style={styles.timeLabel}>Maturity Date: {formatDate(item.maturityDate)}</Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={onClose} style={styles.dismissBtn}>
                  <Text style={styles.dismissBtnText}>Close</Text>
                </TouchableOpacity>

                {isMatured && onReinvest ? (
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onReinvest(item);
                    }}
                    style={[styles.withdrawBtn, { marginRight: onWithdraw && !isWithdrawn ? 8 : 0 }]}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.withdrawGradient}
                    >
                      <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.withdrawText}>Reinvest</Text>
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
                  >
                    <LinearGradient
                      colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.withdrawGradient}
                    >
                      <Text style={styles.withdrawText}>Withdraw</Text>
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
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: Math.min(SCREEN_WIDTH - 32, 380),
      backgroundColor: themeColors.surface || (isDarkMode ? '#141E18' : '#FFFFFF'),
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(14,61,35,0.12)',
      elevation: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    headerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#E8F5E9',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: themeColors.text,
    },
    refText: {
      fontSize: 11,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    closeBtn: {
      padding: 4,
    },
    statusBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(14,61,35,0.04)',
      padding: 12,
      borderRadius: 14,
      marginBottom: 16,
    },
    statusNote: {
      flex: 1,
      fontSize: 12,
      color: themeColors.textSecondary,
      fontWeight: '500',
    },
    amountHero: {
      alignItems: 'center',
      paddingVertical: 14,
      backgroundColor: isDarkMode ? 'rgba(14,61,35,0.2)' : '#E8F5E9',
      borderRadius: 16,
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: 11,
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    amountValue: {
      fontSize: 26,
      fontWeight: '800',
      color: themeColors.text,
      marginTop: 4,
    },
    grid: {
      gap: 10,
      marginBottom: 16,
    },
    gridRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    gridLabel: {
      fontSize: 13,
      color: themeColors.textSecondary,
    },
    gridValue: {
      fontSize: 13,
      fontWeight: '700',
      color: themeColors.text,
    },
    timeline: {
      gap: 8,
      marginBottom: 16,
      padding: 12,
      backgroundColor: themeColors.surface2 || (isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAF9'),
      borderRadius: 12,
    },
    timeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeLabel: {
      fontSize: 12,
      color: themeColors.textSecondary,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    dismissBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    dismissBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.textSecondary,
    },
    withdrawBtn: {
      flex: 1.5,
      height: 46,
      borderRadius: 14,
      overflow: 'hidden',
    },
    withdrawGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    withdrawText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default DepositDetailModal;
