import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const paymentService = {
  /**
   * Create Razorpay order on backend
   * @param {number} amount
   * @param {string} purpose
   * @param {object} notes
   */
  createOrder: async (amount, purpose = 'investment', notes = {}) => {
    const response = await api.post(API_ENDPOINTS.PAYMENT_CREATE_ORDER, {
      amount,
      purpose,
      notes,
    });
    return response.data;
  },

  /**
   * Verify Razorpay payment signature & execute backend business logic
   * @param {object} verificationData
   */
  verifyPayment: async (verificationData) => {
    const response = await api.post(API_ENDPOINTS.PAYMENT_VERIFY, verificationData);
    return response.data;
  },
};
