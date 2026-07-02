import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MyChitsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetchMyChits();
  }, []);

  const fetchMyChits = async () => {
    try {
      const data = await chitFundService.getMyChits();
      setChits(data);
    } catch (error) {
      console.error('Error fetching my chits:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const getProgressColor = (progress) => {
    if (progress >= 75) return colors.success;
    if (progress >= 50) return colors.warning;
    return colors.info;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Chits</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Your Chits...</Text>
          </View>
        ) : chits.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="cash-remove" size={64} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Chits Joined</Text>
            <Text style={styles.emptySubtitle}>Explore available chit funds and join one!</Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => navigation.navigate('ExploreChits')}
            >
              <Text style={styles.exploreBtnText}>Explore Chits</Text>
            </TouchableOpacity>
          </View>
        ) : (
          chits.map((chit) => {
            const progressColor = getProgressColor(chit.progress);
            return (
              <TouchableOpacity
                key={chit._id}
                style={styles.chitCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ChitDetails', { chitId: chit.chitId, memberId: chit._id })}
              >
                <View style={styles.chitCardHeader}>
                  <View style={styles.chitIconWrap}>
                    <MaterialCommunityIcons name="account-cash" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.chitInfo}>
                    <Text style={styles.chitName}>{chit.chitName}</Text>
                    <Text style={styles.chitMember}>Member #{chit.memberNumber} of {chit.totalMembers}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${chit.progress}%`, backgroundColor: progressColor }]} />
                  </View>
                  <Text style={[styles.progressText, { color: progressColor }]}>{chit.progress}%</Text>
                </View>

                <View style={styles.chitDivider} />

                <View style={styles.chitStats}>
                  <View style={styles.chitStatItem}>
                    <Text style={styles.chitStatLabel}>Month</Text>
                    <Text style={styles.chitStatValue}>{chit.currentMonth}/{chit.duration}</Text>
                  </View>
                  <View style={styles.chitStatItem}>
                    <Text style={styles.chitStatLabel}>Paid</Text>
                    <Text style={styles.chitStatValue}>{formatCurrency(chit.totalPaid)}</Text>
                  </View>
                  <View style={styles.chitStatItem}>
                    <Text style={styles.chitStatLabel}>Remaining</Text>
                    <Text style={styles.chitStatValue}>{formatCurrency(chit.remainingAmount)}</Text>
                  </View>
                </View>

                <View style={styles.chitFooter}>
                  <View style={styles.chitDueRow}>
                    <MaterialCommunityIcons name="calendar-alert" size={16} color={colors.warning} />
                    <Text style={styles.chitDueText}>Next Due: {chit.nextDueDate} - {formatCurrency(chit.nextDueAmount)}</Text>
                  </View>
                  <View style={[styles.winBadge, chit.hasWon ? styles.wonBadge : styles.notWonBadge]}>
                    <MaterialCommunityIcons
                      name={chit.hasWon ? 'trophy' : 'clock-outline'}
                      size={14}
                      color={chit.hasWon ? colors.success : colors.textTertiary}
                    />
                    <Text style={[styles.winBadgeText, { color: chit.hasWon ? colors.success : colors.textTertiary }]}>
                      {chit.hasWon ? 'Won' : 'Not Won'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.detailsBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ChitDetails', { chitId: chit.chitId, memberId: chit._id })}
                >
                  <Text style={styles.detailsBtnText}>View Details</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
                </TouchableOpacity>
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
  scrollContent: { paddingBottom: 20, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  exploreBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, ...colors.shadow.button },
  exploreBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  // Card
  chitCard: {
    backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card,
  },
  chitCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  chitIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  chitInfo: { flex: 1 },
  chitName: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 2 },
  chitMember: { fontSize: 12, color: colors.textSecondary },
  // Progress
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  progressBar: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, marginRight: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 13, fontWeight: '700', width: 40, textAlign: 'right' },
  chitDivider: { height: 1, backgroundColor: colors.borderLight, marginBottom: 16 },
  chitStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  chitStatItem: { alignItems: 'center', flex: 1 },
  chitStatLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  chitStatValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  chitFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  chitDueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  chitDueText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  winBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
  wonBadge: { backgroundColor: colors.successLight },
  notWonBadge: { backgroundColor: '#f3f4f6' },
  winBadgeText: { fontSize: 11, fontWeight: '700' },
  detailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight, paddingVertical: 12, borderRadius: 12, gap: 6,
  },
  detailsBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
});

export default MyChitsScreen;