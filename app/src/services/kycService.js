import api from './apiService';

export const kycService = {
  /**
   * Get current user's KYC status
   * @returns {Promise<Object>} Status object { status, hasKYC, isSubmitted }
   */
  getKYCStatus: async () => {
    try {
      const response = await api.get('/kyc/status');
      const data = response.data || {};
      const status = data.status || 'not_submitted';
      
      // KYC is considered submitted if status is 'pending' or 'approved'
      const isSubmitted = status === 'pending' || status === 'approved';
      
      return {
        status,
        isSubmitted,
        hasKYC: data.hasKYC || false,
        rejectionReason: data.rejectionReason || null,
        data: data.data || null,
      };
    } catch (error) {
      console.warn('[kycService] Error checking KYC status:', error?.message || error);
      return {
        status: 'not_submitted',
        isSubmitted: false,
        hasKYC: false,
      };
    }
  },

  /**
   * Helper to check if current user is allowed to invest.
   * Returns true if KYC has been submitted (pending or approved).
   * Returns false if not submitted or rejected.
   */
  isKYCSubmittedForInvestment: async () => {
    const result = await kycService.getKYCStatus();
    return result.isSubmitted;
  },
};
