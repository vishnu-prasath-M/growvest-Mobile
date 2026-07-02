import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ExploreChitsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChits();
  }, []);

  const fetchChits = async () => {
    try {
      const data = await chitFundService.getAllChits();
      setChits(data);
    } catch (error) {
      console.error('Error fetching chits:', error);
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'upcoming', label: 'Upcoming' },
  ];

  const filteredChits = chits.filter((chit) => {
    if (filter !== 'all' && chit.status !== filter) return false;
    if (search && !chit.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return colors.success;
      case 'upcoming': return colors.info;
      case 'completed': return colors.textTertiary;
      case 'closed': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'active': return colors.successLight;
      case 'upcoming': return colors.infoLight;
      case 'completed': return '#f3f4f6';
      case 'closed': return '#fee2e2';
      default: return '#f3f4f6';
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Explore Chits</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chit funds..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading Chits...</Text>
          </View>
        ) : filteredChits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chits found.</Text>
          </View>
        ) : (
          filteredChits.map((chit) => (
          <TouchableOpacity
            key={chit._id}
            style={styles.chitCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ChitDetails', { chitId: chit._id })}
          >
            <LinearGradient
              colors={['#ffffff', '#fafafa']}
              style={styles.chitCardInner}
            >
              <View style={styles.chitCardHeader}>
                <View style={styles.chitNameRow}>
                  <View style={styles.chitIconWrap}>
                    <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.chitNameWrap}>
                    <Text style={styles.chitName}>{chit.name}</Text>
                    <Text style={styles.chitDesc} numberOfLines={1}>{chit.description}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(chit.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(chit.status) }]}>
                    {chit.status.charAt(0).toUpperCase() + chit.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.chitDivider} />

              <View style={styles.chitDetailsGrid}>
                <View style={styles.chitDetailItem}>
                  <Text style={styles.chitDetailLabel}>Monthly</Text>
                  <Text style={styles.chitDetailValue}>{formatCurrency(chit.monthlyAmount)}</Text>
                </View>
                <View style={styles.chitDetailItem}>
                  <Text style={styles.chitDetailLabel}>Duration</Text>
                  <Text style={styles.chitDetailValue}>{chit.duration}mo</Text>
                </View>
                <View style={styles.chitDetailItem}>
                  <Text style={styles.chitDetailLabel}>Members</Text>
                  <Text style={styles.chitDetailValue}>{chit.totalMembers}</Text>
                </View>
                <View style={styles.chitDetailItem}>
                  <Text style={styles.chitDetailLabel}>Slots</Text>
                  <Text style={styles.chitDetailValue}>{chit.availableSlots}</Text>
                </View>
              </View>

              <View style={styles.chitPotRow}>
                <Text style={styles.chitPotLabel}>Total Pot</Text>
                <Text style={styles.chitPotValue}>{formatCurrency(chit.totalPot)}</Text>
              </View>

              <View style={styles.chitDates}>
                <View style={styles.chitDateItem}>
                  <MaterialCommunityIcons name="calendar-start" size={14} color={colors.textTertiary} />
                  <Text style={styles.chitDateText}>Start: {chit.startDate}</Text>
                </View>
                <View style={styles.chitDateItem}>
                  <MaterialCommunityIcons name="calendar-end" size={14} color={colors.textTertiary} />
                  <Text style={styles.chitDateText}>End: {chit.endDate}</Text>
                </View>
              </View>

              {chit.features && (
                <View style={styles.featureRow}>
                  {chit.features.map((f, i) => (
                    <View key={i} style={styles.featureChip}>
                      <Text style={styles.featureChipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.joinBtn, chit.availableSlots === 0 && styles.joinBtnDisabled]}
                activeOpacity={0.85}
                onPress={() => {
                  if (chit.availableSlots > 0) {
                    navigation.navigate('JoinChit', { chitId: chit._id });
                  }
                }}
              >
                <Text style={[styles.joinBtnText, chit.availableSlots === 0 && styles.joinBtnTextDisabled]}>
                  {chit.availableSlots === 0 ? 'Full' : 'Join Now'}
                </Text>
                {chit.availableSlots > 0 && (
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.white} />
                )}
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        )))}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    ...colors.shadow.card,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: colors.text },
  filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 10 },
  filterChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },
  // Card
  chitCard: {
    borderRadius: 20, marginBottom: 16,
    ...colors.shadow.card,
  },
  chitCardInner: { borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.borderLight },
  chitCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  chitNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  chitIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  chitNameWrap: { flex: 1 },
  chitName: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 2 },
  chitDesc: { fontSize: 12, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  chitDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  chitDetailsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  chitDetailItem: { alignItems: 'center', flex: 1 },
  chitDetailLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  chitDetailValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  chitPotRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.primaryLight, padding: 12, borderRadius: 12, marginBottom: 12,
  },
  chitPotLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chitPotValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  chitDates: { marginBottom: 12, gap: 6 },
  chitDateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chitDateText: { fontSize: 12, color: colors.textSecondary },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  featureChip: {
    backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight,
  },
  featureChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 14, gap: 8,
    ...colors.shadow.button,
  },
  joinBtnDisabled: { backgroundColor: colors.border },
  joinBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  joinBtnTextDisabled: { color: colors.textTertiary },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});

export default ExploreChitsScreen;