import React, { useState, useEffect } from 'react';
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
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { chitFundService } from '../../services/chitFundService';
import TopBar from '../../components/TopBar';
import StatusChip from '../../components/StatusChip';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ExploreChitsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [chits, setChits] = useState([]);
  const [myChits, setMyChits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChits();
    fetchMyChits();
  }, []);

  const fetchChits = async () => {
    try {
      const data = await chitFundService.getChits();
      setChits(data);
    } catch (error) {
      console.error('Error fetching chits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyChits = async () => {
    try {
      const data = await chitFundService.getMyChits();
      setMyChits(data);
    } catch (error) {
      console.error('Error fetching my chits:', error);
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

  return (
    <View style={styles.container}>
      <TopBar title="Explore Chits" navigation={navigation} showBack />

      {/* Search Bar */}
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

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            activeOpacity={0.8}
            onPress={() => setFilter(f.key)}
          >
            {filter === f.key ? (
              <LinearGradient
                colors={['#0E3D23', '#1A5C39']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.filterChipActive}
              >
                <Text style={styles.filterChipTextActive}>{f.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>{f.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading Chits...</Text>
          </View>
        ) : filteredChits.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="treasure-chest" size={48} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No Chits Found</Text>
            <Text style={styles.emptyBody}>Try adjusting your filters or search.</Text>
          </View>
        ) : (
          filteredChits.map((chit) => {
            const isFull = chit.availableSlots === 0;
            const isClosed = chit.status === 'closed' || chit.status === 'completed' || chit.status === 'archived';
            const hasJoined = myChits.some(m => m.chitId === chit._id);
            return (
              <TouchableOpacity
                key={chit._id}
                style={styles.chitCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (!isFull && !hasJoined && !isClosed) {
                    navigation.navigate('ChitDetails', { chitId: chit._id });
                  }
                }}
              >
                <View style={styles.chitCardHeader}>
                  <View style={styles.chitNameRow}>
                    <View style={styles.chitIconWrap}>
                      <MaterialCommunityIcons name="treasure-chest" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.chitNameWrap}>
                      <Text style={styles.chitName}>{chit.name}</Text>
                      <Text style={styles.chitDesc} numberOfLines={1}>{chit.description}</Text>
                    </View>
                  </View>
                  <StatusChip status={chit.status.charAt(0).toUpperCase() + chit.status.slice(1)} />
                </View>

                <View style={styles.chitPotRow}>
                  <Text style={styles.chitPotLabel}>Total Pot</Text>
                  <Text style={styles.chitPotValue}>{formatCurrency(chit.totalPot)}</Text>
                </View>

                <View style={styles.chitDetailsGrid}>
                  <View style={styles.chitDetailItem}>
                    <Text style={styles.chitDetailLabel}>Monthly</Text>
                    <Text style={styles.chitDetailValue}>{formatCurrency(chit.monthlyAmount)}</Text>
                  </View>
                  <View style={styles.chitDetailItem}>
                    <Text style={styles.chitDetailLabel}>Duration</Text>
                    <Text style={styles.chitDetailValue}>{chit.duration} mo</Text>
                  </View>
                  <View style={styles.chitDetailItem}>
                    <Text style={styles.chitDetailLabel}>Slots Left</Text>
                    <Text style={styles.chitDetailValue}>{chit.availableSlots}</Text>
                  </View>
                </View>

                <View style={styles.chitDivider} />

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

                <TouchableOpacity
                  style={[styles.joinBtnOuter, (isFull || hasJoined || isClosed) && styles.joinBtnDisabled]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!isFull && !hasJoined && !isClosed) {
                      navigation.navigate('JoinChit', { chitId: chit._id });
                    }
                  }}
                  disabled={isFull || hasJoined || isClosed}
                >
                  <LinearGradient
                    colors={(isFull || hasJoined || isClosed) ? [colors.muted, colors.muted] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.joinBtnGradient}
                  >
                    <Text style={[styles.joinBtnText, (isFull || hasJoined || isClosed) && styles.joinBtnTextDisabled]}>
                      {isFull ? 'Chit Full' : isClosed ? 'Closed' : hasJoined ? 'Already Joined' : 'Join Chit'}
                    </Text>
                    {!(isFull || hasJoined || isClosed) && <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />}
                  </LinearGradient>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  
  searchContainer: { paddingHorizontal: 16, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 16, paddingHorizontal: 16, height: 50,
    borderWidth: 1.5, borderColor: colors.border,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: colors.text },
  
  // Filters
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  filterChip: {
    backgroundColor: colors.surface, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 9,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  filterChipActive: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  filterChipTextActive: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Empty
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Card
  chitCard: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface,
    borderRadius: 24, padding: 16,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  chitCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  chitNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  chitIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  chitNameWrap: { flex: 1 },
  chitName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  chitDesc: { fontSize: 13, color: colors.textMuted },
  
  chitPotRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(212,168,67,0.1)', padding: 12, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.3)',
  },
  chitPotLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  chitPotValue: { fontSize: 18, fontWeight: '800', color: '#B48A28', letterSpacing: -0.5 },

  chitDetailsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  chitDetailItem: { flex: 1 },
  chitDetailLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  chitDetailValue: { fontSize: 15, fontWeight: '700', color: colors.text },

  chitDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: 16 },

  chitDates: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  chitDateItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chitDateText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  joinBtnOuter: { shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  joinBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, gap: 8 },
  joinBtnDisabled: { opacity: 0.8, elevation: 0, shadowOpacity: 0 },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  joinBtnTextDisabled: { color: colors.textMuted },
});

export default ExploreChitsScreen;