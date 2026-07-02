import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const PaymentHistoryScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [payments, setPayments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await chitFundService.getPaymentHistory();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
      case 'paid': return { icon: 'check-circle', color: colors.success, bg: colors.successLight };
      case 'pending': return { icon: 'clock-outline', color: colors.warning, bg: '#fef9c3' };
      case 'rejected':
      case 'failed': return { icon: 'close-circle', color: colors.error, bg: '#fee2e2' };
      default: return { icon: 'help-circle', color: colors.textTertiary, bg: '#f3f4f6' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Payment History...</Text>
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No payment history found.</Text>
          </View>
        ) : (
          payments.map((payment) => {
            const statusInfo = getStatusIcon(payment.status);
            return (
              <TouchableOpacity
                key={payment._id}
                style={styles.paymentCard}
                activeOpacity={0.85}
                onPress={() => payment.receiptId && navigation.navigate('Receipts', { payment })}
              >
                <View style={styles.paymentLeft}>
                  <View style={[styles.paymentIcon, { backgroundColor: statusInfo.bg }]}>
                    <MaterialCommunityIcons name={statusInfo.icon} size={22} color={statusInfo.color} />
                  </View>
                  <View>
                    <Text style={styles.paymentMonth}>Month {payment.month}</Text>
                    <Text style={styles.paymentDate}>
                      {payment.status === 'approved' || payment.status === 'paid' ? `Paid` : `Status: ${payment.status}`}
                    </Text>
                    {payment.lateFee > 0 && (
                      <Text style={styles.lateFeeText}>Late Fee: {formatCurrency(payment.lateFee)}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount + (payment.lateFee || 0))}</Text>
                  <View style={[styles.paymentStatus, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.paymentStatusText, { color: statusInfo.color }]}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </Text>
                  </View>
                  {payment.receiptId && (
                    <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textTertiary} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  paymentIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  paymentMonth: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  paymentDate: { fontSize: 11, color: colors.textSecondary },
  lateFeeText: { fontSize: 11, color: colors.warning, fontWeight: '500', marginTop: 2 },
  paymentRight: { alignItems: 'flex-end', gap: 4 },
  paymentAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
  paymentStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  paymentStatusText: { fontSize: 10, fontWeight: '700' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});

export default PaymentHistoryScreen;