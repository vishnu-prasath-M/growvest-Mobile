import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
// Removed RECEIPTS import

const ReceiptsScreen = ({ navigation, route }) => {
  const insets = useScreenInsets(8);
  const { payment } = route.params || {};
  const receipt = payment || {};

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Receipt Card */}
        <View style={styles.receiptOuter}>
          <View style={styles.receiptCard}>
            {/* Header */}
            <View style={styles.receiptHeader}>
              <MaterialCommunityIcons name="leaf" size={32} color={colors.primary} />
              <Text style={styles.receiptBrand}>Growvest</Text>
              <Text style={styles.receiptSubtitle}>Chit Fund Payment Receipt</Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Receipt ID */}
            <View style={styles.receiptIdRow}>
              <Text style={styles.receiptIdLabel}>Receipt #</Text>
              <Text style={styles.receiptIdValue}>{receipt.receiptId}</Text>
            </View>

            {/* Details */}
            <View style={styles.receiptDetails}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Chit Fund</Text>
                <Text style={styles.receiptValue}>{receipt.chitName}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Month</Text>
                <Text style={styles.receiptValue}>{receipt.month}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment Date</Text>
                <Text style={styles.receiptValue}>{receipt.paymentDate}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment Method</Text>
                <Text style={styles.receiptValue}>{receipt.paymentMethod}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Transaction ID</Text>
                <Text style={styles.receiptValue}>{receipt.transactionId}</Text>
              </View>
            </View>

            <View style={styles.receiptDivider} />

            {/* Amount */}
            <View style={styles.receiptAmountSection}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount</Text>
                <Text style={styles.receiptValue}>{formatCurrency(receipt.amount)}</Text>
              </View>
              {receipt.lateFee > 0 && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Late Fee</Text>
                  <Text style={[styles.receiptValue, { color: colors.warning }]}>{formatCurrency(receipt.lateFee)}</Text>
                </View>
              )}
              <View style={styles.receiptTotalRow}>
                <Text style={styles.receiptTotalLabel}>Total Paid</Text>
                <Text style={styles.receiptTotalValue}>{formatCurrency((receipt.amount || 0) + (receipt.lateFee || 0))}</Text>
              </View>
            </View>

            <View style={styles.receiptDivider} />

            {/* Status */}
            <View style={styles.receiptStatusRow}>
              <View style={[styles.receiptStatusBadge, { backgroundColor: receipt.status === 'paid' || receipt.status === 'approved' ? colors.successLight : '#fee2e2' }]}>
                <MaterialCommunityIcons
                  name={receipt.status === 'paid' || receipt.status === 'approved' ? 'check-circle' : 'close-circle'}
                  size={16}
                  color={receipt.status === 'paid' || receipt.status === 'approved' ? colors.success : colors.error}
                />
                <Text style={[styles.receiptStatusText, { color: receipt.status === 'paid' || receipt.status === 'approved' ? colors.success : colors.error }]}>
                  {receipt.status === 'paid' || receipt.status === 'approved' ? 'Payment Successful' : 'Payment Failed'}
                </Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.receiptFooter}>
              <Text style={styles.receiptFooterText}>Thank you for your payment!</Text>
              <Text style={styles.receiptFooterSub}>This is a computer-generated receipt.</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.85}>
            <MaterialCommunityIcons name="download" size={20} color={colors.white} />
            <Text style={styles.downloadBtnText}>Download Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85}>
            <MaterialCommunityIcons name="share-variant" size={20} color={colors.primary} />
            <Text style={styles.shareBtnText}>Share Receipt</Text>
          </TouchableOpacity>
        </View>

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
  receiptOuter: { ...colors.shadow.elevated, borderRadius: 24, marginBottom: 20 },
  receiptCard: { backgroundColor: colors.white, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.borderLight },
  receiptHeader: { alignItems: 'center', marginBottom: 16 },
  receiptBrand: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 8 },
  receiptSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  receiptDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  receiptIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  receiptIdLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  receiptIdValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  receiptDetails: { gap: 4 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  receiptLabel: { fontSize: 13, color: colors.textSecondary },
  receiptValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  receiptAmountSection: { gap: 4 },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  receiptTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  receiptTotalValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
  receiptStatusRow: { alignItems: 'center', marginBottom: 8 },
  receiptStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  receiptStatusText: { fontSize: 13, fontWeight: '700' },
  receiptFooter: { alignItems: 'center', marginTop: 8 },
  receiptFooterText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  receiptFooterSub: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  actions: { gap: 12 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, gap: 8, ...colors.shadow.button },
  downloadBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight, paddingVertical: 14, borderRadius: 16, gap: 8 },
  shareBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});

export default ReceiptsScreen;