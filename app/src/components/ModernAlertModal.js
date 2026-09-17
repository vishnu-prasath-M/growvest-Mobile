import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * ModernAlertModal - 100% Fidelity iOS Bottom Sheet Confirmation & Alert Modal
 *
 * Props:
 * - visible: boolean
 * - type: 'success' | 'warning' | 'problem' | 'error' | 'payout' | 'chit' | 'logout' | 'lock' | 'applock' | 'processing' | 'info'
 * - title: string
 * - message: string
 * - primaryButtonText: string (default: 'OK')
 * - onPrimaryPress: function
 * - secondaryButtonText?: string (e.g. 'Cancel' or 'Close')
 * - onSecondaryPress?: function
 * - onClose?: function
 * - isDestructive?: boolean (e.g. for Logout)
 */
const ModernAlertModal = ({
  visible,
  type = 'success',
  title,
  message,
  primaryButtonText = 'OK',
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  onClose,
  isDestructive = false,
}) => {
  const { isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  // Window & Screen dimensions for bulletproof full-screen coverage
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [screenDims, setScreenDims] = useState(() => {
    const s = Dimensions.get('screen');
    const w = Dimensions.get('window');
    return {
      width: Math.max(s.width || 0, w.width || 0, winWidth || 0),
      height: Math.max(s.height || 0, w.height || 0, winHeight || 0),
    };
  });

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ screen, window }) => {
      setScreenDims({
        width: Math.max(screen.width || 0, window.width || 0),
        height: Math.max(screen.height || 0, window.height || 0),
      });
    });
    return () => sub?.remove?.();
  }, []);

  const modalWidth = Math.max(screenDims.width, winWidth);
  const modalHeight = Math.max(screenDims.height, winHeight);

  // Animation values
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isRendered, setIsRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      slideAnim.setValue(500);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          bounciness: 4,
          speed: 15,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isRendered) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
      });
    }
  }, [visible]);

  if (!visible && !isRendered) return null;

  const handlePrimaryPress = () => {
    if (typeof onPrimaryPress === 'function') {
      onPrimaryPress();
    } else if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleSecondaryPress = () => {
    if (typeof onSecondaryPress === 'function') {
      onSecondaryPress();
    } else if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleDismiss = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else if (typeof onSecondaryPress === 'function') {
      onSecondaryPress();
    } else if (typeof onPrimaryPress === 'function') {
      onPrimaryPress();
    }
  };

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#22C55E',
          border: 'transparent',
          component: <Ionicons name="checkmark" size={38} color="#FFFFFF" />,
        };
      case 'warning':
      case 'problem':
        return {
          bg: isDarkMode ? '#3A2800' : '#FEF3C7',
          border: '#F59E0B',
          component: <Ionicons name="warning" size={32} color="#F59E0B" />,
        };
      case 'error':
        return {
          bg: isDarkMode ? '#3B1212' : '#FEE2E2',
          border: '#EF4444',
          component: <Ionicons name="close" size={36} color="#EF4444" />,
        };
      case 'logout':
        return {
          bg: isDarkMode ? '#3B1212' : '#FEE2E2',
          border: '#EF4444',
          component: <Ionicons name="log-out-outline" size={32} color="#EF4444" />,
        };
      case 'lock':
      case 'applock':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#DCFCE7',
          border: '#16A34A',
          component: <Ionicons name="shield-checkmark" size={32} color="#16A34A" />,
        };
      case 'payout':
      case 'chit':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#DCFCE7',
          border: '#16A34A',
          component: <Ionicons name="wallet-outline" size={32} color="#16A34A" />,
        };
      case 'processing':
        return {
          bg: isDarkMode ? '#0C2A4D' : '#E0F2FE',
          border: '#0284C7',
          component: <Ionicons name="paper-plane" size={30} color="#0284C7" />,
        };
      default:
        return {
          bg: isDarkMode ? '#0C2A4D' : '#E0F2FE',
          border: '#0284C7',
          component: <Ionicons name="information-circle" size={36} color="#0284C7" />,
        };
    }
  };

  const iconConfig = getIconConfig();
  const hasTwoButtons = !!secondaryButtonText;

  return (
    <Modal
      visible={visible || isRendered}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleDismiss}
    >
      <View
        style={[
          styles.modalRoot,
          {
            width: modalWidth,
            height: modalHeight,
          },
        ]}
      >
        {/* Animated Dark Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              width: modalWidth,
              height: modalHeight,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Animated iOS Bottom Sheet Card */}
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.sheetCard,
            {
              width: modalWidth,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Top Grab Handle */}
          <View style={styles.dragHandle} />

          {/* Centered iOS-Style Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: iconConfig.bg,
                borderColor: iconConfig.border,
                borderWidth: iconConfig.border !== 'transparent' ? 1.5 : 0,
              },
            ]}
          >
            {iconConfig.component}
          </View>

          {/* Centered Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Centered Subtitle / Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Action Buttons Row */}
          <View style={styles.buttonRow}>
            {hasTwoButtons && (
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleSecondaryPress}
              >
                <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                !hasTwoButtons && styles.singlePrimaryButton,
                (isDestructive || type === 'logout') && styles.destructivePrimaryButton,
              ]}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handlePrimaryPress}
            >
              <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const getStyles = (isDarkMode) =>
  StyleSheet.create({
    modalRoot: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
      alignItems: 'center',
      zIndex: 999999,
      elevation: 999999,
    },
    sheetCard: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 44 : 32,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 50,
      zIndex: 1000,
    },
    dragHandle: {
      width: 36,
      height: 4.5,
      borderRadius: 3,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#E5E7EB',
      marginBottom: 20,
      alignSelf: 'center',
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: isDarkMode ? '#F9FAFB' : '#111827',
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.4,
      paddingHorizontal: 16,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
      marginBottom: 26,
      paddingHorizontal: 10,
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      width: '100%',
    },
    secondaryButton: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#F3F4F6',
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDarkMode ? '#F3F4F6' : '#1F2937',
    },
    primaryButton: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#111827',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
    },
    singlePrimaryButton: {
      flex: 1,
      width: '100%',
    },
    destructivePrimaryButton: {
      backgroundColor: '#EF4444',
      shadowColor: '#EF4444',
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

export default ModernAlertModal;
