import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { useTheme } from '../../context/ThemeContext';
const SUPPORT_DATA = {
  whatsapp: '+91 98765 43210',
  phone: '+91 98765 43210',
  email: 'camohanrajbullbear@gmail.com',
  workingHours: 'Mon - Sat, 9:00 AM - 8:00 PM',
};

const SupportScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);

  const supportOptions = [
    {
      icon: 'whatsapp',
      label: 'WhatsApp',
      value: SUPPORT_DATA.whatsapp,
      color: '#25D366',
      bg: '#e8f5e9',
      action: () => Linking.openURL(`https://wa.me/${SUPPORT_DATA.whatsapp.replace(/[^0-9]/g, '')}`),
    },
    {
      icon: 'phone',
      label: 'Phone',
      value: SUPPORT_DATA.phone,
      color: colors.primary,
      bg: colors.primaryLight,
      action: () => Linking.openURL(`tel:${SUPPORT_DATA.phone}`),
    },
    {
      icon: 'email',
      label: 'Email',
      value: SUPPORT_DATA.email,
      color: '#2563eb',
      bg: '#dbeafe',
      action: () => Linking.openURL(`mailto:${SUPPORT_DATA.email}`),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <LinearGradient colors={['#064e3b', '#065f46', '#047857']} style={styles.heroInner}>
            <MaterialCommunityIcons name="headset" size={48} color={colors.white} />
            <Text style={styles.heroTitle}>We're Here to Help</Text>
            <Text style={styles.heroText}>{SUPPORT_DATA.workingHours}</Text>
          </LinearGradient>
        </View>

        {/* Contact Options */}
        {supportOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionCard}
            activeOpacity={0.85}
            onPress={option.action}
          >
            <View style={[styles.optionIcon, { backgroundColor: option.bg }]}>
              <MaterialCommunityIcons name={option.icon} size={28} color={option.color} />
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionValue}>{option.value}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        {/* Info */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.textTertiary} />
          <Text style={styles.infoText}>
            Our support team typically responds within 24 hours during business days.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', ...colors.shadow.soft },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  heroCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 20, ...colors.shadow.elevated },
  heroInner: { alignItems: 'center', padding: 30 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginTop: 12, marginBottom: 4 },
  heroText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderLight, ...colors.shadow.card,
  },
  optionIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  optionInfo: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  optionValue: { fontSize: 13, color: colors.textSecondary },
  ticketCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight,
    borderRadius: 16, padding: 16, marginTop: 10, marginBottom: 16,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  ticketIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  ticketInfo: { flex: 1 },
  ticketTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  ticketSubtitle: { fontSize: 12, color: colors.textSecondary },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 12 },
  infoText: { fontSize: 12, color: colors.textTertiary, flex: 1, lineHeight: 18 },
});

export default SupportScreen;