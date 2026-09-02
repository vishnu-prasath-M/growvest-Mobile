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

const ProfileScreen = ({ navigation }) => {
  const { isDarkMode, toggleTheme, colors: themeColors } = useTheme();
  const { isAppLockEnabled } = useAppLock();
  const styles = React.useMemo(() => getStyles(themeColors), [themeColors]);
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const handleEditUsername = () => { setNewUsername(userData?.username || ''); setEditModalVisible(true); };
  const handleSaveUsername = async () => {
    if (!newUsername.trim()) { Alert.alert('Error', 'Username cannot be empty'); return; }
    setSavingUsername(true);
    try {
      const updatedUser = await authService.updateUsername(newUsername.trim());
      await updateUser(updatedUser); setUserData(updatedUser); setEditModalVisible(false);
      Alert.alert('Success', 'Username updated successfully');
    } catch (error) { Alert.alert('Error', getErrorMessage(error)); }
    finally { setSavingUsername(false); }
  };

  const handleEditMobileNumber = () => { setNewMobileNumber(userData?.mobileNumber || ''); setEditMobileModalVisible(true); };
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

  const handleEditEmail = () => { setNewEmail(userData?.email || ''); setEditEmailModalVisible(true); };
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

  // Bank Details is only shown when the user has submitted KYC (real bank data exists)
  const hasBankDetails = kycStatus && kycStatus.hasKYC === true;

  const accountItems = [
    { icon: 'account-edit', label: 'Edit Profile', tint: colors.primaryLight, iconColor: colors.primary, onPress: handleEditUsername },
    { icon: 'email-edit', label: 'Edit Email', tint: '#e0f2fe', iconColor: '#0284c7', onPress: handleEditEmail },
    { icon: kycInfo.icon, label: 'KYC Verification', tint: kycInfo.tint, iconColor: kycInfo.iconColor, badge: kycInfo.badge, onPress: () => navigation.navigate('KYC') },
    { icon: 'gift-outline', label: 'Refer & Earn', tint: '#d1fae5', iconColor: '#059669', onPress: () => navigation.navigate('Referral') },
  ];

  // Only add Bank Details when KYC bank data exists in MongoDB
  if (hasBankDetails) {
    accountItems.push({ icon: 'bank-outline', label: 'Bank Details', tint: colors.primaryLight, iconColor: colors.primary, onPress: () => navigation.navigate('BankDetails') });
  }

  const menuGroups = [
    {
      title: 'Account',
      items: accountItems,
    },
    {
      title: 'Security',
      items: [
        {
          icon: 'shield-lock-outline',
          label: 'App Lock',
          badge: isAppLockEnabled ? 'Enabled 🔒' : 'Off 🔓',
          tint: isAppLockEnabled ? '#DCFCE7' : '#F1F5F9',
          iconColor: isAppLockEnabled ? '#16A34A' : '#64748B',
          onPress: () => navigation.navigate('AppLockSettings'),
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: isDarkMode ? 'weather-sunny' : 'weather-night',
          label: 'App Theme',
          badge: isDarkMode ? 'Dark Mode 🌙' : 'Light Mode ☀️',
          tint: isDarkMode ? '#312e81' : '#fef3c7',
          iconColor: isDarkMode ? '#818cf8' : '#d97706',
          onPress: toggleTheme,
        },
      ],
    },
    {
      title: 'General',
      items: [
        { icon: 'information-outline', label: 'About Us', tint: '#ede9fe', iconColor: '#7c3aed', onPress: () => navigation.navigate('AboutUs') },
        { icon: 'headset', label: 'Support', tint: '#fef3c7', iconColor: '#d97706', onPress: handleContactSupport },
        { icon: 'file-document-outline', label: 'Terms & Privacy', tint: colors.muted, iconColor: colors.textSecondary, onPress: () => navigation.navigate('Terms') },
      ],
    },
  ];

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
            <Text style={styles.profileName}>{(userData || authUser)?.name || (userData || authUser)?.username || 'User'}</Text>
            <MaterialCommunityIcons name="check-decagram" size={18} color={colors.primary} />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Active Since', value: formatActiveSince((userData || authUser)?.createdAt) },
            { label: 'Status', value: 'Active' },
            { label: 'KYC', value: kycInfo.label },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statValue, s.label === 'Active Since' && styles.statValueSmall]}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Menu Groups */}
        <View style={styles.menuSection}>
          {menuGroups.map((group) => (
            <View key={group.title} style={styles.menuGroup}>
              <Text style={styles.menuGroupLabel}>{group.title}</Text>
              <View style={styles.menuCard}>
                {group.items.map((item, i) => (
                  <View key={item.label}>
                    {i > 0 && <View style={styles.menuDivider} />}
                    <TouchableOpacity
                      style={styles.menuRow}
                      activeOpacity={0.7}
                      onPress={item.onPress}
                      disabled={!item.onPress}
                    >
                      <View style={[styles.menuIconBox, { backgroundColor: item.tint }]}>
                        <MaterialCommunityIcons name={item.icon} size={18} color={item.iconColor} />
                      </View>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                      {item.badge ? (
                        <View style={styles.menuBadge}>
                          <Text style={styles.menuBadgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Logout */}
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

      {/* Edit Username Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInputLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
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
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInputLabel}>Mobile Number</Text>
            <TextInput
              style={styles.modalInput}
              value={newMobileNumber}
              onChangeText={setNewMobileNumber}
              placeholder="Enter new mobile number"
              placeholderTextColor={colors.textMuted}
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
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalInputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Enter new email address"
              placeholderTextColor={colors.textMuted}
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

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },

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
    flex: 1, borderRadius: 24, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },

  // Name
  nameSection: { alignItems: 'center', paddingHorizontal: 24, marginTop: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  profileMeta: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  joinDate: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: 12,
    alignItems: 'center',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  statLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  // Slightly smaller font for longer date strings
  statValueSmall: { fontSize: 12 },

  // Menu
  menuSection: { paddingHorizontal: 16, marginTop: 20 },
  menuGroup: { marginBottom: 16 },
  menuGroupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, opacity: 0.6, marginHorizontal: 16 },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  menuBadge: {
    backgroundColor: colors.successLight, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  menuBadgeText: { fontSize: 10, fontWeight: '700', color: colors.success },

  // Logout
  logoutCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 24,
    padding: 16, gap: 12, marginBottom: 12,
    shadowColor: '#0E3D23', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  logoutIconBox: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center',
  },
  logoutText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.error },
  versionText: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', backgroundColor: colors.surface, borderRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' },
  modalInputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  modalInput: {
    backgroundColor: colors.background, borderRadius: 14, height: 50,
    paddingHorizontal: 16, fontSize: 15, color: colors.text,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modalSaveBtnOuter: { flex: 1 },
  modalSaveGradient: { height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: colors.white },
  disabledOpacity: { opacity: 0.6 },
});

export default ProfileScreen;