import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const withdrawalService = {
  // Create withdrawal
  createWithdrawal: async (withdrawalData) => {
    try {
      const response = await api.post(API_ENDPOINTS.WITHDRAWALS, withdrawalData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get withdrawals
  getWithdrawals: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.WITHDRAWALS);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get withdrawal by id
  getWithdrawalById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.WITHDRAWAL_BY_ID(id));
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};
