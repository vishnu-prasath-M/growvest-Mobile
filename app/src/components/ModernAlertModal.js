import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/theme';

const { width } = Dimensions.get('window');

/**
 * ModernAlertModal - A premium, fintech-grade popup dialog replacing default Alert.alert
 *
 * Props:
 * - visible: boolean
 * - type: 'success' | 'info' | 'warning' | 'error' | 'bank' | 'payout' (default: 'success')
 * - title: string
 * - message: string
 * - primaryButtonText: string (default: 'OK')
 * - onPrimaryPress: function
 * - secondaryButtonText?: string
 * - onSecondaryPress?: function
 * - onClose?: function
 * - iconName?: string (optional override)
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
  iconName,
}) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);

  if (!visible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: iconName || 'check-circle-outline',
          iconColor: '#10B981',
          iconBg: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
          iconBorder: isDarkMode ? 'rgba(52, 211, 153, 0.3)' : '#A7F3D0',
          gradient: ['#0E3D23', '#1C6B3F'],
        };
      case 'bank':
        return {
          icon: iconName || 'bank-check',
          iconColor: '#10B981',
          iconBg: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
          iconBorder: isDarkMode ? 'rgba(52, 211, 153, 0.3)' : '#A7F3D0',
          gradient: ['#0E3D23', '#1C6B3F'],
        };
      case 'payout':
      case 'warning':
        return {
          icon: iconName || 'clock-check-outline',
          iconColor: '#F59E0B',
          iconBg: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
          iconBorder: isDarkMode ? 'rgba(251, 191, 36, 0.35)' : '#FDE68A',
          gradient: ['#78350F', '#B45309'],
        };
      case 'error':
        return {
          icon: iconName || 'alert-circle-outline',
          iconColor: '#EF4444',
          iconBg: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
          iconBorder: isDarkMode ? 'rgba(248, 113, 113, 0.3)' : '#FECACA',
          gradient: ['#7F1D1D', '#B91C1C'],
        };
      default:
        return {
          icon: iconName || 'information-outline',
          iconColor: colors.primary,
          iconBg: isDarkMode ? 'rgba(8, 84, 40, 0.2)' : '#E8F5E9',
          iconBorder: isDarkMode ? 'rgba(34, 197, 94, 0.3)' : '#C8E6C9',
          gradient: ['#0E3D23', '#1C6B3F'],
        };
    }
  };

  const config = getTypeConfig();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose || onPrimaryPress}>
      <TouchableWithoutFeedback onPress={onClose || onPrimaryPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Top Illuminated Icon Badge */}
              <View style={[styles.iconOuter, { backgroundColor: config.iconBg, borderColor: config.iconBorder }]}>
                <MaterialCommunityIcons name={config.icon} size={36} color={config.iconColor} />
              </View>

              {/* Title & Message */}
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {secondaryButtonText ? (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    activeOpacity={0.8}
                    onPress={onSecondaryPress}
                  >
                    <Text style={styles.secondaryBtnText}>{secondaryButtonText}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryBtnWrapper, !secondaryButtonText && { flex: 1, width: '100%' }]}
                  activeOpacity={0.85}
                  onPress={onPrimaryPress}
                >
                  <LinearGradient
                    colors={config.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryGradient}
                  >
                    <Text style={styles.primaryBtnText}>{primaryButtonText}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: Math.min(width - 48, 380),
      backgroundColor: isDarkMode ? '#131B15' : '#FFFFFF',
      borderRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 24,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 12,
    },
    iconOuter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      marginBottom: 18,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: isDarkMode ? '#FFFFFF' : '#111827',
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    message: {
      fontSize: 14,
      lineHeight: 21,
      color: isDarkMode ? 'rgba(229, 231, 235, 0.85)' : '#4B5563',
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    primaryBtnWrapper: {
      borderRadius: 14,
      overflow: 'hidden',
      flex: 1,
      elevation: 3,
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    },
    primaryGradient: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB',
    },
    secondaryBtnText: {
      color: isDarkMode ? '#E5E7EB' : '#374151',
      fontSize: 14,
      fontWeight: '700',
    },
  });

export default ModernAlertModal;
