import React, { useState, useRef } from 'react';
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
  Image,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography } from '../../theme/theme';
import TopBar from '../../components/TopBar';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/apiService';
import { API_ENDPOINTS } from '../../config/api';

const STEPS = ['Personal', 'Address & ID', 'Nominee', 'Documents'];

// Maximum allowed image size (in MB) — validates before upload starts
const MAX_IMAGE_SIZE_MB = 5;

const checkImageSize = (base64String, field) => {
  // base64 encodes 3 bytes as 4 chars; approximate original size
  const estimatedBytes = (base64String.length * 3) / 4;
  const estimatedMB = estimatedBytes / (1024 * 1024);
  if (estimatedMB > MAX_IMAGE_SIZE_MB) {
    Alert.alert(
      'Image Too Large',
      `Please upload an image smaller than ${MAX_IMAGE_SIZE_MB} MB.\n\nThe selected image is approximately ${estimatedMB.toFixed(1)} MB.`,
      [{ text: 'OK', style: 'default' }]
    );
    return false;
  }
  return true;
};

const KYCScreen = ({ navigation }) => {
  const { colors: themeColors } = useTheme();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

  // Date Picker Modal state
  const [dobModalVisible, setDobModalVisible] = useState(false);
  const [pickerDay, setPickerDay] = useState('15');
  const [pickerMonth, setPickerMonth] = useState('01');
  const [pickerYear, setPickerYear] = useState('1995');

  const [form, setForm] = useState({
    fullName: '',
    fatherOrHusbandName: '',
    dob: '',
    gender: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    aadhaarNumber: '',
    panNumber: '',
    occupation: '',
    nomineeName: '',
    nomineeRelationship: '',
    nomineeMobileNumber: '',
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
    aadhaarFrontImage: '',
    aadhaarBackImage: '',
    panImage: '',
    profilePhoto: '',
  });
  const [errors, setErrors] = useState({});

  const handleImagePick = async (field) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.4,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const base64 = result.assets[0].base64;
      if (!checkImageSize(base64, field)) return;  // size guard
      setForm((prev) => ({ ...prev, [field]: base64 }));
    }
  };

  const handleCameraPick = async (field) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.4,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const base64 = result.assets[0].base64;
      if (!checkImageSize(base64, field)) return;  // size guard
      setForm((prev) => ({ ...prev, [field]: base64 }));
    }
  };

  const showImagePicker = (field) => {
    Alert.alert('Upload Image', 'Choose an option', [
      { text: 'Camera', onPress: () => handleCameraPick(field) },
      { text: 'Gallery', onPress: () => handleImagePick(field) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Masked numeric input formatting for DOB (DD/MM/YYYY)
  const handleDobChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    updateField('dob', formatted);
  };

  const applyDatePicker = () => {
    const d = pickerDay.padStart(2, '0');
    const m = pickerMonth.padStart(2, '0');
    const y = pickerYear;
    updateField('dob', `${d}/${m}/${y}`);
    setDobModalVisible(false);
  };

  const validateStep = (step) => {
    const newErrors = {};
    if (step === 0) {
      if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
      if (!form.fatherOrHusbandName.trim()) newErrors.fatherOrHusbandName = 'Father/Husband name is required';
      
      // DOB Validation
      if (!form.dob.trim()) {
        newErrors.dob = 'Date of birth is required';
      } else {
        const raw = form.dob.trim();
        let day = 0, month = 0, year = 0;
        if (raw.includes('/')) {
          const parts = raw.split('/');
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
        } else if (raw.includes('-')) {
          const parts = raw.split('-');
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        }

        const birthDate = new Date(year, month - 1, day);
        const today = new Date();
        let age = today.getFullYear() - year;
        const m = today.getMonth() - (month - 1);
        if (m < 0 || (m === 0 && today.getDate() < day)) {
          age--;
        }

        if (!day || !month || !year || isNaN(birthDate.getTime()) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1920) {
          newErrors.dob = 'Enter valid Date of Birth (DD/MM/YYYY)';
        } else if (age < 18) {
          newErrors.dob = 'You must be at least 18 years old to complete KYC';
        }
      }

      if (!form.gender) newErrors.gender = 'Gender is required';
      if (!form.occupation.trim()) newErrors.occupation = 'Occupation is required';
    } else if (step === 1) {
      if (!form.address.trim()) newErrors.address = 'Address is required';
      if (!form.city.trim()) newErrors.city = 'City is required';
      if (!form.district.trim()) newErrors.district = 'District is required';
      if (!form.state.trim()) newErrors.state = 'State is required';
      if (!form.pincode.trim()) newErrors.pincode = 'Pincode is required';
      else if (!/^\d{6}$/.test(form.pincode.trim())) newErrors.pincode = 'Invalid pincode';
      if (!form.aadhaarNumber.trim()) newErrors.aadhaarNumber = 'Aadhaar number is required';
      else if (!/^\d{12}$/.test(form.aadhaarNumber.trim())) newErrors.aadhaarNumber = 'Invalid Aadhaar number';
      if (!form.panNumber.trim()) newErrors.panNumber = 'PAN number is required';
      else if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.panNumber.trim().toUpperCase())) newErrors.panNumber = 'Invalid PAN format';
    } else if (step === 2) {
      if (!form.nomineeName.trim()) newErrors.nomineeName = 'Nominee name is required';
      if (!form.nomineeRelationship.trim()) newErrors.nomineeRelationship = 'Relationship is required';
      if (!form.nomineeMobileNumber.trim()) newErrors.nomineeMobileNumber = 'Mobile number is required';
      else if (!/^\d{10}$/.test(form.nomineeMobileNumber.trim())) newErrors.nomineeMobileNumber = 'Invalid mobile number';
      if (!form.accountHolderName.trim()) newErrors.accountHolderName = 'Account holder name is required';
      if (!form.bankName.trim()) newErrors.bankName = 'Bank name is required';
      if (!form.accountNumber.trim()) newErrors.accountNumber = 'Account number is required';
      if (!form.confirmAccountNumber.trim()) newErrors.confirmAccountNumber = 'Confirm account number';
      else if (form.accountNumber.trim() !== form.confirmAccountNumber.trim()) newErrors.confirmAccountNumber = 'Account numbers do not match';
      if (!form.ifscCode.trim()) newErrors.ifscCode = 'IFSC is required';
      if (!form.branchName.trim()) newErrors.branchName = 'Branch is required';
    } else if (step === 3) {
      if (!form.aadhaarFrontImage) newErrors.aadhaarFrontImage = 'Aadhaar front image is required';
      if (!form.aadhaarBackImage) newErrors.aadhaarBackImage = 'Aadhaar back image is required';
      if (!form.panImage) newErrors.panImage = 'PAN image is required';
      if (!form.profilePhoto) newErrors.profilePhoto = 'Profile photo is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        dob: form.dob,
        gender: form.gender,
        pincode: form.pincode,
        aadhaarNumber: form.aadhaarNumber,
        panNumber: form.panNumber.toUpperCase(),
        nomineeMobileNumber: form.nomineeMobileNumber,
        ifscCode: form.ifscCode.toUpperCase(),
      };
      await api.post(API_ENDPOINTS.KYC_SUBMIT, payload);
      Alert.alert('Success', 'KYC submitted successfully. We will review your documents.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const msg = error.response?.data?.message || 'Error submitting KYC';
      Alert.alert('Submission Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const renderDobField = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        Date of Birth (DD/MM/YYYY) <Text style={styles.requiredStar}>*</Text>
      </Text>
      <View style={styles.dobInputRow}>
        <TextInput
          style={[styles.fieldInput, { flex: 1 }, errors.dob && styles.fieldInputError]}
          value={form.dob}
          onChangeText={handleDobChange}
          placeholder="DD/MM/YYYY (e.g. 15/01/1995)"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          maxLength={10}
        />
        <TouchableOpacity
          style={styles.calendarPickerBtn}
          activeOpacity={0.8}
          onPress={() => {
            if (form.dob && form.dob.includes('/')) {
              const [d, m, y] = form.dob.split('/');
              if (d) setPickerDay(d);
              if (m) setPickerMonth(m);
              if (y) setPickerYear(y);
            }
            setDobModalVisible(true);
          }}
        >
          <MaterialCommunityIcons name="calendar-month" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
      {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
    </View>
  );

  const renderField = (field, label, options = {}) => {
    const isRequired = options.required !== false;
    return (
      <View key={field} style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label} {isRequired && <Text style={styles.requiredStar}>*</Text>}
        </Text>

        {options.type === 'select' ? (
          <View style={styles.genderContainer}>
            {['male', 'female', 'other'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderOption, form.gender === g && styles.genderOptionActive]}
                onPress={() => updateField('gender', g)}
              >
                <MaterialCommunityIcons
                  name={g === 'male' ? 'gender-male' : g === 'female' ? 'gender-female' : 'gender-transgender'}
                  size={18}
                  color={form.gender === g ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextInput
            style={[styles.fieldInput, errors[field] && styles.fieldInputError]}
            value={form[field]}
            onChangeText={(v) => updateField(field, v)}
            placeholder={options.placeholder || `Enter ${label.toLowerCase()}`}
            placeholderTextColor={colors.textTertiary}
            keyboardType={options.keyboard || 'default'}
            autoCapitalize={options.autoCapitalize || 'words'}
            maxLength={options.maxLength}
          />
        )}
        {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
      </View>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Personal Information</Text>
            {renderField('fullName', 'Full Name')}
            {renderField('fatherOrHusbandName', 'Father / Husband Name')}
            {renderDobField()}
            {renderField('gender', 'Gender', { type: 'select', required: true })}
            {renderField('occupation', 'Occupation')}
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Address & Identity</Text>
            {renderField('address', 'Address', { placeholder: 'Full address' })}
            {renderField('city', 'City')}
            {renderField('district', 'District')}
            {renderField('state', 'State')}
            {renderField('pincode', 'Pincode', { keyboard: 'numeric', maxLength: 6 })}
            <View style={styles.divider} />
            {renderField('aadhaarNumber', 'Aadhaar Number', { keyboard: 'numeric', maxLength: 12 })}
            {renderField('panNumber', 'PAN Number', { autoCapitalize: 'characters', maxLength: 10, placeholder: 'e.g. ABCDE1234F' })}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Nominee Details</Text>
            {renderField('nomineeName', 'Nominee Name')}
            {renderField('nomineeRelationship', 'Relationship', { placeholder: 'e.g. Spouse, Father, Mother' })}
            {renderField('nomineeMobileNumber', 'Mobile Number', { keyboard: 'numeric', maxLength: 10 })}
            <View style={styles.divider} />
            <Text style={styles.sectionSubtitle}>Bank Details</Text>
            {renderField('accountHolderName', 'Account Holder Name')}
            {renderField('bankName', 'Bank Name')}
            {renderField('accountNumber', 'Account Number', { keyboard: 'numeric' })}
            {renderField('confirmAccountNumber', 'Confirm Account Number', { keyboard: 'numeric' })}
            {renderField('ifscCode', 'IFSC Code', { autoCapitalize: 'characters', placeholder: 'e.g. SBIN0001234' })}
            {renderField('branchName', 'Branch Name')}
            {renderField('upiId', 'UPI ID (Optional)', { required: false, autoCapitalize: 'none' })}
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Upload Documents</Text>
            {renderDocUpload('profilePhoto', 'Profile Photo', 'Upload recent passport size photo')}
            {renderDocUpload('aadhaarFrontImage', 'Aadhaar Front', 'Front side showing name & address')}
            {renderDocUpload('aadhaarBackImage', 'Aadhaar Back', 'Back side showing full address')}
            {renderDocUpload('panImage', 'PAN Card', 'Clear photo of PAN card')}
          </View>
        );
      default:
        return null;
    }
  };

  const renderDocUpload = (field, title, subtitle) => {
    const hasImage = !!form[field];
    return (
      <View key={field} style={styles.docUploadContainer}>
        <Text style={styles.docTitle}>
          {title} <Text style={styles.requiredStar}>*</Text>
        </Text>
        <Text style={styles.docSubtitle}>{subtitle}</Text>
        <TouchableOpacity
          style={[styles.imageUpload, hasImage && styles.imageUploadDone, errors[field] && styles.fieldInputError]}
          activeOpacity={0.8}
          onPress={() => showImagePicker(field)}
        >
          {hasImage ? (
            <Image source={{ uri: `data:image/jpeg;base64,${form[field]}` }} style={styles.imagePreview} />
          ) : (
            <>
              <MaterialCommunityIcons name="cloud-upload-outline" size={32} color={colors.primary} />
              <Text style={styles.imageUploadText}>Tap to Upload</Text>
            </>
          )}
        </TouchableOpacity>
        {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
      </View>
    );
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 70 }, (_, i) => String(currentYear - 18 - i));
  const months = [
    { label: 'Jan (01)', val: '01' },
    { label: 'Feb (02)', val: '02' },
    { label: 'Mar (03)', val: '03' },
    { label: 'Apr (04)', val: '04' },
    { label: 'May (05)', val: '05' },
    { label: 'Jun (06)', val: '06' },
    { label: 'Jul (07)', val: '07' },
    { label: 'Aug (08)', val: '08' },
    { label: 'Sep (09)', val: '09' },
    { label: 'Oct (10)', val: '10' },
    { label: 'Nov (11)', val: '11' },
    { label: 'Dec (12)', val: '12' },
  ];
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar title="KYC Verification" navigation={navigation} showBack />

      {/* Steps Indicator */}
      <View style={styles.stepsBar}>
        {STEPS.map((step, idx) => (
          <View key={step} style={styles.stepItem}>
            <View
              style={[
                styles.stepBadge,
                idx === currentStep && styles.stepBadgeActive,
                idx < currentStep && styles.stepBadgeDone,
              ]}
            >
              {idx < currentStep ? (
                <MaterialCommunityIcons name="check" size={14} color={colors.white} />
              ) : (
                <Text style={[styles.stepBadgeText, idx === currentStep && styles.stepBadgeTextActive]}>
                  {idx + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, idx === currentStep && styles.stepLabelActive]}>{step}</Text>
          </View>
        ))}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {renderStep()}

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          {currentStep > 0 && (
            <TouchableOpacity style={styles.prevBtn} onPress={handlePrev} activeOpacity={0.8}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
              <Text style={styles.prevBtnText}>Previous</Text>
            </TouchableOpacity>
          )}

          {currentStep < 3 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
              <LinearGradient colors={['#0E3D23', '#1C6B3F']} style={styles.nextBtnGradient}>
                <Text style={styles.nextBtnText}>Next Step</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.white} />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#0E3D23', '#1C6B3F']} style={styles.nextBtnGradient}>
                <Text style={styles.nextBtnText}>{saving ? 'Submitting...' : 'Submit KYC'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={dobModalVisible} transparent animationType="slide" onRequestClose={() => setDobModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date of Birth</Text>
              <TouchableOpacity onPress={() => setDobModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerRow}>
              {/* Day Selector */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Day</Text>
                <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                  {days.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.pickerItem, pickerDay === d && styles.pickerItemActive]}
                      onPress={() => setPickerDay(d)}
                    >
                      <Text style={[styles.pickerItemText, pickerDay === d && styles.pickerItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Month Selector */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Month</Text>
                <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                  {months.map((m) => (
                    <TouchableOpacity
                      key={m.val}
                      style={[styles.pickerItem, pickerMonth === m.val && styles.pickerItemActive]}
                      onPress={() => setPickerMonth(m.val)}
                    >
                      <Text style={[styles.pickerItemText, pickerMonth === m.val && styles.pickerItemTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Year Selector */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Year</Text>
                <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                  {years.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.pickerItem, pickerYear === y && styles.pickerItemActive]}
                      onPress={() => setPickerYear(y)}
                    >
                      <Text style={[styles.pickerItemText, pickerYear === y && styles.pickerItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={applyDatePicker}>
              <Text style={styles.applyBtnText}>Set Date ({pickerDay}/{pickerMonth}/{pickerYear})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 20 },
    stepsBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    stepItem: { alignItems: 'center', flex: 1 },
    stepBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    stepBadgeActive: { backgroundColor: colors.primary },
    stepBadgeDone: { backgroundColor: colors.success },
    stepBadgeText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    stepBadgeTextActive: { color: colors.white },
    stepLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' },
    stepLabelActive: { color: colors.primary, fontWeight: '700' },

    stepContent: { padding: 20 },
    stepTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 20 },
    divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
    sectionSubtitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },

    fieldContainer: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
    requiredStar: { color: colors.error },
    fieldInput: {
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    fieldInputError: { borderColor: colors.error },
    errorText: { fontSize: 11, color: colors.error, marginTop: 4, fontWeight: '500' },

    dobInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    calendarPickerBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },

    genderContainer: { flexDirection: 'row', gap: 10 },
    genderOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 6,
    },
    genderOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
    genderText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    genderTextActive: { color: colors.primary, fontWeight: '700' },

    docUploadContainer: { marginBottom: 20 },
    docTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    docSubtitle: { fontSize: 12, color: colors.textTertiary, marginBottom: 8 },

    imageUpload: {
      height: 120,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    imageUploadDone: { borderStyle: 'solid', borderColor: colors.success },
    imagePreview: { width: '100%', height: '100%', borderRadius: 12 },
    imageUploadText: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '500' },

    navButtons: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      marginTop: 20,
    },
    prevBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 50,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 4,
    },
    prevBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    nextBtn: { flex: 2, ...colors.shadow.button },
    nextBtnDisabled: { opacity: 0.6 },
    nextBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 50,
      borderRadius: 14,
      gap: 4,
    },
    nextBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '60%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
    pickerRow: { flexDirection: 'row', gap: 12, height: 220, marginBottom: 16 },
    pickerCol: { flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 8 },
    pickerLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 6 },
    pickerList: { flex: 1 },
    pickerItem: { paddingVertical: 8, alignItems: 'center', borderRadius: 8, marginVertical: 2 },
    pickerItemActive: { backgroundColor: colors.primary },
    pickerItemText: { fontSize: 14, fontWeight: '600', color: colors.text },
    pickerItemTextActive: { color: colors.white, fontWeight: '800' },
    applyBtn: {
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    applyBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  });

export default KYCScreen;