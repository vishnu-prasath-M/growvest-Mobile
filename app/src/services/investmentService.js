import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const investmentService = {
  // Create investment
  createInvestment: async (investmentData) => {
    try {
      const response = await api.post(API_ENDPOINTS.INVESTMENTS, investmentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get all investments
  getInvestments: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.INVESTMENTS);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get investment by id
  getInvestmentById: async (id) => {
    try {
      const response = await api.get(API_ENDPOINTS.INVESTMENT_BY_ID(id));
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get investment plans dynamically
  getPlans: async () => {
    try {
      const response = await api.get(API_ENDPOINTS.INVESTMENT_PLANS);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
  // Withdraw investment
  withdrawInvestment: async (id, upiId) => {
    try {
      const response = await api.post(`/api/investments/${id}/withdraw`, { upiId });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};
