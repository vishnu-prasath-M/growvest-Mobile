import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';
import { chitFundService } from '../../services/chitFundService';

const ChitPaymentScreen = ({ navigation, route }) => {
  const { chitId, memberId, month, amount, lateFee = 0, type, chitName } = route.params;
  const [copied, setCopied] = useState(false);
  const [upiId, setUpiId] = useState('');

  const totalAmount = amount + lateFee;
  const businessName = 'Growvest';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settings = await chitFundService.getSettings();
      if (settings && settings.upiId) {
        setUpiId(settings.upiId);
      } else {
        setUpiId('q751029321@ybl'); // fallback
      }
    } catch (error) {
      console.warn('Could not fetch settings, using default UPI ID');
      setUpiId('q751029321@ybl');
    }
  };

  const formatCurrency = (value) =>
    `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

  const copyUpiId = async () => {
    try {
      await Clipboard.setStringAsync(upiId);
      setCopied(true);
      Alert.alert('Copied!', 'UPI ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy UPI ID');
    }
  };

  const openUPIApp = async (appName) => {
    try {
      if (!upiId) return;
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${totalAmount}&cu=INR`;
      const supported = await Linking.canOpenURL(upiLink);
      if (supported) {
        await Linking.openURL(upiLink);
      } else {
        Alert.alert('Error', 'UPI app not installed or not supported');
      }
    } catch (error) {
      console.error('Error opening UPI app:', error);
      Alert.alert('Error', 'Failed to open UPI app');
    }
  };

  const handleConfirmPayment = () => {
    Alert.alert(
      'Confirm Payment',
      'Have you completed the payment via UPI?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: () => {
            navigation.navigate('ChitPaymentStatus', {
              chitId,
              memberId,
              month,
              amount,
              lateFee,
              type,
              chitName
            });
          },
        },
      ]
    );
  };

  const upiApps = [
    { name: 'Google Pay', logo: 'https://img.icons8.com/?size=100&id=am4ltuIYDpQ5&format=png&color=000000', color: '#4285F4', bg: '#e8f0fe' },
    { name: 'PhonePe', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/PhonePe_Logo.svg/512px-PhonePe_Logo.svg.png', color: '#5F259F', bg: '#f3e8ff' },
    { name: 'Paytm', logo: 'https://img.icons8.com/?size=100&id=68067&format=png&color=000000', color: '#00BAF2', bg: '#e0f7fe' },
    { name: 'BHIM', logo: 'https://img.icons8.com/?size=100&id=5RcHTSNy4fbL&format=png&color=000000', color: '#1a73e8', bg: '#e8f0fe' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Payment Summary */}
        <View style={styles.summaryOuter}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.blobBottomLeft} />
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIconWrap}>
                <MaterialCommunityIcons name="cash-multiple" size={20} color={colors.gold} />
              </View>
              <Text style={styles.summaryType}>
                {type === 'join' ? `Join Chit - ${chitName}` : `Chit Payment - Month ${month}`}
              </Text>
            </View>
            <View style={styles.summaryAmountRow}>
              <Text style={styles.summaryAmountLabel}>Amount to Pay</Text>
              <Text style={styles.summaryAmountValue}>{formatCurrency(totalAmount)}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* UPI Section */}
        <View style={styles.upiSection}>
          <Text style={styles.sectionTitle}>Pay via UPI</Text>

          {/* UPI ID Display */}
          <View style={styles.upiIdCard}>
            <Text style={styles.upiIdLabel}>UPI ID</Text>
            <View style={styles.upiIdRow}>
              <View style={styles.upiIdValueContainer}>
                <MaterialCommunityIcons name="bank-transfer" size={20} color={colors.primary} />
                <Text style={styles.upiIdValue}>{upiId || 'Loading...'}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.copyBtn, copied && styles.copyBtnActive]} 
                onPress={copyUpiId}
                activeOpacity={0.8}
                disabled={!upiId}
              >
                <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={18} color={copied ? colors.white : colors.primary} />
                <Text style={[styles.copyBtnText, copied && styles.copyBtnTextActive]}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* UPI Apps Grid */}
          <Text style={styles.upiAppsTitle}>Choose your UPI App</Text>
          <View style={styles.upiAppsGrid}>
            {upiApps.map((app, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.upiAppCard, { borderColor: app.color + '30' }]}
                activeOpacity={0.8}
                onPress={() => openUPIApp(app.name.toLowerCase())}
                disabled={!upiId}
              >
                <View style={[styles.upiAppIconWrapper, { backgroundColor: app.bg }]}>
                  <Image source={{ uri: app.logo }} style={styles.upiAppLogo} resizeMode="contain" />
                </View>
                <Text style={styles.upiAppName}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.sectionTitle}>How to Pay</Text>
          {[
            'Tap your preferred UPI app above',
            'Verify the amount and UPI ID',
            'Complete the payment in the app',
            'Return here and confirm payment',
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <MaterialCommunityIcons name="shield-alert" size={22} color={colors.gold} />
          <Text style={styles.warningText}>
            Ensure you've completed the payment before confirming. Your payment will be processed after verification.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtnOuter, !upiId && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={handleConfirmPayment}
            disabled={!upiId}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.confirmBtnGradient}
            >
              <Text style={styles.confirmBtnText}>I Have Paid</Text>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  
  // Summary
  summaryOuter: { marginBottom: 24, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  summaryCard: { borderRadius: 24, padding: 24, overflow: 'hidden', position: 'relative' },
  blobBottomLeft: { position: 'absolute', bottom: -40, left: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(212,168,67,0.1)' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  summaryIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  summaryType: { fontSize: 16, fontWeight: '700', color: colors.white, flex: 1 },
  summaryAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 16 },
  summaryAmountLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryAmountValue: { fontSize: 32, fontWeight: '800', color: colors.white, letterSpacing: -1 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 16, letterSpacing: -0.4 },

  // UPI
  upiSection: { marginBottom: 24 },
  upiIdCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  upiIdLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  upiIdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upiIdValueContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, marginRight: 12 },
  upiIdValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginLeft: 10 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary, gap: 6 },
  copyBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  copyBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  copyBtnTextActive: { color: colors.white },
  
  upiAppsTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  upiAppsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  upiAppCard: { width: '48%', backgroundColor: colors.surface, borderRadius: 20, padding: 16, alignItems: 'center', borderWidth: 1.5, shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  upiAppIconWrapper: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  upiAppLogo: { width: 36, height: 36 },
  upiAppName: { fontSize: 14, fontWeight: '700', color: colors.text },

  // Instructions
  instructionsSection: { marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: colors.surface, padding: 12, borderRadius: 16, shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  stepNumber: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  stepNumberText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  stepText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },

  // Warning
  warningCard: { flexDirection: 'row', padding: 16, backgroundColor: '#fef3c7', borderRadius: 16, alignItems: 'flex-start', marginBottom: 24 },
  warningText: { flex: 1, fontSize: 13, color: '#b45309', marginLeft: 12, lineHeight: 20, fontWeight: '600' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12 },
  backBtn: { flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  confirmBtnOuter: { flex: 2, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  confirmBtnGradient: { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});

export default ChitPaymentScreen;
