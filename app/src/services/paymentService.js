import api from './apiService';
import { API_ENDPOINTS } from '../config/api';

export const paymentService = {
  /**
   * Create payment order on backend
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
   * Verify payment & execute backend business logic
   * @param {object} verificationData
   */
  verifyPayment: async (verificationData) => {
    const response = await api.post(API_ENDPOINTS.PAYMENT_VERIFY, verificationData);
    return response.data;
  },

  /**
   * Check order status with payment gateway
   * @param {string} orderId
   */
  checkOrderStatus: async (orderId) => {
    const response = await api.post('/payment/check-order-status', { order_id: orderId });
    return response.data;
  },

  /**
   * Submit Manual UPI payment verification (UTR + optional screenshot)
   * @param {object} data
   */
  submitManualPayment: async (data) => {
    const response = await api.post('/payment/manual/submit', data);
    return response.data;
  },

  /**
   * Get active Company UPI details (VPA, Payee Name, QR)
   */
  getCompanyUpiDetails: async () => {
    const response = await api.get('/payment/manual/config');
    return response.data;
  },

  /**
   * Live check UPI payment order status (Canara Bank auto-approval)
   * @param {string} orderId
   */
  checkUpiOrderStatus: async (orderId) => {
    const response = await api.get(`/payment/upi/status/${orderId}`);
    return response.data;
  },

  /**
   * Claim 12-digit UTR against bank credit alert
   * @param {string} orderId
   * @param {string} utr
   */
  claimUpiUtr: async (orderId, utr) => {
    const response = await api.post('/payment/upi/claim-utr', { orderId, utr });
    return response.data;
  },
};
