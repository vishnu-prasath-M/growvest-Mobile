import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * StatusChip — inline badge for Success, Pending, Failed, Active, Maturing, Paid
 * Matches prime-ui status chip pattern
 */
const StatusChip = ({ status, style }) => {
  const { colors: themeColors } = useTheme();
  const config = getStatusConfig(themeColors)[status] || getStatusConfig(themeColors)['default'];

  return (
    <View style={[styles.chip, { backgroundColor: config.bg }, style]}>
      <Text style={[styles.text, { color: config.color }]}>{status}</Text>
    </View>
  );
};

const getStatusConfig = (colors) => ({
  Success: { bg: colors.successLight, color: colors.success },
  SUCCESSFUL: { bg: colors.successLight, color: colors.success },
  REWARDED: { bg: colors.successLight, color: colors.success },
  Active: { bg: colors.successLight, color: colors.success },
  ACTIVE: { bg: colors.successLight, color: colors.success },
  Paid: { bg: colors.successLight, color: colors.success },
  REGISTERED: { bg: colors.successLight, color: colors.success },
  Registered: { bg: colors.successLight, color: colors.success },
  DOWNLOADED: { bg: '#E0F2FE', color: '#0284C7' },
  Downloaded: { bg: '#E0F2FE', color: '#0284C7' },
  Maturing: { bg: colors.warningLight, color: colors.warning },
  Pending: { bg: colors.warningLight, color: colors.warning },
  PENDING: { bg: colors.warningLight, color: colors.warning },
  Processing: { bg: colors.warningLight, color: colors.warning },
  Failed: { bg: colors.errorLight, color: colors.error },
  FAILED: { bg: colors.errorLight, color: colors.error },
  Rejected: { bg: colors.errorLight, color: colors.error },
  default: { bg: colors.accent, color: colors.accentFg },
});

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default StatusChip;
