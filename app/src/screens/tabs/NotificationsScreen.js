import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import TopBar from '../../components/TopBar';

// UI-only placeholder — will be connected to backend later
const NOTIFICATION_GROUPS = [
  {
    date: 'New',
    items: [
      {
        icon: 'check-decagram',
        tint: colors.successLight,
        iconColor: colors.success,
        title: 'KYC Verified',
        sub: 'Your account is fully verified.',
        time: '2m',
        unread: true,
      },
      {
        icon: 'trending-up',
        tint: colors.primaryLight,
        iconColor: colors.primary,
        title: 'Interest credited',
        sub: 'Interest has been added to your account.',
        time: '1h',
        unread: true,
      },
    ],
  },
  {
    date: 'Earlier',
    items: [
      {
        icon: 'bank-outline',
        tint: colors.primaryLight,
        iconColor: colors.primary,
        title: 'Investment maturing soon',
        sub: 'Your Fixed Deposit matures in 18 days.',
        time: 'Yesterday',
      },
      {
        icon: 'layers-outline',
        tint: '#fef3c7',
        iconColor: '#d97706',
        title: 'New Chit available',
        sub: 'A new chit fund is now open for joining.',
        time: '2d',
      },
      {
        icon: 'bell-outline',
        tint: colors.primaryLight,
        iconColor: colors.primary,
        title: 'Payment reminder',
        sub: 'Auto-debit scheduled for next week.',
        time: '3d',
      },
    ],
  },
];

const NotificationsScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);

  return (
    <View style={styles.container}>
      <TopBar
        title="Notifications"
        navigation={navigation}
        showBack
        right={
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {NOTIFICATION_GROUPS.map((group) => (
          <View key={group.date} style={styles.group}>
            <Text style={styles.groupLabel}>{group.date}</Text>
            <View style={styles.groupItems}>
              {group.items.map((n, i) => (
                <View
                  key={i}
                  style={[
                    styles.notifCard,
                    n.unread && styles.notifCardUnread,
                  ]}
                >
                  <View style={[styles.notifIcon, { backgroundColor: n.tint }]}>
                    <MaterialCommunityIcons name={n.icon} size={18} color={n.iconColor} />
                  </View>
                  <View style={styles.notifBody}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                      {n.unread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifSub}>{n.sub}</Text>
                  </View>
                  <Text style={styles.notifTime}>{n.time}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  markAllText: { fontSize: 13, fontWeight: '700', color: colors.primary },

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
});

export default NotificationsScreen;
