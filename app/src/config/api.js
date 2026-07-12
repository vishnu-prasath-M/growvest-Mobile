import { Platform } from 'react-native';

const getBaseUrl = () => {
  try {
    // In release builds, process.env may be undefined.
    // babel-preset-expo replaces EXPO_PUBLIC_* at build time,
    // but we guard against process.env being absent at runtime.
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
  UPDATE_MOBILE: '/auth/mobile',
  UPDATE_PROFILE: '/auth/update-profile',

  // User profile (balances + account data — same as web client)
  USER_PROFILE: '/users/profile',

  // Dashboard
  DASHBOARD: '/dashboard',

  // Investments
  INVESTMENTS: '/investments',
  INVESTMENT_BY_ID: (id) => `/investments/${id}`,

  // Transactions
  TRANSACTIONS: '/transactions',
  TRANSACTION_BY_ID: (id) => `/transactions/${id}`,

  // Withdrawals
  WITHDRAWALS: '/withdrawals',
  WITHDRAWAL_BY_ID: (id) => `/withdrawals/${id}`,

  // Push notifications (FCM)
  FCM_TOKEN: '/users/fcm-token',

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
  CHIT_AUCTION: (id) => `/chits/${id}/auction`,
};