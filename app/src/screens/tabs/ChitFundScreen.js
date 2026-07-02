import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const ChitFundScreen = () => {
  const insets = useScreenInsets(8);

  return (
    <View style={styles.container}>
      <View style={[styles.screenHeader, { paddingTop: insets.top }]}>
        <Text style={styles.screenTitle}>Chit Fund</Text>
        <Text style={styles.screenSubtitle}>Coming Soon</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.comingSoonContainer}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="cash-multiple" size={80} color={colors.primary} />
          </View>
          <Text style={styles.comingSoonTitle}>Chit Fund</Text>
          <Text style={styles.comingSoonSubtitle}>
            We're working on bringing you an exciting chit fund experience. Stay tuned for updates!
          </Text>
          
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons name="shield-check" size={24} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>Secure & Regulated</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons name="chart-line" size={24} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>High Returns</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons name="clock-fast" size={24} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>Flexible Tenure</Text>
            </View>
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  screenHeader: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  screenTitle: {
    ...typography.h2,
    marginBottom: 4,
  },
  screenSubtitle: {
    ...typography.body2,
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...colors.shadow.premium,
  },
  comingSoonTitle: {
    ...typography.h1,
    marginBottom: 12,
  },
  comingSoonSubtitle: {
    ...typography.body1,
    textAlign: 'center',
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    ...colors.shadow.card,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    ...typography.h4,
  },
});

export default ChitFundScreen;
