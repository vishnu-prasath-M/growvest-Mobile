import { Platform } from 'react-native';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Use mobile server URL
  return 'https://growvest-mobile-server.onrender.com/api/mobile';
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
};
