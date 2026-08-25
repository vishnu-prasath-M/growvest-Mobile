import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

console.log('[apiService] Initializing with base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout
});

let slowNetworkListener = null;
let databaseErrorListener = null;

export const registerApiListeners = (onSlow, onError) => {
  slowNetworkListener = onSlow;
  databaseErrorListener = onError;
};

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    // Start a 6-second timer to detect slowness
    const timerId = setTimeout(() => {
      if (slowNetworkListener) {
        slowNetworkListener(true);
      }
    }, 6000);
    config.metadata = { timerId };

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[apiService] Error getting token from storage:', error?.message || error);
    }
    return config;
  },
  (error) => {
    console.error('[apiService] Request interceptor error:', error?.message || error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Clear the slowness timer
    if (response.config?.metadata?.timerId) {
      clearTimeout(response.config.metadata.timerId);
    }
    if (slowNetworkListener) {
      slowNetworkListener(false);
    }
    return response;
  },
  async (error) => {
    // Clear the slowness timer
    if (error.config?.metadata?.timerId) {
      clearTimeout(error.config.metadata.timerId);
    }
    if (slowNetworkListener) {
      slowNetworkListener(false);
    }

    const status = error.response?.status;
    const url = error.config?.url || '';
    console.error('[apiService] Response error:', error?.message || error, 'Status:', status, 'URL:', url);
    console.error('[apiService] Error response data:', error.response?.data);

    // Log response error
    if (!error.response) {
      console.warn('[apiService] Network connection lost or server unreachable');
    }
    
    // Only clear auth tokens when the /auth/me endpoint returns 401
    // (meaning the stored token is truly invalid / expired).
    // Do NOT clear for payment/investment endpoints — that would cascade
    // and break the entire payment flow.
    if (status === 401 && (url.includes('/auth/me') || url.includes('/auth/login'))) {
      try {
        await AsyncStorage.multiRemove(['userToken', 'userData']);
        console.log('[apiService] Cleared auth tokens due to 401 on auth endpoint');
      } catch (clearError) {
        console.error('[apiService] Error clearing storage:', clearError?.message || clearError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
