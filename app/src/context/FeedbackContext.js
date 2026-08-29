import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';
import { registerApiListeners } from '../services/apiService';
import { API_BASE_URL } from '../config/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FeedbackContext = createContext(null);

export const FeedbackProvider = ({ children }) => {
  // Modal / Toast states
  const [offline, setOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [slowDb, setSlowDb] = useState(false);
  
  // Custom Popup Modals
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupConfig, setPopupConfig] = useState({
    type: 'success', // 'success', 'error', 'warning'
    title: '',
    message: '',
  });

  // Animated values
  const offlinePulse = useRef(new Animated.Value(1)).current;
  const backOnlineAnim = useRef(new Animated.Value(-100)).current; // starts offscreen (top)
  const popupAnim = useRef(new Animated.Value(0)).current;
  const failureCountRef = useRef(0);

  // Connection check helper with consecutive failure threshold (prevents false offline triggers on minor mobile jitter)
  const checkConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response && (response.status === 204 || response.status === 200 || response.ok)) {
        failureCountRef.current = 0;
        if (offline) {
          setOffline(false);
          // Show "We are back" banner
          setShowBackOnline(true);
          Animated.sequence([
            Animated.spring(backOnlineAnim, {
              toValue: 24, // slide down slightly below status bar
              useNativeDriver: true,
              bounciness: 12,
            }),
            Animated.delay(3000),
            Animated.timing(backOnlineAnim, {
              toValue: -120,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShowBackOnline(false);
          });
        }
      } else {
        failureCountRef.current += 1;
        if (failureCountRef.current >= 3 && !offline) {
          setOffline(true);
        }
      }
    } catch (err) {
      failureCountRef.current += 1;
      // Only trigger offline modal if 3 consecutive pings fail (genuine network loss)
      if (failureCountRef.current >= 3 && !offline) {
        setOffline(true);
      }
    }
  };

  useEffect(() => {
    // Check initial connection
    checkConnection();
    // Poll connection status every 25 seconds
    const interval = setInterval(checkConnection, 25000);
    return () => clearInterval(interval);
  }, [offline]);

  // Handle offline pulse animation
  useEffect(() => {
    if (offline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(offlinePulse, {
            toValue: 1.15,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(offlinePulse, {
            toValue: 1.0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      offlinePulse.setValue(1);
    }
  }, [offline]);

  // Hook up API Interceptor listeners
  useEffect(() => {
    registerApiListeners(
      (isSlow) => {
        setSlowDb(isSlow);
      },
      (type, title, message) => {
        // Trigger error popups for 500 / network errors
        showPopup(type === 'network_error' ? 'warning' : 'error', title, message);
      }
    );
  }, []);

  const showPopup = (type, title, message) => {
    setPopupConfig({ type, title, message });
    setPopupVisible(true);
    Animated.spring(popupAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closePopup = () => {
    Animated.timing(popupAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPopupVisible(false);
    });
  };

  return (
    <FeedbackContext.Provider value={{ showSuccess: (t, m) => showPopup('success', t, m), showError: (t, m) => showPopup('error', t, m), showWarning: (t, m) => showPopup('warning', t, m) }}>
      {children}

      {/* ── 1. Fullscreen Offline Modal ── */}
      <Modal visible={offline} transparent animationType="fade">
        <View style={styles.fullscreenOverlay}>
          <LinearGradient
            colors={['#062314', '#0B3A21']}
            style={styles.fullscreenContent}
          >
            <Animated.View style={[styles.offlineIconBox, { transform: [{ scale: offlinePulse }] }]}>
              <Ionicons name="cloud-offline" size={54} color="#D4A843" />
            </Animated.View>
            <Text style={styles.offlineTitle}>Connection Lost</Text>
            <Text style={styles.offlineDesc}>
              It looks like you are offline. Check your internet connection or Wi-Fi settings. We will automatically reconnect you when network is back.
            </Text>
            <View style={styles.reconnectingRow}>
              <ActivityIndicator size="small" color="#D4A843" style={{ marginRight: 8 }} />
              <Text style={styles.reconnectingText}>Reconnecting...</Text>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* ── 2. "We are back" Toast Banner ── */}
      {showBackOnline && (
        <Animated.View style={[styles.backOnlineBanner, { transform: [{ translateY: backOnlineAnim }] }]}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.backOnlineGradient}
          >
            <Ionicons name="checkmark-circle" size={20} color="#F8FAF9" />
            <Text style={styles.backOnlineText}>We are back! Connection restored.</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* ── 3. Database Slow Banner ── */}
      {slowDb && (
        <View style={styles.slowDbBanner}>
          <Ionicons name="hourglass" size={15} color="#D4A843" style={{ marginRight: 6 }} />
          <Text style={styles.slowDbText}>Database is taking longer than usual. Please hold on...</Text>
        </View>
      )}

      {/* ── 4. Global Action Popup Modal (Success, Error, Warning) ── */}
      {popupVisible && (
        <Modal visible={popupVisible} transparent animationType="none">
          <Animated.View style={[styles.popupOverlay, { opacity: popupAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closePopup} />
            <Animated.View
              style={[
                styles.popupCard,
                {
                  transform: [
                    { scale: popupAnim },
                    {
                      translateY: popupAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [60, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[
                styles.popupIconCircle,
                popupConfig.type === 'success' && styles.iconSuccess,
                popupConfig.type === 'error' && styles.iconError,
                popupConfig.type === 'warning' && styles.iconWarning,
              ]}>
                <Ionicons
                  name={
                    popupConfig.type === 'success' ? 'checkmark-done' :
                    popupConfig.type === 'error' ? 'close' : 'warning-outline'
                  }
                  size={36}
                  color={
                    popupConfig.type === 'success' ? '#0E3D23' :
                    popupConfig.type === 'error' ? '#D32F2F' : '#D4A843'
                  }
                />
              </View>
              <Text style={styles.popupTitle}>{popupConfig.title}</Text>
              <Text style={styles.popupMsg}>{popupConfig.message}</Text>
              
              <TouchableOpacity
                onPress={closePopup}
                style={[
                  styles.popupButton,
                  popupConfig.type === 'success' && styles.btnSuccess,
                  popupConfig.type === 'error' && styles.btnError,
                  popupConfig.type === 'warning' && styles.btnWarning,
                ]}
              >
                <Text style={styles.popupButtonText}>Okay</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  // Offline Modal
  fullscreenOverlay: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'rgba(6,35,20,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  offlineIconBox: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(212,168,67,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  offlineTitle: { fontSize: 24, fontWeight: '800', color: '#F8FAF9', marginBottom: 12 },
  offlineDesc: { fontSize: 14, color: 'rgba(248,250,249,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  reconnectingText: { fontSize: 13, color: '#D4A843', fontWeight: '600' },
  reconnectingRow: { flexDirection: 'row', alignItems: 'center' },

  // Back Online Banner
  backOnlineBanner: {
    position: 'absolute', top: 24, left: 16, right: 16, zIndex: 9999,
  },
  backOnlineGradient: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 20,
    shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  backOnlineText: { color: '#F8FAF9', fontSize: 14, fontWeight: '700', marginLeft: 8 },

  // Database Slow Banner
  slowDbBanner: {
    position: 'absolute', bottom: 100, left: 24, right: 24, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(6,35,20,0.92)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#D4A843',
  },
  slowDbText: { color: '#F8FAF9', fontSize: 12, fontWeight: '600' },

  // Popup Action Modal
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  popupCard: {
    width: '82%', backgroundColor: '#FFFFFF', borderRadius: 28,
    padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  popupIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  iconSuccess: { backgroundColor: 'rgba(14,61,35,0.08)' },
  iconError: { backgroundColor: 'rgba(211,47,47,0.08)' },
  iconWarning: { backgroundColor: 'rgba(212,168,67,0.08)' },
  popupTitle: { fontSize: 18, fontWeight: '700', color: '#1C1917', marginBottom: 8 },
  popupMsg: { fontSize: 13, color: '#44403C', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  popupButton: {
    width: '100%', height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  btnSuccess: { backgroundColor: '#0E3D23' },
  btnError: { backgroundColor: '#D32F2F' },
  btnWarning: { backgroundColor: '#D4A843' },
  popupButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
