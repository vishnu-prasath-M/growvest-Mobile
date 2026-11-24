const axios = require('axios');

const ZOXY_DEFAULT_TOKEN = 'ub_3bf6c5121056d66e2f177aa2f0bbf92d3ce3';
const ZOXY_BASE_URL = 'https://zoxy.in/api';

class ZoxyService {
  async getEffectiveToken() {
    try {
      const Settings = require('../models/Settings');
      const setting = await Settings.findOne({ key: 'zoxy_user_token' });
      if (setting && setting.value && setting.value.trim()) {
        return setting.value.trim();
      }
    } catch (_) {}
    return process.env.ZOXY_USER_TOKEN || ZOXY_DEFAULT_TOKEN;
  }

  /**
   * Create an order on Zoxy Gateway
   * @param {Object} params
   * @param {string} params.orderId - Unique order identifier
   * @param {number|string} params.amount - Amount in INR
   * @param {string} [params.customerMobile] - Customer mobile number
   * @param {string} [params.remark] - Custom order remark / User identifier
   * @param {string} [params.redirectUrl] - Custom redirect/callback URL override
   * @returns {Promise<Object>}
   */
  async createOrder({ orderId, amount, customerMobile, remark, redirectUrl }) {
    try {
      const userToken = await this.getEffectiveToken();
      const callbackBase = process.env.APP_URL || 'https://growvest-mobile.onrender.com';
      const effectiveRedirectUrl =
        redirectUrl ||
        `${callbackBase}/api/payment/zoxy-callback?order_id=${encodeURIComponent(orderId)}`;

      const payload = {
        user_token: userToken,
        order_id: String(orderId),
        amount: String(amount),
        customer_mobile: customerMobile ? String(customerMobile) : '9999999999',
        redirect_url: effectiveRedirectUrl,
        remark1: remark || 'Growvest Payment',
        method: 'upi',
      };

      console.log('[Zoxy Service] Creating order with payload:', {
        ...payload,
        user_token: '***' + userToken.slice(-6),
      });

      const response = await axios.post(`${ZOXY_BASE_URL}/create-order`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 15000,
      });

      const data = response.data;
      console.log('[Zoxy Service] Create order response:', data);

      // Zoxy returns { status: true, payment_url: "...", hash: "...", ... } on success
      if (data && (data.status === true || data.status === 'true' || data.payment_url)) {
        return {
          success: true,
          orderId: data.order_id || orderId,
          paymentUrl: data.payment_url,
          hash: data.hash,
          raw: data,
        };
      }

      return {
        success: false,
        message: data?.message || 'Failed to generate Zoxy payment URL',
        raw: data,
      };
    } catch (err) {
      console.error('[Zoxy Service] Create order error:', err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Zoxy connection error',
        error: err.response?.data || err.message,
      };
    }
  }

  /**
   * Check order status on Zoxy
   * @param {string} orderId
   * @returns {Promise<Object>}
   */
  async getOrderStatus(orderId) {
    try {
      const userToken = await this.getEffectiveToken();
      const response = await axios.post(
        `${ZOXY_BASE_URL}/check-order-status`,
        {
          user_token: userToken,
          order_id: String(orderId),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );

      const resData = response.data;
      const isSuccess =
        resData?.status === 'COMPLETED' ||
        resData?.status === 'SUCCESS' ||
        resData?.status === true ||
        String(resData?.result?.status || '').toUpperCase() === 'COMPLETED';

      return {
        success: isSuccess,
        data: resData?.result || resData?.data || resData,
        raw: resData,
      };
    } catch (err) {
      console.error('[Zoxy Service] Order status error:', err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message,
      };
    }
  }
}

module.exports = new ZoxyService();
