import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;

const BANNERS = [
  {
    id: 'chit',
    tag: '🔥 POPULAR CHOICE',
    tagColor: '#FEF08A',
    tagBg: 'rgba(254, 240, 138, 0.2)',
    title: 'Need Big Funds Without Bank Loans?',
    subtitle: 'Save weekly, bid early, or claim high-yield settlement returns with zero paperwork!',
    stat1: 'Up to 106% Payout',
    stat2: 'Weekly Dues',
    cta: 'Explore Chit Funds',
    icon: 'account-group-outline',
    colors: ['#064e3b', '#047857', '#059669'],
    accent: '#34D399',
    textColor: '#064E3B',
    route: 'ExploreChits',
  },
  {
    id: 'sip',
    tag: '🚀 26% P.A. WEALTH',
    tagColor: '#E9D5FF',
    tagBg: 'rgba(233, 213, 255, 0.22)',
    title: 'Turn ₹100/Day Into a Massive Fortune',
    subtitle: 'Why keep idle cash? Earn daily compounding interest credited directly to your balance.',
    stat1: '26% Annual Return',
    stat2: 'From ₹100',
    cta: 'Start Your SIP',
    icon: 'rocket-launch-outline',
    colors: ['#2e1065', '#581c87', '#7c3aed'],
    accent: '#C084FC',
    textColor: '#581C87',
    route: 'SIPDashboard',
  },
  {
    id: 'pocket_money',
    tag: '💰 DAILY CASH FLOW',
    tagColor: '#FED7AA',
    tagBg: 'rgba(254, 215, 170, 0.22)',
    title: 'Wake Up to Daily Income Every Morning',
    subtitle: 'Invest once, relax, and receive automated pocket money credited straight to your account.',
    stat1: 'Daily Direct Credit',
    stat2: '100% Automated',
    cta: 'Get Pocket Money',
    icon: 'wallet-giftcard',
    colors: ['#78350f', '#9a3412', '#c2410c'],
    accent: '#FB923C',
    textColor: '#9A3412',
    route: 'PocketMoney',
  },
  {
    id: 'investment',
    tag: '🛡️ 100% CAPITAL PROTECTED',
    tagColor: '#BAE6FD',
    tagBg: 'rgba(186, 230, 253, 0.2)',
    title: 'Guaranteed Fixed Growth Up to 24% p.a.',
    subtitle: 'Zero market risk. High-yield terms from 15 days to 1 year with bank-level reliability.',
    stat1: 'Up to 24% p.a.',
    stat2: '15d to 1yr Terms',
    cta: 'Start New Investment',
    icon: 'shield-check-outline',
    colors: ['#0f172a', '#0e7490', '#047857'],
    accent: '#38BDF8',
    textColor: '#0F172A',
    route: 'InvestmentAmount',
  },
];

export const PromotionalMarketingBanner = ({ navigation, isDarkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const autoPlayTimer = useRef(null);
  const isInteracting = useRef(false);

  const goToBanner = useCallback((newIndex) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -15,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentIndex(newIndex);
      slideAnim.setValue(15);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const handleNext = useCallback(() => {
    const nextIdx = (currentIndex + 1) % BANNERS.length;
    goToBanner(nextIdx);
  }, [currentIndex, goToBanner]);

  const handlePrev = useCallback(() => {
    const prevIdx = (currentIndex - 1 + BANNERS.length) % BANNERS.length;
    goToBanner(prevIdx);
  }, [currentIndex, goToBanner]);

  // Auto-play timer (every 4.5 seconds)
  useEffect(() => {
    if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    autoPlayTimer.current = setInterval(() => {
      if (!isInteracting.current) {
        handleNext();
      }
    }, 4500);

    return () => {
      if (autoPlayTimer.current) clearInterval(autoPlayTimer.current);
    };
  }, [handleNext]);

  // Touch gesture responder for horizontal swiping
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
      },
      onPanResponderGrant: () => {
        isInteracting.current = true;
      },
      onPanResponderRelease: (evt, gestureState) => {
        isInteracting.current = false;
        if (gestureState.dx < -40) {
          handleNext();
        } else if (gestureState.dx > 40) {
          handlePrev();
        }
      },
      onPanResponderTerminate: () => {
        isInteracting.current = false;
      },
    })
  ).current;

  const currentBanner = BANNERS[currentIndex];

  const handlePress = () => {
    if (currentBanner.route && navigation) {
      navigation.navigate(currentBanner.route);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.bannerCard,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handlePress}
          style={styles.touchableWrapper}
        >
          <LinearGradient
            colors={currentBanner.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Background Decorative Circles */}
            <View style={[styles.decorCircle1, { borderColor: currentBanner.accent }]} />
            <View style={[styles.decorCircle2, { backgroundColor: currentBanner.accent }]} />

            {/* Top Row: Tag & Icon */}
            <View style={styles.topRow}>
              <View style={[styles.tagBadge, { backgroundColor: currentBanner.tagBg }]}>
                <Text style={[styles.tagText, { color: currentBanner.tagColor }]}>
                  {currentBanner.tag}
                </Text>
              </View>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
                <MaterialCommunityIcons name={currentBanner.icon} size={20} color="#FFFFFF" />
              </View>
            </View>

            {/* Headline */}
            <Text style={styles.titleText} numberOfLines={2}>
              {currentBanner.title}
            </Text>

            {/* Subtitle */}
            <Text style={styles.subText} numberOfLines={2}>
              {currentBanner.subtitle}
            </Text>

            {/* Middle Row: Stats Pills */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <MaterialCommunityIcons name="check-decagram" size={13} color={currentBanner.accent} />
                <Text style={styles.statPillText} numberOfLines={1}>{currentBanner.stat1}</Text>
              </View>
              <View style={styles.statPill}>
                <MaterialCommunityIcons name="clock-outline" size={13} color={currentBanner.accent} />
                <Text style={styles.statPillText} numberOfLines={1}>{currentBanner.stat2}</Text>
              </View>
            </View>

            {/* Bottom Row: CTA Button */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePress}
                style={[styles.ctaBtn, { shadowColor: currentBanner.accent }]}
              >
                <Text style={[styles.ctaText, { color: currentBanner.textColor || '#064E3B' }]}>
                  {currentBanner.cta}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={15} color={currentBanner.textColor || '#064E3B'} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Pagination Dots & Navigation Indicators */}
      <View style={styles.paginationRow}>
        <TouchableOpacity
          onPress={handlePrev}
          style={styles.navArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={18}
            color={isDarkMode ? '#9CA3AF' : '#64748B'}
          />
        </TouchableOpacity>

        <View style={styles.dotsWrap}>
          {BANNERS.map((banner, index) => {
            const isActive = index === currentIndex;
            return (
              <TouchableOpacity
                key={banner.id}
                onPress={() => goToBanner(index)}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.dotActive, { backgroundColor: currentBanner.accent }]
                    : [styles.dotInactive, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)' }],
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          onPress={handleNext}
          style={styles.navArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={isDarkMode ? '#9CA3AF' : '#64748B'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 4,
    alignItems: 'center',
  },
  bannerCard: {
    width: BANNER_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  touchableWrapper: {
    width: '100%',
  },
  gradient: {
    padding: 16,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 205,
    justifyContent: 'space-between',
  },
  decorCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    opacity: 0.15,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -40,
    right: 40,
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.08,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    gap: 5,
  },
  statPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 12,
  },
  navArrow: {
    padding: 4,
  },
  dotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
  },
  dotInactive: {
    width: 6,
  },
});

export default PromotionalMarketingBanner;
