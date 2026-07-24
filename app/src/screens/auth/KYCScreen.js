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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography } from '../../theme/theme';
import TopBar from '../../components/TopBar';
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

const KYCScreen = ({ navigation, route }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);

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

  const validateStep = (step) => {
    const newErrors = {};
    if (step === 0) {
      if (!form.fullName.trim()) newErrors.fullName = 'Full name is required';
      if (!form.fatherOrHusbandName.trim()) newErrors.fatherOrHusbandName = 'Father/Husband name is required';
      if (!form.dob.trim()) newErrors.dob = 'Date of birth is required';
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
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      let errorMessage = 'Failed to submit KYC';
      if (error.response?.data?.includes('Payload Too Large')) {
        errorMessage = 'Images are too large. Please try uploading smaller images or use lower quality photos.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const renderImageUpload = (field, label) => (
    <TouchableOpacity
      style={[styles.imageUpload, form[field] ? styles.imageUploadDone : null]}
      onPress={() => showImagePicker(field)}
      activeOpacity={0.8}
    >
      {form[field] ? (
        <Image source={{ uri: `data:image/jpeg;base64,${form[field]}` }} style={styles.imagePreview} />
      ) : (
        <>
          <MaterialCommunityIcons name="camera-plus" size={28} color={colors.textMuted} />
          <Text style={styles.imageUploadText}>{label}</Text>
        </>
      )}
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </TouchableOpacity>
  );

  const renderField = (field, label, options = {}) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}{options.required !== false ? ' *' : ''}</Text>
      {options.type === 'select' ? (
        <View style={styles.genderRow}>
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

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Personal Information</Text>
            {renderField('fullName', 'Full Name')}
            {renderField('fatherOrHusbandName', 'Father / Husband Name')}
            {renderField('dob', 'Date of Birth (YYYY-MM-DD)', { placeholder: 'e.g. 1995-01-15', autoCapitalize: 'none' })}
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
            <Text style={styles.stepDesc}>Upload clear images of the following documents</Text>
            {renderImageUpload('aadhaarFrontImage', 'Aadhaar Front')}
            {renderImageUpload('aadhaarBackImage', 'Aadhaar Back')}
            {renderImageUpload('panImage', 'PAN Card')}
            {renderImageUpload('profilePhoto', 'Selfie / Profile Photo')}
          </View>
        );
    }
  };

  const isLastStep = currentStep === 3;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TopBar title="KYC Verification" navigation={navigation} showBack />
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step}>
              <View style={styles.stepIndicator}>
                <LinearGradient
                  colors={index <= currentStep ? ['#0E3D23', '#1A5C39'] : ['#E4E7EB', '#E4E7EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.stepCircle}
                >
                  {index < currentStep ? (
                    <MaterialCommunityIcons name="check" size={14} color={colors.white} />
                  ) : (
                    <Text style={[styles.stepNumber, index === currentStep && styles.stepNumberActive]}>
                      {index + 1}
                    </Text>
                  )}
                </LinearGradient>
                <Text style={[styles.stepLabel, index === currentStep && styles.stepLabelActive]}>
                  {step}
                </Text>
              </View>
              {index < 3 && <View style={[styles.stepLine, index < currentStep && styles.stepLineActive]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Form Content */}
        {renderStep()}

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={handlePrev}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.textSecondary} />
              <Text style={styles.prevBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
            activeOpacity={0.85}
            onPress={isLastStep ? handleSubmit : handleNext}
            disabled={saving}
          >
            <LinearGradient
              colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextBtnGradient}
            >
              <Text style={styles.nextBtnText}>
                {saving ? 'Submitting...' : isLastStep ? 'Submit KYC' : 'Next'}
              </Text>
              {!saving && <MaterialCommunityIcons name="chevron-right" size={20} color={colors.white} />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Progress
  progressContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 20,
  },
  stepIndicator: { alignItems: 'center', gap: 6, zIndex: 1 },
  stepCircle: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumber: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  stepNumberActive: { color: colors.white },
  stepLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  stepLabelActive: { color: colors.primary },
  stepLine: {
    flex: 1, height: 2, backgroundColor: colors.border,
    marginBottom: 20, marginHorizontal: -2,
  },
  stepLineActive: { backgroundColor: colors.primary },

  // Step Content
  stepContent: { paddingHorizontal: 16 },
  stepTitle: { ...typography.h4, marginBottom: 16 },
  stepDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 16, lineHeight: 18 },
  sectionSubtitle: { ...typography.h4, fontSize: 16, marginBottom: 12, marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },

  // Fields
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  fieldInput: {
    backgroundColor: colors.surface,
    borderRadius: 14, height: 50,
    paddingHorizontal: 16, fontSize: 15, color: colors.text,
    borderWidth: 1.5, borderColor: colors.border,
  },
  fieldInputError: { borderColor: colors.error },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4, marginLeft: 4, fontWeight: '500' },

  // Gender
  genderRow: { flexDirection: 'row', gap: 10 },
  genderOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  genderText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  genderTextActive: { color: colors.primary },

  // Image Upload
  imageUpload: {
    height: 120, borderRadius: 14, borderWidth: 1.5,
    borderColor: colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  imageUploadDone: { borderStyle: 'solid', borderColor: colors.success },
  imagePreview: { width: '100%', height: '100%', borderRadius: 12 },
  imageUploadText: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontWeight: '500' },

  // Nav Buttons
  navButtons: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, marginTop: 24,
  },
  prevBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, gap: 4,
  },
  prevBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  nextBtn: { flex: 2, ...colors.shadow.button },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, borderRadius: 14, gap: 4,
  },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});

export default KYCScreen;