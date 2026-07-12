import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';

const getIconForType = (type) => {
  const iconMap = {
    'investment_approved': 'check-decagram',
    'investment_rejected': 'close-circle',
    'chit_joined': 'handshake',
    'chit_payment_approved': 'check-circle',
    'chit_payment_rejected': 'close-circle',
    'new_chit_available': 'bell-ring',
    'due_reminder': 'bell-alert',
    'kyc_approved': 'shield-check',
    'kyc_rejected': 'shield-off',
    'general': 'bell-outline',
  };
  return iconMap[type] || 'bell-outline';
};

const getIconColor = (type) => {
  if (type.includes('approved') || type.includes('joined')) return colors.success;
  if (type.includes('rejected')) return colors.error;
  if (type === 'due_reminder') return colors.warning;
  if (type === 'new_chit_available') return colors.info;
  return colors.primary;
};

const getIconBg = (type) => {
  if (type.includes('approved') || type.includes('joined')) return colors.successLight;
  if (type.includes('rejected')) return colors.errorLight;
  if (type === 'due_reminder') return colors.warningLight;
  if (type === 'new_chit_available') return colors.infoLight;
  return colors.primaryLight;
};

const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const groupNotifications = (notifications) => {
  const groups = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const newItems = [];
  const earlierItems = [];

  notifications.forEach((n) => {
    const notifDate = new Date(n.createdAt);
    notifDate.setHours(0, 0, 0, 0);
    if (notifDate.getTime() === today.getTime()) {
      newItems.push(n);
    } else {
      earlierItems.push(n);
    }
  });

  if (newItems.length > 0) groups.push({ date: 'New', items: newItems });
  if (earlierItems.length > 0) groups.push({ date: 'Earlier', items: earlierItems });
  return groups;
};

const NotificationsScreen = ({ navigation }) => {
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
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const notificationGroups = groupNotifications(notifications);

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar
          title="Notifications"
          navigation={navigation}
          showBack
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
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
            <TouchableOpacity activeOpacity={0.7} onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, colors.secondary]}
          />
        }
      >
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <View style={styles.unreadDot} />
            <Text style={styles.unreadBannerText}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {notificationGroups.length > 0 ? (
          notificationGroups.map((group) => (
            <View key={group.date} style={styles.group}>
              <Text style={styles.groupLabel}>{group.date}</Text>
              <View style={styles.groupItems}>
                {group.items.map((n) => {
                  const iconName = n.icon || getIconForType(n.type);
                  const iconColor = getIconColor(n.type);
                  const iconBg = getIconBg(n.type);
                  return (
                    <TouchableOpacity
                      key={n._id}
                      activeOpacity={0.8}
                      onPress={() => !n.read && handleMarkAsRead(n._id)}
                    >
                      <View
                        style={[
                          styles.notifCard,
                          !n.read && styles.notifCardUnread,
                        ]}
                      >
                        <View style={[styles.notifIcon, { backgroundColor: iconBg }]}>
                          <MaterialCommunityIcons name={iconName} size={18} color={iconColor} />
                        </View>
                        <View style={styles.notifBody}>
                          <View style={styles.notifTitleRow}>
                            <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                            {!n.read && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notifSub} numberOfLines={2}>{n.description}</Text>
                        </View>
                        <Text style={styles.notifTime}>{formatTime(n.createdAt)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={colors.border} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyBody}>You're all caught up! Check back later for updates.</Text>
          </View>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },

  markAllText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  unreadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  unreadBannerText: { fontSize: 13, fontWeight: '600', color: colors.primary, flex: 1 },

  group: { paddingHorizontal: 16, marginTop: 20 },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingHorizontal: 4,
  },
  groupItems: { gap: 10 },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: 24, padding: 16, gap: 12,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  notifCardUnread: { backgroundColor: colors.accent },
  notifIcon: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  notifBody: { flex: 1, minWidth: 0 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, flexShrink: 0 },
  notifSub: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  notifTime: { fontSize: 10, color: colors.textMuted, flexShrink: 0, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIconBox: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});

export default NotificationsScreen;