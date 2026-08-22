import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../context/ThemeContext';
import { chitFundService } from '../../services/chitFundService';
import TopBar from '../../components/TopBar';


const MyChitsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      fetchMyChits();
    }, [])
  );

  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || '0'}`;

  const getProgressColor = (progress) => {
    if (progress >= 75) return colors.success;
    if (progress >= 50) return colors.gold;
    return colors.info;
  };

  return (
    <View style={styles.container}>
      <TopBar title="My Chits" navigation={navigation} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading Your Chits...</Text>
          </View>
        ) : chits.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="account-group" size={48} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No Chits Joined</Text>
            <Text style={styles.emptyBody}>Explore available chit funds and join one!</Text>
            
            <TouchableOpacity
              style={styles.exploreBtnOuter}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ExploreChits')}
            >
              <LinearGradient
                colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.exploreBtnGradient}
              >
                <Text style={styles.exploreBtnText}>Explore Chits</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          chits.map((chit) => {
            const isPending = chit.status === 'pending';
            const isRejected = chit.status === 'rejected';
            const progressColor = getProgressColor(chit.progress);
            return (
              <TouchableOpacity
                key={chit._id}
                style={[
                  styles.chitCard, 
                  isPending && { borderLeftWidth: 4, borderLeftColor: themeColors.warning },
                  isRejected && { borderLeftWidth: 4, borderLeftColor: themeColors.error || '#ef4444' },
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ChitDetails', { chitId: chit.chitId, memberId: chit._id, memberStatus: chit.status })}
              >
                <View style={styles.chitCardHeader}>
                  <View style={[
                    styles.chitIconWrap, 
                    isPending && { backgroundColor: themeColors.warningLight },
                    isRejected && { backgroundColor: '#fee2e2' },
                  ]}>
                    <MaterialCommunityIcons 
                      name={isRejected ? "close-circle-outline" : isPending ? "clock-outline" : "account-group-outline"} 
                      size={24} 
                      color={isRejected ? '#ef4444' : isPending ? themeColors.warning : themeColors.primary} 
                    />
                  </View>
                  <View style={styles.chitInfo}>
                    <Text style={styles.chitName}>{chit.chitName}</Text>
                    <Text style={styles.chitMember}>
                      {isRejected ? 'Request Rejected' : isPending ? 'Joining Request Submitted' : `Member #${chit.memberNumber} of ${chit.totalMembers}`}
                    </Text>
                  </View>
                  <View style={[
                    styles.winBadge, 
                    isPending ? { backgroundColor: themeColors.warningLight } : 
                    isRejected ? { backgroundColor: '#fee2e2' } : 
                    chit.hasWon ? styles.wonBadge : styles.notWonBadge,
                  ]}>
                    <Text style={[styles.winBadgeText, { 
                      color: isPending ? themeColors.warning : 
                             isRejected ? '#ef4444' : 
                             chit.hasWon ? themeColors.success : themeColors.textTertiary 
                    }]}>
                      {isPending ? 'Pending' : isRejected ? 'Rejected' : chit.hasWon ? 'Won' : 'Active'}
                    </Text>
                  </View>
                </View>

                {isRejected ? (
                  <View style={{ backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444', marginBottom: 4 }}>
                      Chit Request Rejected
                    </Text>
                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, lineHeight: 18 }}>
                      {chit.rejectionReason 
                        ? `Reason: ${chit.rejectionReason}` 
                        : 'Your Chit Fund request was not approved. Please contact support for more information.'}
                    </Text>
                  </View>
                ) : isPending ? (
                  <View style={{ backgroundColor: themeColors.warningLight, padding: 12, borderRadius: 12, marginTop: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: themeColors.warning, marginBottom: 4 }}>
                      Waiting for Admin Approval
                    </Text>
                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, lineHeight: 18 }}>
                      Your Chit Fund joining request has been submitted successfully. Please wait until the administrator approves your request.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Progress */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>Payment Progress</Text>
                        <Text style={[styles.progressVal, { color: progressColor }]}>{chit.progress}%</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${chit.progress}%`, backgroundColor: progressColor }]} />
                      </View>
                    </View>

                    <View style={styles.chitDetailsGrid}>
                      <View style={styles.chitDetailItem}>
                        <Text style={styles.chitDetailLabel}>{chit.totalWeeks > 0 ? 'Week' : 'Month'}</Text>
                        <Text style={styles.chitDetailValue}>
                          {chit.totalWeeks > 0 ? Math.max(1, chit.currentWeek || 1) : Math.max(1, chit.currentMonth || 1)}/{chit.duration}
                        </Text>
                      </View>
                      <View style={styles.chitDetailItem}>
                        <Text style={styles.chitDetailLabel}>Paid</Text>
                        <Text style={styles.chitDetailValue}>{formatCurrency(chit.totalPaid)}</Text>
                      </View>
                      <View style={styles.chitDetailItem}>
                        <Text style={styles.chitDetailLabel}>Remaining</Text>
                        <Text style={styles.chitDetailValue}>{formatCurrency(chit.remainingAmount)}</Text>
                      </View>
                    </View>

                    <View style={styles.chitDivider} />

                    <View style={styles.chitFooter}>
                      <View style={styles.chitDueInfo}>
                        <MaterialCommunityIcons name="calendar-alert" size={16} color={colors.gold} />
                        <Text style={styles.chitDueText}>Due {chit.nextDueDate}: {formatCurrency(chit.nextDueAmount)}</Text>
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
                  </>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>

  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20, paddingTop: 20 },
  
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  exploreBtnOuter: { shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  exploreBtnGradient: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  exploreBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  // Card
  chitCard: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface,
    borderRadius: 24, padding: 16,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  chitCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  chitIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  chitInfo: { flex: 1 },
  chitName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
  chitMember: { fontSize: 13, color: colors.textMuted },
  
  // Progress
  progressSection: { marginBottom: 16 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  progressVal: { fontSize: 12, fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  
  chitDetailsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  chitDetailItem: { flex: 1 },
  chitDetailLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  chitDetailValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  
  chitDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginBottom: 16 },
  
  chitFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chitDueInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  chitDueText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  winBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
  wonBadge: { backgroundColor: colors.successLight },
  notWonBadge: { backgroundColor: colors.background },
  winBadgeText: { fontSize: 11, fontWeight: '700' },
});

export default MyChitsScreen;