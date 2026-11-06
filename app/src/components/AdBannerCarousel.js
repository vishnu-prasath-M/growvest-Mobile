import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import api from '../services/apiService';
import { API_BASE_URL } from '../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN_HORIZONTAL = 16;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_MARGIN_HORIZONTAL * 2);
const BANNER_ASPECT_RATIO = 1024 / 409; // 2.50:1 matching image dimensions
const CARD_HEIGHT = Math.round(CARD_WIDTH / BANNER_ASPECT_RATIO);
const SERVER_ORIGIN = (API_BASE_URL || '').replace(/\/api\/?$/, '');

const DEFAULT_BANNERS = [
  {
    id: 'banner-blushberry',
    title: 'Blushberry Beauty Parlour',
    source: require('../../assets/banners/ad-banner-1.png'),
    linkUrl: '',
  },
  {
    id: 'banner-seyon',
    title: 'SeyoN UPVC',
    source: require('../../assets/banners/ad-banner-2.png'),
    linkUrl: '',
  },
  {
    id: 'banner-abi',
    title: 'ABi Restro Cafe Food Truck',
    source: require('../../assets/banners/ad-banner-3.png'),
    linkUrl: '',
  },
];

export const AdBannerCarousel = () => {
  const { isDarkMode } = useTheme();
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Fetch active banners from backend API
  const fetchActiveBanners = useCallback(async () => {
    try {
      const response = await api.get('/banners');
      const data = response.data;
      if (data && data.success && Array.isArray(data.banners) && data.banners.length > 0) {
        const resolved = data.banners.map((item, idx) => {
          let imageSource;
          const imgUrl = (item.imageUrl || '').trim();

          if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) {
            imageSource = { uri: imgUrl };
          } else if (imgUrl.startsWith('/banners/')) {
            imageSource = { uri: `${SERVER_ORIGIN}${imgUrl}` };
          } else {
            // Fallback to local default assets
            imageSource = DEFAULT_BANNERS[idx % DEFAULT_BANNERS.length].source;
          }

          return {
            id: item._id || `dyn-banner-${idx}`,
            title: item.title,
            source: imageSource,
            linkUrl: item.linkUrl || '',
          };
        });

        setBanners(resolved);
      }
    } catch (err) {
      console.warn('[AdBannerCarousel] Failed to fetch dynamic banners, using local defaults:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchActiveBanners();
  }, [fetchActiveBanners]);

  // Auto-scroll loop every 3.5 seconds
  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    if (banners.length <= 1) return;

    timerRef.current = setInterval(() => {
      if (isDraggingRef.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: next * CARD_WIDTH,
            animated: true,
          });
        }
        return next;
      });
    }, 3500);
  }, [banners.length]);

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
    if (index >= 0 && index < banners.length) {
      setActiveIndex(index);
    }
    isDraggingRef.current = false;
  };

  const handleBannerPress = (item) => {
    if (item.linkUrl && item.linkUrl.startsWith('http')) {
      Linking.openURL(item.linkUrl).catch((err) =>
        console.warn('[AdBannerCarousel] Failed to open link:', err.message)
      );
    }
  };

  const renderBannerItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={item.linkUrl ? 0.9 : 1}
      onPress={() => handleBannerPress(item)}
      style={[styles.bannerSlide, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
    >
      <Image
        source={item.source}
        style={styles.bannerImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
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
          data={banners}
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
        {banners.length > 1 && (
          <View style={styles.paginationOverlay} pointerEvents="none">
            {banners.map((_, idx) => {
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
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
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
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerSlide: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 3,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
});

export default AdBannerCarousel;
