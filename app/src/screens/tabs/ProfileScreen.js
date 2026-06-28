import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { Card, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { colors, typography } from '../../theme/theme';
import { useScreenInsets } from '../../hooks/useScreenInsets';

const ProfileScreen = ({ navigation }) => {
  const insets = useScreenInsets(8);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editMobileModalVisible, setEditMobileModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingMobile, setSavingMobile] = useState(false);
  const { logout, updateUser, user: authUser } = useAuth();

  const getErrorMessage = (error) => {
    if (!error) return 'Something went wrong';
    if (typeof error === 'string') return error;
    return error.message || 'Something went wrong';
  };

  const fetchUserData = async () => {
    try {
      const user = await authService.refreshUserProfile();
      if (user) {
        await updateUser(user);
        setUserData(user);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error fetching user profile from API:', error);
    }

    try {
      const cachedUser = await authService.getUserData();
      setUserData(cachedUser);
    } catch (error) {
      console.error('Error fetching cached user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); } },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleEditUsername = () => {
    setNewUsername(userData?.username || '');
    setEditModalVisible(true);
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }
    setSavingUsername(true);
    try {
      const updatedUser = await authService.updateUsername(newUsername.trim());
      await updateUser(updatedUser);
      setUserData(updatedUser);
      setEditModalVisible(false);
      Alert.alert('Success', 'Username updated successfully');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSavingUsername(false);
    }
  };

  const handleEditMobileNumber = () => {
    setNewMobileNumber(userData?.mobileNumber || '');
    setEditMobileModalVisible(true);
  };

  const handleSaveMobileNumber = async () => {
    if (!newMobileNumber.trim()) {
      Alert.alert('Error', 'Mobile number cannot be empty');
      return;
    }
    if (newMobileNumber.trim().length !== 10 || !/^\d{10}$/.test(newMobileNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setSavingMobile(true);
    try {
      const updatedUser = await authService.updateMobileNumber(newMobileNumber.trim());
      await updateUser(updatedUser);
      setUserData(updatedUser);
      setEditMobileModalVisible(false);
      Alert.alert('Success', 'Mobile number updated successfully');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setSavingMobile(false);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('https://wa.me/918300278515?text=Hello Growvest Support, I need assistance.');
  };

  const getInitial = () => {
    const name = userData?.name || userData?.username || 'U';
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <MaterialCommunityIcons name="account-circle-outline" size={40} color={colors.primaryLight} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Profile Header */}
        <View style={[styles.profileHeader, { paddingTop: insets.top }]}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitial()}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.profileName}>{userData?.name || userData?.username || 'User'}</Text>
          <Text style={styles.profilePhone}>
            {userData?.mobileNumber || 'No mobile number'}
          </Text>
          <View style={styles.profileEmailRow}>
            <MaterialCommunityIcons name="email-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.profileEmail}>{userData?.email || 'No email'}</Text>
          </View>
          {userData?.createdAt && (
            <View style={styles.joinDateRow}>
              <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.joinDateText}>Joined {formatDate(userData.createdAt)}</Text>
            </View>
          )}
        </View>

        {/* Account Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          
          <View style={styles.detailItem}>
            <View style={styles.detailIconWrapper}>
              <MaterialCommunityIcons name="account" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Username</Text>
              <Text style={styles.detailValue}>{userData?.username || 'N/A'}</Text>
            </View>
            <TouchableOpacity onPress={handleEditUsername} style={styles.editButton}>
              <MaterialCommunityIcons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={[styles.detailIconWrapper, { backgroundColor: '#dbeafe' }]}>
              <MaterialCommunityIcons name="phone" size={20} color={colors.info} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Mobile Number</Text>
              <Text style={styles.detailValue}>{userData?.mobileNumber || 'N/A'}</Text>
            </View>
            <TouchableOpacity onPress={handleEditMobileNumber} style={styles.editButton}>
              <MaterialCommunityIcons name="pencil" size={18} color={colors.info} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={[styles.detailIconWrapper, { backgroundColor: '#fce7f3' }]}>
              <MaterialCommunityIcons name="email" size={20} color="#ec4899" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{userData?.email || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={[styles.detailIconWrapper, { backgroundColor: colors.successLight }]}>
              <MaterialCommunityIcons name="shield-check" size={20} color={colors.success} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Account Status</Text>
              <Text style={[styles.detailValue, { color: colors.success }]}>Active</Text>
            </View>
          </View>
        </View>

        {/* Options */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>More</Text>

          <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={() => navigation.navigate('AboutUs')}>
            <View style={[styles.optionIconWrapper, { backgroundColor: '#ede9fe' }]}>
              <MaterialCommunityIcons name="information" size={20} color="#7c3aed" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>About Us</Text>
              <Text style={styles.optionSubtitle}>Learn more about Growvest</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={handleContactSupport}>
            <View style={[styles.optionIconWrapper, { backgroundColor: '#fef3c7' }]}>
              <MaterialCommunityIcons name="headset" size={20} color="#d97706" />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Contact Support</Text>
              <Text style={styles.optionSubtitle}>Get help with your account</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={() => navigation.navigate('Terms')}>
            <View style={[styles.optionIconWrapper, { backgroundColor: '#f3f4f6' }]}>
              <MaterialCommunityIcons name="file-document" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Terms & Conditions</Text>
              <Text style={styles.optionSubtitle}>Read our terms and conditions</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={() => navigation.navigate('Privacy')}>
            <View style={[styles.optionIconWrapper, { backgroundColor: '#f3f4f6' }]}>
              <MaterialCommunityIcons name="shield-account" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Privacy Policy</Text>
              <Text style={styles.optionSubtitle}>Read our privacy policy</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.85} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Growvest v1.0.0</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Username Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Username</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              value={newUsername}
              onChangeText={setNewUsername}
              placeholder="Enter new username"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingUsername && styles.modalSaveBtnDisabled]}
                onPress={handleSaveUsername}
                disabled={savingUsername}
              >
                <Text style={styles.modalSaveText}>{savingUsername ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Mobile Number Modal */}
      <Modal
        visible={editMobileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditMobileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Mobile Number</Text>
              <TouchableOpacity onPress={() => setEditMobileModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Mobile Number</Text>
            <TextInput
              style={styles.modalInput}
              value={newMobileNumber}
              onChangeText={setNewMobileNumber}
              placeholder="Enter new mobile number"
              placeholderTextColor={colors.textTertiary}
              keyboardType="phone-pad"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditMobileModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingMobile && styles.modalSaveBtnDisabled]}
                onPress={handleSaveMobileNumber}
                disabled={savingMobile}
              >
                <Text style={styles.modalSaveText}>{savingMobile ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body1,
    color: colors.textTertiary,
    marginTop: 12,
  },
  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    marginBottom: 16,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...colors.shadow.button,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  profileName: {
    ...typography.h2,
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
  },
  profileEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textTertiary,
    marginLeft: 6,
  },
  joinDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  joinDateText: {
    fontSize: 13,
    color: colors.textTertiary,
    marginLeft: 6,
  },
  // Sections
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    ...colors.shadow.card,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: 16,
  },
  // Detail Items
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
    marginLeft: 54,
  },
  // Option Items
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  optionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  optionDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 12,
    marginLeft: 54,
  },
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 16,
  },
});

export default ProfileScreen;