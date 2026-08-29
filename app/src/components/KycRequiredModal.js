import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * KycRequiredModal
 *
 * Smooth, animated modal that pops up when an unverified/unsubmitted user
 * attempts to make any investment.
 *
 * Props:
 *   visible (boolean)           - Modal visibility
 *   onClose (function)          - Called when modal is dismissed
 *   onNavigateToKYC (function)  - Called when user clicks "Verify KYC"
 */
const KycRequiredModal = ({ visible, status = 'not_submitted', rejectionReason, onClose, onNavigateToKYC }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(120)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 45,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 120,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleVerifyPress = () => {
    onClose();
    if (onNavigateToKYC) {
      onNavigateToKYC();
    }
  };

  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  const modalTitle = isPending
    ? 'KYC Approval Pending'
    : isRejected
    ? 'KYC Verification Rejected'
    : 'Submit KYC before Investment';

  const modalSubtitle = isPending
    ? 'Your KYC is approval pending. Please wait until the Growvest team approves your verification before starting a new investment.'
    : isRejected
    ? (rejectionReason ? `Your KYC was rejected: "${rejectionReason}". Please resubmit valid documents.` : 'Your KYC verification was rejected. Please resubmit valid documents to unlock investments.')
    : 'As per regulatory standards, you must complete your KYC verification before making any investments or joining plans.';

  const modalGradient = isPending
    ? ['#78350F', '#B45309', '#D97706']
    : isRejected
    ? ['#7F1D1D', '#B91C1C', '#DC2626']
    : ['#0E3D23', '#1A5C39', '#2E8B5A'];

  const modalIcon = isPending
    ? 'clock-outline'
    : isRejected
    ? 'shield-alert-outline'
    : 'shield-lock-outline';

  const primaryBtnLabel = isPending
    ? 'View KYC Status'
    : isRejected
    ? 'Resubmit KYC'
    : 'Verify KYC';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim },
                  ],
                },
              ]}
            >
              {/* Header Decorative Icon */}
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={modalGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconCircle}
                >
                  <MaterialCommunityIcons name={modalIcon} size={38} color="#FFFFFF" />
                </LinearGradient>
              </View>

              {/* Title & Body */}
              <Text style={styles.title}>{modalTitle}</Text>
              <Text style={styles.subtitle}>{modalSubtitle}</Text>

              {/* Benefit Badges */}
              <View style={styles.benefitBox}>
                <View style={styles.benefitItem}>
                  <MaterialCommunityIcons name="check-decagram" size={18} color={isPending ? '#D97706' : isRejected ? '#DC2626' : '#1A5C39'} />
                  <Text style={styles.benefitText}>
                    {isPending ? 'Under review by Growvest compliance' : isRejected ? 'Quick document correction' : 'Instant digital verification'}
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <MaterialCommunityIcons name="lock-open-outline" size={18} color={isPending ? '#D97706' : isRejected ? '#DC2626' : '#1A5C39'} />
                  <Text style={styles.benefitText}>Unlocks Savings, Chit & Pocket Money</Text>
                </View>
              </View>

              {/* Primary Action */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleVerifyPress}
                style={styles.primaryBtnOuter}
              >
                <LinearGradient
                  colors={modalGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  <MaterialCommunityIcons name={isPending ? 'eye-outline' : 'shield-check-outline'} size={20} color="#F8FAF9" />
                  <Text style={styles.primaryBtnText}>{primaryBtnLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary Action: Maybe Later */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  {isPending ? 'Close' : 'Maybe Later'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      width: Math.min(SCREEN_WIDTH - 40, 380),
      backgroundColor: themeColors.surface || (isDarkMode ? '#141E18' : '#FFFFFF'),
      borderRadius: 28,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(14,61,35,0.12)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.35,
      shadowRadius: 28,
      elevation: 24,
    },
    iconContainer: {
      marginTop: -8,
      marginBottom: 16,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#1A5C39',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: themeColors.text || (isDarkMode ? '#F8FAF9' : '#0E3D23'),
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: themeColors.textSecondary || (isDarkMode ? '#A0AEC0' : '#4A5568'),
      textAlign: 'center',
      marginBottom: 18,
    },
    benefitBox: {
      width: '100%',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(14,61,35,0.05)',
      borderRadius: 16,
      padding: 14,
      gap: 10,
      marginBottom: 22,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    benefitText: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.text || (isDarkMode ? '#E2E8F0' : '#2D3748'),
    },
    primaryBtnOuter: {
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 10,
      elevation: 4,
    },
    primaryBtn: {
      flexDirection: 'row',
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      borderRadius: 16,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#F8FAF9',
      letterSpacing: 0.2,
    },
    secondaryBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    secondaryBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textMuted || (isDarkMode ? '#718096' : '#A0AEC0'),
    },
  });

export default KycRequiredModal;
