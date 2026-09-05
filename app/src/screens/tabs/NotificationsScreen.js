import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../context/ThemeContext';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';

// ─── Notification Type Configuration ─────────────────────────────────────────
const TYPE_CONFIG = {
  investment_approved: {
    icon: 'trending-up',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Investment',
  },
  investment_rejected: {
    icon: 'trending-down',
    color: '#DC2626',
    bg: '#FEE2E2',
    darkColor: '#F87171',
    darkBg: 'rgba(239, 68, 68, 0.15)',
    label: 'Investment',
  },
  withdrawal_approved: {
    icon: 'arrow-up-circle-outline',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Withdrawal',
  },
  withdrawal_rejected: {
    icon: 'arrow-down-circle-outline',
    color: '#DC2626',
    bg: '#FEE2E2',
    darkColor: '#F87171',
    darkBg: 'rgba(239, 68, 68, 0.15)',
    label: 'Withdrawal',
  },
  chit_joined: {
    icon: 'account-group-outline',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Chit Fund',
  },
  chit_join_approved: {
    icon: 'check-decagram-outline',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Approved',
  },
  chit_join_rejected: {
    icon: 'close-circle-outline',
    color: '#DC2626',
    bg: '#FEE2E2',
    darkColor: '#F87171',
    darkBg: 'rgba(239, 68, 68, 0.15)',
    label: 'Rejected',
  },
  chit_payment_approved: {
    icon: 'cash-check',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Payment',
  },
  chit_payment_rejected: {
    icon: 'cash-remove',
    color: '#DC2626',
    bg: '#FEE2E2',
    darkColor: '#F87171',
    darkBg: 'rgba(239, 68, 68, 0.15)',
    label: 'Payment',
  },
  new_chit_available: {
    icon: 'sparkles',
    color: '#0284C7',
    bg: '#E0F2FE',
    darkColor: '#38BDF8',
    darkBg: 'rgba(14, 165, 233, 0.15)',
    label: 'New Chit',
  },
  chit_closed: {
    icon: 'lock-check-outline',
    color: '#64748B',
    bg: '#F1F5F9',
    darkColor: '#94A3B8',
    darkBg: 'rgba(255, 255, 255, 0.08)',
    label: 'Closed',
  },
  due_reminder: {
    icon: 'bell-ring-outline',
    color: '#D97706',
    bg: '#FEF3C7',
    darkColor: '#FBBF24',
    darkBg: 'rgba(245, 158, 11, 0.15)',
    label: 'Reminder',
  },
  kyc_approved: {
    icon: 'shield-check-outline',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'KYC',
  },
  kyc_rejected: {
    icon: 'shield-alert-outline',
    color: '#DC2626',
    bg: '#FEE2E2',
    darkColor: '#F87171',
    darkBg: 'rgba(239, 68, 68, 0.15)',
    label: 'KYC',
  },
  auction_winner: {
    icon: 'trophy-outline',
    color: '#7C3AED',
    bg: '#F5F3FF',
    darkColor: '#A78BFA',
    darkBg: 'rgba(124, 58, 237, 0.15)',
    label: 'Auction',
  },
  auction: {
    icon: 'gavel',
    color: '#7C3AED',
    bg: '#F5F3FF',
    darkColor: '#A78BFA',
    darkBg: 'rgba(124, 58, 237, 0.15)',
    label: 'Auction',
  },
  welcome: {
    icon: 'hand-wave-outline',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Welcome',
  },
  general: {
    icon: 'bell-outline',
    color: '#0E3D23',
    bg: '#E3F6EC',
    darkColor: '#34D399',
    darkBg: 'rgba(16, 185, 129, 0.16)',
    label: 'Update',
  },
};

const getTypeConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.general;

// ─── Time formatter ───────────────────────────────────────────────────────────
const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ─── Group helper ─────────────────────────────────────────────────────────────
const getGroupLabel = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
};

const groupNotifications = (notifications) => {
  const map = {};
  notifications.forEach((n) => {
    const label = getGroupLabel(n.createdAt);
    if (!map[label]) map[label] = [];
    map[label].push(n);
  });
  return ['Today', 'Yesterday', 'Earlier']
    .filter((k) => map[k])
    .map((label) => ({ label, items: map[label] }));
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    p.start();
    return () => p.stop();
  }, []);
  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLineA} />
        <View style={styles.skeletonLineB} />
      </View>
    </Animated.View>
  );
};

