import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useTheme } from '../../context/ThemeContext';
import { useAppLock } from '../../context/AppLockContext';
import { appLockService } from '../../services/appLockService';

const ProfileScreen = ({ navigation }) => {
  const { isDarkMode, toggleTheme, colors: themeColors } = useTheme();
  const { isAppLockEnabled, isBiometricEnabled, refreshLockPreferences, activeUserId } = useAppLock();
  const styles = React.useMemo(() => getStyles(themeColors, isDarkMode), [themeColors, isDarkMode]);
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personalInfoModalVisible, setPersonalInfoModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editMobileModalVisible, setEditMobileModalVisible] = useState(false);
  const [editEmailModalVisible, setEditEmailModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingMobile, setSavingMobile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [kycStatus, setKycStatus] = useState(null);
  const { logout, updateUser, user: authUser } = useAuth();

  const getErrorMessage = (error) => {
    if (!error) return 'Something went wrong';
    if (typeof error === 'string') return error;
    return error.message || 'Something went wrong';
  };

  const fetchUserData = async () => {
    try {
      const user = await authService.refreshUserProfile();
      if (user) { await updateUser(user); setUserData(user); setLoading(false); return; }
    } catch (error) { console.error('Error fetching user profile from API:', error); }
    try {
      const cachedUser = await authService.getUserData();
      setUserData(cachedUser);
    } catch (error) { console.error('Error fetching cached user data:', error); }
    finally { setLoading(false); }
  };

  // Fetch KYC status
  const fetchKYCStatus = async () => {
    try {
      const api = (await import('../../services/apiService')).default;
      const { API_ENDPOINTS } = await import('../../config/api');
      const response = await api.get(API_ENDPOINTS.KYC_STATUS);
      setKycStatus(response.data);
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  useFocusEffect(useCallback(() => { fetchUserData(); fetchKYCStatus(); }, []));

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // Format registration date as "24 Jul 2026" for the Active Since stat
  const formatActiveSince = (dateString) => {
    if (!dateString) return '–';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '–';
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '–';
    }
  };

  const handleOpenPersonalInfo = () => {
    setPersonalInfoModalVisible(true);
  };

  const handleEditUsername = () => {
    setPersonalInfoModalVisible(false);
    setNewUsername((userData || authUser)?.name || (userData || authUser)?.username || '');
    setEditModalVisible(true);
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) { Alert.alert('Error', 'Username cannot be empty'); return; }
    setSavingUsername(true);
    try {
      const updatedUser = await authService.updateUsername(newUsername.trim());
      await updateUser(updatedUser); setUserData(updatedUser); setEditModalVisible(false);
      Alert.alert('Success', 'Profile name updated successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error)); }
    finally { setSavingUsername(false); }
  };

  const handleEditMobileNumber = () => {
    setPersonalInfoModalVisible(false);
    setNewMobileNumber((userData || authUser)?.mobileNumber || '');
    setEditMobileModalVisible(true);
  };

  const handleSaveMobileNumber = async () => {
    if (!newMobileNumber.trim()) { Alert.alert('Error', 'Mobile number cannot be empty'); return; }
    if (newMobileNumber.trim().length !== 10 || !/^\d{10}$/.test(newMobileNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number'); return;
    }
    setSavingMobile(true);
    try {
      const updatedUser = await authService.updateMobileNumber(newMobileNumber.trim());
      await updateUser(updatedUser); setUserData(updatedUser); setEditMobileModalVisible(false);
      Alert.alert('Success', 'Mobile number updated successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error)); }
    finally { setSavingMobile(false); }
  };

  const handleEditEmail = () => {
    setPersonalInfoModalVisible(false);
    setNewEmail((userData || authUser)?.email || '');
    setEditEmailModalVisible(true);
  };

  const handleSaveEmail = async () => {
    if (!newEmail.trim()) { Alert.alert('Error', 'Email cannot be empty'); return; }
    if (!/\S+@\S+\.\S+/.test(newEmail)) { Alert.alert('Error', 'Please enter a valid email address'); return; }
    setSavingEmail(true);
    try {
      const updatedUser = await authService.updateEmail(newEmail.trim());
      await updateUser(updatedUser); setUserData(updatedUser); setEditEmailModalVisible(false);
      Alert.alert('Success', 'Email updated successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error)); }
    finally { setSavingEmail(false); }
  };

  const handleContactSupport = () => {
    Linking.openURL('https://wa.me/918300278515?text=Hello Growvest Support, I need assistance.');
  };

  const handleToggleBiometric = async () => {
    if (!isAppLockEnabled) {
      Alert.alert(
        'App Lock Required',
        'Please set up an App Lock PIN first to enable Biometric Unlock.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Setup App Lock', onPress: () => navigation.navigate('AppLockSettings') },
        ]
      );
      return;
    }
    const currentUserId = (userData || authUser)?._id || (userData || authUser)?.id || activeUserId;
    if (!currentUserId) return;
    try {
      const nextState = !isBiometricEnabled;
      await appLockService.setBiometricEnabled(currentUserId, nextState);
      if (refreshLockPreferences) {
        await refreshLockPreferences();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const getInitials = () => {
    const name = userData?.name || userData?.username || 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader variant="profile" />
      </View>
    );
  }

  const getKYCStatusInfo = () => {
    if (!kycStatus || kycStatus.status === 'not_submitted') {
      return { label: 'Not Submitted', badge: 'Submit Now', tint: colors.warningLight, iconColor: colors.warning, icon: 'shield-off' };
    }
    if (kycStatus.status === 'pending') {
      return { label: 'Pending', badge: 'Pending', tint: colors.warningLight, iconColor: colors.warning, icon: 'shield-clock' };
    }
    if (kycStatus.status === 'approved') {
      return { label: 'Verified', badge: 'Verified', tint: colors.successLight, iconColor: colors.success, icon: 'shield-check' };
    }
    if (kycStatus.status === 'rejected') {
      return { label: 'Rejected', badge: 'Rejected', tint: colors.errorLight, iconColor: colors.error, icon: 'shield-off' };
    }
    return { label: 'Not Submitted', badge: 'Submit Now', tint: colors.warningLight, iconColor: colors.warning, icon: 'shield-off' };
  };

  const kycInfo = getKYCStatusInfo();
  const coinBalance = (userData || authUser)?.coinBalance ?? (userData || authUser)?.totalCoins ?? 0;
  const activeUserObj = userData || authUser;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Banner */}
        <View style={styles.heroBannerOuter}>
          <LinearGradient
            colors={['#0E3D23', '#1A5C39', '#2E8B5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroBlobGold} />
          </LinearGradient>

          {/* Avatar overlapping */}
          <View style={styles.avatarOuter}>
            <LinearGradient
              colors={['#E8D083', '#C89A30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Name & Info */}
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{activeUserObj?.name || activeUserObj?.username || 'User'}</Text>
            <MaterialCommunityIcons name="check-decagram" size={18} color={colors.primary} />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Active Since', value: formatActiveSince(activeUserObj?.createdAt) },
            { label: 'Status', value: 'Active' },
            { label: 'KYC', value: kycInfo.label },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statValue, s.label === 'Active Since' && styles.statValueSmall]}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Menu Section */}
        <View style={styles.menuSection}>
          {/* SECTION 1: ACCOUNT */}
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupLabel}>ACCOUNT</Text>
            <View style={styles.menuCard}>
              {/* Personal Information */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={handleOpenPersonalInfo}
              >
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="account-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>Personal Information</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* KYC with Verified Badge */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('KYC')}
              >
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="file-document-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>KYC</Text>
                {kycInfo.badge ? (
                  <View style={[styles.menuBadge, { backgroundColor: kycInfo.tint }]}>
                    <Text style={[styles.menuBadgeText, { color: kycInfo.iconColor }]}>{kycInfo.badge}</Text>
                  </View>
                ) : null}
                <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Bank Details */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BankDetails')}
              >
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="bank-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>Bank Details</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 2: SECURITY */}
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupLabel}>SECURITY</Text>
            <View style={styles.menuCard}>
              {/* App Lock */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AppLockSettings')}
              >
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>App Lock</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Biometric Unlock */}
              <View style={styles.menuRow}>
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>Biometric Unlock</Text>
                <Switch
                  value={Boolean(isBiometricEnabled)}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: isDarkMode ? '#374151' : '#E2E4DC', true: '#0E3D23' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={isDarkMode ? '#374151' : '#E2E4DC'}
                />
              </View>
            </View>
          </View>

          {/* SECTION 3: PREFERENCES */}
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupLabel}>PREFERENCES</Text>
            <View style={styles.menuCard}>
              {/* Dark mode */}
              <View style={styles.menuRow}>
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons
                    name={isDarkMode ? 'weather-night' : 'weather-sunny'}
                    size={20}
                    color={styles.mintIconColor.color}
                  />
                </View>
                <Text style={styles.menuLabel}>Dark mode</Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: isDarkMode ? '#374151' : '#E2E4DC', true: '#0E3D23' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={isDarkMode ? '#374151' : '#E2E4DC'}
                />
              </View>

              <View style={styles.menuDivider} />

              {/* About Us */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('AboutUs')}
              >
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="information-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>About Us</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              {/* Contact Support */}
              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={handleContactSupport}
              >
                <View style={styles.mintIconBox}>
                  <MaterialCommunityIcons name="navigation-variant-outline" size={20} color={styles.mintIconColor.color} />
                </View>
                <Text style={styles.menuLabel}>Contact Support</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 4: REFER & EARN (Standalone Card) */}
          <TouchableOpacity
            style={styles.rewardsCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Referral')}
          >
            <View style={styles.mintIconBox}>
              <MaterialCommunityIcons name="gift-outline" size={20} color={styles.mintIconColor.color} />
            </View>
            <View style={styles.rewardsContent}>
              <Text style={styles.rewardsTitle}>Refer & Earn</Text>
              <Text style={styles.rewardsSubtitle}>{coinBalance} Coins · Invite friends & earn</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={styles.chevronColor.color} />
          </TouchableOpacity>

          {/* SECTION 5: LOGOUT */}
          <TouchableOpacity style={styles.logoutCard} activeOpacity={0.85} onPress={handleLogout}>
            <View style={styles.logoutIconBox}>
              <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
            </View>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Growvest v1.0.0</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Personal Information Overview Sheet / Modal */}
      <Modal visible={personalInfoModalVisible} transparent animationType="slide" onRequestClose={() => setPersonalInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.personalInfoModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => setPersonalInfoModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Profile / Username Row */}
            <TouchableOpacity style={styles.personalInfoRow} activeOpacity={0.7} onPress={handleEditUsername}>
              <View style={styles.personalInfoIconBox}>
                <MaterialCommunityIcons name="account-edit-outline" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personalInfoLabel}>Full Name / Username</Text>
                <Text style={styles.personalInfoValue}>{activeUserObj?.name || activeUserObj?.username || 'Not set'}</Text>
              </View>
              <View style={styles.personalInfoEditBtn}>
                <Text style={styles.personalInfoEditText}>Edit</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.personalInfoDivider} />

            {/* Email Row */}
            <TouchableOpacity style={styles.personalInfoRow} activeOpacity={0.7} onPress={handleEditEmail}>
              <View style={[styles.personalInfoIconBox, { backgroundColor: '#E0F2FE' }]}>
                <MaterialCommunityIcons name="email-edit-outline" size={20} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personalInfoLabel}>Email Address</Text>
                <Text style={styles.personalInfoValue}>{activeUserObj?.email || 'Not set'}</Text>
              </View>
              <View style={styles.personalInfoEditBtn}>
                <Text style={styles.personalInfoEditText}>Edit</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.personalInfoDivider} />

            {/* Mobile Number Row */}
            <TouchableOpacity style={styles.personalInfoRow} activeOpacity={0.7} onPress={handleEditMobileNumber}>
              <View style={[styles.personalInfoIconBox, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="phone-outline" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personalInfoLabel}>Mobile Number</Text>
                <Text style={styles.personalInfoValue}>{activeUserObj?.mobileNumber ? `+91 ${activeUserObj.mobileNumber}` : 'Not set'}</Text>
              </View>
              <View style={styles.personalInfoEditBtn}>
                <Text style={styles.personalInfoEditText}>Edit</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setPersonalInfoModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Username Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Name</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInputLabel}>Full Name / Username</Text>
            <TextInput
              style={styles.modalInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter name"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="words"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtnOuter, savingUsername && styles.disabledOpacity]}
                onPress={handleSaveUsername}
                disabled={savingUsername}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>{savingUsername ? 'Saving...' : 'Save'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Mobile Modal */}
      <Modal visible={editMobileModalVisible} transparent animationType="fade" onRequestClose={() => setEditMobileModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Mobile Number</Text>
              <TouchableOpacity onPress={() => setEditMobileModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInputLabel}>Mobile Number</Text>
            <TextInput
              style={styles.modalInput}
              value={newMobileNumber}
              onChangeText={setNewMobileNumber}
              placeholder="Enter new mobile number"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditMobileModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtnOuter, savingMobile && styles.disabledOpacity]}
                onPress={handleSaveMobileNumber}
                disabled={savingMobile}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>{savingMobile ? 'Saving...' : 'Save'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Email Modal */}
      <Modal visible={editEmailModalVisible} transparent animationType="fade" onRequestClose={() => setEditEmailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Email</Text>
              <TouchableOpacity onPress={() => setEditEmailModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Enter new email address"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditEmailModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtnOuter, savingEmail && styles.disabledOpacity]}
                onPress={handleSaveEmail}
                disabled={savingEmail}
              >
                <LinearGradient
                  colors={['#0E3D23', '#1A5C39']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalSaveGradient}
                >
                  <Text style={styles.modalSaveText}>{savingEmail ? 'Saving...' : 'Save'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const getStyles = (themeColors, isDarkMode) => StyleSheet.create({
  container: { flex: 1, backgroundColor: themeColors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: themeColors.textMuted, marginTop: 12 },

  // Colors helper for icons
  mintIconColor: { color: isDarkMode ? '#34D399' : '#0E3D23' },
  chevronColor: { color: isDarkMode ? '#6B7280' : '#8E9486' },

  // Hero
  heroBannerOuter: { position: 'relative', marginBottom: 60 },
  heroBanner: { height: 160, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  heroBlobGold: {
    position: 'absolute', bottom: -30, right: -30,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(212,168,67,0.22)',
  },
  avatarOuter: { position: 'absolute', bottom: -52, alignSelf: 'center' },
  avatarRing: {
    width: 100, height: 100, borderRadius: 28, padding: 3,
    shadowColor: '#C89A30', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  avatarInner: {
    flex: 1, borderRadius: 24, backgroundColor: themeColors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },

  // Name
  nameSection: { alignItems: 'center', paddingHorizontal: 24, marginTop: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 22, fontWeight: '800', color: themeColors.text, letterSpacing: -0.5 },
  profileMeta: { fontSize: 13, color: themeColors.textMuted, marginTop: 4, textAlign: 'center' },
  joinDate: { fontSize: 12, color: themeColors.textMuted, marginTop: 4 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  statCard: {
    flex: 1, backgroundColor: themeColors.surface, borderRadius: 18, padding: 12,
    alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  statLabel: { fontSize: 10, color: themeColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '700', color: themeColors.text, marginTop: 4 },
  statValueSmall: { fontSize: 12 },

  // Menu Section
  menuSection: { paddingHorizontal: 16, marginTop: 24 },
  menuGroup: { marginBottom: 20 },
  menuGroupLabel: {
    fontSize: 12, fontWeight: '800', color: isDarkMode ? '#9CA3AF' : '#686D62',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    overflow: 'hidden',
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#EFF1E9',
    marginHorizontal: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  mintIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#E3F6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: themeColors.text,
  },
  menuBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginRight: 4,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Refer & Earn Standalone Card
  rewardsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 20,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rewardsContent: { flex: 1 },
  rewardsTitle: { fontSize: 15, fontWeight: '700', color: themeColors.text },
  rewardsSubtitle: { fontSize: 12, fontWeight: '500', color: themeColors.textMuted, marginTop: 2 },

  // Logout
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 12,
    shadowColor: '#0E3D23',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.error },
  versionText: { textAlign: 'center', fontSize: 12, color: themeColors.textMuted, marginTop: 8 },

  // Personal Info Modal
  personalInfoModalContent: {
    width: '90%',
    backgroundColor: themeColors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ECEFE6',
  },
  personalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  personalInfoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  personalInfoLabel: {
    fontSize: 11,
    color: themeColors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personalInfoValue: {
    fontSize: 14,
    color: themeColors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  personalInfoEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#F0F2EB',
  },
  personalInfoEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: isDarkMode ? '#34D399' : '#0E3D23',
  },
  personalInfoDivider: {
    height: 1,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#EFF1E9',
  },
  modalDoneBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0E3D23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', backgroundColor: themeColors.surface, borderRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: themeColors.text, letterSpacing: -0.4 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F0F2EB', justifyContent: 'center', alignItems: 'center' },
  modalInputLabel: { fontSize: 13, fontWeight: '600', color: themeColors.text, marginBottom: 8 },
  modalInput: {
    backgroundColor: themeColors.background, borderRadius: 14, height: 50,
    paddingHorizontal: 16, fontSize: 15, color: themeColors.text,
    borderWidth: 1.5, borderColor: themeColors.border, marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: themeColors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: themeColors.textSecondary },
  modalSaveBtnOuter: { flex: 1 },
  modalSaveGradient: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: colors.white },
  disabledOpacity: { opacity: 0.6 },
});

export default ProfileScreen;
