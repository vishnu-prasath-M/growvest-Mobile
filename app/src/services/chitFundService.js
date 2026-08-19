import api from './apiService';

const CHIT_FUND_ENDPOINTS = {
  CHITS: '/chits',
  CHIT_BY_ID: (id) => `/chits/${id}`,
  MY_CHITS: '/chits/my',
  DASHBOARD: '/chits/dashboard',
  JOIN_CHIT: '/chits/join',
  PAYMENT: '/chits/payment',
  PAYMENTS: '/chits/payments',
  WINNERS: '/chits/winners',
  DIVIDENDS: '/chits/dividends',
  MEMBERS: (id) => `/chits/${id}/members`,
  AUCTION: (id) => `/chits/${id}/auction`,
};

export const chitFundService = {
  /**
   * Get all available chit plans
   * @returns {Promise<Array>} List of available chits
   */
  getChits: async () => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.CHITS);
    return response.data;
  },

  /**
   * Get chit details by ID
   * @param {string} id - Chit ID
   * @returns {Promise<Object>} Chit details
   */
  getChitById: async (id) => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.CHIT_BY_ID(id));
    return response.data;
  },

  /**
   * Get user's joined chits
   * @returns {Promise<Array>} List of user's chits
   */
  getMyChits: async () => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.MY_CHITS);
    return response.data;
  },

  /**
   * Get dashboard summary
   * @returns {Promise<Object>} Dashboard data
   */
  getDashboard: async () => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.DASHBOARD);
    return response.data;
  },

  /**
   * Join a chit fund
   * @param {Object} data - Join data { chitId }
   * @returns {Promise<Object>} Join confirmation
   */
  joinChit: async (data) => {
    console.log('[ChitFundService] Joining chit with data:', data);
    const response = await api.post(CHIT_FUND_ENDPOINTS.JOIN_CHIT, data);
    console.log('[ChitFundService] Join response:', response.data);
    return response.data;
  },

  /**
   * Make a payment for chit installment
   * @param {Object} data - Payment data { chitId, memberId, month, amount, lateFee }
   * @returns {Promise<Object>} Payment confirmation
   */
  makePayment: async (data) => {
    const response = await api.post(CHIT_FUND_ENDPOINTS.PAYMENT, data);
    return response.data;
  },

  /**
   * Get payment history for user
   * @param {string} chitId - Optional chit ID to filter
   * @returns {Promise<Array>} Payment history
   */
  getPaymentHistory: async (chitId) => {
    const params = chitId ? { chitId } : {};
    const response = await api.get(CHIT_FUND_ENDPOINTS.PAYMENTS, { params });
    return response.data;
  },

  /**
   * Get winner history
   * @param {string} chitId - Optional chit ID to filter
   * @returns {Promise<Array>} Winner history
   */
  getWinners: async (chitId) => {
    const params = chitId ? { chitId } : {};
    const response = await api.get(CHIT_FUND_ENDPOINTS.WINNERS, { params });
    return response.data;
  },

  /**
   * Get dividend history for user
   * @returns {Promise<Array>} Dividend history
   */
  getDividends: async () => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.DIVIDENDS);
    return response.data;
  },

  /**
   * Get chit members
   * @param {string} chitId - Chit ID
   * @returns {Promise<Array>} Members list
   */
  getChitMembers: async (chitId) => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.MEMBERS(chitId));
    return response.data;
  },

  /**
   * Get auction info for a chit
   * @param {string} chitId - Chit ID
   * @returns {Promise<Object>} Auction details
   */
  getAuction: async (chitId) => {
    const response = await api.get(CHIT_FUND_ENDPOINTS.AUCTION(chitId));
    return response.data;
  },

  /**
   * Get app settings (e.g., UPI ID)
   * @returns {Promise<Object>} Settings data
   */
  getSettings: async () => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  },

  /**
   * Withdraw/take the Chit payout (user-initiated)
   * @param {string} memberId - Chit member ID
   * @returns {Promise<Object>} Withdrawal response
   */
  withdrawChitPayout: async (memberId) => {
    const response = await api.post(`/chits/${memberId}/withdraw`);
    return response.data;
  },
};