import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN_HORIZONTAL = 16;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_MARGIN_HORIZONTAL * 2);
const BANNER_ASPECT_RATIO = 1024 / 409; // 2.50:1 matching image dimensions
const CARD_HEIGHT = Math.round(CARD_WIDTH / BANNER_ASPECT_RATIO);

const AD_BANNERS = [
  {
    id: 'banner-blushberry',
    title: 'Blushberry Beauty Parlour',
    source: require('../../assets/banners/ad-banner-1.png'),
  },
  {
    id: 'banner-seyon',
    title: 'SeyoN UPVC',
    source: require('../../assets/banners/ad-banner-2.png'),
  },
  {
    id: 'banner-abi',
    title: 'ABi Restro Cafe Food Truck',
    source: require('../../assets/banners/ad-banner-3.png'),
  },
];

export const AdBannerCarousel = () => {
  const { isDarkMode } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Auto-scroll loop every 3.5 seconds
  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    timerRef.current = setInterval(() => {
      if (isDraggingRef.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % AD_BANNERS.length;
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: next * CARD_WIDTH,
            animated: true,
          });
        }
        return next;
      });
    }, 3500);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [startAutoScroll, stopAutoScroll]);

  const handleScrollBeginDrag = () => {
    isDraggingRef.current = true;
  };

  const handleMomentumScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    if (index >= 0 && index < AD_BANNERS.length) {
      setActiveIndex(index);
    }
    isDraggingRef.current = false;
  };

  const renderBannerItem = ({ item }) => (
    <View style={[styles.bannerSlide, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <Image
        source={item.source}
        style={styles.bannerImage}
        resizeMode="cover"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.cardOuter,
          {
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: isDarkMode ? '#111D16' : '#F1F5F9',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          },
        ]}
      >
        <FlatList
          ref={flatListRef}
          data={AD_BANNERS}
          renderItem={renderBannerItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH}
          snapToAlignment="center"
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: CARD_WIDTH,
            offset: CARD_WIDTH * index,
            index,
          })}
        />

        {/* Flipkart-Style Pagination Dots Inside the Card */}
        <View style={styles.paginationOverlay} pointerEvents="none">
          {AD_BANNERS.map((_, idx) => {
            const isActive = activeIndex === idx;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOuter: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerSlide: {
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  paginationOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});

export default AdBannerCarousel;
