import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const transactionService = {
  // Get my transactions
  getMyTransactions: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.TRANSACTIONS);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get transaction by id
  getTransactionById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.TRANSACTION_BY_ID(id));
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};
