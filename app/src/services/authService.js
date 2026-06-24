import api from './apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../config/api';

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
      throw error.response?.data || error.message;
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
      throw error.response?.data || error.message;
    }
  },

  // Get current user
  getMe: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ME);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
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
      const response = await api.put(API_ENDPOINTS.UPDATE_USERNAME, { username });
      if (response.data) {
        // Update stored user data
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          const updated = { ...parsed, ...response.data };
          await AsyncStorage.setItem('userData', JSON.stringify(updated));
        }
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update mobile number
  updateMobileNumber: async (mobileNumber) => {
    try {
      const response = await api.put(API_ENDPOINTS.UPDATE_MOBILE, { mobileNumber });
      if (response.data) {
        // Update stored user data
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          const updated = { ...parsed, ...response.data };
          await AsyncStorage.setItem('userData', JSON.stringify(updated));
        }
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update user profile (username, mobileNumber, name)
  updateProfile: async (profileData) => {
    try {
      const response = await api.put(API_ENDPOINTS.UPDATE_PROFILE, profileData);
      if (response.data) {
        // Update stored user data
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          const updated = { ...parsed, ...response.data };
          await AsyncStorage.setItem('userData', JSON.stringify(updated));
        }
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};
