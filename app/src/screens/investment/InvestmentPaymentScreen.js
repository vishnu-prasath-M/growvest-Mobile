import React, { useState } from 'react';
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
import { Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../../theme/theme';

const InvestmentPaymentScreen = ({ navigation, route }) => {
  const { amount, type, userData } = route.params;
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatCurrency = (value) => {
    return `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const upiId = 'q751029321@ybl';
  const businessName = 'Growvest';

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
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR`;
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

  const saveInvestmentStage = async () => {
    try {
      await AsyncStorage.setItem('investmentStage', JSON.stringify({
        amount,
        type,
        userData,
        stage: 'payment_pending',
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Error saving investment stage:', error);
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
          onPress: async () => {
            await saveInvestmentStage();
            navigation.navigate('InvestmentStatus', { amount, type, userData });
          },
        },
      ]
    );
  };

  const upiApps = [
    { 
      name: 'Google Pay', 
      logo: 'https://img.icons8.com/?size=100&id=am4ltuIYDpQ5&format=png&color=000000',
      color: '#4285F4', 
      bg: '#e8f0fe' 
    },
    { 
      name: 'PhonePe', 
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/PhonePe_Logo.svg/512px-PhonePe_Logo.svg.png',
      color: '#5F259F', 
      bg: '#f3e8ff' 
    },
    { 
      name: 'Paytm', 
      logo: 'https://img.icons8.com/?size=100&id=68067&format=png&color=000000',
      color: '#00BAF2', 
      bg: '#e0f7fe' 
    },
    { 
      name: 'BHIM', 
      logo: 'https://img.icons8.com/?size=100&id=5RcHTSNy4fbL&format=png&color=000000',
      color: '#1a73e8', 
      bg: '#e8f0fe' 
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons 
              name={type === 'saving' ? 'piggy-bank' : 'lock'} 
              size={24} 
              color={type === 'saving' ? colors.saving : colors.fixed} 
            />
            <Text style={styles.summaryType}>
              {type === 'saving' ? 'Saving Deposit' : 'Fixed Deposit'}
            </Text>
          </View>
          <View style={styles.summaryAmountRow}>
            <Text style={styles.summaryAmountLabel}>Amount to Pay</Text>
            <Text style={styles.summaryAmountValue}>{formatCurrency(amount)}</Text>
          </View>
        </View>

        {/* UPI Section */}
        <View style={styles.upiSection}>
          <Text style={styles.upiSectionTitle}>Pay via UPI</Text>

          {/* UPI ID Display */}
          <View style={styles.upiIdCard}>
            <Text style={styles.upiIdLabel}>UPI ID</Text>
            <View style={styles.upiIdRow}>
              <View style={styles.upiIdValueContainer}>
                <MaterialCommunityIcons name="bank-transfer" size={20} color={colors.primary} />
                <Text style={styles.upiIdValue}>{upiId}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.copyBtn, copied && styles.copyBtnActive]} 
                onPress={copyUpiId}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name={copied ? 'check' : 'content-copy'} 
                  size={18} 
                  color={copied ? colors.white : colors.primary} 
                />
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
              >
                <View style={[styles.upiAppIconWrapper, { backgroundColor: app.bg }]}>
                  <Image 
                    source={{ uri: app.logo }} 
                    style={styles.upiAppLogo} 
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.upiAppName}>{app.name}</Text>
                <Text style={styles.upiAppAction}>Pay with {app.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>How to Pay</Text>
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
          <MaterialCommunityIcons name="shield-alert" size={22} color={colors.warning} />
          <Text style={styles.warningText}>
            Ensure you've completed the payment before confirming. Your investment will be processed after verification.
          </Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.confirmBtn}
          activeOpacity={0.85}
          onPress={handleConfirmPayment}
        >
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.white} />
          <Text style={styles.confirmBtnText}>I Have Paid</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>Back to Investment</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Summary
  summaryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    ...colors.shadow.card,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 10,
  },
  summaryAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  summaryAmountLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryAmountValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  // UPI Section
  upiSection: {
    margin: 16,
    marginTop: 0,
  },
  upiSectionTitle: {
    ...typography.h4,
    marginBottom: 14,
  },
  upiIdCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...colors.shadow.card,
  },
  upiIdLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 10,
  },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upiIdValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 10,
  },
  upiIdValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    gap: 4,
  },
  copyBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  copyBtnTextActive: {
    color: colors.white,
  },
  // UPI Apps
  upiAppsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  upiAppsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  upiAppCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    ...colors.shadow.card,
  },
  upiAppIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  upiAppLogo: {
    width: 40,
    height: 40,
  },
  upiAppName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  upiAppAction: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  // Instructions
  instructionsSection: {
    margin: 16,
    marginTop: 0,
  },
  instructionsTitle: {
    ...typography.h4,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Warning
  warningCard: {
    flexDirection: 'row',
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: colors.warningLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginLeft: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Buttons
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    gap: 8,
    ...colors.shadow.button,
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  backBtn: {
    alignSelf: 'center',
    padding: 16,
    marginTop: 8,
  },
  backBtnText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default InvestmentPaymentScreen;