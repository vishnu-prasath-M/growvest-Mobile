import api from './apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/api';

const normalizeError = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string') {
    return { message: data };
  }
  if (data && typeof data === 'object' && data.message) {
    return data;
  }
  return { message: error.message || 'Something went wrong' };
};

const persistUserProfile = async (profile) => {
  if (!profile) {
    return null;
  }

  const stored = await AsyncStorage.getItem('userData');
  const parsed = stored ? JSON.parse(stored) : {};
  const updated = { ...parsed, ...profile };
  await AsyncStorage.setItem('userData', JSON.stringify(updated));
  return updated;
};

const refreshUserProfile = async () => {
  const response = await api.get(API_ENDPOINTS.ME);
  return persistUserProfile(response.data);
};

export const authService = {
  // Register user
  register: async (userData) => {
    try {
      const response = await api.post(API_ENDPOINTS.REGISTER, userData);
      if (response.data.token) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  // Login user
  login: async (email, password) => {
    try {
      const response = await api.post(API_ENDPOINTS.LOGIN, { email, password });
      if (response.data.token) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  // Get current user
  getMe: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ME);
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  // Logout
  logout: async () => {
    try {
      await AsyncStorage.multiRemove(['userToken', 'userData']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  // Check if user is logged in
  isLoggedIn: async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      return !!token;
    } catch (error) {
      return false;
    }
  },

  // Get stored user data
  getUserData: async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  },

  // Get stored token
  getToken: async () => {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      return null;
    }
  },

  // Update username
  updateUsername: async (username) => {
    try {
      await api.put(API_ENDPOINTS.UPDATE_USERNAME, { username });
      return await refreshUserProfile();
    } catch (error) {
      throw normalizeError(error);
    }
  },

  // Update mobile number
  updateMobileNumber: async (mobileNumber) => {
    try {
      await api.put(API_ENDPOINTS.UPDATE_PROFILE, { mobileNumber });
      return await refreshUserProfile();
    } catch (error) {
      throw normalizeError(error);
    }
  },

  // Update email address
  updateEmail: async (email) => {
    try {
      console.log('[authService.updateEmail] Sending email:', email);
      await api.put(API_ENDPOINTS.UPDATE_PROFILE, { email });
      return await refreshUserProfile();
    } catch (error) {
      console.error('[authService.updateEmail] Error:', error);
      throw normalizeError(error);
    }
  },

  // Update user profile (username, mobileNumber, name)
  updateProfile: async (profileData) => {
    try {
      await api.put(API_ENDPOINTS.UPDATE_PROFILE, profileData);
      return await refreshUserProfile();
    } catch (error) {
      throw normalizeError(error);
    }
  },

  refreshUserProfile,
};
