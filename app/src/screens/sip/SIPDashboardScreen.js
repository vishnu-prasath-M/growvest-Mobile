import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { colors } from '../../theme/theme';
import { sipService } from '../../services/sipService';
import { SkeletonLoader } from '../../components/SkeletonLoader';

const SIPDashboardScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const isDark = Boolean(isDarkMode);
  const insets = useScreenInsets(16);
  const styles = React.useMemo(() => getStyles(themeColors, isDark), [themeColors, isDark]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    totalSIPInvested: 0,
    activeSIPCount: 0,
    totalContributionsPaid: 0,
    nextUpcomingDate: null,
  });
  const [sips, setSips] = useState([]);

  const loadSIPData = async () => {
    try {
      const data = await sipService.getMySIPs();
      if (data?.success) {
        setSummary(data.summary || {});
        setSips(data.sips || []);
      }
    } catch (error) {
      console.warn('[SIPDashboard] Error loading SIPs:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSIPData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSIPData();
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
          text: isDark ? '#34D399' : '#15803D',
          icon: 'check-circle-outline',
        };
      case 'completed':
        return {
          label: 'Completed',
          bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
          text: isDark ? '#FBBF24' : '#B45309',
          icon: 'trophy-outline',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
          text: isDark ? '#F87171' : '#B91C1C',
          icon: 'close-circle-outline',
        };
      default:
        return {
          label: status || 'Active',
          bg: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F1F5F9',
          text: isDark ? '#CBD5E1' : '#475569',
          icon: 'clock-outline',
        };
    }
  };

  const getFrequencySubtitle = (sip) => {
    const freq = sip?.frequency || 'monthly';
    const amt = formatCurrency(sip?.amount || 0);
    if (freq === 'daily') {
      return `${amt} / Day • Every day`;
    }
    if (freq === 'weekly') {
      return `${amt} / Week • Every ${sip?.sipDayName || 'week'}`;
    }
    return `${amt} / Month • ${sip?.sipDate || 10}th of every month`;
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SIP</Text>
        <TouchableOpacity
          style={styles.newSipHeaderBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CreateSIP')}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.newSipHeaderBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#085428']} />}
      >
        {/* Hero Title & Subtitle */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Systematic Investment Plan</Text>
          <Text style={styles.mainSubtitle}>
            Invest regularly and build your savings over time with scheduled daily, weekly, or monthly contributions.
          </Text>
        </View>

        {/* Summary Card */}
        <LinearGradient
          colors={['#085428', '#0A6C35', '#043417']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>TOTAL SIP INVESTED</Text>
              <Text style={styles.heroAmount}>{formatCurrency(summary.totalSIPInvested)}</Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="chart-line" size={20} color="#E8D083" />
              <Text style={styles.heroBadgeText}>{summary.activeSIPCount} Active</Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Total Contributions</Text>
              <Text style={styles.heroStatValue}>{summary.totalContributionsPaid}</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Next SIP Date</Text>
              <Text style={styles.heroStatValue}>
                {summary.nextUpcomingDate ? formatDate(summary.nextUpcomingDate) : 'No due'}
              </Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>Status</Text>
              <Text style={styles.heroStatValue}>{summary.activeSIPCount > 0 ? 'Active' : 'Idle'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.startSipBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreateSIP')}
        >
          <LinearGradient
            colors={['#085428', '#0A6C35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startSipGradient}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.startSipBtnText}>Start New SIP</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My SIP Portfolio</Text>
          <Text style={styles.sectionCount}>{sips.length} Plans</Text>
        </View>

        {loading ? (
          <SkeletonLoader variant="list" count={3} />
        ) : sips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="calendar-sync-outline" size={48} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No SIP Plans Active</Text>
            <Text style={styles.emptySubtitle}>
              Start a daily, weekly, or monthly SIP to grow your wealth with discipline.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CreateSIP')}
            >
              <Text style={styles.emptyActionBtnText}>+ Start New SIP</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sips.map((item) => {
            const badge = getStatusBadge(item.status);
            const progress =
              item.totalContributions > 0
                ? Math.min(100, Math.round((item.contributionsCompleted / item.totalContributions) * 100))
                : 0;

            return (
              <TouchableOpacity
                key={item._id}
                style={styles.sipCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('SIPDetails', { sipId: item._id, sipRefId: item.sipId })}
              >
                <View style={styles.sipCardHeader}>
                  <View style={styles.sipIconWrap}>
                    <MaterialCommunityIcons
                      name={
                        item.frequency === 'daily'
                          ? 'calendar-today'
                          : item.frequency === 'weekly'
                          ? 'calendar-week'
                          : 'calendar-sync'
                      }
                      size={22}
                      color="#085428"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.sipCardId}>{item.sipId}</Text>
                    <Text style={styles.sipCardSubtitle}>{getFrequencySubtitle(item)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <MaterialCommunityIcons name={badge.icon} size={14} color={badge.text} />
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressInfoRow}>
                    <Text style={styles.progressLabel}>
                      Contributions: {item.contributionsCompleted} / {item.totalContributions}
                    </Text>
                    <Text style={styles.progressPercent}>{progress}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                </View>

                {/* Details Grid */}
                <View style={styles.cardDetailsGrid}>
                  <View style={styles.cardDetailItem}>
                    <Text style={styles.cardDetailLabel}>TOTAL PAID</Text>
                    <Text style={styles.cardDetailValue}>{formatCurrency(item.totalPaidAmount)}</Text>
                  </View>
                  <View style={styles.cardDetailItem}>
                    <Text style={styles.cardDetailLabel}>PLANNED TOTAL</Text>
                    <Text style={styles.cardDetailValue}>{formatCurrency(item.totalPlannedAmount)}</Text>
                  </View>
                  <View style={styles.cardDetailItem}>
                    <Text style={styles.cardDetailLabel}>NEXT DUE</Text>
                    <Text style={styles.cardDetailValue}>
                      {item.nextContributionDate ? formatDate(item.nextContributionDate) : 'Completed'}
                    </Text>
                  </View>
                </View>

                {/* Card Action */}
                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailsText}>View Details & Contributions</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#085428" />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (themeColors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background || (isDark ? '#08120B' : '#F8FAFC'),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    newSipHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#085428',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 4,
    },
    newSipHeaderBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    titleSection: {
      marginBottom: 16,
    },
    mainTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
      marginBottom: 4,
    },
    mainSubtitle: {
      fontSize: 14,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      lineHeight: 20,
    },
    heroCard: {
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    heroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#93C5FD',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    heroAmount: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    heroBadgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    heroDivider: {
      height: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      marginVertical: 14,
    },
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    heroStatItem: {
      flex: 1,
    },
    heroStatLabel: {
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: 2,
    },
    heroStatValue: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    startSipBtn: {
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 20,
    },
    startSipGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    startSipBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    sectionCount: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    sipCard: {
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    sipCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sipIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sipCardId: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text || (isDark ? '#FFFFFF' : '#0F172A'),
    },
    sipCardSubtitle: {
      fontSize: 13,
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    progressContainer: {
      marginVertical: 14,
    },
    progressInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textMuted || (isDark ? '#9CA3AF' : '#64748B'),
    },
    progressPercent: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#085428',
    },
    progressBarBg: {
      height: 6,
      backgroundColor: isDark ? '#1C3829' : '#E2E8F0',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#085428',
      borderRadius: 3,
    },
    cardDetailsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#14291D' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
      padding: 12,
      borderRadius: 12,
    },
    cardDetailItem: {
      flex: 1,
    },
    cardDetailLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: isDark ? '#9CA3AF' : (themeColors.textMuted || '#94A3B8'),
      marginBottom: 2,
    },
    cardDetailValue: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : (themeColors.text || '#0F172A'),
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 12,
      gap: 2,
    },
    viewDetailsText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#34D399' : '#085428',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
      backgroundColor: isDark ? '#0E1E15' : (themeColors.surface || '#FFFFFF'),
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: themeColors.text || '#0F172A',
      marginBottom: 6,
    },
    emptySubtitle: {
      fontSize: 14,
      color: themeColors.textMuted || '#64748B',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    emptyActionBtn: {
      backgroundColor: '#085428',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    emptyActionBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
  });

export default SIPDashboardScreen;
