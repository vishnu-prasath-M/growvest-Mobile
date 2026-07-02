import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const DividendHistoryScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [dividends, setDividends] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchDividends();
  }, []);

  const fetchDividends = async () => {
    try {
      const data = await chitFundService.getDividends();
      setDividends(data);
    } catch (error) {
      console.error('Error fetching dividends:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const totalDividend = dividends.reduce((sum, d) => sum + (d.status === 'credited' || d.status === 'paid' ? d.amount : 0), 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dividend History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Dividend Card */}
        <View style={styles.totalCard}>
          <MaterialCommunityIcons name="gift" size={32} color={colors.primary} />
          <Text style={styles.totalLabel}>Total Dividend Received</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalDividend)}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Dividends...</Text>
          </View>
        ) : dividends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No dividends received yet.</Text>
          </View>
        ) : (
          dividends.map((div) => (
            <View key={div._id} style={styles.dividendCard}>
              <View style={styles.dividendLeft}>
                <View style={[styles.dividendDot, { backgroundColor: div.status === 'credited' || div.status === 'paid' ? colors.success : colors.textTertiary }]}>
                  <MaterialCommunityIcons
                    name={div.status === 'credited' || div.status === 'paid' ? 'check' : 'clock-outline'}
                    size={14}
                    color={colors.white}
                  />
                </View>
                <View>
                  <Text style={styles.dividendMonth}>Month {div.month}</Text>
                  <Text style={styles.dividendDate}>{div.creditedAt || 'Pending'}</Text>
                </View>
              </View>
              <View style={styles.dividendRight}>
                <Text style={[styles.dividendAmount, { color: div.status === 'credited' || div.status === 'paid' ? colors.success : colors.textTertiary }]}>
                  {formatCurrency(div.amount)}
                </Text>
                <View style={[styles.dividendStatus, { backgroundColor: div.status === 'credited' || div.status === 'paid' ? colors.successLight : '#f3f4f6' }]}>
                  <Text style={[styles.dividendStatusText, { color: div.status === 'credited' || div.status === 'paid' ? colors.success : colors.textTertiary }]}>
                    {div.status.charAt(0).toUpperCase() + div.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          ))
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
  totalCard: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 20, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  totalLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 32, fontWeight: '800', color: colors.success, marginTop: 4 },
  dividendCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card,
  },
  dividendLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividendDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dividendMonth: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  dividendDate: { fontSize: 11, color: colors.textSecondary },
  dividendRight: { alignItems: 'flex-end' },
  dividendAmount: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  dividendStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  dividendStatusText: { fontSize: 10, fontWeight: '700' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});

export default DividendHistoryScreen;