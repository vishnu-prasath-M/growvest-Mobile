import api from './apiService';

export const sipService = {
  /**
   * Fetch all SIPs for the logged in user + overview summary
   */
  getMySIPs: async () => {
    const response = await api.get('/sip/my');
    return response.data;
  },

  /**
   * Fetch details and contribution ledger for a specific SIP
   */
  getSIPById: async (id) => {
    const response = await api.get(`/sip/${id}`);
    return response.data;
  },

  /**
   * Create a new SIP plan and get Razorpay order for Contribution #1
   */
  createSIP: async ({
    amount,
    sipDate,
    sipDayName,
    durationMonths,
    durationCount,
    frequency = 'monthly',
    notes,
  }) => {
    const response = await api.post('/sip/create', {
      amount,
      sipDate,
      sipDayName,
      durationMonths,
      durationCount,
      frequency,
      notes,
    });
    return response.data;
  },

  /**
   * Verify Razorpay payment for initial or subsequent SIP contribution
   */
  verifyPayment: async (paymentData) => {
    const response = await api.post('/sip/verify-payment', paymentData);
    return response.data;
  },

  /**
   * Generate Razorpay payment order for a scheduled pending/failed installment
   */
  payInstallment: async (sipId, contributionId) => {
    const response = await api.post('/sip/pay-installment', {
      id: sipId,
      contributionId,
    });
    return response.data;
  },

  /**
   * Request withdrawal from this specific SIP only
   */
  withdrawSIP: async (sipId, amount, upiId) => {
    const response = await api.post(`/sip/${sipId}/withdraw`, {
      amount,
      upiId,
    });
    return response.data;
  },

  /**
   * Cancel SIP future contributions safely
   */
  cancelSIP: async (sipId) => {
    const response = await api.post(`/sip/${sipId}/cancel`);
    return response.data;
  },
};
