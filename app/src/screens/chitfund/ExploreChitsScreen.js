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
import { useTheme } from '../../context/ThemeContext';
import { chitFundService } from '../../services/chitFundService';
import TopBar from '../../components/TopBar';
import StatusChip from '../../components/StatusChip';
import KycRequiredModal from '../../components/KycRequiredModal';
import { kycService } from '../../services/kycService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ExploreChitsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [chits, setChits] = useState([]);
  const [myChits, setMyChits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kycModalVisible, setKycModalVisible] = useState(false);

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

  const [expandedSchedules, setExpandedSchedules] = useState({});

  const toggleSchedule = (chitId) => {
    setExpandedSchedules(prev => ({
      ...prev,
      [chitId]: !prev[chitId],
    }));
  };

  const getActionPercentage = (totalUnits, unit) => {
    const total = Number(totalUnits) || 10;
    const u = Number(unit) || 1;
    const lockedCount = Math.floor((total - 1) / 2);
    if (u <= lockedCount) return null;
    const baseEndPct = total >= 20 ? 8 : 6;
    if (u > total) return 0;
    return baseEndPct + 2 * (total - u);
  };

  const getTotalDividend = (installmentAmount, totalUnits) => {
    const amount = Number(installmentAmount) || 0;
    const units = Number(totalUnits) || 10;
    let sum = 0;
    for (let u = 1; u <= units; u++) {
      const pct = getActionPercentage(units, u);
      if (pct !== null && pct > 0) {
        sum += (amount * pct) / 100;
      }
    }
    return sum;
  };

  const generateCycleSchedule = (installmentAmount, totalUnits) => {
    const amount = Number(installmentAmount) || 200;
    const units = Number(totalUnits) || 10;
    const totalContribution = amount * units;
    const schedule = [];
    
    for (let w = 1; w <= units; w++) {
      const actionPct = getActionPercentage(units, w);
      if (actionPct === null) {
        schedule.push({
          unit: w,
          payment: amount,
          priceAmount: null,
          dividend: null,
          actionPercentage: null,
          totalValue: null,
          isLocked: true
        });
      } else {
        const priceAmount = totalContribution - (totalContribution * actionPct / 100);
        const dividend = (amount * actionPct) / 100;
        const totalDividend = getTotalDividend(amount, units);
        const totalValue = priceAmount + totalDividend;
        const profitPercentage = ((totalValue / totalContribution) * 100).toFixed(1);
        schedule.push({
          unit: w,
          payment: amount,
          priceAmount,
          dividend,
          actionPercentage: actionPct,
          totalValue,
          profitPercentage,
          isLocked: false
        });
      }
    }
    
    const settlementWeek = units + 1;
    const totalDividend = getTotalDividend(amount, units);
    const settlementAmount = totalContribution + totalDividend;
    schedule.push({
      unit: settlementWeek,
      payment: 0,
      priceAmount: null,
      dividend: totalDividend,
      actionPercentage: 0,
      totalValue: settlementAmount,
      profitPercentage: ((settlementAmount / totalContribution) * 100).toFixed(1),
      isSettlement: true
    });
    
    return { schedule, totalDividend, settlementAmount };
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
            const joinedCountForChit = myChits.filter(m => (m.chitId?._id || m.chitId) === chit._id && m.status !== 'cancelled').length;
            const isWeekly = chit.isWeekly !== false;
            const installmentAmount = isWeekly ? (chit.weeklyAmount || chit.monthlyAmount || 200) : (chit.monthlyAmount || 1000);
            const totalUnits = isWeekly ? (chit.totalWeeks || chit.duration || 10) : (chit.duration || 12);
            const isScheduleOpen = Boolean(expandedSchedules[chit._id]);
            const { schedule } = generateCycleSchedule(installmentAmount, totalUnits);

            return (
              <View key={chit._id} style={styles.chitCard}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('ChitDetails', { chitId: chit._id })}
                >
                  <View style={styles.chitCardHeader}>
                    <View style={styles.chitNameRow}>
                      <View style={styles.chitIconWrap}>
                        <MaterialCommunityIcons name="treasure-chest" size={24} color={colors.primary} />
                      </View>
                      <View style={styles.chitNameWrap}>
                        <Text style={styles.chitName}>{chit.name}</Text>
                        <Text style={styles.chitDesc} numberOfLines={1}>{chit.description || `${totalUnits} ${isWeekly ? 'Weeks' : 'Months'} Chit Plan`}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <StatusChip status={chit.status.charAt(0).toUpperCase() + chit.status.slice(1)} />
                      {joinedCountForChit > 0 && (
                        <View style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: '#1A5C39', fontWeight: '700' }}>
                            {joinedCountForChit} Joined
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.chitPotRow}>
                    <Text style={styles.chitPotLabel}>Total Pot</Text>
                    <Text style={styles.chitPotValue}>{formatCurrency(chit.totalPot)}</Text>
                  </View>

                  <View style={styles.chitDetailsGrid}>
                    <View style={styles.chitDetailItem}>
                      <Text style={styles.chitDetailLabel}>{isWeekly ? 'Weekly' : 'Monthly'}</Text>
                      <Text style={styles.chitDetailValue}>{formatCurrency(installmentAmount)}</Text>
                    </View>
                    <View style={styles.chitDetailItem}>
                      <Text style={styles.chitDetailLabel}>Duration</Text>
                      <Text style={styles.chitDetailValue}>{isWeekly ? `${totalUnits} wks` : `${totalUnits} mo`}</Text>
                    </View>
                    <View style={styles.chitDetailItem}>
                      <Text style={styles.chitDetailLabel}>Slots Left</Text>
                      <Text style={styles.chitDetailValue}>{chit.availableSlots}</Text>
                    </View>
                  </View>

                  <View style={styles.chitDivider} />

                  <View style={styles.chitDates}>
                    <View style={styles.chitDateItem}>
                      <MaterialCommunityIcons name="calendar-clock" size={14} color="#10B981" />
                      <Text style={[styles.chitDateText, { color: '#059669', fontWeight: '600' }]}>
                        {isWeekly ? 'Starts Every Sunday • Due on Sunday' : 'Monthly Plan • Due 1st of Month'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Toggle Cycle Schedule Button */}
                <TouchableOpacity
                  style={styles.scheduleToggleBtn}
                  activeOpacity={0.7}
                  onPress={() => toggleSchedule(chit._id)}
                >
                  <MaterialCommunityIcons
                    name="calendar-month-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.scheduleToggleText}>
                    {isScheduleOpen ? 'Hide Cycle Schedule' : `View Cycle Schedule (${totalUnits} Cycles)`}
                  </Text>
                  <MaterialCommunityIcons
                    name={isScheduleOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                {/* Inline Cycle Schedule Table */}
                {isScheduleOpen && (
                  <View style={styles.scheduleContainer}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, { width: '16%' }]}>{isWeekly ? 'Wk' : 'Mo'}</Text>
                      <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Pay</Text>
                      <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Price</Text>
                      <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Div</Text>
                      <Text style={[styles.tableHeaderCell, { width: '28%', textAlign: 'right' }]}>Total Payout</Text>
                    </View>
                    {schedule.map((row) => (
                      <View
                        key={row.unit}
                        style={[
                          styles.tableRow,
                          row.isSettlement && styles.tableRowSettlement
                        ]}
                      >
                        <Text style={[styles.tableCell, { width: '16%', fontWeight: '600' }]}>
                          {row.isSettlement ? 'End' : `${isWeekly ? 'W' : 'M'}${row.unit}`}
                        </Text>
                        <Text style={[styles.tableCell, { width: '18%' }]}>
                          {row.payment > 0 ? `₹${row.payment}` : '₹0'}
                        </Text>
                        <Text style={[styles.tableCell, { width: '22%', color: row.isLocked ? colors.textMuted : colors.text }]}>
                          {row.isLocked ? '🔒 Lock' : row.priceAmount ? `₹${row.priceAmount}` : '-'}
                        </Text>
                        <Text style={[styles.tableCell, { width: '16%', color: row.dividend ? '#059669' : colors.textMuted }]}>
                          {row.dividend ? `₹${row.dividend}` : '-'}
                        </Text>
                        <Text style={[styles.tableCell, { width: '28%', textAlign: 'right', fontWeight: '700', color: row.isSettlement ? '#D97706' : '#059669' }]}>
                          {row.isLocked ? '—' : row.totalValue ? `₹${row.totalValue}` : '-'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.joinBtnOuter, (isFull || isClosed) && styles.joinBtnDisabled, { marginTop: 12 }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!isFull && !isClosed) {
                      navigation.navigate('JoinChit', { chitId: chit._id });
                    }
                  }}
                  disabled={isFull || isClosed}
                >
                  <LinearGradient
                    colors={(isFull || isClosed) ? [colors.muted, colors.muted] : ['#0E3D23', '#1A5C39', '#2E8B5A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.joinBtnGradient}
                  >
                    <Text style={[styles.joinBtnText, (isFull || isClosed) && styles.joinBtnTextDisabled]}>
                      {isFull ? 'Chit Full' : isClosed ? 'Closed' : 'Join Chit'}
                    </Text>
                    {!(isFull || isClosed) && <MaterialCommunityIcons name="arrow-right" size={20} color={colors.white} />}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* KYC Required Modal */}
      <KycRequiredModal
        visible={kycModalVisible}
        onClose={() => setKycModalVisible(false)}
        onNavigateToKYC={() => navigation.navigate('KYC')}
      />
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
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
    borderWidth: 1, borderColor: colors.borderLight,
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
    borderWidth: 1, borderColor: colors.borderLight,
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

  scheduleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceVariant || '#F1F5F9',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  scheduleToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  scheduleContainer: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  tableRowSettlement: {
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderRadius: 6,
    borderBottomWidth: 0,
  },
  tableCell: {
    fontSize: 12,
    color: colors.text,
  },

  joinBtnOuter: { shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  joinBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, gap: 8 },
  joinBtnDisabled: { opacity: 0.8, elevation: 0, shadowOpacity: 0 },
  joinBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  joinBtnTextDisabled: { color: colors.textMuted },
});

export default ExploreChitsScreen;