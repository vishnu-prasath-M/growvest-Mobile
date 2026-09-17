import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * ModernAlertModal - 100% Fidelity Bottom Sheet Confirmation & Alert Modal
 *
 * Props:
 * - visible: boolean
 * - type: 'success' | 'warning' | 'error' | 'payout' | 'logout' | 'lock' | 'processing' | 'info'
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
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          bounciness: 4,
          speed: 16,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#22C55E',
          component: <Ionicons name="checkmark" size={36} color="#FFFFFF" />,
        };
      case 'warning':
      case 'problem':
        return {
          bg: isDarkMode ? '#3B2A05' : '#FFFBEB',
          borderColor: isDarkMode ? '#F59E0B' : '#FDE68A',
          component: <Ionicons name="warning" size={36} color="#F59E0B" />,
        };
      case 'error':
        return {
          bg: isDarkMode ? '#3B1212' : '#FEF2F2',
          borderColor: isDarkMode ? '#EF4444' : '#FECACA',
          component: <Ionicons name="alert-circle" size={36} color="#EF4444" />,
        };
      case 'logout':
        return {
          bg: isDarkMode ? '#3B1212' : '#FEE2E2',
          borderColor: isDarkMode ? '#EF4444' : '#FCA5A5',
          component: <MaterialCommunityIcons name="logout-variant" size={34} color="#DC2626" />,
        };
      case 'lock':
      case 'applock':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#ECFDF5',
          borderColor: isDarkMode ? '#10B981' : '#A7F3D0',
          component: <MaterialCommunityIcons name="shield-lock-outline" size={36} color="#059669" />,
        };
      case 'payout':
      case 'chit':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#ECFDF5',
          borderColor: isDarkMode ? '#10B981' : '#A7F3D0',
          component: <MaterialCommunityIcons name="cash-fast" size={36} color="#059669" />,
        };
      case 'processing':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#ECFDF5',
          borderColor: isDarkMode ? '#10B981' : '#A7F3D0',
          component: <Ionicons name="paper-plane" size={34} color="#059669" />,
        };
      default:
        return {
          bg: isDarkMode ? '#0E2E1D' : '#ECFDF5',
          borderColor: isDarkMode ? '#10B981' : '#A7F3D0',
          component: <Ionicons name="information-circle" size={38} color="#059669" />,
        };
    }
  };

  const iconConfig = getIconConfig();
  const hasTwoButtons = !!secondaryButtonText;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose || onSecondaryPress || onPrimaryPress}
    >
      <View style={styles.overlay}>
        {/* Backdrop Dismiss */}
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onClose || onSecondaryPress || onPrimaryPress}
          />
        </Animated.View>

        {/* Bottom Sheet Card */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Drag Handle Bar */}
          <View style={styles.dragHandle} />

          {/* Centered Top Icon Badge */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: iconConfig.bg,
                borderColor: iconConfig.borderColor || 'transparent',
                borderWidth: iconConfig.borderColor ? 1.5 : 0,
              },
            ]}
          >
            {iconConfig.component}
          </View>

          {/* Title & Message */}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {hasTwoButtons && (
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.8}
                onPress={onSecondaryPress || onClose}
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
              activeOpacity={0.85}
              onPress={onPrimaryPress}
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
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
      zIndex: 999999,
    },
    backdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.58)',
    },
    sheetContainer: {
      width: '100%',
      backgroundColor: isDarkMode ? '#161B22' : '#FFFFFF',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 14,
      paddingBottom: Platform.OS === 'ios' ? 38 : 28,
      alignItems: 'center',
      alignSelf: 'stretch',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 24,
    },
    dragHandle: {
      width: 42,
      height: 4.5,
      borderRadius: 3,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.22)' : '#E5E7EB',
      marginBottom: 20,
    },
    iconCircle: {
      width: 66,
      height: 66,
      borderRadius: 33,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: isDarkMode ? '#F3F4F6' : '#111827',
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.2,
      paddingHorizontal: 12,
      alignSelf: 'center',
    },
    message: {
      fontSize: 14,
      lineHeight: 21,
      color: isDarkMode ? '#9CA3AF' : '#6B7280',
      textAlign: 'center',
      marginBottom: 26,
      paddingHorizontal: 8,
      alignSelf: 'center',
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
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDarkMode ? '#E5E7EB' : '#1F2937',
    },
    primaryButton: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#111827',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    singlePrimaryButton: {
      flex: 1,
      width: '100%',
    },
    destructivePrimaryButton: {
      backgroundColor: '#DC2626',
      shadowColor: '#DC2626',
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default ModernAlertModal;
