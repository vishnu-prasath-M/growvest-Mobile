import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const dashboardService = {
  // Get dashboard data
  getDashboard: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.DASHBOARD);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};
