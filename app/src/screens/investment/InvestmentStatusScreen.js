import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { investmentService } from '../../services/investmentService';
import { colors } from '../../theme/theme';
import { useTheme } from '../../context/ThemeContext';

const InvestmentStatusScreen = ({ navigation, route }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const { amount, type, userData } = route.params;
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value) =>
    `₹${value?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;

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
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
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
        {/* Success Header */}
        <View style={styles.successSection}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.successIconRing}
          >
            <MaterialCommunityIcons name="check" size={48} color={colors.gold} />
          </LinearGradient>
          <Text style={styles.successTitle}>Payment Recorded</Text>
          <Text style={styles.successSubtitle}>
            Your investment request has been recorded and is pending admin approval.
          </Text>
        </View>

        {/* Investment Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Investment Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <View style={[styles.detailBadge, { backgroundColor: type === 'saving' ? colors.successLight : colors.primaryLight }]}>
              <MaterialCommunityIcons 
                name={type === 'saving' ? 'piggy-bank' : 'lock'} 
                size={14} 
                color={type === 'saving' ? colors.success : colors.primary} 
              />
              <Text style={[styles.detailBadgeText, { color: type === 'saving' ? colors.success : colors.primary }]}>
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
            <View style={[styles.detailBadge, { backgroundColor: '#fef3c7' }]}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#d97706" />
              <Text style={[styles.detailBadgeText, { color: '#d97706' }]}>Pending Approval</Text>
            </View>
          </View>
        </View>

        {/* Next Steps */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>What happens next?</Text>
          
          {[
            { icon: 'clock-outline', color: '#d97706', title: 'Admin Review', text: 'Reviewed within 24-48 hours' },
            { icon: 'check-decagram', color: colors.success, title: 'Approval', text: 'Investment starts earning interest' },
            { icon: 'trending-up', color: colors.primary, title: 'Earn Interest', text: 'Interest calculated daily' },
          ].map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={[styles.stepIconWrapper, { backgroundColor: step.color + '15' }]}>
                <MaterialCommunityIcons name={step.icon} size={22} color={step.color} />
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
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Track your investment status in the Investments tab.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtnOuter, loading && styles.confirmBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleConfirm}
            disabled={loading}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmBtnGradient}
            >
              {loading ? (
                <Text style={styles.confirmBtnText}>Processing...</Text>
              ) : (
                <>
                  <Text style={styles.confirmBtnText}>Confirm & Submit</Text>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  
  // Success
  successSection: { alignItems: 'center', paddingVertical: 32 },
  successIconRing: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, shadowColor: '#1A5C39',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  
  // Details
  detailsCard: {
    backgroundColor: colors.surface, borderRadius: 24, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  detailsTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 18, color: colors.text, fontWeight: '800' },
  detailBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 6 },
  detailBadgeText: { fontSize: 13, fontWeight: '700' },
  detailDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginVertical: 12 },
  
  // Steps
  stepsSection: { marginBottom: 20 },
  stepsTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  stepCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderLight,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  stepIconWrapper: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  stepText: { fontSize: 13, color: colors.textMuted },
  
  // Info
  infoNote: {
    flexDirection: 'row', padding: 16, backgroundColor: colors.primaryLight,
    borderRadius: 16, marginBottom: 32, alignItems: 'flex-start',
    borderWidth: 1, borderColor: colors.borderLight,
  },
  infoText: { flex: 1, fontSize: 14, color: colors.primary, marginLeft: 12, lineHeight: 20, fontWeight: '600' },
  
  // Buttons
  buttonRow: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1, height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  confirmBtnOuter: { flex: 1.5, shadowColor: '#1A5C39', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  confirmBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});

export default InvestmentStatusScreen;