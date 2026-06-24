import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { investmentService } from '../../services/investmentService';
import { colors, typography } from '../../theme/theme';

const InvestmentStatusScreen = ({ navigation, route }) => {
  const { amount, type, userData } = route.params;
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value) => {
    return `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const handleConfirm = () => {
    Alert.alert(
      'Submit Investment',
      'Your investment request will be sent to the admin for approval. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: async () => { await submitInvestment(); } },
      ]
    );
  };

  const submitInvestment = async () => {
    setLoading(true);
    try {
      await investmentService.createInvestment({
        amount,
        type,
        userName: userData?.name || userData?.username,
        userEmail: userData?.email,
        mobileNumber: userData?.mobileNumber,
      });
      
      Alert.alert(
        'Investment Submitted!',
        'Your investment request has been submitted successfully. It will be approved within 24-48 hours.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting investment:', error);
      Alert.alert('Error', error.message || 'Failed to submit investment request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Indicator */}
        <View style={styles.successSection}>
          <View style={styles.successIconContainer}>
            <View style={styles.successIconRing}>
              <MaterialCommunityIcons name="check-circle" size={64} color={colors.success} />
            </View>
          </View>
          <Text style={styles.successTitle}>Payment Recorded</Text>
          <Text style={styles.successSubtitle}>
            Your investment request has been recorded and is pending admin approval
          </Text>
        </View>

        {/* Investment Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Investment Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <View style={[styles.detailBadge, { 
              backgroundColor: type === 'saving' ? colors.savingLight : colors.fixedLight 
            }]}>
              <MaterialCommunityIcons 
                name={type === 'saving' ? 'piggy-bank' : 'lock'} 
                size={14} 
                color={type === 'saving' ? colors.saving : colors.fixed} 
              />
              <Text style={[styles.detailBadgeText, { 
                color: type === 'saving' ? colors.saving : colors.fixed 
              }]}>
                {type === 'saving' ? 'Saving Deposit' : 'Fixed Deposit'}
              </Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>{formatCurrency(amount)}</Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={[styles.statusPill, { backgroundColor: colors.warningLight }]}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={colors.warning} />
              <Text style={[styles.statusText, { color: colors.warning }]}>Pending Approval</Text>
            </View>
          </View>
        </View>

        {/* Next Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>What happens next?</Text>
          
          {[
            { icon: 'clock-outline', color: colors.primary, title: 'Admin Review', text: 'Reviewed within 24-48 hours' },
            { icon: 'check-circle-outline', color: colors.success, title: 'Approval', text: 'Investment starts earning interest' },
            { icon: 'trending-up', color: colors.primary, title: 'Earn Interest', text: 'Interest calculated daily' },
          ].map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={[styles.stepIconWrapper, { backgroundColor: step.color + '15' }]}>
                <MaterialCommunityIcons name={step.icon} size={24} color={step.color} />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Track your investment status in the Investments tab
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={styles.confirmBtnText}>Processing...</Text>
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />
                <Text style={styles.confirmBtnText}>Confirm & Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

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
    padding: 16,
  },
  // Success
  successSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    ...typography.h2,
    marginBottom: 8,
  },
  successSubtitle: {
    ...typography.body2,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // Details
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...colors.shadow.card,
  },
  detailsTitle: {
    ...typography.h4,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Steps
  stepsSection: {
    marginBottom: 16,
  },
  stepsTitle: {
    ...typography.h4,
    marginBottom: 12,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    ...colors.shadow.card,
  },
  stepIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  stepText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Info
  infoNote: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: colors.infoLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginLeft: 12,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 1.5,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    ...colors.shadow.button,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});

export default InvestmentStatusScreen;