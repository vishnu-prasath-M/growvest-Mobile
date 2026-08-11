import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';

const BankDetailsScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  
  const [form, setForm] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kycData, setKycData] = useState(null);

  // Fetch KYC bank details from MongoDB on screen focus
  const fetchBankDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(API_ENDPOINTS.KYC_STATUS);
      const kyc = response.data;
      setKycData(kyc);

      if (kyc && kyc.data) {
        const d = kyc.data;
        setForm({
          accountHolderName: d.accountHolderName || '',
          bankName: d.bankName || '',
          accountNumber: d.accountNumber || '',
          confirmAccountNumber: d.accountNumber || '', // pre-fill confirm with same
          ifscCode: d.ifscCode || '',
          branchName: d.branchName || '',
          upiId: d.upiId || '',
        });
      }
    } catch (error) {
      console.error('Error fetching KYC bank details:', error);
      Alert.alert('Error', 'Failed to load bank details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchBankDetails(); }, []));

  const validateForm = () => {
    const newErrors = {};
    if (!form.accountHolderName.trim()) newErrors.accountHolderName = 'Account holder name is required';
    if (!form.bankName.trim()) newErrors.bankName = 'Bank name is required';
    if (!form.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (form.accountNumber.trim().length < 9 || form.accountNumber.trim().length > 18) {
      newErrors.accountNumber = 'Invalid account number (9–18 digits)';
    }
    if (!form.confirmAccountNumber.trim()) {
      newErrors.confirmAccountNumber = 'Please confirm account number';
    } else if (form.accountNumber.trim() !== form.confirmAccountNumber.trim()) {
      newErrors.confirmAccountNumber = 'Account numbers do not match';
    }
    if (!form.ifscCode.trim()) {
      newErrors.ifscCode = 'IFSC code is required';
    } else if (!/^[A-Za-z]{4}\d{7}$/.test(form.ifscCode.trim().toUpperCase())) {
      newErrors.ifscCode = 'Invalid IFSC code format (e.g. SBIN0001234)';
    }
    if (!form.branchName.trim()) newErrors.branchName = 'Branch name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save to MongoDB by updating the KYC record (single source of truth)
  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await api.put(API_ENDPOINTS.KYC_BANK_DETAILS, {
        accountHolderName: form.accountHolderName.trim(),
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        ifscCode: form.ifscCode.trim().toUpperCase(),
        branchName: form.branchName.trim(),
        upiId: form.upiId.trim(),
      });
      // Update confirmAccountNumber to match after save
      setForm((prev) => ({ ...prev, confirmAccountNumber: form.accountNumber.trim() }));
      Alert.alert(
        'Saved',
        'Bank details updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update bank details. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBar title="Bank Details" navigation={navigation} showBack />
        <SkeletonLoader variant="form" />
      </View>
    );
  }

  

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <TopBar title="Bank Details" navigation={navigation} showBack />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="bank-check" size={18} color={colors.info} />
          <Text style={styles.infoText}>
            Your bank details are sourced from your KYC submission. Edits here update the same record.
          </Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Account Holder Name</Text>
            <TextInput
              style={[styles.fieldInput, errors.accountHolderName && styles.fieldInputError]}
              value={form.accountHolderName}
              onChangeText={(v) => updateField('accountHolderName', v)}
              placeholder="Enter account holder name"
              placeholderTextColor={colors.textTertiary}
            />
            {errors.accountHolderName && <Text style={styles.errorText}>{errors.accountHolderName}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bank Name</Text>
            <TextInput
              style={[styles.fieldInput, errors.bankName && styles.fieldInputError]}
              value={form.bankName}
              onChangeText={(v) => updateField('bankName', v)}
              placeholder="Enter bank name"
              placeholderTextColor={colors.textTertiary}
            />
            {errors.bankName && <Text style={styles.errorText}>{errors.bankName}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Account Number</Text>
            <TextInput
              style={[styles.fieldInput, errors.accountNumber && styles.fieldInputError]}
              value={form.accountNumber}
              onChangeText={(v) => updateField('accountNumber', v)}
              placeholder="Enter account number"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              secureTextEntry={false}
            />
            {errors.accountNumber && <Text style={styles.errorText}>{errors.accountNumber}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm Account Number</Text>
            <TextInput
              style={[styles.fieldInput, errors.confirmAccountNumber && styles.fieldInputError]}
              value={form.confirmAccountNumber}
              onChangeText={(v) => updateField('confirmAccountNumber', v)}
              placeholder="Re-enter account number"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            {errors.confirmAccountNumber && <Text style={styles.errorText}>{errors.confirmAccountNumber}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>IFSC Code</Text>
            <TextInput
              style={[styles.fieldInput, errors.ifscCode && styles.fieldInputError]}
              value={form.ifscCode}
              onChangeText={(v) => updateField('ifscCode', v.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
            />
            {errors.ifscCode && <Text style={styles.errorText}>{errors.ifscCode}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Branch Name</Text>
            <TextInput
              style={[styles.fieldInput, errors.branchName && styles.fieldInputError]}
              value={form.branchName}
              onChangeText={(v) => updateField('branchName', v)}
              placeholder="Enter branch name"
              placeholderTextColor={colors.textTertiary}
            />
            {errors.branchName && <Text style={styles.errorText}>{errors.branchName}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>UPI ID <Text style={styles.optionalLabel}>(Optional)</Text></Text>
            <TextInput
              style={styles.fieldInput}
              value={form.upiId}
              onChangeText={(v) => updateField('upiId', v)}
              placeholder="e.g. name@upi"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveBtnGradient}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Text style={styles.saveBtnText}>Save Bank Details</Text>
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.white} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    margin: 16, padding: 14,
    backgroundColor: colors.infoLight, borderRadius: 14,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.info, fontWeight: '500', lineHeight: 18 },

  formSection: { paddingHorizontal: 16 },
  sectionTitle: { ...typography.h4, marginBottom: 16 },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  optionalLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  fieldInput: {
    backgroundColor: colors.surface,
    borderRadius: 14, height: 50,
    paddingHorizontal: 16, fontSize: 15, color: colors.text,
    borderWidth: 1.5, borderColor: colors.border,
  },
  fieldInputError: { borderColor: colors.error },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4, fontWeight: '500' },

  saveBtn: { marginHorizontal: 16, marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 16, gap: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});

export default BankDetailsScreen;