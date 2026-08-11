import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';

const AuctionScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const { chitId } = navigation.getState().routes.find(r => r.name === 'Auction')?.params || {};
  const [auction, setAuction] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchAuction();
  }, []);

  const fetchAuction = async () => {
    try {
      // In a real app we'd need a valid chitId, using first chit if not provided
      let targetId = chitId;
      if (!targetId) {
        const chits = await chitFundService.getMyChits();
        if (chits && chits.length > 0) targetId = chits[0].chitId;
      }
      if (targetId) {
        const data = await chitFundService.getAuction(targetId);
        setAuction(data);
      }
    } catch (error) {
      console.error('Error fetching auction:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auction</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <SkeletonLoader variant="list" count={4} />
        ) : !auction ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No active auctions found.</Text>
          </View>
        ) : (
          <>
            {/* Countdown */}
            <View style={styles.countdownCard}>
              <MaterialCommunityIcons name="gavel" size={40} color={colors.primary} />
              <Text style={styles.countdownLabel}>Next Auction</Text>
              <Text style={styles.countdownDate}>{auction.auctionDate}</Text>
              <View style={styles.countdownTimer}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary} />
                <Text style={styles.countdownText}>{auction.countdown || 'Soon'}</Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Auction Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Month</Text>
                <Text style={styles.detailValue}>Month {auction.month}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Participants</Text>
                <Text style={styles.detailValue}>{auction.participants}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Bids</Text>
                <Text style={styles.detailValue}>{auction.totalBids || 0}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Round</Text>
                <Text style={styles.detailValue}>Round {auction.currentRound || 1}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[styles.badge, { backgroundColor: colors.infoLight }]}>
                  <Text style={[styles.badgeText, { color: colors.info }]}>
                    {auction.status?.charAt(0).toUpperCase() + auction.status?.slice(1) || 'Pending'}
                  </Text>
                </View>
              </View>
            </View>

            {auction.winnerName && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Winner</Text>
                <View style={styles.winnerCard}>
                  <View style={styles.winnerAvatar}>
                    <Text style={styles.winnerAvatarText}>{auction.winnerName.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.winnerName}>{auction.winnerName}</Text>
                    <Text style={styles.winnerAmount}>Won: ₹{auction.winningAmount?.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* Coming Soon Banner */}
        <View style={styles.comingSoonCard}>
          <MaterialCommunityIcons name="clock-fast" size={32} color={colors.info} />
          <Text style={styles.comingSoonTitle}>Live Auction Coming Soon</Text>
          <Text style={styles.comingSoonText}>
            We're building a real-time auction experience. You'll be able to place bids, see live updates, and win the chit pot.
          </Text>
          <View style={styles.placeholderBtn}>
            <MaterialCommunityIcons name="gavel" size={20} color={colors.white} />
            <Text style={styles.placeholderBtnText}>Place Bid (Coming Soon)</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  countdownCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 20, padding: 30, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  countdownLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  countdownDate: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 4, marginBottom: 16 },
  countdownTimer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 8 },
  countdownText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  sectionCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  winnerCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.successLight, padding: 16, borderRadius: 14 },
  winnerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
  winnerAvatarText: { fontSize: 20, fontWeight: '700', color: colors.white },
  winnerName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  winnerAmount: { fontSize: 14, color: colors.success, fontWeight: '600' },
  comingSoonCard: { alignItems: 'center', backgroundColor: colors.infoLight, borderRadius: 20, padding: 30, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  comingSoonTitle: { fontSize: 18, fontWeight: '700', color: colors.info, marginTop: 12, marginBottom: 8 },
  comingSoonText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  placeholderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.info, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, gap: 8 },
  placeholderBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});

export default AuctionScreen;