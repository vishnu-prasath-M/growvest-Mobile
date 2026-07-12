import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';

/**
 * GradientCard — reusable emerald or gold gradient card container
 * Matches the prime-ui gradient-emerald / gradient-gold pattern
 */
const GradientCard = ({
  children,
  variant = 'emerald',
  style,
  innerStyle,
  borderRadius = 28,
}) => {
  const gradientColors =
    variant === 'gold'
      ? ['#E8D083', '#C89A30']
      : ['#0E3D23', '#1A5C39', '#2E8B5A'];

  const gradientStart = { x: 0, y: 0 };
  const gradientEnd = { x: 1, y: 1 };

  return (
    <View
      style={[
        styles.wrapper,
        { borderRadius },
        colors.shadow.glow,
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={gradientStart}
        end={gradientEnd}
        style={[styles.gradient, { borderRadius }, innerStyle]}
      >
        {/* Ambient decorative blur circles */}
        <View style={styles.ambientTopRight} />
        <View style={styles.ambientBottomLeft} />
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  gradient: {
    overflow: 'hidden',
    position: 'relative',
  },
  ambientTopRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ambientBottomLeft: {
    position: 'absolute',
    bottom: -20,
    right: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,168,67,0.18)',
  },
});

export default GradientCard;
