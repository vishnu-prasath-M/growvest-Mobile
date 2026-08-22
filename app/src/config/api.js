import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getBaseUrl = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }
  } catch (e) {
    console.warn('[api] process.env not available, using fallback URL');
  }

  return 'https://growvest-mobile.onrender.com/api';
};

export const API_BASE_URL = getBaseUrl();

export const API_ENDPOINTS = {
  // Auth
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  ME: '/auth/me',
  UPDATE_USERNAME: '/auth/username',
  UPDATE_EMAIL: '/auth/email',
  UPDATE_MOBILE: '/auth/mobile',
  UPDATE_PROFILE: '/auth/update-profile',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_RESET_TOKEN: (token) => `/auth/verify-reset-token/${token}`,

  // User profile (balances + account data — same as web client)
  USER_PROFILE: '/users/profile',

  // Dashboard
  DASHBOARD: '/dashboard',

  // Investments
  INVESTMENTS: '/investments',
  INVESTMENT_BY_ID: (id) => `/investments/${id}`,
  INVESTMENT_PLANS: '/investments/plans',

  // Transactions
  TRANSACTIONS: '/transactions',
  TRANSACTION_BY_ID: (id) => `/transactions/${id}`,

  // Withdrawals
  WITHDRAWALS: '/withdrawals',
  WITHDRAWAL_BY_ID: (id) => `/withdrawals/${id}`,

  // Push notifications (FCM)
  FCM_TOKEN: '/users/fcm-token',

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (id) => `/notifications/${id}/read`,
  NOTIFICATION_READ_ALL: '/notifications/read-all',
  NOTIFICATION_UNREAD_COUNT: '/notifications/unread-count',

  // KYC
  KYC_SUBMIT: '/kyc/submit',
  KYC_STATUS: '/kyc/status',
  KYC_BANK_DETAILS: '/kyc/bank-details',
  KYC_ALL: '/kyc/all',
  KYC_DETAIL: (id) => `/kyc/${id}`,
  KYC_REVIEW: (id) => `/kyc/${id}/review`,
  KYC_STATS: '/kyc/stats',

  // Chit Fund
  CHITS: '/chits',
  CHIT_BY_ID: (id) => `/chits/${id}`,
  MY_CHITS: '/chits/my',
  CHIT_DASHBOARD: '/chits/dashboard',
  JOIN_CHIT: '/chits/join',
  CHIT_PAYMENT: '/chits/payment',
  CHIT_PAYMENTS: '/chits/payments',
  CHIT_WINNERS: '/chits/winners',
  CHIT_DIVIDENDS: '/chits/dividends',
  CHIT_MEMBERS: (id) => `/chits/${id}/members`,

  // Razorpay Payments
  PAYMENT_CREATE_ORDER: '/payments/create-order',
  PAYMENT_VERIFY: '/payments/verify',

  CHIT_AUCTION: (id) => `/chits/${id}/auction`,
};