import api from './apiService';
import { API_ENDPOINTS } from '../config/api';
import { mapProfileToDashboard } from '../utils/userBalances';

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

export const userService = {
  getUserProfile: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USER_PROFILE);
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  getDashboardData: async () => {
    const profile = await userService.getUserProfile();
    return mapProfileToDashboard(profile);
  },
};
