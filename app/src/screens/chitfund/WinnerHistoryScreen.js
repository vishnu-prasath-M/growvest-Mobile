import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';
import { SkeletonLoader } from '../../components/SkeletonLoader';

const WinnerHistoryScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [winners, setWinners] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchWinners();
  }, []);

  const fetchWinners = async () => {
    try {
      const data = await chitFundService.getWinners();
      setWinners(data);
    } catch (error) {
      console.error('Error fetching winners:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Winner History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonLoader variant="list" count={5} />
        ) : winners.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No winners yet.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {winners.map((winner, index) => (
              <View key={winner._id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, index === 0 && styles.timelineDotFirst]}>
                    <MaterialCommunityIcons name="trophy" size={16} color={colors.white} />
                  </View>
                  {index < winners.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCard}>
                  <View style={styles.timelineCardHeader}>
                    <View style={styles.winnerAvatar}>
                      <Text style={styles.winnerAvatarText}>{winner.user?.username?.charAt(0) || 'U'}</Text>
                    </View>
                    <View style={styles.winnerInfo}>
                      <Text style={styles.winnerName}>{winner.user?.username || 'Unknown'}</Text>
                      <Text style={styles.winnerMonth}>Month {winner.month}</Text>
                    </View>
                    <View style={styles.winnerAmountWrap}>
                      <Text style={styles.winnerAmount}>{formatCurrency(winner.winningAmount)}</Text>
                      <Text style={styles.winnerDiscount}>-{formatCurrency(winner.discount)}</Text>
                    </View>
                  </View>
                  <View style={styles.timelineFooter}>
                    <MaterialCommunityIcons name="gift" size={14} color={colors.success} />
                    <Text style={styles.dividendText}>Dividend: {formatCurrency(winner.dividend || 0)}/member</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
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
  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 36, marginRight: 12 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  timelineDotFirst: { backgroundColor: '#d97706' },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.borderLight, marginVertical: -2 },
  timelineCard: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'center' },
  winnerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  winnerAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  winnerInfo: { flex: 1 },
  winnerName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  winnerMonth: { fontSize: 12, color: colors.textSecondary },
  winnerAmountWrap: { alignItems: 'flex-end' },
  winnerAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
  winnerDiscount: { fontSize: 11, color: colors.success, marginTop: 2 },
  timelineFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  dividendText: { fontSize: 12, color: colors.success, fontWeight: '500' },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});

export default WinnerHistoryScreen;