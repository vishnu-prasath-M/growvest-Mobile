import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Linking,
  Modal,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/theme';
import { paymentService } from '../../services/paymentService';
import { API_BASE_URL } from '../../config/api';

const SERVER_ORIGIN = (API_BASE_URL || '').replace(/\/api\/?$/, '');

export const ManualUpiPaymentScreen = ({ navigation, route }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);

  const {
    amount = 0,
    paymentType = 'investment',
    payloadData = {},
    title = 'Growvest Investment',
    returnScreen = 'MainTabs',
    existingOrderId = null,
  } = route.params || {};

  const [orderId, setOrderId] = useState(existingOrderId || `UPI_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`);
  const [exactPayAmount, setExactPayAmount] = useState(route.params?.payAmount || amount);
  const [orderRef, setOrderRef] = useState(route.params?.ref || '');
  const [upiLinkFromApi, setUpiLinkFromApi] = useState(null);
  const [upiId, setUpiId] = useState('8925699005@upi');
  const [payeeName, setPayeeName] = useState('Growvest Investments');
  const [customQrImage, setCustomQrImage] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [userRemarks, setUserRemarks] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState(null);
  const [screenshotUri, setScreenshotUri] = useState(null);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pollingActive, setPollingActive] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('pending'); // 'pending' | 'completed' | 'submitted'

  // Initialize Auto-UPI payment order and details from backend
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoadingConfig(true);
        // Create unique order with exact paise and ref from backend
        const orderRes = await paymentService.createOrder(amount, paymentType, payloadData);
        if (isMounted && orderRes?.success) {
          if (orderRes.orderId) setOrderId(orderRes.orderId);
          if (orderRes.payAmount) setExactPayAmount(orderRes.payAmount);
          if (orderRes.ref) setOrderRef(orderRes.ref);
          if (orderRes.upiLink) setUpiLinkFromApi(orderRes.upiLink);
          if (orderRes.companyUpi) {
            if (orderRes.companyUpi.upiId) setUpiId(orderRes.companyUpi.upiId);
            if (orderRes.companyUpi.payeeName) setPayeeName(orderRes.companyUpi.payeeName);
            if (orderRes.companyUpi.qrImage) setCustomQrImage(orderRes.companyUpi.qrImage);
          }
        }
      } catch (err) {
        console.warn('[ManualUpiPayment] Error initializing auto UPI order:', err.message);
      } finally {
        if (isMounted) setLoadingConfig(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Auto-Polling for Bank Credit Confirmation
  useEffect(() => {
    if (!orderId || !pollingActive || showSuccessModal) return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await paymentService.checkUpiOrderStatus(orderId);
        if (statusRes?.success && (statusRes.status === 'completed' || statusRes.status === 'paid')) {
          setPaymentStatus('completed');
          setPollingActive(false);
          setShowSuccessModal(true);
        }
      } catch (err) {
        // Quiet background polling
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [orderId, pollingActive, showSuccessModal]);

  const formatCurrency = (val) =>
    `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Copy UPI ID to clipboard
  const handleCopyUpi = async () => {
    await Clipboard.setStringAsync(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleCopyOrderId = async () => {
    await Clipboard.setStringAsync(orderId);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  // Construct UPI URI with exact paise and reference code
  const getUpiUrl = (appScheme = null) => {
    if (upiLinkFromApi && !appScheme) {
      return upiLinkFromApi;
    }

    const encodedUpi = encodeURIComponent(upiId);
    const encodedName = encodeURIComponent(payeeName);
    const noteText = orderRef ? `${orderRef} Growvest` : `Growvest ${orderId}`;
    const encodedNote = encodeURIComponent(noteText);
    const finalAmountStr = Number(exactPayAmount || amount).toFixed(2);

    let base = `upi://pay?pa=${encodedUpi}&pn=${encodedName}&am=${finalAmountStr}&cu=INR&tn=${encodedNote}`;
    if (appScheme) {
      return `${appScheme}://${base.replace('upi://', '')}`;
    }
    return base;
  };

  // Launch UPI App directly
  const handleOpenUpiApp = async (appScheme = null) => {
    const upiLink = getUpiUrl(appScheme);
    try {
      const supported = await Linking.canOpenURL(upiLink);
      if (supported) {
        await Linking.openURL(upiLink);
      } else {
        // Fallback to generic upi://pay
        await Linking.openURL(getUpiUrl());
      }
    } catch (err) {
      // If specific scheme fails, try generic
      try {
        await Linking.openURL(getUpiUrl());
      } catch (fallbackErr) {
        Alert.alert(
          'UPI App Not Found',
          `Could not open UPI app automatically. Please copy the UPI ID (${upiId}) and pay using any UPI app on your phone.`,
          [{ text: 'Copy UPI ID', onPress: handleCopyUpi }, { text: 'OK' }]
        );
      }
    }
  };

  // Pick payment screenshot
  const handlePickScreenshot = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery access is required to attach your payment receipt screenshot.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setScreenshotUri(asset.uri);
        setScreenshotBase64(`data:image/jpeg;base64,${asset.base64}`);
      }
    } catch (err) {
      console.warn('Image pick error:', err);
    }
  };

  // Instant UTR Verification against Canara Bank Alerts
  const handleSubmitVerification = async () => {
    const cleanUtr = utrNumber.trim();
    if (!cleanUtr) {
      Alert.alert('UTR Required', 'Please enter the 12-digit UPI Reference Number / Transaction ID from your payment receipt.');
      return;
    }

    if (cleanUtr.length < 6) {
      Alert.alert('Invalid UTR', 'Please enter a valid 12-digit UPI Reference Number (UTR).');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Try instant UTR claim against bank alerts
      const claimRes = await paymentService.claimUpiUtr(orderId, cleanUtr);
      if (claimRes?.success && claimRes.status === 'paid') {
        setPaymentStatus('completed');
        setPollingActive(false);
        setShowSuccessModal(true);
        return;
      }

      // 2. Fallback to manual queue if bank email hasn't arrived yet
      const res = await paymentService.submitManualPayment({
        orderId,
        utr: cleanUtr,
        screenshotBase64,
        userRemarks,
        paymentType,
        amount: Math.round(Number(amount)),
        payloadData,
      });

      if (res?.success) {
        setPaymentStatus('submitted');
        setShowSuccessModal(true);
      } else {
        Alert.alert('Notice', claimRes?.message || res?.message || 'Payment under verification.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit verification';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic QR Code URL
  const qrCodeApiUrl = customQrImage && customQrImage.startsWith('/')
    ? `${SERVER_ORIGIN}${customQrImage}`
    : customQrImage ||
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(getUpiUrl())}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Direct UPI Payment</Text>
          <Text style={styles.headerSubtitle}>0% Gateway Fee • 100% Safe & Secure</Text>
        </View>
        <View style={styles.securityBadge}>
          <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Order Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconBox}>
              <MaterialCommunityIcons name="wallet-outline" size={24} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{title}</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(exactPayAmount)}</Text>
              {exactPayAmount !== amount && (
                <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600', marginTop: 2 }}>
                  Base: ₹{amount} + ₹{(exactPayAmount - amount).toFixed(2)} (Paise for Auto-Approval)
                </Text>
              )}
            </View>
          </View>

          <View style={styles.autoVerifyBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#059669" />
            <Text style={styles.autoVerifyText}>
              Canara Bank Auto-Approval • Verifies in 15–30 sec
            </Text>
          </View>

          <View style={styles.orderIdRow}>
            <Text style={styles.orderIdLabel}>Order ID: <Text style={styles.orderIdVal}>{orderId}</Text></Text>
            <TouchableOpacity onPress={handleCopyOrderId} style={styles.orderIdCopyBtn}>
              <MaterialCommunityIcons name={copiedOrderId ? 'check' : 'content-copy'} size={14} color="#10B981" />
              <Text style={styles.orderIdCopyText}>{copiedOrderId ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 1: Pay to Company UPI Card */}
        <View style={styles.card}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Pay Using Any UPI App</Text>
              <Text style={styles.stepSubtitle}>Scan QR code or click 1-tap app button below</Text>
            </View>
          </View>

          {/* Company UPI ID Highlight Box */}
          <View style={styles.upiIdBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.upiPayeeName}>{payeeName}</Text>
              <Text style={styles.upiIdText} selectable>{upiId}</Text>
            </View>
            <TouchableOpacity
              onPress={handleCopyUpi}
              style={[styles.copyBtn, copiedUpi && styles.copyBtnSuccess]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={copiedUpi ? 'check' : 'content-copy'}
                size={16}
                color={copiedUpi ? '#FFFFFF' : '#10B981'}
              />
              <Text style={[styles.copyBtnText, copiedUpi && { color: '#FFFFFF' }]}>
                {copiedUpi ? 'Copied!' : 'Copy UPI'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBox}>
              {loadingConfig ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Image
                  source={{ uri: qrCodeApiUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              )}
            </View>
            <Text style={styles.qrInstruction}>
              Scan with GPay, PhonePe, Paytm, or BHIM
            </Text>
          </View>

          {/* 1-Tap Direct UPI App Launchers */}
          <Text style={styles.upiAppsLabel}>Or Tap Your Favorite App to Pay Directly:</Text>
          <View style={styles.upiAppsGrid}>
            <TouchableOpacity
              style={styles.upiAppBtn}
              activeOpacity={0.8}
              onPress={() => handleOpenUpiApp('tez')}
            >
              <View style={[styles.upiAppIconCircle, { backgroundColor: '#E8F0FE' }]}>
                <MaterialCommunityIcons name="google" size={20} color="#1A73E8" />
              </View>
              <Text style={styles.upiAppName}>Google Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.upiAppBtn}
              activeOpacity={0.8}
              onPress={() => handleOpenUpiApp('phonepe')}
            >
              <View style={[styles.upiAppIconCircle, { backgroundColor: '#F3E8FD' }]}>
                <MaterialCommunityIcons name="cellphone-wireless" size={20} color="#5F259F" />
              </View>
              <Text style={styles.upiAppName}>PhonePe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.upiAppBtn}
              activeOpacity={0.8}
              onPress={() => handleOpenUpiApp('paytmmp')}
            >
              <View style={[styles.upiAppIconCircle, { backgroundColor: '#E0F7FA' }]}>
                <MaterialCommunityIcons name="bank-transfer" size={20} color="#00BAF2" />
              </View>
              <Text style={styles.upiAppName}>Paytm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.upiAppBtn}
              activeOpacity={0.8}
              onPress={() => handleOpenUpiApp()}
            >
              <View style={[styles.upiAppIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color="#059669" />
              </View>
              <Text style={styles.upiAppName}>Other UPI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 2: Enter 12-Digit UTR */}
        <View style={styles.card}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNumberBadge, { backgroundColor: '#10B981' }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Submit Verification</Text>
              <Text style={styles.stepSubtitle}>Enter 12-digit UTR from your payment receipt</Text>
            </View>
          </View>

          {/* UTR Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              12-Digit UPI Reference Number (UTR) <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="numeric" size={22} color="#10B981" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 430589123456"
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={utrNumber}
                onChangeText={(text) => setUtrNumber(text.replace(/[^0-9a-zA-Z]/g, ''))}
                keyboardType="numeric"
                maxLength={20}
                autoCapitalize="characters"
              />
            </View>
            <Text style={styles.inputHelper}>
              Found in your GPay/PhonePe receipt as "UPI Ref ID" or "UTR Number"
            </Text>
          </View>

          {/* Screenshot Upload (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Attach Payment Screenshot (Optional)</Text>
            {screenshotUri ? (
              <View style={styles.screenshotPreviewContainer}>
                <Image source={{ uri: screenshotUri }} style={styles.screenshotThumb} resizeMode="cover" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.screenshotAttachedText}>Screenshot Attached</Text>
                  <TouchableOpacity onPress={() => { setScreenshotUri(null); setScreenshotBase64(null); }}>
                    <Text style={styles.screenshotRemoveText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handlePickScreenshot}
                style={styles.screenshotPickerBtn}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="image-plus" size={22} color="#10B981" />
                <Text style={styles.screenshotPickerText}>Select Receipt Screenshot</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* User Note (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Remarks / Your Name (Optional)</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="comment-text-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Paid via my brother's GPay"
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={userRemarks}
                onChangeText={setUserRemarks}
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            activeOpacity={0.85}
            onPress={handleSubmitVerification}
            disabled={submitting}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-decagram" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>I Have Paid • Submit for Approval</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Success / Under Review Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <MaterialCommunityIcons name="clock-check-outline" size={42} color="#10B981" />
            </View>

            <Text style={styles.modalTitle}>Payment Submitted!</Text>
            <Text style={styles.modalSubtitle}>Pending Admin Verification</Text>

            <View style={styles.modalDetailsBox}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Amount:</Text>
                <Text style={styles.modalDetailValueBold}>{formatCurrency(amount)}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>UTR Number:</Text>
                <Text style={styles.modalDetailValueMono}>{utrNumber}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Order Ref:</Text>
                <Text style={styles.modalDetailValue}>{orderId}</Text>
              </View>
            </View>

            <Text style={styles.modalDesc}>
              We have received your payment reference. Our accounts team will verify the transaction against our bank records. Your account will be activated within 10–30 minutes!
            </Text>

            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: returnScreen || 'MainTabs' }],
                });
              }}
            >
              <Text style={styles.modalPrimaryBtnText}>Go to Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => {
                setShowSuccessModal(false);
                navigation.navigate('Transactions');
              }}
            >
              <Text style={styles.modalSecondaryBtnText}>View Transactions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (themeColors, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0A120E' : '#F8FAFC',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 16,
      backgroundColor: isDarkMode ? '#111D16' : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      gap: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: themeColors.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      marginTop: 2,
    },
    securityBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
    },
    summaryCard: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: isDarkMode ? '#111D16' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    summaryIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: isDarkMode ? '#94A3B8' : '#64748B',
    },
    summaryAmount: {
      fontSize: 24,
      fontWeight: '800',
      color: '#10B981',
      marginTop: 2,
    },
    orderIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    orderIdLabel: {
      fontSize: 11,
      color: isDarkMode ? '#94A3B8' : '#64748B',
    },
    orderIdVal: {
      fontWeight: '700',
      color: themeColors.text,
    },
    orderIdCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
    },
    orderIdCopyText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#10B981',
    },
    card: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: isDarkMode ? '#111D16' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      gap: 16,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stepNumberBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#10B981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    stepTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: themeColors.text,
    },
    stepSubtitle: {
      fontSize: 11,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      marginTop: 1,
    },
    upiIdBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDarkMode ? '#19261F' : '#F1F5F9',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    upiPayeeName: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: '#10B981',
      letterSpacing: 0.5,
    },
    upiIdText: {
      fontSize: 15,
      fontWeight: '800',
      color: themeColors.text,
      marginTop: 2,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    copyBtnSuccess: {
      backgroundColor: '#10B981',
      borderColor: '#10B981',
    },
    copyBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#10B981',
    },
    qrContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },
    qrBox: {
      width: 170,
      height: 170,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      padding: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    qrImage: {
      width: '100%',
      height: '100%',
    },
    qrInstruction: {
      fontSize: 11,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      marginTop: 8,
      textAlign: 'center',
    },
    upiAppsLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: themeColors.text,
      marginTop: 4,
    },
    upiAppsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    upiAppBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#19261F' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
    },
    upiAppIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    upiAppName: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.text,
      textAlign: 'center',
    },
    inputGroup: {
      gap: 6,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: themeColors.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : '#CBD5E1',
      backgroundColor: isDarkMode ? '#19261F' : '#F8FAFC',
      paddingHorizontal: 12,
      height: 48,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      color: themeColors.text,
      fontWeight: '600',
    },
    inputHelper: {
      fontSize: 10,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      marginTop: 2,
    },
    screenshotPickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#10B981',
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.06)' : '#ECFDF5',
    },
    screenshotPickerText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#10B981',
    },
    screenshotPreviewContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 12,
      backgroundColor: isDarkMode ? '#19261F' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    },
    screenshotThumb: {
      width: 48,
      height: 48,
      borderRadius: 8,
    },
    screenshotAttachedText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#10B981',
    },
    screenshotRemoveText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#EF4444',
      marginTop: 2,
    },
    submitBtn: {
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    submitGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    submitBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: isDarkMode ? '#111D16' : '#FFFFFF',
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    modalIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: themeColors.text,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#10B981',
      marginTop: 2,
      textAlign: 'center',
    },
    modalDetailsBox: {
      width: '100%',
      backgroundColor: isDarkMode ? '#19261F' : '#F8FAFC',
      borderRadius: 12,
      padding: 12,
      marginVertical: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
    },
    modalDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalDetailLabel: {
      fontSize: 11,
      color: isDarkMode ? '#94A3B8' : '#64748B',
    },
    modalDetailValue: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.text,
    },
    modalDetailValueBold: {
      fontSize: 13,
      fontWeight: '800',
      color: '#10B981',
    },
    modalDetailValueMono: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'monospace',
      color: themeColors.text,
    },
    modalDesc: {
      fontSize: 12,
      color: isDarkMode ? '#94A3B8' : '#64748B',
      textAlign: 'center',
      lineHeight: 17,
      marginBottom: 20,
    },
    modalPrimaryBtn: {
      width: '100%',
      height: 46,
      borderRadius: 12,
      backgroundColor: '#0E3D23',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    modalPrimaryBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    modalSecondaryBtn: {
      paddingVertical: 6,
    },
    modalSecondaryBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#10B981',
    },
  });

