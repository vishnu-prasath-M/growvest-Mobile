const axios = require('axios');

const ZAP_KEY = process.env.ZAP_KEY || 'zap5035fe5b00bcdc3c38f5ccf48bff850a';
const BASE_URL = process.env.ZAP_BASE_URL || 'https://pay.zapupi.com/api';
const DEFAULT_WEBHOOK_URL =
  process.env.ZAP_WEBHOOK_URL ||
  `${process.env.APP_URL || 'https://growvest-mobile.onrender.com'}/api/payment/zapupi-webhook`;

class ZapUPIService {
  async getEffectiveZapKey() {
    try {
      const Settings = require('../models/Settings');
      const setting = await Settings.findOne({ key: 'zap_key' });
      if (setting && setting.value && setting.value.trim()) {
        return setting.value.trim();
      }
    } catch (_) {}
    return ZAP_KEY;
  }

  /**
   * Create an order on ZapUPI
   * @param {Object} params
   * @param {string} params.orderId - Unique order identifier
   * @param {number|string} params.amount - Amount in INR
   * @param {string} [params.customerMobile] - Customer mobile number (optional)
   * @param {string} [params.remark] - Custom remark / UserID
   * @param {string} [params.webhookUrl] - Webhook URL override
   * @returns {Promise<Object>}
   */
  async createOrder({ orderId, amount, customerMobile, remark, webhookUrl }) {
    try {
      const zapKey = await this.getEffectiveZapKey();
      const callbackBase = process.env.APP_URL || 'https://growvest-mobile.onrender.com';
      const redirectUrl = `${callbackBase}/api/payment/callback?order_id=${encodeURIComponent(orderId)}`;

      const payload = {
        zap_key: zapKey,
        order_id: String(orderId),
        amount: String(amount),
        customer_mobile: customerMobile ? String(customerMobile) : '9999999999',
        remark: remark || 'Growvest Payment',
        webhook_url: webhookUrl || DEFAULT_WEBHOOK_URL,
        success_url: redirectUrl,
        failed_url: redirectUrl,
        timeout_url: redirectUrl,
      };

      console.log('[ZapUPI Service] Creating order with payload:', {
        ...payload,
        zap_key: '***' + zapKey.slice(-4),
      });

      const response = await axios.post(`${BASE_URL}/create-order`, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      const data = response.data;
      console.log('[ZapUPI Service] Create order response:', data);

      if (data && (data.status === 'success' || data.payment_url)) {
        return {
          success: true,
          orderId: data.order_id || orderId,
          paymentUrl: data.payment_url,
          txnId: data.txn_id,
          environment: data.environment || 'cashier',
          raw: data,
        };
      }

      return {
        success: false,
        message: data?.message || 'Failed to generate ZapUPI payment URL',
        raw: data,
      };
    } catch (err) {
      console.error('[ZapUPI Service] Create order error:', err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'ZapUPI connection error',
        error: err.response?.data || err.message,
      };
    }
  }

  /**
   * Check order status on ZapUPI
   * @param {string} orderId
   * @returns {Promise<Object>}
   */
  async getOrderStatus(orderId) {
    try {
      const zapKey = await this.getEffectiveZapKey();
      const response = await axios.post(
        `${BASE_URL}/order-status`,
        {
          zap_key: zapKey,
          order_id: String(orderId),
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      return {
        success: response.data?.status === 'success',
        data: response.data?.data || response.data,
      };
    } catch (err) {
      console.error('[ZapUPI Service] Order status error:', err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message,
      };
    }
  }
}

module.exports = new ZapUPIService();

