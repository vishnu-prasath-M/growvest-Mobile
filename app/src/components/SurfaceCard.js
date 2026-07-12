import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

/**
 * SurfaceCard — white card with soft shadow, matching prime-ui bg-surface shadow-soft pattern
 */
const SurfaceCard = ({
  children,
  style,
  borderRadius = 24,
  padding = 0,
  divided = false,
}) => {
  return (
    <View
      style={[
        styles.card,
        { borderRadius, padding },
        divided && styles.divided,
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const SurfaceDivider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...colors.shadow.soft,
  },
  divided: {
    // children will use SurfaceDivider between them
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    opacity: 0.6,
    marginHorizontal: 16,
  },
});

export default SurfaceCard;
