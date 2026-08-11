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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../context/ThemeContext';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';

// ─── SF-Symbols style icon map (using Ionicons) ───────────────────────────────
const TYPE_CONFIG = {
  investment_approved: {
    icon: 'arrow.up.right.circle.fill',   // SF Symbols equivalent → Ionicons:
    ionIcon: 'trending-up',
    color: '#1A5C39',
    bg: '#E8F5EE',
    label: 'Investment',
  },
  investment_rejected: {
    ionIcon: 'trending-down',
    color: '#DC2626',
    bg: '#FEE9E9',
    label: 'Investment',
  },
  withdrawal_approved: {
    ionIcon: 'arrow-up-circle',
    color: '#059669',
    bg: '#D1FAE5',
    label: 'Withdrawal',
  },
  withdrawal_rejected: {
    ionIcon: 'arrow-down-circle',
    color: '#DC2626',
    bg: '#FEE9E9',
    label: 'Withdrawal',
  },
  chit_joined: {
    ionIcon: 'people-circle',
    color: '#1A5C39',
    bg: '#E8F5EE',
    label: 'Chit Fund',
  },
  chit_join_approved: {
    ionIcon: 'checkmark-circle',
    color: '#16A34A',
    bg: '#DCFCE7',
    label: 'Approved',
  },
  chit_join_rejected: {
    ionIcon: 'close-circle',
    color: '#DC2626',
    bg: '#FEE9E9',
    label: 'Rejected',
  },
  chit_payment_approved: {
    ionIcon: 'checkmark-done-circle',
    color: '#16A34A',
    bg: '#DCFCE7',
    label: 'Payment',
  },
  chit_payment_rejected: {
    ionIcon: 'close-circle',
    color: '#DC2626',
    bg: '#FEE9E9',
    label: 'Payment',
  },
  new_chit_available: {
    ionIcon: 'layers',
    color: '#2563EB',
    bg: '#EEF2FF',
    label: 'New Chit',
  },
  chit_closed: {
    ionIcon: 'lock-closed',
    color: '#6B7280',
    bg: '#F3F4F6',
    label: 'Chit Closed',
  },
  due_reminder: {
    ionIcon: 'alarm',
    color: '#D97706',
    bg: '#FEF3C7',
    label: 'Reminder',
  },
  kyc_approved: {
    ionIcon: 'shield-checkmark',
    color: '#16A34A',
    bg: '#DCFCE7',
    label: 'KYC',
  },
  kyc_rejected: {
    ionIcon: 'shield-outline',
    color: '#DC2626',
    bg: '#FEE9E9',
    label: 'KYC',
  },
  auction_winner: {
    ionIcon: 'ribbon',
    color: '#7C3AED',
    bg: '#F3F0FF',
    label: 'Auction',
  },
  auction: {
    ionIcon: 'ribbon',
    color: '#7C3AED',
    bg: '#F3F0FF',
    label: 'Auction',
  },
  welcome: {
    ionIcon: 'hand-left',
    color: '#1A5C39',
    bg: '#E8F5EE',
    label: 'Welcome',
  },
  general: {
    ionIcon: 'notifications',
    color: '#1A5C39',
    bg: '#E8F5EE',
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
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ])
    );
    p.start();
    return () => p.stop();
  }, []);
  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
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
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const cfg = getTypeConfig(n.type);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 60, bounciness: 2 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 5 }).start();

  const onPress = () => {
    if (!n.read) onMarkRead(n._id);
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.row, { transform: [{ scale }] }, !isLast && styles.rowBorder]}>
        {/* Unread left strip */}
        {!n.read && <View style={styles.unreadStrip} />}

        {/* Icon bubble */}
        <View style={[styles.iconBubble, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.ionIcon} size={22} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={styles.rowContent}>
          {/* Title + time */}
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

          {/* Label tag */}
          <View style={[styles.tag, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.tagText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Unread dot */}
        {!n.read && <View style={styles.unreadDot} />}
      </Animated.View>
    </Pressable>
  );
});

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
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
      <Animated.View style={{ transform: [{ translateY: float }], marginBottom: 24 }}>
        <LinearGradient colors={['#E8F5EE', '#D1FAE5']} style={styles.emptyIconWrap}>
          <Ionicons name="notifications-off-outline" size={40} color={themeColors.primary} />
        </LinearGradient>
      </Animated.View>
      <Text style={styles.emptyTitle}>All Caught Up</Text>
      <Text style={styles.emptyBody}>
        No notifications yet.{'\n'}We'll notify you when something happens.
      </Text>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const NotificationsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
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
            <TouchableOpacity onPress={handleMarkAllAsRead} activeOpacity={0.7}>
              <Text style={styles.markAllBtn}>Mark all read</Text>
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
        {/* ── Unread pill ─────────────────────────────────── */}
        {unreadCount > 0 && (
          <View style={styles.unreadPill}>
            <View style={styles.unreadPillDot} />
            <Text style={styles.unreadPillText}>
              {unreadCount} unread
            </Text>
          </View>
        )}

        {/* ── Groups ─────────────────────────────────────── */}
        {groups.length > 0 ? (
          groups.map((group) => (
            <View key={group.label} style={styles.section}>
              {/* Section header */}
              <Text style={styles.sectionLabel}>{group.label}</Text>

              {/* Card shell containing all rows */}
              <View style={styles.card}>
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
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },

  markAllBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // ── Unread pill ─────────────────────────────────────────────────────────────
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  unreadPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  unreadPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // ── Section ─────────────────────────────────────────────────────────────────
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── Card shell (groups all rows) ─────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Row ─────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 13,
    position: 'relative',
    backgroundColor: colors.surface,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  unreadStrip: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  // Icon bubble
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  // Row content
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  rowTitleBold: {
    fontWeight: '700',
    color: colors.text,
  },
  rowTime: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
    flexShrink: 0,
  },
  rowDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 7,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // Unread dot top-right
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 18,
  },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 13,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.border,
  },
  skeletonBody: { flex: 1, gap: 8 },
  skeletonLineA: {
    height: 13,
    width: '80%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonLineB: {
    height: 11,
    width: '55%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },

  // ── Empty ─────────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default NotificationsScreen;