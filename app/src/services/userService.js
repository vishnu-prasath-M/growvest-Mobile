import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const userService = {
  // Get user profile (from auth/me) - includes balance data
  getUserProfile: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ME);
      // Website backend returns user data directly with balance fields
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

