import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * ModernAlertModal - 100% Fidelity iOS Bottom Sheet Confirmation & Alert Modal
 *
 * Props:
 * - visible: boolean
 * - type: 'success' | 'warning' | 'error' | 'payout' | 'logout' | 'lock' | 'applock' | 'processing' | 'info'
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

  if (!visible) return null;

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          bg: '#34C759',
          border: 'transparent',
          component: <Ionicons name="checkmark" size={36} color="#FFFFFF" />,
        };
      case 'warning':
      case 'problem':
        return {
          bg: isDarkMode ? '#3A2800' : '#FFF9E6',
          border: '#FF9F0A',
          component: <Ionicons name="warning" size={34} color="#FF9F0A" />,
        };
      case 'error':
        return {
          bg: isDarkMode ? '#3A1010' : '#FFEEEE',
          border: '#FF3B30',
          component: <Ionicons name="close" size={36} color="#FF3B30" />,
        };
      case 'logout':
        return {
          bg: isDarkMode ? '#3A1010' : '#FEE2E2',
          border: '#FF3B30',
          component: <Ionicons name="log-out-outline" size={34} color="#FF3B30" />,
        };
      case 'lock':
      case 'applock':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#ECFDF5',
          border: '#34C759',
          component: <Ionicons name="shield-checkmark" size={34} color="#34C759" />,
        };
      case 'payout':
      case 'chit':
        return {
          bg: isDarkMode ? '#0E2E1D' : '#ECFDF5',
          border: '#34C759',
          component: <Ionicons name="wallet-outline" size={34} color="#34C759" />,
        };
      case 'processing':
        return {
          bg: isDarkMode ? '#0D2B45' : '#EBF5FF',
          border: '#007AFF',
          component: <Ionicons name="paper-plane" size={32} color="#007AFF" />,
        };
      default:
        return {
          bg: isDarkMode ? '#0D2B45' : '#EBF5FF',
          border: '#007AFF',
          component: <Ionicons name="information-circle" size={36} color="#007AFF" />,
        };
    }
  };

  const iconConfig = getIconConfig();
  const hasTwoButtons = !!secondaryButtonText;

  const handleDismiss = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else if (typeof onSecondaryPress === 'function') {
      onSecondaryPress();
    } else if (typeof onPrimaryPress === 'function') {
      onPrimaryPress();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        {/* Backdrop touchable to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        {/* Bottom Sheet Card */}
        <View style={styles.sheetCard}>
          {/* Top Grab Bar / Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Centered iOS-Style Icon Circle */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: iconConfig.bg,
                borderColor: iconConfig.border,
                borderWidth: iconConfig.border !== 'transparent' ? 2 : 0,
              },
            ]}
          >
            {iconConfig.component}
          </View>

          {/* Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}

          {/* Message / Description */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Action Buttons Row */}
          <View style={styles.buttonRow}>
            {hasTwoButtons && (
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.75}
                onPress={onSecondaryPress || handleDismiss}
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
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
    },
    sheetCard: {
      width: '100%',
      backgroundColor: isDarkMode ? '#1C1C1E' : '#FFFFFF',
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 42 : 28,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 30,
    },
    dragHandle: {
      width: 38,
      height: 4.5,
      borderRadius: 2.5,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.22)' : '#E5E7EB',
      marginBottom: 20,
    },
    iconCircle: {
      width: 68,
      height: 68,
      borderRadius: 34,
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
      color: isDarkMode ? '#F2F2F7' : '#000000',
      textAlign: 'center',
      marginBottom: 8,
      letterSpacing: -0.3,
      paddingHorizontal: 12,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: isDarkMode ? '#8E8E93' : '#6B7280',
      textAlign: 'center',
      marginBottom: 26,
      paddingHorizontal: 8,
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
      height: 50,
      borderRadius: 25,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F7',
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDarkMode ? '#F2F2F7' : '#1C1C1E',
    },
    primaryButton: {
      flex: 1,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#1C1C1E',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    singlePrimaryButton: {
      flex: 1,
      width: '100%',
    },
    destructivePrimaryButton: {
      backgroundColor: '#FF3B30',
      shadowColor: '#FF3B30',
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default ModernAlertModal;
