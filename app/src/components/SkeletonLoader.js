import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { useTheme } from '../context/ThemeContext';

export const SkeletonLoader = ({ variant = 'list', count = 4 }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const insets = useScreenInsets(8);
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const renderCard = (index) => (
    <Animated.View key={index} style={[styles.card, { opacity }]}>
      <View style={styles.avatar} />
      <View style={styles.cardContent}>
        <View style={styles.lineLong} />
        <View style={styles.lineShort} />
      </View>
    </Animated.View>
  );

  if (variant === 'home') {
    return (
      <Animated.View style={[styles.container, { opacity, paddingTop: insets.top }]}>
        {/* Header Section */}
        <View style={styles.homeHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarSkeleton} />
            <View style={styles.headerTextStack}>
              <View style={[styles.lineShort, { width: 40, height: 8 }]} />
              <View style={[styles.lineLong, { width: 80, height: 12, marginTop: 4 }]} />
            </View>
          </View>
          <View style={styles.bellSkeleton} />
        </View>

        {/* Balance Card Section */}
        <View style={styles.homeBalanceCard}>
          <View style={[styles.lineShort, { width: 80, height: 8, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={[styles.lineLong, { width: 140, height: 26, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.4)' }]} />
          <View style={[styles.lineShort, { width: 100, height: 8, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          
          <View style={styles.homeStatsRow}>
            <View style={styles.homeStatPill} />
            <View style={styles.homeStatPill} />
            <View style={styles.homeStatPill} />
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.homeQuickActions}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.homeQAItem}>
              <View style={styles.homeQACircle} />
              <View style={[styles.lineShort, { width: 45, height: 8, alignSelf: 'center', marginTop: 8 }]} />
            </View>
          ))}
        </View>

        {/* Section Header */}
        <View style={[styles.lineShort, { width: 120, height: 12, marginHorizontal: 20, marginVertical: 16 }]} />

        {/* Recent items */}
        <View style={styles.listWrapper}>
          {[1, 2, 3].map((i) => renderCard(i))}
        </View>
      </Animated.View>
    );
  }

  if (variant === 'dashboard') {
    return (
      <Animated.View style={[styles.container, { opacity }]}>
        {/* Large Balance Banner Skeleton */}
        <View style={styles.bannerSkeleton} />
        
        {/* Quick Actions Grid Skeleton */}
        <View style={styles.gridRow}>
          <View style={styles.gridBox} />
          <View style={styles.gridBox} />
          <View style={styles.gridBox} />
        </View>

        {/* Section Header */}
        <View style={[styles.lineShort, { marginHorizontal: 20, marginVertical: 16 }]} />

        {/* List items */}
        <View style={styles.listWrapper}>
          {[1, 2, 3].map((i) => renderCard(i))}
        </View>
      </Animated.View>
    );
  }

  if (variant === 'profile') {
    return (
      <Animated.View style={[styles.container, { opacity }]}>
        {/* Profile Header Block */}
        <View style={styles.profileHeader}>
          <View style={styles.largeAvatar} />
          <View style={[styles.lineLong, { width: '40%', alignSelf: 'center', marginTop: 12 }]} />
          <View style={[styles.lineShort, { width: '25%', alignSelf: 'center', marginTop: 8 }]} />
        </View>

        {/* Profile Rows */}
        <View style={[styles.listWrapper, { marginTop: 24 }]}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.profileRow}>
              <View style={styles.smallIcon} />
              <View style={[styles.lineLong, { width: '50%' }]} />
            </View>
          ))}
        </View>
      </Animated.View>
    );
  }

  if (variant === 'form') {
    return (
      <Animated.View style={[styles.formContainer, { opacity }]}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.formGroup}>
            <View style={[styles.lineShort, { width: '30%', marginBottom: 8 }]} />
            <View style={styles.inputSkeleton} />
          </View>
        ))}
        <View style={styles.buttonSkeleton} />
      </Animated.View>
    );
  }

  // Default List View (Variant = 'list')
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => renderCard(i))}
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },
  lineLong: {
    height: 12,
    width: '75%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  lineShort: {
    height: 10,
    width: '45%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },

  // Dashboard styles
  bannerSkeleton: {
    height: 140,
    backgroundColor: colors.surface,
    borderRadius: 24,
    margin: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 8,
    gap: 12,
  },
  gridBox: {
    flex: 1,
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listWrapper: {
    gap: 2,
  },

  // Profile styles
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 16,
  },
  smallIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.border,
  },

  // Form styles
  formContainer: {
    padding: 20,
    gap: 20,
    backgroundColor: colors.surface,
    flex: 1,
  },
  formGroup: {
    gap: 4,
  },
  inputSkeleton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  buttonSkeleton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.border,
    marginTop: 12,
  },

  // Home Screen variant styles
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarSkeleton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  headerTextStack: {
    gap: 2,
  },
  bellSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  homeBalanceCard: {
    height: 180,
    backgroundColor: '#0E3D23',
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    justifyContent: 'center',
  },
  homeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 8,
  },
  homeStatPill: {
    flex: 1,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  homeQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  homeQAItem: {
    alignItems: 'center',
    flex: 1,
  },
  homeQACircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.border,
  },
});