// ─── Notification Row ─────────────────────────────────────────────────────────
const NotificationRow = React.memo(({ notification: n, onMarkRead, isLast }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const cfg = getTypeConfig(n.type);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 60, bounciness: 2 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 5 }).start();

  const onPress = () => {
    if (!n.read) onMarkRead(n._id);
  };

  const iconBg = isDarkMode ? cfg.darkBg : cfg.bg;
  const iconColor = isDarkMode ? cfg.darkColor : cfg.color;

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.row, { transform: [{ scale }] }]}>
        {/* Left Mint Avatar Box */}
        <View style={[styles.mintIconBox, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={cfg.icon} size={20} color={iconColor} />
        </View>

        {/* Content */}
        <View style={styles.rowContent}>
          {/* Title + Time */}
          <View style={styles.rowTopRow}>
            <Text
              style={[styles.rowTitle, !n.read && styles.rowTitleBold]}
              numberOfLines={1}
            >
              {n.title}
            </Text>
            <Text style={styles.rowTime}>{formatTime(n.createdAt)}</Text>
          </View>

          {/* Description */}
          <Text style={styles.rowDesc} numberOfLines={2}>
            {n.description}
          </Text>

          {/* Tag and Unread Indicator */}
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: iconBg }]}>
              <Text style={[styles.tagText, { color: iconColor }]}>{cfg.label}</Text>
            </View>
            {!n.read && (
              <View style={styles.unreadBadge}>
                <View style={styles.unreadDot} />
                <Text style={styles.unreadBadgeText}>New</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
      {!isLast && <View style={styles.rowDivider} />}
    </Pressable>
  );
});

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 1800, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, []);

  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={{ transform: [{ translateY: float }], marginBottom: 20 }}>
        <LinearGradient
          colors={isDarkMode ? ['#133324', '#0E2318'] : ['#E3F6EC', '#D1FAE5']}
          style={styles.emptyIconWrap}
        >
          <MaterialCommunityIcons
            name="bell-check-outline"
            size={40}
            color={isDarkMode ? '#34D399' : '#0E3D23'}
          />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.emptyTitle}>All Caught Up</Text>
      <Text style={styles.emptyBody}>
        You have no new notifications right now.{'\n'}We'll keep you updated on your investments & chits.
      </Text>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const NotificationsScreen = ({ navigation }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.NOTIFICATIONS);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(API_ENDPOINTS.NOTIFICATION_READ(id));
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put(API_ENDPOINTS.NOTIFICATION_READ_ALL);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const groups = groupNotifications(notifications);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar title="Notifications" navigation={navigation} showBack />
        <View style={styles.skeletonWrap}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Notifications"
        navigation={navigation}
        showBack
        right={
          unreadCount > 0 ? (
            <TouchableOpacity
              onPress={handleMarkAllAsRead}
              activeOpacity={0.7}
              style={styles.markAllPill}
            >
              <MaterialCommunityIcons
                name="check-all"
                size={16}
                color={isDarkMode ? '#34D399' : '#0E3D23'}
              />
              <Text style={styles.markAllText}>Read All</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Unread Summary Banner ────────────────────────── */}
        {unreadCount > 0 ? (
          <View style={styles.unreadBanner}>
            <View style={styles.unreadBannerIconBox}>
              <MaterialCommunityIcons name="bell-badge-outline" size={18} color="#0E3D23" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.unreadBannerTitle}>
                {unreadCount} Unread {unreadCount === 1 ? 'Notification' : 'Notifications'}
              </Text>
              <Text style={styles.unreadBannerSubtitle}>Stay up to date with your activity</Text>
            </View>
          </View>
        ) : null}

        {/* ── Groups ─────────────────────────────────────── */}
        {groups.length > 0 ? (
          groups.map((group) => (
            <View key={group.label} style={styles.menuGroup}>
              {/* Section header */}
              <Text style={styles.menuGroupLabel}>{group.label}</Text>

              {/* 24px Rounded Card Container */}
              <View style={styles.menuCard}>
                {group.items.map((n, idx) => (
                  <NotificationRow
                    key={n._id}
                    notification={n}
                    onMarkRead={handleMarkAsRead}
                    isLast={idx === group.items.length - 1}
                  />
                ))}
              </View>
            </View>
          ))
        ) : (
          <EmptyState />
        )}
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (themeColors, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
  },

  // ── Mark All Button in TopBar ───────────────────────────────────────────────
  markAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#34D399' : '#0E3D23',
  },

  // ── Unread Banner ───────────────────────────────────────────────────────────
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#E3F6EC',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  unreadBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: isDarkMode ? '#A7F3D0' : '#0E3D23',
  },
  unreadBannerSubtitle: {
    fontSize: 11,
    color: isDarkMode ? 'rgba(167, 243, 208, 0.8)' : '#065F46',
    marginTop: 1,
  },

  // ── Section Groups ──────────────────────────────────────────────────────────
  menuGroup: {
    marginBottom: 20,
  },
  menuGroupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: isDarkMode ? '#9CA3AF' : '#686D62',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // ── Card Shell (24px rounded card matching profile & app lock) ──────────────
  menuCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Row ─────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    backgroundColor: themeColors.surface,
  },
  rowDivider: {
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#EFF1E9',
    marginHorizontal: 16,
  },

  // Icon avatar box (38x38 mint pill circle)
  mintIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },

  // Row Content
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: themeColors.text,
    letterSpacing: -0.2,
  },
  rowTitleBold: {
    fontWeight: '700',
    color: themeColors.text,
  },
  rowTime: {
    fontSize: 11,
    fontWeight: '500',
    color: themeColors.textMuted,
    flexShrink: 0,
  },
  rowDesc: {
    fontSize: 13,
    color: themeColors.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  unreadDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: isDarkMode ? '#34D399' : '#0E3D23',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: isDarkMode ? '#34D399' : '#0E3D23',
  },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#EFF1E9',
  },
  skeletonIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
  },
  skeletonBody: { flex: 1, gap: 8 },
  skeletonLineA: {
    height: 14,
    width: '75%',
    borderRadius: 6,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
  },
  skeletonLineB: {
    height: 11,
    width: '50%',
    borderRadius: 6,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
  },

  // ── Empty State ─────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: themeColors.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: themeColors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
});

export default NotificationsScreen;