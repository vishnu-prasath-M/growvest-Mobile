import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from './AuthContext';
import api from '../services/apiService';

const DailyRewardContext = createContext(null);

// Helper for Indian Standard Time (IST) Date string YYYY-MM-DD
export const getISTDateString = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  return istTime.toISOString().split('T')[0];
};

export const DailyRewardProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?._id || user?.id || 'guest';

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [hasClaimedDaily, setHasClaimedDaily] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
  // In-app Toast Banner State
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerData, setBannerData] = useState({ title: '', message: '', coins: 2 });
  const bannerAnim = useRef(new Animated.Value(-120)).current;

  const appStateRef = useRef(AppState.currentState);
  const timerRef = useRef(null);
  const sessionSecondsRef = useRef(0);
  const isClaimingRef = useRef(false);
  const hasClaimedDailyRef = useRef(false);

  // Synchronize refs with state
  useEffect(() => {
    sessionSecondsRef.current = sessionSeconds;
  }, [sessionSeconds]);

  useEffect(() => {
    hasClaimedDailyRef.current = hasClaimedDaily;
  }, [hasClaimedDaily]);

  useEffect(() => {
    isClaimingRef.current = isClaiming;
  }, [isClaiming]);

  // Show celebratory floating banner
  const triggerCelebrationBanner = (message, coins = 2) => {
    setBannerData({
      title: '🎉 Daily Login Reward Claimed!',
      message: message || `+${coins} Coins (₹${(coins * 0.05).toFixed(2)}) added to your wallet!`,
      coins,
    });
    setBannerVisible(true);

    Animated.sequence([
      Animated.spring(bannerAnim, {
        toValue: 50, // slide down safely below status bar
        useNativeDriver: true,
        bounciness: 10,
      }),
      Animated.delay(4500),
      Animated.timing(bannerAnim, {
        toValue: -140,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setBannerVisible(false);
    });
  };

  const dismissBanner = () => {
    Animated.timing(bannerAnim, {
      toValue: -140,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setBannerVisible(false);
    });
  };

  // Claim API function
  const claimReward = useCallback(async (isManual = false) => {
    if (!isAuthenticated || isClaimingRef.current || hasClaimedDailyRef.current) return;

    isClaimingRef.current = true;
    setIsClaiming(true);

    const todayStr = getISTDateString();
    const storageKey = `@growvest_daily_session_${userId}_${todayStr}`;

    try {
      const res = await api.post('/referral/daily-login');
      if (res.data?.success) {
        hasClaimedDailyRef.current = true;
        setHasClaimedDaily(true);
        await AsyncStorage.setItem(storageKey, JSON.stringify({ seconds: 30, claimed: true, date: todayStr }));
        triggerCelebrationBanner(res.data?.message, res.data?.coinsAwarded || 2);
        return { success: true, message: res.data?.message };
      } else if (res.data?.alreadyClaimed) {
        hasClaimedDailyRef.current = true;
        setHasClaimedDaily(true);
        await AsyncStorage.setItem(storageKey, JSON.stringify({ seconds: 30, claimed: true, date: todayStr }));
        return { success: false, alreadyClaimed: true, message: res.data?.message };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Daily login already claimed today.';
      if (err.response?.data?.alreadyClaimed || err.response?.status === 400) {
        hasClaimedDailyRef.current = true;
        setHasClaimedDaily(true);
        await AsyncStorage.setItem(storageKey, JSON.stringify({ seconds: 30, claimed: true, date: todayStr }));
      }
      return { success: false, message: msg };
    } finally {
      isClaimingRef.current = false;
      setIsClaiming(false);
    }
  }, [isAuthenticated, userId]);

  // Load saved session progress and verify claim status
  useEffect(() => {
    if (!isAuthenticated) {
      setSessionSeconds(0);
      setHasClaimedDaily(false);
      return;
    }

    const loadDailyStatus = async () => {
      try {
        const todayStr = getISTDateString();
        const storageKey = `@growvest_daily_session_${userId}_${todayStr}`;
        const saved = await AsyncStorage.getItem(storageKey);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.claimed) {
            setHasClaimedDaily(true);
            hasClaimedDailyRef.current = true;
            setSessionSeconds(30);
            return;
          } else if (typeof parsed.seconds === 'number') {
            setSessionSeconds(parsed.seconds);
            sessionSecondsRef.current = parsed.seconds;
          }
        }

        // Fetch wallet data to check if claimed on server
        try {
          const res = await api.get('/referral/coins');
          if (res.data?.hasClaimedDailyToday) {
            setHasClaimedDaily(true);
            hasClaimedDailyRef.current = true;
            await AsyncStorage.setItem(storageKey, JSON.stringify({ seconds: 30, claimed: true, date: todayStr }));
          }
        } catch (apiErr) {
          // ignore network failures on initial check
        }
      } catch (err) {
        console.warn('[DailyRewardContext] Error loading status:', err);
      }
    };

    loadDailyStatus();
  }, [isAuthenticated, userId]);

  // AppState Listener & 30-Second Active Session Timer
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = (nextAppState) => {
      appStateRef.current = nextAppState;
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Run active background timer every 1 second
    timerRef.current = setInterval(() => {
      if (appStateRef.current !== 'active') return;
      if (hasClaimedDailyRef.current) return;

      const nextSec = sessionSecondsRef.current + 1;
      sessionSecondsRef.current = nextSec;
      setSessionSeconds(nextSec);

      // Save every 5 seconds to reduce storage writes
      const todayStr = getISTDateString();
      const storageKey = `@growvest_daily_session_${userId}_${todayStr}`;
      if (nextSec % 5 === 0) {
        AsyncStorage.setItem(storageKey, JSON.stringify({ seconds: nextSec, claimed: false, date: todayStr })).catch(() => {});
      }

      // If reached 30 seconds, automatically trigger claim in background!
      if (nextSec >= 30 && !hasClaimedDailyRef.current && !isClaimingRef.current) {
        claimReward(false);
      }
    }, 1000);

    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isAuthenticated, userId, claimReward]);

  return (
    <DailyRewardContext.Provider
      value={{
        sessionSeconds,
        hasClaimedDaily,
        isClaiming,
        claimReward,
        triggerCelebrationBanner,
      }}
    >
      {children}

      {/* Floating Celebratory Daily Reward Toast Banner */}
      {bannerVisible && (
        <Animated.View
          style={[
            styles.bannerContainer,
            { transform: [{ translateY: bannerAnim }] },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={dismissBanner}
            style={styles.bannerTouchable}
          >
            <LinearGradient
              colors={['#085428', '#1A5C39', '#0D3B22']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerGradient}
            >
              <View style={styles.bannerIconBox}>
                <MaterialCommunityIcons name="star-circle" size={28} color="#FFD700" />
              </View>
              <View style={styles.bannerTextBox}>
                <Text style={styles.bannerTitle}>{bannerData.title}</Text>
                <Text style={styles.bannerMessage}>{bannerData.message}</Text>
              </View>
              <TouchableOpacity onPress={dismissBanner} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={20} color="#A7F3D0" />
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </DailyRewardContext.Provider>
  );
};

export const useDailyReward = () => {
  const context = useContext(DailyRewardContext);
  if (!context) {
    throw new Error('useDailyReward must be used within a DailyRewardProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  bannerTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextBox: {
    flex: 1,
    marginRight: 8,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 2,
  },
  bannerMessage: {
    fontSize: 12,
    color: '#E6F4EA',
    lineHeight: 16,
  },
});
